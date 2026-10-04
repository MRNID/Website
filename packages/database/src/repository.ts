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
  static async findStationByCode(code: string): Promise<StationDto | null> {
    const pool = await getDbPool();
    const result = await pool.request()
      .input('code', sql.VarChar(50), code)
      .query(`
        SELECT id, warehouse_id, name, code, computer_name, ip_address, status, last_heartbeat_at, created_at, updated_at
        FROM stations
        WHERE code = @code
      `);
    const r = result.recordset[0];
    if (!r) return null;
    return {
      id: r.id,
      warehouseId: r.warehouse_id,
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
          AND s.status IN ('WAITING', 'RECORDING', 'PROCESSING', 'CANCELLING', 'INDETERMINATE_TIMEOUT')
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
        SELECT s.*, o.tracking_code, o.order_code, v.id as video_id, v.filename, v.duration, v.file_size, v.sha256, v.sync_status
        FROM packing_sessions s
        INNER JOIN orders o ON s.order_id = o.id
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
          INSERT INTO videos (id, packing_session_id, filename, local_path, duration, file_size, sha256, thumbnail_path, sync_status, purge_status)
          VALUES (@id, @sessionId, @filename, @localPath, @duration, @fileSize, @sha256, @thumbnailPath, 'PENDING', 'ACTIVE')
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
             v.thumbnail_path, v.sync_status, v.is_locked, v.dispute_status, v.created_at,
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
             c.id as camera_id, c.name as camera_name, c.type as camera_type, c.rtsp_url as camera_rtsp_url, c.status as camera_status
      FROM stations s
      LEFT JOIN cameras c ON s.id = c.station_id
      ORDER BY s.code ASC
    `);
    return res.recordset.map((r: any) => ({
      id: r.id,
      warehouseId: r.warehouse_id,
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
        .input('name', sql.NVarChar(100), data.name)
        .input('code', sql.VarChar(50), data.code)
        .input('computerName', sql.VarChar(100), data.computerName || null)
        .input('ipAddress', sql.VarChar(50), data.ipAddress || null)
        .query(`
          UPDATE stations
          SET name = @name, code = @code, computer_name = @computerName, ip_address = @ipAddress, updated_at = GETDATE()
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

  static async getOrders(params?: { warehouseId?: string; search?: string }): Promise<any[]> {
    const pool = await getDbPool();
    let query = `
      SELECT o.id, o.warehouse_id, o.order_code, o.tracking_code, o.platform, o.customer_info, o.created_at,
             ps.id as session_id, ps.status as packing_status, ps.start_time, ps.end_time,
             v.id as video_id, v.filename as video_filename, v.duration as video_duration, v.sha256 as video_sha256
      FROM orders o
      LEFT JOIN packing_sessions ps ON o.id = ps.order_id
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
    query += ` ORDER BY o.created_at DESC`;

    const res = await req.query(query);
    return res.recordset.map((r: any) => {
      let customer = null;
      try {
        if (r.customer_info) customer = JSON.parse(r.customer_info);
      } catch {
        customer = { note: r.customer_info };
      }
      return {
        id: r.id,
        orderCode: r.order_code,
        trackingCode: r.tracking_code,
        platform: r.platform,
        customer,
        packingStatus: r.packing_status || 'PENDING',
        sessionId: r.session_id || null,
        video: r.video_id ? {
          id: r.video_id,
          filename: r.video_filename,
          duration: r.video_duration,
          sha256: r.video_sha256
        } : null,
        createdAt: r.created_at ? r.created_at.toISOString() : null
      };
    });
  }

  static async seedSampleOrders(): Promise<number> {
    const pool = await getDbPool();
    const whRes = await pool.request().query('SELECT TOP 1 id FROM warehouses');
    const whId = whRes.recordset[0]?.id;
    if (!whId) return 0;

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
        })
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
        })
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
        })
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
        })
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
        })
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
}
