import React, { useState } from 'react';
import { KeyRound, ShieldAlert, X } from 'lucide-react';

interface ForceUnlockModalProps {
  isOpen: boolean;
  stationCode: string;
  onConfirmUnlock: (reason: string) => Promise<void>;
  onClose: () => void;
}

export const ForceUnlockModal: React.FC<ForceUnlockModalProps> = ({
  isOpen,
  stationCode,
  onConfirmUnlock,
  onClose
}) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Vui lòng nhập lý do mở khóa trạm');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirmUnlock(reason);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Mở khóa thất bại');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-800 border-2 border-red-500 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center">
              <ShieldAlert className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">MỞ KHÓA BÀN ĐÓNG GÓI</h3>
              <p className="text-xs text-slate-400">Trạm {stationCode}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-300">
          Chức năng này dùng để giải phóng trạm đóng gói khi bị treo phiên quay hoặc mất tín hiệu worker. Cần quyền Quản lý kho (Supervisor) hoặc Admin.
        </p>

        {error && (
          <div className="p-3 rounded-lg bg-red-950/80 border border-red-500/50 text-red-200 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Lý do mở khóa cưỡng bức:
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VD: Camera bị rớt mạng, hủy phiên để đổi máy khác..."
              rows={3}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold text-xs transition"
            >
              HỦY BỎ
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center justify-center space-x-2 transition shadow"
            >
              <KeyRound className="w-4 h-4" />
              <span>{isSubmitting ? 'Đang mở khóa...' : 'XÁC NHẬN MỞ KHÓA'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
