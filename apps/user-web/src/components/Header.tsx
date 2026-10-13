import React, { useState, useEffect } from 'react';
import { Camera, Server, User, Wifi, WifiOff, LogOut, Clock, Smartphone, Cloud, LayoutDashboard, ExternalLink } from 'lucide-react';
import { UserSession, StationInfo } from '../services/api';

interface HeaderProps {
  user: UserSession | null;
  stations: StationInfo[];
  currentStation: StationInfo | null;
  onSelectStation: (station: StationInfo) => void;
  workerOnline: boolean;
  wsConnected: boolean;
  onLogout: () => void;
  onToggleMobileMode?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  stations,
  currentStation,
  onSelectStation,
  workerOnline,
  wsConnected,
  onLogout,
  onToggleMobileMode
}) => {
  const [time, setTime] = useState<string>(new Date().toLocaleTimeString('vi-VN'));
  const [driveEmail, setDriveEmail] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('vi-VN'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const bizId = (user as any)?.businessId || 'dc587f70-9c97-4149-a938-f56e76570689';
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    fetch(`http://${host}:4000/api/v1/businesses/${bizId}/google-drive`)
      .then((r) => r.json())
      .then((d) => {
        if (d.data?.connected && d.data?.email) {
          setDriveEmail(d.data.email);
        }
      })
      .catch(() => {});
  }, [user]);

  return (
    <header className="h-12 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shadow-sm shrink-0 z-20">
      {/* Left: Brand & Station Selector */}
      <div className="flex items-center space-x-3.5">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center font-black text-xs text-white shadow-inner">
            VP
          </div>
          <span className="text-xs font-black tracking-wider text-white uppercase hidden sm:inline">
            PACKING PROOF
          </span>
        </div>

        {/* Station Selector Dropdown */}
        <div className="flex items-center space-x-1.5 bg-slate-800/90 px-2.5 py-1 rounded-lg border border-slate-700/80">
          <Server className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="text-[11px] text-slate-400 font-semibold">Trạm:</span>
          <select
            value={currentStation?.id || ''}
            onChange={(e) => {
              const selected = stations.find((s) => s.id === e.target.value);
              if (selected) onSelectStation(selected);
            }}
            className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer max-w-[180px] truncate"
          >
            {stations.map((s) => (
              <option key={s.id} value={s.id} className="bg-slate-800 text-white">
                {s.code} - {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Admin Portal Shortcut (Admins & Managers only) */}
        {user && ['SUPER_ADMIN', 'ADMIN', 'WAREHOUSE_MANAGER'].includes(user.role) && (
          <a
            href="http://localhost:3001"
            target="_blank"
            rel="noreferrer"
            className="hidden xl:flex items-center space-x-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/50 hover:bg-emerald-900/50 px-2.5 py-1 rounded-lg border border-emerald-600/40 transition"
            title="Mở Cổng Quản Trị Hệ Thống"
          >
            <LayoutDashboard className="w-3 h-3" />
            <span>QUẢN TRỊ ADMIN</span>
            <ExternalLink className="w-2.5 h-2.5 text-slate-400" />
          </a>
        )}
      </div>

      {/* Center: Live Diagnostic Badges */}
      <div className="hidden md:flex items-center space-x-2.5 text-xs">
        {/* Worker Daemon Indicator */}
        <div
          className={`flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-medium ${
            workerOnline
              ? 'bg-emerald-950/40 border-emerald-600/50 text-emerald-300'
              : 'bg-rose-950/60 border-rose-600/60 text-rose-300 animate-pulse'
          }`}
          title={workerOnline ? 'Dịch vụ quay video đang hoạt động tốt' : 'Mất kết nối với dịch vụ video worker'}
        >
          <span className={`w-2 h-2 rounded-full ${workerOnline ? 'bg-emerald-400' : 'bg-rose-500'}`} />
          <span>Worker: {workerOnline ? 'Online' : 'Mất kết nối'}</span>
        </div>

        {/* Camera Indicator */}
        <div
          className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-slate-800/80 border border-slate-700 text-[11px] text-slate-300"
          title="Tên thiết bị camera LAN đang gán cho trạm"
        >
          <Camera className="w-3 h-3 text-blue-400" />
          <span className="truncate max-w-[130px] font-mono">{currentStation?.camera?.name || 'CAM_PACK01'}</span>
        </div>

        {/* Cloud Sync Status */}
        {driveEmail && (
          <div
            className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-slate-800/80 border border-slate-700 text-[11px] text-slate-300 hidden lg:flex"
            title="Tài khoản Google Drive đã liên kết"
          >
            <Cloud className="w-3 h-3 text-cyan-400" />
            <span className="truncate max-w-[120px] font-mono">{driveEmail.split('@')[0]}</span>
          </div>
        )}

        {/* Gateway WebSocket */}
        <div
          className="flex items-center space-x-1 text-[11px] text-slate-400"
          title={wsConnected ? 'Cổng sự kiện WebSocket thời gian thực hoạt động' : 'Mất kết nối WebSocket'}
        >
          {wsConnected ? (
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-amber-400" />
          )}
          <span className="hidden xl:inline">{wsConnected ? 'Gateway Live' : 'Mất WS'}</span>
        </div>
      </div>

      {/* Right: User Profile, Clock, Actions */}
      <div className="flex items-center space-x-3">
        {/* Real-time Clock */}
        <div className="flex items-center space-x-1 text-slate-300 font-mono text-xs font-semibold px-1">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>{time}</span>
        </div>

        {/* User Info Badge */}
        {user && (
          <div className="flex items-center space-x-2 pl-2 border-l border-slate-700/80">
            <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
              <User className="w-3 h-3" />
            </div>
            <div className="text-left hidden sm:block">
              <span className="text-xs font-bold text-white block leading-tight">
                {user.fullName || user.username}
              </span>
              <span className="text-[10px] text-emerald-400 font-black uppercase font-mono tracking-tight">
                {user.role}
              </span>
            </div>
          </div>
        )}

        {/* Switch to Smartphone Mode */}
        {onToggleMobileMode && (
          <button
            type="button"
            onClick={onToggleMobileMode}
            className="hidden sm:flex items-center space-x-1 px-2 py-1 rounded bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-600/50 text-[11px] font-bold transition cursor-pointer"
            title="Kích hoạt chế độ Trạm Đóng Gói Di Động (Smartphone)"
          >
            <Smartphone className="w-3 h-3 text-indigo-400" />
            <span>Mobile</span>
          </button>
        )}

        {/* Logout */}
        <button
          type="button"
          onClick={onLogout}
          title="Đăng xuất khỏi bàn đóng gói"
          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
