import React from 'react';
import { AlertTriangle, RotateCcw, X, Printer } from 'lucide-react';

interface DuplicateWarningModalProps {
  isOpen: boolean;
  trackingCode: string;
  previousPackedAt?: string;
  onProceed: () => void;
  onCancel: () => void;
  onReprint?: () => void;
}

export const DuplicateWarningModal: React.FC<DuplicateWarningModalProps> = ({
  isOpen,
  trackingCode,
  previousPackedAt,
  onProceed,
  onCancel,
  onReprint
}) => {
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const formattedTime = previousPackedAt
    ? new Date(previousPackedAt).toLocaleString('vi-VN')
    : 'trong ngày hôm nay';

  const handlePrintWaybill = () => {
    if (onReprint) {
      onReprint();
      return;
    }

    const printWindow = window.open('', '_blank', 'width=600,height=750');
    if (!printWindow) {
      alert('Vui lòng cho phép mở popup trên trình duyệt để in lại tem');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>In Lại Tem Vận Đơn - ${trackingCode}</title>
          <meta charset="utf-8" />
          <style>
            @page { size: A6; margin: 0; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 20px; color: #000; }
            .header { border-bottom: 2px solid #000; padding-bottom: 10px; display: flex; justify-content: space-between; align-items: center; }
            .badge { background: #000; color: #fff; padding: 4px 8px; font-weight: 900; font-size: 11px; border-radius: 4px; letter-spacing: 1px; }
            .tracking { font-family: monospace; font-size: 26px; font-weight: 900; letter-spacing: 3px; text-align: center; margin: 20px 0 8px; }
            .barcode { display: flex; justify-content: center; gap: 2px; height: 55px; margin: 15px 0; }
            .bar { background: #000; display: inline-block; }
            .info-card { border: 1.5px solid #000; border-radius: 8px; padding: 12px; font-size: 13px; line-height: 1.7; margin-top: 18px; }
            .footer { font-size: 11px; text-align: center; color: #666; margin-top: 25px; border-top: 1px dashed #888; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <span class="badge">BẢN IN LẠI (TEM DỰ PHÒNG)</span>
            <span style="font-size: 12px; font-weight: bold;">PACKING PROOF SYSTEM</span>
          </div>
          <div class="tracking">${trackingCode}</div>
          <div class="barcode">
            ${[3, 1, 4, 2, 1, 5, 2, 1, 4, 3, 1, 2, 4, 3, 2, 5, 1, 4, 2, 3, 1, 4]
              .map((w) => `<span class="bar" style="width: ${w * 2.8}px;"></span>`)
              .join('')}
          </div>
          <div class="info-card">
            <div><strong>Mã vận đơn:</strong> ${trackingCode}</div>
            <div><strong>Thời điểm đóng trước đó:</strong> ${formattedTime}</div>
            <div><strong>Trạng thái:</strong> ĐÃ ĐÓNG GÓI THÀNH CÔNG</div>
          </div>
          <div class="footer">
            Ngày in lại: ${new Date().toLocaleString('vi-VN')} • Bản in phục vụ dán lại kiện / kiểm hàng
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-800 border-2 border-amber-500 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
        <div className="flex items-start space-x-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-7 h-7 text-amber-400 animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white uppercase tracking-wide">
              CẢNH BÁO: ĐƠN HÀNG NÀY ĐÃ ĐƯỢC ĐÓNG GÓI!
            </h3>
            <p className="text-xs text-amber-200 mt-1 font-medium">
              Bạn đã đóng gói đơn này rồi, có cần phải in lại tem phiếu không?
            </p>
          </div>
        </div>

        <div className="bg-slate-900 rounded-xl p-4 border border-slate-700 text-sm space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs">Mã vận đơn:</span>
            <span className="text-amber-300 font-mono font-black text-base">{trackingCode}</span>
          </div>
          <div className="flex items-center justify-between border-t border-slate-800 pt-2">
            <span className="text-slate-400 text-xs">Đã đóng gói lúc:</span>
            <span className="text-emerald-400 font-mono font-bold text-xs">{formattedTime}</span>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Kiện hàng này đã có video bằng chứng trong hệ thống. Vui lòng chọn thao tác bên dưới:
        </p>

        {/* 3 Action Buttons */}
        <div className="grid grid-cols-3 gap-2.5 pt-2">
          {/* Action 1: In lại tem phiếu */}
          <button
            type="button"
            onClick={handlePrintWaybill}
            className="py-3 px-3 rounded-xl bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/50 font-bold text-xs flex flex-col items-center justify-center space-y-1 transition shadow cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>IN LẠI TEM PHIẾU</span>
          </button>

          {/* Action 2: Đóng gói lại (quay mới) */}
          <button
            type="button"
            onClick={onProceed}
            className="py-3 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-black text-xs flex flex-col items-center justify-center space-y-1 transition shadow-lg shadow-amber-900/40 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>ĐÓNG GÓI LẠI</span>
          </button>

          {/* Action 3: Bỏ qua / Hủy */}
          <button
            type="button"
            onClick={onCancel}
            className="py-3 px-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-xs flex flex-col items-center justify-center space-y-1 transition border border-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>BỎ QUA (ESC)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
