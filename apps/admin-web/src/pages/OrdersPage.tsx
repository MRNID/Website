import React, { useState, useEffect, useCallback } from 'react';
import { Search, Sparkles, CheckCircle2, Clock, Video, RefreshCw, User, Trash2, FileSpreadsheet } from 'lucide-react';
import { adminApi } from '../services/api';
import { VideoPlayerModal } from '../components/VideoPlayerModal';
import { ImportOrdersModal } from '../components/ImportOrdersModal';

export const OrdersPage: React.FC<{ onNavigateToVideos?: () => void }> = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<any | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.getOrders({ search: search.trim() || undefined });
      setOrders(data);
    } catch (err: any) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadOrders();
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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white tracking-wide">
            QUẢN LÝ ĐƠN HÀNG & TIẾN ĐỘ ĐÓNG GÓI
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Theo dõi danh sách đơn hàng thực tế, sản phẩm cần đóng và liên kết bằng chứng video
          </p>
        </div>

        <div className="flex items-center space-x-3">
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
          Tổng cộng: <strong className="text-white">{orders.length}</strong> đơn hàng trong kho
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-slate-800/90 border border-slate-700 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-700">
              <tr>
                <th className="py-3.5 px-4">Mã Đơn & Vận Đơn</th>
                <th className="py-3.5 px-4">Sàn TMĐT</th>
                <th className="py-3.5 px-4">Khách Hàng & Địa Chỉ</th>
                <th className="py-3.5 px-4">Sản Phẩm Trong Đơn</th>
                <th className="py-3.5 px-4">Trạng Thái Đóng Gói</th>
                <th className="py-3.5 px-4 text-right">Bằng Chứng Video & Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    Chưa tìm thấy đơn hàng nào phù hợp.
                  </td>
                </tr>
              ) : (
                orders.map((ord) => {
                  const cust = ord.customer;
                  const items = cust?.items || [];
                  const isCompleted = ord.packingStatus === 'COMPLETED';

                  return (
                    <tr key={ord.id} className="hover:bg-slate-700/30 transition">
                      {/* Order & Tracking Code */}
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-white text-xs block">
                          {ord.trackingCode}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {ord.orderCode}
                        </span>
                      </td>

                      {/* Platform */}
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 text-blue-300 border border-slate-700">
                          {ord.platform}
                        </span>
                      </td>

                      {/* Customer Info */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-1.5 font-semibold text-slate-200">
                          <User className="w-3.5 h-3.5 text-blue-400" />
                          <span>{cust?.customerName || 'Khách lẻ'}</span>
                          {cust?.phone && <span className="text-slate-400 text-[11px]">({cust.phone})</span>}
                        </div>
                        {cust?.address && (
                          <span className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                            {cust.address}
                          </span>
                        )}
                      </td>

                      {/* Items */}
                      <td className="py-3 px-4 max-w-xs">
                        <div className="space-y-1">
                          {items.length === 0 ? (
                            <span className="text-slate-500 italic">Chưa có thông tin</span>
                          ) : (
                            items.map((it: any, i: number) => (
                              <div key={i} className="text-[11px] flex items-center justify-between text-slate-300">
                                <span className="truncate pr-2">• {it.name}</span>
                                <span className="font-bold text-amber-400 shrink-0">x{it.quantity}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </td>

                      {/* Packing Status */}
                      <td className="py-3 px-4">
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
                      </td>

                      {/* Video Proof Link & Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          {ord.video ? (
                            <button
                              type="button"
                              onClick={() => setSelectedVideo({
                                id: ord.video.id,
                                filename: ord.video.filename,
                                duration: ord.video.duration,
                                sha256: ord.video.sha256,
                                tracking_code: ord.trackingCode,
                                order_code: ord.orderCode,
                                operator_name: 'Nhân viên đóng hàng',
                                station_name: 'Bàn đóng gói',
                                station_code: 'PACK01',
                                created_at: ord.createdAt
                              })}
                              className="px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/40 rounded-lg text-xs font-semibold flex items-center space-x-1 transition"
                            >
                              <Video className="w-3.5 h-3.5" />
                              <span>XEM VIDEO</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-500 italic mr-1">Chưa có video</span>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteOrder(ord.id, ord.trackingCode)}
                            title="Xóa đơn hàng này"
                            className="p-1.5 bg-rose-950/60 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-800/60 rounded-lg transition cursor-pointer"
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

      {/* Video Modal */}
      {selectedVideo && (
        <VideoPlayerModal
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
          onUpdated={() => loadOrders()}
        />
      )}

      {/* Import Orders Modal */}
      <ImportOrdersModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => loadOrders()}
      />
    </div>
  );
};
