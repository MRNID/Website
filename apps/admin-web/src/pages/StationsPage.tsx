import React, { useState, useEffect } from 'react';
import { Server, Camera, RefreshCw, KeyRound, Wifi, WifiOff, CheckCircle2 } from 'lucide-react';
import { adminApi } from '../services/api';

export const StationsPage: React.FC = () => {
  const [stations, setStations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [unlockStationId, setUnlockStationId] = useState<string | null>(null);
  const [unlockReason, setUnlockReason] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockMessage, setUnlockMessage] = useState<string | null>(null);

  const fetchStations = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getStations();
      setStations(res);
    } catch (err) {
      console.error('Failed to fetch stations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStations();
  }, []);

  const handleForceUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockStationId || !unlockReason.trim()) return;

    setIsUnlocking(true);
    try {
      await adminApi.forceUnlockStation(unlockStationId, unlockReason);
      setUnlockMessage(`Đã mở khóa thành công cho trạm!`);
      setUnlockStationId(null);
      setUnlockReason('');
      fetchStations();
      setTimeout(() => setUnlockMessage(null), 3000);
    } catch (err: any) {
      alert(`Lỗi mở khóa: ${err.message}`);
    } finally {
      setIsUnlocking(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white tracking-wide">
            QUẢN LÝ TRẠM ĐÓNG GÓI & CAMERA
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Danh sách các máy tính đóng gói, camera giám sát và trạng thái Video Worker daemon
          </p>
        </div>

        <button
          onClick={fetchStations}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center space-x-2 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>LÀM MỚI DANH SÁCH</span>
        </button>
      </div>

      {unlockMessage && (
        <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs font-bold flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{unlockMessage}</span>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-2 gap-6">
        {stations.map((st) => (
          <div
            key={st.id}
            className="bg-slate-800/90 border border-slate-700 rounded-3xl p-6 shadow-xl space-y-5"
          >
            {/* Station Header */}
            <div className="flex items-center justify-between border-b border-slate-700/80 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center">
                  <Server className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    {st.name} ({st.code})
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">ID: {st.id}</span>
                </div>
              </div>

              <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-700 text-xs font-bold">
                {st.status === 'ONLINE' ? (
                  <>
                    <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300">HOẠT ĐỘNG (ONLINE)</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3.5 h-3.5 text-rose-500" />
                    <span className="text-rose-400">MẤT TÍN HIỆU</span>
                  </>
                )}
              </div>
            </div>

            {/* Station details */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-700/50 space-y-1">
                <span className="text-slate-500 text-[10px] block uppercase font-bold">Máy trạm PC:</span>
                <div className="font-mono text-white font-semibold">{st.computerName || 'PACK-PC01'}</div>
                <div className="font-mono text-slate-400 text-[11px]">{st.ipAddress || '192.168.1.101'}</div>
              </div>

              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-700/50 space-y-1">
                <span className="text-slate-500 text-[10px] block uppercase font-bold">Camera giám sát:</span>
                <div className="text-white font-semibold flex items-center space-x-1">
                  <Camera className="w-3.5 h-3.5 text-blue-400" />
                  <span>{st.camera?.name || 'CAM_PACK01'}</span>
                </div>
                <div className="text-slate-400 text-[11px] font-mono">Loại: {st.camera?.type || 'RTSP_H264'}</div>
              </div>
            </div>

            {/* Footer actions */}
            <div className="pt-2 flex items-center justify-between border-t border-slate-700/80">
              <span className="text-[11px] text-slate-400">
                Lần cuối nhận nhịp tim: {st.lastHeartbeatAt ? new Date(st.lastHeartbeatAt).toLocaleTimeString('vi-VN') : 'Vừa xong'}
              </span>

              <button
                onClick={() => setUnlockStationId(st.id)}
                className="px-3 py-1.5 bg-slate-700 hover:bg-rose-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition"
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                <span>Mở khóa cưỡng bức</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Force Unlock Modal */}
      {unlockStationId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 border-2 border-red-500 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <KeyRound className="w-5 h-5 text-red-400" />
              <span>XÁC NHẬN MỞ KHÓA TRẠM</span>
            </h3>

            <p className="text-xs text-slate-300">
              Hành động này sẽ giải phóng trạng thái kẹt của trạm và hủy phiên quay chưa hoàn tất. Vui lòng ghi rõ lý do vào nhật ký kiểm toán.
            </p>

            <form onSubmit={handleForceUnlock} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Lý do mở khóa:
                </label>
                <input
                  type="text"
                  required
                  value={unlockReason}
                  onChange={(e) => setUnlockReason(e.target.value)}
                  placeholder="VD: Mất điện đột ngột, camera treo..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setUnlockStationId(null)}
                  className="py-2.5 rounded-xl bg-slate-700 text-slate-200 text-xs font-bold"
                >
                  HỦY
                </button>
                <button
                  type="submit"
                  disabled={isUnlocking}
                  className="py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold"
                >
                  {isUnlocking ? 'Đang mở khóa...' : 'MỞ KHÓA NGAY'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
