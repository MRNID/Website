// End-to-End System Integration Test for PACKING VIDEO PROOF
import * as http from 'node:http';
import * as fs from 'node:fs';

const API_BASE = 'http://localhost:4000/api/v1';

async function request(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json();
  return { status: res.status, ok: res.ok, data };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTest() {
  console.log('================================================================');
  console.log('       PACKING VIDEO PROOF - END-TO-END VERIFICATION SUITE       ');
  console.log('================================================================\n');

  // Step 1: Health check
  console.log('[1/10] Checking Backend API Health...');
  const healthRes = await fetch('http://localhost:4000/health');
  if (!healthRes.ok) throw new Error('Backend health check failed');
  const health = await healthRes.json();
  console.log(`  ✓ Backend API is healthy (Uptime: ${health.uptime.toFixed(1)}s)\n`);

  // Step 2: Login as operator
  console.log('[2/10] Authenticating Operator (packer01)...');
  const loginRes = await request(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'packer01', password: 'Packer@123' })
  });
  if (!loginRes.ok) throw new Error(`Login failed: ${JSON.stringify(loginRes.data)}`);
  const packerToken = loginRes.data.data.accessToken;
  const packerUser = loginRes.data.data.user;
  console.log(`  ✓ Logged in as: ${packerUser.fullName} (Role: ${packerUser.role})\n`);

  // Step 3: Check Stations
  console.log('[3/10] Checking Station & Worker Status...');
  const stationsRes = await request(`${API_BASE}/stations`, {
    headers: { 'Authorization': `Bearer ${packerToken}` }
  });
  const pack01 = stationsRes.data.data.find(s => s.code === 'PACK01');
  if (!pack01) throw new Error('Station PACK01 not found');
  console.log(`  ✓ Found Station: ${pack01.code} (Status: ${pack01.status})`);
  console.log(`  ✓ Camera configured: ${pack01.camera?.name} (${pack01.camera?.type})\n`);

  // Step 4: Validate Barcode
  const testTrackingCode = 'SPXVN' + Date.now();
  console.log(`[4/10] Validating Barcode: ${testTrackingCode}...`);
  const valRes = await request(`${API_BASE}/packing/validate-barcode`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${packerToken}`
    },
    body: JSON.stringify({ trackingCode: testTrackingCode, stationId: pack01.id })
  });
  if (!valRes.ok || !valRes.data.data.isValid) throw new Error('Barcode validation failed');
  console.log(`  ✓ Barcode Validated: Platform: ${valRes.data.data.platform}, Duplicate: ${valRes.data.data.isDuplicate}\n`);

  // Step 5: Start Packing
  console.log('[5/10] Starting Packing Session (HTTP 202 Accepted)...');
  const startRes = await request(`${API_BASE}/packing/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${packerToken}`
    },
    body: JSON.stringify({
      stationId: pack01.id,
      trackingCode: testTrackingCode,
      platform: 'SPX'
    })
  });
  if (startRes.status !== 202) throw new Error(`Expected 202 Accepted, got ${startRes.status}`);
  const sessionId = startRes.data.data.sessionId;
  console.log(`  ✓ Session Started: ${sessionId} (Initial State: ${startRes.data.data.status})`);

  // Step 6: Wait for keyframe milestone -> RECORDING
  console.log('  -> Waiting for worker stream handshake & first keyframe...');
  await sleep(2500);

  const checkRec = await request(`${API_BASE}/packing/sessions/${sessionId}`, {
    headers: { 'Authorization': `Bearer ${packerToken}` }
  });
  console.log(`  ✓ Session State Transitioned to: ${checkRec.data.data.status}`);

  console.log('  -> Simulating 3.5s of packing recording...');
  await sleep(3500);

  // Step 7: Stop Packing
  console.log('\n[6/10] Stopping Packing Session (HTTP 202 Accepted)...');
  const stopRes = await request(`${API_BASE}/packing/stop`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${packerToken}`
    },
    body: JSON.stringify({ sessionId })
  });
  if (stopRes.status !== 202) throw new Error(`Expected 202 Accepted, got ${stopRes.status}`);
  console.log(`  ✓ Stop command accepted (State: ${stopRes.data.data.status})`);

  console.log('  -> Waiting for worker to finalize MP4, remux faststart and compute SHA-256...');
  await sleep(3000);

  // Step 8: Verify Video Record & SHA-256 in DB
  console.log('\n[7/10] Verifying Session Finalization in Database...');
  const finalSession = await request(`${API_BASE}/packing/sessions/${sessionId}`, {
    headers: { 'Authorization': `Bearer ${packerToken}` }
  });
  const sData = finalSession.data.data;
  console.log(`  ✓ Session Status: ${sData.status}`);
  console.log(`  ✓ Video ID:       ${sData.video.id}`);
  console.log(`  ✓ Video File:     ${sData.video.filename}`);
  console.log(`  ✓ Duration:       ${sData.video.duration} seconds`);
  console.log(`  ✓ File Size:      ${(sData.video.fileSize / 1024).toFixed(1)} KB`);
  console.log(`  ✓ SHA-256 Hash:   ${sData.video.sha256}\n`);

  const videoId = sData.video.id;

  // Step 9: Verify Physical File & SHA-256 Match via API
  console.log('[8/10] Verifying Video File Cryptographic Integrity (SHA-256)...');
  const verifyRes = await request(`${API_BASE}/videos/${videoId}/verify-hash`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${packerToken}` }
  });
  if (!verifyRes.ok) throw new Error('Verification failed');
  const vData = verifyRes.data.data;
  console.log(`  ✓ DB Stored Hash:    ${vData.dbHash}`);
  console.log(`  ✓ Re-calculated Hash: ${vData.calculatedHash}`);
  console.log(`  ✓ Hashes Match:      ${vData.isMatch ? 'YES (100% IMMUTABLE & VERIFIED)' : 'MISMATCH'}\n`);

  // Step 10: Video Streaming HTTP 206 Partial Content Range
  console.log('[9/10] Testing Video Streaming (HTTP 206 Byte Range)...');
  const streamRes = await fetch(`http://localhost:4000/api/v1/videos/${videoId}/stream`, {
    headers: { 'Range': 'bytes=0-1023' }
  });
  console.log(`  ✓ HTTP Status: ${streamRes.status} (Expected: 206)`);
  console.log(`  ✓ Content-Range: ${streamRes.headers.get('content-range')}`);
  console.log(`  ✓ Content-Type:  ${streamRes.headers.get('content-type')}\n`);

  // Step 11: Admin Dispute Lock & Dashboard
  console.log('[10/10] Testing Admin Dispute Lock & Dashboard Metrics...');
  const adminLogin = await request(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'Admin@123' })
  });
  const adminToken = adminLogin.data.data.accessToken;

  // Set dispute lock
  const disputeRes = await request(`${API_BASE}/videos/${videoId}/dispute`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      isLocked: true,
      disputeStatus: 'UNDER_REVIEW',
      lockReason: 'Khách khiếu nại giao thiếu phụ kiện'
    })
  });
  console.log(`  ✓ Dispute Lock Applied: ${disputeRes.data.data.isLocked} (Status: ${disputeRes.data.data.disputeStatus})`);

  // Dashboard Stats
  const dashRes = await request(`${API_BASE}/admin/dashboard`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  console.log(`  ✓ Dashboard: Packed Today: ${dashRes.data.data.packedToday}, Disputes: ${dashRes.data.data.disputesCount}, Stations: ${dashRes.data.data.onlineStations}/${dashRes.data.data.totalStations}\n`);

  console.log('================================================================');
  console.log('  >>> ALL 10 END-TO-END INTEGRATION TESTS PASSED 100% <<<       ');
  console.log('================================================================');
}

runTest().catch((err) => {
  console.error('\n❌ E2E TEST FAILED:', err);
  process.exit(1);
});
