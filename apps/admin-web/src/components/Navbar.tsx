import React, { useEffect, useState } from 'react';
import { LayoutDashboard, Video, Server, LogOut, ShieldCheck, User, Sliders, Package, Building2, Users } from 'lucide-react';
import { AdminUser, adminApi, TenantQuotaStatus } from '../services/api';

export type AdminTab = 'dashboard' | 'orders' | 'videos' | 'stations' | 'settings' | 'tenants' | 'users';

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
  const [quota, setQuota] = useState<TenantQuotaStatus | null>(null);

  const [showQuotaModal, setShowQuotaModal] = useState(false);

  useEffect(() => {
    adminApi.getMyQuota().then(setQuota).catch(() => null);
  }, []);

  const packingUrl = typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:3000`
    : 'http://localhost:3000';

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  return (
    <header className="h-16 bg-slate-800 border-b border-slate-700 px-4 lg:px-6 flex items-center justify-between shadow-lg">
      {/* Brand & Navigation */}
      <div className="flex items-center space-x-4 lg:space-x-6">
        <div className="flex items-center space-x-2.5 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center font-bold text-white shadow-inner">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-black text-white tracking-wide leading-tight">
              PACKING PROOF
            </h1>
            <p className="text-[10px] text-slate-400">Quản Trị Bằng Chứng Video</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="flex items-center space-x-1">
          {user && ['SUPER_ADMIN', 'ADMIN'].includes(user.role) && (
            <button
              onClick={() => onSelectTab('dashboard')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition ${
                currentTab === 'dashboard'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Tổng Quan</span>
            </button>
          )}

          {user && ['SUPER_ADMIN', 'ADMIN', 'WAREHOUSE_MANAGER', 'CUSTOMER_SERVICE'].includes(user.role) && (
            <button
              onClick={() => onSelectTab('orders')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition ${
                currentTab === 'orders'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Đơn Hàng</span>
            </button>
          )}

          <button
            onClick={() => onSelectTab('videos')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition ${
              currentTab === 'videos'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Tra Cứu Video</span>
          </button>

          {user && ['SUPER_ADMIN', 'ADMIN', 'WAREHOUSE_MANAGER'].includes(user.role) && (
            <button
              onClick={() => onSelectTab('stations')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition ${
                currentTab === 'stations'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              <span>Trạm Camera</span>
            </button>
          )}

          {user && ['SUPER_ADMIN', 'ADMIN', 'WAREHOUSE_MANAGER'].includes(user.role) && (
            <button
              onClick={() => onSelectTab('users')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition ${
                currentTab === 'users'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                  : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              <span>Nhân Viên</span>
            </button>
          )}

          {user && ['SUPER_ADMIN', 'ADMIN'].includes(user.role) && (
            <button
              onClick={() => onSelectTab('settings')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition ${
                currentTab === 'settings'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Cấu Hình</span>
            </button>
          )}

          {/* Tenants tab is strictly for platform SUPER_ADMIN */}
          {isSuperAdmin && (
            <button
              onClick={() => onSelectTab('tenants')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition ${
                currentTab === 'tenants'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                  : 'text-blue-300 bg-blue-950/40 hover:bg-blue-900/60 border border-blue-800/50'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-blue-400" />
              <span>Quản Lý Thuê SaaS</span>
            </button>
          )}
        </nav>
      </div>

      {/* User Info & Actions */}
      <div className="flex items-center space-x-3">
        {/* Quick Link to Packing Station */}
        <a
          href={packingUrl}
          target="_blank"
          rel="noreferrer"
          className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-blue-600/20 text-blue-300 border border-blue-500/40 hover:bg-blue-600/40 text-xs font-bold transition shadow-sm"
          title="Mở Bàn Đóng Gói (Quét Barcode & Camera)"
        >
          <Package className="w-3.5 h-3.5 text-blue-400" />
          <span>BÀN ĐÓNG GÓI</span>
        </a>

        {/* Customer Quota Widget (Read-Only) */}
        {!isSuperAdmin && quota && (
          <button
            type="button"
            onClick={() => setShowQuotaModal(true)}
            className="hidden lg:flex items-center space-x-2 px-2.5 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-slate-700 text-xs cursor-pointer transition"
            title="Bấm để xem chi tiết hạn mức gói cước của Shop"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="font-bold text-slate-200">GÓI {quota.planTier}</span>
            <span className="text-slate-500">•</span>
            <span className="font-mono text-slate-400 text-[11px]">
              <strong className="text-emerald-400">{quota.ordersThisMonth}</strong>/{quota.monthlyOrderLimit.toLocaleString()} đơn
            </span>
          </button>
        )}

        {/* User Badge */}
        {user && (
          <div className="flex items-center space-x-2.5 pl-3 border-l border-slate-700">
            <div className="flex items-center space-x-2">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                isSuperAdmin ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-700 text-slate-200'
              }`}>
                {isSuperAdmin ? '👑' : <User className="w-4 h-4" />}
              </div>
              <div className="text-left hidden sm:block">
                <div className="text-xs font-bold text-white truncate max-w-[130px]">
                  {user.fullName || user.username}
                </div>
                <div className="text-[10px] font-bold">
                  {isSuperAdmin ? (
                    <span className="text-amber-400">CHỦ HỆ THỐNG</span>
                  ) : (
                    <span className="text-blue-400 truncate block max-w-[120px]">
                      {user.businessName || 'Quản Lý Shop'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={onLogout}
              title="Đăng xuất"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-700/60 rounded-lg transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Quota Details Modal for Customer (Read-only) */}
      {showQuotaModal && quota && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-black text-white uppercase">
                  THÔNG TIN GÓI CƯỚC SHOP
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowQuotaModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/80 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Doanh Nghiệp / Shop:</span>
                  <span className="font-bold text-white text-sm">{user?.businessName || 'Cửa hàng'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Gói Dịch Vụ:</span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                    GÓI {quota.planTier}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Trạng Thái Gói:</span>
                  <span className="text-emerald-400 font-semibold">✓ Đang hoạt động</span>
                </div>
              </div>

              {/* Progress */}
              <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/80 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Đơn hàng đã đóng tháng này:</span>
                  <span className="font-bold text-emerald-400 font-mono">
                    {quota.ordersThisMonth.toLocaleString()} / {quota.monthlyOrderLimit.toLocaleString()} đơn
                  </span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(100, quota.usagePercent)}%` }}
                  ></div>
                </div>
                <div className="text-[11px] text-right text-slate-400">
                  Đã sử dụng {quota.usagePercent}% hạn mức tháng
                </div>
              </div>

              <div className="p-3 bg-blue-950/30 border border-blue-800/40 rounded-2xl text-[11px] text-blue-300 space-y-1">
                <div className="font-bold">Cần Nâng Cấp Hạn Mức Hoặc Mở Thêm Trạm?</div>
                <p className="text-slate-400">
                  Vui lòng liên hệ Quản trị viên hệ thống để nâng gói cước hoặc mua thêm trạm đóng gói camera.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowQuotaModal(false)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition cursor-pointer"
            >
              ĐÓNG
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
