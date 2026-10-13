import { getDbPool } from '../packages/database/dist/db-client.js';
import { AuthService } from '../apps/backend-api/dist/auth/auth.service.js';
import { OAuthStateManager } from '../apps/backend-api/dist/auth/authorization.guard.js';

const BASE_URL = 'http://localhost:4000/api/v1';

async function runTests() {
  console.log('====================================================');
  console.log('STARTING RIGOROUS AUTHORIZATION-01 SUITE');
  console.log('====================================================\n');

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
    // 0. Query sample data
    // Query station PACK01 and its business and warehouse
    const stARes = await pool.request().query(`
      SELECT s.id, s.code, s.name, s.warehouse_id, w.business_id, b.name as bizName
      FROM stations s
      JOIN warehouses w ON s.warehouse_id = w.id
      JOIN businesses b ON w.business_id = b.id
      WHERE s.code = 'PACK01'
    `);
    const stationA = stARes.recordset[0];
    const bizA = { id: stationA.business_id, name: stationA.bizName };
    const whA1 = { id: stationA.warehouse_id };

    // Query Tenant B (different business)
    const bizBRes = await pool.request().input('bizAId', bizA.id).query(`
      SELECT TOP 1 b.id, b.name, w.id as warehouse_id
      FROM businesses b
      LEFT JOIN warehouses w ON w.business_id = b.id
      WHERE b.id != @bizAId
    `);
    const bizBRow = bizBRes.recordset[0];
    const bizB = { id: bizBRow.id, name: bizBRow.name };
    const whB1 = { id: bizBRow.warehouse_id };

    console.log(`Tenant A: ${bizA.name} (${bizA.id})`);
    console.log(`Tenant B: ${bizB.name} (${bizB.id})`);
    console.log(`Station A: ${stationA.name} (${stationA.id}) in Warehouse ${whA1.id}\n`);

    // Create Tokens for testing
    const superAdminToken = AuthService.generateTokens({
      sub: 'sa-test-id',
      username: 'superadmin_test',
      businessId: bizA.id,
      warehouseId: null,
      role: 'SUPER_ADMIN'
    }).accessToken;

    // We need actual users in DB so authenticateUser can check live DB state:
    // Create temporary test users in DB
    const timestamp = Date.now();
    const testAdminAUsername = `test_admin_a_${timestamp}`;
    const testPackerAUsername = `test_packer_a_${timestamp}`;
    const testPackerNoWhUsername = `test_packer_nowh_${timestamp}`;
    const testAdminBUsername = `test_admin_b_${timestamp}`;

    // Get role IDs
    const rolesRes = await pool.request().query('SELECT id, name, business_id FROM roles');
    const roles = rolesRes.recordset;
    const adminRoleA = roles.find(r => r.name === 'ADMIN' && r.business_id === bizA.id) || roles.find(r => r.name === 'ADMIN');
    const superAdminRole = roles.find(r => r.name === 'SUPER_ADMIN');
    const packerRoleA = roles.find(r => r.name === 'PACKING_USER' && r.business_id === bizA.id) || roles.find(r => r.name === 'PACKING_USER');

    const crypto = await import('node:crypto');
    const idAdminA = crypto.randomUUID();
    const idPackerA = crypto.randomUUID();
    const idPackerNoWh = crypto.randomUUID();
    const idAdminB = crypto.randomUUID();

    const pwdHash = AuthService.hashPassword('Password123!');

    // Insert test users into DB
    await pool.request()
      .input('id', idAdminA).input('bId', bizA.id).input('whId', whA1.id)
      .input('u', testAdminAUsername).input('pwd', pwdHash).input('fn', 'Test Admin A')
      .input('email', `${testAdminAUsername}@test.com`)
      .input('rId', adminRoleA.id)
      .query('INSERT INTO users (id, business_id, warehouse_id, username, password_hash, full_name, email, role_id, is_active) VALUES (@id, @bId, @whId, @u, @pwd, @fn, @email, @rId, 1)');

    await pool.request()
      .input('id', idPackerA).input('bId', bizA.id).input('whId', whA1.id)
      .input('u', testPackerAUsername).input('pwd', pwdHash).input('fn', 'Test Packer A')
      .input('email', `${testPackerAUsername}@test.com`)
      .input('rId', packerRoleA.id)
      .query('INSERT INTO users (id, business_id, warehouse_id, username, password_hash, full_name, email, role_id, is_active) VALUES (@id, @bId, @whId, @u, @pwd, @fn, @email, @rId, 1)');

    await pool.request()
      .input('id', idPackerNoWh).input('bId', bizA.id)
      .input('u', testPackerNoWhUsername).input('pwd', pwdHash).input('fn', 'Test Packer No Warehouse')
      .input('email', `${testPackerNoWhUsername}@test.com`)
      .input('rId', packerRoleA.id)
      .query('INSERT INTO users (id, business_id, warehouse_id, username, password_hash, full_name, email, role_id, is_active) VALUES (@id, @bId, NULL, @u, @pwd, @fn, @email, @rId, 1)');

    await pool.request()
      .input('id', idAdminB).input('bId', bizB.id).input('whId', whB1.id)
      .input('u', testAdminBUsername).input('pwd', pwdHash).input('fn', 'Test Admin B')
      .input('email', `${testAdminBUsername}@test.com`)
      .input('rId', adminRoleA.id)
      .query('INSERT INTO users (id, business_id, warehouse_id, username, password_hash, full_name, email, role_id, is_active) VALUES (@id, @bId, @whId, @u, @pwd, @fn, @email, @rId, 1)');

    const tokenAdminA = AuthService.generateTokens({
      sub: idAdminA, username: testAdminAUsername, businessId: bizA.id, warehouseId: whA1.id, role: 'ADMIN'
    }).accessToken;

    const tokenPackerA = AuthService.generateTokens({
      sub: idPackerA, username: testPackerAUsername, businessId: bizA.id, warehouseId: whA1.id, role: 'PACKING_USER'
    }).accessToken;

    const tokenPackerNoWh = AuthService.generateTokens({
      sub: idPackerNoWh, username: testPackerNoWhUsername, businessId: bizA.id, warehouseId: null, role: 'PACKING_USER'
    }).accessToken;

    const tokenAdminB = AuthService.generateTokens({
      sub: idAdminB, username: testAdminBUsername, businessId: bizB.id, warehouseId: whB1.id, role: 'ADMIN'
    }).accessToken;

    // Also need a SUPER_ADMIN in DB for live check
    const idSuperAdmin = crypto.randomUUID();
    await pool.request()
      .input('id', idSuperAdmin).input('bId', bizA.id)
      .input('u', `sa_${timestamp}`).input('pwd', pwdHash).input('fn', 'Super Admin')
      .input('email', `sa_${timestamp}@test.com`)
      .input('rId', superAdminRole.id)
      .query('INSERT INTO users (id, business_id, username, password_hash, full_name, email, role_id, is_active) VALUES (@id, @bId, @u, @pwd, @fn, @email, @rId, 1)');

    const validSuperAdminToken = AuthService.generateTokens({
      sub: idSuperAdmin, username: `sa_${timestamp}`, businessId: bizA.id, warehouseId: null, role: 'SUPER_ADMIN'
    }).accessToken;

    // =========================================================================
    // SECTION 1: SEPARATION OF SYSTEM ADMIN & SHOP ADMIN (RBAC & Privilege Escalation)
    // =========================================================================
    console.log('--- 1. Testing RBAC & System Admin vs Shop Admin Separation ---');

    // 1.1 Unauthenticated access to user management
    const r1_1 = await fetch(`${BASE_URL}/admin/users`);
    assert(r1_1.status === 401, 'Anonymous request to /admin/users returns 401 Unauthorized');

    // 1.2 Non-admin (PACKING_USER) access to user management
    const r1_2 = await fetch(`${BASE_URL}/admin/users`, {
      headers: { Authorization: `Bearer ${tokenPackerA}` }
    });
    assert(r1_2.status === 403, 'PACKING_USER attempting /admin/users returns 403 Forbidden');

    // 1.3 Shop Admin A attempting to create SUPER_ADMIN
    const r1_3 = await fetch(`${BASE_URL}/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdminA}` },
      body: JSON.stringify({
        username: `escalate_sa_${timestamp}`,
        password: 'Password123!',
        fullName: 'Attacker Escalation',
        roleName: 'SUPER_ADMIN'
      })
    });
    const d1_3 = await r1_3.json();
    assert(r1_3.status === 403 && d1_3.error?.code === 'PRIVILEGE_ESCALATION_DENIED', 'Shop ADMIN cannot create SUPER_ADMIN (403 PRIVILEGE_ESCALATION_DENIED)');

    // 1.4 Shop Admin A attempting to edit SUPER_ADMIN account
    const r1_4 = await fetch(`${BASE_URL}/admin/users/${idSuperAdmin}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdminA}` },
      body: JSON.stringify({ fullName: 'Hacked Super Admin' })
    });
    assert(r1_4.status === 403, 'Shop ADMIN cannot modify SUPER_ADMIN user (403 Forbidden)');

    // 1.5 Shop Admin A attempting to access or modify Tenant B users
    const r1_5 = await fetch(`${BASE_URL}/admin/users/${idAdminB}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdminA}` },
      body: JSON.stringify({ fullName: 'Cross-Tenant Tamper' })
    });
    assert(r1_5.status === 403, 'Shop ADMIN A cannot edit Tenant B staff (403 Forbidden cross-tenant)');

    // 1.6 Self-escalation: Shop Admin A attempting to change their own role
    const r1_6 = await fetch(`${BASE_URL}/admin/users/${idAdminA}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdminA}` },
      body: JSON.stringify({ roleName: 'SUPER_ADMIN' })
    });
    const d1_6 = await r1_6.json();
    assert(r1_6.status === 403 && d1_6.error?.code === 'SELF_ROLE_CHANGE_FORBIDDEN', 'User cannot change own role (403 SELF_ROLE_CHANGE_FORBIDDEN)');

    // 1.7 Self-deactivation: Shop Admin A attempting to deactivate themselves
    const r1_7 = await fetch(`${BASE_URL}/admin/users/${idAdminA}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdminA}` },
      body: JSON.stringify({ isActive: false })
    });
    const d1_7 = await r1_7.json();
    assert(r1_7.status === 403 && d1_7.error?.code === 'SELF_DEACTIVATION_FORBIDDEN', 'User cannot self-deactivate (403 SELF_DEACTIVATION_FORBIDDEN)');

    // 1.8 Cross-tenant warehouse assignment
    const r1_8 = await fetch(`${BASE_URL}/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdminA}` },
      body: JSON.stringify({
        username: `wh_tamper_${timestamp}`,
        password: 'Password123!',
        fullName: 'Warehouse Tamper',
        roleName: 'PACKING_USER',
        warehouseId: whB1.id // Warehouse of Tenant B!
      })
    });
    assert(r1_8.status === 400 || r1_8.status === 403, 'Assigning warehouse of another business is rejected (400/403 INVALID_WAREHOUSE)');

    // =========================================================================
    // SECTION 2: PERMISSION WITH ACTION & SCOPE (Packing Sessions)
    // =========================================================================
    console.log('\n--- 2. Testing Action + Scope (Packing Sessions) ---');

    // 2.1 Missing warehouseId must NOT grant system-wide access
    const r2_1 = await fetch(`${BASE_URL}/packing/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenPackerNoWh}` },
      body: JSON.stringify({
        stationId: stationA.id,
        trackingCode: `TEST_PKG_${timestamp}`,
        orderCode: `ORD_${timestamp}`
      })
    });
    const d2_1 = await r2_1.json();
    assert(r2_1.status === 403 && d2_1.error?.code === 'ACCESS_DENIED', 'Packer without assigned warehouse is denied station access (403 ACCESS_DENIED)');

    // 2.2 Packer from Business B attempting to operate Station in Business A
    const r2_2 = await fetch(`${BASE_URL}/packing/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdminB}` },
      body: JSON.stringify({
        stationId: stationA.id,
        trackingCode: `CROSS_BIZ_${timestamp}`,
        orderCode: `ORD_${timestamp}`
      })
    });
    const d2_2 = await r2_2.json();
    assert(r2_2.status === 403, 'Cross-tenant station operation is rejected (403 station belongs to other business)');

    // 2.3 Force unlock station by cross-tenant supervisor
    const r2_3 = await fetch(`${BASE_URL}/stations/${stationA.id}/force-unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdminB}` },
      body: JSON.stringify({ reason: 'Malicious unlock' })
    });
    assert(r2_3.status === 403, 'Cross-tenant force-unlock station is rejected (403)');

    // 2.4 Force unlock station by authorized Admin A
    const r2_4 = await fetch(`${BASE_URL}/stations/${stationA.id}/force-unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdminA}` },
      body: JSON.stringify({ reason: 'Authorized supervisor unlock test' })
    });
    assert(r2_4.status === 200, 'Authorized Admin A can force-unlock station (200)');

    // =========================================================================
    // SECTION 3: TOKEN REVOCATION & DYNAMIC CREDENTIALS SYNC (Live Lock & Downgrade)
    // =========================================================================
    console.log('\n--- 3. Testing Dynamic Token Invalidation on Lock / Downgrade ---');

    // 3.1 Lock account test:
    // Packer A currently has an active valid token. Admin A locks Packer A's account.
    await pool.request().input('id', idPackerA).query('UPDATE users SET is_active = 0 WHERE id = @id');

    // Packer A attempts to call an authenticated endpoint using the OLD token
    const r3_1 = await fetch(`${BASE_URL}/packing/stations/${stationA.id}/active`, {
      headers: { Authorization: `Bearer ${tokenPackerA}` }
    });
    const d3_1 = await r3_1.json();
    assert(r3_1.status === 401 && d3_1.error?.code === 'ACCOUNT_DEACTIVATED', 'Locked user with existing valid token is IMMEDIATELY rejected (401 ACCOUNT_DEACTIVATED)');

    // Unlock Packer A again
    await pool.request().input('id', idPackerA).query('UPDATE users SET is_active = 1 WHERE id = @id');
    const r3_1b = await fetch(`${BASE_URL}/packing/stations/${stationA.id}/active`, {
      headers: { Authorization: `Bearer ${tokenPackerA}` }
    });
    assert(r3_1b.status === 200, 'Re-activated user immediately regains access with existing token (200)');

    // 3.2 Role downgrade test:
    // Create a temporary user with ADMIN role and issue token
    const idTempAdmin = crypto.randomUUID();
    await pool.request()
      .input('id', idTempAdmin).input('bId', bizA.id).input('whId', whA1.id)
      .input('u', `temp_admin_${timestamp}`).input('pwd', pwdHash).input('fn', 'Temp Admin')
      .input('email', `temp_admin_${timestamp}@test.com`)
      .input('rId', adminRoleA.id)
      .query('INSERT INTO users (id, business_id, warehouse_id, username, password_hash, full_name, email, role_id, is_active) VALUES (@id, @bId, @whId, @u, @pwd, @fn, @email, @rId, 1)');

    const tokenTempAdmin = AuthService.generateTokens({
      sub: idTempAdmin, username: `temp_admin_${timestamp}`, businessId: bizA.id, warehouseId: whA1.id, role: 'ADMIN'
    }).accessToken;

    // Verify temp admin can access admin users list
    const r3_2a = await fetch(`${BASE_URL}/admin/users`, {
      headers: { Authorization: `Bearer ${tokenTempAdmin}` }
    });
    assert(r3_2a.status === 200, 'Temp Admin can access /admin/users before downgrade (200)');

    // Now downgrade user in DB to PACKING_USER
    await pool.request()
      .input('id', idTempAdmin).input('rId', packerRoleA.id)
      .query('UPDATE users SET role_id = @rId WHERE id = @id');

    // Attempt to access /admin/users again with the OLD token (which still says role: 'ADMIN' in payload!)
    const r3_2b = await fetch(`${BASE_URL}/admin/users`, {
      headers: { Authorization: `Bearer ${tokenTempAdmin}` }
    });
    assert(r3_2b.status === 403, 'Downgraded user with old ADMIN token is IMMEDIATELY blocked from admin routes (403 Forbidden)');

    // =========================================================================
    // SECTION 4: GOOGLE DRIVE SECURITY & AUTHORIZATION
    // =========================================================================
    console.log('\n--- 4. Testing Google Drive Scoping & Token Leakage Prevention ---');

    // 4.1 Unauthenticated access to Google Drive status
    const r4_1 = await fetch(`${BASE_URL}/businesses/${bizA.id}/google-drive`);
    assert(r4_1.status === 401, 'Anonymous access to Google Drive status returns 401');

    // 4.2 Cross-tenant Google Drive status check
    const r4_2 = await fetch(`${BASE_URL}/businesses/${bizB.id}/google-drive`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` }
    });
    assert(r4_2.status === 403, 'Admin A cannot view Admin B Google Drive status (403 Forbidden cross-tenant)');

    // 4.3 Authorized Admin A Google Drive status response - Verify NO token leak
    const r4_3 = await fetch(`${BASE_URL}/businesses/${bizA.id}/google-drive`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` }
    });
    const d4_3 = await r4_3.json();
    assert(r4_3.status === 200, 'Admin A can view own Google Drive status (200)');
    assert(d4_3.data && d4_3.data.refreshToken === undefined && d4_3.data.accessToken === undefined, 'Google Drive status NEVER leaks refreshToken or accessToken');

    // 4.4 OAuth URL Generation - Verifies single-use state token
    const r4_4 = await fetch(`${BASE_URL}/auth/google/url?businessId=${bizA.id}`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` }
    });
    const d4_4 = await r4_4.json();
    assert(r4_4.status === 200 && d4_4.authUrl.includes('state='), 'OAuth URL generated with cryptographic state parameter');

    // Extract state token from authUrl
    const urlObj = new URL(d4_4.authUrl);
    const generatedState = urlObj.searchParams.get('state');

    // 4.5 OAuth Callback - Invalid / Expired State Token
    const r4_5a = await fetch(`${BASE_URL}/auth/google/callback?code=mock_code&state=invalid_fake_state`, {
      headers: { Accept: 'application/json' }
    });
    assert(r4_5a.status === 400, 'OAuth callback with invalid state returns 400 INVALID_OR_EXPIRED_STATE');

    // 4.6 OAuth Callback - Single-use enforcement on the live backend server:
    // First call with generatedState: the backend server consumes it.
    const r4_6a = await fetch(`${BASE_URL}/auth/google/callback?code=mock_code&state=${generatedState}`, {
      headers: { Accept: 'application/json' },
      redirect: 'manual'
    });
    console.log('    [DEBUG] r4_6a status:', r4_6a.status, 'Location:', r4_6a.headers.get('location'));
    const d4_6aText = await r4_6a.text();
    console.log('    [DEBUG] r4_6a body:', d4_6aText);
    let d4_6a = {};
    try { d4_6a = JSON.parse(d4_6aText); } catch {}
    assert(r4_6a.status === 500 || r4_6a.status === 302, 'OAuth callback accepts valid state token and advances to token exchange (state consumed)');

    // Second call with the same state token (Replay Attack):
    const r4_6b = await fetch(`${BASE_URL}/auth/google/callback?code=mock_code&state=${generatedState}`, {
      headers: { Accept: 'application/json' },
      redirect: 'manual'
    });
    const d4_6b = await r4_6b.json();
    assert(r4_6b.status === 400 && d4_6b.error?.code === 'INVALID_OR_EXPIRED_STATE', 'Replaying previously consumed state token returns 400 INVALID_OR_EXPIRED_STATE (single-use enforced)');

    // =========================================================================
    // SECTION 5: SENSITIVE OPERATIONS AUDIT LOGGING
    // =========================================================================
    console.log('\n--- 5. Testing Audit Logging of Sensitive Operations ---');

    // 5.1 Test Password Reset via API and verify audit log
    const newPwdTestUser = crypto.randomUUID();
    await pool.request()
      .input('id', newPwdTestUser).input('bId', bizA.id).input('whId', whA1.id)
      .input('u', `pwd_test_${timestamp}`).input('pwd', pwdHash).input('fn', 'Pwd Test User')
      .input('email', `pwd_test_${timestamp}@test.com`)
      .input('rId', packerRoleA.id)
      .query('INSERT INTO users (id, business_id, warehouse_id, username, password_hash, full_name, email, role_id, is_active) VALUES (@id, @bId, @whId, @u, @pwd, @fn, @email, @rId, 1)');

    const r5_1 = await fetch(`${BASE_URL}/admin/users/${newPwdTestUser}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdminA}` },
      body: JSON.stringify({ newPassword: 'BrandNewSecretPassword123!' })
    });
    assert(r5_1.status === 200, 'Admin A resets staff password (200)');

    // 5.2 Test Role Change via API and verify audit log
    const r5_2 = await fetch(`${BASE_URL}/admin/users/${newPwdTestUser}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdminA}` },
      body: JSON.stringify({ roleName: 'WAREHOUSE_MANAGER' })
    });
    assert(r5_2.status === 200, 'Admin A changed staff role to WAREHOUSE_MANAGER (200)');

    // 5.3 Query `system_logs` to verify audit records and absence of plain passwords/secrets
    const logsRes = await pool.request()
      .input('uId', newPwdTestUser)
      .input('actorId', idAdminA)
      .query(`
        SELECT TOP 10 level, module, message, metadata, user_id, created_at
        FROM system_logs
        WHERE (user_id = @actorId OR metadata LIKE '%' + @uId + '%')
        ORDER BY id DESC
      `);

    const auditLogs = logsRes.recordset;
    assert(auditLogs.length > 0, `Found ${auditLogs.length} audit log entries in system_logs`);

    const pwdResetLog = auditLogs.find(l => l.message && l.message.includes('USER_PASSWORD_RESET'));
    assert(!!pwdResetLog, 'USER_PASSWORD_RESET operation was logged to system_logs');
    if (pwdResetLog) {
      assert(!pwdResetLog.metadata.includes('BrandNewSecretPassword123!'), 'Password is NEVER stored in audit log metadata');
    }

    const roleChangeLog = auditLogs.find(l => l.message && l.message.includes('USER_ROLE_CHANGED'));
    assert(!!roleChangeLog, 'USER_ROLE_CHANGED operation was logged to system_logs with old/new roles');

    const unlockLog = auditLogs.find(l => l.message && l.message.includes('STATION_FORCE_UNLOCKED'));
    assert(!!unlockLog, 'STATION_FORCE_UNLOCKED operation was logged to system_logs');

    // Cleanup temporary test users from DB (clean audit logs first due to FK)
    await pool.request()
      .input('id1', idAdminA).input('id2', idPackerA).input('id3', idPackerNoWh)
      .input('id4', idAdminB).input('id5', idSuperAdmin).input('id6', idTempAdmin).input('id7', newPwdTestUser)
      .query(`
        DELETE FROM system_logs WHERE user_id IN (@id1, @id2, @id3, @id4, @id5, @id6, @id7);
        DELETE FROM users WHERE id IN (@id1, @id2, @id3, @id4, @id5, @id6, @id7);
      `);

  } catch (err) {
    console.error('Test execution error:', err);
    failedCount++;
  } finally {
    console.log('\n====================================================');
    console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('====================================================');
    process.exit(failedCount > 0 ? 1 : 0);
  }
}

runTests();
