import React from 'react';
import { LayoutDashboard, Video, Server, LogOut, ShieldCheck, User } from 'lucide-react';
import { AdminUser } from '../services/api';

export type AdminTab = 'dashboard' | 'videos' | 'stations';

interface NavbarProps {
  currentTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
  user: AdminUser | null;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  user,
  onLogout
}) => {
  return (
    <header className="h-16 bg-slate-800 border-b border-slate-700 px-6 flex items-center justify-between shadow-lg">
      {/* Brand */}
      <div className="flex items-center space-x-8">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center font-bold text-white shadow-inner">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-wide leading-tight">
              PACKING VIDEO PROOF
            </h1>
            <p className="text-xs text-slate-400">Cổng Quản Trị & Tra Cứu Bằng Chứng Video</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="flex items-center space-x-2">
          <button
            onClick={() => onSelectTab('dashboard')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition ${
              currentTab === 'dashboard'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-300 hover:bg-slate-700'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>TỔNG QUAN</span>
          </button>

          <button
            onClick={() => onSelectTab('videos')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition ${
              currentTab === 'videos'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Video className="w-4 h-4" />
            <span>TRA CỨU & KHIẾU NẠI</span>
          </button>

          <button
            onClick={() => onSelectTab('stations')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition ${
              currentTab === 'stations'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>TRẠM ĐÓNG GÓI & CAMERA</span>
          </button>
        </nav>
      </div>

      {/* User Info & Actions */}
      <div className="flex items-center space-x-4">
        {user && (
          <div className="flex items-center space-x-3 pl-4 border-l border-slate-700">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-200">
                <User className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="text-xs font-semibold text-white">{user.fullName || user.username}</div>
                <div className="text-[10px] text-emerald-400 font-bold uppercase">{user.role}</div>
              </div>
            </div>

            <button
              onClick={onLogout}
              title="Đăng xuất"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-700 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
