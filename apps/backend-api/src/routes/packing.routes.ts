import { FastifyInstance } from 'fastify';
import * as crypto from 'node:crypto';
import * as net from 'node:net';
import { DatabaseRepository } from '@packing-proof/database';
import { validateAndCleanBarcode, buildCollisionProofFilename } from '@packing-proof/shared-utils';
import { authenticateUser, checkWarehouseAccess } from '../auth/auth.middleware.js';
import { WorkerGateway } from '../websocket/worker-gateway.js';
import { StationGateway } from '../websocket/station-gateway.js';

export async function packingRoutes(app: FastifyInstance) {
  // 1. Validate Barcode
  app.post('/api/v1/packing/validate-barcode', { preHandler: [authenticateUser] }, async (request, reply) => {
    const { trackingCode, stationId } = request.body as any;

    if (!trackingCode || !stationId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'trackingCode and stationId are required' }
      });
    }

    const match = validateAndCleanBarcode(trackingCode);
    if (!match.isValid) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_BARCODE_FORMAT', message: 'Tracking code does not match supported carrier patterns' }
      });
    }

    const user = request.user!;
    const duplicateCheck = await DatabaseRepository.checkDuplicateTracking(user.warehouseId || '', match.cleanedCode);
    const orderRecord = await DatabaseRepository.findOrderByTrackingCode(user.warehouseId || '', match.cleanedCode);

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
  app.post('/api/v1/packing/start', { preHandler: [authenticateUser] }, async (request, reply) => {
    const { stationId, trackingCode, orderCode, platform } = request.body as any;
    const idempotencyKey = (request.headers['idempotency-key'] as string) || crypto.randomUUID();
    const user = request.user!;

    // Validate station
    const station = await DatabaseRepository.findStationByCode('PACK01'); // or find by id
    const targetStationId = stationId || station?.id;
    if (!targetStationId) {
      return reply.status(404).send({
        success: false,
        error: { code: 'STATION_NOT_FOUND', message: 'Specified packing station does not exist' }
      });
    }

    // Verify warehouse scoping
    if (user.warehouseId && station && !checkWarehouseAccess(user, station.warehouseId)) {
      return reply.status(403).send({
        success: false,
        error: { code: 'WAREHOUSE_ACCESS_DENIED', message: 'You are not assigned to this warehouse' }
      });
    }

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

    // 1. Transactional Outbox + Session creation
    await DatabaseRepository.createPackingSessionTx({
      sessionId,
      warehouseId: station?.warehouseId || user.warehouseId || '',
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
  app.post('/api/v1/packing/stop', { preHandler: [authenticateUser] }, async (request, reply) => {
    const { sessionId } = request.body as any;

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
  app.post('/api/v1/packing/cancel', { preHandler: [authenticateUser] }, async (request, reply) => {
    const { sessionId, reason } = request.body as any;

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
    const session = await DatabaseRepository.findSessionById(id);
    if (!session) {
      return reply.status(404).send({
        success: false,
        error: { code: 'SESSION_NOT_FOUND', message: 'Packing session not found' }
      });
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
  app.post('/api/v1/stations/:id/force-unlock', { preHandler: [authenticateUser] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { reason } = request.body as any;
    const user = request.user!;

    if (user.role !== 'SUPER_ADMIN' && user.role !== 'WAREHOUSE_MANAGER' && user.role !== 'ADMIN') {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only warehouse managers or admins can force-unlock a station' }
      });
    }

    await DatabaseRepository.forceUnlockStation(id, user.sub, reason || 'Supervisor manual unlock');
    StationGateway.broadcastSessionState('NONE', id, 'UNLOCKED');

    return reply.status(200).send({
      success: true,
      data: { message: `Station ${id} force-unlocked successfully` }
    });
  });

  // 8. List all stations
  app.get('/api/v1/stations', { preHandler: [authenticateUser] }, async (_request, reply) => {
    const stations = await DatabaseRepository.getAllStations();
    return reply.status(200).send({
      success: true,
      data: stations
    });
  });

  // 8.1 List Orders & Packing Status
  app.get('/api/v1/orders', { preHandler: [authenticateUser] }, async (request, reply) => {
    const user = request.user!;
    const search = (request.query as any)?.search;
    const orders = await DatabaseRepository.getOrders({
      warehouseId: user.warehouseId || undefined,
      search: search ? String(search).trim() : undefined
    });
    return reply.status(200).send({
      success: true,
      data: orders
    });
  });

  // 8.2 Seed Realistic E-Commerce Orders
  app.post('/api/v1/orders/seed', { preHandler: [authenticateUser] }, async (_request, reply) => {
    const count = await DatabaseRepository.seedSampleOrders();
    return reply.status(200).send({
      success: true,
      data: { message: `Đã nạp thành công ${count} đơn hàng mẫu thực tế`, count }
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

  // 11. Get System Settings & Storage Configs
  app.get('/api/v1/admin/settings', { preHandler: [authenticateUser] }, async (_request, reply) => {
    const data = await DatabaseRepository.getSystemSettings();
    return reply.status(200).send({
      success: true,
      data
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
}
