import { FastifyInstance } from 'fastify';
import * as crypto from 'node:crypto';
import * as net from 'node:net';
import { spawn } from 'node:child_process';
import { DatabaseRepository, getDbPool } from '@packing-proof/database';
import { validateAndCleanBarcode, buildCollisionProofFilename } from '@packing-proof/shared-utils';
import { AuthService } from '../auth/auth.service.js';
import { authenticateUser } from '../auth/auth.middleware.js';
import {
  requireRoles,
  resolveAndVerifyStationAccess
} from '../auth/authorization.guard.js';
import { WorkerGateway } from '../websocket/worker-gateway.js';
import { StationGateway } from '../websocket/station-gateway.js';
import { config } from '../config.js';

export async function packingRoutes(app: FastifyInstance) {
  // 1. Validate Barcode
  app.post('/api/v1/packing/validate-barcode', {
    preHandler: [authenticateUser, requireRoles('SUPER_ADMIN', 'ADMIN', 'WAREHOUSE_MANAGER', 'PACKING_USER')]
  }, async (request, reply) => {
    const { trackingCode, stationId } = request.body as any;
    const user = request.user!;

    if (!trackingCode || !stationId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'trackingCode and stationId are required' }
      });
    }

    const stationAccess = await resolveAndVerifyStationAccess(user, stationId);
    if (!stationAccess.allowed) {
      return reply.status(stationAccess.statusCode || 403).send({
        success: false,
        error: { code: 'ACCESS_DENIED', message: stationAccess.reason }
      });
    }

    const match = validateAndCleanBarcode(trackingCode);
    if (!match.isValid) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_BARCODE_FORMAT', message: 'Tracking code does not match supported carrier patterns' }
      });
    }

    const targetWarehouseId = stationAccess.station.warehouseId;
    const duplicateCheck = await DatabaseRepository.checkDuplicateTracking(targetWarehouseId, match.cleanedCode);
    const orderRecord = await DatabaseRepository.findOrderByTrackingCode(targetWarehouseId, match.cleanedCode);

    let customerData = null;
    if (orderRecord?.customer_info) {
      try {
        customerData = JSON.parse(orderRecord.customer_info);
      } catch {
        customerData = { note: orderRecord.customer_info };
      }
    }

    return reply.status(200).send({
      success: true,
      data: {
        isValid: true,
        platform: orderRecord?.platform || match.platform,
        cleanedCode: match.cleanedCode,
        orderCode: orderRecord?.order_code || match.cleanedCode,
        isDuplicate: duplicateCheck.isDuplicate,
        previousPackedAt: duplicateCheck.packedAt || null,
        customer: customerData
      }
    });
  });

  // 2. Start Packing (Returns 202 Accepted, status: WAITING)
  app.post('/api/v1/packing/start', {
    preHandler: [authenticateUser, requireRoles('SUPER_ADMIN', 'ADMIN', 'WAREHOUSE_MANAGER', 'PACKING_USER')]
  }, async (request, reply) => {
    const { stationId, trackingCode, orderCode, platform } = request.body as any;
    const idempotencyKey = (request.headers['idempotency-key'] as string) || crypto.randomUUID();
    const user = request.user!;

    if (!trackingCode) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'trackingCode is required' }
      });
    }

    // Resolve station
    let targetStationId = stationId;
    if (!targetStationId) {
      const defaultStation = await DatabaseRepository.findStationByCode('PACK01');
      targetStationId = defaultStation?.id;
    }
    if (!targetStationId) {
      return reply.status(404).send({
        success: false,
        error: { code: 'STATION_NOT_FOUND', message: 'Specified packing station does not exist' }
      });
    }

    // Verify Station, Business, and Warehouse Scope
    const stationAccess = await resolveAndVerifyStationAccess(user, targetStationId);
    if (!stationAccess.allowed) {
      return reply.status(stationAccess.statusCode || 403).send({
        success: false,
        error: { code: 'ACCESS_DENIED', message: stationAccess.reason }
      });
    }
    const station = stationAccess.station;

    // Check Tenant Subscription & Quota Limits on target station's business
    const targetBusinessId = station.businessId || user.businessId;
    if (targetBusinessId) {
      const quotaCheck = await DatabaseRepository.checkTenantQuota(targetBusinessId);
      if (!quotaCheck.isAllowed) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'SUBSCRIPTION_LIMIT_REACHED',
            message: quotaCheck.reason || 'Hạn mức đơn hàng hoặc gói cước của công ty/shop đã hết hạn'
          }
        });
      }
    }

    // Auto-clear stale sessions if any (INDETERMINATE_TIMEOUT only)
    await DatabaseRepository.clearStaleSessions(targetStationId);

    // Check for active session
    const active = await DatabaseRepository.checkActiveSession(targetStationId);
    if (active) {
      return reply.status(409).send({
        success: false,
        error: {
          code: 'ACTIVE_SESSION_EXISTS',
          message: 'Station already has an active or pending recording session',
          activeSessionId: active.id
        }
      });
    }

    // Check worker connectivity
    if (!WorkerGateway.isWorkerConnected(targetStationId)) {
      return reply.status(503).send({
        success: false,
        error: { code: 'WORKER_OFFLINE', message: 'Station video worker daemon is currently offline' }
      });
    }

    const camera = await DatabaseRepository.findCameraByStationId(targetStationId);
    if (!camera) {
      return reply.status(500).send({
        success: false,
        error: { code: 'CAMERA_NOT_CONFIGURED', message: 'No camera configured for this station' }
      });
    }

    const sessionId = crypto.randomUUID();
    const workerEpoch = WorkerGateway.getWorkerEpoch(targetStationId) || undefined;
    const cleanedCode = trackingCode.trim().toUpperCase();
    const resolvedOrderCode = orderCode || cleanedCode;
    const resolvedPlatform = platform || 'SPX';

    // 1. Transactional Outbox + Session creation (always use verified station.warehouseId)
    await DatabaseRepository.createPackingSessionTx({
      sessionId,
      warehouseId: station.warehouseId,
      stationId: targetStationId,
      cameraId: camera.id,
      userId: user.sub,
      trackingCode: cleanedCode,
      orderCode: resolvedOrderCode,
      platform: resolvedPlatform,
      idempotencyKey,
      workerEpoch
    });

    // 2. Dispatch command to worker over WebSocket
    const filePattern = buildCollisionProofFilename(cleanedCode, station?.code || 'PACK01', sessionId);
    WorkerGateway.dispatchStartRecord(targetStationId, {
      sessionId,
      workerEpoch: workerEpoch || '',
      trackingCode: cleanedCode,
      stationCode: station?.code || 'PACK01',
      camera: {
        type: camera.type,
        url: camera.rtspUrl || undefined
      },
      outputTempPattern: filePattern
    });

    // 3. Start 15-second handshake watchdog timer (D01-01)
    setTimeout(async () => {
      try {
        const session = await DatabaseRepository.findSessionById(sessionId);
        if (session && session.status === 'WAITING') {
          console.warn(`[Watchdog] Session ${sessionId} timed out in WAITING. Setting INDETERMINATE_TIMEOUT.`);
          await DatabaseRepository.updateSessionStatus(sessionId, 'INDETERMINATE_TIMEOUT', 'Camera initial stream handshake timeout');
          StationGateway.broadcastSessionState(sessionId, targetStationId, 'INDETERMINATE_TIMEOUT');
        }
      } catch (err) {
        console.error('[Watchdog] Error checking session status:', err);
      }
    }, 15000);

    return reply.status(202).send({
      success: true,
      data: {
        sessionId,
        operationId: `op_start_${sessionId.slice(0, 8)}`,
        status: 'WAITING',
        stationId: targetStationId,
        trackingCode: cleanedCode
      }
    });
  });

  // 3. Stop Packing (Returns 202 Accepted, status: PROCESSING)
  app.post('/api/v1/packing/stop', {
    preHandler: [authenticateUser, requireRoles('SUPER_ADMIN', 'ADMIN', 'WAREHOUSE_MANAGER', 'PACKING_USER')]
  }, async (request, reply) => {
    const { sessionId } = request.body as any;
    const user = request.user!;

    if (!sessionId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'sessionId is required' }
      });
    }

    const session = await DatabaseRepository.findSessionById(sessionId);
    if (!session) {
      return reply.status(404).send({
        success: false,
        error: { code: 'SESSION_NOT_FOUND', message: 'Packing session not found' }
      });
    }

    // Scoping check: verify caller owns session's business and warehouse
    if (user.role !== 'SUPER_ADMIN') {
      if (session.business_id && session.business_id !== user.businessId) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Phiên đóng gói thuộc doanh nghiệp khác. Truy cập bị từ chối' }
        });
      }
      if (user.role === 'PACKING_USER' || user.role === 'WAREHOUSE_MANAGER') {
        if (!user.warehouseId || session.warehouse_id !== user.warehouseId) {
          return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN', message: 'Bạn không có quyền thao tác trên phiên đóng gói của kho này' }
          });
        }
      }
    }

    if (session.status !== 'RECORDING') {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_SESSION_STATE', message: `Cannot stop session in status ${session.status}` }
      });
    }

    await DatabaseRepository.updateSessionStatus(sessionId, 'PROCESSING');
    WorkerGateway.dispatchStopRecord(session.station_id, { sessionId });
    StationGateway.broadcastSessionState(sessionId, session.station_id, 'PROCESSING');

    return reply.status(202).send({
      success: true,
      data: {
        sessionId,
        operationId: `op_stop_${sessionId.slice(0, 8)}`,
        status: 'PROCESSING'
      }
    });
  });

  // 4. Cancel Packing (Returns 202 Accepted, status: CANCELLING)
  app.post('/api/v1/packing/cancel', {
    preHandler: [authenticateUser, requireRoles('SUPER_ADMIN', 'ADMIN', 'WAREHOUSE_MANAGER', 'PACKING_USER')]
  }, async (request, reply) => {
    const { sessionId, reason } = request.body as any;
    const user = request.user!;

    if (!sessionId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'sessionId is required' }
      });
    }

    const session = await DatabaseRepository.findSessionById(sessionId);
    if (!session) {
      return reply.status(404).send({
        success: false,
        error: { code: 'SESSION_NOT_FOUND', message: 'Packing session not found' }
      });
    }

    // Scoping check: verify caller owns session's business and warehouse
    if (user.role !== 'SUPER_ADMIN') {
      if (session.business_id && session.business_id !== user.businessId) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Phiên đóng gói thuộc doanh nghiệp khác. Truy cập bị từ chối' }
        });
      }
      if (user.role === 'PACKING_USER' || user.role === 'WAREHOUSE_MANAGER') {
        if (!user.warehouseId || session.warehouse_id !== user.warehouseId) {
          return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN', message: 'Bạn không có quyền thao tác trên phiên đóng gói của kho này' }
          });
        }
      }
    }

    await DatabaseRepository.updateSessionStatus(sessionId, 'CANCELLING', reason);
    WorkerGateway.dispatchCancelRecord(session.station_id, { sessionId, reason });

    return reply.status(202).send({
      success: true,
      data: {
        sessionId,
        operationId: `op_cancel_${sessionId.slice(0, 8)}`,
        status: 'CANCELLING'
      }
    });
  });

  // 5. Query Session
  app.get('/api/v1/packing/sessions/:id', { preHandler: [authenticateUser] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user!;
    const session = await DatabaseRepository.findSessionById(id);
    if (!session) {
      return reply.status(404).send({
        success: false,
        error: { code: 'SESSION_NOT_FOUND', message: 'Packing session not found' }
      });
    }

    // Scoping check
    if (user.role !== 'SUPER_ADMIN') {
      if (session.business_id && session.business_id !== user.businessId) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Phiên đóng gói thuộc doanh nghiệp khác' }
        });
      }
      if (user.role === 'PACKING_USER' || user.role === 'WAREHOUSE_MANAGER') {
        if (!user.warehouseId || session.warehouse_id !== user.warehouseId) {
          return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN', message: 'Bạn không có quyền xem phiên đóng gói của kho này' }
          });
        }
      }
    }

    return reply.status(200).send({
      success: true,
      data: {
        sessionId: session.id,
        trackingCode: session.tracking_code,
        orderCode: session.order_code,
        status: session.status,
        hasPartialVideo: Boolean(session.has_partial_video),
        startTime: session.start_time ? session.start_time.toISOString() : null,
        endTime: session.end_time ? session.end_time.toISOString() : null,
        video: session.video_id ? {
          id: session.video_id,
          filename: session.filename,
          duration: Number(session.duration),
          fileSize: Number(session.file_size),
          sha256: session.sha256,
          syncStatus: session.sync_status
        } : null
      }
    });
  });

  // 6. Station Active Snapshot
  app.get('/api/v1/packing/stations/:id/active', { preHandler: [authenticateUser] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user!;

    const stationAccess = await resolveAndVerifyStationAccess(user, id);
    if (!stationAccess.allowed) {
      return reply.status(stationAccess.statusCode || 403).send({
        success: false,
        error: { code: 'ACCESS_DENIED', message: stationAccess.reason }
      });
    }

    const active = await DatabaseRepository.checkActiveSession(id);
    const isOnline = WorkerGateway.isWorkerConnected(id);

    return reply.status(200).send({
      success: true,
      data: {
        stationId: id,
        stationStatus: isOnline ? (active ? 'BUSY' : 'ONLINE') : 'OFFLINE',
        activeSession: active ? {
          sessionId: active.id,
          status: active.status,
          startTime: active.startTime,
          elapsedSeconds: Math.floor((Date.now() - new Date(active.startTime).getTime()) / 1000)
        } : null,
        worker: {
          status: isOnline ? 'ONLINE' : 'OFFLINE'
        }
      }
    });
  });

  // 7. Force Unlock Station
  app.post('/api/v1/stations/:id/force-unlock', {
    preHandler: [authenticateUser, requireRoles('SUPER_ADMIN', 'ADMIN', 'WAREHOUSE_MANAGER')]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { reason } = request.body as any;
    const user = request.user!;

    const stationAccess = await resolveAndVerifyStationAccess(user, id);
    if (!stationAccess.allowed) {
      return reply.status(stationAccess.statusCode || 403).send({
        success: false,
        error: { code: 'ACCESS_DENIED', message: stationAccess.reason }
      });
    }

    await DatabaseRepository.forceUnlockStation(id, user.sub, reason || 'Supervisor manual unlock');
    StationGateway.broadcastSessionState('NONE', id, 'UNLOCKED');

    // Audit Log: Sensitive operation STATION_FORCE_UNLOCKED
    await DatabaseRepository.recordAuditLog({
      businessId: stationAccess.station?.businessId,
      warehouseId: stationAccess.station?.warehouseId,
      userId: user.sub,
      stationId: id,
      action: 'STATION_FORCE_UNLOCKED',
      resourceType: 'STATION',
      resourceId: id,
      details: {
        stationCode: stationAccess.station?.code,
        stationName: stationAccess.station?.name,
        reason: reason || 'Supervisor manual unlock'
      }
    });

    return reply.status(200).send({
      success: true,
      data: { message: `Station ${id} force-unlocked successfully` }
    });
  });

  // 8.0 List Warehouses (scoped to caller's business)
  app.get('/api/v1/admin/warehouses', { preHandler: [authenticateUser] }, async (request, reply) => {
    const user = request.user!;
    const { businessId } = request.query as any;
    let targetBizId = businessId;
    if (user.role !== 'SUPER_ADMIN') {
      targetBizId = user.businessId;
    }
    const warehouses = await DatabaseRepository.getWarehouses(targetBizId && targetBizId !== 'ALL' ? targetBizId : undefined);
    return reply.status(200).send({
      success: true,
      data: warehouses
    });
  });

  // 8. List all stations (scoped to caller's business and warehouse)
  app.get('/api/v1/stations', { preHandler: [authenticateUser] }, async (request, reply) => {
    const user = request.user!;
    const { businessId, warehouseId } = request.query as any;
    let stations = await DatabaseRepository.getAllStations();
    if (user.role === 'SUPER_ADMIN') {
      if (businessId && businessId !== 'ALL') {
        stations = stations.filter((s: any) => s.businessId === businessId);
      }
      if (warehouseId && warehouseId !== 'ALL') {
        stations = stations.filter((s: any) => s.warehouseId === warehouseId);
      }
    } else {
      stations = stations.filter((s: any) => {
        if (s.businessId && s.businessId !== user.businessId) return false;
        if ((user.role === 'PACKING_USER' || user.role === 'WAREHOUSE_MANAGER') && user.warehouseId) {
          return s.warehouseId === user.warehouseId;
        }
        if (warehouseId && warehouseId !== 'ALL') {
          return s.warehouseId === warehouseId;
        }
        return true;
      });
    }
    return reply.status(200).send({
      success: true,
      data: stations
    });
  });

  // 8.1 List Orders & Packing Status
  app.get('/api/v1/orders', { preHandler: [authenticateUser] }, async (request, reply) => {
    const user = request.user!;
    const { search, status, platform } = request.query as any;
    const orders = await DatabaseRepository.getOrders({
      warehouseId: user.warehouseId || undefined,
      search: search ? String(search).trim() : undefined,
      status: status ? String(status).trim() : undefined,
      platform: platform ? String(platform).trim() : undefined
    });
    return reply.status(200).send({
      success: true,
      data: orders
    });
  });

  // 8.2 Seed Realistic E-Commerce Orders
  app.post('/api/v1/orders/seed', { preHandler: [authenticateUser] }, async (request, reply) => {
    const user = request.user!;
    const count = await DatabaseRepository.seedSampleOrders();
    try {
      if (user.businessId) {
        StationGateway.broadcast(
          'ORDERS_UPDATED',
          { source: 'SEED', count },
          { businessId: user.businessId, warehouseId: user.warehouseId || undefined }
        ).catch(() => {});
      }
    } catch {}
    return reply.status(200).send({
      success: true,
      data: { message: `Đã nạp thành công ${count} đơn hàng mẫu thực tế`, count }
    });
  });

  // 8.2.1 Delete Single Order
  app.delete('/api/v1/orders/:id', { preHandler: [authenticateUser] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await DatabaseRepository.deleteOrder(id);
    return reply.status(200).send({
      success: true,
      data: { message: 'Đã xóa đơn hàng thành công' }
    });
  });

  // 8.2.1b Mark Order Manually Completed (Skipped / Forgot video)
  app.post('/api/v1/orders/:id/manual-complete', { preHandler: [authenticateUser] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user!;
    await DatabaseRepository.markOrderManuallyCompleted(id, user.sub);

    // Broadcast to workbenches so it disappears from queue
    try {
      if (user.businessId) {
        StationGateway.broadcast(
          'ORDERS_UPDATED',
          { source: 'MANUAL_COMPLETE', orderId: id },
          { businessId: user.businessId, warehouseId: user.warehouseId || undefined }
        ).catch(() => {});
      }
    } catch {}

    return reply.status(200).send({
      success: true,
      data: { message: 'Đã đánh dấu đơn hàng đóng gói thủ công thành công' }
    });
  });

  // 8.2.2 Purge All Orders / Clear Test Orders
  app.delete('/api/v1/orders/purge', { preHandler: [authenticateUser] }, async (request, reply) => {
    const user = request.user!;
    const count = await DatabaseRepository.purgeAllOrders(user.warehouseId || undefined);
    return reply.status(200).send({
      success: true,
      data: { message: `Đã dọn dẹp ${count} đơn hàng`, count }
    });
  });

  // 8.2.3 Import Orders (CSV or JSON batch)
  app.post('/api/v1/orders/import', { preHandler: [authenticateUser] }, async (request, reply) => {
    const user = request.user!;
    if (user.businessId) {
      const quotaCheck = await DatabaseRepository.checkTenantQuota(user.businessId);
      if (!quotaCheck.isAllowed) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'SUBSCRIPTION_LIMIT_REACHED',
            message: quotaCheck.reason || 'Hạn mức đơn hàng hoặc gói cước của công ty/shop đã hết hạn'
          }
        });
      }
    }

    const body = request.body as any;
    const ordersList = Array.isArray(body) ? body : body.orders;
    if (!ordersList || !Array.isArray(ordersList) || ordersList.length === 0) {
      return reply.status(400).send({
        success: false,
        error: { code: 'EMPTY_LIST', message: 'Danh sách đơn hàng tải lên trống' }
      });
    }

    const result = await DatabaseRepository.importOrders(ordersList, user.warehouseId || undefined);
    return reply.status(200).send({
      success: true,
      data: {
        message: `Đã nhập thành công ${result.successCount} đơn hàng vào kho`,
        successCount: result.successCount,
        errors: result.errors
      }
    });
  });

  // 8.2.4 Sync Orders from Chrome Extension (Sapo / Omnichannel)
  app.post('/api/v1/orders/sync-extension', async (request, reply) => {
    try {
      const body = request.body as any;
      if (!body) {
        return reply.status(400).send({ success: false, error: { message: 'Dữ liệu đơn hàng không hợp lệ' } });
      }

      // 1. Resolve Warehouse ID
      let targetWarehouseId = body.warehouseId;
      if (!targetWarehouseId) {
        const authHeader = request.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
          try {
            const token = authHeader.slice(7);
            const decoded = AuthService.verifyToken(token);
            targetWarehouseId = decoded.warehouseId;
          } catch {}
        }
      }

      // Default to central warehouse if not specified
      if (!targetWarehouseId) {
        const pool = await getDbPool();
        const whRes = await pool.request().query('SELECT TOP 1 id FROM warehouses ORDER BY created_at ASC');
        targetWarehouseId = whRes.recordset[0]?.id;
      }

      if (!targetWarehouseId) {
        return reply.status(404).send({ success: false, error: { message: 'Không tìm thấy kho hàng để nạp đơn' } });
      }

      // 2. Normalize orders list (Supports Sapo raw JSON or standard format)
      const rawOrders = Array.isArray(body)
        ? body
        : (body.orders ? (Array.isArray(body.orders) ? body.orders : [body.orders]) : [body]);
      const normalizedOrders = [];

      for (const raw of rawOrders) {
        const orderCode = raw.orderCode || raw.order_number || raw.name || raw.code || '';
        let trackingCode = raw.trackingCode || raw.tracking_code || '';

        // Sapo fulfillments tracking
        if (!trackingCode && raw.fulfillments && Array.isArray(raw.fulfillments) && raw.fulfillments.length > 0) {
          trackingCode = raw.fulfillments[0].tracking_number || raw.fulfillments[0].tracking_code || '';
        }

        if (!trackingCode && !orderCode) continue;

        // Customer info
        const customerName = raw.customerName || raw.customer?.name || raw.customer?.full_name || raw.shipping_address?.name || '';
        const phone = raw.phone || raw.customer?.phone || raw.shipping_address?.phone || '';
        const address = raw.address || (raw.shipping_address ? `${raw.shipping_address.address1 || ''}, ${raw.shipping_address.ward || ''}, ${raw.shipping_address.district || ''}, ${raw.shipping_address.city || ''}` : '');
        const note = raw.note || raw.client_note || '';
        const totalAmount = Number(raw.totalAmount || raw.total_price || raw.total_amount || 0);
        const codAmount = Number(raw.codAmount || raw.cod_amount || raw.cod || 0);

        // Extract items
        const rawItems = raw.items || raw.line_items || [];
        const items = rawItems.map((it: any) => ({
          sku: it.sku || it.barcode || it.product_code || it.variant_sku || 'SP-GENERIC',
          name: it.name || it.product_name || it.title || 'Sản phẩm',
          quantity: Number(it.quantity) || 1,
          price: Number(it.price || it.unit_price || it.original_price || 0),
          discount: Number(it.discount || 0),
          total: Number(it.total || it.line_total || it.amount || 0),
          variant: it.variant || ''
        }));

        normalizedOrders.push({
          orderCode: String(orderCode),
          trackingCode: String(trackingCode || orderCode),
          platform: raw.platform || (raw.source_name ? String(raw.source_name).toUpperCase() : 'SAPO'),
          customerName,
          phone,
          address,
          note,
          totalAmount,
          codAmount,
          carrier: raw.carrier || raw.partner_name || '',
          service: raw.service || raw.shipping_service || '',
          deliveryCode: raw.deliveryCode || raw.fulfillment_code || '',
          discount: Number(raw.discount || 0),
          tax: Number(raw.tax || 0),
          packedDate: raw.packedDate || '',
          exportedDate: raw.exportedDate || '',
          items
        });
      }

      if (normalizedOrders.length === 0) {
        return reply.status(400).send({
          success: false,
          error: { message: 'Không trích xuất được đơn hàng nào từ dữ liệu gửi lên' }
        });
      }

      const result = await DatabaseRepository.upsertOrdersBatch(targetWarehouseId, normalizedOrders);

      // Realtime broadcast to all connected packing workbenches
      try {
        const wh = await DatabaseRepository.findWarehouseById(targetWarehouseId);
        if (wh && wh.businessId) {
          StationGateway.broadcast(
            'ORDERS_UPDATED',
            {
              source: 'EXTENSION',
              inserted: result.inserted,
              updated: result.updated,
              total: result.total
            },
            { businessId: wh.businessId, warehouseId: targetWarehouseId }
          ).catch((e) => console.warn('[WS] Broadcast ORDERS_UPDATED failed:', e));
        }
      } catch (e) {
        // Non-fatal
      }

      return reply.status(200).send({
        success: true,
        data: {
          message: `Đã đồng bộ thành công ${result.total} đơn hàng từ Sapo (${result.inserted} mới, ${result.updated} cập nhật)`,
          inserted: result.inserted,
          updated: result.updated,
          total: result.total
        }
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: { message: err.message || 'Lỗi đồng bộ đơn hàng từ extension' }
      });
    }
  });

  // 8.2.5 Download Sample Import Template (CSV UTF-8)
  app.get('/api/v1/orders/template', async (_request, reply) => {
    const csvContent =
      '\uFEFF' +
      'MaDonHang,MaVanDon,SanTMDT,TenKhachHang,SoDienThoai,DiaChi,SKU,TenSanPham,SoLuong,GiaTien,GhiChu\r\n' +
      'ORD-SPX-001,SPXVN0888999123,SPX,Nguyễn Thị Lan Anh,0984321890,"18 Nguyễn Khánh Toàn, Cầu Giấy, Hà Nội",ATN-COTTON-DEN-L,Áo Thun Nam Cotton Đen L,2,189000,Giao giờ hành chính\r\n' +
      'ORD-SPX-001,SPXVN0888999123,SPX,Nguyễn Thị Lan Anh,0984321890,"18 Nguyễn Khánh Toàn, Cầu Giấy, Hà Nội",MLT-VINTAGE-BE,Mũ Lưỡi Trai Vintage Be,1,85000,Giao giờ hành chính\r\n' +
      'ORD-TIKTOK-002,TIKTOK9876543210,TIKTOK,Trần Văn Hùng,0912888666,"Landmark 81, Bình Thạnh, TP.HCM",TWS-ANC-WHITE,Tai Nghe Bluetooth TWS Trắng,1,650000,Hàng điện tử xin nhẹ tay\r\n';

    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', 'attachment; filename="Mau_Nhap_Don_Hang_Dong_Goi.csv"');
    return reply.send(csvContent);
  });

  // 8.3 Live Camera MJPEG Stream Preview for Browser Viewport
  app.get('/api/v1/stations/:id/live-preview', async (request, reply) => {
    const { id } = request.params as { id: string };
    const camera = await DatabaseRepository.findCameraByStationId(id);

    if (!camera || !camera.rtspUrl || camera.rtspUrl.includes('mock')) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NO_LIVE_STREAM', message: 'No live RTSP camera attached to this station' }
      });
    }

    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'multipart/x-mixed-replace; boundary=ffmpeg',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'close',
      'Pragma': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    });

    const proc = spawn(config.ffmpegPath, [
      '-rtsp_transport', 'tcp',
      '-timeout', '5000000',
      '-i', camera.rtspUrl,
      '-f', 'mpjpeg',
      '-boundary_tag', 'ffmpeg',
      '-q:v', '5',
      '-r', '15',
      '-s', '960x540',
      'pipe:1'
    ], { stdio: ['ignore', 'pipe', 'ignore'] });

    proc.stdout.pipe(reply.raw);

    const cleanup = () => {
      try {
        proc.kill();
      } catch {}
    };

    request.raw.on('close', cleanup);
    request.raw.on('error', cleanup);
    reply.raw.on('close', cleanup);
    reply.raw.on('error', cleanup);
  });

  // 8.4 Single Camera JPEG Snapshot for low-bandwidth fallback
  app.get('/api/v1/stations/:id/snapshot', async (request, reply) => {
    const { id } = request.params as { id: string };
    const camera = await DatabaseRepository.findCameraByStationId(id);

    if (!camera || !camera.rtspUrl || camera.rtspUrl.includes('mock')) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NO_LIVE_STREAM', message: 'No live RTSP camera attached to this station' }
      });
    }

    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*'
    });

    const proc = spawn(config.ffmpegPath, [
      '-rtsp_transport', 'tcp',
      '-timeout', '5000000',
      '-i', camera.rtspUrl,
      '-vframes', '1',
      '-f', 'image2',
      '-q:v', '3',
      'pipe:1'
    ], { stdio: ['ignore', 'pipe', 'ignore'] });

    proc.stdout.pipe(reply.raw);
    request.raw.on('close', () => {
      try { proc.kill(); } catch {}
    });
  });

  // 9. Station recent sessions (today's history)
  app.get('/api/v1/packing/stations/:id/recent', { preHandler: [authenticateUser] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const limit = Number((request.query as any)?.limit) || 10;
    const sessions = await DatabaseRepository.getRecentSessions(id, limit);
    return reply.status(200).send({
      success: true,
      data: sessions
    });
  });

  // 10. Admin Dashboard Overview
  app.get('/api/v1/admin/dashboard', { preHandler: [authenticateUser] }, async (_request, reply) => {
    const stats = await DatabaseRepository.getDashboardStats();
    return reply.status(200).send({
      success: true,
      data: stats
    });
  });

  // 10.1 Logistics Operations & Productivity Dashboard
  app.get('/api/v1/admin/logistics-dashboard', { preHandler: [authenticateUser] }, async (request, reply) => {
    const user = request.user!;
    const timeRange = ((request.query as any)?.timeRange as ('today' | '7days' | '30days')) || 'today';
    const data = await DatabaseRepository.getLogisticsDashboardStats({
      warehouseId: user.warehouseId || undefined,
      timeRange
    });
    return reply.status(200).send({
      success: true,
      data
    });
  });

  // 11. Get System Settings & Storage Configs
  app.get('/api/v1/admin/settings', { preHandler: [authenticateUser] }, async (_request, reply) => {
    const data = await DatabaseRepository.getSystemSettings();
    return reply.status(200).send({
      success: true,
      data
    });
  });

  // 11.1 Get Storage & Video Retention Overview
  app.get('/api/v1/admin/storage/overview', { preHandler: [authenticateUser] }, async (request, reply) => {
    const days = Number((request.query as any)?.retentionDays) || 30;
    const overview = await DatabaseRepository.getStorageOverview(days);
    return reply.status(200).send({
      success: true,
      data: overview
    });
  });

  // 11.2 Trigger Storage Retention Cleanup
  app.post('/api/v1/admin/storage/cleanup', { preHandler: [authenticateUser] }, async (request, reply) => {
    const user = request.user!;
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Only admins can trigger storage cleanup' } });
    }
    return reply.status(409).send({
      success: false,
      error: { code: 'CUSTOMER_STORAGE_MANAGED_LOCALLY', message: 'Video được lưu tại máy kho. Chưa bật chính sách tự xóa; máy chủ không dọn bản gốc hoặc bản Drive.' }
    });
  });

  // 12. Update System Settings & Storage Configs
  app.put('/api/v1/admin/settings', { preHandler: [authenticateUser] }, async (request, reply) => {
    const user = request.user!;
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Only admins can modify system settings' } });
    }
    await DatabaseRepository.updateSystemSettings(request.body as any);
    return reply.status(200).send({
      success: true,
      data: { message: 'Settings updated successfully' }
    });
  });

  // 13. Create Station & Camera
  app.post('/api/v1/admin/stations', { preHandler: [authenticateUser] }, async (request, reply) => {
    const user = request.user!;
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Only admins can create stations' } });
    }
    const stationId = await DatabaseRepository.upsertStationWithCamera(request.body as any);
    return reply.status(201).send({
      success: true,
      data: { stationId, message: 'Station created successfully' }
    });
  });

  // 14. Update Station & Camera
  app.put('/api/v1/admin/stations/:id', { preHandler: [authenticateUser] }, async (request, reply) => {
    const user = request.user!;
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Only admins can modify stations' } });
    }
    const { id } = request.params as { id: string };
    const stationId = await DatabaseRepository.upsertStationWithCamera({ ...(request.body as any), stationId: id });
    return reply.status(200).send({
      success: true,
      data: { stationId, message: 'Station updated successfully' }
    });
  });

  // 15. Update Camera Directly
  app.put('/api/v1/admin/cameras/:id', { preHandler: [authenticateUser] }, async (request, reply) => {
    const user = request.user!;
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Only admins can modify cameras' } });
    }
    const { id } = request.params as { id: string };
    await DatabaseRepository.updateCameraDirectly(id, request.body as any);
    return reply.status(200).send({
      success: true,
      data: { message: 'Cấu hình Camera cập nhật thành công' }
    });
  });

  // 16. Test RTSP Camera / LAN Connectivity Probe
  app.post('/api/v1/admin/cameras/test', { preHandler: [authenticateUser] }, async (request, reply) => {
    const { rtspUrl, ipAddress, port: customPort } = request.body as any;

    let targetHost = ipAddress;
    let targetPort = customPort || 554;

    if (rtspUrl) {
      if (rtspUrl.toLowerCase().includes('mock') || rtspUrl.toLowerCase().includes('test-pattern') || rtspUrl.toLowerCase().includes('webcam')) {
        return reply.status(200).send({
          success: true,
          data: {
            reachable: true,
            latencyMs: 1,
            message: 'Nguồn video nội bộ / Webcam / Giả lập hợp lệ và sẵn sàng hoạt động'
          }
        });
      }

      // Parse RTSP URL
      try {
        const parsed = new URL(rtspUrl);
        targetHost = parsed.hostname;
        targetPort = parsed.port ? parseInt(parsed.port, 10) : 554;
      } catch {
        const match = rtspUrl.match(/@([^:/\s]+)(?::(\d+))?/);
        if (match) {
          targetHost = match[1];
          targetPort = match[2] ? parseInt(match[2], 10) : 554;
        } else {
          const directMatch = rtspUrl.match(/rtsp:\/\/([^:/\s]+)(?::(\d+))?/);
          if (directMatch) {
            targetHost = directMatch[1];
            targetPort = directMatch[2] ? parseInt(directMatch[2], 10) : 554;
          }
        }
      }
    }

    if (!targetHost) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_CAMERA_ADDRESS', message: 'Vui lòng cung cấp URL RTSP hoặc IP Camera hợp lệ' }
      });
    }

    // Perform TCP socket probe on RTSP port (typically 554)
    const startTime = Date.now();
    const probeResult = await new Promise<{ reachable: boolean; latencyMs: number; error?: string }>((resolve) => {
      const socket = new net.Socket();
      let finished = false;

      const timer = setTimeout(() => {
        if (!finished) {
          finished = true;
          socket.destroy();
          resolve({
            reachable: false,
            latencyMs: Date.now() - startTime,
            error: `Timeout: Camera không phản hồi cổng ${targetPort} sau 2.5 giây`
          });
        }
      }, 2500);

      socket.connect(targetPort, targetHost, () => {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          const latencyMs = Date.now() - startTime;
          socket.end();
          resolve({ reachable: true, latencyMs });
        }
      });

      socket.on('error', (err) => {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          socket.destroy();
          resolve({
            reachable: false,
            latencyMs: Date.now() - startTime,
            error: `Lỗi kết nối: ${err.message}`
          });
        }
      });
    });

    return reply.status(200).send({
      success: true,
      data: {
        host: targetHost,
        port: targetPort,
        reachable: probeResult.reachable,
        latencyMs: probeResult.latencyMs,
        message: probeResult.reachable
          ? `Kết nối Camera thành công (Ping ${probeResult.latencyMs}ms, cổng ${targetPort} mở)`
          : `Không kết nối được Camera: ${probeResult.error}`
      }
    });
  });

  // 17. Send PTZ Camera Command (Dahua CGI / ONVIF proxy)
  app.post('/api/v1/admin/cameras/ptz-command', { preHandler: [authenticateUser] }, async (request, reply) => {
    const { ipAddress, action = 'start', code = 'Up', arg1 = 0, arg2 = 5, arg3 = 0 } = request.body as any;
    if (!ipAddress) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_IP', message: 'Missing camera IP address' } });
    }

    try {
      // If mock or local simulation
      if (ipAddress.includes('mock') || ipAddress.includes('127.0.0.1') || ipAddress.includes('localhost')) {
        return reply.status(200).send({
          success: true,
          data: { message: `Lệnh PTZ ${code} (${action}) đã thực hiện (Giả lập)` }
        });
      }

      // Dahua PTZ CGI format: http://<ip>/cgi-bin/ptz.cgi?action=<start|stop>&channel=1&code=<code>&arg1=0&arg2=<speed>&arg3=0
      const cgiUrl = `http://${ipAddress}/cgi-bin/ptz.cgi?action=${action}&channel=1&code=${code}&arg1=${arg1}&arg2=${arg2}&arg3=${arg3}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);

      try {
        const cgiRes = await fetch(cgiUrl, { signal: controller.signal });
        clearTimeout(timeout);
        const text = await cgiRes.text();
        return reply.status(200).send({
          success: true,
          data: {
            message: `Lệnh PTZ ${code} gửi tới camera ${ipAddress}: ${text.slice(0, 100)}`
          }
        });
      } catch (e: any) {
        clearTimeout(timeout);
        return reply.status(200).send({
          success: true,
          data: {
            message: `Đã phát lệnh PTZ ${code} tới camera ${ipAddress}`
          }
        });
      }
    } catch (err: any) {
      return reply.status(200).send({
        success: true,
        data: { message: `Lệnh PTZ ${code} đã phát đi` }
      });
    }
  });
}
