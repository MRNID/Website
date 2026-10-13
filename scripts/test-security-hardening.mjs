import { createRequire } from 'node:module';
import { getDbPool } from '../packages/database/dist/db-client.js';
import { AuthService } from '../apps/backend-api/dist/auth/auth.service.js';
import { StationGateway } from '../apps/backend-api/dist/websocket/station-gateway.js';
import { validateAndCleanBarcode } from '../packages/shared-utils/dist/barcode-validator.js';
import { computeNextStationCode } from '../packages/shared-utils/dist/station-sync.js';

const require = createRequire(import.meta.url);
const WebSocket = require('../apps/backend-api/node_modules/ws/index.js');

const API_BASE = 'http://localhost:4000/api/v1';
const WS_BASE = 'ws://localhost:4000/ws/station';

async function runSecuritySuite() {
  console.log('===============================================================');
  console.log('  SECURITY HARDENING VERIFICATION TEST SUITE (CODEX REVIEW)   ');
  console.log('===============================================================\n');

  const pool = await getDbPool();
  let passedCount = 0;
  let failedCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passedCount++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failedCount++;
    }
  }

  try {
    // 0. Query Station A and Users
    const stRes = await pool.request().query(`
      SELECT s.id, s.code, s.name, s.warehouse_id, w.business_id, b.name as biz_name
      FROM stations s
      JOIN warehouses w ON s.warehouse_id = w.id
      JOIN businesses b ON w.business_id = b.id
      WHERE s.code = 'PACK01'
    `);
    const stationA = stRes.recordset[0];
    if (!stationA) {
      throw new Error('Station PACK01 not found in database');
    }

    const saRes = await pool.request().query(`
      SELECT u.id, u.username, u.business_id, u.warehouse_id, r.name as role
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.username = 'admin'
    `);
    const superAdminUser = saRes.recordset[0];

    const packerARes = await pool.request().query(`
      SELECT u.id, u.username, u.business_id, u.warehouse_id, r.name as role
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.username = 'packer01'
    `);
    const packerAUser = packerARes.recordset[0];

    const packerBRes = await pool.request().query(`
      SELECT u.id, u.username, u.business_id, u.warehouse_id, r.name as role
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.username = 'packer_genz01'
    `);
    const packerBUser = packerBRes.recordset[0];

    // Ensure we have a valid station for Tenant B as well
    const stBRes = await pool.request().query(`
      SELECT TOP 1 s.id, s.code, s.name, s.warehouse_id, w.business_id
      FROM stations s
      JOIN warehouses w ON s.warehouse_id = w.id
      WHERE w.business_id = '${packerBUser.business_id}'
    `);
    let stationB = stBRes.recordset[0];
    if (!stationB) {
      const newStId = 'B1B2C3D4-E5F6-4A5B-8C9D-0E1F2A3B4C5D';
      await pool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM stations WHERE id = '${newStId}')
        INSERT INTO stations (id, warehouse_id, name, code, status)
        VALUES ('${newStId}', '${packerBUser.warehouse_id}', 'Trạm Tenant B', 'PACK_TENANT_B', 'OFFLINE')
      `);
      stationB = {
        id: newStId,
        code: 'PACK_TENANT_B',
        warehouse_id: packerBUser.warehouse_id,
        business_id: packerBUser.business_id
      };
    }

    // Generate valid tokens
    const tokenSuperAdmin = AuthService.generateTokens({
      sub: superAdminUser.id,
      username: superAdminUser.username,
      businessId: superAdminUser.business_id,
      warehouseId: superAdminUser.warehouse_id,
      role: superAdminUser.role
    }).accessToken;

    const tokenPackerA = AuthService.generateTokens({
      sub: packerAUser.id,
      username: packerAUser.username,
      businessId: packerAUser.business_id,
      warehouseId: packerAUser.warehouse_id,
      role: packerAUser.role
    }).accessToken;

    const tokenPackerB = AuthService.generateTokens({
      sub: packerBUser.id,
      username: packerBUser.username,
      businessId: packerBUser.business_id,
      warehouseId: packerBUser.warehouse_id,
      role: packerBUser.role
    }).accessToken;

    console.log(`[Config] Station A: ${stationA.code} (Business: ${stationA.biz_name}, ID: ${stationA.business_id})`);
    console.log(`[Config] User A: ${packerAUser.username} (Business: ${packerAUser.business_id})`);
    console.log(`[Config] User B: ${packerBUser.username} (Business: ${packerBUser.business_id})`);
    console.log(`[Config] Station B: ${stationB.code} (Business: ${stationB.business_id})\n`);

    // Helper: Upload file using native fetch & FormData
    async function uploadMobileFile({ token, stationCode, trackingCode, content, filename }) {
      const form = new FormData();
      if (stationCode !== undefined) form.append('stationCode', stationCode);
      if (trackingCode !== undefined) form.append('trackingCode', trackingCode);
      const blob = new Blob([content || 'mock video payload bytes for testing purpose'], { type: 'video/webm' });
      form.append('video', blob, filename || 'recording.webm');

      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/mobile/upload`, {
        method: 'POST',
        headers,
        body: form
      });

      let json = {};
      try {
        json = await res.json();
      } catch (_) {}

      return {
        statusCode: res.status,
        body: json
      };
    }

    // =========================================================================
    // SECTION 1: Mobile Upload Hardening
    // =========================================================================
    console.log('--- SECTION 1: MOBILE UPLOAD SECURITY ---');

    // 1.1 Anonymous Upload Rejected
    {
      const res = await uploadMobileFile({
        stationCode: 'PACK01',
        trackingCode: 'SPX123456789VN'
      });
      assert(res.statusCode === 401,
        `1.1 Anonymous upload rejected with HTTP 401 UNAUTHORIZED (got ${res.statusCode})`);
    }

    // 1.2 Invalid / Forged JWT Token Rejected
    {
      const res = await uploadMobileFile({
        token: 'invalid.forged.jwt',
        stationCode: 'PACK01',
        trackingCode: 'SPX123456789VN'
      });
      assert(res.statusCode === 401,
        `1.2 Forged JWT upload rejected with HTTP 401 UNAUTHORIZED (got ${res.statusCode}: ${res.body.error?.code})`);
    }

    // 1.3 Cross-Tenant Upload Rejected (User B -> Station A)
    {
      const res = await uploadMobileFile({
        token: tokenPackerB,
        stationCode: 'PACK01',
        trackingCode: 'SPX123456789VN'
      });
      assert(res.statusCode === 403 && res.body.error?.code === 'ACCESS_DENIED',
        `1.3 Cross-tenant upload rejected with HTTP 403 ACCESS_DENIED (got ${res.statusCode}: ${res.body.error?.message})`);
    }

    // 1.4 Path Traversal StationCode Attempt Rejected
    {
      const traversalCodes = ['../outside', '..\\traversal', '../../storage/secret', 'PACK01/../../'];
      let allBlocked = true;
      for (const badCode of traversalCodes) {
        const res = await uploadMobileFile({
          token: tokenPackerA,
          stationCode: badCode,
          trackingCode: 'SPX123456789VN'
        });
        if (res.statusCode !== 400 && res.statusCode !== 404) {
          allBlocked = false;
          console.error(`    Traversal attempt ${badCode} returned unexpected status: ${res.statusCode}`);
        }
      }
      assert(allBlocked, `1.4 Path traversal in stationCode strictly blocked (sanitized / rejected)`);
    }

    // 1.5 Invalid Tracking Barcode Rejected
    {
      const invalidBarcodes = ['123', 'short', '   ', 'SPX!@#$%', ''];
      let allRejected = true;
      for (const badBarcode of invalidBarcodes) {
        const res = await uploadMobileFile({
          token: tokenPackerA,
          stationCode: 'PACK01',
          trackingCode: badBarcode
        });
        if (res.statusCode !== 400 || res.body.error?.code !== 'INVALID_BARCODE_FORMAT') {
          allRejected = false;
          console.error(`    Bad barcode "${badBarcode}" returned: ${res.statusCode} ${res.body.error?.code}`);
        }
      }
      assert(allRejected, `1.5 Invalid tracking barcodes ('123', short, symbols) rejected with 400 INVALID_BARCODE_FORMAT`);
    }

    // 1.6 Authorized Valid Upload Succeeds and Stores Audit/UserId
    let uploadedSessionId = null;
    {
      const validCode = 'SPX' + Date.now().toString().slice(-8) + 'VN';
      const res = await uploadMobileFile({
        token: tokenPackerA,
        stationCode: 'PACK01',
        trackingCode: validCode
      });
      const passed = res.statusCode === 200 && res.body.success === true && !!res.body.sessionId;
      uploadedSessionId = res.body.sessionId;
      assert(passed, `1.6 Authorized mobile upload with valid barcode succeeded (Session: ${uploadedSessionId})`);

      if (passed) {
        const dbSess = await pool.request().input('id', uploadedSessionId).query(`
          SELECT id, user_id, station_id FROM packing_sessions WHERE id = @id
        `);
        const row = dbSess.recordset[0];
        assert(row && row.user_id === packerAUser.id,
          `1.6b Database session user_id matches authenticated user (${row?.user_id} === ${packerAUser.id})`);
        assert(row && row.station_id === stationA.id,
          `1.6c Database session station_id matches verified station (${row?.station_id} === ${stationA.id})`);
      }
    }

    // 1.7 [SH-R1-01] Mobile Workbench Station Lifecycle State Machine
    {
      // Phase 1: Mount with empty stations list -> activeStation must NOT be hardcoded 'PACK01'
      let activeStation = computeNextStationCode('', undefined, [], false);
      assert(activeStation === '',
        `1.7a [SH-R1-01] Initial mobile mount with empty stations list starts empty (got "${activeStation}", not "PACK01")`);

      // Phase 2: Asynchronous station load completes with PACK02 (a warehouse having only PACK02)
      const asyncStations = [
        { id: 'mock-pack02', code: 'PACK02', name: 'Trạm Đóng Gói 02' }
      ];
      activeStation = computeNextStationCode(activeStation, undefined, asyncStations, false);
      assert(activeStation === 'PACK02',
        `1.7b [SH-R1-01] Asynchronous station load dynamically transitions activeStationCode to "PACK02"`);

      // Phase 3: Multiple stations available, user manual selection is preserved
      const multiStations = [
        { id: 'mock-pack01', code: 'PACK01', name: 'Trạm 1' },
        { id: 'mock-pack02', code: 'PACK02', name: 'Trạm 2' },
        { id: 'mock-mobile01', code: 'MOBILE01', name: 'Trạm Mobile' }
      ];
      let userSelection = 'MOBILE01';
      activeStation = computeNextStationCode(userSelection, undefined, multiStations, false);
      assert(activeStation === 'MOBILE01',
        `1.7c [SH-R1-01] User selection "MOBILE01" preserved when stations list refreshes`);

      // Phase 4: Recording or uploading locks station switching mid-session
      const lockedStation = computeNextStationCode('PACK02', 'PACK01', multiStations, true);
      assert(lockedStation === 'PACK02',
        `1.7d [SH-R1-01] Station change strictly locked during active recording / uploading (kept "PACK02")`);
    }

    // 1.8 [SH-R1-01] Mobile Upload with Station Other than PACK01 (PACK02)
    {
      // Ensure PACK02 exists for Warehouse A in DB
      const pack02Id = 'D1E2F3A4-B5C6-4D7E-8F9A-0B1C2D3E4F5A';
      await pool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM stations WHERE code = 'PACK02' AND warehouse_id = '${stationA.warehouse_id}')
        INSERT INTO stations (id, warehouse_id, name, code, status)
        VALUES ('${pack02Id}', '${stationA.warehouse_id}', 'Trạm Đóng Gói 02 (Test)', 'PACK02', 'ACTIVE')
      `);
      const pack02Res = await pool.request().query(`
        SELECT id, code, warehouse_id FROM stations WHERE code = 'PACK02' AND warehouse_id = '${stationA.warehouse_id}'
      `);
      const stationPACK02 = pack02Res.recordset[0];

      const validCodePack02 = 'SPX' + Date.now().toString().slice(-8) + 'VN';
      const res = await uploadMobileFile({
        token: tokenPackerA,
        stationCode: 'PACK02',
        trackingCode: validCodePack02
      });

      const passed = res.statusCode === 200 && res.body.success === true && !!res.body.sessionId;
      assert(passed,
        `1.8a [SH-R1-01] Authorized mobile upload to station "PACK02" succeeded (Session: ${res.body.sessionId})`);

      if (passed) {
        const dbSess = await pool.request().input('id', res.body.sessionId).query(`
          SELECT id, user_id, station_id FROM packing_sessions WHERE id = @id
        `);
        const row = dbSess.recordset[0];
        assert(row && row.station_id === stationPACK02.id,
          `1.8b [SH-R1-01] Database session station_id matches PACK02 (${row?.station_id} === ${stationPACK02.id})`);
      }
    }

    // =========================================================================
    // SECTION 2: Station WebSocket Hardening & Multi-Tenant Isolation
    // =========================================================================
    console.log('\n--- SECTION 2: WEBSOCKET AUTHENTICATION & MULTI-TENANT ISOLATION ---');

    function connectWs(url) {
      return new Promise((resolve) => {
        const ws = new WebSocket(url);
        let settled = false;

        ws.on('open', () => {
          if (!settled) {
            settled = true;
            resolve({ ws, status: 101 });
          }
        });

        ws.on('unexpected-response', (req, res) => {
          if (!settled) {
            settled = true;
            resolve({ ws: null, status: res.statusCode });
          }
        });

        ws.on('error', (err) => {
          if (!settled) {
            settled = true;
            const status = err.message.includes('401') ? 401 : (err.message.includes('403') ? 403 : 0);
            resolve({ ws: null, error: err, status });
          }
        });
      });
    }

    // 2.1 Anonymous WebSocket Connection Handshake Rejected (401)
    {
      const res = await connectWs(`${WS_BASE}?stationCode=PACK01`);
      assert(res.status === 401, `2.1 Anonymous WebSocket connection rejected with HTTP 401 (got ${res.status})`);
      if (res.ws) res.ws.close();
    }

    // 2.2 Forged / Invalid Token Handshake Rejected (401)
    {
      const res = await connectWs(`${WS_BASE}?stationCode=PACK01&token=bad.token.signature`);
      assert(res.status === 401, `2.2 Forged JWT WebSocket connection rejected with HTTP 401 (got ${res.status})`);
      if (res.ws) res.ws.close();
    }

    // 2.3 Cross-Tenant WebSocket Subscription Rejected (403)
    {
      const res = await connectWs(`${WS_BASE}?stationCode=PACK01&token=${tokenPackerB}`);
      assert(res.status === 403, `2.3 Cross-tenant WebSocket connection rejected with HTTP 403 (got ${res.status})`);
      if (res.ws) res.ws.close();
    }

    // 2.4 Authorized WebSocket Connection Succeeds
    let clientA = null;
    {
      const res = await connectWs(`${WS_BASE}?stationCode=PACK01&token=${tokenPackerA}`);
      assert(res.status === 101 && res.ws !== null, `2.4 Authorized WebSocket handshake succeeds for PACK01`);
      clientA = res.ws;
    }

    // 2.5 Cross-Tenant Broadcast Isolation
    let clientB = null;
    {
      const res = await connectWs(`${WS_BASE}?stationCode=${stationB.code}&token=${tokenPackerB}`);
      assert(res.status === 101 && res.ws !== null, `2.5a Authorized WebSocket handshake succeeds for Station B (${stationB.code})`);
      clientB = res.ws;
    }

    if (clientA && clientB) {
      let clientAReceived = false;
      let clientBReceived = false;

      clientA.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'SESSION_STATE_CHANGED') {
            clientAReceived = true;
          }
        } catch (_) {}
      });

      clientB.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'SESSION_STATE_CHANGED') {
            clientBReceived = true;
          }
        } catch (_) {}
      });

      // Trigger a real session completion on Station A (PACK01) via mobile upload
      const testCode = 'SPX' + Date.now().toString().slice(-8) + 'VN';
      await uploadMobileFile({
        token: tokenPackerA,
        stationCode: 'PACK01',
        trackingCode: testCode
      });

      // Wait 800ms for event propagation through server WebSocket bus
      await new Promise(r => setTimeout(r, 800));

      assert(clientAReceived === true, `2.5b Client A (Station A) received the SESSION_STATE_CHANGED broadcast event`);
      assert(clientBReceived === false, `2.5c Client B (Station B / Tenant B) did NOT receive the event (Tenant isolated)`);
    }

    // 2.6 Active WebSocket Session Revocation on Account Deactivation / Permission Change
    if (clientA) {
      let closedCode = null;
      let closedReason = null;
      clientA.on('close', (code, reason) => {
        closedCode = code;
        closedReason = reason ? reason.toString() : '';
      });

      // Toggle user A to inactive via Admin API
      const lockRes = await fetch(`${API_BASE}/admin/users/${packerAUser.id}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${tokenSuperAdmin}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isActive: false })
      });
      const lockJson = await lockRes.json();
      assert(lockJson.success === true, `2.6a Admin API locked user ${packerAUser.username}`);

      // Wait 600ms for close frame
      await new Promise(r => setTimeout(r, 600));

      assert(closedCode === 4001, `2.6b Active WebSocket session terminated immediately with code 4001 upon lock (got code ${closedCode}, reason: "${closedReason}")`);

      // Restore user A to active
      await fetch(`${API_BASE}/admin/users/${packerAUser.id}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${tokenSuperAdmin}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isActive: true })
      });
      console.log(`  [Config] Restored user ${packerAUser.username} to active status.`);
    }

    if (clientB) clientB.close();

    // =========================================================================
    // SECTION 3: Barcode Validator Strict Rules Verification
    // =========================================================================
    console.log('\n--- SECTION 3: BARCODE VALIDATOR STRICTNESS ---');

    assert(validateAndCleanBarcode('123').isValid === false, `3.1 Short code '123' is rejected (isValid: false)`);
    assert(validateAndCleanBarcode('').isValid === false, `3.2 Empty string is rejected (isValid: false)`);
    assert(validateAndCleanBarcode('TEST12').isValid === true && validateAndCleanBarcode('TEST12').platform === 'OTHER', `3.3 Custom alphanumeric code >= 6 chars is valid OTHER`);
    assert(validateAndCleanBarcode('SPXVN1234567890').isValid === true && validateAndCleanBarcode('SPXVN1234567890').platform === 'SPX', `3.4 Shopee Express (SPX) format correctly identified`);
    assert(validateAndCleanBarcode('TEST CODE WITH SPACE').isValid === false, `3.5 Barcode with illegal spaces rejected`);

    // =========================================================================
    // SECTION 4: CODEX R1 FINDINGS VERIFICATION (SH-R1-01, SH-R1-02, SH-R1-03)
    // =========================================================================
    console.log('\n--- SECTION 4: CODEX R1 VERIFICATION (SH-R1-01, SH-R1-02, SH-R1-03) ---');

    // 4.1 SH-R1-01: Mobile upload without token returns 401
    {
      const res = await uploadMobileFile({
        stationCode: stationA.code,
        trackingCode: 'SPXVN' + Date.now().toString().slice(-8)
      });
      assert(res.statusCode === 401, `4.1 [SH-R1-01] Mobile upload missing Authorization header rejected with 401 UNAUTHORIZED`);
    }

    // 4.2 SH-R1-01: Mobile upload with token + stationCode succeeds
    {
      const validCode = 'SPXVN' + Date.now().toString().slice(-8);
      const res = await uploadMobileFile({
        token: tokenPackerA,
        stationCode: stationA.code,
        trackingCode: validCode
      });
      assert(res.statusCode === 200 && res.body.success === true,
        `4.2 [SH-R1-01] Mobile upload with Bearer token & dynamic stationCode (${stationA.code}) succeeds with 200 OK`);
    }

    // 4.3 SH-R1-02: Broadcast without scope or without businessId is strictly DROPPED
    {
      function createMockWs() {
        return {
          readyState: 1, // OPEN
          messages: [],
          send(str) { this.messages.push(JSON.parse(str)); },
          on() {},
          close() {}
        };
      }

      const mockWsTenantA = createMockWs();
      const mockWsTenantB = createMockWs();

      StationGateway.registerClient(mockWsTenantA, {
        userId: 'mock-user-a',
        username: 'mock_a',
        role: 'PACKING_USER',
        businessId: stationA.business_id,
        warehouseId: stationA.warehouse_id,
        subscribedStationId: stationA.id
      });

      StationGateway.registerClient(mockWsTenantB, {
        userId: 'mock-user-b',
        username: 'mock_b',
        role: 'PACKING_USER',
        businessId: packerBUser.business_id,
        warehouseId: stationB.warehouse_id,
        subscribedStationId: stationB.id
      });

      // Clear initial CONNECTION_AUTHENTICATED message
      mockWsTenantA.messages = [];
      mockWsTenantB.messages = [];

      // Test 4.3a: Unscoped broadcast dropped completely
      await StationGateway.broadcast('UNSCOPED_EVENT', { payload: 'leak' });
      assert(mockWsTenantA.messages.length === 0 && mockWsTenantB.messages.length === 0,
        `4.3a [SH-R1-02] Broadcast missing scope is dropped immediately (0 messages delivered across all tenants)`);

      // Test 4.3b: Partial scope missing businessId dropped completely
      await StationGateway.broadcast('PARTIAL_SCOPE_EVENT', { payload: 'leak' }, { warehouseId: 'wh-1' });
      assert(mockWsTenantA.messages.length === 0 && mockWsTenantB.messages.length === 0,
        `4.3b [SH-R1-02] Broadcast missing businessId is dropped immediately (0 messages delivered across all tenants)`);

      // Test 4.3c: SYNC_STATUS_CHANGED scoped by business, warehouse, station
      await StationGateway.broadcast('SYNC_STATUS_CHANGED', {
        videoId: 'vid-tenant-a-01',
        syncStatus: 'NAS_OK',
        stationId: stationA.id
      }, {
        businessId: stationA.business_id,
        warehouseId: stationA.warehouse_id,
        stationId: stationA.id
      });

      const tenantAReceivedSync = mockWsTenantA.messages.some(m => m.type === 'SYNC_STATUS_CHANGED');
      const tenantBReceivedSync = mockWsTenantB.messages.some(m => m.type === 'SYNC_STATUS_CHANGED');

      assert(tenantAReceivedSync === true, `4.3c [SH-R1-02] Client of Tenant A received SYNC_STATUS_CHANGED event`);
      assert(tenantBReceivedSync === false, `4.3d [SH-R1-02] Client of Tenant B did NOT receive Tenant A's SYNC_STATUS_CHANGED (Isolated)`);

      // Clean up mock clients
      StationGateway.revokeUser('mock-user-a');
      StationGateway.revokeUser('mock-user-b');
    }

    // 4.4 SH-R1-03: Operational roles without warehouse are rejected at WebSocket handshake
    {
      // Find or create an unassigned PACKING_USER (warehouse_id is null)
      let unassignedUserRes = await pool.request().query(`
        SELECT TOP 1 u.id, u.username, u.business_id, u.warehouse_id, r.name as role
        FROM users u
        INNER JOIN roles r ON u.role_id = r.id
        WHERE r.name = 'PACKING_USER' AND u.warehouse_id IS NULL AND u.is_active = 1
      `);
      let unassignedUser = unassignedUserRes.recordset[0];

      if (!unassignedUser) {
        const newUid = 'C8D9E0F1-A2B3-4C5D-6E7F-8A9B0C1D2E3F';
        await pool.request().query(`
          IF NOT EXISTS (SELECT 1 FROM users WHERE id = '${newUid}')
          INSERT INTO users (id, business_id, warehouse_id, username, password_hash, full_name, email, role_id, is_active)
          VALUES ('${newUid}', '${stationA.business_id}', NULL, 'unassigned_packer_test', 'hash', 'Unassigned Packer', 'unassigned@test.com', (SELECT id FROM roles WHERE name = 'PACKING_USER'), 1)
        `);
        unassignedUser = {
          id: newUid,
          username: 'unassigned_packer_test',
          business_id: stationA.business_id,
          warehouse_id: null,
          role: 'PACKING_USER'
        };
      }

      const tokenUnassigned = AuthService.generateTokens({
        sub: unassignedUser.id,
        username: unassignedUser.username,
        businessId: unassignedUser.business_id,
        warehouseId: null,
        role: unassignedUser.role
      }).accessToken;

      // Attempt live WebSocket handshake
      const wsRes = await connectWs(`${WS_BASE}?token=${tokenUnassigned}`);
      assert(wsRes.status === 403, `4.4a [SH-R1-03] Operational user with warehouseId: null rejected at WebSocket handshake with HTTP 403 Forbidden`);
      if (wsRes.ws) wsRes.ws.close();

      // In-memory gateway filter check: if client somehow had warehouseId: null, broadcast filters it out
      function createMockWs() {
        return {
          readyState: 1,
          messages: [],
          send(str) { this.messages.push(JSON.parse(str)); },
          on() {},
          close() {}
        };
      }
      const mockUnassigned = createMockWs();
      StationGateway.registerClient(mockUnassigned, {
        userId: unassignedUser.id,
        username: unassignedUser.username,
        role: 'PACKING_USER',
        businessId: unassignedUser.business_id,
        warehouseId: null,
        subscribedStationId: null
      });
      mockUnassigned.messages = [];

      await StationGateway.broadcast('SESSION_STATE_CHANGED', { status: 'RECORDING' }, {
        businessId: stationA.business_id,
        warehouseId: stationA.warehouse_id
      });

      assert(mockUnassigned.messages.length === 0,
        `4.4b [SH-R1-03] Operational client with warehouseId: null strictly blocked from receiving warehouse events`);
      StationGateway.revokeUser(unassignedUser.id);
    }

    console.log('\n===============================================================');
    console.log(`TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('===============================================================\n');

    process.exit(failedCount > 0 ? 1 : 0);

  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runSecuritySuite();
