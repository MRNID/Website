import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UploadCloud,
  FolderCheck,
  Clock
} from 'lucide-react';
import { adminApi, TenantRecord } from '../services/api';

interface GoogleDriveModalProps {
  tenant: TenantRecord | null;
  onClose: () => void;
  onUpdated?: () => void;
}

export const GoogleDriveModal: React.FC<GoogleDriveModalProps> = ({
  tenant,
  onClose,
  onUpdated
}) => {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [driveStatus, setDriveStatus] = useState<any>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchStatus = async () => {
    if (!tenant) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await adminApi.getGoogleDriveStatus(tenant.id);
      setDriveStatus(data);
    } catch (err: any) {
      console.error('Failed to get Google Drive status:', err);
      setErrorMsg(err.message || 'Lỗi kiểm tra trạng thái Google Drive');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [tenant]);

  const handleDisconnect = async () => {
    if (!tenant) return;
    if (!window.confirm(`Bạn có chắc muốn ngắt liên kết Google Drive của shop "${tenant.name}" không?`)) {
      return;
    }
    setActionLoading(true);
    try {
      await adminApi.disconnectGoogleDrive(tenant.id);
      setDriveStatus({ connected: false, retentionDays: tenant.retentionDays || 30 });
      setTestResult(null);
      if (onUpdated) onUpdated();
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleTestSync = async () => {
    if (!tenant) return;
    setActionLoading(true);
    setTestResult(null);
    try {
      const res = await adminApi.testSyncGoogleDrive(tenant.id);
      const data = res?.data || res;
      setTestResult(data);
    } catch (err: any) {
      alert(`Lỗi đồng bộ thử nghiệm: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleGoogleOAuthLogin = async () => {
    if (!tenant) return;
    try {
      const authUrl = await adminApi.getGoogleAuthUrl(tenant.id);
      window.location.href = authUrl;
    } catch (err: any) {
      alert(`Lỗi mở xác thực Google: ${err.message}`);
    }
  };

  if (!tenant) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl animate-fade-in flex flex-col">
        {/* Modal Header */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center shadow-lg p-2.5">
              {/* Google Drive Logo colors */}
              <svg viewBox="0 0 87.3 78" className="w-full h-full">
                <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                <path d="M43.65 25 29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.45z" fill="#00ac47"/>
                <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H60l5.45 9.45z" fill="#ea4335"/>
                <path d="M43.65 25h27.45c0-1.55-.4-3.1-1.2-4.5l-9.9-17.2c-.8-1.4-1.95-2.5-3.3-3.3z" fill="#00832d"/>
                <path d="M59.95 53H27.4l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.9c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25l16.35 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
              </svg>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-black text-white">LƯU TRỮ GOOGLE DRIVE (BYOS)</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  15GB MIỄN PHÍ
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-medium">
                Doanh nghiệp: <strong className="text-slate-200">{tenant.name}</strong> ({tenant.code})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mb-3" />
              <span className="text-xs text-slate-400">Đang kiểm tra kết nối Google Drive...</span>
            </div>
          ) : driveStatus?.connected ? (
            /* Connected State */
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-start space-x-3.5 shadow-lg shadow-emerald-500/5">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-emerald-400">ĐÃ KẾT NỐI GOOGLE DRIVE</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <div className="text-sm font-mono text-white font-bold mt-1">
                    {driveStatus.email}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Đã lưu thông tin liên kết. Dùng nút tải tệp kiểm tra để xác nhận quyền truy cập Google Drive.
                  </p>
                </div>
              </div>

              {/* Technical specs of the Google Drive setup */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                  <div className="flex items-center space-x-1.5 text-slate-400">
                    <FolderCheck className="w-4 h-4 text-amber-400" />
                    <span>Thư mục lưu trữ</span>
                  </div>
                  <div className="text-slate-200 font-mono font-bold text-xs truncate">
                    Google Drive / PackingProof_Videos
                  </div>
                </div>

                <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                  <div className="flex items-center space-x-1.5 text-slate-400">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    <span>Bản gốc tại kho</span>
                  </div>
                  <div className="text-slate-200 font-mono font-bold text-xs">
                    Giữ nguyên, chưa bật tự xóa
                  </div>
                </div>
              </div>

              {/* Test Sync Alert Result */}
              {testResult && (
                <div className="p-4 bg-slate-950 rounded-2xl border border-blue-500/30 text-xs space-y-1.5 animate-fade-in">
                  <div className="flex items-center space-x-2 text-blue-400 font-bold">
                    <UploadCloud className="w-4 h-4" />
                    <span>Đồng bộ thử nghiệm thành công!</span>
                  </div>
                  <div className="text-slate-300 font-mono">
                    File: <strong className="text-white">{testResult.filename}</strong> ({testResult.size})
                  </div>
                  <div className="text-slate-400 text-[11px]">
                    Kiểm tra trực tiếp tại Google Drive: <a href={testResult.driveUrl} target="_blank" rel="noreferrer" className="text-blue-400 underline font-mono">Xem tệp trên Drive</a>
                  </div>
                </div>
              )}

              {/* Action Buttons when Connected */}
              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={handleTestSync}
                  disabled={actionLoading}
                  className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20 active:scale-95 transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>{actionLoading ? 'ĐANG ĐỒNG BỘ...' : 'TẢI TỆP KIỂM TRA'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={actionLoading}
                  className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-500/40 text-slate-300 hover:text-rose-400 font-bold text-xs transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>HỦY LIÊN KẾT</span>
                </button>
              </div>
            </div>
          ) : (
            /* Not Connected State */
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200/90 leading-relaxed space-y-1.5">
                <div className="font-bold text-amber-300 flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>MÔ HÌNH LƯU TRỮ KHÔNG TỐN TIỀN CLOUD (BYOS)</span>
                </div>
                <p>
                  Khách hàng chỉ cần đăng nhập tài khoản Gmail để liên kết <strong>15GB Google Drive miễn phí</strong>. Video đóng hàng sẽ tự động bay thẳng vào Google Drive của khách, Nhật Minh không tốn chi phí máy chủ và khách hoàn toàn làm chủ dữ liệu của mình!
                </p>
              </div>

              {/* Official Google OAuth Login Button */}
              <button
                type="button"
                onClick={handleGoogleOAuthLogin}
                className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-black text-sm shadow-xl active:scale-[0.98] transition flex items-center justify-center space-x-3 cursor-pointer"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>ĐĂNG NHẬP GMAIL ĐỂ LIÊN KẾT GOOGLE DRIVE</span>
              </button>


            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-1.5 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Chỉ ghi vào thư mục PackingProof_Videos, không xem file cá nhân</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
