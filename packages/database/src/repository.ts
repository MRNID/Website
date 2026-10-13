import { getDbPool, sql } from './db-client.js';
import {
  UserProfile,
  StationDto,
  CameraDto,
  PackingSessionDto,
  VideoSearchParams,
  DisputeStatus
} from '@packing-proof/shared-types';

export class DatabaseRepository {
  /**
   * User Authentication & Profile
   */
  static async findUserByUsername(username: string): Promise<any | null> {
    const pool = await getDbPool();
    const result = await pool.request()
      .input('username', sql.VarChar(50), username)
      .query(`
        SELECT u.id, u.business_id, u.warehouse_id, u.username, u.password_hash, u.full_name, u.email, u.is_active,
               r.name as role_name
        FROM users u
        INNER JOIN roles r ON u.role_id = r.id
        WHERE u.username = @username AND u.is_active = 1
      `);
    return result.recordset[0] || null;
  }

  static async findUserById(id: string): Promise<UserProfile | null> {
    const pool = await getDbPool();
    const result = await pool.request()
      .input('id', sql.VarChar(36), id)
      .query(`
        SELECT u.id, u.business_id, u.warehouse_id, u.username, u.full_name, u.email, u.is_active,
               r.name as role
        FROM users u
        INNER JOIN roles r ON u.role_id = r.id
        WHERE u.id = @id
      `);
    const row = result.recordset[0];
    if (!row) return null;
    return {
      id: row.id,
      businessId: row.business_id,
      warehouseId: row.warehouse_id,
      username: row.username,
      fullName: row.full_name,
      email: row.email,
      role: row.role,
      isActive: Boolean(row.is_active)
    };
  }

  /**
   * Stations, Workers & Cameras
   */
  static async findStationByCode(code: string): Promise<(StationDto & { businessId?: string }) | null> {
    const pool = await getDbPool();
    const result = await pool.request()
      .input('code', sql.VarChar(50), code)
      .query(`
        SELECT s.id, s.warehouse_id, s.name, s.code, s.computer_name, s.ip_address, s.status, s.last_heartbeat_at, s.created_at, s.updated_at,
               w.business_id
        FROM stations s
        LEFT JOIN warehouses w ON s.warehouse_id = w.id
        WHERE s.code = @code
      `);
    const r = result.recordset[0];
    if (!r) return null;
    return {
      id: r.id,
      warehouseId: r.warehouse_id,
      businessId: r.business_id,
      name: r.name,
      code: r.code,
      computerName: r.computer_name,
      ipAddress: r.ip_address,
      status: r.status,
      lastHeartbeatAt: r.last_heartbeat_at ? r.last_heartbeat_at.toISOString() : null,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString()
    };
  }

  static async findStationById(id: string): Promise<(StationDto & { businessId?: string }) | null> {
    const pool = await getDbPool();
    const result = await pool.request()
      .input('id', sql.VarChar(36), id)
      .query(`
        SELECT s.id, s.warehouse_id, s.name, s.code, s.computer_name, s.ip_address, s.status, s.last_heartbeat_at, s.created_at, s.updated_at,
               w.business_id
        FROM stations s
        LEFT JOIN warehouses w ON s.warehouse_id = w.id
        WHERE s.id = @id
      `);
    const r = result.recordset[0];
    if (!r) return null;
    return {
      id: r.id,
      warehouseId: r.warehouse_id,
      businessId: r.business_id,
      name: r.name,
      code: r.code,
      computerName: r.computer_name,
      ipAddress: r.ip_address,
      status: r.status,
      lastHeartbeatAt: r.last_heartbeat_at ? r.last_heartbeat_at.toISOString() : null,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString()
    };
  }

  static async findWarehouseById(id: string): Promise<{ id: string; businessId: string; name: string; code: string } | null> {
    const pool = await getDbPool();
    const result = await pool.request()
      .input('id', sql.VarChar(36), id)
      .query(`SELECT id, business_id as businessId, name, code FROM warehouses WHERE id = @id`);
    return result.recordset[0] || null;
  }

  static async findRoleById(id: string): Promise<{ id: string; businessId: string; name: string; description: string } | null> {
    const pool = await getDbPool();
    const result = await pool.request()
      .input('id', sql.VarChar(36), id)
      .query(`SELECT id, business_id as businessId, name, description FROM roles WHERE id = @id`);
    return result.recordset[0] || null;
  }

  static async findCameraByStationId(stationId: string): Promise<CameraDto | null> {
    const pool = await getDbPool();
    const result = await pool.request()
      .input('stationId', sql.VarChar(36), stationId)
      .query(`
        SELECT id, station_id, name, type, rtsp_url, username, status, created_at, updated_at
        FROM cameras
        WHERE station_id = @stationId
      `);
    const r = result.recordset[0];
    if (!r) return null;
    return {
      id: r.id,
      stationId: r.station_id,
      name: r.name,
      type: r.type,
      rtspUrl: r.rtsp_url,
      username: r.username,
      status: r.status,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString()
    };
  }

  static async verifyWorkerToken(stationId: string, tokenHash: string): Promise<boolean> {
    const pool = await getDbPool();
    const result = await pool.request()
      .input('stationId', sql.VarChar(36), stationId)
      .input('tokenHash', sql.VarChar(255), tokenHash)
      .query(`
        SELECT 1 FROM workers
        WHERE station_id = @stationId AND token_hash = @tokenHash
      `);
    return result.recordset.length > 0;
  }

  static async updateWorkerHeartbeat(stationId: string, epoch: string, telemetry: any): Promise<void> {
    const pool = await getDbPool();
    await pool.request()
      .input('stationId', sql.VarChar(36), stationId)
      .input('epoch', sql.VarChar(36), epoch)
      .input('telemetry', sql.NVarChar(sql.MAX), JSON.stringify(telemetry))
      .query(`
        UPDATE workers
        SET current_epoch = @epoch,
            last_heartbeat_at = GETDATE(),
            status = 'ONLINE',
            system_telemetry = @telemetry,
            updated_at = GETDATE()
        WHERE station_id = @stationId;

        UPDATE stations
        SET last_heartbeat_at = GETDATE(),
            status = 'ONLINE',
            updated_at = GETDATE()
        WHERE id = @stationId;
      `);
  }

  static async clearStaleSessions(stationId: string): Promise<void> {
    const pool = await getDbPool();
    await pool.request()
      .input('stId', sql.VarChar(36), stationId)
      .query(`
        UPDATE packing_sessions
        SET status = 'CANCELLED', end_time = GETDATE(), cancellation_reason = 'Handshake timeout auto-cleared'
        WHERE station_id = @stId
          AND status = 'INDETERMINATE_TIMEOUT'
      `);
  }

  /**
   * Packing Sessions & Orders
   */
  static async checkActiveSession(stationId: string): Promise<PackingSessionDto | null> {
    const pool = await getDbPool();
    const result = await pool.request()
      .input('stationId', sql.VarChar(36), stationId)
      .query(`
        SELECT s.id, s.warehouse_id, s.order_id, s.station_id, s.camera_id, s.user_id, s.status,
               s.idempotency_key, s.worker_epoch, s.version, s.start_time, s.end_time, s.cancellation_reason,
               s.has_partial_video, s.created_at, s.updated_at
        FROM packing_sessions s
        WHERE s.station_id = @stationId
          AND s.status IN ('WAITING', 'RECORDING', 'PROCESSING', 'CANCELLING')
      `);
    const r = result.recordset[0];
    if (!r) return null;
    return {
      id: r.id,
      warehouseId: r.warehouse_id,
      orderId: r.order_id,
      stationId: r.station_id,
      cameraId: r.camera_id,
      userId: r.user_id,
      status: r.status,
      idempotencyKey: r.idempotency_key,
      workerEpoch: r.worker_epoch,
      version: r.version,
      startTime: r.start_time.toISOString(),
      endTime: r.end_time ? r.end_time.toISOString() : null,
      cancellationReason: r.cancellation_reason,
      hasPartialVideo: Boolean(r.has_partial_video),
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString()
    };
  }

  static async findSessionById(sessionId: string): Promise<any | null> {
    const pool = await getDbPool();
    const result = await pool.request()
      .input('sessionId', sql.VarChar(36), sessionId)
      .query(`
        SELECT s.*, w.business_id, o.tracking_code, o.order_code, v.id as video_id, v.filename, v.duration, v.file_size, v.sha256, v.sync_status
        FROM packing_sessions s
        INNER JOIN orders o ON s.order_id = o.id
        LEFT JOIN warehouses w ON s.warehouse_id = w.id
        LEFT JOIN videos v ON s.id = v.packing_session_id
        WHERE s.id = @sessionId
      `);
    return result.recordset[0] || null;
  }

  static async checkDuplicateTracking(warehouseId: string, trackingCode: string): Promise<{ isDuplicate: boolean; packedAt?: string }> {
    const pool = await getDbPool();
    const result = await pool.request()
      .input('warehouseId', sql.VarChar(36), warehouseId)
      .input('trackingCode', sql.VarChar(100), trackingCode)
      .query(`
        SELECT TOP 1 s.created_at
        FROM orders o
        INNER JOIN packing_sessions s ON o.id = s.order_id
        WHERE o.warehouse_id = @warehouseId
          AND o.tracking_code = @trackingCode
          AND s.status = 'COMPLETED'
        ORDER BY s.created_at DESC
      `);
    if (result.recordset.length > 0) {
      return {
        isDuplicate: true,
        packedAt: result.recordset[0].created_at.toISOString()
      };
    }
    return { isDuplicate: false };
  }

  static async createPackingSessionTx(params: {
    sessionId: string;
    warehouseId: string;
    stationId: string;
    cameraId: string;
    userId: string;
    trackingCode: string;
    orderCode: string;
    platform: string;
    idempotencyKey: string;
    workerEpoch?: string;
  }): Promise<{ sessionId: string }> {
    const pool = await getDbPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
      // 1. Ensure or find order
      const orderReq = new sql.Request(tx);
      let orderResult = await orderReq
        .input('warehouseId', sql.VarChar(36), params.warehouseId)
        .input('trackingCode', sql.VarChar(100), params.trackingCode)
        .query('SELECT id FROM orders WHERE warehouse_id = @warehouseId AND tracking_code = @trackingCode');

      let orderId: string;
      if (orderResult.recordset.length > 0) {
        orderId = orderResult.recordset[0].id;
      } else {
        const createOrderReq = new sql.Request(tx);
        const newOrderId = require('node:crypto').randomUUID();
        await createOrderReq
          .input('id', sql.VarChar(36), newOrderId)
          .input('warehouseId', sql.VarChar(36), params.warehouseId)
          .input('orderCode', sql.VarChar(100), params.orderCode)
          .input('trackingCode', sql.VarChar(100), params.trackingCode)
          .input('platform', sql.VarChar(50), params.platform)
          .query(`
            INSERT INTO orders (id, warehouse_id, order_code, tracking_code, platform)
            VALUES (@id, @warehouseId, @orderCode, @trackingCode, @platform)
          `);
        orderId = newOrderId;
      }

      // 2. Insert packing session (Atomic trigger will verify single active session)
      const sessionReq = new sql.Request(tx);
      await sessionReq
        .input('id', sql.VarChar(36), params.sessionId)
        .input('warehouseId', sql.VarChar(36), params.warehouseId)
        .input('orderId', sql.VarChar(36), orderId)
        .input('stationId', sql.VarChar(36), params.stationId)
        .input('cameraId', sql.VarChar(36), params.cameraId)
        .input('userId', sql.VarChar(36), params.userId)
        .input('status', sql.VarChar(30), 'WAITING')
        .input('idempotencyKey', sql.VarChar(100), params.idempotencyKey)
        .input('workerEpoch', sql.VarChar(36), params.workerEpoch || null)
        .query(`
          INSERT INTO packing_sessions (id, warehouse_id, order_id, station_id, camera_id, user_id, status, idempotency_key, worker_epoch)
          VALUES (@id, @warehouseId, @orderId, @stationId, @cameraId, @userId, @status, @idempotencyKey, @workerEpoch)
        `);

      // 3. Insert Outbox command
      const commandReq = new sql.Request(tx);
      const commandId = require('node:crypto').randomUUID();
      const payload = {
        sessionId: params.sessionId,
        trackingCode: params.trackingCode,
        stationId: params.stationId
      };
      const payloadHash = require('node:crypto').createHash('sha256').update(JSON.stringify(payload)).digest('hex');

      await commandReq
        .input('id', sql.VarChar(36), commandId)
        .input('sessionId', sql.VarChar(36), params.sessionId)
        .input('stationId', sql.VarChar(36), params.stationId)
        .input('commandType', sql.VarChar(50), 'START_RECORD')
        .input('idempotencyKey', sql.VarChar(100), params.idempotencyKey)
        .input('payload', sql.NVarChar(sql.MAX), JSON.stringify(payload))
        .input('payloadHash', sql.VarChar(64), payloadHash)
        .query(`
          INSERT INTO packing_commands (id, session_id, station_id, command_type, idempotency_key, payload, payload_hash, status)
          VALUES (@id, @sessionId, @stationId, @commandType, @idempotencyKey, @payload, @payloadHash, 'PENDING')
        `);

      await tx.commit();
      return { sessionId: params.sessionId };
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  }

  static async updateSessionStatus(sessionId: string, status: string, cancellationReason?: string): Promise<void> {
    const pool = await getDbPool();
    const req = pool.request()
      .input('sessionId', sql.VarChar(36), sessionId)
      .input('status', sql.VarChar(30), status);

    let sqlQuery = 'UPDATE packing_sessions SET status = @status, updated_at = GETDATE()';
    if (status === 'RECORDING') {
      sqlQuery += ', start_time = GETDATE()';
    } else if (status === 'COMPLETED' || status === 'CANCELLED' || status === 'FAILED') {
      sqlQuery += ', end_time = GETDATE()';
    }

    if (cancellationReason) {
      req.input('cancellationReason', sql.NVarChar(sql.MAX), cancellationReason);
      sqlQuery += ', cancellation_reason = @cancellationReason';
    }

    sqlQuery += ' WHERE id = @sessionId';
    await req.query(sqlQuery);
  }

  static async recordFinalizedVideo(params: {
    sessionId: string;
    filename: string;
    localPath: string;
    duration: number;
    fileSize: number;
    sha256: string;
    thumbnailPath?: string;
  }): Promise<string> {
    const pool = await getDbPool();
    const videoId = require('node:crypto').randomUUID();

    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
      // Serialize retries for a session; the worker may lose the acknowledgement.
      await new sql.Request(tx).input('sessionId', sql.VarChar(36), params.sessionId)
        .query('SELECT id FROM packing_sessions WITH (UPDLOCK, HOLDLOCK) WHERE id = @sessionId');
      const existing = await new sql.Request(tx).input('sessionId', sql.VarChar(36), params.sessionId)
        .query('SELECT id, sha256, file_size FROM videos WHERE packing_session_id = @sessionId');
      if (existing.recordset[0]) {
        const video = existing.recordset[0];
        if (video.sha256 !== params.sha256 || Number(video.file_size) !== params.fileSize) throw new Error('Session already has different video data');
        await new sql.Request(tx).input('id', sql.VarChar(36), video.id).input('path', sql.NVarChar(sql.MAX), params.localPath)
          .query("UPDATE videos SET local_path = @path, sync_status = CASE WHEN storage_owner = 'WORKER' THEN sync_status ELSE 'PENDING' END, storage_owner = 'WORKER' WHERE id = @id");
        await tx.commit();
        return video.id;
      }
      // 1. Insert Video
      const videoReq = new sql.Request(tx);
      await videoReq
        .input('id', sql.VarChar(36), videoId)
        .input('sessionId', sql.VarChar(36), params.sessionId)
        .input('filename', sql.NVarChar(255), params.filename)
        .input('localPath', sql.NVarChar(sql.MAX), params.localPath)
        .input('duration', sql.Decimal(8, 2), params.duration)
        .input('fileSize', sql.BigInt, params.fileSize)
        .input('sha256', sql.VarChar(64), params.sha256)
        .input('thumbnailPath', sql.NVarChar(sql.MAX), params.thumbnailPath || null)
        .query(`
          INSERT INTO videos (id, packing_session_id, filename, local_path, duration, file_size, sha256, thumbnail_path, storage_owner, sync_status, purge_status)
          VALUES (@id, @sessionId, @filename, @localPath, @duration, @fileSize, @sha256, @thumbnailPath, 'WORKER', 'PENDING', 'ACTIVE')
        `);

      // 2. Mark Session COMPLETED
      const sessionReq = new sql.Request(tx);
      await sessionReq
        .input('sessionId', sql.VarChar(36), params.sessionId)
        .query(`
          UPDATE packing_sessions
          SET status = 'COMPLETED', end_time = GETDATE(), updated_at = GETDATE()
          WHERE id = @sessionId
        `);

      await tx.commit();
      return videoId;
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  }

  static async createMobilePackingSessionTx(params: {
    sessionId: string;
    warehouseId: string;
    stationId?: string;
    userId: string;
    trackingCode: string;
    orderCode: string;
    platform: string;
    duration: number;
    filename: string;
    localPath: string;
    fileSize: number;
    sha256: string;
    thumbnailPath?: string;
  }): Promise<{ sessionId: string; videoId: string }> {
    const pool = await getDbPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
      const previous = await new sql.Request(tx).input('id', sql.VarChar(36), params.sessionId)
        .query('SELECT id, station_id, user_id FROM packing_sessions WITH (UPDLOCK, HOLDLOCK) WHERE id = @id');
      if (previous.recordset[0]) {
        const session = previous.recordset[0];
        const videos = await new sql.Request(tx).input('id', sql.VarChar(36), params.sessionId)
          .query('SELECT id, sha256, file_size FROM videos WHERE packing_session_id = @id');
        const video = videos.recordset[0];
        if (!video || session.station_id !== params.stationId || session.user_id !== params.userId ||
            video.sha256 !== params.sha256 || Number(video.file_size) !== params.fileSize) throw new Error('Upload ID already used for different video data');
        await tx.commit();
        return { sessionId: params.sessionId, videoId: video.id };
      }
      // 1. Resolve Station and Camera
      let targetStationId = params.stationId;
      if (!targetStationId) {
        const stRes = await new sql.Request(tx)
          .input('wh', sql.VarChar(36), params.warehouseId)
          .query(`SELECT TOP 1 id FROM stations WHERE (code = 'MOBILE01' OR warehouse_id = @wh) ORDER BY CASE WHEN code = 'MOBILE01' THEN 0 ELSE 1 END`);
        targetStationId = stRes.recordset[0]?.id;
      }
      if (!targetStationId) {
        targetStationId = 'A1B2C3D4-E5F6-4A5B-8C9D-0E1F2A3B4C5D';
      }

      const camRes = await new sql.Request(tx)
        .input('stId', sql.VarChar(36), targetStationId)
        .query('SELECT TOP 1 id FROM cameras WHERE station_id = @stId');
      const targetCameraId = camRes.recordset[0]?.id || 'B2C3D4E5-F6A1-4B5C-9D0E-1F2A3B4C5D6E';

      // 2. Ensure or find order
      const orderReq = new sql.Request(tx);
      const orderRes = await orderReq
        .input('wh', sql.VarChar(36), params.warehouseId)
        .input('trk', sql.VarChar(100), params.trackingCode)
        .query('SELECT id FROM orders WHERE warehouse_id = @wh AND tracking_code = @trk');

      let orderId: string;
      if (orderRes.recordset.length > 0) {
        orderId = orderRes.recordset[0].id;
      } else {
        orderId = require('node:crypto').randomUUID();
        await new sql.Request(tx)
          .input('id', sql.VarChar(36), orderId)
          .input('wh', sql.VarChar(36), params.warehouseId)
          .input('ord', sql.VarChar(100), params.orderCode)
          .input('trk', sql.VarChar(100), params.trackingCode)
          .input('plt', sql.VarChar(50), params.platform)
          .query(`INSERT INTO orders (id, warehouse_id, order_code, tracking_code, platform, created_at)
                  VALUES (@id, @wh, @ord, @trk, @plt, GETDATE())`);
      }

      // 3. Create Session with COMPLETED status
      const now = new Date();
      const startTime = new Date(now.getTime() - Math.round(params.duration * 1000));
      await new sql.Request(tx)
        .input('id', sql.VarChar(36), params.sessionId)
        .input('wh', sql.VarChar(36), params.warehouseId)
        .input('ordId', sql.VarChar(36), orderId)
        .input('stId', sql.VarChar(36), targetStationId)
        .input('camId', sql.VarChar(36), targetCameraId)
        .input('usrId', sql.VarChar(36), params.userId)
        .input('idemKey', sql.VarChar(100), `mob_${params.sessionId}`)
        .input('startTime', sql.DateTime, startTime)
        .input('endTime', sql.DateTime, now)
        .query(`
          INSERT INTO packing_sessions (id, warehouse_id, order_id, station_id, camera_id, user_id, status, version, idempotency_key, start_time, end_time, has_partial_video, created_at, updated_at)
          VALUES (@id, @wh, @ordId, @stId, @camId, @usrId, 'COMPLETED', 1, @idemKey, @startTime, @endTime, 0, @startTime, @endTime)
        `);

      // 4. Create Video record
      const videoId = require('node:crypto').randomUUID();
      await new sql.Request(tx)
        .input('id', sql.VarChar(36), videoId)
        .input('sessionId', sql.VarChar(36), params.sessionId)
        .input('filename', sql.NVarChar(255), params.filename)
        .input('localPath', sql.NVarChar(sql.MAX), params.localPath)
        .input('duration', sql.Decimal(8, 2), params.duration)
        .input('fileSize', sql.BigInt, params.fileSize)
        .input('sha256', sql.VarChar(64), params.sha256)
        .input('thumbnailPath', sql.NVarChar(sql.MAX), params.thumbnailPath || null)
        .query(`
          INSERT INTO videos (id, packing_session_id, filename, local_path, duration, file_size, sha256, thumbnail_path, storage_owner, sync_status, purge_status, created_at, updated_at)
          VALUES (@id, @sessionId, @filename, @localPath, @duration, @fileSize, @sha256, @thumbnailPath, 'WORKER', 'PENDING', 'ACTIVE', GETDATE(), GETDATE())
        `);

      // 5. Update Business timestamp
      await new sql.Request(tx)
        .input('wh', sql.VarChar(36), params.warehouseId)
        .query(`
          UPDATE businesses
          SET updated_at = GETDATE()
          WHERE id = (SELECT business_id FROM warehouses WHERE id = @wh)
        `);

      await tx.commit();
      return { sessionId: params.sessionId, videoId };
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  }

  static async upsertOrdersBatch(warehouseId: string, orders: Array<{
    orderCode: string;
    trackingCode: string;
    platform?: string;
    customerName?: string;
    phone?: string;
    address?: string;
    note?: string;
    totalAmount?: number;
    codAmount?: number;
    carrier?: string;
    service?: string;
    deliveryCode?: string;
    discount?: number;
    tax?: number;
    packedDate?: string;
    exportedDate?: string;
    items: Array<{
      sku: string;
      name: string;
      quantity: number;
      price?: number;
      discount?: number;
      total?: number;
      variant?: string;
    }>;
  }>): Promise<{ inserted: number; updated: number; total: number }> {
    const pool = await getDbPool();
    let inserted = 0;
    let updated = 0;

    for (const o of orders) {
      if (!o.trackingCode && !o.orderCode) continue;
      const cleanTracking = (o.trackingCode || o.orderCode).trim().toUpperCase();
      const cleanOrder = (o.orderCode || o.trackingCode).trim();
      const cleanPlatform = o.platform || 'SAPO';

      const customerInfo = JSON.stringify({
        customerName: o.customerName || '',
        phone: o.phone || '',
        address: o.address || '',
        note: o.note || '',
        totalAmount: Number(o.totalAmount) || 0,
        codAmount: Number(o.codAmount) || 0,
        carrier: o.carrier || '',
        service: o.service || '',
        deliveryCode: o.deliveryCode || '',
        discount: Number(o.discount) || 0,
        tax: Number(o.tax) || 0,
        packedDate: o.packedDate || '',
        exportedDate: o.exportedDate || '',
        items: (o.items || []).map(it => ({
          sku: String(it.sku || '').trim().toUpperCase(),
          name: String(it.name || '').trim(),
          quantity: Number(it.quantity) || 1,
          price: Number(it.price) || 0,
          discount: Number(it.discount) || 0,
          total: Number(it.total) || 0,
          variant: it.variant || ''
        }))
      });

      const existing = await pool.request()
        .input('wh', sql.VarChar(36), warehouseId)
        .input('trk', sql.VarChar(100), cleanTracking)
        .query('SELECT id FROM orders WHERE warehouse_id = @wh AND tracking_code = @trk');

      if (existing.recordset.length > 0) {
        await pool.request()
          .input('id', sql.VarChar(36), existing.recordset[0].id)
          .input('orderCode', sql.VarChar(100), cleanOrder)
          .input('platform', sql.VarChar(50), cleanPlatform)
          .input('info', sql.NVarChar(sql.MAX), customerInfo)
          .query(`
            UPDATE orders
            SET order_code = @orderCode, platform = @platform, customer_info = @info
            WHERE id = @id
          `);
        updated++;
      } else {
        const newId = require('node:crypto').randomUUID();
        await pool.request()
          .input('id', sql.VarChar(36), newId)
          .input('wh', sql.VarChar(36), warehouseId)
          .input('orderCode', sql.VarChar(100), cleanOrder)
          .input('trackingCode', sql.VarChar(100), cleanTracking)
          .input('platform', sql.VarChar(50), cleanPlatform)
          .input('info', sql.NVarChar(sql.MAX), customerInfo)
          .query(`
            INSERT INTO orders (id, warehouse_id, order_code, tracking_code, platform, customer_info)
            VALUES (@id, @wh, @orderCode, @trackingCode, @platform, @info)
          `);
        inserted++;
      }
    }

    return { inserted, updated, total: inserted + updated };
  }

  static async updateVideoSyncStatus(videoIdOrFilename: string, syncStatus: string, nasPath?: string, syncError?: string): Promise<void> {
    const pool = await getDbPool();
    const req = pool.request()
      .input('videoIdOrFilename', sql.VarChar(255), videoIdOrFilename)
      .input('syncStatus', sql.VarChar(30), syncStatus);

    let query = 'UPDATE videos SET sync_status = @syncStatus, updated_at = GETDATE()';
    if (nasPath) {
      req.input('nasPath', sql.NVarChar(4000), nasPath);
      query += ', nas_path = @nasPath';
    }
    if (syncError) {
      req.input('syncError', sql.NVarChar(4000), syncError);
      query += ', sync_error = @syncError';
    }
    query += ' WHERE id = @videoIdOrFilename OR filename = @videoIdOrFilename';
    await req.query(query);
  }

  /**
   * Search Videos for Admin & CSKH
   */
  static async searchVideos(filters: VideoSearchParams): Promise<{ items: any[]; total: number }> {
    const pool = await getDbPool();
    const req = pool.request();
    let where = 'WHERE 1=1';

    if (filters.businessId) {
      req.input('businessId', sql.VarChar(36), filters.businessId);
      where += ' AND s.warehouse_id IN (SELECT id FROM warehouses WHERE business_id = @businessId)';
    }
    if (filters.trackingCode) {
      req.input('trackingCode', sql.VarChar(100), `%${filters.trackingCode}%`);
      where += ' AND o.tracking_code LIKE @trackingCode';
    }
    if (filters.orderCode) {
      req.input('orderCode', sql.VarChar(100), `%${filters.orderCode}%`);
      where += ' AND o.order_code LIKE @orderCode';
    }
    if (filters.warehouseId) {
      req.input('warehouseId', sql.VarChar(36), filters.warehouseId);
      where += ' AND s.warehouse_id = @warehouseId';
    }
    if (filters.stationId) {
      req.input('stationId', sql.VarChar(36), filters.stationId);
      where += ' AND s.station_id = @stationId';
    }
    if (filters.disputeStatus) {
      req.input('disputeStatus', sql.VarChar(30), filters.disputeStatus);
      where += ' AND v.dispute_status = @disputeStatus';
    }

    const countQuery = `
      SELECT COUNT(*) as total
      FROM videos v
      INNER JOIN packing_sessions s ON v.packing_session_id = s.id
      INNER JOIN orders o ON s.order_id = o.id
      ${where}
    `;
    const countRes = await req.query(countQuery);
    const total = countRes.recordset[0]?.total || 0;

    const limit = filters.limit || 20;
    const page = filters.page || 1;
    const offset = (page - 1) * limit;

    const dataQuery = `
      SELECT v.id, v.filename, v.local_path, v.nas_path, v.duration, v.file_size, v.sha256,
             v.thumbnail_path, v.storage_owner, v.drive_file_id, v.sync_status, v.sync_error, v.is_locked, v.dispute_status, v.created_at,
             o.tracking_code, o.order_code, o.platform,
             st.name as station_name, st.code as station_code,
             u.full_name as operator_name
      FROM videos v
      INNER JOIN packing_sessions s ON v.packing_session_id = s.id
      INNER JOIN orders o ON s.order_id = o.id
      INNER JOIN stations st ON s.station_id = st.id
      INNER JOIN users u ON s.user_id = u.id
      ${where}
      ORDER BY v.created_at DESC
    `;
    const dataRes = await req.query(dataQuery);
    const items = dataRes.recordset.slice(offset, offset + limit);

    return { items, total };
  }

  static async setDisputeLock(videoId: string, isLocked: boolean, disputeStatus: DisputeStatus, userId: string, reason?: string): Promise<boolean> {
    const pool = await getDbPool();
    const result = await pool.request()
      .input('videoId', sql.VarChar(36), videoId)
      .input('isLocked', sql.Bit, isLocked ? 1 : 0)
      .input('disputeStatus', sql.VarChar(30), disputeStatus)
      .input('userId', sql.VarChar(36), userId)
      .input('reason', sql.NVarChar(sql.MAX), reason || null)
      .query(`
        UPDATE videos
        SET is_locked = @isLocked,
            dispute_status = @disputeStatus,
            locked_by = @userId,
            locked_at = GETDATE(),
            lock_reason = @reason,
            updated_at = GETDATE()
        WHERE id = @videoId AND purge_status = 'ACTIVE'
      `);
    return result.rowsAffected[0] > 0;
  }

  static async forceUnlockStation(stationId: string, supervisorId: string, reason: string): Promise<void> {
    const pool = await getDbPool();
    await pool.request()
      .input('stationId', sql.VarChar(36), stationId)
      .input('reason', sql.NVarChar(sql.MAX), `Force-unlocked by supervisor ${supervisorId}: ${reason}`)
      .query(`
        UPDATE packing_sessions
        SET status = 'FAILED',
            cancellation_reason = @reason,
            end_time = GETDATE(),
            updated_at = GETDATE()
        WHERE station_id = @stationId
          AND status IN ('WAITING', 'RECORDING', 'PROCESSING', 'CANCELLING', 'INDETERMINATE_TIMEOUT');

        UPDATE stations
        SET status = 'ONLINE', updated_at = GETDATE()
        WHERE id = @stationId;
      `);
  }

  static async getAllStations(): Promise<any[]> {
    const pool = await getDbPool();
    const res = await pool.request().query(`
      SELECT s.id, s.warehouse_id, s.name, s.code, s.computer_name, s.ip_address, s.status, s.last_heartbeat_at, s.created_at, s.updated_at,
             w.name as warehouse_name, w.code as warehouse_code, w.business_id,
             b.name as business_name, b.code as business_code,
             c.id as camera_id, c.name as camera_name, c.type as camera_type, c.rtsp_url as camera_rtsp_url, c.status as camera_status
      FROM stations s
      LEFT JOIN warehouses w ON s.warehouse_id = w.id
      LEFT JOIN businesses b ON w.business_id = b.id
      LEFT JOIN cameras c ON s.id = c.station_id
      ORDER BY s.code ASC
    `);
    return res.recordset.map((r: any) => ({
      id: r.id,
      warehouseId: r.warehouse_id,
      warehouseName: r.warehouse_name,
      warehouseCode: r.warehouse_code,
      businessId: r.business_id,
      businessName: r.business_name,
      businessCode: r.business_code,
      name: r.name,
      code: r.code,
      computerName: r.computer_name,
      ipAddress: r.ip_address,
      status: r.status,
      lastHeartbeatAt: r.last_heartbeat_at ? r.last_heartbeat_at.toISOString() : null,
      createdAt: r.created_at ? r.created_at.toISOString() : null,
      updatedAt: r.updated_at ? r.updated_at.toISOString() : null,
      camera: r.camera_id ? {
        id: r.camera_id,
        name: r.camera_name,
        type: r.camera_type,
        rtspUrl: r.camera_rtsp_url,
        status: r.camera_status
      } : null
    }));
  }

  static async getWarehouses(businessId?: string): Promise<any[]> {
    const pool = await getDbPool();
    let query = `
      SELECT w.id, w.business_id, w.name, w.code, w.address, w.timezone, w.is_active,
             b.name as business_name, b.code as business_code
      FROM warehouses w
      LEFT JOIN businesses b ON w.business_id = b.id
      WHERE 1=1
    `;
    const req = pool.request();
    if (businessId) {
      req.input('bizId', sql.VarChar(36), businessId);
      query += ` AND w.business_id = @bizId`;
    }
    query += ` ORDER BY w.name ASC`;
    const res = await req.query(query);
    return res.recordset.map((r: any) => ({
      id: r.id,
      businessId: r.business_id,
      name: r.name,
      code: r.code,
      address: r.address,
      businessName: r.business_name,
      businessCode: r.business_code
    }));
  }

  static async getRecentSessions(stationId: string, limit = 10): Promise<any[]> {
    const pool = await getDbPool();
    const res = await pool.request()
      .input('stationId', sql.VarChar(36), stationId)
      .query(`
        SELECT TOP ${limit}
          s.id, s.status, s.start_time, s.end_time, s.created_at,
          o.tracking_code, o.order_code, o.platform,
          v.id as video_id, v.duration, v.file_size, v.sha256, v.sync_status
        FROM packing_sessions s
        INNER JOIN orders o ON s.order_id = o.id
        LEFT JOIN videos v ON s.id = v.packing_session_id
        WHERE s.station_id = @stationId
        ORDER BY s.created_at DESC
      `);
    return res.recordset.map((r: any) => ({
      id: r.id,
      status: r.status,
      trackingCode: r.tracking_code,
      orderCode: r.order_code,
      platform: r.platform,
      startTime: r.start_time ? r.start_time.toISOString() : null,
      endTime: r.end_time ? r.end_time.toISOString() : null,
      createdAt: r.created_at ? r.created_at.toISOString() : null,
      video: r.video_id ? {
        id: r.video_id,
        duration: Number(r.duration),
        fileSize: Number(r.file_size),
        sha256: r.sha256,
        syncStatus: r.sync_status
      } : null
    }));
  }

  static async getDashboardStats(): Promise<any> {
    const pool = await getDbPool();
    const packedTodayRes = await pool.request().query(`
      SELECT COUNT(*) as packed_today
      FROM packing_sessions
      WHERE status = 'COMPLETED'
        AND created_at >= CONVERT(VARCHAR(10), GETDATE(), 120)
    `);

    const activeRes = await pool.request().query(`
      SELECT COUNT(*) as active_now
      FROM packing_sessions
      WHERE status IN ('WAITING', 'RECORDING', 'PROCESSING')
    `);

    const disputeRes = await pool.request().query(`
      SELECT COUNT(*) as disputes
      FROM videos
      WHERE is_locked = 1 OR dispute_status != 'NONE'
    `);

    const stationsRes = await pool.request().query(`
      SELECT COUNT(*) as total_stations,
             SUM(CASE WHEN status = 'ONLINE' THEN 1 ELSE 0 END) as online_stations
      FROM stations
    `);

    return {
      packedToday: packedTodayRes.recordset[0]?.packed_today || 0,
      activeRecordingNow: activeRes.recordset[0]?.active_now || 0,
      disputesCount: disputeRes.recordset[0]?.disputes || 0,
      totalStations: stationsRes.recordset[0]?.total_stations || 0,
      onlineStations: stationsRes.recordset[0]?.online_stations || 0
    };
  }

  static async getLogisticsDashboardStats(params?: { warehouseId?: string; timeRange?: 'today' | '7days' | '30days' }): Promise<any> {
    const pool = await getDbPool();
    const timeRange = params?.timeRange || 'today';
    let dateCondition = `ps.created_at >= CONVERT(VARCHAR(10), GETDATE(), 120)`;

    if (timeRange === '7days') {
      dateCondition = `ps.created_at >= DATEADD(day, -7, GETDATE())`;
    } else if (timeRange === '30days') {
      dateCondition = `ps.created_at >= DATEADD(day, -30, GETDATE())`;
    }

    // 1. Order Status Counts
    const overviewRes = await pool.request().query(`
      SELECT
        COUNT(*) as total_orders,
        SUM(CASE WHEN ps.status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_orders,
        SUM(CASE WHEN ps.status = 'RECORDING' THEN 1 ELSE 0 END) as recording_orders,
        SUM(CASE WHEN ps.status IS NULL OR ps.status IN ('WAITING', 'CANCELLED') THEN 1 ELSE 0 END) as pending_orders,
        SUM(CASE WHEN v.is_locked = 1 OR (v.dispute_status IS NOT NULL AND v.dispute_status NOT IN ('NONE', 'NORMAL')) THEN 1 ELSE 0 END) as disputed_orders
      FROM orders o
      OUTER APPLY (
        SELECT TOP 1 id, status, created_at
        FROM packing_sessions
        WHERE order_id = o.id
        ORDER BY created_at DESC
      ) ps
      LEFT JOIN videos v ON ps.id = v.packing_session_id
    `);

    // 2. Duration & Speed Metrics (giay / don)
    const durationRes = await pool.request().query(`
      SELECT
        ISNULL(AVG(v.duration), 0) as avg_duration,
        ISNULL(MIN(v.duration), 0) as min_duration,
        ISNULL(MAX(v.duration), 0) as max_duration,
        COUNT(v.id) as packed_count
      FROM videos v
      JOIN packing_sessions ps ON v.packing_session_id = ps.id
      WHERE ps.status = 'COMPLETED' AND ${dateCondition}
    `);

    // 3. Hourly Throughput (Hom nay)
    const hourlyRes = await pool.request().query(`
      SELECT
        DATEPART(hour, ps.end_time) as packing_hour,
        COUNT(*) as order_count,
        ISNULL(AVG(v.duration), 0) as avg_duration
      FROM packing_sessions ps
      LEFT JOIN videos v ON ps.id = v.packing_session_id
      WHERE ps.status = 'COMPLETED'
        AND ps.end_time IS NOT NULL
        AND ps.created_at >= CONVERT(VARCHAR(10), GETDATE(), 120)
      GROUP BY DATEPART(hour, ps.end_time)
      ORDER BY packing_hour ASC
    `);

    // 4. Operator Leaderboard
    const operatorRes = await pool.request().query(`
      SELECT
        u.id as user_id,
        ISNULL(u.full_name, u.username) as operator_name,
        COUNT(ps.id) as packed_count,
        ISNULL(AVG(v.duration), 0) as avg_duration,
        SUM(CASE WHEN v.is_locked = 1 OR (v.dispute_status IS NOT NULL AND v.dispute_status NOT IN ('NONE', 'NORMAL')) THEN 1 ELSE 0 END) as dispute_count
      FROM packing_sessions ps
      JOIN users u ON ps.user_id = u.id
      LEFT JOIN videos v ON ps.id = v.packing_session_id
      WHERE ps.status = 'COMPLETED' AND ${dateCondition}
      GROUP BY u.id, u.full_name, u.username
      ORDER BY packed_count DESC
    `);

    // 5. Platform Breakdown
    const platformRes = await pool.request().query(`
      SELECT
        o.platform,
        COUNT(o.id) as total_count,
        SUM(CASE WHEN ps.status = 'COMPLETED' THEN 1 ELSE 0 END) as packed_count
      FROM orders o
      OUTER APPLY (
        SELECT TOP 1 status FROM packing_sessions WHERE order_id = o.id ORDER BY created_at DESC
      ) ps
      GROUP BY o.platform
      ORDER BY total_count DESC
    `);

    // 6. Station Performance
    const stationRes = await pool.request().query(`
      SELECT
        s.id,
        s.code,
        s.name,
        s.status,
        COUNT(ps.id) as session_count,
        ISNULL(AVG(v.duration), 0) as avg_duration
      FROM stations s
      LEFT JOIN packing_sessions ps ON s.id = ps.station_id AND ps.status = 'COMPLETED' AND ${dateCondition}
      LEFT JOIN videos v ON ps.id = v.packing_session_id
      GROUP BY s.id, s.code, s.name, s.status
      ORDER BY s.code ASC
    `);

    const hourlyMap: Record<number, { orderCount: number; avgDuration: number }> = {};
    for (const r of hourlyRes.recordset) {
      hourlyMap[r.packing_hour] = {
        orderCount: r.order_count || 0,
        avgDuration: Math.round(Number(r.avg_duration) || 0)
      };
    }

    const workingHours = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
    const hourlyThroughput = workingHours.map(h => ({
      hour: h,
      hourLabel: `${String(h).padStart(2, '0')}:00`,
      orderCount: hourlyMap[h]?.orderCount || 0,
      avgDuration: hourlyMap[h]?.avgDuration || 0
    }));

    const totalOrders = overviewRes.recordset[0]?.total_orders || 0;
    const completedOrders = overviewRes.recordset[0]?.completed_orders || 0;
    const recordingOrders = overviewRes.recordset[0]?.recording_orders || 0;
    const pendingOrders = overviewRes.recordset[0]?.pending_orders || 0;
    const disputedOrders = overviewRes.recordset[0]?.disputed_orders || 0;

    const avgDuration = Math.round(Number(durationRes.recordset[0]?.avg_duration) || 0);
    const minDuration = Math.round(Number(durationRes.recordset[0]?.min_duration) || 0);
    const maxDuration = Math.round(Number(durationRes.recordset[0]?.max_duration) || 0);

    const fulfillmentRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;
    const totalPackingSeconds = (durationRes.recordset[0]?.packed_count || 0) * avgDuration;

    const operatorLeaderboard = operatorRes.recordset.map((r: any, idx: number) => {
      const packed = r.packed_count || 0;
      const disputes = r.dispute_count || 0;
      const accuracyRate = packed > 0 ? Math.max(0, Math.round(((packed - disputes) / packed) * 1000) / 10) : 100;
      return {
        rank: idx + 1,
        userId: r.user_id,
        operatorName: r.operator_name,
        packedCount: packed,
        avgDuration: Math.round(Number(r.avg_duration) || 0),
        disputeCount: disputes,
        accuracyRate
      };
    });

    const platformBreakdown = platformRes.recordset.map((r: any) => ({
      platform: r.platform || 'OTHER',
      totalCount: r.total_count || 0,
      packedCount: r.packed_count || 0,
      percentage: totalOrders > 0 ? Math.round((r.total_count / totalOrders) * 100) : 0
    }));

    const stationProductivity = stationRes.recordset.map((r: any) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      status: r.status,
      sessionCount: r.session_count || 0,
      avgDuration: Math.round(Number(r.avg_duration) || 0)
    }));

    return {
      summary: {
        totalOrders,
        completedOrders,
        recordingOrders,
        pendingOrders,
        disputedOrders,
        fulfillmentRate,
        avgDurationSeconds: avgDuration,
        minDurationSeconds: minDuration,
        maxDurationSeconds: maxDuration,
        totalPackingMinutes: Math.round(totalPackingSeconds / 60)
      },
      hourlyThroughput,
      operatorLeaderboard,
      platformBreakdown,
      stationProductivity,
      timeRange
    };
  }

  static async getSystemSettings(): Promise<{ storageConfigs: any[]; settings: Record<string, string> }> {
    const pool = await getDbPool();
    const storageRes = await pool.request().query(`
      SELECT id, warehouse_id, storage_type, path, retention_days, local_retention_days, enabled, is_default
      FROM storage_configs
      ORDER BY storage_type ASC
    `);

    const settingsRes = await pool.request().query(`
      SELECT [key], [value], [description]
      FROM system_settings
    `);

    const settingsMap: Record<string, string> = {};
    for (const row of settingsRes.recordset) {
      settingsMap[row.key] = row.value;
    }

    return {
      storageConfigs: storageRes.recordset,
      settings: settingsMap
    };
  }

  static async updateSystemSettings(data: {
    storageConfigs?: Array<{ id: string; path: string; retention_days: number; local_retention_days: number; enabled: boolean }>;
    settings?: Record<string, string>;
  }): Promise<void> {
    const pool = await getDbPool();
    if (data.storageConfigs) {
      for (const sc of data.storageConfigs) {
        await pool.request()
          .input('id', sql.VarChar(36), sc.id)
          .input('path', sql.NVarChar(4000), sc.path)
          .input('retention_days', sql.Int, sc.retention_days)
          .input('local_retention_days', sql.Int, sc.local_retention_days)
          .input('enabled', sql.Bit, sc.enabled ? 1 : 0)
          .query(`
            UPDATE storage_configs
            SET path = @path,
                retention_days = @retention_days,
                local_retention_days = @local_retention_days,
                enabled = @enabled,
                updated_at = GETDATE()
            WHERE id = @id
          `);
      }
    }

    if (data.settings) {
      for (const [key, value] of Object.entries(data.settings)) {
        await pool.request()
          .input('key', sql.VarChar(100), key)
          .input('value', sql.NVarChar(4000), String(value))
          .query(`
            IF EXISTS (SELECT 1 FROM system_settings WHERE [key] = @key)
              UPDATE system_settings SET [value] = @value, updated_at = GETDATE() WHERE [key] = @key
            ELSE
              INSERT INTO system_settings ([key], [value]) VALUES (@key, @value)
          `);
      }
    }
  }

  static async upsertStationWithCamera(data: {
    stationId?: string;
    warehouseId?: string;
    name: string;
    code: string;
    computerName?: string;
    ipAddress?: string;
    cameraName?: string;
    cameraType?: string;
    rtspUrl?: string;
  }): Promise<string> {
    const pool = await getDbPool();
    let targetStationId = data.stationId;

    if (targetStationId) {
      await pool.request()
        .input('id', sql.VarChar(36), targetStationId)
        .input('warehouseId', sql.VarChar(36), data.warehouseId || null)
        .input('name', sql.NVarChar(100), data.name)
        .input('code', sql.VarChar(50), data.code)
        .input('computerName', sql.VarChar(100), data.computerName || null)
        .input('ipAddress', sql.VarChar(50), data.ipAddress || null)
        .query(`
          UPDATE stations
          SET name = @name,
              code = @code,
              computer_name = @computerName,
              ip_address = @ipAddress,
              warehouse_id = COALESCE(@warehouseId, warehouse_id),
              updated_at = GETDATE()
          WHERE id = @id
        `);
    } else {
      const crypto = await import('node:crypto');
      targetStationId = crypto.randomUUID();
      const whId = data.warehouseId || (await pool.request().query('SELECT TOP 1 id FROM warehouses')).recordset[0]?.id;
      await pool.request()
        .input('id', sql.VarChar(36), targetStationId)
        .input('warehouseId', sql.VarChar(36), whId)
        .input('name', sql.NVarChar(100), data.name)
        .input('code', sql.VarChar(50), data.code)
        .input('computerName', sql.VarChar(100), data.computerName || null)
        .input('ipAddress', sql.VarChar(50), data.ipAddress || null)
        .query(`
          INSERT INTO stations (id, warehouse_id, name, code, computer_name, ip_address, status)
          VALUES (@id, @warehouseId, @name, @code, @computerName, @ipAddress, 'ONLINE')
        `);

      // Create default worker
      const workerId = crypto.randomUUID();
      const defaultTokenHash = 'ede5a7dda3c757ae4289038733435dd54213c0078dc4ce11ba599675a78b77f9';
      await pool.request()
        .input('id', sql.VarChar(36), workerId)
        .input('stationId', sql.VarChar(36), targetStationId)
        .input('tokenHash', sql.VarChar(255), defaultTokenHash)
        .query(`
          INSERT INTO workers (id, station_id, token_hash, status)
          VALUES (@id, @stationId, @tokenHash, 'ONLINE')
        `);
    }

    // Upsert camera
    if (data.cameraName || data.rtspUrl) {
      const existingCam = await pool.request()
        .input('stationId', sql.VarChar(36), targetStationId)
        .query('SELECT id FROM cameras WHERE station_id = @stationId');

      if (existingCam.recordset.length > 0) {
        await pool.request()
          .input('stationId', sql.VarChar(36), targetStationId)
          .input('name', sql.NVarChar(100), data.cameraName || 'CAM_' + data.code)
          .input('type', sql.VarChar(50), data.cameraType || 'RTSP')
          .input('rtspUrl', sql.NVarChar(4000), data.rtspUrl || null)
          .query(`
            UPDATE cameras
            SET name = @name, type = @type, rtsp_url = @rtspUrl, updated_at = GETDATE()
            WHERE station_id = @stationId
          `);
      } else {
        const crypto = await import('node:crypto');
        const camId = crypto.randomUUID();
        await pool.request()
          .input('id', sql.VarChar(36), camId)
          .input('stationId', sql.VarChar(36), targetStationId)
          .input('name', sql.NVarChar(100), data.cameraName || 'CAM_' + data.code)
          .input('type', sql.VarChar(50), data.cameraType || 'RTSP')
          .input('rtspUrl', sql.NVarChar(4000), data.rtspUrl || null)
          .query(`
            INSERT INTO cameras (id, station_id, name, type, rtsp_url, status)
            VALUES (@id, @stationId, @name, @type, @rtspUrl, 'ONLINE')
          `);
      }
    }

    return targetStationId;
  }

  static async updateCameraDirectly(id: string, data: {
    name?: string;
    type?: string;
    rtspUrl?: string;
    status?: string;
  }): Promise<void> {
    const pool = await getDbPool();
    await pool.request()
      .input('id', sql.VarChar(36), id)
      .input('name', sql.NVarChar(100), data.name || null)
      .input('type', sql.VarChar(50), data.type || 'RTSP')
      .input('rtspUrl', sql.NVarChar(4000), data.rtspUrl || null)
      .input('status', sql.VarChar(30), data.status || 'ONLINE')
      .query(`
        UPDATE cameras
        SET name = COALESCE(@name, name),
            type = COALESCE(@type, type),
            rtsp_url = COALESCE(@rtspUrl, rtsp_url),
            status = COALESCE(@status, status),
            updated_at = GETDATE()
        WHERE id = @id
      `);
  }

  static async findOrderByTrackingCode(warehouseId: string, trackingCode: string): Promise<any | null> {
    const pool = await getDbPool();
    const res = await pool.request()
      .input('warehouseId', sql.VarChar(36), warehouseId)
      .input('trackingCode', sql.VarChar(100), trackingCode)
      .query(`
        SELECT TOP 1 o.*, ps.id as session_id, ps.status as session_status
        FROM orders o
        LEFT JOIN packing_sessions ps ON o.id = ps.order_id
        WHERE o.warehouse_id = @warehouseId AND o.tracking_code = @trackingCode
        ORDER BY o.created_at DESC
      `);
    return res.recordset[0] || null;
  }

  static async getOrders(params?: { warehouseId?: string; search?: string; status?: string; platform?: string }): Promise<any[]> {
    const pool = await getDbPool();
    let query = `
      SELECT o.id, o.warehouse_id, o.order_code, o.tracking_code, o.platform, o.customer_info, o.created_at,
             ps.id as session_id, ps.status as packing_status, ps.start_time, ps.end_time,
             ps.station_id, ps.user_id,
             st.code as station_code, st.name as station_name,
             u.full_name as operator_name,
             v.id as video_id, v.filename as video_filename, v.duration as video_duration, v.sha256 as video_sha256,
             v.is_locked, v.dispute_status
      FROM orders o
      OUTER APPLY (
        SELECT TOP 1 id, status, start_time, end_time, station_id, user_id, created_at
        FROM packing_sessions
        WHERE order_id = o.id
        ORDER BY created_at DESC
      ) ps
      LEFT JOIN stations st ON ps.station_id = st.id
      LEFT JOIN users u ON ps.user_id = u.id
      LEFT JOIN videos v ON ps.id = v.packing_session_id
      WHERE 1=1
    `;
    const req = pool.request();
    if (params?.warehouseId) {
      req.input('warehouseId', sql.VarChar(36), params.warehouseId);
      query += ` AND o.warehouse_id = @warehouseId`;
    }
    if (params?.search) {
      req.input('search', sql.VarChar(100), `%${params.search}%`);
      query += ` AND (o.tracking_code LIKE @search OR o.order_code LIKE @search)`;
    }
    if (params?.platform && params.platform !== 'ALL') {
      req.input('platform', sql.VarChar(50), params.platform);
      query += ` AND o.platform = @platform`;
    }
    if (params?.status && params.status !== 'ALL') {
      if (params.status === 'PENDING') {
        query += ` AND (ps.status IS NULL OR ps.status = 'WAITING' OR ps.status = 'CANCELLED')`;
      } else if (params.status === 'RECORDING') {
        query += ` AND ps.status = 'RECORDING'`;
      } else if (params.status === 'COMPLETED') {
        query += ` AND ps.status = 'COMPLETED'`;
      } else if (params.status === 'DISPUTE') {
        query += ` AND (v.is_locked = 1 OR (v.dispute_status IS NOT NULL AND v.dispute_status NOT IN ('NONE', 'NORMAL')))`;
      }
    }
    query += ` ORDER BY o.created_at DESC`;

    const res = await req.query(query);
    return res.recordset.map((r: any) => {
      let customer = null;
      try {
        if (r.customer_info) customer = JSON.parse(r.customer_info);
      } catch {
        customer = { note: r.customer_info };
      }
      const durationSec = r.video_duration ? Math.round(r.video_duration) : (r.start_time && r.end_time ? Math.round((new Date(r.end_time).getTime() - new Date(r.start_time).getTime()) / 1000) : null);
      return {
        id: r.id,
        orderCode: r.order_code,
        trackingCode: r.tracking_code,
        platform: r.platform,
        customer,
        packingStatus: r.packing_status || 'PENDING',
        sessionId: r.session_id || null,
        stationCode: r.station_code || null,
        stationName: r.station_name || null,
        operatorName: r.operator_name || null,
        duration: durationSec,
        video: r.video_id ? {
          id: r.video_id,
          filename: r.video_filename,
          duration: r.video_duration,
          sha256: r.video_sha256,
          isLocked: !!r.is_locked,
          disputeStatus: r.dispute_status || 'NONE'
        } : null,
        createdAt: r.created_at ? r.created_at.toISOString() : null
      };
    });
  }

  static async markOrderManuallyCompleted(orderId: string, userId: string): Promise<void> {
    const pool = await getDbPool();
    const sessionId = require('node:crypto').randomUUID();
    const orderRes = await pool.request()
      .input('orderId', sql.VarChar(36), orderId)
      .query('SELECT TOP 1 * FROM orders WHERE id = @orderId');
    const order = orderRes.recordset[0];
    if (!order) return;

    const stRes = await pool.request().query('SELECT TOP 1 id FROM stations');
    const stationId = stRes.recordset[0]?.id;
    const camRes = await pool.request().query('SELECT TOP 1 id FROM cameras');
    const cameraId = camRes.recordset[0]?.id;
    const idempotencyKey = require('node:crypto').randomUUID();

    await pool.request()
      .input('id', sql.VarChar(36), sessionId)
      .input('warehouseId', sql.VarChar(36), order.warehouse_id)
      .input('orderId', sql.VarChar(36), order.id)
      .input('stationId', sql.VarChar(36), stationId)
      .input('cameraId', sql.VarChar(36), cameraId)
      .input('userId', sql.VarChar(36), userId)
      .input('status', sql.VarChar(30), 'COMPLETED')
      .input('idempotencyKey', sql.VarChar(100), idempotencyKey)
      .query(`
        INSERT INTO packing_sessions (id, warehouse_id, order_id, station_id, camera_id, user_id, status, idempotency_key, start_time, end_time, created_at, updated_at)
        VALUES (@id, @warehouseId, @orderId, @stationId, @cameraId, @userId, @status, @idempotencyKey, GETDATE(), GETDATE(), GETDATE(), GETDATE())
      `);
  }

  static async seedSampleOrders(): Promise<number> {
    const pool = await getDbPool();
    const whRes = await pool.request().query('SELECT TOP 1 id FROM warehouses');
    const whId = whRes.recordset[0]?.id;
    if (!whId) return 0;

    const stRes = await pool.request().query('SELECT TOP 1 id FROM stations');
    const stationId = stRes.recordset[0]?.id;

    const camRes = await pool.request().query('SELECT TOP 1 id FROM cameras');
    const cameraId = camRes.recordset[0]?.id;

    const uRes = await pool.request().query("SELECT TOP 1 id FROM users WHERE username = 'packer01'");
    const packerUserId = uRes.recordset[0]?.id || (await pool.request().query("SELECT TOP 1 id FROM users")).recordset[0]?.id;

    const sampleOrders = [
      {
        orderCode: 'ORD-SPX-20261004-01',
        trackingCode: 'SPXVN0888999123',
        platform: 'SPX',
        customerInfo: JSON.stringify({
          customerName: 'Nguyễn Thị Lan Anh',
          phone: '0984.321.890',
          address: 'Số 18, Ngõ 92 Nguyễn Khánh Toàn, Cầu Giấy, Hà Nội',
          note: 'Giao giờ hành chính, gọi trước khi giao',
          items: [
            { sku: 'ATN-COTTON-DEN-L', name: 'Áo Thun Nam Cổ Tròn Cotton 100% Form Rộng (Đen - Size L)', quantity: 2, price: 189000 },
            { sku: 'MLT-VINTAGE-BE', name: 'Mũ Lưỡi Trai Classic Vintage (Be)', quantity: 1, price: 85000 }
          ]
        }),
        isCompleted: true,
        duration: 28.5,
        isDisputed: false
      },
      {
        orderCode: 'ORD-TIKTOK-20261004-02',
        trackingCode: 'TIKTOK9876543210',
        platform: 'TIKTOK',
        customerInfo: JSON.stringify({
          customerName: 'Trần Văn Hùng',
          phone: '0912.888.666',
          address: 'Tòa Landmark 81, 208 Nguyễn Hữu Cảnh, P.22, Bình Thạnh, TP.HCM',
          note: 'Hàng điện tử cao cấp xin nhẹ tay',
          items: [
            { sku: 'TWS-ANC-WHITE', name: 'Tai Nghe Bluetooth TWS Chống Ồn Chủ Động ANC (Trắng)', quantity: 1, price: 650000 },
            { sku: 'CAP-TC-LN-20W', name: 'Cáp Sạc Nhanh Type-C to Lightning Dây Dù 20W (1.2m)', quantity: 2, price: 120000 }
          ]
        }),
        isCompleted: true,
        duration: 34.2,
        isDisputed: true
      },
      {
        orderCode: 'ORD-GHTK-20261004-03',
        trackingCode: 'GHTK1234567890',
        platform: 'GHTK',
        customerInfo: JSON.stringify({
          customerName: 'Lê Hoàng Yến',
          phone: '0973.555.234',
          address: 'Số 45 Trần Phú, P. Hải Châu 1, Q. Hải Châu, Đà Nẵng',
          note: 'Đồ dễ vỡ, bọc xốp chống sốc dày',
          items: [
            { sku: 'PERFUME-ROSE-15ML', name: 'Nước Hoa Nữ Mini Eau De Parfum 15ml (Hương Hoa Hồng)', quantity: 1, price: 320000 },
            { sku: 'LIPSTICK-DOCAM', name: 'Son Kem Lì Mịn Môi Velvet Lip Tint (Đỏ Cam Đất)', quantity: 1, price: 195000 }
          ]
        }),
        isCompleted: true,
        duration: 45.0,
        isDisputed: false
      },
      {
        orderCode: 'ORD-LEX-20261004-04',
        trackingCode: 'LEXVN8829103948',
        platform: 'LAZADA',
        customerInfo: JSON.stringify({
          customerName: 'Phạm Quốc Tuấn',
          phone: '0905.777.112',
          address: 'Khu Công Nghệ Cao, P. Long Thạnh Mỹ, TP. Thủ Đức, TP.HCM',
          note: 'Cho kiểm tra hàng',
          items: [
            { sku: 'BGN-INOX316-800', name: 'Bình Giữ Nhiệt Inox 316 Cao Cấp 800ml (Xanh Rêu)', quantity: 1, price: 280000 }
          ]
        }),
        isCompleted: false,
        duration: 0,
        isDisputed: false
      },
      {
        orderCode: 'ORD-GHN-20261004-05',
        trackingCode: 'GHN9928173615',
        platform: 'GHN',
        customerInfo: JSON.stringify({
          customerName: 'Đỗ Thanh Thảo',
          phone: '0938.111.456',
          address: 'Số 102 Chùa Bộc, P. Quang Trung, Q. Đống Đa, Hà Nội',
          note: 'Đóng gói quà tặng',
          items: [
            { sku: 'TOTE-CANVAS-SUA', name: 'Túi Tote Canvas Đi Học Đi Chơi Có Khóa Kéo (Trắng Sữa)', quantity: 1, price: 119000 },
            { sku: 'KEYCHAIN-GAU', name: 'Móc Khóa Gấu Bông Dễ Thương Phong Cách Hàn Quốc', quantity: 2, price: 35000 }
          ]
        }),
        isCompleted: false,
        duration: 0,
        isDisputed: false
      }
    ];

    const crypto = await import('node:crypto');
    for (const o of sampleOrders) {
      const orderId = crypto.randomUUID();
      await pool.request()
        .input('id', sql.VarChar(36), orderId)
        .input('whId', sql.VarChar(36), whId)
        .input('orderCode', sql.VarChar(100), o.orderCode)
        .input('trackingCode', sql.VarChar(100), o.trackingCode)
        .input('platform', sql.VarChar(50), o.platform)
        .input('customerInfo', sql.NVarChar(4000), o.customerInfo)
        .query(`
          IF NOT EXISTS (SELECT 1 FROM orders WHERE warehouse_id = @whId AND tracking_code = @trackingCode)
            INSERT INTO orders (id, warehouse_id, order_code, tracking_code, platform, customer_info)
            VALUES (@id, @whId, @orderCode, @trackingCode, @platform, @customerInfo)
          ELSE
            UPDATE orders
            SET customer_info = @customerInfo, order_code = @orderCode, platform = @platform
            WHERE warehouse_id = @whId AND tracking_code = @trackingCode
        `);

      // Seed completed session and video if marked
      if (o.isCompleted && stationId && cameraId && packerUserId) {
        const orderRecord = (await pool.request()
          .input('whId', sql.VarChar(36), whId)
          .input('tc', sql.VarChar(100), o.trackingCode)
          .query('SELECT id FROM orders WHERE warehouse_id = @whId AND tracking_code = @tc')).recordset[0];

        if (orderRecord) {
          const actualOrderId = orderRecord.id;
          const sessionId = crypto.randomUUID();
          const videoId = crypto.randomUUID();
          const fakeSha = crypto.createHash('sha256').update(o.trackingCode + Date.now()).digest('hex');
          const filename = `${o.trackingCode}_20261004_PACK01.mp4`;

          // Check if session already exists
          const existingSess = (await pool.request()
            .input('oid', sql.VarChar(36), actualOrderId)
            .query('SELECT id FROM packing_sessions WHERE order_id = @oid')).recordset[0];

          if (!existingSess) {
            const idempotencyKey = `seed_idem_${crypto.randomUUID()}`;
            await pool.request()
              .input('sid', sql.VarChar(36), sessionId)
              .input('whId', sql.VarChar(36), whId)
              .input('oid', sql.VarChar(36), actualOrderId)
              .input('stid', sql.VarChar(36), stationId)
              .input('cid', sql.VarChar(36), cameraId)
              .input('uid', sql.VarChar(36), packerUserId)
              .input('idem', sql.VarChar(100), idempotencyKey)
              .query(`
                INSERT INTO packing_sessions (id, warehouse_id, order_id, station_id, camera_id, user_id, status, idempotency_key, start_time, end_time, created_at)
                VALUES (@sid, @whId, @oid, @stid, @cid, @uid, 'COMPLETED', @idem, DATEADD(second, -60, GETDATE()), GETDATE(), GETDATE())
              `);

            await pool.request()
              .input('vid', sql.VarChar(36), videoId)
              .input('sid', sql.VarChar(36), sessionId)
              .input('fn', sql.NVarChar(255), filename)
              .input('lp', sql.NVarChar(1000), `E:\\Website\\storage\\videos\\${filename}`)
              .input('dur', sql.Decimal(8, 2), o.duration)
              .input('fs', sql.BigInt, 15420000)
              .input('sha', sql.VarChar(64), fakeSha)
              .input('isLocked', sql.Bit, o.isDisputed ? 1 : 0)
              .input('disp', sql.VarChar(30), o.isDisputed ? 'UNDER_REVIEW' : 'NONE')
              .query(`
                INSERT INTO videos (id, packing_session_id, filename, local_path, duration, file_size, sha256, sync_status, is_locked, dispute_status, created_at)
                VALUES (@vid, @sid, @fn, @lp, @dur, @fs, @sha, 'LOCAL', @isLocked, @disp, GETDATE())
              `);
          }
        }
      }
    }

    return sampleOrders.length;
  }

  static async deleteOrder(orderId: string): Promise<boolean> {
    const pool = await getDbPool();
    // 1. Get all session IDs for this order
    const sessionsRes = await pool.request()
      .input('orderId', sql.VarChar(36), orderId)
      .query('SELECT id FROM packing_sessions WHERE order_id = @orderId');
    const sessionIds = sessionsRes.recordset.map((r: any) => r.id);

    if (sessionIds.length > 0) {
      // 2. Clear inbox references
      for (const sid of sessionIds) {
        await pool.request()
          .input('sid', sql.VarChar(36), sid)
          .query('DELETE FROM worker_events_inbox WHERE session_id = @sid');
      }
      // 3. Delete packing_sessions (cascades to videos and packing_commands)
      for (const sid of sessionIds) {
        await pool.request()
          .input('sid', sql.VarChar(36), sid)
          .query('DELETE FROM packing_sessions WHERE id = @sid');
      }
    }

    // 4. Delete the order
    await pool.request()
      .input('orderId', sql.VarChar(36), orderId)
      .query('DELETE FROM orders WHERE id = @orderId');

    return true;
  }

  static async purgeAllOrders(warehouseId?: string): Promise<number> {
    const pool = await getDbPool();
    let query = 'SELECT id FROM orders WHERE 1=1';
    const req = pool.request();
    if (warehouseId) {
      req.input('whId', sql.VarChar(36), warehouseId);
      query += ' AND warehouse_id = @whId';
    }
    const res = await req.query(query);
    const orderIds = res.recordset.map((r: any) => r.id);
    for (const oid of orderIds) {
      await this.deleteOrder(oid);
    }
    return orderIds.length;
  }

  static async importOrders(
    ordersList: Array<{
      orderCode: string;
      trackingCode: string;
      platform?: string;
      customerName?: string;
      phone?: string;
      address?: string;
      note?: string;
      items?: Array<{ sku: string; name: string; quantity: number; price?: number }>;
    }>,
    warehouseId?: string
  ): Promise<{ successCount: number; errors: string[] }> {
    const pool = await getDbPool();
    let targetWhId = warehouseId;
    if (!targetWhId) {
      const whRes = await pool.request().query('SELECT TOP 1 id FROM warehouses');
      targetWhId = whRes.recordset[0]?.id;
    }
    if (!targetWhId) {
      throw new Error('Không tìm thấy kho hàng trong hệ thống');
    }

    const crypto = await import('node:crypto');
    let successCount = 0;
    const errors: string[] = [];

    for (const ord of ordersList) {
      const track = (ord.trackingCode || '').trim().toUpperCase();
      const code = (ord.orderCode || track).trim();
      if (!track) {
        errors.push(`Bỏ qua dòng không có mã vận đơn (Đơn: ${code})`);
        continue;
      }

      const custObj = {
        customerName: ord.customerName || 'Khách lẻ',
        phone: ord.phone || '',
        address: ord.address || '',
        note: ord.note || '',
        items: ord.items || []
      };

      const orderId = crypto.randomUUID();
      try {
        await pool.request()
          .input('id', sql.VarChar(36), orderId)
          .input('whId', sql.VarChar(36), targetWhId)
          .input('orderCode', sql.VarChar(100), code)
          .input('trackingCode', sql.VarChar(100), track)
          .input('platform', sql.VarChar(50), ord.platform || 'OTHER')
          .input('customerInfo', sql.NVarChar(4000), JSON.stringify(custObj))
          .query(`
            IF NOT EXISTS (SELECT 1 FROM orders WHERE warehouse_id = @whId AND tracking_code = @trackingCode)
              INSERT INTO orders (id, warehouse_id, order_code, tracking_code, platform, customer_info)
              VALUES (@id, @whId, @orderCode, @trackingCode, @platform, @customerInfo)
            ELSE
              UPDATE orders
              SET customer_info = @customerInfo, order_code = @orderCode, platform = @platform
              WHERE warehouse_id = @whId AND tracking_code = @trackingCode
          `);
        successCount++;
      } catch (err: any) {
        errors.push(`Lỗi nhập đơn ${track}: ${err.message}`);
      }
    }

    return { successCount, errors };
  }

  static async cleanupExpiredVideos(retentionDays: number = 30): Promise<{
    deletedVideosCount: number;
    freedBytes: number;
    errors: string[];
  }> {
    const pool = await getDbPool();
    const fs = await import('node:fs');

    const res = await pool.request()
      .input('days', sql.Int, retentionDays)
      .query(`
        SELECT v.id, v.local_path, v.thumbnail_path, v.file_size, v.filename
        FROM videos v
        WHERE v.is_locked = 0 AND v.storage_owner <> 'WORKER'
          AND v.dispute_status = 'NONE'
          AND v.created_at < DATEADD(day, -@days, GETDATE())
      `);

    const expiredVideos = res.recordset;
    let deletedVideosCount = 0;
    let freedBytes = 0;
    const errors: string[] = [];

    for (const v of expiredVideos) {
      try {
        if (v.local_path && fs.existsSync(v.local_path)) {
          const stats = fs.statSync(v.local_path);
          freedBytes += stats.size;
          fs.unlinkSync(v.local_path);
        }
        if (v.thumbnail_path && fs.existsSync(v.thumbnail_path)) {
          try { fs.unlinkSync(v.thumbnail_path); } catch {}
        }
        const sidecar = `${v.local_path}.proof.json`;
        if (fs.existsSync(sidecar)) {
          try { fs.unlinkSync(sidecar); } catch {}
        }

        await pool.request()
          .input('vid', sql.VarChar(36), v.id)
          .query('DELETE FROM videos WHERE id = @vid');

        deletedVideosCount++;
      } catch (err: any) {
        errors.push(`Lỗi xóa video ${v.filename}: ${err.message}`);
      }
    }

    if (deletedVideosCount > 0) {
      try {
        const crypto = await import('node:crypto');
        await pool.request()
          .input('id', sql.VarChar(36), crypto.randomUUID())
          .input('level', sql.VarChar(20), 'INFO')
          .input('message', sql.NVarChar(sql.MAX), `Đã dọn dẹp ${deletedVideosCount} video hết hạn lưu trữ (${retentionDays} ngày), giải phóng ${(freedBytes / (1024 * 1024)).toFixed(2)} MB`)
          .query(`INSERT INTO system_logs (id, level, message, created_at) VALUES (@id, @level, @message, GETDATE())`);
      } catch {}
    }

    return { deletedVideosCount, freedBytes, errors };
  }

  /**
   * Sensitive Operations Audit Logging
   * Automatically redacts any password, token, or secret from metadata
   */
  static async recordAuditLog(params: {
    businessId?: string | null;
    warehouseId?: string | null;
    userId: string;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    details?: Record<string, any>;
    stationId?: string | null;
  }): Promise<void> {
    try {
      const pool = await getDbPool();
      const safeDetails: Record<string, any> = {};
      if (params.details) {
        for (const [k, v] of Object.entries(params.details)) {
          const lk = k.toLowerCase();
          if (
            lk.includes('password') ||
            lk.includes('token') ||
            lk.includes('secret') ||
            lk.includes('auth') ||
            lk.includes('key')
          ) {
            safeDetails[k] = '[REDACTED]';
          } else {
            safeDetails[k] = v;
          }
        }
      }

      await pool.request()
        .input('businessId', sql.VarChar(36), params.businessId || null)
        .input('warehouseId', sql.VarChar(36), params.warehouseId || null)
        .input('level', sql.VarChar(20), 'AUDIT')
        .input('module', sql.VarChar(50), params.resourceType)
        .input('message', sql.NVarChar(sql.MAX), `[${params.action}] trên ${params.resourceType}${params.resourceId ? ` (${params.resourceId})` : ''}`.trim())
        .input('metadata', sql.NVarChar(sql.MAX), JSON.stringify({
          action: params.action,
          resourceType: params.resourceType,
          resourceId: params.resourceId,
          details: safeDetails,
          timestamp: new Date().toISOString()
        }))
        .input('userId', sql.VarChar(36), params.userId)
        .input('stationId', sql.VarChar(36), params.stationId || null)
        .query(`
          INSERT INTO system_logs (business_id, warehouse_id, level, module, message, metadata, user_id, station_id, created_at)
          VALUES (@businessId, @warehouseId, @level, @module, @message, @metadata, @userId, @stationId, GETDATE())
        `);
    } catch (err: any) {
      console.error('[AuditLog] Failed to record audit log:', err.message);
    }
  }

  static async getStorageOverview(retentionDays: number = 30): Promise<{
    totalVideos: number;
    totalBytes: number;
    expiredVideosCount: number;
    expiredBytes: number;
    lockedVideosCount: number;
  }> {
    const pool = await getDbPool();
    const res = await pool.request()
      .input('days', sql.Int, retentionDays)
      .query(`
        SELECT
          COUNT(*) as totalVideos,
          ISNULL(SUM(file_size), 0) as totalBytes,
          SUM(CASE WHEN is_locked = 0 AND dispute_status = 'NONE' AND created_at < DATEADD(day, -@days, GETDATE()) THEN 1 ELSE 0 END) as expiredVideosCount,
          ISNULL(SUM(CASE WHEN is_locked = 0 AND dispute_status = 'NONE' AND created_at < DATEADD(day, -@days, GETDATE()) THEN file_size ELSE 0 END), 0) as expiredBytes,
          SUM(CASE WHEN is_locked = 1 OR dispute_status != 'NONE' THEN 1 ELSE 0 END) as lockedVideosCount
        FROM videos
      `);

    const r = res.recordset[0] || {};
    return {
      totalVideos: Number(r.totalVideos) || 0,
      totalBytes: Number(r.totalBytes) || 0,
      expiredVideosCount: Number(r.expiredVideosCount) || 0,
      expiredBytes: Number(r.expiredBytes) || 0,
      lockedVideosCount: Number(r.lockedVideosCount) || 0
    };
  }

  /**
   * ==========================================
   * MULTI-TENANT & SUBSCRIPTION PLAN MANAGEMENT
   * ==========================================
   */

  static async getTenants(search?: string): Promise<any[]> {
    const pool = await getDbPool();
    let query = `
      SELECT b.id, b.name, b.code, b.api_key, b.contact_name, b.phone, b.email,
             b.plan_tier, b.monthly_order_limit, b.max_stations, b.retention_days,
             b.subscription_status, b.subscription_expires_at, b.price_per_month,
             b.notes, b.is_active, b.created_at,
             ISNULL(u_orders.orders_this_month, 0) as orders_this_month,
             ISNULL(u_orders.total_orders, 0) as total_orders,
             ISNULL(u_stations.station_count, 0) as station_count,
             ISNULL(u_videos.total_video_bytes, 0) as total_video_bytes,
             ISNULL(u_videos.total_videos, 0) as total_videos
      FROM businesses b WITH (NOLOCK)
      OUTER APPLY (
        SELECT
          COUNT(o.id) as total_orders,
          SUM(CASE WHEN o.created_at >= DATEADD(month, DATEDIFF(month, 0, GETDATE()), 0) THEN 1 ELSE 0 END) as orders_this_month
        FROM warehouses w WITH (NOLOCK)
        JOIN orders o WITH (NOLOCK) ON o.warehouse_id = w.id
        WHERE w.business_id = b.id
      ) u_orders
      OUTER APPLY (
        SELECT COUNT(s.id) as station_count
        FROM warehouses w WITH (NOLOCK)
        JOIN stations s WITH (NOLOCK) ON s.warehouse_id = w.id
        WHERE w.business_id = b.id
      ) u_stations
      OUTER APPLY (
        SELECT
          COUNT(v.id) as total_videos,
          SUM(v.file_size) as total_video_bytes
        FROM warehouses w WITH (NOLOCK)
        JOIN packing_sessions ps WITH (NOLOCK) ON ps.warehouse_id = w.id
        JOIN videos v WITH (NOLOCK) ON v.packing_session_id = ps.id
        WHERE w.business_id = b.id
      ) u_videos
      WHERE 1=1
    `;
    const req = pool.request();
    if (search) {
      req.input('search', sql.VarChar(100), `%${search}%`);
      query += ` AND (b.name LIKE @search OR b.code LIKE @search OR b.contact_name LIKE @search OR b.phone LIKE @search)`;
    }
    query += ` ORDER BY b.created_at DESC`;

    const res = await req.query(query);
    return res.recordset.map((r: any) => {
      const ordersThisMonth = Number(r.orders_this_month) || 0;
      const limit = Number(r.monthly_order_limit) || 1000;
      const usagePercent = Math.min(100, Math.round((ordersThisMonth / limit) * 100));
      const expDate = r.subscription_expires_at ? new Date(r.subscription_expires_at) : null;
      let daysRemaining = expDate ? Math.ceil((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
      let computedStatus = r.subscription_status;
      if (expDate && expDate.getTime() < Date.now() && r.subscription_status === 'ACTIVE') {
        computedStatus = 'EXPIRED';
      }

      return {
        id: r.id,
        name: r.name,
        code: r.code,
        apiKey: r.api_key || null,
        contactName: r.contact_name,
        phone: r.phone,
        email: r.email,
        planTier: r.plan_tier,
        monthlyOrderLimit: limit,
        maxStations: r.max_stations,
        retentionDays: r.retention_days,
        subscriptionStatus: computedStatus,
        subscriptionExpiresAt: r.subscription_expires_at ? r.subscription_expires_at.toISOString() : null,
        daysRemaining,
        pricePerMonth: Number(r.price_per_month) || 0,
        notes: r.notes,
        isActive: !!r.is_active,
        createdAt: r.created_at ? r.created_at.toISOString() : null,
        ordersThisMonth,
        usagePercent,
        stationCount: Number(r.station_count) || 0,
        totalOrders: Number(r.total_orders) || 0,
        totalVideos: Number(r.total_videos) || 0,
        totalVideoBytes: Number(r.total_video_bytes) || 0,
        usage: {
          ordersThisMonth,
          monthlyOrderLimit: limit,
          usagePercent,
          stationCount: Number(r.station_count) || 0,
          maxStations: Number(r.max_stations) || 1,
          totalOrders: Number(r.total_orders) || 0,
          totalVideos: Number(r.total_videos) || 0,
          totalVideoBytes: Number(r.total_video_bytes) || 0
        }
      };
    });
  }

  static async getTenantById(tenantId: string): Promise<any | null> {
    const list = await this.getTenants();
    const tenant = list.find(t => t.id === tenantId);
    if (!tenant) return null;

    const pool = await getDbPool();
    const whRes = await pool.request()
      .input('bizId', sql.VarChar(36), tenantId)
      .query(`
        SELECT id, name, code, is_active, created_at
        FROM warehouses WITH (NOLOCK)
        WHERE business_id = @bizId
      `);

    const usersRes = await pool.request()
      .input('bizId', sql.VarChar(36), tenantId)
      .query(`
        SELECT u.id, u.username, u.full_name, u.email, u.is_active, r.name as role_name, u.created_at
        FROM users u WITH (NOLOCK)
        JOIN roles r WITH (NOLOCK) ON u.role_id = r.id
        WHERE u.business_id = @bizId
      `);

    return {
      ...tenant,
      warehouses: whRes.recordset,
      users: usersRes.recordset
    };
  }

  static async getTenantDashboardStats(): Promise<any> {
    const pool = await getDbPool();
    const res = await pool.request().query(`
      SELECT
        COUNT(*) as totalTenants,
        SUM(CASE WHEN is_active = 1 AND subscription_status = 'ACTIVE' AND (subscription_expires_at IS NULL OR subscription_expires_at > GETDATE()) THEN 1 ELSE 0 END) as activeTenants,
        SUM(CASE WHEN subscription_status = 'EXPIRED' OR (subscription_expires_at IS NOT NULL AND subscription_expires_at <= GETDATE()) THEN 1 ELSE 0 END) as expiredTenants,
        SUM(CASE WHEN is_active = 1 THEN price_per_month ELSE 0 END) as totalMrr,
        (SELECT COUNT(*) FROM orders WITH (NOLOCK) WHERE created_at >= DATEADD(month, DATEDIFF(month, 0, GETDATE()), 0)) as totalOrdersThisMonth,
        (SELECT ISNULL(SUM(file_size), 0) FROM videos WITH (NOLOCK)) as totalVideoStorageBytes
      FROM businesses WITH (NOLOCK)
    `);
    const r = res.recordset[0] || {};
    return {
      totalTenants: Number(r.totalTenants) || 0,
      activeTenants: Number(r.activeTenants) || 0,
      expiredTenants: Number(r.expiredTenants) || 0,
      totalMrr: Number(r.totalMrr) || 0,
      totalOrdersThisMonth: Number(r.totalOrdersThisMonth) || 0,
      totalVideoStorageBytes: Number(r.totalVideoStorageBytes) || 0
    };
  }

  static async createTenant(data: {
    name: string;
    code: string;
    contactName?: string;
    phone?: string;
    email?: string;
    planTier: string;
    monthlyOrderLimit?: number;
    maxStations?: number;
    retentionDays?: number;
    subscriptionMonths?: number;
    pricePerMonth?: number;
    notes?: string;
    adminUsername?: string;
    adminPassword?: string;
    adminFullName?: string;
  }): Promise<{ id: string; code: string; apiKey: string; defaultWarehouseId: string; adminUserId?: string }> {
    const pool = await getDbPool();
    const crypto = await import('node:crypto');
    const tenantId = crypto.randomUUID();
    const cleanCode = data.code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    const cleanKeyPrefix = cleanCode.toLowerCase().replace(/[^a-z0-9]/g, '');
    const apiKey = `pk_live_${cleanKeyPrefix}_${crypto.randomBytes(4).toString('hex')}`;

    let limit = data.monthlyOrderLimit || 1000;
    let stations = data.maxStations || 1;
    let retention = data.retentionDays || 30;
    let price = data.pricePerMonth || 299000;

    if (data.planTier === 'PRO') {
      limit = data.monthlyOrderLimit || 5000;
      stations = data.maxStations || 3;
      retention = data.retentionDays || 45;
      price = data.pricePerMonth || 699000;
    } else if (data.planTier === 'BUSINESS') {
      limit = data.monthlyOrderLimit || 15000;
      stations = data.maxStations || 6;
      retention = data.retentionDays || 60;
      price = data.pricePerMonth || 1490000;
    } else if (data.planTier === 'ENTERPRISE') {
      limit = data.monthlyOrderLimit || 50000;
      limit = data.monthlyOrderLimit || 50000;
      stations = data.maxStations || 10;
      retention = data.retentionDays || 90;
      price = data.pricePerMonth || 2990000;
    }

    const months = data.subscriptionMonths || 1;
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + months);

    // 1. Insert business
    await pool.request()
      .input('id', sql.VarChar(36), tenantId)
      .input('name', sql.NVarChar(100), data.name)
      .input('code', sql.VarChar(50), cleanCode)
      .input('apiKey', sql.VarChar(100), apiKey)
      .input('contactName', sql.NVarChar(100), data.contactName || null)
      .input('phone', sql.VarChar(20), data.phone || null)
      .input('email', sql.VarChar(100), data.email || null)
      .input('planTier', sql.VarChar(30), data.planTier)
      .input('limit', sql.Int, limit)
      .input('stations', sql.Int, stations)
      .input('retention', sql.Int, retention)
      .input('expiresAt', sql.DateTime, expiresAt)
      .input('price', sql.Decimal(18, 0), price)
      .input('notes', sql.NVarChar(sql.MAX), data.notes || null)
      .query(`
        INSERT INTO businesses (
          id, name, code, api_key, contact_name, phone, email, plan_tier,
          monthly_order_limit, max_stations, retention_days,
          subscription_status, subscription_expires_at, price_per_month, notes, is_active
        ) VALUES (
          @id, @name, @code, @apiKey, @contactName, @phone, @email, @planTier,
          @limit, @stations, @retention,
          'ACTIVE', @expiresAt, @price, @notes, 1
        )
      `);

    // 2. Create default warehouse for this tenant
    const whId = crypto.randomUUID();
    const whCode = `WH_${cleanCode}`;
    await pool.request()
      .input('id', sql.VarChar(36), whId)
      .input('bizId', sql.VarChar(36), tenantId)
      .input('name', sql.NVarChar(100), `Kho Chính - ${data.name}`)
      .input('code', sql.VarChar(50), whCode)
      .query(`
        INSERT INTO warehouses (id, business_id, name, code, is_active)
        VALUES (@id, @bizId, @name, @code, 1)
      `);

    // 3. Create default ADMIN role for this business
    const roleId = crypto.randomUUID();
    await pool.request()
      .input('id', sql.VarChar(36), roleId)
      .input('bizId', sql.VarChar(36), tenantId)
      .query(`
        INSERT INTO roles (id, business_id, name, description, permissions)
        VALUES (@id, @bizId, 'ADMIN', N'Quản trị viên kho hàng của khách', '["warehouse:*"]')
      `);

    // 4. Create customer admin user if requested
    let adminUserId: string | undefined;
    if (data.adminUsername && data.adminPassword) {
      adminUserId = crypto.randomUUID();
      const pwdHash = crypto.createHash('sha256').update(data.adminPassword).digest('hex');
      const email = data.email || `${data.adminUsername.toLowerCase()}@${cleanCode.toLowerCase()}.vn`;
      await pool.request()
        .input('id', sql.VarChar(36), adminUserId)
        .input('bizId', sql.VarChar(36), tenantId)
        .input('whId', sql.VarChar(36), whId)
        .input('username', sql.VarChar(50), data.adminUsername)
        .input('pwdHash', sql.VarChar(255), pwdHash)
        .input('fullName', sql.NVarChar(100), data.adminFullName || data.contactName || data.name)
        .input('email', sql.VarChar(100), email)
        .input('roleId', sql.VarChar(36), roleId)
        .query(`
          INSERT INTO users (id, business_id, warehouse_id, username, password_hash, full_name, email, role_id, is_active)
          VALUES (@id, @bizId, @whId, @username, @pwdHash, @fullName, @email, @roleId, 1)
        `);
    }

    return {
      id: tenantId,
      code: cleanCode,
      apiKey,
      defaultWarehouseId: whId,
      adminUserId
    };
  }

  static async updateTenant(tenantId: string, data: any): Promise<boolean> {
    const pool = await getDbPool();
    const req = pool.request().input('id', sql.VarChar(36), tenantId);
    const sets: string[] = ['updated_at = GETDATE()'];

    if (data.name !== undefined) {
      req.input('name', sql.NVarChar(100), data.name);
      sets.push('name = @name');
    }
    if (data.contactName !== undefined) {
      req.input('contactName', sql.NVarChar(100), data.contactName);
      sets.push('contact_name = @contactName');
    }
    if (data.phone !== undefined) {
      req.input('phone', sql.VarChar(20), data.phone);
      sets.push('phone = @phone');
    }
    if (data.email !== undefined) {
      req.input('email', sql.VarChar(100), data.email);
      sets.push('email = @email');
    }
    if (data.planTier !== undefined) {
      req.input('planTier', sql.VarChar(30), data.planTier);
      sets.push('plan_tier = @planTier');
    }
    if (data.monthlyOrderLimit !== undefined) {
      req.input('monthlyOrderLimit', sql.Int, Number(data.monthlyOrderLimit));
      sets.push('monthly_order_limit = @monthlyOrderLimit');
    }
    if (data.maxStations !== undefined) {
      req.input('maxStations', sql.Int, Number(data.maxStations));
      sets.push('max_stations = @maxStations');
    }
    if (data.retentionDays !== undefined) {
      req.input('retentionDays', sql.Int, Number(data.retentionDays));
      sets.push('retention_days = @retentionDays');
    }
    if (data.subscriptionStatus !== undefined) {
      req.input('subscriptionStatus', sql.VarChar(30), data.subscriptionStatus);
      sets.push('subscription_status = @subscriptionStatus');
    }
    if (data.subscriptionExpiresAt !== undefined) {
      req.input('subscriptionExpiresAt', sql.DateTime, new Date(data.subscriptionExpiresAt));
      sets.push('subscription_expires_at = @subscriptionExpiresAt');
    }
    if (data.pricePerMonth !== undefined) {
      req.input('pricePerMonth', sql.Decimal(18, 0), Number(data.pricePerMonth));
      sets.push('price_per_month = @pricePerMonth');
    }
    if (data.notes !== undefined) {
      req.input('notes', sql.NVarChar(sql.MAX), data.notes);
      sets.push('notes = @notes');
    }
    if (data.isActive !== undefined) {
      req.input('isActive', sql.Bit, data.isActive ? 1 : 0);
      sets.push('is_active = @isActive');
    }

    await req.query(`UPDATE businesses SET ${sets.join(', ')} WHERE id = @id`);
    return true;
  }

  static async renewTenantSubscription(tenantId: string, addMonths: number = 1): Promise<{ newExpiresAt: string; status: string }> {
    const pool = await getDbPool();
    const currRes = await pool.request()
      .input('id', sql.VarChar(36), tenantId)
      .query('SELECT subscription_expires_at FROM businesses WHERE id = @id');

    let baseDate = new Date();
    const currentExp = currRes.recordset[0]?.subscription_expires_at;
    if (currentExp && new Date(currentExp).getTime() > Date.now()) {
      baseDate = new Date(currentExp);
    }
    baseDate.setMonth(baseDate.getMonth() + addMonths);

    await pool.request()
      .input('id', sql.VarChar(36), tenantId)
      .input('newExp', sql.DateTime, baseDate)
      .query(`
        UPDATE businesses
        SET subscription_expires_at = @newExp,
            subscription_status = 'ACTIVE',
            is_active = 1,
            updated_at = GETDATE()
        WHERE id = @id
      `);

    return {
      newExpiresAt: baseDate.toISOString(),
      status: 'ACTIVE'
    };
  }

  static async checkTenantQuota(businessId: string): Promise<{
    isAllowed: boolean;
    reason?: string;
    planTier: string;
    monthlyOrderLimit: number;
    ordersThisMonth: number;
    usagePercent: number;
    subscriptionStatus: string;
  }> {
    const pool = await getDbPool();
    const bRes = await pool.request()
      .input('bizId', sql.VarChar(36), businessId)
      .query(`
        SELECT id, name, plan_tier, monthly_order_limit, subscription_status, subscription_expires_at, is_active
        FROM businesses WITH (NOLOCK)
        WHERE id = @bizId
      `);
    const b = bRes.recordset[0];
    if (!b) return { isAllowed: true, planTier: 'STARTER', monthlyOrderLimit: 1000, ordersThisMonth: 0, usagePercent: 0, subscriptionStatus: 'ACTIVE' };

    if (!b.is_active || b.subscription_status === 'SUSPENDED') {
      return {
        isAllowed: false,
        reason: 'Tài khoản công ty/shop đã bị tạm dừng. Vui lòng liên hệ quản trị viên.',
        planTier: b.plan_tier,
        monthlyOrderLimit: b.monthly_order_limit,
        ordersThisMonth: 0,
        usagePercent: 0,
        subscriptionStatus: b.subscription_status
      };
    }

    if (b.subscription_expires_at && new Date(b.subscription_expires_at).getTime() < Date.now()) {
      return {
        isAllowed: false,
        reason: 'Gói cước của công ty/shop đã hết hạn thuê. Vui lòng liên hệ gia hạn.',
        planTier: b.plan_tier,
        monthlyOrderLimit: b.monthly_order_limit,
        ordersThisMonth: 0,
        usagePercent: 100,
        subscriptionStatus: 'EXPIRED'
      };
    }

    const countRes = await pool.request()
      .input('bizId', sql.VarChar(36), businessId)
      .query(`
        SELECT COUNT(o.id) as ordersThisMonth
        FROM warehouses w WITH (NOLOCK)
        JOIN orders o WITH (NOLOCK) ON o.warehouse_id = w.id
        WHERE w.business_id = @bizId
          AND o.created_at >= DATEADD(month, DATEDIFF(month, 0, GETDATE()), 0)
      `);
    const ordersThisMonth = Number(countRes.recordset[0]?.ordersThisMonth) || 0;
    const limit = Number(b.monthly_order_limit) || 1000;
    const usagePercent = Math.round((ordersThisMonth / limit) * 100);

    if (ordersThisMonth > limit * 1.15) {
      return {
        isAllowed: false,
        reason: `Công ty/shop đã vượt quá 115% hạn mức đơn trong tháng (${ordersThisMonth}/${limit} đơn). Vui lòng nâng cấp gói cước.`,
        planTier: b.plan_tier,
        monthlyOrderLimit: limit,
        ordersThisMonth,
        usagePercent,
        subscriptionStatus: b.subscription_status
      };
    }

    return {
      isAllowed: true,
      planTier: b.plan_tier,
      monthlyOrderLimit: limit,
      ordersThisMonth,
      usagePercent,
      subscriptionStatus: b.subscription_status
    };
  }

  /**
   * ==========================================
   * STAFF & PACKER USER MANAGEMENT
   * ==========================================
   */

  static async getRoles(businessId?: string): Promise<any[]> {
    const pool = await getDbPool();
    const req = pool.request();
    let query = `
      SELECT r.id, r.business_id, r.name, r.description, r.permissions, r.created_at
      FROM roles r WITH (NOLOCK)
    `;
    if (businessId) {
      req.input('bizId', sql.VarChar(36), businessId);
      query += ` WHERE r.business_id = @bizId`;
    }
    query += ` ORDER BY r.name ASC`;
    const res = await req.query(query);
    return res.recordset.map((r: any) => ({
      id: r.id,
      businessId: r.business_id,
      name: r.name,
      description: r.description,
      permissions: JSON.parse(r.permissions || '[]'),
      createdAt: r.created_at ? r.created_at.toISOString() : null
    }));
  }

  static async getStaffUsers(filters?: {
    businessId?: string;
    warehouseId?: string;
    search?: string;
    roleName?: string;
  }): Promise<any[]> {
    const pool = await getDbPool();
    const req = pool.request();
    let query = `
      SELECT u.id, u.business_id, u.warehouse_id, u.username, u.full_name, u.email, u.phone,
             u.role_id, u.is_active, u.created_at, u.updated_at,
             r.name as role_name, r.description as role_description,
             b.name as business_name, b.code as business_code,
             w.name as warehouse_name, w.code as warehouse_code,
             ISNULL(u_pack.total_packed, 0) as total_packed,
             ISNULL(u_pack.packed_today, 0) as packed_today
      FROM users u WITH (NOLOCK)
      LEFT JOIN roles r WITH (NOLOCK) ON u.role_id = r.id
      LEFT JOIN businesses b WITH (NOLOCK) ON u.business_id = b.id
      LEFT JOIN warehouses w WITH (NOLOCK) ON u.warehouse_id = w.id
      OUTER APPLY (
        SELECT
          COUNT(ps.id) as total_packed,
          SUM(CASE WHEN ps.created_at >= DATEADD(day, DATEDIFF(day, 0, GETDATE()), 0) THEN 1 ELSE 0 END) as packed_today
        FROM packing_sessions ps WITH (NOLOCK)
        WHERE ps.user_id = u.id AND ps.status = 'COMPLETED'
      ) u_pack
      WHERE 1=1
    `;

    if (filters?.businessId) {
      req.input('bizId', sql.VarChar(36), filters.businessId);
      query += ` AND u.business_id = @bizId`;
    }
    if (filters?.warehouseId) {
      req.input('whId', sql.VarChar(36), filters.warehouseId);
      query += ` AND u.warehouse_id = @whId`;
    }
    if (filters?.roleName && filters.roleName !== 'ALL') {
      req.input('roleName', sql.VarChar(50), filters.roleName);
      query += ` AND r.name = @roleName`;
    }
    if (filters?.search) {
      req.input('search', sql.NVarChar(100), `%${filters.search}%`);
      query += ` AND (u.username LIKE @search OR u.full_name LIKE @search OR u.email LIKE @search OR u.phone LIKE @search)`;
    }

    query += ` ORDER BY u.created_at DESC`;

    const res = await req.query(query);
    return res.recordset.map((r: any) => ({
      id: r.id,
      businessId: r.business_id,
      businessName: r.business_name,
      businessCode: r.business_code,
      warehouseId: r.warehouse_id,
      warehouseName: r.warehouse_name,
      warehouseCode: r.warehouse_code,
      username: r.username,
      fullName: r.full_name,
      email: r.email,
      phone: r.phone,
      roleId: r.role_id,
      roleName: r.role_name,
      roleDescription: r.role_description,
      isActive: !!r.is_active,
      createdAt: r.created_at ? r.created_at.toISOString() : null,
      updatedAt: r.updated_at ? r.updated_at.toISOString() : null,
      stats: {
        totalPacked: Number(r.total_packed) || 0,
        packedToday: Number(r.packed_today) || 0
      }
    }));
  }

  static async getStaffUserById(userId: string): Promise<any | null> {
    const pool = await getDbPool();
    const res = await pool.request()
      .input('id', sql.VarChar(36), userId)
      .query(`
        SELECT u.id, u.business_id, u.warehouse_id, u.username, u.full_name, u.email, u.phone,
               u.role_id, u.is_active, u.created_at, u.updated_at,
               r.name as role_name, r.description as role_description,
               b.name as business_name, b.code as business_code,
               w.name as warehouse_name, w.code as warehouse_code
        FROM users u WITH (NOLOCK)
        LEFT JOIN roles r WITH (NOLOCK) ON u.role_id = r.id
        LEFT JOIN businesses b WITH (NOLOCK) ON u.business_id = b.id
        LEFT JOIN warehouses w WITH (NOLOCK) ON u.warehouse_id = w.id
        WHERE u.id = @id
      `);
    const r = res.recordset[0];
    if (!r) return null;
    return {
      id: r.id,
      businessId: r.business_id,
      businessName: r.business_name,
      businessCode: r.business_code,
      warehouseId: r.warehouse_id,
      warehouseName: r.warehouse_name,
      warehouseCode: r.warehouse_code,
      username: r.username,
      fullName: r.full_name,
      email: r.email,
      phone: r.phone,
      roleId: r.role_id,
      roleName: r.role_name,
      roleDescription: r.role_description,
      isActive: !!r.is_active,
      createdAt: r.created_at ? r.created_at.toISOString() : null,
      updatedAt: r.updated_at ? r.updated_at.toISOString() : null
    };
  }

  static async createStaffUser(data: {
    businessId: string;
    warehouseId: string;
    username: string;
    password: string;
    fullName: string;
    email?: string;
    phone?: string;
    roleId?: string;
    roleName?: string;
  }): Promise<any> {
    const pool = await getDbPool();
    const crypto = await import('node:crypto');
    const cleanUsername = data.username.trim().toLowerCase();

    // 1. Check duplicate username
    const checkUser = await pool.request()
      .input('u', sql.VarChar(50), cleanUsername)
      .query(`SELECT id FROM users WHERE username = @u`);
    if (checkUser.recordset.length > 0) {
      throw new Error(`Tên đăng nhập "${cleanUsername}" đã được sử dụng. Vui lòng chọn tên đăng nhập khác.`);
    }

    // 2. Resolve Role
    let roleId = data.roleId;
    if (!roleId) {
      const targetRoleName = data.roleName || 'PACKING_USER';
      const roleRes = await pool.request()
        .input('bizId', sql.VarChar(36), data.businessId)
        .input('name', sql.VarChar(50), targetRoleName)
        .query(`SELECT id FROM roles WHERE business_id = @bizId AND name = @name`);
      roleId = roleRes.recordset[0]?.id;

      if (!roleId) {
        const defaultRole = await pool.request()
          .input('name', sql.VarChar(50), targetRoleName)
          .query(`SELECT TOP 1 id FROM roles WHERE name = @name`);
        roleId = defaultRole.recordset[0]?.id;
      }
    }

    if (!roleId) {
      throw new Error('Không tìm thấy vai trò phù hợp trong hệ thống');
    }

    const userId = crypto.randomUUID();
    const pwdHash = crypto.createHash('sha256').update(data.password).digest('hex');
    const email = data.email?.trim() || `${cleanUsername}@packingproof.local`;

    await pool.request()
      .input('id', sql.VarChar(36), userId)
      .input('bizId', sql.VarChar(36), data.businessId)
      .input('whId', sql.VarChar(36), data.warehouseId)
      .input('username', sql.VarChar(50), cleanUsername)
      .input('pwd', sql.VarChar(255), pwdHash)
      .input('name', sql.NVarChar(100), data.fullName.trim())
      .input('email', sql.VarChar(100), email)
      .input('phone', sql.VarChar(20), data.phone ? data.phone.trim() : null)
      .input('roleId', sql.VarChar(36), roleId)
      .query(`
        INSERT INTO users (id, business_id, warehouse_id, username, password_hash, full_name, email, phone, role_id, is_active, created_at, updated_at)
        VALUES (@id, @bizId, @whId, @username, @pwd, @name, @email, @phone, @roleId, 1, GETDATE(), GETDATE())
      `);

    return this.getStaffUserById(userId);
  }

  static async updateStaffUser(userId: string, data: {
    fullName?: string;
    email?: string;
    phone?: string;
    warehouseId?: string;
    roleId?: string;
    isActive?: boolean;
    password?: string;
  }): Promise<any> {
    const pool = await getDbPool();
    const req = pool.request().input('id', sql.VarChar(36), userId);
    const sets: string[] = ['updated_at = GETDATE()'];

    if (data.fullName !== undefined) {
      req.input('name', sql.NVarChar(100), data.fullName.trim());
      sets.push('full_name = @name');
    }
    if (data.email !== undefined) {
      req.input('email', sql.VarChar(100), data.email.trim());
      sets.push('email = @email');
    }
    if (data.phone !== undefined) {
      req.input('phone', sql.VarChar(20), data.phone ? data.phone.trim() : null);
      sets.push('phone = @phone');
    }
    if (data.warehouseId !== undefined) {
      req.input('whId', sql.VarChar(36), data.warehouseId);
      sets.push('warehouse_id = @whId');
    }
    if (data.roleId !== undefined) {
      req.input('roleId', sql.VarChar(36), data.roleId);
      sets.push('role_id = @roleId');
    }
    if (data.isActive !== undefined) {
      req.input('isActive', sql.Bit, data.isActive ? 1 : 0);
      sets.push('is_active = @isActive');
    }
    if (data.password && data.password.trim().length > 0) {
      const crypto = await import('node:crypto');
      const hash = crypto.createHash('sha256').update(data.password.trim()).digest('hex');
      req.input('pwd', sql.VarChar(255), hash);
      sets.push('password_hash = @pwd');
    }

    await req.query(`UPDATE users SET ${sets.join(', ')} WHERE id = @id`);
    return this.getStaffUserById(userId);
  }

  static async toggleStaffUserActive(userId: string, isActive: boolean): Promise<boolean> {
    const pool = await getDbPool();
    await pool.request()
      .input('id', sql.VarChar(36), userId)
      .input('isActive', sql.Bit, isActive ? 1 : 0)
      .query(`UPDATE users SET is_active = @isActive, updated_at = GETDATE() WHERE id = @id`);
    return true;
  }

  // Google Drive Cloud Storage Management
  static async getBusinessGoogleDrive(businessId: string): Promise<{
    connected: boolean;
    email?: string;
    folderId?: string;
    refreshToken?: string;
    retentionDays: number;
  }> {
    const pool = await getDbPool();
    const res = await pool.request()
      .input('id', sql.VarChar(36), businessId)
      .query(`SELECT google_drive_email, google_drive_folder_id, google_drive_refresh_token, retention_days FROM businesses WHERE id = @id`);
    const r = res.recordset[0];
    if (!r || !r.google_drive_email || !r.google_drive_refresh_token ||
        r.google_drive_refresh_token.startsWith('mock_') || r.google_drive_folder_id?.includes('mock_')) {
      return { connected: false, retentionDays: r?.retention_days || 30 };
    }
    return {
      connected: true,
      email: r.google_drive_email,
      folderId: r.google_drive_folder_id || 'root',
      refreshToken: r.google_drive_refresh_token,
      retentionDays: r.retention_days || 30
    };
  }

  static async saveBusinessGoogleDrive(params: {
    businessId: string;
    email: string;
    refreshToken: string;
    folderId?: string;
  }): Promise<boolean> {
    const pool = await getDbPool();
    await pool.request()
      .input('id', sql.VarChar(36), params.businessId)
      .input('email', sql.NVarChar(255), params.email)
      .input('token', sql.NVarChar(sql.MAX), params.refreshToken)
      .input('folder', sql.NVarChar(255), params.folderId || 'PackingProof_Videos')
      .query(`
        UPDATE businesses
        SET google_drive_email = @email,
            google_drive_refresh_token = @token,
            google_drive_folder_id = @folder,
            updated_at = GETDATE()
        WHERE id = @id
      `);
    return true;
  }

  static async disconnectBusinessGoogleDrive(businessId: string): Promise<boolean> {
    const pool = await getDbPool();
    await pool.request()
      .input('id', sql.VarChar(36), businessId)
      .query(`
        UPDATE businesses
        SET google_drive_email = NULL,
            google_drive_refresh_token = NULL,
            google_drive_folder_id = NULL,
            updated_at = GETDATE()
        WHERE id = @id
      `);
    return true;
  }

  /**
   * ==========================================
   * Open Ingestion API & API Key Management
   * ==========================================
   */

  static async findBusinessByApiKey(apiKey: string): Promise<{
    id: string;
    code: string;
    name: string;
    apiKey: string;
    isActive: boolean;
    subscriptionStatus: string;
    defaultWarehouseId: string;
    defaultWarehouseName: string;
  } | null> {
    if (!apiKey || !apiKey.trim()) return null;
    const pool = await getDbPool();
    const res = await pool.request()
      .input('key', sql.VarChar(100), apiKey.trim())
      .query(`
        SELECT TOP 1
          b.id,
          b.code,
          b.name,
          b.api_key,
          b.is_active,
          b.subscription_status,
          w.id AS default_warehouse_id,
          w.name AS default_warehouse_name
        FROM businesses b WITH (NOLOCK)
        LEFT JOIN warehouses w WITH (NOLOCK) ON w.business_id = b.id
        WHERE b.api_key = @key
        ORDER BY w.created_at ASC
      `);
    const row = res.recordset[0];
    if (!row) return null;
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      apiKey: row.api_key,
      isActive: Boolean(row.is_active),
      subscriptionStatus: row.subscription_status || 'ACTIVE',
      defaultWarehouseId: row.default_warehouse_id,
      defaultWarehouseName: row.default_warehouse_name
    };
  }

  static async rotateApiKey(businessId: string): Promise<string> {
    const pool = await getDbPool();
    const crypto = await import('node:crypto');
    const bRes = await pool.request()
      .input('id', sql.VarChar(36), businessId)
      .query('SELECT code FROM businesses WHERE id = @id');
    const code = (bRes.recordset[0]?.code || 'client').toLowerCase().replace(/[^a-z0-9]/g, '');
    const randHex = crypto.randomBytes(6).toString('hex');
    const newKey = `pk_live_${code}_${randHex}`;

    await pool.request()
      .input('id', sql.VarChar(36), businessId)
      .input('key', sql.VarChar(100), newKey)
      .query('UPDATE businesses SET api_key = @key, updated_at = GETDATE() WHERE id = @id');

    return newKey;
  }

  static async getOrderProofByTrackingCode(businessId: string, trackingCode: string): Promise<any | null> {
    const pool = await getDbPool();
    const res = await pool.request()
      .input('bizId', sql.VarChar(36), businessId)
      .input('code', sql.VarChar(100), trackingCode.trim().toUpperCase())
      .query(`
        SELECT TOP 1
          o.id,
          o.order_code,
          o.tracking_code,
          o.platform,
          o.customer_info,
          o.created_at,
          ps.id as session_id,
          ps.status as packing_status,
          ps.start_time,
          ps.end_time,
          ps.cancellation_reason,
          st.code as station_code,
          st.name as station_name,
          u.username as operator_username,
          u.full_name as operator_name,
          v.id as video_id,
          v.filename as video_filename,
          v.file_size as video_size,
          v.duration as video_duration,
          v.sha256 as video_checksum,
          v.created_at as packed_at
        FROM orders o WITH (NOLOCK)
        JOIN warehouses w WITH (NOLOCK) ON o.warehouse_id = w.id
        LEFT JOIN packing_sessions ps WITH (NOLOCK) ON ps.order_id = o.id
        LEFT JOIN stations st WITH (NOLOCK) ON ps.station_id = st.id
        LEFT JOIN users u WITH (NOLOCK) ON ps.user_id = u.id
        LEFT JOIN videos v WITH (NOLOCK) ON v.packing_session_id = ps.id
        WHERE w.business_id = @bizId
          AND (o.tracking_code = @code OR o.order_code = @code)
        ORDER BY o.created_at DESC
      `);
    const row = res.recordset[0];
    if (!row) return null;

    let customer = null;
    if (row.customer_info) {
      try {
        customer = JSON.parse(row.customer_info);
      } catch {
        customer = { note: row.customer_info };
      }
    }

    const durationSeconds = (row.start_time && row.end_time)
      ? Math.max(0, Math.round((new Date(row.end_time).getTime() - new Date(row.start_time).getTime()) / 1000))
      : (Number(row.video_duration) || 0);

    return {
      orderId: row.id,
      orderCode: row.order_code,
      trackingCode: row.tracking_code,
      platform: row.platform,
      orderStatus: row.packing_status || 'PENDING',
      customer,
      createdAt: row.created_at,
      packingSession: row.session_id ? {
        sessionId: row.session_id,
        status: row.packing_status,
        startTime: row.start_time,
        endTime: row.end_time,
        durationSeconds,
        station: {
          code: row.station_code,
          name: row.station_name
        },
        packer: {
          username: row.operator_username,
          name: row.operator_name
        },
        cancellationReason: row.cancellation_reason
      } : null,
      videoProof: row.video_id ? {
        videoId: row.video_id,
        filename: row.video_filename,
        fileSize: Number(row.video_size) || 0,
        durationSeconds: Number(row.video_duration) || 0,
        sha256: row.video_checksum,
        packedAt: row.packed_at,
        playbackUrl: `/api/v1/videos/stream/${row.video_id}`
      } : null
    };
  }
}
