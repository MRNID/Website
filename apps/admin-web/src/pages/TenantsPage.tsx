import React, { useEffect, useState, useCallback } from 'react';
import {
  Building2,
  Plus,
  Search,
  RefreshCw,
  Phone,
  Mail,
  User,
  ShieldCheck,
  Lock,
  Unlock,
  Edit,
  TrendingUp,
  HardDrive,
  Clock,
  Sparkles,
  Zap,
  CheckCircle2,
  X,
  CreditCard,
  Key,
  Copy
} from 'lucide-react';
import { adminApi, TenantRecord, TenantStats, AdminUser } from '../services/api';
import { GoogleDriveModal } from '../components/GoogleDriveModal';

interface TenantsPageProps {
  user?: AdminUser;
}

export const TenantsPage: React.FC<TenantsPageProps> = ({ user }) => {
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [stats, setStats] = useState<TenantStats | null>(null);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<TenantRecord | null>(null);
  const [renewingTenant, setRenewingTenant] = useState<TenantRecord | null>(null);
  const [driveModalTenant, setDriveModalTenant] = useState<TenantRecord | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tList, sData] = await Promise.all([
        adminApi.getTenants(search.trim() || undefined),
        adminApi.getTenantStats().catch(() => null)
      ]);
      setTenants(tList);
      if (sData) setStats(sData);
    } catch (err: any) {
      console.error('Failed to load tenants:', err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter tenants
  const filteredTenants = tenants.filter(t => {
    if (planFilter !== 'ALL' && t.planTier !== planFilter) return false;
    if (statusFilter !== 'ALL' && t.subscriptionStatus !== statusFilter) return false;
    return true;
  });

  const handleToggleActive = async (tenant: TenantRecord) => {
    const newStatus = tenant.isActive ? false : true;
    const action = newStatus ? 'mở khóa' : 'tạm khóa';
    if (!window.confirm(`Bạn có chắc chắn muốn ${action} tài khoản công ty "${tenant.name}" không?`)) {
      return;
    }
    try {
      await adminApi.updateTenant(tenant.id, { isActive: newStatus });
      await loadData();
    } catch (err: any) {
      alert(`Lỗi cập nhật: ${err.message}`);
    }
  };

  if (user && user.role !== 'SUPER_ADMIN') {
    return (
      <div className="bg-slate-900 border border-slate-800 p-12 rounded-3xl text-center space-y-4 shadow-xl max-w-lg mx-auto mt-12">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-black text-white uppercase tracking-wide">
          BẠN KHÔNG CÓ QUYỀN TRUY CẬP
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          Trang Quản lý Doanh nghiệp & Hợp đồng thuê SaaS chỉ dành riêng cho Quản trị viên cấp cao (Chủ Hệ Thống). Để nâng cấp gói cước, vui lòng liên hệ quản trị viên.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-5 rounded-3xl shadow-xl">
        <div>
          <div className="flex items-center space-x-2.5">
            <span className="p-2 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Building2 className="w-5 h-5" />
            </span>
            <h2 className="text-2xl font-black text-white tracking-wide uppercase">
              QUẢN LÝ DOANH NGHIỆP & GÓI CƯỚC THUÊ WEB
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Mô hình SaaS Multi-tenant: Quản lý khách hàng thuê web, định mức đơn hàng tháng và doanh thu định kỳ MRR
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-lg shadow-emerald-600/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ THÊM KHÁCH HÀNG THUÊ MỚI</span>
          </button>

          <button
            type="button"
            onClick={loadData}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>LÀM MỚI</span>
          </button>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Metric 1: Total Tenants */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-3xl p-5 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              KHÁCH HÀNG / CÔNG TY THUÊ
            </span>
            <div className="text-4xl font-black text-white mt-1 font-mono">
              {stats?.totalTenants ?? tenants.length}
            </div>
            <span className="text-[11px] text-emerald-400 mt-1 block">
              ✓ {stats?.activeTenants ?? tenants.filter(t => t.isActive).length} công ty đang hoạt động
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-blue-400" />
          </div>
        </div>

        {/* Metric 2: Monthly Recurring Revenue (MRR) */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-3xl p-5 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              DOANH THU ĐỊNH KỲ (MRR)
            </span>
            <div className="text-3xl font-black text-amber-300 mt-1 font-mono">
              {stats?.totalMrr ? `${(stats.totalMrr / 1000).toLocaleString('vi-VN')}K` : '0đ'}
            </div>
            <span className="text-[11px] text-amber-400/90 mt-1 block font-medium">
              ~{(stats?.totalMrr || 0).toLocaleString('vi-VN')} đ / tháng
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
            <CreditCard className="w-6 h-6 text-amber-400" />
          </div>
        </div>

        {/* Metric 3: Total Orders This Month */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-3xl p-5 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              TỔNG ĐƠN TOÀN HỆ THỐNG
            </span>
            <div className="text-4xl font-black text-white mt-1 font-mono">
              {stats?.totalOrdersThisMonth ?? '--'}
            </div>
            <span className="text-[11px] text-purple-400 mt-1 block">
              Đơn hàng đóng trong tháng này
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-purple-400" />
          </div>
        </div>

        {/* Metric 4: Total Storage Used */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-3xl p-5 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              DUNG LƯỢNG LƯU TRỮ VIDEO
            </span>
            <div className="text-3xl font-black text-white mt-1 font-mono">
              {stats ? `${((stats.totalVideoStorageBytes || 0) / (1024 * 1024)).toFixed(1)} MB` : '--'}
            </div>
            <span className="text-[11px] text-cyan-400 mt-1 block">
              Niêm phong băm SHA-256 an toàn
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
            <HardDrive className="w-6 h-6 text-cyan-400" />
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên công ty, mã code, người liên hệ, SĐT..."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>

        <div className="flex items-center space-x-3 w-full md:w-auto">
          {/* Plan Filter */}
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400">Gói cước:</span>
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-white text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">Tất cả gói</option>
              <option value="STARTER">Gói STARTER (1.000 đơn)</option>
              <option value="PRO">Gói PRO (5.000 đơn)</option>
              <option value="BUSINESS">Gói BUSINESS (15.000 đơn)</option>
              <option value="ENTERPRISE">Gói ENTERPRISE (50.000+ đơn)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400">Trạng thái:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-white text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">Tất cả</option>
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="EXPIRED">Đã hết hạn</option>
              <option value="SUSPENDED">Tạm khóa</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tenants Table */}
      <div className="bg-slate-800/90 border border-slate-700 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-700">
              <tr>
                <th className="py-3.5 px-4">Công Ty & Mã Code</th>
                <th className="py-3.5 px-4">Người Đại Diện & Liên Hệ</th>
                <th className="py-3.5 px-4">Gói Cước & Phí Thuê</th>
                <th className="py-3.5 px-4">Hạn Mức Đơn Tháng (Quota)</th>
                <th className="py-3.5 px-4">Thời Hạn & Ngày Còn Lại</th>
                <th className="py-3.5 px-4">Trạng Thái</th>
                <th className="py-3.5 px-4 text-right">Thao Tác Quản Trị</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    Không tìm thấy doanh nghiệp nào phù hợp.
                  </td>
                </tr>
              ) : (
                filteredTenants.map((t) => {
                  const usage = t.usage;
                  const usagePercent = usage.usagePercent;
                  const daysLeft = t.daysRemaining;
                  const isExpiringSoon = daysLeft <= 10 && daysLeft >= 0;
                  const isExpired = t.subscriptionStatus === 'EXPIRED' || daysLeft < 0;

                  return (
                    <tr key={t.id} className="hover:bg-slate-700/30 transition">
                      {/* Name & Code */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                            <Building2 className="w-4 h-4 text-blue-400" />
                          </div>
                          <div>
                            <span className="font-bold text-white text-xs block">
                              {t.name}
                            </span>
                            <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-mono mt-0.5">
                              <span>Code: <strong className="text-slate-300">{t.code}</strong></span>
                              {t.apiKey && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(t.apiKey || '');
                                    alert(`Đã copy API Key của ${t.name} vào bộ nhớ tạm: ${t.apiKey}`);
                                  }}
                                  title={`Click để copy Ingestion API Key: ${t.apiKey}`}
                                  className="px-1.5 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center space-x-1 cursor-pointer transition"
                                >
                                  <Key className="w-2.5 h-2.5" />
                                  <span>{t.apiKey.slice(0, 16)}...</span>
                                  <Copy className="w-2.5 h-2.5 text-amber-400" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contact Info */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-1.5 font-semibold text-slate-200">
                            <User className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            <span>{t.contactName || 'Chưa cập nhật'}</span>
                          </div>
                          {t.phone && (
                            <div className="flex items-center space-x-1.5 text-[11px] text-slate-400">
                              <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                              <span className="font-mono">{t.phone}</span>
                            </div>
                          )}
                          {t.email && (
                            <div className="flex items-center space-x-1.5 text-[11px] text-slate-400">
                              <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                              <span className="truncate max-w-[150px]">{t.email}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Plan Tier & Price */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border block w-max ${
                            t.planTier === 'ENTERPRISE'
                              ? 'bg-amber-950 text-amber-300 border-amber-800'
                              : t.planTier === 'BUSINESS'
                              ? 'bg-purple-950 text-purple-300 border-purple-800'
                              : t.planTier === 'PRO'
                              ? 'bg-blue-950 text-blue-300 border-blue-800'
                              : 'bg-slate-900 text-cyan-300 border-slate-700'
                          }`}>
                            GÓI {t.planTier}
                          </span>
                          <span className="text-[11px] font-mono text-slate-300 font-bold block">
                            {t.pricePerMonth.toLocaleString('vi-VN')} đ/tháng
                          </span>
                        </div>
                      </td>

                      {/* Quota & Usage Progress */}
                      <td className="py-3.5 px-4 min-w-[180px]">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400 font-mono">
                              <strong className="text-white">{usage.ordersThisMonth}</strong> / {t.monthlyOrderLimit} đơn
                            </span>
                            <span className={`font-mono font-bold ${
                              usagePercent > 90 ? 'text-rose-400' : usagePercent > 75 ? 'text-amber-400' : 'text-emerald-400'
                            }`}>
                              {usagePercent}%
                            </span>
                          </div>
                          {/* Progress Bar */}
                          <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full transition-all duration-500 ${
                                usagePercent > 90 ? 'bg-rose-500' : usagePercent > 75 ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(100, usagePercent)}%` }}
                            />
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center justify-between">
                            <span>Bàn đóng: {usage.stationCount}/{t.maxStations}</span>
                            <span>Lưu: {t.retentionDays} ngày</span>
                          </div>
                        </div>
                      </td>

                      {/* Contract Expires & Days Left */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          {isExpired ? (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800 block w-max">
                              ĐÃ HẾT HẠN
                            </span>
                          ) : isExpiringSoon ? (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800 block w-max">
                              HẾT HẠN TRONG {daysLeft} NGÀY
                            </span>
                          ) : (
                            <span className="text-emerald-400 font-bold text-[11px] flex items-center space-x-1">
                              <Clock className="w-3 h-3" />
                              <span>Còn {daysLeft} ngày</span>
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 block font-mono">
                            {t.subscriptionExpiresAt ? new Date(t.subscriptionExpiresAt).toLocaleDateString('vi-VN') : 'Vĩnh viễn'}
                          </span>
                        </div>
                      </td>

                      {/* Active Status */}
                      <td className="py-3.5 px-4">
                        {t.isActive ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center space-x-1 w-max">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>HOẠT ĐỘNG</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-950 text-rose-400 border border-rose-800 flex items-center space-x-1 w-max">
                            <Lock className="w-3 h-3" />
                            <span>TẠM KHÓA</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            type="button"
                            onClick={() => setDriveModalTenant(t)}
                            className="px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/40 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer"
                            title="Quản lý & liên kết lưu trữ Google Drive của Shop (15GB Miễn Phí)"
                          >
                            <HardDrive className="w-3.5 h-3.5 text-blue-400" />
                            <span>DRIVE</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setRenewingTenant(t)}
                            className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 rounded-lg text-xs font-semibold flex items-center space-x-1 transition cursor-pointer"
                            title="Gia hạn hợp đồng thuê"
                          >
                            <Zap className="w-3.5 h-3.5" />
                            <span>GIA HẠN</span>
                          </button>

                          <button
                            type="button"
                            onClick={async () => {
                              if (!window.confirm(`Bạn có chắc muốn cấp lại (Rotate) API Key cho "${t.name}"? API Key cũ sẽ bị vô hiệu hóa ngay lập tức!`)) return;
                              try {
                                const res = await adminApi.rotateTenantApiKey(t.id);
                                alert(`Đã cấp mới API Key cho ${t.name}:\n${res.apiKey}`);
                                await loadData();
                              } catch (e: any) {
                                alert(`Lỗi: ${e.message}`);
                              }
                            }}
                            className="p-1.5 bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/40 rounded-lg text-xs transition cursor-pointer"
                            title="Cấp mới / Đổi Ingestion API Key (Rotate Key)"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setEditingTenant(t)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-lg text-xs transition cursor-pointer"
                            title="Chỉnh sửa thông tin & gói cước"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleActive(t)}
                            className={`p-1.5 rounded-lg border text-xs transition cursor-pointer ${
                              t.isActive
                                ? 'bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 border-slate-700'
                                : 'bg-emerald-950 hover:bg-emerald-800 text-emerald-400 hover:text-white border-emerald-800'
                            }`}
                            title={t.isActive ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                          >
                            {t.isActive ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
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

      {/* Modal: Create New Tenant */}
      {isCreateModalOpen && (
        <CreateTenantModal
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            loadData();
          }}
        />
      )}

      {/* Modal: Edit Tenant */}
      {editingTenant && (
        <EditTenantModal
          tenant={editingTenant}
          onClose={() => setEditingTenant(null)}
          onSuccess={() => {
            setEditingTenant(null);
            loadData();
          }}
        />
      )}

      {/* Modal: Renew Tenant */}
      {renewingTenant && (
        <RenewTenantModal
          tenant={renewingTenant}
          onClose={() => setRenewingTenant(null)}
          onSuccess={() => {
            setRenewingTenant(null);
            loadData();
          }}
        />
      )}

      {/* Modal: Google Drive Storage Settings */}
      {driveModalTenant && (
        <GoogleDriveModal
          tenant={driveModalTenant}
          onClose={() => setDriveModalTenant(null)}
          onUpdated={loadData}
        />
      )}
    </div>
  );
};

// -------------------------------------------------------------
// MODAL: CREATE NEW TENANT / ONBOARDING
// -------------------------------------------------------------
const CreateTenantModal: React.FC<{ onClose: () => void; onSuccess: () => void }> = ({ onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [planTier, setPlanTier] = useState<'STARTER' | 'PRO' | 'BUSINESS' | 'ENTERPRISE'>('PRO');
  const [months, setMonths] = useState(3);
  const [notes, setNotes] = useState('');

  // Admin user credentials for client
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('Shop@123456');
  const [loading, setLoading] = useState(false);

  // Auto-generate code when typing name
  const handleNameChange = (val: string) => {
    setName(val);
    if (!code) {
      const generatedCode = val
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '_')
        .toUpperCase()
        .slice(0, 15);
      setCode(generatedCode);
      if (!adminUsername) {
        setAdminUsername(`admin_${generatedCode.toLowerCase()}`);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      alert('Vui lòng nhập tên công ty và mã định danh (Code)');
      return;
    }

    setLoading(true);
    try {
      await adminApi.createTenant({
        name: name.trim(),
        code: code.trim(),
        contactName: contactName.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        planTier,
        subscriptionMonths: months,
        notes: notes.trim() || undefined,
        adminUsername: adminUsername.trim() || undefined,
        adminPassword: adminPassword.trim() || undefined,
        adminFullName: contactName.trim() || name.trim()
      });
      alert(`Đã khởi tạo thành công công ty "${name}"!`);
      onSuccess();
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl my-8">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-2.5">
            <span className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400">
              <Building2 className="w-5 h-5" />
            </span>
            <h3 className="text-lg font-black text-white uppercase">
              THÊM KHÁCH HÀNG / CÔNG TY THUÊ WEB MỚI
            </h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Company Name & Code */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Tên Công Ty / Tên Shop <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="VD: Shop Thời Trang An Nhiên"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Mã Định Danh (Slug / Code) <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="VD: AN_NHIEN_SHOP"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Contact details */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Người Đại Diện / Chủ Shop
              </label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Nguyễn Văn A"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Số Điện Thoại
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0912.345.678"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@shop.vn"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Plan Tier Selection */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Chọn Gói Cước Thuê Web
            </label>
            <div className="grid grid-cols-4 gap-2.5">
              {[
                { tier: 'STARTER', label: 'STARTER', limit: '1.000 đơn', stations: '1 bàn', retention: '30 ngày', price: '299K/th' },
                { tier: 'PRO', label: 'PRO', limit: '5.000 đơn', stations: '3 bàn', retention: '45 ngày', price: '699K/th' },
                { tier: 'BUSINESS', label: 'BUSINESS', limit: '15.000 đơn', stations: '6 bàn', retention: '60 ngày', price: '1.490K/th' },
                { tier: 'ENTERPRISE', label: 'ENTERPRISE', limit: '50.000+ đơn', stations: '10 bàn', retention: '90 ngày', price: '2.990K/th' }
              ].map((p) => (
                <div
                  key={p.tier}
                  onClick={() => setPlanTier(p.tier as any)}
                  className={`border rounded-2xl p-3 cursor-pointer transition text-center space-y-1 ${
                    planTier === p.tier
                      ? 'border-emerald-500 bg-emerald-950/40 shadow-lg shadow-emerald-500/10'
                      : 'border-slate-700 bg-slate-800/80 hover:border-slate-600'
                  }`}
                >
                  <span className={`text-[11px] font-black block ${planTier === p.tier ? 'text-emerald-400' : 'text-white'}`}>
                    GÓI {p.label}
                  </span>
                  <span className="text-[10px] text-slate-300 block font-semibold">{p.price}</span>
                  <div className="text-[9px] text-slate-400 pt-1 border-t border-slate-700/60">
                    <div>{p.limit}</div>
                    <div>{p.stations} • {p.retention}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Subscription Months */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Thời Hạn Thuê Ban Đầu
              </label>
              <select
                value={months}
                onChange={(e) => setMonths(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value={1}>1 Tháng</option>
                <option value={3}>3 Tháng (Tặng thêm 7 ngày)</option>
                <option value={6}>6 Tháng (Giảm 5%)</option>
                <option value={12}>1 Năm (Giảm 10%)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Ghi Chú Hợp Đồng / Yêu Cầu Riêng
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="VD: Cần hỗ trợ setup camera Dahua tận nơi"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Client Admin Credentials */}
          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2">
            <span className="text-xs font-bold text-emerald-400 flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>CẤP TÀI KHOẢN QUẢN TRỊ KHO CHO KHÁCH HÀNG</span>
            </span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-400 block mb-0.5">Tên đăng nhập (Username)</label>
                <input
                  type="text"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  placeholder="admin_shop"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-0.5">Mật khẩu ban đầu</label>
                <input
                  type="text"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Shop@123456"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
            >
              HỦY BỎ
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900 text-white font-bold rounded-xl text-xs transition shadow-lg cursor-pointer flex items-center space-x-1.5"
            >
              <Sparkles className="w-4 h-4" />
              <span>{loading ? 'ĐANG TẠO...' : 'TẠO CÔNG TY & GIAO TÀI KHOẢN'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// MODAL: EDIT TENANT SETTINGS & PLAN
// -------------------------------------------------------------
const EditTenantModal: React.FC<{ tenant: TenantRecord; onClose: () => void; onSuccess: () => void }> = ({ tenant, onClose, onSuccess }) => {
  const [name, setName] = useState(tenant.name);
  const [contactName, setContactName] = useState(tenant.contactName || '');
  const [phone, setPhone] = useState(tenant.phone || '');
  const [email, setEmail] = useState(tenant.email || '');
  const [planTier, setPlanTier] = useState(tenant.planTier);
  const [monthlyLimit, setMonthlyLimit] = useState(tenant.monthlyOrderLimit);
  const [maxStations, setMaxStations] = useState(tenant.maxStations);
  const [retentionDays, setRetentionDays] = useState(tenant.retentionDays);
  const [pricePerMonth, setPricePerMonth] = useState(tenant.pricePerMonth);
  const [status, setStatus] = useState(tenant.subscriptionStatus);
  const [loading, setLoading] = useState(false);

  const handlePlanChange = (tier: any) => {
    setPlanTier(tier);
    if (tier === 'STARTER') {
      setMonthlyLimit(1000);
      setMaxStations(1);
      setRetentionDays(30);
      setPricePerMonth(299000);
    } else if (tier === 'PRO') {
      setMonthlyLimit(5000);
      setMaxStations(3);
      setRetentionDays(45);
      setPricePerMonth(699000);
    } else if (tier === 'BUSINESS') {
      setMonthlyLimit(15000);
      setMaxStations(6);
      setRetentionDays(60);
      setPricePerMonth(1490000);
    } else if (tier === 'ENTERPRISE') {
      setMonthlyLimit(50000);
      setMaxStations(10);
      setRetentionDays(90);
      setPricePerMonth(2990000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await adminApi.updateTenant(tenant.id, {
        name,
        contactName,
        phone,
        email,
        planTier,
        monthlyOrderLimit: monthlyLimit,
        maxStations,
        retentionDays,
        pricePerMonth,
        subscriptionStatus: status
      });
      alert('Đã cập nhật thông tin công ty thành công!');
      onSuccess();
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                CHỦ HỆ THỐNG
              </span>
              <h3 className="text-sm font-black text-white uppercase">
                HỢP ĐỒNG THUÊ SAAS: {tenant.name}
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Cập nhật hạn mức đơn hàng tháng, gói dịch vụ và phí thuê định kỳ cho khách hàng
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Tên Công Ty</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Người Đại Diện</label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Số Điện Thoại</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Email Liên Hệ</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Gói Cước</label>
              <select
                value={planTier}
                onChange={(e) => handlePlanChange(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-bold"
              >
                <option value="STARTER">Gói STARTER (1.000 đơn)</option>
                <option value="PRO">Gói PRO (5.000 đơn)</option>
                <option value="BUSINESS">Gói BUSINESS (15.000 đơn)</option>
                <option value="ENTERPRISE">Gói ENTERPRISE (50.000+ đơn)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Hạn Mức Đơn / Tháng</label>
              <input
                type="number"
                value={monthlyLimit}
                onChange={(e) => setMonthlyLimit(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Số Bàn Tối Đa</label>
              <input
                type="number"
                value={maxStations}
                onChange={(e) => setMaxStations(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Lưu Video (Ngày)</label>
              <input
                type="number"
                value={retentionDays}
                onChange={(e) => setRetentionDays(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Giá Thuê / Tháng (VNĐ)</label>
              <input
                type="number"
                value={pricePerMonth}
                onChange={(e) => setPricePerMonth(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Trạng Thái Thuê</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-bold"
              >
                <option value="ACTIVE">ACTIVE (Đang hoạt động)</option>
                <option value="EXPIRED">EXPIRED (Hết hạn hợp đồng)</option>
                <option value="SUSPENDED">SUSPENDED (Tạm dừng dịch vụ)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
            >
              HỦY
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs"
            >
              {loading ? 'ĐANG LƯU...' : 'LƯU THAY ĐỔI'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// MODAL: RENEW SUBSCRIPTION
// -------------------------------------------------------------
const RenewTenantModal: React.FC<{ tenant: TenantRecord; onClose: () => void; onSuccess: () => void }> = ({ tenant, onClose, onSuccess }) => {
  const [months, setMonths] = useState(1);
  const [loading, setLoading] = useState(false);

  const handleRenew = async () => {
    setLoading(true);
    try {
      const res = await adminApi.renewTenant(tenant.id, months);
      alert(`Đã gia hạn thành công thêm ${months} tháng cho công ty "${tenant.name}"! Hạn mới: ${new Date(res.newExpiresAt).toLocaleDateString('vi-VN')}`);
      onSuccess();
    } catch (err: any) {
      alert(`Lỗi gia hạn: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const totalPrice = tenant.pricePerMonth * months;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-emerald-600/20 text-emerald-400">
              <Zap className="w-5 h-5" />
            </span>
            <h3 className="text-base font-black text-white uppercase">
              GIA HẠN HỢP ĐỒNG THUÊ WEB
            </h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700 space-y-1">
            <div className="font-bold text-white text-sm">{tenant.name}</div>
            <div className="text-slate-400">
              Gói hiện tại: <strong className="text-emerald-400">GÓI {tenant.planTier}</strong> ({tenant.monthlyOrderLimit.toLocaleString()} đơn/tháng)
            </div>
            <div className="text-slate-400">
              Hạn hiện tại: <strong className="text-slate-200">{tenant.subscriptionExpiresAt ? new Date(tenant.subscriptionExpiresAt).toLocaleDateString('vi-VN') : 'Vĩnh viễn'}</strong>
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-300 block mb-1.5">
              Chọn Số Tháng Gia Hạn Thêm:
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[1, 3, 6, 12].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMonths(m)}
                  className={`py-2 px-1 rounded-xl text-center font-bold text-xs border transition ${
                    months === m
                      ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                  }`}
                >
                  +{m} Tháng
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400">Số tiền thanh toán:</span>
            <span className="font-mono font-black text-amber-300 text-base">
              {totalPrice.toLocaleString('vi-VN')} đ
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
          >
            HỦY
          </button>
          <button
            type="button"
            onClick={handleRenew}
            disabled={loading}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900 text-white font-bold rounded-xl text-xs transition shadow-lg cursor-pointer flex items-center space-x-1"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{loading ? 'ĐANG XỬ LÝ...' : `XÁC NHẬN GIA HẠN +${months} THÁNG`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
