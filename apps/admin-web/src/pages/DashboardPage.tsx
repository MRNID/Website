import React, { useEffect, useState } from 'react';
import { PackageCheck, Video, AlertCircle, Server, RefreshCw, HardDrive, ShieldCheck } from 'lucide-react';
import { adminApi, DashboardStats } from '../services/api';

export const DashboardPage: React.FC<{ onNavigateToVideos: () => void }> = ({ onNavigateToVideos }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [stations, setStations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, st] = await Promise.all([
        adminApi.getDashboardStats(),
        adminApi.getStations()
      ]);
      setStats(s);
      setStations(st);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white tracking-wide">
            BẢNG ĐIỀU KHIỂN HỆ THỐNG
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Giám sát vận hành thời gian thực kho hàng & trạm đóng gói video
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center space-x-2 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>LÀM MỚI</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-5">
        {/* Packed Today */}
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              ĐÃ ĐÓNG GÓI HÔM NAY
            </span>
            <div className="text-4xl font-black text-white mt-1 font-mono">
              {stats?.packedToday ?? '--'}
            </div>
            <span className="text-[11px] text-emerald-400 mt-1 block">
              ✓ Niêm phong SHA-256
            </span>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center">
            <PackageCheck className="w-7 h-7 text-emerald-400" />
          </div>
        </div>

        {/* Active Now */}
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              ĐANG QUAY TRỰC TIẾP
            </span>
            <div className="text-4xl font-black text-white mt-1 font-mono">
              {stats?.activeRecordingNow ?? '--'}
            </div>
            <span className="text-[11px] text-red-400 animate-pulse mt-1 block">
              ● Recording stream
            </span>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-red-600/20 border border-red-500/30 flex items-center justify-center">
            <Video className="w-7 h-7 text-red-400" />
          </div>
        </div>

        {/* Disputes / Locked */}
        <div
          onClick={onNavigateToVideos}
          className="bg-slate-800/90 hover:bg-slate-750 border border-slate-700 rounded-2xl p-5 shadow-lg flex items-center justify-between cursor-pointer transition"
        >
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              ĐƠN KHIẾU NẠI / KHÓA
            </span>
            <div className="text-4xl font-black text-amber-300 mt-1 font-mono">
              {stats?.disputesCount ?? '--'}
            </div>
            <span className="text-[11px] text-amber-400 mt-1 block">
              Bấm để xem danh sách →
            </span>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-amber-600/20 border border-amber-500/30 flex items-center justify-center">
            <AlertCircle className="w-7 h-7 text-amber-400" />
          </div>
        </div>

        {/* Stations Online */}
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              TRẠM ĐÓNG GÓI HOẠT ĐỘNG
            </span>
            <div className="text-4xl font-black text-white mt-1 font-mono">
              {stats ? `${stats.onlineStations}/${stats.totalStations}` : '--'}
            </div>
            <span className="text-[11px] text-blue-400 mt-1 block">
              Worker Service LAN
            </span>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
            <Server className="w-7 h-7 text-blue-400" />
          </div>
        </div>
      </div>

      {/* Stations Health Table */}
      <div className="bg-slate-800/90 border border-slate-700 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-700/80 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <Server className="w-5 h-5 text-emerald-400" />
              <span>TÌNH TRẠNG CÁC TRẠM ĐÓNG GÓI (STATIONS)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Tất cả các máy trạm kết nối mạng nội bộ và video worker daemon
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {stations.map((st) => (
            <div
              key={st.id}
              className="bg-slate-900/80 border border-slate-700/60 rounded-2xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-bold text-sm text-white">
                    {st.code}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    ({st.name})
                  </span>
                </div>
                <div className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-slate-800 text-[11px] font-semibold border border-slate-700">
                  <div className={`w-2 h-2 rounded-full ${st.status === 'ONLINE' ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                  <span className={st.status === 'ONLINE' ? 'text-emerald-300' : 'text-rose-300'}>
                    {st.status}
                  </span>
                </div>
              </div>

              <div className="space-y-1 text-xs text-slate-400">
                <div className="flex justify-between">
                  <span>Máy trạm:</span>
                  <span className="text-slate-200 font-mono">{st.computerName || 'PACK-PC01'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Địa chỉ IP:</span>
                  <span className="text-slate-200 font-mono">{st.ipAddress || '192.168.1.101'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Camera:</span>
                  <span className="text-slate-200">{st.camera?.name || 'CAM_PACK01'}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center space-x-1 text-emerald-400 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>SHA-256 OK</span>
                </span>
                <span className="flex items-center space-x-1 text-blue-400 font-medium">
                  <HardDrive className="w-3.5 h-3.5" />
                  <span>NAS Sync Ready</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
