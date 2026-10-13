import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Sparkles,
  CheckCircle2,
  Clock,
  Video,
  RefreshCw,
  User,
  Trash2,
  FileSpreadsheet,
  Timer,
  Copy,
  Check,
  ShieldAlert,
  Filter,
  PackageCheck
} from 'lucide-react';
import { adminApi } from '../services/api';
import { VideoPlayerModal } from '../components/VideoPlayerModal';
import { ImportOrdersModal } from '../components/ImportOrdersModal';

export const OrdersPage: React.FC<{ onNavigateToVideos?: () => void }> = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'RECORDING' | 'COMPLETED' | 'DISPUTE'>('ALL');
  const [platformFilter, setPlatformFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSapoSyncModalOpen, setIsSapoSyncModalOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<any | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.getOrders({
        search: search.trim() || undefined,
        status: statusFilter,
        platform: platformFilter
      });
      setOrders(data);
    } catch (err: any) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, platformFilter]);

  useEffect(() => {
    loadOrders();
    const handleFocus = () => loadOrders();
    window.addEventListener('focus', handleFocus);
    const interval = setInterval(loadOrders, 3500);
    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [loadOrders]);

  const handleSeedOrders = async () => {
    setSeeding(true);
    try {
      await adminApi.seedOrders();
      await loadOrders();
    } catch (err: any) {
      alert(`Lỗi nạp đơn mẫu: ${err.message}`);
    } finally {
      setSeeding(false);
    }
  };

  const handleDeleteOrder = async (orderId: string, trackingCode: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa đơn "${trackingCode}" (kèm dữ liệu phiên đóng gói và liên kết video nếu có) không?`)) {
      return;
    }
    try {
      await adminApi.deleteOrder(orderId);
      await loadOrders();
    } catch (err: any) {
      alert(`Lỗi xóa đơn: ${err.message}`);
    }
  };

  const handleManualComplete = async (orderId: string, trackingCode: string) => {
    if (!window.confirm(`Xác nhận đơn "${trackingCode}" đã đóng gói xong ngoài thực tế (bỏ qua quay video)?\nĐơn sẽ được chuyển sang trạng thái "ĐÃ ĐÓNG GÓI".`)) {
      return;
    }
    try {
      await adminApi.manualCompleteOrder(orderId, 'Quên quay video (Đóng ngoài)');
      await loadOrders();
    } catch (err: any) {
      alert(`Lỗi xác nhận đóng thủ công: ${err.message}`);
    }
  };

  const handlePurgeAllOrders = async () => {
    if (!window.confirm('⚠️ CẢNH BÁO: Bạn có chắc chắn muốn DỌN SẠCH TẤT CẢ đơn hàng trong kho không? Thao tác này sẽ xóa toàn bộ đơn thử nghiệm để bạn bắt đầu mới.')) {
      return;
    }
    try {
      const res = await adminApi.purgeOrders();
      alert(`Đã dọn sạch ${res.count || ''} đơn hàng.`);
      await loadOrders();
    } catch (err: any) {
      alert(`Lỗi dọn sạch: ${err.message}`);
    }
  };

  const handleCopyProofLink = (videoId: string) => {
    const link = adminApi.getVideoShareUrl(videoId);
    navigator.clipboard.writeText(link);
    setCopiedId(videoId);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Status counts for tabs
  const pendingCount = orders.filter(o => o.packingStatus === 'PENDING').length;
  const recordingCount = orders.filter(o => o.packingStatus === 'RECORDING').length;
  const completedCount = orders.filter(o => o.packingStatus === 'COMPLETED').length;
  const disputeCount = orders.filter(o => o.video?.isLocked || (o.video?.disputeStatus && o.video.disputeStatus !== 'NONE')).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white tracking-wide uppercase">
            QUẢN LÝ ĐƠN HÀNG & TIẾN ĐỘ ĐÓNG GÓI
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Theo dõi luồng đơn hàng 4 bước: Chờ đóng gói ➔ Đang quay video ➔ Đã niêm phong ➔ Đối soát khiếu nại
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => setIsSapoSyncModalOpen(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-lg shadow-emerald-950/40 ring-1 ring-emerald-400/50 transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-emerald-200" />
            <span>🔄 ĐỒNG BỘ TẤT CẢ ĐƠN SAPO</span>
          </button>

          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-lg transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-blue-200" />
            <span>📥 NHẬP EXCEL / CSV</span>
          </button>

          <button
            type="button"
            onClick={handleSeedOrders}
            disabled={seeding}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-900 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-lg transition cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-purple-200" />
            <span>{seeding ? 'ĐANG NẠP...' : '+ NẠP 5 ĐƠN MẪU THỰC TẾ'}</span>
          </button>

          <button
            type="button"
            onClick={handlePurgeAllOrders}
            className="px-3.5 py-2 bg-rose-950/80 hover:bg-rose-800 text-rose-300 hover:text-white border border-rose-800/80 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
            title="Dọn sạch toàn bộ đơn hàng thử nghiệm"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>DỌN SẠCH ĐƠN HÀNG</span>
          </button>

          <button
            type="button"
            onClick={loadOrders}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center space-x-1.5 border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>LÀM MỚI</span>
          </button>
        </div>
      </div>

      {/* Workflow Tabs Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-2.5 rounded-2xl shadow-lg">
        {/* Tabs */}
        <div className="flex items-center space-x-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              statusFilter === 'ALL'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                : 'text-slate-400 hover:text-white bg-slate-800/60'
            }`}
          >
            <span>TẤT CẢ ĐƠN</span>
            <span className="px-1.5 py-0.5 rounded-md bg-black/30 text-[10px]">{orders.length}</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('PENDING')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              statusFilter === 'PENDING'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/30'
                : 'text-slate-400 hover:text-white bg-slate-800/60'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>CHỜ ĐÓNG GÓI</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-md bg-amber-950 text-amber-300 border border-amber-800 text-[10px]">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('RECORDING')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              statusFilter === 'RECORDING'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-500/30'
                : 'text-slate-400 hover:text-white bg-slate-800/60'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
            <span>ĐANG QUAY</span>
            {recordingCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-md bg-rose-950 text-rose-300 border border-rose-800 text-[10px]">
                {recordingCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('COMPLETED')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              statusFilter === 'COMPLETED'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                : 'text-slate-400 hover:text-white bg-slate-800/60'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>ĐÃ ĐÓNG GÓI</span>
            {completedCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px]">
                {completedCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('DISPUTE')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              statusFilter === 'DISPUTE'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                : 'text-slate-400 hover:text-white bg-slate-800/60'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
            <span>KHIẾU NẠI / KHÓA</span>
            {disputeCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-md bg-purple-950 text-purple-300 border border-purple-800 text-[10px]">
                {disputeCount}
              </span>
            )}
          </button>
        </div>

        {/* Platform Dropdown */}
        <div className="flex items-center space-x-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-400 font-medium">Sàn:</span>
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">Tất cả sàn</option>
            <option value="SAPO">Sapo Omni</option>
            <option value="SPX">Shopee (SPX)</option>
            <option value="TIKTOK">TikTok Shop</option>
            <option value="LAZADA">Lazada</option>
            <option value="GHTK">GHTK</option>
            <option value="GHN">GHN</option>
            <option value="OTHER">Kênh khác</option>
          </select>
        </div>
      </div>

      {/* Search Filter */}
      <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 shadow-lg flex items-center justify-between">
        <div className="relative w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo mã vận đơn hoặc mã đơn hàng..."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="text-xs text-slate-400 font-medium">
          Hiển thị: <strong className="text-white">{orders.length}</strong> đơn hàng phù hợp
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-slate-800/90 border border-slate-700 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-700">
              <tr>
                <th className="py-3.5 px-4">Mã Vận Đơn & Mã Đơn</th>
                <th className="py-3.5 px-4">Sàn TMĐT</th>
                <th className="py-3.5 px-4">Khách Hàng & Địa Chỉ</th>
                <th className="py-3.5 px-4">Sản Phẩm Trong Đơn</th>
                <th className="py-3.5 px-4">Trạng Thái & Nhân Viên</th>
                <th className="py-3.5 px-4">Thời Gian Đóng</th>
                <th className="py-3.5 px-4 text-right">Bằng Chứng Video & Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    Chưa tìm thấy đơn hàng nào phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                orders.map((ord) => {
                  const cust = ord.customer;
                  const items = cust?.items || [];
                  const isCompleted = ord.packingStatus === 'COMPLETED';
                  const isDisputed = ord.video?.isLocked || (ord.video?.disputeStatus && ord.video.disputeStatus !== 'NONE');

                  return (
                    <tr key={ord.id} className="hover:bg-slate-700/30 transition">
                      {/* Order & Tracking Code */}
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-white text-xs block">
                          {ord.trackingCode}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono block">
                          Đơn: {ord.orderCode}
                        </span>
                        {cust?.deliveryCode && (
                          <span className="text-[9px] font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/60 block w-max mt-0.5">
                            Phiếu: {cust.deliveryCode}
                          </span>
                        )}
                      </td>

                      {/* Platform & Carrier */}
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-slate-900 text-blue-300 border border-slate-700 block w-max">
                            {ord.platform}
                          </span>
                          {(cust?.carrier || cust?.service) && (
                            <span className="text-[10px] text-slate-400 font-medium block">
                              {cust.carrier}{cust.service ? ` (${cust.service})` : ''}
                            </span>
                          )}
                          {isDisputed && (
                            <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold bg-purple-950 text-purple-300 border border-purple-800 block w-max">
                              KHIẾU NẠI
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Customer Info & Financials */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-1.5 font-semibold text-slate-200">
                          <User className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span>{cust?.customerName || 'Khách lẻ'}</span>
                          {cust?.phone && <span className="text-slate-400 text-[11px]">({cust.phone})</span>}
                        </div>
                        {cust?.address && (
                          <span className="text-[10px] text-slate-400 line-clamp-1 mt-0.5" title={cust.address}>
                            {cust.address}
                          </span>
                        )}
                        {((cust?.codAmount && cust.codAmount > 0) || (cust?.totalAmount && cust.totalAmount > 0)) && (
                          <div className="text-[11px] font-mono font-bold text-amber-300 mt-1 flex items-center space-x-1">
                            <span>💵</span>
                            <span>
                              {cust.codAmount && cust.codAmount > 0
                                ? `COD: ${cust.codAmount.toLocaleString('vi-VN')} ₫`
                                : `Tổng: ${cust.totalAmount?.toLocaleString('vi-VN')} ₫`}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Items */}
                      <td className="py-3 px-4 max-w-sm">
                        <div className="space-y-1.5">
                          {items.length === 0 ? (
                            <span className="text-slate-500 italic text-[11px]">Chưa có thông tin SKU</span>
                          ) : (
                            items.map((it: any, i: number) => (
                              <div key={i} className="text-[11px] bg-slate-900/60 p-1.5 rounded-lg border border-slate-800 text-slate-300">
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-slate-200 truncate pr-2" title={it.name}>
                                    • {it.name}
                                  </span>
                                  <span className="font-bold text-amber-400 shrink-0 font-mono">x{it.quantity}</span>
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-0.5 font-mono">
                                  <span className="text-slate-400">SKU: <strong className="text-cyan-300">{it.sku}</strong></span>
                                  {it.price && it.price > 0 ? (
                                    <span className="text-emerald-400">
                                      {it.price.toLocaleString('vi-VN')} ₫
                                      {it.discount && it.discount > 0 ? ` (KM: -${it.discount.toLocaleString('vi-VN')} ₫)` : ''}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </td>

                      {/* Packing Status & Operator */}
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          {isCompleted ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center space-x-1 w-max">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>ĐÃ ĐÓNG GÓI</span>
                            </span>
                          ) : ord.packingStatus === 'RECORDING' ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-950 text-rose-400 border border-rose-800 animate-pulse flex items-center space-x-1 w-max">
                              <Clock className="w-3 h-3" />
                              <span>ĐANG QUAY</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800 flex items-center space-x-1 w-max">
                              <Clock className="w-3 h-3" />
                              <span>CHỜ ĐÓNG GÓI</span>
                            </span>
                          )}

                          {ord.operatorName && (
                            <div className="text-[10px] text-slate-400 font-medium">
                              Bởi: <strong className="text-slate-300">{ord.operatorName}</strong> ({ord.stationCode || 'Bàn 01'})
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Duration */}
                      <td className="py-3 px-4">
                        {ord.duration ? (
                          <div className="flex items-center space-x-1.5">
                            <Timer className="w-3.5 h-3.5 text-amber-400" />
                            <span className="font-mono font-bold text-white text-xs">
                              {ord.duration}s
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">--</span>
                        )}
                      </td>

                      {/* Video Proof Link & Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          {ord.video ? (
                            <>
                              <button
                                type="button"
                                onClick={() => setSelectedVideo({
                                  id: ord.video.id,
                                  filename: ord.video.filename,
                                  duration: ord.video.duration,
                                  sha256: ord.video.sha256,
                                  tracking_code: ord.trackingCode,
                                  order_code: ord.orderCode,
                                  operator_name: ord.operatorName || 'Nhân viên đóng hàng',
                                  station_name: ord.stationName || 'Bàn đóng gói',
                                  station_code: ord.stationCode || 'PACK01',
                                  created_at: ord.createdAt
                                })}
                                className="px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/40 rounded-lg text-xs font-semibold flex items-center space-x-1 transition cursor-pointer"
                              >
                                <Video className="w-3.5 h-3.5" />
                                <span>XEM VIDEO</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleCopyProofLink(ord.video.id)}
                                title="Sao chép link video gửi kháng cáo sàn hoặc gửi khách"
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-lg text-xs transition cursor-pointer flex items-center space-x-1"
                              >
                                {copiedId === ord.video.id ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="text-[10px] text-emerald-400">ĐÃ CHÉP</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" />
                                    <span className="text-[10px]">LINK KHÁNG CÁO</span>
                                  </>
                                )}
                              </button>
                            </>
                          ) : ord.packingStatus === 'COMPLETED' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/60 text-amber-300 border border-amber-800">
                              ⚠️ Đã đóng (Không video)
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleManualComplete(ord.id, ord.trackingCode)}
                              className="px-2.5 py-1 bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/40 rounded-lg text-xs font-semibold flex items-center space-x-1 transition cursor-pointer"
                              title="Bấm để xác nhận đơn này đã đóng gói xong ngoài thực tế (quên quay video)"
                            >
                              <PackageCheck className="w-3.5 h-3.5" />
                              <span>ĐÃ ĐÓNG (QUÊN QUAY)</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteOrder(ord.id, ord.trackingCode)}
                            className="p-1 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 rounded-lg transition cursor-pointer"
                            title="Xóa đơn hàng này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Video Player Modal */}
      {selectedVideo && (
        <VideoPlayerModal
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
          onUpdated={loadOrders}
        />
      )}

      {/* Import CSV / Excel Modal */}
      <ImportOrdersModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => {
          setIsImportModalOpen(false);
          loadOrders();
        }}
      />

      {/* Sapo Sync Modal */}
      {isSapoSyncModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-lg w-full space-y-5 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />
                </div>
                <div>
                  <h3 className="font-black text-white text-base">ĐỒNG BỘ ĐƠN HÀNG TỪ SAPO</h3>
                  <p className="text-xs text-slate-400">Tự động nạp hàng loạt đơn hàng thực tế vào Bàn Đóng Gói</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSapoSyncModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                <span className="font-bold text-amber-300 uppercase tracking-wide block flex items-center space-x-1.5">
                  <span>🚀 Cách 1: Đồng bộ hàng loạt qua Chrome Extension (Nhanh nhất)</span>
                </span>
                <ol className="list-decimal pl-4 space-y-1 text-slate-300 leading-relaxed">
                  <li>Chuyển sang <strong>Tab Sapo</strong> bạn đang mở (trang <em>Danh sách vận đơn</em> hoặc <em>Chi tiết phiếu giao hàng</em>).</li>
                  <li>Bấm vào nút nổi màu xanh ở góc màn hình Sapo: <strong className="text-emerald-400">[ 🚀 ĐỒNG BỘ TẤT CẢ ĐƠN SANG BÀN QUAY ]</strong>.</li>
                  <li>Hệ thống sẽ tự động quét toàn bộ danh sách đơn hàng và nạp một mẻ sang Bàn Đóng Gói trong <strong>1 giây</strong>!</li>
                </ol>
              </div>

              <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                <span className="font-bold text-blue-300 uppercase tracking-wide block">
                  📁 Cách 2: Nhập bằng file Excel xuất từ Sapo
                </span>
                <p className="text-slate-400 leading-relaxed">
                  Bấm nút <strong>"Xuất file"</strong> trên Sapo để tải file Excel về, sau đó bấm nút <strong>[ 📥 NHẬP EXCEL / CSV ]</strong> ở phía trên để nạp vào hệ thống.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsSapoSyncModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs transition cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => {
                  loadOrders();
                  setIsSapoSyncModalOpen(false);
                }}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs shadow-lg transition cursor-pointer flex items-center space-x-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>KIỂM TRA & LÀM MỚI DANH SÁCH</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
