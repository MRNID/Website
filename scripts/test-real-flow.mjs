async function testWorkflow() {
  console.log('1. Logging in as packer01...');
  const authRes = await fetch('http://localhost:4000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'packer01', password: 'Packer@123' })
  });
  const auth = await authRes.json();
  const token = auth.data.accessToken;

  console.log('2. Fetching stations...');
  const stRes = await fetch('http://localhost:4000/api/v1/stations', {
    headers: { Authorization: 'Bearer ' + token }
  });
  const stData = await stRes.json();
  const station = stData.data[0];
  console.log('Station:', station.name, 'Camera RTSP:', station.camera?.rtspUrl);

  // Clear any hung active session on this station using admin credentials
  try {
    const adminAuthRes = await fetch('http://localhost:4000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'Admin@123' })
    });
    const adminAuth = await adminAuthRes.json();
    const adminToken = adminAuth.data.accessToken;

    const unlockRes = await fetch(`http://localhost:4000/api/v1/stations/${station.id}/force-unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + adminToken },
      body: JSON.stringify({ reason: 'Clear before automated test' })
    });
    const unlockData = await unlockRes.json();
    console.log('Station unlock response:', unlockData);
  } catch (e) {
    console.error('Station unlock error:', e);
  }

  console.log('3. Validating barcode SPXVN0888999123...');
  const valRes = await fetch('http://localhost:4000/api/v1/packing/validate-barcode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ trackingCode: 'SPXVN0888999123', stationId: station.id })
  });
  const valData = await valRes.json();
  console.log('valData response:', JSON.stringify(valData, null, 2));
  const orderCode = valData.data?.orderCode || valData.data?.order?.orderCode;
  console.log('Validated order:', orderCode, 'Customer:', valData.data?.customer?.customerName, 'Items:', valData.data?.customer?.items?.length);

  console.log('4. Starting packing session...');
  const startRes = await fetch('http://localhost:4000/api/v1/packing/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({
      stationId: station.id,
      trackingCode: 'SPXVN0888999123',
      orderCode: valData.data.orderCode
    })
  });
  const startData = await startRes.json();
  console.log('Packing started:', startData);
  if (!startData.success) {
    console.error('Failed to start:', startData.error);
    return;
  }
  const sessionId = startData.data.sessionId;

  console.log('5. Recording for 5 seconds from Dahua camera...');
  await new Promise(r => setTimeout(r, 5000));

  console.log('6. Stopping packing session...');
  const stopRes = await fetch('http://localhost:4000/api/v1/packing/stop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ sessionId })
  });
  const stopData = await stopRes.json();
  console.log('Stop result:', stopData);

  // Poll for completion
  console.log('7. Waiting for video finalization and sealing...');
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const sRes = await fetch('http://localhost:4000/api/v1/packing/sessions/' + sessionId, {
      headers: { Authorization: 'Bearer ' + token }
    });
    const sData = await sRes.json();
    console.log(`[t+${i+1}s] Status: ${sData.data?.status}, Video: ${sData.data?.video ? 'PRESENT' : 'NONE'}`);
    if (sData.data?.status === 'COMPLETED') {
      console.log('🎉 REAL WORKFLOW SUCCESSFUL!');
      console.log('Video details:', JSON.stringify(sData.data.video, null, 2));
      break;
    }
  }
}
testWorkflow().catch(console.error);
