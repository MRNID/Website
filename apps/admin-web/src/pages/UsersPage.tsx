import React, { useEffect, useState, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Search,
  RefreshCw,
  Phone,
  ShieldCheck,
  Lock,
  Unlock,
  Edit,
  Package,
  X,
  Warehouse,
  Building2,
  KeyRound,
  QrCode,
  Printer
} from 'lucide-react';
import { adminApi, StaffUser, RoleRecord, TenantRecord } from '../services/api';

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [bizFilter, setBizFilter] = useState<'ALL' | 'CLIENTS' | 'NHATMINH'>('ALL');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
  const [barcodeUser, setBarcodeUser] = useState<StaffUser | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [userList, roleList, tenantList] = await Promise.all([
        adminApi.getStaffUsers(),
        adminApi.getRoles().catch(() => []),
        adminApi.getTenants().catch(() => [])
      ]);
      setUsers(userList || []);
      setRoles(roleList || []);
      setTenants(tenantList || []);
    } catch (err: any) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Quick Toggle Status
  const handleToggleStatus = async (user: StaffUser) => {
    const nextStatus = !user.isActive;
    const actionText = nextStatus ? 'mở khóa' : 'tạm khóa';
    if (!window.confirm(`Bạn có chắc muốn ${actionText} tài khoản "${user.username}" (${user.fullName}) không?`)) {
      return;
    }

    try {
      await adminApi.toggleUserStatus(user.id, nextStatus);
      setUsers(prev => prev.map(u => (u.id === user.id ? { ...u, isActive: nextStatus } : u)));
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`);
    }
  };

  // Filtered List
  const filteredUsers = users.filter(u => {
    if (bizFilter === 'CLIENTS' && u.businessCode === 'NHATMINH_SYSTEM') return false;
    if (bizFilter === 'NHATMINH' && u.businessCode !== 'NHATMINH_SYSTEM') return false;
    if (roleFilter !== 'ALL' && u.roleName !== roleFilter) return false;
    if (statusFilter === 'ACTIVE' && !u.isActive) return false;
    if (statusFilter === 'LOCKED' && u.isActive) return false;
    if (search) {
      const s = search.toLowerCase();
      const matchName = u.fullName.toLowerCase().includes(s);
      const matchUser = u.username.toLowerCase().includes(s);
      const matchPhone = u.phone?.toLowerCase().includes(s);
      const matchEmail = u.email.toLowerCase().includes(s);
      const matchShop = u.businessName.toLowerCase().includes(s);
      if (!matchName && !matchUser && !matchPhone && !matchEmail && !matchShop) return false;
    }
    return true;
  });

  // KPI Metrics
  const totalUsers = users.length;
  const clientUsersCount = users.filter(u => u.businessCode !== 'NHATMINH_SYSTEM').length;
  const nhatminhUsersCount = users.filter(u => u.businessCode === 'NHATMINH_SYSTEM').length;
  const activePackers = users.filter(u => u.roleName === 'PACKING_USER' && u.isActive).length;
  const totalPackedToday = users.reduce((sum, u) => sum + (u.stats?.packedToday || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header & KPI Summary */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center space-x-2">
            <Users className="w-6 h-6 text-indigo-400" />
            <span>QUẢN LÝ NHÂN VIÊN & TÀI KHOẢN ĐÓNG GÓI</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Cấp tài khoản nhân viên đóng gói (Packer), phân quyền kho và theo dõi sản lượng đóng gói theo ca
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center space-x-2 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>LÀM MỚI</span>
          </button>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center space-x-2 shadow-lg shadow-indigo-600/30 transition"
          >
            <UserPlus className="w-4 h-4" />
            <span>THÊM NHÂN VIÊN ĐÓNG GÓI</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 shadow-lg flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              Tổng Tài Khoản
            </span>
            <span className="text-xl font-black text-white">{totalUsers}</span>
            <span className="text-[11px] text-slate-400 ml-1.5 font-medium">tài khoản</span>
          </div>
        </div>

        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 shadow-lg flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              Khách Hàng Thuê Web
            </span>
            <span className="text-xl font-black text-blue-400">{clientUsersCount}</span>
            <span className="text-[11px] text-slate-400 ml-1.5 font-medium">nhân sự shop</span>
          </div>
        </div>

        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 shadow-lg flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-600/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              Đội Ngũ Nhật Minh
            </span>
            <span className="text-xl font-black text-amber-400">{nhatminhUsersCount}</span>
            <span className="text-[11px] text-slate-400 ml-1.5 font-medium">quản trị / demo</span>
          </div>
        </div>

        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 shadow-lg flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              Đơn Đóng Hôm Nay
            </span>
            <span className="text-xl font-black text-emerald-400">{totalPackedToday}</span>
            <span className="text-[11px] text-slate-400 ml-1.5 font-medium">kiện ({activePackers} nhân viên đóng gói)</span>
          </div>
        </div>
      </div>

      {/* Segmented Classifier & Filters */}
      <div className="space-y-3">
        {/* Segmented Tabs: All vs Clients vs Nhat Minh */}
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
          <button
            onClick={() => setBizFilter('ALL')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              bizFilter === 'ALL'
                ? 'bg-slate-700 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span>TẤT CẢ TÀI KHOẢN</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-900 font-mono text-slate-300">
              {totalUsers}
            </span>
          </button>

          <button
            onClick={() => setBizFilter('CLIENTS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              bizFilter === 'CLIENTS'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>🏢 KHÁCH HÀNG THUÊ PHẦN MỀM</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-950 font-mono text-blue-300">
              {clientUsersCount}
            </span>
          </button>

          <button
            onClick={() => setBizFilter('NHATMINH')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              bizFilter === 'NHATMINH'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>👑 HỆ THỐNG NHẬT MINH (NỀN TẢNG)</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-950 font-mono text-amber-300">
              {nhatminhUsersCount}
            </span>
          </button>
        </div>

        {/* Search & Filters */}
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên nhân viên, username, SĐT, email..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <div className="flex items-center space-x-3 w-full md:w-auto">
            {/* Role Filter */}
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-400">Vai trò:</span>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-white text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">Tất cả vai trò</option>
                <option value="PACKING_USER">Nhân viên đóng gói (Packer)</option>
                <option value="WAREHOUSE_MANAGER">Quản lý kho</option>
                <option value="CUSTOMER_SERVICE">CSKH khiếu nại</option>
                <option value="ADMIN">Quản trị viên kho</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-400">Trạng thái:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-white text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">Tất cả</option>
                <option value="ACTIVE">Đang hoạt động</option>
                <option value="LOCKED">Đã tạm khóa</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-slate-800/90 border border-slate-700 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-700">
              <tr>
                <th className="py-3.5 px-4">Nhân Viên & Tên Đăng Nhập</th>
                <th className="py-3.5 px-4">Vai Trò & Quyền Hạn</th>
                <th className="py-3.5 px-4">Doanh Nghiệp & Kho Làm Việc</th>
                <th className="py-3.5 px-4 text-center">Năng Suất Đóng Gói (KPI)</th>
                <th className="py-3.5 px-4 text-center">Trạng Thái</th>
                <th className="py-3.5 px-4 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                    Đang tải danh sách nhân viên...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Không tìm thấy nhân viên nào phù hợp.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isPacker = u.roleName === 'PACKING_USER';
                  const initials = u.fullName
                    .split(' ')
                    .map((n) => n[0])
                    .slice(-2)
                    .join('')
                    .toUpperCase();

                  return (
                    <tr key={u.id} className="hover:bg-slate-700/30 transition">
                      {/* Name & Username */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border ${
                            isPacker
                              ? 'bg-emerald-600/20 border-emerald-500/30 text-emerald-400'
                              : u.roleName === 'ADMIN' || u.roleName === 'SUPER_ADMIN'
                              ? 'bg-amber-600/20 border-amber-500/30 text-amber-400'
                              : 'bg-indigo-600/20 border-indigo-500/30 text-indigo-400'
                          }`}>
                            {initials || 'NV'}
                          </div>
                          <div>
                            <span className="font-bold text-white text-xs block">
                              {u.fullName}
                            </span>
                            <div className="flex items-center space-x-2 text-[10px] text-slate-400">
                              <span className="font-mono bg-slate-900 px-1.5 py-0.5 rounded text-indigo-300 font-bold">
                                @{u.username}
                              </span>
                              {u.phone && (
                                <span className="flex items-center space-x-1 font-mono text-slate-300">
                                  <Phone className="w-2.5 h-2.5 text-slate-500" />
                                  <span>{u.phone}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role & Permissions */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border inline-block ${
                            u.roleName === 'PACKING_USER'
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                              : u.roleName === 'WAREHOUSE_MANAGER'
                              ? 'bg-blue-950 text-blue-300 border-blue-800'
                              : u.roleName === 'CUSTOMER_SERVICE'
                              ? 'bg-purple-950 text-purple-300 border-purple-800'
                              : 'bg-amber-950 text-amber-300 border-amber-800'
                          }`}>
                            {u.roleName === 'PACKING_USER'
                              ? '📦 Nhân viên đóng gói'
                              : u.roleName === 'WAREHOUSE_MANAGER'
                              ? '📋 Quản lý kho'
                              : u.roleName === 'CUSTOMER_SERVICE'
                              ? '🎧 CSKH / Tra cứu video'
                              : u.roleName === 'SUPER_ADMIN'
                              ? '👑 Super Admin'
                              : '🏢 Quản trị viên'}
                          </span>
                          {u.roleDescription && (
                            <span className="text-[10px] text-slate-400 block truncate max-w-[200px]">
                              {u.roleDescription}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Business & Warehouse */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          {u.businessCode === 'NHATMINH_SYSTEM' ? (
                            <div className="flex items-center space-x-1.5">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800 flex items-center space-x-1">
                                <span>👑</span>
                                <span>HỆ THỐNG NHẬT MINH</span>
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-1.5 font-bold text-slate-200">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-950 text-blue-300 border border-blue-800 flex items-center space-x-1">
                                <span>🏢</span>
                                <span className="truncate max-w-[170px]">{u.businessName}</span>
                              </span>
                            </div>
                          )}
                          <div className="flex items-center space-x-1.5 text-[11px] text-slate-400">
                            <Warehouse className="w-3 h-3 text-slate-500 shrink-0" />
                            <span className="truncate max-w-[180px]">{u.warehouseName}</span>
                          </div>
                        </div>
                      </td>

                      {/* Packing KPI */}
                      <td className="py-3.5 px-4 text-center">
                        {isPacker ? (
                          <div className="space-y-0.5">
                            <div className="text-xs font-mono font-bold text-emerald-400">
                              {u.stats?.packedToday || 0} đơn hôm nay
                            </div>
                            <div className="text-[10px] font-mono text-slate-400">
                              Tổng: <strong className="text-white">{u.stats?.totalPacked || 0}</strong> đơn
                            </div>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">Không áp dụng</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border inline-block ${
                          u.isActive
                            ? 'bg-emerald-950/70 text-emerald-400 border-emerald-800'
                            : 'bg-rose-950/70 text-rose-400 border-rose-800'
                        }`}>
                          {u.isActive ? '● Đang hoạt động' : '○ Tạm khóa'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {isPacker && (
                            <button
                              onClick={() => setBarcodeUser(u)}
                              title="Thẻ mã vạch đăng nhập nhanh"
                              className="p-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => setEditingUser(u)}
                            title="Chỉnh sửa thông tin / Đổi mật khẩu"
                            className="p-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-blue-300 hover:text-white transition"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleToggleStatus(u)}
                            title={u.isActive ? 'Khóa tài khoản' : 'Kích hoạt lại'}
                            className={`p-1.5 rounded-lg transition ${
                              u.isActive
                                ? 'bg-rose-950/50 hover:bg-rose-900 text-rose-300'
                                : 'bg-emerald-950/50 hover:bg-emerald-900 text-emerald-300'
                            }`}
                          >
                            {u.isActive ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
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

      {/* MODAL: CREATE STAFF USER */}
      {isCreateOpen && (
        <CreateStaffModal
          tenants={tenants}
          onClose={() => setIsCreateOpen(false)}
          onSuccess={() => {
            setIsCreateOpen(false);
            loadData();
          }}
        />
      )}

      {/* MODAL: EDIT STAFF USER */}
      {editingUser && (
        <EditStaffModal
          user={editingUser}
          roles={roles}
          onClose={() => setEditingUser(null)}
          onSuccess={() => {
            setEditingUser(null);
            loadData();
          }}
        />
      )}

      {/* MODAL: BARCODE BADGE */}
      {barcodeUser && (
        <BarcodeModal
          user={barcodeUser}
          onClose={() => setBarcodeUser(null)}
        />
      )}
    </div>
  );
};

// -------------------------------------------------------------
// MODAL: CREATE STAFF USER
// -------------------------------------------------------------
const CreateStaffModal: React.FC<{
  tenants: TenantRecord[];
  onClose: () => void;
  onSuccess: () => void;
}> = ({ tenants, onClose, onSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('Packer@123');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [roleName, setRoleName] = useState('PACKING_USER');
  const [businessId, setBusinessId] = useState(tenants[0]?.id || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await adminApi.createStaffUser({
        username,
        password,
        fullName,
        phone: phone || undefined,
        email: email || undefined,
        roleName,
        businessId: businessId || undefined
      });
      alert(`Đã tạo tài khoản "${username}" thành công cho nhân viên ${fullName}!`);
      onSuccess();
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <UserPlus className="w-4 h-4" />
            </div>
            <h3 className="text-base font-black text-white uppercase">
              THÊM NHÂN VIÊN / TÀI KHOẢN ĐÓNG GÓI
            </h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Select Tenant if Super Admin has multiple */}
          {tenants.length > 1 && (
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Doanh Nghiệp / Shop</label>
              <select
                value={businessId}
                onChange={(e) => setBusinessId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              >
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                ))}
              </select>
            </div>
          )}

          {/* Role Selection */}
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Vai Trò Đảm Nhiệm</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRoleName('PACKING_USER')}
                className={`p-2.5 rounded-xl border text-left transition ${
                  roleName === 'PACKING_USER'
                    ? 'bg-emerald-950/80 border-emerald-500 text-white'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <div className="font-bold text-xs text-emerald-400 flex items-center space-x-1.5">
                  <Package className="w-3.5 h-3.5" />
                  <span>Nhân viên đóng gói</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Thao tác tại bàn đóng gói, quay video</div>
              </button>

              <button
                type="button"
                onClick={() => setRoleName('WAREHOUSE_MANAGER')}
                className={`p-2.5 rounded-xl border text-left transition ${
                  roleName === 'WAREHOUSE_MANAGER'
                    ? 'bg-blue-950/80 border-blue-500 text-white'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <div className="font-bold text-xs text-blue-400 flex items-center space-x-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Quản lý kho hàng</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Giám sát trạm, kiểm tra tiến độ</div>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Họ Và Tên Nhân Viên *</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="VD: Nguyễn Văn Nam"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Số Điện Thoại</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0912345678"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Tên Đăng Nhập (Username) *</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().trim())}
                placeholder="VD: packer02, mai_ca1"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Mật Khẩu Đăng Nhập *</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
                <button
                  type="button"
                  onClick={() => setPassword('Packer@' + Math.floor(100 + Math.random() * 900))}
                  className="absolute right-2 top-2 text-[10px] text-indigo-400 hover:text-indigo-300 font-bold"
                >
                  Sinh ngẫu nhiên
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Email (Tùy chọn)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Để trống sẽ tự động gán theo mã nhân viên"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
            />
          </div>

          <div className="p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-2xl flex items-center space-x-2 text-[11px] text-indigo-300">
            <KeyRound className="w-4 h-4 shrink-0 text-indigo-400" />
            <span>
              Tài khoản đóng gói có thể đăng nhập ngay tại bàn làm việc cổng <strong>3000</strong>.
            </span>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
            >
              HỦY BỎ
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 disabled:opacity-50"
            >
              {loading ? 'ĐANG TẠO...' : 'TẠO TÀI KHOẢN'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// MODAL: EDIT STAFF USER & RESET PASSWORD
// -------------------------------------------------------------
const EditStaffModal: React.FC<{
  user: StaffUser;
  roles: RoleRecord[];
  onClose: () => void;
  onSuccess: () => void;
}> = ({ user, roles, onClose, onSuccess }) => {
  const [fullName, setFullName] = useState(user.fullName);
  const [phone, setPhone] = useState(user.phone || '');
  const [email, setEmail] = useState(user.email);
  const [roleId, setRoleId] = useState(user.roleId);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await adminApi.updateStaffUser(user.id, {
        fullName,
        phone: phone || undefined,
        email,
        roleId,
        password: password.trim() ? password.trim() : undefined
      });
      alert(`Đã cập nhật thông tin nhân viên "${user.username}" thành công!`);
      onSuccess();
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Edit className="w-4 h-4" />
            </div>
            <h3 className="text-base font-black text-white uppercase">
              CẬP NHẬT: @{user.username}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Họ Và Tên</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Số Điện Thoại</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
              />
            </div>
          </div>

          {/* Role Selection */}
          {roles.length > 0 && (
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Vai Trò Đảm Nhiệm</label>
              <select
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold"
              >
                {roles.filter((r: RoleRecord) => r.businessId === user.businessId).map((r: RoleRecord) => (
                  <option key={r.id} value={r.id}>{r.name} - {r.description}</option>
                ))}
              </select>
            </div>
          )}

          {/* Reset Password */}
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">
              Đổi Mật Khẩu (Để trống nếu không đổi)
            </label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu mới..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
            >
              HỦY BỎ
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 disabled:opacity-50"
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
// MODAL: BARCODE BADGE PRINT
// -------------------------------------------------------------
const BarcodeModal: React.FC<{ user: StaffUser; onClose: () => void }> = ({ user, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl text-center">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-black text-white uppercase">
            THẺ ĐĂNG NHẬP NHÂN VIÊN
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-white p-5 rounded-2xl text-slate-900 space-y-3 shadow-inner">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            {user.businessName}
          </div>
          <div className="text-base font-black text-slate-900">
            {user.fullName}
          </div>
          <div className="text-xs font-mono text-slate-600">
            Tài khoản: <strong>{user.username}</strong>
          </div>

          {/* Barcode Graphic Representation */}
          <div className="py-2 flex flex-col items-center justify-center">
            <div className="h-14 flex items-center space-x-[2px]">
              {Array.from(user.username).map((char, i) => {
                const code = char.charCodeAt(0);
                const w1 = (code % 3) + 1;
                const w2 = ((code * 2) % 3) + 1;
                return (
                  <React.Fragment key={i}>
                    <div style={{ width: `${w1 * 2}px` }} className="h-full bg-black"></div>
                    <div style={{ width: `${w2}px` }} className="h-full bg-transparent"></div>
                  </React.Fragment>
                );
              })}
            </div>
            <span className="font-mono text-xs font-bold tracking-widest mt-1">
              *{user.username.toUpperCase()}*
            </span>
          </div>

          <div className="text-[10px] text-slate-500 italic">
            Quét mã này bằng đầu đọc mã vạch tại bàn đóng gói để đăng nhập tức thì.
          </div>
        </div>

        <div className="flex items-center justify-center space-x-3 pt-2">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow"
          >
            <Printer className="w-4 h-4" />
            <span>IN THẺ NHÂN VIÊN</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
          >
            ĐÓNG
          </button>
        </div>
      </div>
    </div>
  );
};
