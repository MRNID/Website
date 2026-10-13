import React, { useState, useEffect } from 'react';
import {
  Camera,
  RefreshCw,
  KeyRound,
  WifiOff,
  CheckCircle2,
  Sliders,
  Building2,
  Warehouse,
  Filter,
  Search
} from 'lucide-react';
import { adminApi, AdminUser } from '../services/api';
import { CameraCalibrationModal } from '../components/CameraCalibrationModal';

interface StationsPageProps {
  user?: AdminUser;
}

export const StationsPage: React.FC<StationsPageProps> = ({ user }) => {
  const [stations, setStations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tenants, setTenants] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedBizId, setSelectedBizId] = useState<string>('ALL');
  const [selectedWhId, setSelectedWhId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [unlockStationId, setUnlockStationId] = useState<string | null>(null);
  const [unlockReason, setUnlockReason] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockMessage, setUnlockMessage] = useState<string | null>(null);
  const [calibratingStation, setCalibratingStation] = useState<any | null>(null);

  const fetchStationsAndFilters = async () => {
    setLoading(true);
    try {
      const [resStations, resWh] = await Promise.all([
        adminApi.getStations({
          businessId: selectedBizId !== 'ALL' ? selectedBizId : undefined,
          warehouseId: selectedWhId !== 'ALL' ? selectedWhId : undefined
        }),
        adminApi.getWarehouses(selectedBizId !== 'ALL' ? selectedBizId : undefined).catch(() => [])
      ]);
      setStations(resStations || []);
      setWarehouses(resWh || []);

      if (user?.role === 'SUPER_ADMIN') {
        const resTenants = await adminApi.getTenants().catch(() => []);
        setTenants(resTenants || []);
      }
    } catch (err) {
      console.error('Failed to fetch stations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStationsAndFilters();
  }, [selectedBizId, selectedWhId]);

  const handleForceUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockStationId || !unlockReason.trim()) return;

    setIsUnlocking(true);
    try {
      await adminApi.forceUnlockStation(unlockStationId, unlockReason);
      setUnlockMessage(`Đã mở khóa thành công cho trạm!`);
      setUnlockStationId(null);
      setUnlockReason('');
      fetchStationsAndFilters();
      setTimeout(() => setUnlockMessage(null), 3000);
    } catch (err: any) {
      alert(`Lỗi mở khóa: ${err.message}`);
    } finally {
      setIsUnlocking(false);
    }
  };

  const filteredStations = stations.filter(st => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        st.name?.toLowerCase().includes(q) ||
        st.code?.toLowerCase().includes(q) ||
        st.computerName?.toLowerCase().includes(q) ||
        st.ipAddress?.toLowerCase().includes(q) ||
        st.businessName?.toLowerCase().includes(q) ||
        st.warehouseName?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white tracking-wide">
            QUẢN LÝ TRẠM ĐÓNG GÓI & CAMERA
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Quản trị các máy tính đóng gói và mắt camera riêng biệt cho từng trạm theo Doanh nghiệp & Kho hàng
          </p>
        </div>

        <button
          onClick={fetchStationsAndFilters}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center space-x-2 transition cursor-pointer"
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

      {/* Filter Bar */}
      <div className="bg-slate-850 bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs shadow-lg">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-1.5 text-slate-400 font-medium">
            <Filter className="w-4 h-4 text-purple-400" />
            <span>Bộ lọc:</span>
          </div>

          {/* Company Filter (SUPER_ADMIN) */}
          {user?.role === 'SUPER_ADMIN' && (
            <div className="flex items-center space-x-1.5">
              <Building2 className="w-3.5 h-3.5 text-purple-400" />
              <select
                value={selectedBizId}
                onChange={e => {
                  setSelectedBizId(e.target.value);
                  setSelectedWhId('ALL');
                }}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 font-semibold focus:outline-none focus:border-purple-500"
              >
                <option value="ALL">🏢 Tất cả Doanh nghiệp / Shop</option>
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Warehouse Filter */}
          <div className="flex items-center space-x-1.5">
            <Warehouse className="w-3.5 h-3.5 text-amber-400" />
            <select
              value={selectedWhId}
              onChange={e => setSelectedWhId(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 font-semibold focus:outline-none focus:border-amber-500"
            >
              <option value="ALL">📦 Tất cả Kho hàng</option>
              {warehouses.map(wh => (
                <option key={wh.id} value={wh.id}>
                  {wh.name} ({wh.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Search */}
        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Tìm theo mã, tên trạm, IP..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-6">
        {filteredStations.map((st) => (
          <div
            key={st.id}
            className="bg-slate-800/90 border border-slate-700/80 hover:border-slate-600 rounded-3xl p-6 shadow-xl space-y-5 transition"
          >
            {/* Station Header */}
            <div className="flex items-start justify-between border-b border-slate-700/80 pb-4">
              <div className="flex items-start space-x-3 min-w-0">
                <span className="px-2.5 py-1 rounded-lg bg-blue-950/90 border border-blue-500/50 text-blue-300 font-mono font-bold text-xs shrink-0 tracking-wider shadow-inner">
                  {st.code}
                </span>
                <div className="min-w-0">
                  <h3 className="font-bold text-white text-base leading-snug truncate" title={st.name}>
                    {st.name}
                  </h3>

                  {/* Scoping metadata tags */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {st.businessName && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-purple-950/70 border border-purple-800/60 text-purple-300 text-[10px] font-medium">
                        <Building2 className="w-3 h-3 mr-1 text-purple-400" />
                        {st.businessName}
                      </span>
                    )}
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-slate-300 text-[10px] font-medium">
                      <Warehouse className="w-3 h-3 mr-1 text-amber-400" />
                      {st.warehouseName || 'Kho trung tâm'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono ml-0.5">ID: {st.id.slice(0, 8)}...</span>
                  </div>
                </div>
              </div>

              <div className="shrink-0 pl-2">
                <div className={`flex items-center space-x-1.5 px-3 py-1 rounded-full border text-xs font-bold ${
                  st.status === 'ONLINE'
                    ? 'bg-emerald-950/80 text-emerald-400 border-emerald-700/60'
                    : 'bg-slate-900 text-rose-400 border-rose-800/60'
                }`}>
                  {st.status === 'ONLINE' ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-emerald-300">ONLINE</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-3.5 h-3.5 text-rose-500" />
                      <span className="text-rose-400">OFFLINE</span>
                    </>
                  )}
                </div>
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
                Lần cuối nhịp tim: {st.lastHeartbeatAt ? new Date(st.lastHeartbeatAt).toLocaleTimeString('vi-VN') : 'Vừa xong'}
              </span>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setCalibratingStation(st)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-blue-900/30 transition cursor-pointer"
                  title="Cân chỉnh góc quay mắt camera và thu phóng ống kính"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Chỉnh Mắt Cam & Zoom</span>
                </button>

                <button
                  onClick={() => setUnlockStationId(st.id)}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-rose-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  <span>Mở khóa cưỡng bức</span>
                </button>
              </div>
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

      {/* Camera Calibration & Zoom Modal */}
      <CameraCalibrationModal
        isOpen={!!calibratingStation}
        station={calibratingStation}
        onClose={() => setCalibratingStation(null)}
      />
    </div>
  );
};
