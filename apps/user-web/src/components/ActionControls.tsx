import React, { useRef, useEffect, useState } from 'react';
import { Barcode, CheckSquare, Play, XOctagon, RefreshCw, KeyRound, Loader2, AlertCircle, Keyboard, ChevronDown, ChevronUp } from 'lucide-react';
import { SessionState } from './StatusBanner';

interface ActionControlsProps {
  state: SessionState;
  trackingInput: string;
  onChangeTrackingInput: (val: string) => void;
  onSubmitTrackingInput: () => void;
  onStartPacking: () => void;
  onStopPacking: () => void;
  onCancelPacking: () => void;
  onRetry: () => void;
  onOpenForceUnlock: () => void;
  isActionLoading: boolean;
  workerOnline?: boolean;
  userRole?: string;
  onScanProductSku?: (sku: string) => void;
  isAllItemsPacked?: boolean;
  children?: React.ReactNode;
}

export const ActionControls: React.FC<ActionControlsProps> = ({
  state,
  trackingInput,
  onChangeTrackingInput,
  onSubmitTrackingInput,
  onStartPacking,
  onStopPacking,
  onCancelPacking,
  onRetry,
  onOpenForceUnlock,
  isActionLoading,
  workerOnline = true,
  userRole = 'PACKING_USER',
  onScanProductSku,
  isAllItemsPacked = false,
  children
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const skuInputRef = useRef<HTMLInputElement | null>(null);
  const [skuInput, setSkuInput] = useState('');
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);

  const isRecording = state === 'RECORDING';
  const isIdle = state === 'IDLE' || state === 'COMPLETED';
  const isProcessing = state === 'WAITING' || state === 'PROCESSING';
  const isFailed = state === 'FAILED' || state === 'INDETERMINATE_TIMEOUT';

  // Auto-focus barcode input when IDLE or COMPLETED
  useEffect(() => {
    if (state === 'IDLE' || state === 'COMPLETED') {
      inputRef.current?.focus();
    } else if (state === 'RECORDING') {
      setTimeout(() => {
        skuInputRef.current?.focus();
      }, 100);
    }
  }, [state]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSubmitTrackingInput();
    }
  };

  const handleSkuKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = skuInput.trim();
      if (code && onScanProductSku) {
        onScanProductSku(code);
        setSkuInput('');
      }
    }
  };

  // Determine disable reason for the Start button
  let disabledReason: string | null = null;
  if (!workerOnline) {
    disabledReason = 'Mất kết nối Video Worker — chưa thể quay';
  } else if (!trackingInput.trim()) {
    disabledReason = 'Chưa quét hoặc nhập mã vận đơn';
  } else if (isActionLoading) {
    disabledReason = 'Đang khởi tạo phiên quay...';
  }

  const isStartDisabled = !isIdle || !trackingInput.trim() || isActionLoading || !workerOnline;

  const canManageStations =
    userRole === 'SUPER_ADMIN' ||
    userRole === 'ADMIN' ||
    userRole === 'WAREHOUSE_MANAGER';

  return (
    <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-4 shadow-2xl flex flex-col h-full overflow-hidden">
      {/* 1. Barcode / SKU Input Section */}
      <div className="shrink-0 space-y-1.5 pb-3 border-b border-slate-800">
        {isRecording ? (
          <>
            <div className="flex items-center justify-between">
              <label
                htmlFor="sku-input"
                className="flex items-center space-x-1.5 text-xs font-bold text-amber-300 uppercase tracking-wide"
              >
                <Barcode className="w-4 h-4 text-amber-400" />
                <span>ĐỐI CHIẾU SẢN PHẨM (QUÉT MÃ SKU)</span>
              </label>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                isAllItemsPacked
                  ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                  : 'bg-amber-950/80 border-amber-500/60 text-amber-300 animate-pulse'
              }`}>
                {isAllItemsPacked ? '✓ ĐÃ ĐỐI CHIẾU ĐỦ' : 'ĐANG CHỜ BẮN MÃ SP'}
              </span>
            </div>

            <div className="relative">
              <input
                id="sku-input"
                ref={skuInputRef}
                type="text"
                data-barcode-catcher="true"
                value={skuInput}
                onChange={(e) => setSkuInput(e.target.value)}
                onKeyDown={handleSkuKeyDown}
                placeholder="Bắn súng quét mã vạch sản phẩm (SKU) để đối chiếu..."
                className="w-full bg-slate-950 border-2 border-amber-500/80 focus:border-amber-400 rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-amber-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition shadow-inner"
              />
              <button
                type="button"
                onClick={() => {
                  if (skuInput.trim() && onScanProductSku) {
                    onScanProductSku(skuInput.trim());
                    setSkuInput('');
                  }
                }}
                className="absolute right-2 top-2 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg text-xs transition cursor-pointer"
              >
                ĐỐI CHIẾU
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <label
                htmlFor="tracking-input"
                className="flex items-center space-x-1.5 text-xs font-bold text-slate-300 uppercase tracking-wide"
              >
                <Barcode className="w-4 h-4 text-blue-400" />
                <span>MÃ VẬN ĐƠN</span>
              </label>
              <span className="text-[11px] text-slate-400 font-mono">
                [ F2 để kích hoạt ]
              </span>
            </div>

            <div className="relative">
              <input
                id="tracking-input"
                ref={inputRef}
                type="text"
                data-barcode-catcher="true"
                value={trackingInput}
                onChange={(e) => onChangeTrackingInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isProcessing}
                placeholder="Quét mã vạch đơn hàng hoặc nhập mã (VD: SPXVN0458892182B)..."
                className="w-full bg-slate-950 border-2 border-slate-700 focus:border-blue-500 rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 transition"
              />
            </div>
          </>
        )}
      </div>

      {/* 2. Middle Section: Checklist / Children (Scrollable, doesn't obscure buttons) */}
      <div className="flex-1 min-h-0 overflow-y-auto py-2.5">
        {children}
      </div>

      {/* 3. Bottom Pinned Section: Primary Action Controls */}
      <div className="shrink-0 pt-3 border-t border-slate-800 space-y-2">
        {/* Dynamic Action Buttons based on state */}
        {isRecording ? (
          <div className="grid grid-cols-3 gap-2.5">
            {/* Primary: Finish Packing [ F4 / Space ] */}
            <button
              type="button"
              onClick={onStopPacking}
              disabled={isActionLoading}
              className={`col-span-2 py-3.5 px-4 text-white font-black text-sm rounded-xl flex items-center justify-center space-x-2 shadow-lg transition border cursor-pointer disabled:cursor-not-allowed ${
                isAllItemsPacked
                  ? 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 border-emerald-400 shadow-emerald-950/60 ring-2 ring-emerald-500/40 animate-pulse'
                  : 'bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 border-emerald-500/60 shadow-emerald-950/40'
              }`}
            >
              {isActionLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <CheckSquare className="w-5 h-5" />
              )}
              <span>
                {isAllItemsPacked
                  ? '[ F4 / SPACE ] HOÀN TẤT (ĐÃ ĐỐI CHIẾU ĐỦ)'
                  : '[ F4 / SPACE ] HOÀN TẤT ĐÓNG GÓI'}
              </span>
            </button>

            {/* Secondary: Cancel Session [ Esc ] */}
            <button
              type="button"
              onClick={onCancelPacking}
              disabled={isActionLoading}
              className="py-3.5 px-3 bg-slate-800 hover:bg-rose-700 active:bg-rose-800 disabled:bg-slate-800 text-rose-300 hover:text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 shadow transition border border-slate-700 hover:border-rose-600 cursor-pointer disabled:cursor-not-allowed"
            >
              <XOctagon className="w-4 h-4 text-rose-400" />
              <span>[ ESC ] HỦY</span>
            </button>
          </div>
        ) : isProcessing ? (
          <div className="w-full py-3.5 bg-blue-950/70 border border-blue-600/40 text-blue-200 font-bold text-sm rounded-xl flex items-center justify-center space-x-2">
            <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
            <span>ĐANG LƯU & NIÊM PHONG VIDEO...</span>
          </div>
        ) : isFailed ? (
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onRetry}
              className="py-3 px-4 bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm rounded-xl flex items-center justify-center space-x-2 shadow transition cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>[ F8 ] THỬ LẠI</span>
            </button>
            <button
              type="button"
              onClick={onOpenForceUnlock}
              className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold text-xs rounded-xl flex items-center justify-center space-x-1.5 border border-slate-700 cursor-pointer"
            >
              <KeyRound className="w-4 h-4 text-amber-400" />
              <span>MỞ KHÓA TRẠM</span>
            </button>
          </div>
        ) : (
          /* IDLE / COMPLETED state: Start Packing [ F2 ] */
          <div>
            <button
              type="button"
              onClick={onStartPacking}
              disabled={isStartDisabled}
              title={disabledReason || 'Bắt đầu đóng gói đơn hàng'}
              className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:bg-slate-800 disabled:text-slate-500 disabled:border-slate-800 text-white font-black text-sm rounded-xl flex items-center justify-center space-x-2 transition shadow-lg shadow-blue-950/40 border border-blue-400/30 cursor-pointer disabled:cursor-not-allowed"
            >
              {isActionLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Play className="w-4 h-4 fill-white" />
              )}
              <span>[ F2 ] BẮT ĐẦU ĐÓNG GÓI</span>
            </button>

            {/* Explicit reason banner when disabled */}
            {isStartDisabled && disabledReason && (
              <div className="flex items-center space-x-1.5 text-[11px] text-slate-400 mt-1.5 px-1 justify-center">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
                <span>{disabledReason}</span>
              </div>
            )}
          </div>
        )}

        {/* Keyboard Shortcuts Guide Banner */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800/80">
          <div className="flex items-center space-x-1 text-slate-400">
            <Keyboard className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-semibold text-slate-300">Phím tắt:</span>
          </div>
          <div className="flex items-center space-x-3 font-mono text-[10px]">
            <span><strong className="text-slate-200">F2</strong> Bắt đầu</span>
            <span>•</span>
            <span><strong className="text-slate-200">F4/Space</strong> Hoàn tất</span>
            <span>•</span>
            <span><strong className="text-slate-200">ESC</strong> Hủy</span>
          </div>
        </div>

        {/* Troubleshooting Section: Only for Admins / Managers, or during errors */}
        {(canManageStations || isFailed) && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowTroubleshoot((prev) => !prev)}
              className="w-full flex items-center justify-between text-[11px] text-slate-500 hover:text-slate-300 transition py-1 px-1 cursor-pointer"
            >
              <span className="flex items-center space-x-1">
                <KeyRound className="w-3 h-3 text-amber-500/70" />
                <span>Xử lý sự cố & Mở khóa trạm (Quản lý)</span>
              </span>
              {showTroubleshoot ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>

            {showTroubleshoot && (
              <div className="mt-1.5 p-2 bg-slate-950/90 rounded-lg border border-slate-800 flex items-center justify-between gap-2">
                <div className="text-[10px] text-slate-400">
                  Chỉ dùng khi phiên bị kẹt không thể tự dừng.
                </div>
                <button
                  type="button"
                  onClick={onOpenForceUnlock}
                  className="px-2.5 py-1 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-600/40 rounded text-[11px] font-bold transition flex items-center space-x-1 cursor-pointer"
                >
                  <KeyRound className="w-3 h-3 text-amber-400" />
                  <span>MỞ KHÓA [F8]</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
