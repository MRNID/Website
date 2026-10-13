import { getDbPool, sql } from './db-client.js';

/** Cloud metadata only. Never open customer paths on the API host. */
export class CustomerStorageRepository {
  static async findVideo(id: string, bySession = false): Promise<any | null> {
    const pool = await getDbPool();
    const result = await pool.request().input('id', sql.VarChar(36), id).query(`
      SELECT v.*, s.station_id, s.warehouse_id, s.user_id, w.business_id,
        o.tracking_code, o.order_code, o.platform, st.name AS station_name, st.code AS station_code, u.full_name AS operator_name
      FROM videos v JOIN packing_sessions s ON s.id = v.packing_session_id
      JOIN warehouses w ON w.id = s.warehouse_id
      JOIN orders o ON o.id = s.order_id JOIN stations st ON st.id = s.station_id JOIN users u ON u.id = s.user_id
      WHERE ${bySession ? 's.id' : 'v.id'} = @id`);
    return result.recordset[0] || null;
  }

  static async reserveDriveId(videoId: string, stationId: string, fileId: string): Promise<string> {
    const pool = await getDbPool();
    const result = await pool.request()
      .input('id', sql.VarChar(36), videoId).input('station', sql.VarChar(36), stationId)
      .input('file', sql.VarChar(200), fileId).query(`
        UPDATE v SET drive_file_id = COALESCE(drive_file_id, @file)
        OUTPUT inserted.drive_file_id
        FROM videos v JOIN packing_sessions s ON s.id = v.packing_session_id
        WHERE v.id = @id AND s.station_id = @station AND v.storage_owner = 'WORKER'`);
    if (!result.recordset[0]) throw new Error('Video không thuộc máy kho này');
    return result.recordset[0].drive_file_id;
  }

  static async setDriveState(videoId: string, stationId: string, state: string, error?: string): Promise<void> {
    if (!['PENDING', 'SYNCING', 'SYNCED', 'FAILED'].includes(state)) throw new Error('Invalid Drive state');
    const pool = await getDbPool();
    await pool.request().input('id', sql.VarChar(36), videoId).input('station', sql.VarChar(36), stationId)
      .input('state', sql.VarChar(30), state).input('error', sql.NVarChar(4000), error?.slice(0, 1000) || null).query(`
        UPDATE v SET sync_status = @state, sync_error = @error, updated_at = GETDATE(),
          sync_attempts = sync_attempts + CASE WHEN @state = 'SYNCING' THEN 1 ELSE 0 END
        FROM videos v JOIN packing_sessions s ON s.id = v.packing_session_id
        WHERE v.id = @id AND s.station_id = @station AND v.storage_owner = 'WORKER'
          AND (v.sync_status <> 'SYNCED' OR @state = 'SYNCED')`);
  }
}
