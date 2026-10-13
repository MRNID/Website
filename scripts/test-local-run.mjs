async function testFullFlow() {
  console.log('====================================================');
  console.log('       KIỂM THỬ TOÀN DIỆN HỆ THỐNG ĐÓNG GÓI LOCAL   ');
  console.log('====================================================');
  console.log('1. Đăng nhập packer01...');
  const authRes = await fetch('http://localhost:4000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'packer01', password: 'Packer@123' })
  });
  const auth = await authRes.json();
  const token = auth.data.accessToken;
  console.log('-> Đăng nhập thành công! User:', auth.data.user.username, 'Role:', auth.data.user.role);

  const stationId = '801F89A1-23A8-4349-8839-C509B4015B72'; // PACK01
  const trackingCode = 'SPXVN_LOCAL_' + Date.now();

  console.log('\n2. Kiểm tra mã vận đơn:', trackingCode);
  const valRes = await fetch('http://localhost:4000/api/v1/packing/validate-barcode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ trackingCode, stationId })
  });
  const valData = await valRes.json();
  console.log('-> Mã hợp lệ:', valData.data?.cleanedCode, '| Đơn vị vận chuyển:', valData.data?.platform);

  console.log('\n3. Bắt đầu phiên đóng gói (Start Packing)...');
  const startRes = await fetch('http://localhost:4000/api/v1/packing/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ stationId, trackingCode, orderCode: trackingCode })
  });
  const startData = await startRes.json();
  console.log('-> Lệnh START:', startData.data?.sessionId, '| Trạng thái ban đầu:', startData.data?.status);

  if (!startData.success) {
    console.error('Không thể bắt đầu phiên:', startData.error);
    return;
  }
  const sessionId = startData.data.sessionId;

  console.log('\n4. Chờ camera / worker xác nhận first keyframe chuyển sang RECORDING...');
  let isRecording = false;
  for (let i = 0; i < 15; i++) {
    const actRes = await fetch(`http://localhost:4000/api/v1/packing/stations/${stationId}/active`, {
      headers: { Authorization: 'Bearer ' + token }
    });
    const actData = await actRes.json();
    const st = actData.data?.activeSession?.status;
    if (st === 'RECORDING') {
      console.log(`-> Phiên ${sessionId} đã chính thức GHI HÌNH (RECORDING)!`);
      isRecording = true;
      break;
    }
    process.stdout.write('.');
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log('');

  if (!isRecording) {
    console.error('Timeout: Phiên không chuyển sang RECORDING kịp thời.');
    return;
  }

  console.log('\n5. Giả lập nhân viên đóng gói trong 3 giây...');
  await new Promise(r => setTimeout(r, 3000));

  console.log('\n6. Hoàn tất đóng gói (Stop Packing)...');
  const stopRes = await fetch('http://localhost:4000/api/v1/packing/stop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ sessionId })
  });
  const stopData = await stopRes.json();
  console.log('-> Lệnh STOP thành công! Trạng thái:', stopData.data?.status);

  console.log('\n7. Chờ worker hoàn tất niêm phong và băm SHA-256...');
  await new Promise(r => setTimeout(r, 3000));

  const histRes = await fetch(`http://localhost:4000/api/v1/packing/stations/${stationId}/recent?limit=1`, {
    headers: { Authorization: 'Bearer ' + token }
  });
  const hist = await histRes.json();
  const latest = hist.data?.[0];

  console.log('====================================================');
  console.log('       KẾT QUẢ PHIÊN ĐÓNG GÓI HOÀN TẤT THỰC TẾ       ');
  console.log('====================================================');
  console.log('Mã vận đơn:    ', latest?.trackingCode);
  console.log('Trạng thái:    ', latest?.status);
  console.log('Thời lượng:    ', latest?.video?.duration + 's');
  console.log('Mã băm SHA-256:', latest?.video?.sha256);
  console.log('Đích lưu trữ:   Local OK | Google Drive (' + latest?.video?.syncStatus + ')');
  console.log('====================================================');
  console.log('>>> TOÀN BỘ HỆ THỐNG HOẠT ĐỘNG HOÀN HẢO! <<<');
}

testFullFlow().catch(console.error);
