// Popup Logic for Sapo Packing Sync Extension

document.addEventListener('DOMContentLoaded', async () => {
  const serverUrlInput = document.getElementById('serverUrl');
  const autoSyncPrintToggle = document.getElementById('autoSyncPrint');
  const showFloatingBtnToggle = document.getElementById('showFloatingButton');
  const statusBadge = document.getElementById('statusBadge');
  const statusText = document.getElementById('statusText');
  const syncedCountElem = document.getElementById('syncedCount');
  const alertBox = document.getElementById('alertBox');
  const btnSyncCurrentPage = document.getElementById('btnSyncCurrentPage');
  const btnSendTest = document.getElementById('btnSendTest');

  function showAlert(msg, type = 'success') {
    alertBox.textContent = msg;
    alertBox.className = `alert alert-${type}`;
    alertBox.style.display = 'block';
    setTimeout(() => {
      alertBox.style.display = 'none';
    }, 4000);
  }

  // 1. Load Settings
  const defaultSettings = {
    serverUrl: 'http://localhost:4000',
    autoSyncPrint: true,
    showFloatingButton: true,
    syncedCount: 0
  };

  chrome.storage.local.get(defaultSettings, (settings) => {
    serverUrlInput.value = settings.serverUrl;
    autoSyncPrintToggle.checked = settings.autoSyncPrint;
    showFloatingBtnToggle.checked = settings.showFloatingButton;
    syncedCountElem.textContent = settings.syncedCount || 0;

    checkServerHealth(settings.serverUrl);
  });

  // 2. Save settings on change
  serverUrlInput.addEventListener('change', () => {
    let url = serverUrlInput.value.trim().replace(/\/+$/, '');
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'http://' + url;
      serverUrlInput.value = url;
    }
    chrome.storage.local.set({ serverUrl: url });
    checkServerHealth(url);
  });

  autoSyncPrintToggle.addEventListener('change', () => {
    chrome.storage.local.set({ autoSyncPrint: autoSyncPrintToggle.checked });
  });

  showFloatingBtnToggle.addEventListener('change', () => {
    chrome.storage.local.set({ showFloatingButton: showFloatingBtnToggle.checked });
  });

  // 3. Ping Server Health Check
  async function checkServerHealth(url) {
    statusBadge.className = 'status-badge';
    statusText.textContent = 'Kiểm tra...';

    try {
      const res = await fetch(`${url}/health`, { method: 'GET' });
      if (res.ok) {
        statusBadge.className = 'status-badge online';
        statusText.textContent = 'Server Online';
      } else {
        throw new Error('Status not OK');
      }
    } catch {
      statusBadge.className = 'status-badge offline';
      statusText.textContent = 'Mất kết nối';
    }
  }

  // 4. Trigger Sync Current Page via Content Script
  btnSyncCurrentPage.addEventListener('click', async () => {
    btnSyncCurrentPage.disabled = true;
    btnSyncCurrentPage.textContent = '⏳ Đang quét dữ liệu Sapo...';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await sapoConnection.ensureReader(tab);
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'SYNC_CURRENT_PAGE' });
      if (response?.success) {
        showAlert('✓ ' + response.message, 'success');
        // Content script owns the counter; popup only displays it.
        chrome.storage.local.get(['syncedCount'], s => {
          syncedCountElem.textContent = s.syncedCount || 0;
        });
      } else {
        showAlert(response?.message || 'Không tìm thấy dữ liệu đơn hàng trên trang này', 'error');
      }
    } catch (err) {
      showAlert('Không đồng bộ được: ' + err.message, 'error');
    } finally {
      btnSyncCurrentPage.disabled = false;
      btnSyncCurrentPage.textContent = '🔄 Quét & Đồng Bộ Trang Sapo Hiện Tại';
    }
  });

  // 5. Send Test Order
  btnSendTest.addEventListener('click', async () => {
    const url = serverUrlInput.value.trim().replace(/\/+$/, '');
    const rand = Math.floor(100000 + Math.random() * 900000);
    const testOrder = {
      order_number: `SAPO-TEST-${rand}`,
      fulfillments: [{ tracking_number: `SPXVN${rand}VN` }],
      source_name: 'SAPO-TEST',
      customer: { name: 'Khách hàng Thử Nghiệm', phone: '0988776655' },
      shipping_address: { address1: 'Thôn Tà Xùa, Xã Tà Xùa', district: 'Bắc Yên', city: 'Sơn La' },
      note: 'Đơn hàng thử nghiệm Shanam Tea từ Chrome Extension',
      line_items: [
        { sku: 'B0124TXC01', product_name: 'BÁNH BẠCH TRÀ MÂY 2024 TÀ XÙA 1T-2L 300G BTR', quantity: 1, price: 3340000 },
        { sku: 'TRA-SHAN-TUYET', product_name: 'Trà Shan Tuyết Cổ Thụ Shanam Hộp 100g', quantity: 2, price: 280000 }
      ]
    };

    btnSendTest.disabled = true;
    btnSendTest.textContent = '⏳ Đang gửi...';

    try {
      const res = await fetch(`${url}/api/v1/orders/sync-extension`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testOrder)
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showAlert(`✓ Đã nạp thành công đơn SPXVN${rand}VN sang bàn đóng gói!`, 'success');
        chrome.storage.local.get(['syncedCount'], (s) => {
          const newCount = (s.syncedCount || 0) + 1;
          chrome.storage.local.set({ syncedCount: newCount });
          syncedCountElem.textContent = newCount;
        });
      } else {
        showAlert(json.error?.message || 'Lỗi gửi đơn', 'error');
      }
    } catch (err) {
      showAlert('Không thể kết nối Server: ' + err.message, 'error');
    } finally {
      btnSendTest.disabled = false;
      btnSendTest.textContent = '⚡ Gửi thử 1 đơn hàng mẫu';
    }
  });
});
