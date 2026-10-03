import React, { useRef, useEffect } from 'react';
import { Barcode, CheckSquare, Play, XOctagon, RefreshCw, KeyRound } from 'lucide-react';
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
  isActionLoading
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Auto-focus barcode input when IDLE
  useEffect(() => {
    if (state === 'IDLE' || state === 'COMPLETED' || state === 'FAILED') {
      inputRef.current?.focus();
    }
  }, [state]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSubmitTrackingInput();
    }
  };

  const isRecording = state === 'RECORDING';
  const isIdle = state === 'IDLE' || state === 'COMPLETED' || state === 'FAILED';
  const isFailed = state === 'FAILED' || state === 'INDETERMINATE_TIMEOUT';

  return (
    <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-xl space-y-4">
      {/* Barcode Input Bar */}
      <div className="flex items-center space-x-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Barcode className="w-5 h-5 text-blue-400" />
          </div>
          <input
            ref={inputRef}
            type="text"
            data-barcode-catcher="true"
            value={trackingInput}
            onChange={(e) => onChangeTrackingInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isRecording || state === 'WAITING' || state === 'PROCESSING'}
            placeholder="Quét mã vạch hoặc nhập mã vận đơn (VD: SPXVN0458892182B)..."
            className="w-full bg-slate-900 border-2 border-slate-600 focus:border-blue-500 rounded-xl pl-11 pr-4 py-3 text-base font-mono font-semibold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
          />
        </div>

        {/* Start Button */}
        <button
          onClick={onStartPacking}
          disabled={!isIdle || !trackingInput.trim() || isActionLoading}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold rounded-xl flex items-center space-x-2 transition shadow-lg shadow-blue-900/30 cursor-pointer disabled:cursor-not-allowed"
        >
          <Play className="w-4 h-4 fill-white" />
          <span>[ F2 ] BẮT ĐẦU</span>
        </button>
      </div>

      {/* Primary Control Buttons */}
      <div className="grid grid-cols-4 gap-3 pt-1">
        {/* Finish Packing [ F4 / Space ] */}
        <button
          onClick={onStopPacking}
          disabled={!isRecording || isActionLoading}
          className="col-span-2 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:border-slate-700 text-white font-black text-lg rounded-xl flex items-center justify-center space-x-3 shadow-xl transition border border-emerald-400/40 cursor-pointer disabled:cursor-not-allowed"
        >
          <CheckSquare className="w-6 h-6" />
          <span>[ SPACE / F4 ] HOÀN TẤT ĐÓNG GÓI</span>
        </button>

        {/* Cancel Session [ Esc ] */}
        <button
          onClick={onCancelPacking}
          disabled={(!isRecording && state !== 'WAITING') || isActionLoading}
          className="py-4 bg-slate-700 hover:bg-rose-700 disabled:bg-slate-800 disabled:text-slate-600 disabled:border-slate-700 text-slate-200 hover:text-white font-bold text-sm rounded-xl flex items-center justify-center space-x-2 shadow transition border border-slate-600 cursor-pointer disabled:cursor-not-allowed"
        >
          <XOctagon className="w-5 h-5 text-rose-400" />
          <span>[ ESC ] HỦY PHIÊN</span>
        </button>

        {/* Retry / Unlock [ F8 ] */}
        {isFailed ? (
          <button
            onClick={onRetry}
            className="py-4 bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm rounded-xl flex items-center justify-center space-x-2 shadow transition cursor-pointer"
          >
            <RefreshCw className="w-5 h-5" />
            <span>[ F8 ] THỬ LẠI</span>
          </button>
        ) : (
          <button
            onClick={onOpenForceUnlock}
            title="Mở khóa khẩn cấp nếu bàn đóng gói bị kẹt phiên"
            className="py-4 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium text-xs rounded-xl flex items-center justify-center space-x-1.5 transition border border-slate-600"
          >
            <KeyRound className="w-4 h-4 text-amber-400" />
            <span>MỞ KHÓA TRẠM</span>
          </button>
        )}
      </div>
    </div>
  );
};
