import assert from 'node:assert/strict';
import { test, before, beforeEach, afterEach, after, mock } from 'node:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { once } from 'node:events';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = randomBytes(32).toString('hex');
const { DatabaseRepository: db, CustomerStorageRepository: metadata } = await import('../packages/database/dist/index.js');
const { CustomerStorageService: service } = await import('../apps/backend-api/dist/services/customer-storage.service.js');
const { GoogleDriveService: drive } = await import('../apps/backend-api/dist/services/google-drive.service.js');
const { WorkerGateway: gateway } = await import('../apps/backend-api/dist/websocket/worker-gateway.js');
const { AuthService } = await import('../apps/backend-api/dist/auth/auth.service.js');
const { LocalVideoStore } = await import('../apps/video-worker/dist/storage/local-video-store.js');
const { DriveSyncQueue } = await import('../apps/video-worker/dist/storage/drive-sync-queue.js');
const { parseVideoRange, canReadVideo, warehouseVideoStream } = await import('../apps/backend-api/dist/services/video-playback.service.js');
const { createServer } = await import('../apps/backend-api/dist/main.js');
const require = createRequire(new URL('../apps/backend-api/package.json', import.meta.url));
const { WebSocketServer, WebSocket } = require('ws');
const station = { id: randomUUID(), businessId: randomUUID(), warehouseId: randomUUID(), code: 'PACKTEST' };
const user = { id: randomUUID(), username: 'storage-test', role: 'ADMIN', businessId: station.businessId, warehouseId: station.warehouseId, isActive: true };
const workerToken = randomBytes(32).toString('hex');
let app, root, store, video, bytes, row;
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers });
const bearer = () => AuthService.generateTokens({ sub: user.id, username: user.username, role: user.role, businessId: user.businessId, warehouseId: user.warehouseId }).accessToken;
const call = (method, url, payload, headers = {}) => app.inject({ method, url, payload, headers: { authorization: `Bearer ${bearer()}`, ...headers } });
const remoteCopy = () => ({ id: row.drive_file_id, size: String(row.file_size), sha256Checksum: row.sha256, appProperties: { packingVideoId: row.id } });

before(async () => { app = await createServer(); app.log.level = 'silent'; });
beforeEach(() => {
  root = fs.mkdtempSync(path.join(tmpdir(), 'customer-storage-test-'));
  store = new LocalVideoStore(path.join(root, 'archive'), path.join(root, 'journal'));
  bytes = Buffer.from('fixture-video-data-for-stream-and-resume');
  const file = path.join(store.archiveDir, 'proof.mp4'); fs.writeFileSync(file, bytes);
  video = { sessionId: randomUUID(), filename: 'proof.mp4', localPath: file, fileSize: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), duration: 2 };
  row = { id: randomUUID(), packing_session_id: video.sessionId, filename: video.filename, local_path: file, file_size: bytes.length, sha256: video.sha256, duration: 2, storage_owner: 'WORKER', sync_status: 'PENDING', drive_file_id: 'drive-file-1', business_id: station.businessId, warehouse_id: station.warehouseId, station_id: station.id, user_id: user.id };
  mock.method(globalThis, 'fetch', async () => { throw new Error('Network unavailable'); });
  mock.method(db, 'findUserById', async () => ({ ...user }));
  mock.method(db, 'findStationById', async () => ({ ...station }));
  mock.method(db, 'findStationByCode', async () => ({ ...station }));
  mock.method(db, 'findSessionById', async () => ({ station_id: station.id }));
  mock.method(db, 'verifyWorkerToken', async (id, hash) => id === station.id && hash === createHash('sha256').update(workerToken).digest('hex'));
  mock.method(db, 'recordFinalizedVideo', async () => row.id);
  mock.method(db, 'createMobilePackingSessionTx', async () => ({ sessionId: video.sessionId, videoId: row.id }));
  mock.method(db, 'getBusinessGoogleDrive', async () => ({ connected: true, refreshToken: 'test-refresh', folderId: 'folder-1' }));
  mock.method(metadata, 'findVideo', async (id, bySession) => id === (bySession ? row.packing_session_id : row.id) ? { ...row } : null);
  mock.method(metadata, 'setDriveState', async (_id, _station, status) => { row.sync_status = status; });
  mock.method(metadata, 'reserveDriveId', async (_id, _station, id) => { row.drive_file_id ||= id; return row.drive_file_id; });
  mock.method(drive, 'refreshAccessToken', async () => 'test-access');
  mock.method(drive, 'getFileMetadata', async () => null);
  mock.method(drive, 'generateFileId', async () => 'generated-file-id');
  mock.method(drive, 'createResumableUpload', async () => 'https://www.googleapis.com/upload/drive/v3/files?upload_id=test-session');
});
afterEach(() => {
  mock.restoreAll();
  const resolved = path.resolve(root);
  assert.ok(resolved.startsWith(path.resolve(tmpdir()) + path.sep) && path.basename(resolved).startsWith('customer-storage-test-'));
  fs.rmSync(resolved, { recursive: true, force: true });
});
after(async () => { await app.close(); });

test('corrupt journal and sidecar do not block healthy video recovery', () => {
  store.enqueue(video);
  const broken = path.join(store.jobsDir, randomUUID() + '.json');
  fs.writeFileSync(broken, '{broken');
  const sidecar = path.join(store.archiveDir, 'broken.mp4.proof.json');
  fs.writeFileSync(sidecar, '{broken');
  const errors = mock.method(console, 'error', () => {});
  store.recoverSidecars(station.code);
  assert.equal(store.due().length, 1);
  assert.equal(errors.mock.callCount(), 2);
  assert.ok(fs.existsSync(broken));
  assert.ok(fs.existsSync(sidecar));
});

test('cloud cleanup refuses to delete customer video or metadata', async () => {
  const cleanup = mock.method(db, 'cleanupExpiredVideos', async () => { throw new Error('Must not delete'); });
  const response = await call('POST', '/api/v1/admin/storage/cleanup', { retentionDays: 1 });
  assert.equal(response.statusCode, 409);
  assert.equal(response.json().error.code, 'CUSTOMER_STORAGE_MANAGED_LOCALLY');
  assert.equal(cleanup.mock.callCount(), 0);
});

test('local queue survives process restart and preserves the original video', () => {
  store.enqueue(video);
  const reload = new LocalVideoStore(store.archiveDir, path.join(root, 'journal'));
  assert.equal(reload.due().length, 1);
  assert.equal(reload.get(video.sessionId).video.sha256, video.sha256);
  assert.deepEqual(fs.readFileSync(video.localPath), bytes);
});
test('archive reads reject traversal, unknown sessions and outside files', async () => {
  assert.throws(() => store.get('../../outside'));
  const outside = path.join(root, 'outside.mp4'); fs.writeFileSync(outside, 'private');
  assert.throws(() => store.enqueue({ ...video, localPath: outside }));
  await assert.rejects(store.handleRpc('FILE_READ', { sessionId: randomUUID(), offset: 0, length: 5 }));
  store.enqueue(video);
  await assert.rejects(store.handleRpc('FILE_READ', { sessionId: video.sessionId, offset: -1, length: 5 }));
  await assert.rejects(store.handleRpc('FILE_READ', { sessionId: video.sessionId, offset: 0, length: 1024 * 1024 }));
});
test('recovery finds camera proof sidecars after a crash before enqueue', () => {
  fs.writeFileSync(video.localPath + '.proof.json', JSON.stringify({ ...video, stationCode: station.code }));
  store.recoverSidecars(station.code);
  assert.equal(store.get(video.sessionId).video.filename, 'proof.mp4');
});
test('mobile upload resumes at the durable offset after restart and verifies SHA-256', async () => {
  const input = { ...video, filename: 'mobile.mp4', mobile: { userId: user.id, trackingCode: 'SPX12345678', orderCode: 'ORDER1', platform: 'SPX' } };
  assert.equal((await store.handleRpc('UPLOAD_BEGIN', input)).offset, 0);
  await store.handleRpc('UPLOAD_CHUNK', { sessionId: video.sessionId, offset: 0, data: bytes.subarray(0, 5).toString('base64') });
  store = new LocalVideoStore(store.archiveDir, path.join(root, 'journal'));
  assert.equal((await store.handleRpc('UPLOAD_BEGIN', input)).offset, 5);
  await store.handleRpc('UPLOAD_CHUNK', { sessionId: video.sessionId, offset: 5, data: bytes.subarray(5).toString('base64') });
  const saved = await store.handleRpc('UPLOAD_COMMIT', { sessionId: video.sessionId });
  assert.deepEqual(fs.readFileSync(saved.localPath), bytes);
  assert.equal(store.get(video.sessionId).registered, false);
  assert.equal((await store.handleRpc('UPLOAD_COMMIT', { sessionId: video.sessionId })).sha256, video.sha256);
});
test('mobile checksum mismatch never creates a completed archive entry', async () => {
  await store.handleRpc('UPLOAD_BEGIN', { ...video, filename: 'phone.mp4' });
  await store.handleRpc('UPLOAD_CHUNK', { sessionId: video.sessionId, offset: 0, data: Buffer.alloc(bytes.length).toString('base64') });
  await assert.rejects(store.handleRpc('UPLOAD_COMMIT', { sessionId: video.sessionId }), /checksum/);
  assert.equal(store.get(video.sessionId), null);
});
test('committed mobile file must still exist and match before acknowledging a retry', async () => {
  store.enqueue(video);
  fs.writeFileSync(video.localPath, 'changed');
  await assert.rejects(store.handleRpc('UPLOAD_COMMIT', { sessionId: video.sessionId }), /khớp/);
});
test('Drive queue records failure with backoff and never deletes the local original', async () => {
  store.enqueue(video);
  await new DriveSyncQueue(store, 'https://cloud.test', station.id, workerToken).tick();
  const job = store.get(video.sessionId);
  assert.equal(job.synced, false);
  assert.equal(job.attempts, 1);
  assert.ok(job.nextAttempt > Date.now());
  assert.ok(fs.existsSync(video.localPath));
});
test('Drive queue resumes bytes from Google range and acknowledges only verified completion', async () => {
  const job = store.enqueue(video);
  job.registered = true;
  job.uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?upload_id=test'; store.save(job);
  let completeCalls = 0, uploads = 0;
  mock.method(globalThis, 'fetch', async (url, options) => {
    if (String(url).includes('/drive-complete')) { completeCalls++; return json({ success: true, data: { synced: true } }); }
    if (options.headers['Content-Range'].startsWith('bytes */')) return new Response(null, { status: 308, headers: { Range: 'bytes=0-4' } });
    assert.equal(options.headers['Content-Range'], `bytes 5-${bytes.length - 1}/${bytes.length}`);
    assert.deepEqual(Buffer.from(options.body), bytes.subarray(5)); uploads++;
    return json({ id: 'drive-file-1' });
  });
  await new DriveSyncQueue(store, 'https://cloud.test', station.id, workerToken).tick();
  assert.equal(uploads, 1); assert.equal(completeCalls, 1);
  assert.equal(store.get(video.sessionId).synced, true);
  assert.ok(fs.existsSync(video.localPath));
});
test('expired resumable sessions are discarded so the next attempt requests a new session', async () => {
  const job = store.enqueue(video); job.registered = true;
  job.uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?upload_id=expired'; store.save(job);
  mock.method(globalThis, 'fetch', async url => String(url).includes('googleapis.com') ? json({}, 404) : json({ success: true }));
  await new DriveSyncQueue(store, 'https://cloud.test', station.id, workerToken).tick();
  assert.equal(store.get(video.sessionId).uploadUrl, undefined);
  assert.equal(store.get(video.sessionId).synced, false);
});
test('queue refuses changed local video before registering or uploading it', async () => {
  store.enqueue(video); fs.writeFileSync(video.localPath, 'tampered');
  await new DriveSyncQueue(store, 'https://cloud.test', station.id, workerToken).tick();
  assert.equal(store.get(video.sessionId).registered, false);
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});
test('queue rejects upload destinations outside Google', async () => {
  const job = store.enqueue(video); job.registered = true; job.uploadUrl = 'https://attacker.test/upload'; store.save(job);
  mock.method(globalThis, 'fetch', async url => {
    assert.ok(String(url).startsWith('https://cloud.test/')); return json({ success: true });
  });
  await new DriveSyncQueue(store, 'https://cloud.test', station.id, workerToken).tick();
  assert.equal(store.get(video.sessionId).synced, false);
});
test('worker storage routes require a station-bound secret', async () => {
  const unauth = await call('POST', '/api/v1/worker/videos/register', video);
  assert.equal(unauth.statusCode, 401);
  const bad = await call('POST', '/api/v1/worker/videos/register', video, { 'x-worker-station': randomUUID(), 'x-worker-token': workerToken });
  assert.equal(bad.statusCode, 401);
  const good = await call('POST', '/api/v1/worker/videos/register', video, { 'x-worker-station': station.id, 'x-worker-token': workerToken });
  assert.equal(good.statusCode, 200);
});
test('a worker cannot register another station session or synchronize another station video', async () => {
  mock.method(db, 'findSessionById', async () => ({ station_id: randomUUID() }));
  await assert.rejects(service.register(station.id, video), /không thuộc/);
  await assert.rejects(service.prepareDrive(randomUUID(), video.sessionId), /không thuộc/);
});
test('Drive broker returns only a scoped upload URI, never OAuth credentials', async () => {
  row.drive_file_id = null;
  const result = await service.prepareDrive(station.id, video.sessionId);
  assert.equal(result.synced, false);
  assert.ok(result.uploadUrl.includes('googleapis.com'));
  assert.ok(!JSON.stringify(result).includes('test-access'));
  assert.equal(row.sync_status, 'SYNCING');
});
test('Drive completion requires independently confirmed hash, size and ownership', async () => {
  for (const remote of [null, { ...remoteCopy(), sha256Checksum: '0'.repeat(64) }, { ...remoteCopy(), size: 1 }, { ...remoteCopy(), appProperties: { packingVideoId: 'another-video' } }]) {
    mock.method(drive, 'getFileMetadata', async () => remote);
    await assert.rejects(service.completeDrive(station.id, video.sessionId));
    assert.notEqual(row.sync_status, 'SYNCED');
  }
  mock.method(drive, 'getFileMetadata', async () => remoteCopy());
  await service.completeDrive(station.id, video.sessionId);
  assert.equal(row.sync_status, 'SYNCED');
});
test('lost Drive completion response is recovered without creating a duplicate upload', async () => {
  mock.method(drive, 'getFileMetadata', async () => remoteCopy());
  assert.equal((await service.prepareDrive(station.id, video.sessionId)).synced, true);
  assert.equal(drive.createResumableUpload.mock.callCount(), 0);
});
test('unlinked Drive leaves videos local and does not create upload sessions', async () => {
  mock.method(db, 'getBusinessGoogleDrive', async () => ({ connected: false }));
  await assert.rejects(service.prepareDrive(station.id, video.sessionId), /chưa liên kết/);
  assert.equal(drive.createResumableUpload.mock.callCount(), 0);
});
test('range parser handles suffix and open ranges and rejects malformed or out-of-bounds ranges', () => {
  assert.deepEqual(parseVideoRange('bytes=-5', 20), { start: 15, end: 19, partial: true });
  assert.deepEqual(parseVideoRange('bytes=5-', 20), { start: 5, end: 19, partial: true });
  for (const bad of ['bytes=20-', 'bytes=5-2', 'bytes=-0', 'bytes=-', 'bytes=0-1,3-4', 'garbage']) assert.throws(() => parseVideoRange(bad, 20));
});
test('video scope rejects another business and unassigned packing operators', () => {
  assert.equal(canReadVideo({ ...user, businessId: randomUUID() }, row), false);
  assert.equal(canReadVideo({ ...user, role: 'PACKING_USER', warehouseId: null }, row), false);
  assert.equal(canReadVideo(user, row), true);
});
test('video API and playback tickets reject anonymous and cross-tenant access', async () => {
  assert.equal((await app.inject(`/api/v1/videos/${row.id}/stream`)).statusCode, 401);
  mock.method(db, 'findUserById', async () => ({ ...user, businessId: randomUUID() }));
  assert.equal((await call('POST', `/api/v1/videos/${row.id}/playback`)).statusCode, 404);
  assert.equal((await call('GET', `/api/v1/videos/${row.id}`)).statusCode, 404);
});
test('playback ticket is limited to one video and cannot call normal APIs', () => {
  const ticket = AuthService.createPlaybackTicket(user.id, row.id);
  assert.equal(AuthService.verifyPlaybackTicket(ticket, row.id).sub, user.id);
  assert.throws(() => AuthService.verifyPlaybackTicket(ticket, randomUUID()));
  assert.throws(() => AuthService.verifyToken(ticket));
});
test('stream relays the exact requested bytes from worker without reading cloud paths', async () => {
  mock.method(gateway, 'isWorkerConnected', () => true);
  mock.method(gateway, 'requestStorage', async (_station, op, input) => op === 'FILE_STAT' ? { size: bytes.length } : { data: bytes.subarray(input.offset, input.offset + input.length).toString('base64') });
  row.local_path = '/not-on-cloud/no-video-file';
  const res = await call('GET', `/api/v1/videos/${row.id}/stream`, undefined, { range: 'bytes=2-8' });
  assert.equal(res.statusCode, 206);
  assert.deepEqual(res.rawPayload, bytes.subarray(2, 9));
  assert.equal(res.headers['cache-control'], 'private, no-store');
});
test('live user deactivation invalidates an already issued playback ticket', async () => {
  const ticket = AuthService.createPlaybackTicket(user.id, row.id);
  mock.method(db, 'findUserById', async () => ({ ...user, isActive: false }));
  assert.equal((await app.inject(`/api/v1/videos/${row.id}/stream?ticket=${ticket}`)).statusCode, 401);
});
test('offline warehouse falls back to verified Drive bytes without exposing credentials', async () => {
  row.sync_status = 'SYNCED';
  mock.method(gateway, 'isWorkerConnected', () => false);
  mock.method(drive, 'getFileMetadata', async () => remoteCopy());
  mock.method(drive, 'downloadRange', async () => new Response(bytes, { status: 206, headers: { 'content-length': String(bytes.length) } }));
  const res = await call('GET', `/api/v1/videos/${row.id}/stream`);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.rawPayload, bytes);
  assert.ok(!JSON.stringify(res.headers).includes('test-access'));
});
test('offline without a verified Drive copy produces a clear unavailable response', async () => {
  mock.method(gateway, 'isWorkerConnected', () => false);
  assert.equal((await call('POST', `/api/v1/videos/${row.id}/playback`)).statusCode, 503);
});
function multipart(uploadId = video.sessionId) {
  const boundary = 'test-boundary';
  const fields = { stationCode: station.code, trackingCode: 'SPXVN123456789', orderCode: 'ORDER1', duration: '2', uploadId };
  const pieces = Object.entries(fields).map(([name, value]) => Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  pieces.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="video"; filename="phone.mp4"\r\nContent-Type: video/mp4\r\n\r\n`), bytes, Buffer.from(`\r\n--${boundary}--\r\n`));
  return { body: Buffer.concat(pieces), headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } };
}
test('mobile upload is retained by the phone when warehouse is offline', async () => {
  mock.method(metadata, 'findVideo', async () => null);
  mock.method(gateway, 'isWorkerConnected', () => false);
  const form = multipart();
  const res = await call('POST', '/api/v1/mobile/upload', form.body, form.headers);
  assert.equal(res.statusCode, 503); assert.equal(res.json().purgeAllowed, false);
  assert.equal(db.createMobilePackingSessionTx.mock.callCount(), 0);
});
test('phone bytes travel through memory and are acknowledged only after worker disk verification', async () => {
  mock.method(metadata, 'findVideo', async () => null);
  mock.method(gateway, 'isWorkerConnected', () => true);
  mock.method(gateway, 'requestStorage', async (_station, operation, input) => store.handleRpc(operation, input));
  const form = multipart();
  const res = await call('POST', '/api/v1/mobile/upload', form.body, form.headers);
  assert.equal(res.statusCode, 200, res.body);
  assert.equal(res.json().purgeAllowed, true);
  assert.equal(res.json().storageOwner, 'WAREHOUSE');
  const stored = store.get(video.sessionId);
  assert.ok(stored.video.localPath.startsWith(store.archiveDir + path.sep));
  assert.deepEqual(fs.readFileSync(stored.video.localPath), bytes);
});
test('retry of already registered phone upload still requires a confirmed remaining copy', async () => {
  mock.method(gateway, 'isWorkerConnected', () => false);
  const form = multipart();
  const res = await call('POST', '/api/v1/mobile/upload', form.body, form.headers);
  assert.equal(res.statusCode, 503); assert.equal(res.json().purgeAllowed, false);
});
test('WebSocket storage relay correlates replies, rejects wrong credentials and cleans disconnects', async () => {
  store.enqueue(video);
  const wss = new WebSocketServer({ host: '127.0.0.1', port: 0, maxPayload: 2 * 1024 * 1024 });
  await once(wss, 'listening');
  wss.on('connection', ws => { void gateway.handleConnection(ws, station.id, workerToken); });
  const client = new WebSocket(`ws://127.0.0.1:${wss.address().port}`);
  let epoch;
  const ready = new Promise(resolve => client.on('message', async raw => {
    const msg = JSON.parse(raw.toString());
    if (msg.type === 'SERVER_HELLO_ACK') { epoch = msg.workerEpoch; resolve(); }
    if (msg.type === 'STORAGE_REQUEST') {
      const result = await store.handleRpc(msg.operation, msg.payload);
      client.send(JSON.stringify({ type: 'STORAGE_RESPONSE', requestId: msg.requestId, workerEpoch: epoch, success: true, data: result }));
    }
  }));
  try {
    await ready;
    const chunks = [];
    for await (const chunk of warehouseVideoStream(station.id, video.sessionId, 1, bytes.length - 2)) chunks.push(chunk);
    assert.deepEqual(Buffer.concat(chunks), bytes.subarray(1, bytes.length - 1));
    const wrong = { close: mock.fn() };
    await gateway.handleConnection(wrong, station.id, 'x'.repeat(64));
    assert.equal(wrong.close.mock.calls[0].arguments[0], 4001);
  } finally {
    client.close(); await once(client, 'close');
    await new Promise(resolve => wss.close(resolve));
  }
  assert.equal(gateway.isWorkerConnected(station.id), false);
});
