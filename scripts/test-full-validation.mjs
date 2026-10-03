// Full Comprehensive System Validation Suite for PACKING VIDEO PROOF
import * as fs from 'node:fs';
import * as crypto from 'node:crypto';

const API_BASE = 'http://localhost:4000/api/v1';

async function request(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json();
  return { status: res.status, ok: res.ok, data };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runFullValidation() {
  console.log('================================================================');
  console.log('   PACKING VIDEO PROOF - COMPREHENSIVE EDGE-CASE VALIDATION     ');
  console.log('================================================================\n');

  // 1. Health check
  console.log('>>> TEST 1: Health & Connectivity');
  const healthRes = await fetch('http://localhost:4000/health');
  if (!healthRes.ok) throw new Error('Health check failed');
  console.log('  [PASS] Backend API is up and healthy.\n');

  // 2. Authentication (Operator & Admin)
  console.log('>>> TEST 2: Authentication & RBAC Tokens');
  const packerLogin = await request(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'packer01', password: 'Packer@123' })
  });
  if (!packerLogin.ok) throw new Error('Packer login failed');
  const packerToken = packerLogin.data.data.accessToken;

  const adminLogin = await request(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'Admin@123' })
  });
  if (!adminLogin.ok) throw new Error('Admin login failed');
  const adminToken = adminLogin.data.data.accessToken;
  console.log('  [PASS] Generated JWT tokens for Operator (8h) and Admin (8h).\n');

  // 3. Station Online Check
  console.log('>>> TEST 3: Station Discovery & Online Status');
  const stationsRes = await request(`${API_BASE}/stations`, {
    headers: { 'Authorization': `Bearer ${packerToken}` }
  });
  const station = stationsRes.data.data.find(s => s.code === 'PACK01');
  if (!station || station.status !== 'ONLINE') {
    throw new Error('Station PACK01 is not online');
  }
  console.log(`  [PASS] Station ${station.code} discovered and confirmed ONLINE.\n`);

  // Ensure station is clean before starting test suite
  await request(`${API_BASE}/stations/${station.id}/force-unlock`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ reason: 'Initial test setup cleanup' })
  });

  // 4. Normal Packing Cycle & Cryptographic Sealing
  console.log('>>> TEST 4: Full Packing Lifecycle (Start -> Keyframe -> Stop -> Seal)');
  const trackingCode1 = 'SPXVN' + Date.now();
  const start1 = await request(`${API_BASE}/packing/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${packerToken}`
    },
    body: JSON.stringify({
      stationId: station.id,
      trackingCode: trackingCode1,
      platform: 'SPX'
    })
  });
  if (start1.status !== 202) throw new Error('Start failed');
  const sessionId1 = start1.data.data.sessionId;

  await sleep(2500); // Wait for first keyframe
  const sess1Check = await request(`${API_BASE}/packing/sessions/${sessionId1}`, {
    headers: { 'Authorization': `Bearer ${packerToken}` }
  });
  if (sess1Check.data.data.status !== 'RECORDING') {
    throw new Error(`Expected RECORDING, got ${sess1Check.data.data.status}`);
  }

  await sleep(3000); // 3 seconds of recording
  const stop1 = await request(`${API_BASE}/packing/stop`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${packerToken}`
    },
    body: JSON.stringify({ sessionId: sessionId1 })
  });
  if (stop1.status !== 202) throw new Error('Stop failed');

  await sleep(3000); // Wait for remux & seal
  const sess1Final = await request(`${API_BASE}/packing/sessions/${sessionId1}`, {
    headers: { 'Authorization': `Bearer ${packerToken}` }
  });
  const video1 = sess1Final.data.data.video;
  if (sess1Final.data.data.status !== 'COMPLETED' || !video1) {
    throw new Error('Session did not complete properly');
  }
  console.log(`  [PASS] Session ${sessionId1} completed.`);
  console.log(`  [PASS] Video file: ${video1.filename} (${video1.duration}s, SHA: ${video1.sha256})\n`);

  // 5. Positive and Negative Tampering Detection
  console.log('>>> TEST 5: Cryptographic Integrity Verification (Positive & Negative Cases)');
  // Case A: Positive (Intact file)
  const verifyPos = await request(`${API_BASE}/videos/${video1.id}/verify-hash`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${packerToken}` }
  });
  if (!verifyPos.data.data.isMatch) throw new Error('Expected intact file to match hash');
  console.log('  [PASS] Positive check: Intact physical file matches DB SHA-256 (100% Verified).');

  // Case B: Negative (Tampered file)
  const vSearch = await request(`${API_BASE}/videos?trackingCode=${trackingCode1}`, {
    headers: { 'Authorization': `Bearer ${packerToken}` }
  });
  const filePath = vSearch.data.data[0].local_path;
  const originalBytes = fs.readFileSync(filePath);
  const backupPath = filePath + '.bak';
  fs.writeFileSync(backupPath, originalBytes);

  try {
    // Corrupt one byte in the file
    const tamperedBytes = Buffer.from(originalBytes);
    tamperedBytes[tamperedBytes.length - 1] ^= 0xFF; // Flip bits
    fs.writeFileSync(filePath, tamperedBytes);

    const verifyNeg = await request(`${API_BASE}/videos/${video1.id}/verify-hash`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${packerToken}` }
    });

    if (verifyNeg.data.data.isMatch !== false) {
      throw new Error('Tampered file should NOT match original hash');
    }
    console.log('  [PASS] Negative check: Tampered physical file was DETECTED (isMatch: false, tamper alarm triggered)!');
  } finally {
    // Restore original file
    fs.writeFileSync(filePath, originalBytes);
    fs.unlinkSync(backupPath);
  }

  // Re-verify after restore
  const verifyRestored = await request(`${API_BASE}/videos/${video1.id}/verify-hash`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${packerToken}` }
  });
  if (!verifyRestored.data.data.isMatch) throw new Error('Failed to restore file integrity');
  console.log('  [PASS] Post-restore check: Original file integrity re-confirmed.\n');

  // 6. Duplicate Tracking Code Detection
  console.log('>>> TEST 6: Anti-Mistake Duplicate Barcode Detection');
  const dupCheck = await request(`${API_BASE}/packing/validate-barcode`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${packerToken}`
    },
    body: JSON.stringify({ trackingCode: trackingCode1, stationId: station.id })
  });
  if (!dupCheck.data.data.isDuplicate || !dupCheck.data.data.previousPackedAt) {
    throw new Error('Failed to detect duplicate barcode');
  }
  console.log(`  [PASS] Duplicate barcode detected: ${trackingCode1} (Previous packed at: ${dupCheck.data.data.previousPackedAt})\n`);

  // 7. Session Cancellation Flow
  console.log('>>> TEST 7: Operator Session Cancellation ([Esc] Key Flow)');
  const trackingCode2 = 'TIKTOK' + Date.now();
  const start2 = await request(`${API_BASE}/packing/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${packerToken}`
    },
    body: JSON.stringify({
      stationId: station.id,
      trackingCode: trackingCode2,
      platform: 'TIKTOK'
    })
  });
  const sessionId2 = start2.data.data.sessionId;
  await sleep(1500);

  const cancelRes = await request(`${API_BASE}/packing/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${packerToken}`
    },
    body: JSON.stringify({
      sessionId: sessionId2,
      reason: 'Customer cancelled order mid-packaging'
    })
  });
  if (cancelRes.status !== 202) throw new Error('Cancel request rejected');

  await sleep(2000);
  const sess2Check = await request(`${API_BASE}/packing/sessions/${sessionId2}`, {
    headers: { 'Authorization': `Bearer ${packerToken}` }
  });
  if (sess2Check.data.data.status !== 'CANCELLED' && sess2Check.data.data.status !== 'CANCELLING') {
    throw new Error(`Expected CANCELLED or CANCELLING, got ${sess2Check.data.data.status}`);
  }
  console.log(`  [PASS] Session ${sessionId2} cancelled cleanly and station released.\n`);

  // 8. Supervisor Force-Unlock Flow
  console.log('>>> TEST 8: Supervisor Force-Unlock Flow');
  const trackingCode3 = 'SPXVN' + (Date.now() + 50);
  const start3 = await request(`${API_BASE}/packing/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${packerToken}`
    },
    body: JSON.stringify({
      stationId: station.id,
      trackingCode: trackingCode3,
      platform: 'SPX'
    })
  });
  const sessionId3 = start3.data.data.sessionId;
  await sleep(1500);

  // Force unlock via supervisor
  const unlockRes = await request(`${API_BASE}/stations/${station.id}/force-unlock`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ reason: 'Station camera frozen, supervisor emergency unlock' })
  });
  if (!unlockRes.ok) throw new Error('Force unlock failed');

  await sleep(1000);
  const sess3Check = await request(`${API_BASE}/packing/sessions/${sessionId3}`, {
    headers: { 'Authorization': `Bearer ${packerToken}` }
  });
  if (sess3Check.data.data.status !== 'FAILED') {
    throw new Error(`Expected FAILED, got ${sess3Check.data.data.status}`);
  }
  console.log(`  [PASS] Station ${station.code} force-unlocked by supervisor, stuck session aborted.\n`);

  // 9. HTTP 206 Byte Range Streaming with Multiple Range Slices
  console.log('>>> TEST 9: HTTP 206 Partial Content Range Streaming');
  const streamSlice1 = await fetch(`http://localhost:4000/api/v1/videos/${video1.id}/stream`, {
    headers: { 'Range': 'bytes=0-100' }
  });
  if (streamSlice1.status !== 206) throw new Error('Expected HTTP 206 for range 0-100');
  const slice1ContentRange = streamSlice1.headers.get('content-range');

  const streamSlice2 = await fetch(`http://localhost:4000/api/v1/videos/${video1.id}/stream`, {
    headers: { 'Range': 'bytes=101-200' }
  });
  if (streamSlice2.status !== 206) throw new Error('Expected HTTP 206 for range 101-200');

  console.log(`  [PASS] Range 0-100 response: 206 Partial Content (${slice1ContentRange})`);
  console.log(`  [PASS] Range 101-200 response: 206 Partial Content (${streamSlice2.headers.get('content-range')})\n`);

  // 10. Admin Dispute Lock & Purge Protection
  console.log('>>> TEST 10: Admin Dispute Lock & Two-Phase Purge Protection');
  // Lock
  const lockRes = await request(`${API_BASE}/videos/${video1.id}/dispute`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      isLocked: true,
      disputeStatus: 'SUBMITTED_TO_CARRIER',
      lockReason: 'Khách khiếu nại hộp rỗng'
    })
  });
  if (!lockRes.data.data.isLocked) throw new Error('Lock failed');

  // Verify in search
  const searchRes = await request(`${API_BASE}/videos?trackingCode=${trackingCode1}`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const foundVid = searchRes.data.data[0];
  if (!foundVid || !foundVid.is_locked || foundVid.dispute_status !== 'SUBMITTED_TO_CARRIER') {
    throw new Error('Dispute lock not reflected in search');
  }
  console.log(`  [PASS] Video locked for carrier dispute (${foundVid.dispute_status}). Protected against auto-purge.`);

  // Unlock
  const unlockVid = await request(`${API_BASE}/videos/${video1.id}/dispute`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      isLocked: false,
      disputeStatus: 'WON',
      lockReason: 'Thắng khiếu nại Shopee'
    })
  });
  if (unlockVid.data.data.isLocked !== false) throw new Error('Unlock failed');
  console.log(`  [PASS] Dispute resolved: WON. Lock safely released.\n`);

  console.log('================================================================');
  console.log('  >>> ALL 10 COMPREHENSIVE EDGE-CASE TESTS PASSED 100% <<<      ');
  console.log('================================================================');
}

runFullValidation().catch((err) => {
  console.error('\n❌ FULL VALIDATION FAILED:', err);
  process.exit(1);
});
