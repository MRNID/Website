// Sapo Packing Proof Content Script
// Runs automatically on *.mysapo.net, *.pos.sapo.vn, *.mysapogo.com

(() => {
  if (globalThis.__packingProofReaderInstalled) return;
  globalThis.__packingProofReaderInstalled = true;
  let settings = {
    serverUrl: 'http://localhost:4000',
    autoSyncPrint: true,
    showFloatingButton: true
  };

  // Load settings from storage
  const settingsReady = new Promise(resolve => chrome.storage.local.get(settings, (s) => {
    settings = { ...settings, ...s };
    initExtension();
    resolve();
  }));

  // Listen to storage changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.serverUrl) settings.serverUrl = changes.serverUrl.newValue;
    if (changes.autoSyncPrint) settings.autoSyncPrint = changes.autoSyncPrint.newValue;
    if (changes.showFloatingButton) {
      settings.showFloatingButton = changes.showFloatingButton.newValue;
      updateFloatingButtonVisibility();
    }
  });

  function showToast(message, type = 'success') {
    const existing = document.getElementById('packing-proof-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'packing-proof-toast';
    toast.className = `packing-proof-toast ${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✓' : '⚠️'}</span><span>${message}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // Floating Button on Sapo Page
  let floatingBtn = null;
  function updateFloatingButtonVisibility() {
    if (settings.showFloatingButton) {
      if (!floatingBtn) {
        floatingBtn = document.createElement('div');
        floatingBtn.className = 'packing-proof-floating-btn';
        floatingBtn.title = 'Bấm để nạp toàn bộ đơn hàng trên trang này sang hệ thống Video Đóng Gói';
        floatingBtn.addEventListener('click', () => {
          syncCurrentPageOrders(true);
        });
        document.body.appendChild(floatingBtn);
      }
      const count = document.querySelectorAll('table tbody tr').length;
      floatingBtn.innerHTML = `
        <span class="icon">🚀</span>
        <span>${count > 1 ? `ĐỒNG BỘ TẤT CẢ ${count} ĐƠN SANG BÀN QUAY` : `Đóng Gói: Gửi đơn sang Bàn Quay`}</span>
      `;
      floatingBtn.style.display = 'flex';
    } else if (floatingBtn) {
      floatingBtn.style.display = 'none';
    }
  }

  // Smart Label & Value Extractor for Sapo pages
  function findValueAfterLabel(labels) {
    const bodyText = document.body.innerText;
    for (const label of labels) {
      // 1. Try finding DOM elements with matching label text
      const allElems = document.querySelectorAll('label, dt, span, div, p, strong, b, td, th');
      for (const el of allElems) {
        if (el.children.length > 2) continue; // Skip large parent containers
        const text = (el.innerText || '').trim();
        if (!text) continue;

        // Pattern: "Label : Value" inside same element
        const inlineRegex = new RegExp(`^${label}\\s*[:：]\\s*(.+)$`, 'i');
        const inlineMatch = text.match(inlineRegex);
        if (inlineMatch && inlineMatch[1] && inlineMatch[1].trim()) {
          return inlineMatch[1].trim();
        }

        // Pattern: Element is strictly the label itself "Label :" or "Label"
        const strictLabelRegex = new RegExp(`^${label}\\s*[:：]?$`, 'i');
        if (strictLabelRegex.test(text)) {
          // Check next sibling
          const next = el.nextElementSibling;
          if (next && next.innerText && next.innerText.trim()) {
            return next.innerText.trim();
          }
          // Check parent's next sibling
          if (el.parentElement && el.parentElement.nextElementSibling) {
            const pNextText = el.parentElement.nextElementSibling.innerText.trim();
            if (pNextText) return pNextText;
          }
          // Check parent innerText without the label
          if (el.parentElement) {
            const pText = el.parentElement.innerText.replace(text, '').trim().replace(/^[:：\s]+/, '');
            if (pText && pText.length < 200) return pText;
          }
        }
      }

      // 2. Fallback regex on document body text
      const fallbackRegex = new RegExp(`(?:${label})\\s*[:：]\\s*([^\\n\\r]+)`, 'i');
      const fallbackMatch = bodyText.match(fallbackRegex);
      if (fallbackMatch && fallbackMatch[1]) {
        const val = fallbackMatch[1].trim();
        if (val && val.length < 200) return val;
      }
    }
    return '';
  }

  // Extract products table with column-by-header mapping
  function extractItemsFromSapoTables() {
    const tables = document.querySelectorAll('table');
    const items = [];

    for (const table of tables) {
      const ths = table.querySelectorAll('thead th, thead td, tr:first-child th, tr:first-child td');
      let skuCol = -1;
      let nameCol = -1;
      let priceCol = -1;
      let qtyCol = -1;
      let discountCol = -1;
      let totalCol = -1;

      ths.forEach((th, idx) => {
        const hText = (th.innerText || '').toLowerCase().trim();
        if (hText.includes('sku') || hText.includes('mã sp') || hText.includes('mã hàng') || hText === 'mã') {
          skuCol = idx;
        } else if (hText.includes('tên sản phẩm') || hText.includes('sản phẩm') || hText.includes('mặt hàng')) {
          nameCol = idx;
        } else if (hText.includes('đơn giá') || hText === 'giá') {
          priceCol = idx;
        } else if (hText.includes('số lượng') || hText === 'sl') {
          qtyCol = idx;
        } else if (hText.includes('chiết khấu') || hText.includes('giảm giá')) {
          discountCol = idx;
        } else if (hText.includes('thành tiền') || hText.includes('tổng tiền')) {
          totalCol = idx;
        }
      });

      // If we identified product or sku columns
      if (nameCol !== -1 || skuCol !== -1 || totalCol !== -1) {
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach((tr) => {
          if (tr.querySelector('th') || tr.classList.contains('summary') || tr.classList.contains('total')) return;
          const cells = tr.querySelectorAll('td');
          if (cells.length < 2) return;

          // SKU
          let sku = '';
          if (skuCol !== -1 && cells[skuCol]) {
            sku = cells[skuCol].innerText.trim();
          }
          if (!sku) {
            const skuMatch = tr.innerText.match(/(?:SKU|Mã)[\s:]*([A-Za-z0-9\-_\/.]+)/i);
            if (skuMatch) sku = skuMatch[1];
          }

          // Product Name
          let name = '';
          if (nameCol !== -1 && cells[nameCol]) {
            const nameEl = cells[nameCol];
            const link = nameEl.querySelector('a');
            const linkTitle = link ? (link.getAttribute('title') || link.innerText.trim()) : '';
            const cellText = nameEl.innerText.trim().replace(/\n+/g, ' - ');
            name = linkTitle || cellText;
          }
          if (!name) {
            const anyLink = tr.querySelector('a[href*="/products/"], a[href*="/variants/"], a');
            if (anyLink && anyLink.innerText.trim().length > 2) {
              name = anyLink.innerText.trim().replace(/\n+/g, ' - ');
            }
          }

          // Unit Price
          let price = 0;
          if (priceCol !== -1 && cells[priceCol]) {
            const pMatch = cells[priceCol].innerText.match(/([0-9]{1,3}(?:[.,][0-9]{3})+)/);
            if (pMatch) price = parseInt(pMatch[1].replace(/[.,]/g, ''), 10);
          }

          // Quantity
          let quantity = 1;
          if (qtyCol !== -1 && cells[qtyCol]) {
            const qVal = parseInt(cells[qtyCol].innerText.replace(/[^0-9]/g, ''), 10);
            if (qVal && qVal > 0) quantity = qVal;
          }

          // Discount
          let discount = 0;
          if (discountCol !== -1 && cells[discountCol]) {
            const dMatch = cells[discountCol].innerText.match(/([0-9]{1,3}(?:[.,][0-9]{3})+)/);
            if (dMatch) discount = parseInt(dMatch[1].replace(/[.,]/g, ''), 10);
          }

          // Total
          let total = 0;
          if (totalCol !== -1 && cells[totalCol]) {
            const tMatch = cells[totalCol].innerText.match(/([0-9]{1,3}(?:[.,][0-9]{3})+)/);
            if (tMatch) total = parseInt(tMatch[1].replace(/[.,]/g, ''), 10);
          }

          if (name || sku) {
            items.push({
              sku: sku || ('SP-' + Math.random().toString(36).slice(-6).toUpperCase()),
              name: name || (sku ? 'Sản phẩm ' + sku : 'Sản phẩm Sapo'),
              quantity: quantity || 1,
              price: price || (total && quantity ? Math.round(total / quantity) : 0),
              discount: discount || 0,
              total: total || (price ? price * quantity : 0)
            });
          }
        });
      }
    }

    return items;
  }

  // Extract Orders from Sapo DOM (Detailed single order or delivery note page)
  function extractOrderFromSapoDOM() {
    const bodyText = document.body.innerText;

    // 1. Delivery Note Code (Mã phiếu / FUN...)
    let deliveryCode = findValueAfterLabel(['Mã phiếu', 'Mã phiếu giao', 'Mã phiếu giao hàng', 'Phiếu giao hàng']);
    if (!deliveryCode) {
      const funMatch = bodyText.match(/\b(FUN\d+)\b/i);
      if (funMatch) deliveryCode = funMatch[1];
    }

    // 2. Tracking Code (Mã vận đơn)
    let trackingCode = findValueAfterLabel(['Mã vận đơn', 'Mã bill', 'Vận đơn', 'Số vận đơn']);
    if (!trackingCode) {
      const trackingRegex = /\b(SPX[A-Z0-9]+|TT[A-Z0-9]+|S\d+\.BO\.\w+|\d{9,15}|VTP[A-Z0-9]+)\b/i;
      const trackingMatch = bodyText.match(trackingRegex);
      if (trackingMatch) trackingCode = trackingMatch[0];
    }

    // 3. Order Code (Đơn hàng / Mã đơn)
    let orderCode = findValueAfterLabel(['Đơn hàng', 'Mã đơn hàng', 'Mã đơn']);
    if (!orderCode) {
      const ordMatch = bodyText.match(/\b(\d{14,16}[A-Za-z0-9]?|SON\d+|#\d{4,12})\b/);
      if (ordMatch) orderCode = ordMatch[0].replace('#', '');
    }

    // 4. Customer Info
    const customerName = findValueAfterLabel(['Người nhận', 'Tên người nhận', 'Khách hàng', 'Tên khách hàng']);
    const phone = findValueAfterLabel(['Điện thoại', 'Số điện thoại', 'SĐT']);
    const address = findValueAfterLabel(['Địa chỉ nhận hàng', 'Địa chỉ giao hàng', 'Địa chỉ']);

    // 5. Logistics: Carrier & Service
    const carrier = findValueAfterLabel(['Đối tác vận chuyển', 'Đơn vị vận chuyển', 'Nhà vận chuyển']);
    const service = findValueAfterLabel(['Dịch vụ giao hàng', 'Dịch vụ']);
    const packedDate = findValueAfterLabel(['Ngày đóng gói']);
    const exportedDate = findValueAfterLabel(['Ngày xuất kho']);

    // 6. Financials: COD, Discount, Total
    let codAmount = 0;
    const rawCod = findValueAfterLabel(['Tiền thu hộ COD', 'Thu hộ COD', 'Tiền COD', 'COD']);
    if (rawCod) {
      const m = rawCod.match(/([0-9]{1,3}(?:[.,][0-9]{3})+)/);
      if (m) codAmount = parseInt(m[1].replace(/[.,]/g, ''), 10);
    }

    let totalAmount = 0;
    const rawTotal = findValueAfterLabel(['Khách phải trả', 'Tổng tiền', 'Tổng thanh toán', 'Tổng cộng']);
    if (rawTotal) {
      const m = rawTotal.match(/([0-9]{1,3}(?:[.,][0-9]{3})+)/);
      if (m) totalAmount = parseInt(m[1].replace(/[.,]/g, ''), 10);
    }

    let discount = 0;
    const rawDiscount = findValueAfterLabel(['Chiết khấu', 'Giảm giá']);
    if (rawDiscount) {
      const m = rawDiscount.match(/([0-9]{1,3}(?:[.,][0-9]{3})+)/);
      if (m) discount = parseInt(m[1].replace(/[.,]/g, ''), 10);
    }

    // 7. Products Table
    const items = extractItemsFromSapoTables();

    // 8. Detect Platform
    let platform = 'SAPO';
    const carrierLower = (carrier || '').toLowerCase();
    const orderCodeLower = (orderCode || '').toLowerCase();
    if (carrierLower.includes('shopee') || /^\d{14}/.test(orderCode) || /SPX/i.test(trackingCode)) {
      platform = 'SHOPEE';
    } else if (carrierLower.includes('tiktok') || /^TT/i.test(trackingCode)) {
      platform = 'TIKTOK';
    } else if (carrierLower.includes('lazada') || carrierLower.includes('lex')) {
      platform = 'LAZADA';
    }

    if (!trackingCode && !orderCode && !deliveryCode && items.length === 0) {
      return null;
    }

    return {
      orderCode: orderCode || deliveryCode || trackingCode || ('SAPO-' + Date.now()),
      trackingCode: trackingCode || orderCode || deliveryCode || ('SPX' + Date.now()),
      deliveryCode: deliveryCode || '',
      platform,
      carrier: carrier || (platform !== 'SAPO' ? platform : ''),
      service: service || '',
      customerName: customerName || '',
      phone: phone || '',
      address: address || '',
      packedDate: packedDate || '',
      exportedDate: exportedDate || '',
      codAmount: codAmount || 0,
      totalAmount: totalAmount || codAmount || 0,
      discount: discount || 0,
      items: items.length > 0 ? items : [
        { sku: 'SAPO-ITEM-01', name: 'Sản phẩm Sapo (Chờ quét)', quantity: 1, price: totalAmount || 0 }
      ]
    };
  }

  // Send Order to Server
  async function sendOrderToPackingServer(orderData, isManual = false) {
    if (!orderData) return false;

    try {
      const res = await fetch(`${settings.serverUrl}/api/v1/orders/sync-extension`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderData)
      });

      const json = await res.json();
      if (res.ok && json.success) {
        const count = orderData.orders ? orderData.orders.length : 1;
        const msg = count > 1
          ? `✓ Đã nạp thành công toàn bộ ${count} đơn hàng sang Bàn đóng gói!`
          : `✓ Đã nạp đơn ${orderData.trackingCode || orderData.orderCode} sang Bàn đóng gói!`;
        showToast(msg, 'success');
        // Update stats
        await new Promise(resolve => chrome.storage.local.get(['syncedCount'], (s) => {
          chrome.storage.local.set({ syncedCount: (s.syncedCount || 0) + count }, resolve);
        }));
        return true;
      } else {
        if (isManual) showToast(json.error?.message || 'Lỗi gửi đơn', 'error');
        return false;
      }
    } catch (err) {
      if (isManual) showToast('Không thể kết nối Server đóng gói: ' + err.message, 'error');
      return false;
    }
  }

  // Extract ALL orders/shipments from Sapo Table (Orders list, Shipments list, Fulfillments list)
  function extractAllOrdersFromTable() {
    const table = document.querySelector('table');
    if (!table) return [];

    const ths = table.querySelectorAll('thead th, thead td, tr:first-child th, tr:first-child td');
    let codeCol = -1;
    let trkCol = -1;
    let dateCol = -1;
    let custCol = -1;
    let statusCol = -1;
    let codCol = -1;

    ths.forEach((th, idx) => {
      const t = (th.innerText || '').toLowerCase().trim();
      if (t.includes('mã đơn') || t.includes('đơn hàng') || t.includes('mã phiếu')) codeCol = idx;
      if (t.includes('vận đơn') || t.includes('mã bill')) trkCol = idx;
      if (t.includes('khách hàng') || t.includes('người nhận')) custCol = idx;
      if (t.includes('ngày tạo') || t.includes('ngày đặt') || t.includes('ngày')) dateCol = idx;
      if (t.includes('trạng thái')) statusCol = idx;
      if (t.includes('tiền') || t.includes('cod') || t.includes('giá trị') || t.includes('thanh toán')) codCol = idx;
    });

    const rows = table.querySelectorAll('tbody tr');
    if (rows.length === 0) return [];
    const orders = [];
    const seen = new Set();

    rows.forEach((row) => {
      const text = row.innerText.trim();
      if (!text) return;

      // 1. Order Code:
      let orderCode = '';
      if (codeCol !== -1 && row.children[codeCol]) {
        const link = row.children[codeCol].querySelector('a');
        orderCode = (link ? link.innerText : row.children[codeCol].innerText).trim();
      }
      if (!orderCode) {
        const anyOrderLink = row.querySelector('a[href*="/orders/"], a[href*="/fulfillments/"], a[href*="/shipments/"]');
        if (anyOrderLink) {
          orderCode = anyOrderLink.innerText.trim();
        }
      }
      if (!orderCode) {
        const m = text.match(/\b(CD\d+|SON\d+|FUN\d+|ORD[-\w]+|#\d+|\b\d{14,16}[A-Za-z0-9]?\b|\b\d{6,12}\b)/i);
        if (m) orderCode = m[0].replace('#', '');
      }

      // 2. Tracking Code:
      let trackingCode = '';
      if (trkCol !== -1 && row.children[trkCol]) {
        const m = row.children[trkCol].innerText.match(/\b([A-Z0-9]{8,25})\b/);
        if (m) trackingCode = m[1];
      }
      if (!trackingCode) {
        const trkMatch = text.match(/\b(SPX[A-Z0-9]+|TT[A-Z0-9]+|S\d+\.BO\.\w+|\d{9,15}|VTP[A-Z0-9]+)\b/i);
        if (trkMatch) trackingCode = trkMatch[0];
      }

      // If no separate tracking code (like on /admin/orders list before delivery note), use orderCode!
      if (!trackingCode && orderCode) {
        trackingCode = orderCode;
      }

      // If neither was found, skip this row
      if (!orderCode && !trackingCode) return;

      const uniqueKey = (trackingCode || orderCode).toUpperCase();
      if (seen.has(uniqueKey)) return;
      seen.add(uniqueKey);

      // 3. Customer Name
      let customerName = '';
      if (custCol !== -1 && row.children[custCol]) {
        customerName = row.children[custCol].innerText.trim().replace(/\n+/g, ' ');
      }
      if (!customerName) {
        const nameMatch = text.match(/\b([A-ZÀ-Ỹ][a-zà-ỹ*]+\s+[A-ZÀ-Ỹ][a-zà-ỹ*]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹ*]+)?)\b/);
        if (nameMatch) customerName = nameMatch[0];
      }

      // 4. Order Status & Date
      let orderStatus = '';
      if (statusCol !== -1 && row.children[statusCol]) {
        orderStatus = row.children[statusCol].innerText.trim().replace(/\n+/g, ' ');
      }

      // 5. Total / COD Amount
      let totalAmount = 0;
      if (codCol !== -1 && row.children[codCol]) {
        const codMatch = row.children[codCol].innerText.match(/([0-9]{1,3}(?:[.,][0-9]{3})+)/);
        if (codMatch) totalAmount = parseInt(codMatch[1].replace(/[.,]/g, ''), 10);
      }
      if (!totalAmount) {
        const codMatch = text.match(/([0-9]{1,3}(?:[.,][0-9]{3})+)/);
        if (codMatch) totalAmount = parseInt(codMatch[1].replace(/[.,]/g, ''), 10);
      }

      // 6. Platform & Carrier
      let platform = 'SAPO';
      let carrier = '';
      if (/shopee/i.test(text) || trackingCode.startsWith('SPX')) {
        platform = 'SHOPEE';
        carrier = 'Shopee (SPX Express)';
      } else if (/tiktok/i.test(text) || trackingCode.startsWith('TT')) {
        platform = 'TIKTOK';
        carrier = 'TikTok Shop';
      } else if (/lazada/i.test(text)) {
        platform = 'LAZADA';
        carrier = 'Lazada (LEX)';
      }

      orders.push({
        orderCode: orderCode || trackingCode,
        trackingCode: trackingCode || orderCode,
        platform,
        carrier,
        customerName: customerName || 'Khách hàng Sapo',
        note: orderStatus ? `Trạng thái: ${orderStatus}` : '',
        totalAmount: totalAmount || 0,
        codAmount: totalAmount || 0,
        items: [
          {
            sku: 'SP-' + (orderCode || trackingCode),
            name: `Đơn hàng ${orderCode || trackingCode}${customerName ? ' - ' + customerName : ''}`,
            quantity: 1,
            price: totalAmount || 0,
            total: totalAmount || 0
          }
        ]
      });
    });

    return orders;
  }

  // Trigger sync on current page (Support BOTH single order and batch list)
  // Trigger sync on current page (Support BOTH single order and batch list)
  async function syncCurrentPageOrders(isManual = false) {
    // 1. Try batch extraction from table first (Orders list, Shipments list, Fulfillments list)
    const tableOrders = extractAllOrdersFromTable();
    if (tableOrders.length > 0) {
      const msg = tableOrders.length > 1
        ? `Đang đồng bộ ${tableOrders.length} đơn hàng sang Bàn đóng gói...`
        : `Đang đồng bộ đơn ${tableOrders[0].trackingCode || tableOrders[0].orderCode} sang Bàn đóng gói...`;
      showToast(msg, 'info');

      const success = await sendOrderToPackingServer({ orders: tableOrders }, isManual);
      if (success) {
        showToast(`✓ Đã đồng bộ thành công ${tableOrders.length} đơn hàng sang Bàn đóng gói!`, 'success');
      }
      return;
    }

    // 2. Otherwise single order extraction (for order detail / shipment detail page)
    const singleOrder = extractOrderFromSapoDOM();
    if (singleOrder) {
      sendOrderToPackingServer(singleOrder, isManual);
    } else if (isManual) {
      showToast('Không tìm thấy thông tin đơn hàng trên trang này', 'error');
    }
  }

  // Listen to message from Popup
  chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.action === 'PACKING_PROOF_PING') {
      settingsReady.then(() => sendResponse({ ready: true }));
      return true;
    }
    if (req.action === 'SYNC_CURRENT_PAGE') {
      const tableOrders = extractAllOrdersFromTable();
      if (tableOrders.length > 0) {
        sendOrderToPackingServer({ orders: tableOrders }, true).then((ok) => {
          sendResponse({
            success: ok,
            count: tableOrders.length,
            message: ok ? `Đã nạp thành công toàn bộ ${tableOrders.length} đơn hàng sang Bàn đóng gói!` : 'Máy chủ chưa nhận đơn. Kiểm tra kết nối và thông báo trên trang Sapo.'
          });
        });
        return true;
      }

      const order = extractOrderFromSapoDOM();
      if (order) {
        sendOrderToPackingServer(order, true).then((ok) => {
          sendResponse({
            success: ok,
            count: 1,
            message: ok ? `Đã nạp đơn ${order.trackingCode || order.orderCode} sang Bàn đóng gói!` : 'Máy chủ chưa nhận đơn. Kiểm tra kết nối và thông báo trên trang Sapo.'
          });
        });
        return true; // async sendResponse
      }

      sendResponse({ success: false, message: 'Không tìm thấy dữ liệu đơn hàng trên trang này' });
    }
  });

  // Auto-sync on Print action
  function hookPrintActions() {
    // 1. Intercept Ctrl+P or window.print
    window.addEventListener('beforeprint', () => {
      if (settings.autoSyncPrint) {
        const order = extractOrderFromSapoDOM();
        if (order) sendOrderToPackingServer(order, false);
      }
    });

    // 2. Intercept click on Print buttons
    document.addEventListener('click', (e) => {
      const target = e.target.closest('button, a, input[type="button"]');
      if (!target) return;

      const text = (target.innerText || target.value || target.title || '').toLowerCase();
      if (
        text.includes('in đơn') ||
        text.includes('in phiếu') ||
        text.includes('in vận đơn') ||
        text.includes('in phiếu đóng gói') ||
        text.includes('print')
      ) {
        if (settings.autoSyncPrint) {
          setTimeout(() => {
            const order = extractOrderFromSapoDOM();
            if (order) sendOrderToPackingServer(order, false);
          }, 300);
        }
      }
    });
  }

  function initExtension() {
    updateFloatingButtonVisibility();
    hookPrintActions();
    console.log('[Sapo Packing Proof Sync] Extension activated on Sapo page');
  }
})();
