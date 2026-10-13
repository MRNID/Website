import assert from 'node:assert/strict';
import { test, before, beforeEach, afterEach, after, mock } from 'node:test';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

// Isolated API tests: no real database, Google account, camera or running server.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.GOOGLE_CLIENT_ID = 'test-client';
process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
process.env.GOOGLE_REDIRECT_URI = 'https://packing.example/api/v1/auth/google/callback';
process.env.ADMIN_WEB_URL = 'https://admin.example';
const { AuthService } = await import('../apps/backend-api/dist/auth/auth.service.js');
const { GoogleDriveService: drive } = await import('../apps/backend-api/dist/services/google-drive.service.js');
const { DatabaseRepository: repository } = await import('../packages/database/dist/index.js');
const { OAuthStateManager } = await import('../apps/backend-api/dist/auth/authorization.guard.js');
const { resolveBackendEndpoints } = await import('../packages/shared-utils/dist/backend-url.mjs');
const { createServer } = await import('../apps/backend-api/dist/main.js');
const require = createRequire(new URL('../apps/backend-api/package.json', import.meta.url));
const jwt = require('jsonwebtoken');
const user = { id: 'user-1', username: 'admin', role: 'ADMIN', businessId: 'biz-1', warehouseId: null, isActive: true };
const payload = { sub: user.id, username: user.username, role: user.role, businessId: user.businessId, warehouseId: null };
const connection = { connected: true, email: 'test@example.com', refreshToken: 'valid-refresh', folderId: 'folder-1', retentionDays: 30 };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
let app, dir, file;
before(async () => {
  app = await createServer();
  app.log.level = 'silent';
  dir = mkdtempSync(join(tmpdir(), 'packing-regression-'));
  file = join(dir, 'proof.webm');
  writeFileSync(file, 'fixture video bytes');
});
beforeEach(() => {
  mock.method(globalThis, 'fetch', async () => { throw new Error('simulated network failure'); });
  mock.method(repository, 'findUserById', async () => ({ ...user }));
  mock.method(repository, 'getBusinessGoogleDrive', async () => ({ ...connection }));
  mock.method(repository, 'recordAuditLog', async () => {});
});
afterEach(() => mock.restoreAll());
after(async () => {
  await app.close();
  unlinkSync(file);
  rmdirSync(dir);
});
function request(method, url, body, token = AuthService.generateTokens(payload).accessToken) {
  return app.inject({ method, url, payload: body, headers: { authorization: `Bearer ${token}`, accept: 'application/json' } });
}
function upload() {
  return drive.uploadVideo({ accessToken: 'valid-access', folderId: 'folder-1', filePath: file, filename: 'proof.webm' });
}

test('access and refresh tokens work only in their intended context', () => {
  const pair = AuthService.generateTokens(payload);
  assert.equal(AuthService.verifyToken(pair.accessToken).sub, user.id);
  assert.equal(AuthService.verifyRefreshToken(pair.refreshToken).sub, user.id);
  assert.throws(() => AuthService.verifyToken(pair.refreshToken));
  assert.throws(() => AuthService.verifyRefreshToken(pair.accessToken));
});
test('rejects legacy, expired and wrong-algorithm tokens', () => {
  for (const [claims, options] of [
    [payload, { expiresIn: '8h' }],
    [{ ...payload, tokenUse: 'access' }, { expiresIn: -1 }],
    [{ ...payload, tokenUse: 'access' }, { expiresIn: '8h', algorithm: 'HS384' }]
  ]) assert.throws(() => AuthService.verifyToken(jwt.sign(claims, process.env.JWT_SECRET, options)));
});
test('protected API rejects refresh token and accepts access token', async () => {
  const pair = AuthService.generateTokens(payload);
  assert.equal((await request('GET', '/api/v1/auth/me', undefined, pair.refreshToken)).statusCode, 401);
  assert.equal((await request('GET', '/api/v1/auth/me', undefined, pair.accessToken)).statusCode, 200);
});
test('refresh endpoint rejects access token and accepts refresh token', async () => {
  const pair = AuthService.generateTokens(payload);
  assert.equal((await request('POST', '/api/v1/auth/refresh', { refreshToken: pair.accessToken })).statusCode, 401);
  const res = await request('POST', '/api/v1/auth/refresh', { refreshToken: pair.refreshToken });
  assert.equal(res.statusCode, 200);
  assert.equal(AuthService.verifyToken(res.json().data.accessToken).sub, user.id);
});
test('locked users cannot refresh or call protected APIs', async () => {
  mock.method(repository, 'findUserById', async () => ({ ...user, isActive: false }));
  const pair = AuthService.generateTokens(payload);
  assert.equal((await request('POST', '/api/v1/auth/refresh', { refreshToken: pair.refreshToken })).statusCode, 401);
  assert.equal((await request('GET', '/api/v1/auth/me')).statusCode, 401);
});
test('startup rejects empty and previous demo JWT secrets', () => {
  for (const secret of ['', 'packing-video-proof-super-secure-jwt-secret-key-32chars']) {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', "await import('./apps/backend-api/dist/config.js')"], {
      cwd: new URL('../', import.meta.url), env: { ...process.env, JWT_SECRET: secret }, encoding: 'utf8'
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /JWT_SECRET must be/);
  }
});
test('OAuth network and HTTP errors never produce mock credentials', async () => {
  await assert.rejects(drive.exchangeCodeForTokens('code'), /network failure/);
  mock.method(globalThis, 'fetch', async () => json({ error: 'invalid_grant' }, 400));
  await assert.rejects(drive.exchangeCodeForTokens('code'), /invalid_grant/);
});
test('OAuth requires refresh credentials and confirmed account identity', async () => {
  mock.method(globalThis, 'fetch', async () => json({ access_token: 'valid-access' }));
  await assert.rejects(drive.exchangeCodeForTokens('code'));
  mock.method(globalThis, 'fetch', async url => String(url).includes('/token')
    ? json({ access_token: 'valid-access', refresh_token: 'valid-refresh' }) : json({}, 403));
  await assert.rejects(drive.exchangeCodeForTokens('code'), /xác nhận/);
});
test('OAuth returns only identity and credentials actually returned by Google', async () => {
  mock.method(globalThis, 'fetch', async url => String(url).includes('/token')
    ? json({ access_token: 'valid-access', refresh_token: 'valid-refresh' }) : json({ user: { emailAddress: 'confirmed@example.com' } }));
  const result = await drive.exchangeCodeForTokens('code');
  assert.equal(result.email, 'confirmed@example.com');
  assert.equal(result.refreshToken, 'valid-refresh');
});
test('legacy mock credentials are rejected before contacting Google', async () => {
  await assert.rejects(drive.refreshAccessToken('mock_refresh_token_old'));
  await assert.rejects(drive.ensureFolder('mock_access_token_old'));
  await assert.rejects(drive.uploadVideo({ accessToken: 'mock_access_token_old', folderId: 'folder', filePath: file, filename: 'proof.webm' }));
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});
test('folder lookup failure does not create a folder or report success', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => json({ error: 'denied' }, 403));
  await assert.rejects(drive.ensureFolder('valid-access'));
  assert.equal(fetchMock.mock.callCount(), 1);
});
test('folder creation requires a successful response and folder ID', async () => {
  for (const response of [json({}, 200), json({ error: 'denied' }, 403)]) {
    let calls = 0;
    mock.method(globalThis, 'fetch', async () => ++calls === 1 ? json({ files: [] }) : response);
    await assert.rejects(drive.ensureFolder('valid-access'));
  }
});
test('upload rejects missing files, failed requests and responses without a file ID', async () => {
  await assert.rejects(drive.uploadVideo({ accessToken: 'valid-access', folderId: 'folder', filePath: join(dir, 'missing.mp4'), filename: 'missing.mp4' }));
  for (const response of [json({ error: { message: 'quota exceeded' } }, 403), json({}), json({ id: 'mock_drive_file_old' })]) {
    mock.method(globalThis, 'fetch', async () => response);
    await assert.rejects(upload());
  }
});
test('upload sends actual bytes and returns a real file link', async () => {
  mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.ok(options.body.includes(Buffer.from('fixture video bytes')));
    assert.ok(options.body.includes(Buffer.from('Content-Type: video/webm')));
    return json({ id: 'real-file-id' });
  });
  assert.deepEqual(await upload(), { fileId: 'real-file-id', webViewLink: 'https://drive.google.com/file/d/real-file-id/view' });
});
test('instant-connect is disabled even outside production and never saves credentials', async () => {
  const save = mock.method(repository, 'saveBusinessGoogleDrive', async () => true);
  const res = await request('POST', '/api/v1/businesses/biz-1/google-drive/instant-connect', { email: 'test@example.com' });
  assert.equal(res.statusCode, 410);
  assert.equal(save.mock.callCount(), 0);
});
test('failed OAuth callback does not save a connection', async () => {
  const save = mock.method(repository, 'saveBusinessGoogleDrive', async () => true);
  const state = OAuthStateManager.generateState(user.businessId, user.id);
  const res = await request('GET', `/api/v1/auth/google/callback?code=test&state=${state}`);
  assert.equal(res.statusCode, 500);
  assert.equal(save.mock.callCount(), 0);
});
test('test-sync returns failure when Google upload fails', async () => {
  mock.method(globalThis, 'fetch', async url => String(url).includes('/token') ? json({ access_token: 'valid-access' }) : json({ error: { message: 'quota exceeded' } }, 403));
  const res = await request('POST', '/api/v1/businesses/biz-1/google-drive/test-sync', {});
  assert.equal(res.statusCode, 502);
  assert.equal(res.json().success, false);
});
test('test-sync reports actual file size and URL only after successful upload', async () => {
  mock.method(globalThis, 'fetch', async url => String(url).includes('/token') ? json({ access_token: 'valid-access' }) : json({ id: 'test-file-id' }));
  const res = await request('POST', '/api/v1/businesses/biz-1/google-drive/test-sync', {});
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().data.size, Buffer.byteLength('Packing Proof: Google Drive connection test.\n') + ' bytes');
  assert.equal(res.json().data.driveUrl, 'https://drive.google.com/file/d/test-file-id/view');
});
test('Drive credentials do not leak through status endpoint', async () => {
  const res = await request('GET', '/api/v1/businesses/biz-1/google-drive');
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().data.refreshToken, undefined);
  assert.ok(!res.body.includes(connection.refreshToken));
});
test('missing Google configuration fails instead of using embedded credentials', () => {
  const saved = process.env.GOOGLE_CLIENT_SECRET;
  try {
    delete process.env.GOOGLE_CLIENT_SECRET;
    assert.throws(() => drive.getAuthUrl('state'), /GOOGLE_CLIENT_SECRET/);
  } finally { process.env.GOOGLE_CLIENT_SECRET = saved; }
});
test('Google callback uses configured admin origin', () => {
  assert.equal(drive.adminReturnUrl, 'https://admin.example/tenants');
});
test('HTTP LAN and IPv6 backend URLs point to the server hosting the website', () => {
  assert.deepEqual(resolveBackendEndpoints('http://192.168.1.50:3001/#orders'), {
    apiBase: 'http://192.168.1.50:4000/api/v1', stationSocketUrl: 'ws://192.168.1.50:4000/ws/station'
  });
  assert.equal(resolveBackendEndpoints('http://[::1]:3001').apiBase, 'http://[::1]:4000/api/v1');
});
test('HTTPS reverse proxy and explicit backend origin use secure WebSocket URLs', () => {
  assert.deepEqual(resolveBackendEndpoints('https://packing.example'), {
    apiBase: 'https://packing.example/api/v1', stationSocketUrl: 'wss://packing.example/ws/station'
  });
  assert.equal(resolveBackendEndpoints('https://admin.example', 'https://api.example').stationSocketUrl, 'wss://api.example/ws/station');
});
