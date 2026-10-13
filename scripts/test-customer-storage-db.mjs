// Explicit integration check against the configured SQL Server. All rows belong to a new fixture tenant.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
await import('../apps/backend-api/dist/config.js');
const { getDbPool, closeDbPool, sql, DatabaseRepository: db, CustomerStorageRepository: storage } = await import('../packages/database/dist/index.js');
const ids = Object.fromEntries(['biz', 'wh', 'role', 'user', 'station', 'camera', 'order', 'session', 'mobile'].map(k => [k, randomUUID()]));
const code = 'STORAGE_TEST_' + randomUUID().slice(0, 8);
let pool;
const request = () => {
  const req = pool.request();
  for (const [key, value] of Object.entries(ids)) req.input(key, sql.VarChar(36), value);
  return req.input('code', sql.VarChar(50), code);
};
try {
  pool = await getDbPool();
  await request().batch(`
    INSERT INTO businesses (id,name,code) VALUES (@biz, @code, @code);
    INSERT INTO warehouses (id,business_id,name,code) VALUES (@wh,@biz,@code,@code);
    INSERT INTO roles (id,business_id,name) VALUES (@role,@biz,'PACKING_USER');
    INSERT INTO users (id,business_id,warehouse_id,username,password_hash,full_name,email,role_id) VALUES (@user,@biz,@wh,@code,'unused-test-hash',@code,@code+'@example.invalid',@role);
    INSERT INTO stations (id,warehouse_id,name,code) VALUES (@station,@wh,@code,@code);
    INSERT INTO cameras (id,station_id,name,type) VALUES (@camera,@station,@code,'RTSP');
    INSERT INTO orders (id,warehouse_id,order_code,tracking_code,platform) VALUES (@order,@wh,@code,@code,'OTHER');
    INSERT INTO packing_sessions (id,warehouse_id,order_id,station_id,camera_id,user_id,status,idempotency_key)
      VALUES (@session,@wh,@order,@station,@camera,@user,'PROCESSING',@code);
  `);
  const video = { sessionId: ids.session, filename: 'test.mp4', localPath: 'D:/StorageRegression/test.mp4', fileSize: 100, duration: 2, sha256: 'a'.repeat(64) };
  const results = await Promise.all([db.recordFinalizedVideo(video), db.recordFinalizedVideo(video)]);
  assert.equal(results[0], results[1]);
  await assert.rejects(db.recordFinalizedVideo({ ...video, sha256: 'b'.repeat(64) }));
  assert.equal((await storage.findVideo(results[0])).storage_owner, 'WORKER');
  const files = await Promise.all([storage.reserveDriveId(results[0], ids.station, 'file-a'), storage.reserveDriveId(results[0], ids.station, 'file-b')]);
  assert.equal(files[0], files[1]);
  await assert.rejects(storage.reserveDriveId(results[0], randomUUID(), 'file-c'));
  await storage.setDriveState(results[0], ids.station, 'SYNCED');
  await storage.setDriveState(results[0], ids.station, 'FAILED', 'stale retry');
  assert.equal((await storage.findVideo(results[0])).sync_status, 'SYNCED');
  await request().query("UPDATE videos SET storage_owner='LEGACY' WHERE packing_session_id=@session");
  await db.recordFinalizedVideo(video);
  assert.equal((await storage.findVideo(results[0])).sync_status, 'PENDING');
  const mobile = { ...video, sessionId: ids.mobile, stationId: ids.station, warehouseId: ids.wh, userId: ids.user, trackingCode: code + '_M', orderCode: code + '_M', platform: 'OTHER' };
  const uploads = await Promise.all([db.createMobilePackingSessionTx(mobile), db.createMobilePackingSessionTx(mobile)]);
  assert.equal(uploads[0].videoId, uploads[1].videoId);
  assert.equal((await storage.findVideo(uploads[0].videoId)).storage_owner, 'WORKER');
  const search = await db.searchVideos({ businessId: ids.biz });
  assert.equal(search.total, 2);
  assert.ok(search.items.every(item => item.storage_owner === 'WORKER'));
  console.log('PASS: SQL Server metadata, concurrent retries, ownership adoption, station isolation, Drive state and mobile idempotency.');
} catch (error) { console.error('SQL storage integration failed:', error.message); process.exitCode = 1; }
finally {
  if (pool) {
    try {
      await request().batch(`
        DELETE FROM videos WHERE packing_session_id IN (SELECT id FROM packing_sessions WHERE warehouse_id=@wh);
        DELETE FROM packing_sessions WHERE warehouse_id=@wh;
        DELETE FROM orders WHERE warehouse_id=@wh;
        DELETE FROM cameras WHERE station_id=@station;
        DELETE FROM workers WHERE station_id=@station;
        DELETE FROM stations WHERE id=@station;
        DELETE FROM users WHERE id=@user;
        DELETE FROM roles WHERE id=@role;
        DELETE FROM warehouses WHERE id=@wh;
        DELETE FROM businesses WHERE id=@biz;
      `);
      console.log('Removed fixture tenant and its test records.');
    } catch (error) { console.error('Fixture cleanup failed:', error.message); process.exitCode = 1; }
  }
  await closeDbPool();
}
