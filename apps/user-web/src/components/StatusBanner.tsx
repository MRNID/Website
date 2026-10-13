import React from 'react';
import { AlertCircle, CheckCircle2, Loader2, HardDrive, Cloud, AlertTriangle } from 'lucide-react';

export type SessionState = 'IDLE' | 'WAITING' | 'RECORDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'INDETERMINATE_TIMEOUT';

interface StatusBannerProps {
  state: SessionState;
  trackingCode: string | null;
  elapsedSeconds: number;
  errorMessage?: string | null;
  completedHash?: string | null;
  completedDuration?: number | null;
  workerOnline?: boolean;
  cameraReady?: boolean;
  syncStatus?: string | null;
}

export const StatusBanner: React.FC<StatusBannerProps> = ({
  state,
  trackingCode,
  elapsedSeconds,
  errorMessage,
  completedHash,
  completedDuration,
  workerOnline = true,
  cameraReady = true,
  syncStatus = 'SYNCED'
}) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 1. STATE: RECORDING
  if (state === 'RECORDING') {
    return (
      <div className="w-full h-13 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white px-5 rounded-xl shadow-lg border border-red-400 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3.5">
          <div className="relative flex items-center justify-center">
            <span className="w-4 h-4 rounded-full bg-white animate-ping absolute opacity-80" />
            <span className="w-3 h-3 rounded-full bg-white shadow" />
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-black tracking-wider uppercase">
              ĐANG GHI HÌNH ĐÓNG HÀNG
            </span>
            <span className="bg-red-950/70 text-red-200 border border-red-300/40 text-[10px] px-2 py-0.5 rounded-full font-black uppercase font-mono animate-pulse">
              REC
            </span>
          </div>
        </div>

        {/* Highlighted Tracking Code in Center */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-red-200 font-semibold hidden sm:inline">MÃ VẬN ĐƠN:</span>
          <span className="bg-black/40 text-amber-200 border border-white/20 px-3.5 py-1 rounded-lg font-mono font-black text-base tracking-widest shadow-inner">
            {trackingCode || 'CHƯA CÓ MÃ'}
          </span>
        </div>

        {/* Digital Stop-watch Timer */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-red-200 uppercase font-mono hidden md:inline">THỜI LƯỢNG:</span>
          <span className="text-2xl font-mono font-black tracking-tight text-white drop-shadow font-mono-nums bg-black/30 px-3 py-0.5 rounded-lg border border-red-400/40">
            {formatTime(elapsedSeconds)}
          </span>
        </div>
      </div>
    );
  }

  // 2. STATE: WAITING (Starting camera stream & worker session)
  if (state === 'WAITING') {
    return (
      <div className="w-full h-13 bg-amber-600 text-white px-5 rounded-xl shadow-md border border-amber-400 flex items-center justify-between shrink-0 animate-pulse">
        <div className="flex items-center space-x-3">
          <Loader2 className="w-5 h-5 animate-spin text-white" />
          <div>
            <span className="text-xs font-black uppercase tracking-wider block">
              ĐANG KHỞI ĐỘNG CAMERA & PHIÊN QUAY VIDEO...
            </span>
            <span className="text-[11px] text-amber-100 font-mono">
              Đơn hàng: <strong>{trackingCode || 'Đang tạo phiên'}</strong>
            </span>
          </div>
        </div>
        <span className="text-xs font-mono font-bold bg-amber-900/60 px-3 py-1 rounded-lg border border-amber-300/40">
          KHỞI TẠO...
        </span>
      </div>
    );
  }

  // 3. STATE: PROCESSING (Stopping ffmpeg & sealing SHA-256)
  if (state === 'PROCESSING') {
    return (
      <div className="w-full h-13 bg-indigo-700 text-white px-5 rounded-xl shadow-md border border-indigo-400 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-200" />
          <div>
            <span className="text-xs font-black uppercase tracking-wider block">
              ĐANG KẾT THÚC, NIÊM PHONG SHA-256 & LƯU MÁY TRẠM...
            </span>
            <span className="text-[11px] text-indigo-200">
              Kiểm tra tính toàn vẹn và tạo biên bản điện tử
            </span>
          </div>
        </div>
        <span className="text-xs font-mono font-bold bg-indigo-950/60 px-3 py-1 rounded-lg border border-indigo-300/40">
          ĐANG LƯU...
        </span>
      </div>
    );
  }

  // 4. STATE: COMPLETED
  if (state === 'COMPLETED') {
    return (
      <div className="w-full h-13 bg-emerald-700 text-white px-5 rounded-xl shadow-md border border-emerald-400 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
          <div className="flex items-center space-x-2 text-xs">
            <span className="font-black uppercase tracking-wider">
              ĐÃ HOÀN TẤT ĐÓNG GÓI:
            </span>
            <span className="font-mono font-black text-amber-200 bg-black/30 px-2 py-0.5 rounded border border-emerald-400/40">
              {trackingCode || 'ĐƠN HÀNG'}
            </span>
            <span className="text-emerald-200 hidden sm:inline">•</span>
            <span className="text-emerald-100 hidden sm:inline">
              Thời lượng: <strong>{completedDuration ? `${completedDuration}s` : 'Chưa xác định'}</strong>
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs font-medium">
          <span className="flex items-center space-x-1 bg-emerald-950/70 border border-emerald-400/40 text-emerald-200 px-2.5 py-1 rounded-lg text-[11px]">
            <HardDrive className="w-3 h-3 text-emerald-300" />
            <span>Local OK</span>
          </span>
          <span className="flex items-center space-x-1 bg-emerald-950/70 border border-emerald-400/40 text-emerald-200 px-2.5 py-1 rounded-lg text-[11px]">
            <Cloud className="w-3 h-3 text-emerald-300" />
            <span>{syncStatus === 'SYNCED' ? 'Google Drive: Đã lưu' : 'Google Drive: Chờ đồng bộ'}</span>
          </span>
          {completedHash && (
            <span className="font-mono text-[10px] text-emerald-200 bg-black/40 px-2 py-1 rounded border border-emerald-500/30 hidden md:inline">
              SHA: {completedHash.slice(0, 10)}...
            </span>
          )}
        </div>
      </div>
    );
  }

  // 5. STATE: FAILED or TIMEOUT
  if (state === 'FAILED' || state === 'INDETERMINATE_TIMEOUT') {
    return (
      <div className="w-full h-13 bg-rose-900 text-white px-5 rounded-xl shadow-md border border-rose-500 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 text-rose-300 shrink-0" />
          <div>
            <span className="text-xs font-black uppercase tracking-wider block text-rose-200">
              {state === 'INDETERMINATE_TIMEOUT' ? 'CẢNH BÁO QUÁ HẠN PHIÊN' : 'SỰ CỐ ĐÓNG GÓI'}
            </span>
            <span className="text-[11px] text-rose-100 truncate max-w-xl block">
              {errorMessage || 'Phiên đóng gói gặp sự cố hoặc timeout. Vui lòng kiểm tra lại.'}
            </span>
          </div>
        </div>
        <span className="text-xs font-bold bg-black/40 text-rose-200 px-3 py-1 rounded-lg border border-rose-400/40 font-mono">
          Nhấn [F8] để đồng bộ
        </span>
      </div>
    );
  }

  // 6. STATE: IDLE (Distinguish Worker Offline, Camera Not Ready, or Fully Ready)
  if (!workerOnline) {
    return (
      <div className="w-full h-12 bg-rose-950/80 text-rose-200 px-5 rounded-xl border border-rose-600/70 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2.5 text-xs font-medium">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>
            <strong>MẤT KẾT NỐI WORKER:</strong> Dịch vụ ghi hình video trên máy trạm chưa sẵn sàng. Vui lòng khởi động lại video-worker.
          </span>
        </div>
        <span className="text-[11px] font-mono bg-rose-900/60 px-2 py-0.5 rounded border border-rose-500/40 text-rose-300">
          CHƯA SẴN SÀNG
        </span>
      </div>
    );
  }

  if (!cameraReady) {
    return (
      <div className="w-full h-12 bg-amber-950/70 text-amber-200 px-5 rounded-xl border border-amber-600/70 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2.5 text-xs font-medium">
          <Loader2 className="w-4 h-4 animate-spin text-amber-400 shrink-0" />
          <span>
            <strong>ĐANG KẾT NỐI CAMERA:</strong> Chờ tín hiệu hình ảnh trực tiếp từ camera LAN...
          </span>
        </div>
        <span className="text-[11px] font-mono bg-amber-900/60 px-2 py-0.5 rounded border border-amber-500/40 text-amber-300">
          CHỜ TÍN HIỆU
        </span>
      </div>
    );
  }

  // Fully READY for next order
  return (
    <div className="w-full h-12 bg-slate-900/90 text-slate-200 px-5 rounded-xl border border-slate-700/80 flex items-center justify-between shrink-0 shadow-sm">
      <div className="flex items-center space-x-3">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
          SẴN SÀNG ĐÓNG GÓI
        </span>
        <span className="text-slate-600">|</span>
        <span className="text-xs text-slate-300">
          Quét mã vạch đơn hàng để bắt đầu ghi hình tự động
        </span>
      </div>

      <div className="hidden lg:flex items-center space-x-3 text-[11px] text-slate-400 font-mono">
        <span>[F2] Bắt đầu</span>
        <span>•</span>
        <span>[F4] Hoàn tất</span>
        <span>•</span>
        <span>[ESC] Hủy</span>
        <span>•</span>
        <span>[F8] Đồng bộ</span>
      </div>
    </div>
  );
};
