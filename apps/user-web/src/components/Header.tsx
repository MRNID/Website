import React, { useState, useEffect } from 'react';
import { Camera, Server, User, Wifi, WifiOff, LogOut, Clock } from 'lucide-react';
import { UserSession, StationInfo } from '../services/api';

interface HeaderProps {
  user: UserSession | null;
  stations: StationInfo[];
  currentStation: StationInfo | null;
  onSelectStation: (station: StationInfo) => void;
  workerOnline: boolean;
  wsConnected: boolean;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  stations,
  currentStation,
  onSelectStation,
  workerOnline,
  wsConnected,
  onLogout
}) => {
  const [time, setTime] = useState<string>(new Date().toLocaleTimeString('vi-VN'));

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('vi-VN'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="h-16 bg-slate-800 border-b border-slate-700 px-6 flex items-center justify-between shadow-md">
      {/* Brand & Station Selector */}
      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-xl text-white shadow-inner">
            VP
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-wide leading-tight">
              PACKING VIDEO PROOF
            </h1>
            <p className="text-xs text-slate-400">Trạm Đóng Gói Chuyên Dụng (LAN)</p>
          </div>
        </div>

        {/* Station Dropdown */}
        <div className="flex items-center space-x-2 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-700">
          <Server className="w-4 h-4 text-blue-400" />
          <span className="text-xs text-slate-400 font-medium">Bàn máy:</span>
          <select
            value={currentStation?.id || ''}
            onChange={(e) => {
              const selected = stations.find((s) => s.id === e.target.value);
              if (selected) onSelectStation(selected);
            }}
            className="bg-transparent text-sm font-semibold text-white focus:outline-none cursor-pointer"
          >
            {stations.map((s) => (
              <option key={s.id} value={s.id} className="bg-slate-800 text-white">
                {s.code} - {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Diagnostics / Status Indicators */}
      <div className="flex items-center space-x-5">
        {/* Worker Daemon Indicator */}
        <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-700 text-xs">
          <div className={`w-2.5 h-2.5 rounded-full ${workerOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
          <span className="text-slate-300 font-medium">
            Worker: {workerOnline ? 'Online' : 'Mất kết nối'}
          </span>
        </div>

        {/* Camera Indicator */}
        <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-700 text-xs">
          <Camera className={`w-3.5 h-3.5 ${workerOnline ? 'text-emerald-400' : 'text-slate-500'}`} />
          <span className="text-slate-300 font-medium">
            {currentStation?.camera?.name || 'CAM_PACK01'}
          </span>
        </div>

        {/* WebSocket Indicator */}
        <div className="flex items-center space-x-1.5 text-xs text-slate-400">
          {wsConnected ? (
            <Wifi className="w-4 h-4 text-emerald-400" />
          ) : (
            <WifiOff className="w-4 h-4 text-amber-400" />
          )}
          <span>{wsConnected ? 'Live Gateway' : 'Mất WS'}</span>
        </div>

        {/* Clock */}
        <div className="flex items-center space-x-1.5 text-slate-200 text-sm font-mono-nums font-semibold px-2">
          <Clock className="w-4 h-4 text-slate-400" />
          <span>{time}</span>
        </div>

        {/* Operator Profile */}
        {user && (
          <div className="flex items-center space-x-3 pl-4 border-l border-slate-700">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-200 font-bold text-xs border border-slate-600">
                <User className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="text-xs font-semibold text-white">{user.fullName || user.username}</div>
                <div className="text-[10px] text-blue-400 uppercase tracking-wider">{user.role}</div>
              </div>
            </div>

            <button
              onClick={onLogout}
              title="Đăng xuất"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-700 rounded-md transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
