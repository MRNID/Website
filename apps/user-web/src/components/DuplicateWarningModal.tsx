import React from 'react';
import { AlertTriangle, RotateCcw, X } from 'lucide-react';

interface DuplicateWarningModalProps {
  isOpen: boolean;
  trackingCode: string;
  previousPackedAt?: string;
  onProceed: () => void;
  onCancel: () => void;
}

export const DuplicateWarningModal: React.FC<DuplicateWarningModalProps> = ({
  isOpen,
  trackingCode,
  previousPackedAt,
  onProceed,
  onCancel
}) => {
  if (!isOpen) return null;

  const formattedTime = previousPackedAt
    ? new Date(previousPackedAt).toLocaleString('vi-VN')
    : 'trong ngày hôm nay';

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-800 border-2 border-amber-500 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-7 h-7 text-amber-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">CẢNH BÁO MÃ ĐƠN TRÙNG LẶP!</h3>
            <p className="text-xs text-amber-200 mt-0.5">Kiện hàng đã từng được đóng gói trước đó</p>
          </div>
        </div>

        <div className="bg-slate-900 rounded-xl p-4 border border-slate-700 text-sm space-y-2">
          <div>
            <span className="text-slate-400 text-xs block">Mã vận đơn:</span>
            <span className="text-amber-300 font-mono font-bold text-base">{trackingCode}</span>
          </div>
          <div>
            <span className="text-slate-400 text-xs block">Thời điểm đóng trước đó:</span>
            <span className="text-slate-200 font-semibold">{formattedTime}</span>
          </div>
        </div>

        <p className="text-xs text-slate-300">
          Bạn có chắc chắn muốn quay lại video cho kiện hàng này không? (Ví dụ: khách hàng đổi hàng, đóng lại hộp mới).
        </p>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={onCancel}
            className="py-3 px-4 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold text-sm flex items-center justify-center space-x-2 transition"
          >
            <X className="w-4 h-4" />
            <span>HỦY BỎ (ESC)</span>
          </button>
          <button
            onClick={onProceed}
            className="py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm flex items-center justify-center space-x-2 transition shadow-lg shadow-amber-900/30"
          >
            <RotateCcw className="w-4 h-4" />
            <span>QUAY ĐÈ LẠI</span>
          </button>
        </div>
      </div>
    </div>
  );
};
