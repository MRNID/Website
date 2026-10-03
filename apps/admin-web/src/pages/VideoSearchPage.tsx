import React, { useState, useEffect, useCallback } from 'react';
import { Search, Filter, Lock, ShieldCheck, Play, RefreshCw } from 'lucide-react';
import { adminApi, VideoRecord } from '../services/api';
import { VideoPlayerModal } from '../components/VideoPlayerModal';

export const VideoSearchPage: React.FC = () => {
  const [trackingCode, setTrackingCode] = useState('');
  const [orderCode, setOrderCode] = useState('');
  const [disputeStatus, setDisputeStatus] = useState('ALL');

  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoRecord | null>(null);

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.searchVideos({
        trackingCode: trackingCode.trim() || undefined,
        orderCode: orderCode.trim() || undefined,
        disputeStatus: disputeStatus !== 'ALL' ? disputeStatus : undefined,
        limit: 50
      });
      setVideos(res.items);
      setTotal(res.total);
    } catch (err: any) {
      console.error('Failed to search videos:', err);
    } finally {
      setLoading(false);
    }
  }, [trackingCode, orderCode, disputeStatus]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchVideos();
  };

  const formatFileSize = (bytes: number) => {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white tracking-wide">
            TRA CỨU BẰNG CHỨNG VIDEO & XỬ LÝ KHIẾU NẠI
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Tìm kiếm bằng chứng đóng gói video theo mã vận đơn, kiểm tra tính toàn vẹn và kháng cáo sàn
          </p>
        </div>

        <button
          onClick={fetchVideos}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center space-x-2 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>LÀM MỚI KẾT QUẢ</span>
        </button>
      </div>

      {/* Filter Card */}
      <form
        onSubmit={handleSearchSubmit}
        className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-lg grid grid-cols-12 gap-4 items-end"
      >
        <div className="col-span-4">
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Mã vận đơn (Tracking Code)
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
            <input
              type="text"
              value={trackingCode}
              onChange={(e) => setTrackingCode(e.target.value)}
              placeholder="VD: SPXVN0458892182B..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="col-span-3">
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Mã đơn hàng nội bộ
          </label>
          <input
            type="text"
            value={orderCode}
            onChange={(e) => setOrderCode(e.target.value)}
            placeholder="VD: ORD-992182..."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="col-span-3">
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Trạng thái khiếu nại
          </label>
          <div className="relative">
            <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
            <select
              value={disputeStatus}
              onChange={(e) => setDisputeStatus(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="ALL">Tất cả video</option>
              <option value="UNDER_REVIEW">Đang kiểm tra nội bộ</option>
              <option value="SUBMITTED_TO_CARRIER">Đã gửi sàn / ĐVVC</option>
              <option value="WON">Khiếu nại thành công (Thắng)</option>
              <option value="LOST">Khiếu nại thất bại (Thua)</option>
            </select>
          </div>
        </div>

        <div className="col-span-2">
          <button
            type="submit"
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/30 transition cursor-pointer"
          >
            <Search className="w-4 h-4" />
            <span>TÌM KIẾM</span>
          </button>
        </div>
      </form>

      {/* Results Table */}
      <div className="bg-slate-800/90 border border-slate-700 rounded-3xl overflow-hidden shadow-xl">
        <div className="p-4 px-6 border-b border-slate-700 flex items-center justify-between">
          <span className="text-sm font-bold text-white">
            KẾT QUẢ TÌM THẤY: <strong className="text-emerald-400 font-mono">{total}</strong> VIDEO
          </span>
          <span className="text-xs text-slate-400">Hiển thị tối đa 50 video gần nhất</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 font-bold uppercase text-[11px] border-b border-slate-700">
              <tr>
                <th className="py-3 px-4">Mã Vận Đơn / Đơn Hàng</th>
                <th className="py-3 px-4">Nền Tảng</th>
                <th className="py-3 px-4">Thời Gian Đóng</th>
                <th className="py-3 px-4">Trạm / Nhân Viên</th>
                <th className="py-3 px-4">Thời Lượng</th>
                <th className="py-3 px-4">Mã Băm SHA-256</th>
                <th className="py-3 px-4">Khiếu Nại / Khóa</th>
                <th className="py-3 px-4 text-center">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {loading && videos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Đang tìm kiếm bằng chứng video...
                  </td>
                </tr>
              ) : videos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Không tìm thấy video nào phù hợp với bộ lọc tìm kiếm.
                  </td>
                </tr>
              ) : (
                videos.map((vid) => (
                  <tr key={vid.id} className="hover:bg-slate-750 transition">
                    <td className="py-3.5 px-4 font-mono">
                      <div className="font-bold text-white text-sm">{vid.tracking_code}</div>
                      <div className="text-[11px] text-slate-400">{vid.order_code}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="bg-blue-900/50 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded font-bold">
                        {vid.platform}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-300">
                      {new Date(vid.created_at).toLocaleString('vi-VN')}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">{vid.station_code}</div>
                      <div className="text-[11px] text-slate-400">{vid.operator_name}</div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      <div>{vid.duration} giây</div>
                      <div className="text-[10px] text-slate-500">{formatFileSize(vid.file_size)}</div>
                    </td>

                    <td className="py-3.5 px-4 font-mono">
                      <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded text-[11px] flex items-center space-x-1 w-max">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        <span>{vid.sha256.slice(0, 10)}...</span>
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      {vid.is_locked ? (
                        <span className="bg-amber-950/80 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded text-[11px] font-bold flex items-center space-x-1 w-max">
                          <Lock className="w-3 h-3" />
                          <span>ĐÃ KHÓA ({vid.dispute_status})</span>
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[11px]">Bình thường</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => setSelectedVideo(vid)}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition flex items-center space-x-1.5 mx-auto cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        <span>XEM VIDEO</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Video Player Modal */}
      <VideoPlayerModal
        video={selectedVideo}
        onClose={() => setSelectedVideo(null)}
        onUpdated={() => fetchVideos()}
      />
    </div>
  );
};
