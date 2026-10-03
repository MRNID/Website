import React, { useState } from 'react';
import { Lock, ShieldCheck, User } from 'lucide-react';
import { adminApi, AdminUser } from '../services/api';

interface LoginPageProps {
  onSuccess: (user: AdminUser) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Admin@123');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const user = await adminApi.login(username, password);
      onSuccess(user);
    } catch (err: any) {
      setError(err.message || 'Tên đăng nhập hoặc mật khẩu quản trị không đúng');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-3xl max-w-sm w-full p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-emerald-600 mx-auto flex items-center justify-center shadow-lg shadow-emerald-600/30">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-black text-white">ĐĂNG NHẬP HỆ THỐNG</h2>
          <p className="text-xs text-slate-400">Cổng Quản Trị & Tra Cứu Bằng Chứng Video LAN</p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-950/70 border border-red-500/40 text-red-200 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Tài khoản Quản trị / CSKH
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Mật khẩu
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm shadow-lg shadow-emerald-600/30 transition disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Đang xác thực...' : 'ĐĂNG NHẬP QUẢN TRỊ'}
          </button>
        </form>

        <div className="text-[11px] text-slate-500 text-center border-t border-slate-700/60 pt-4">
          Mặc định: <span className="text-slate-300">admin</span> / <span className="text-slate-300">Admin@123</span>
        </div>
      </div>
    </div>
  );
};
