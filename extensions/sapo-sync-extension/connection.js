// Only restore the reader before a sync request; never retry a submitted order.
globalThis.sapoConnection = {
  async ensureReader(tab) {
    let url;
    try { url = new URL(tab?.url); } catch { throw new Error('Hãy mở trang Sapo rồi bấm đồng bộ.'); }
    if (!tab?.id || !['http:', 'https:'].includes(url.protocol) ||
        !['mysapo.net', 'mysapogo.com', 'pos.sapo.vn'].some(domain => url.hostname.endsWith('.' + domain))) {
      throw new Error('Hãy mở trang Sapo rồi bấm đồng bộ.');
    }
    try {
      const pong = await chrome.tabs.sendMessage(tab.id, { action: 'PACKING_PROOF_PING' });
      if (pong?.ready) return;
      throw new Error('Trang đang dùng phiên bản cũ. Hãy tải lại trang Sapo một lần.');
    } catch (error) {
      if (!/Receiving end does not exist|Could not establish connection/i.test(error.message)) throw error;
    }
    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['content.css'] });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    const pong = await chrome.tabs.sendMessage(tab.id, { action: 'PACKING_PROOF_PING' });
    if (!pong?.ready) throw new Error('Không khởi động được kết nối Sapo. Hãy tải lại trang.');
  }
};
