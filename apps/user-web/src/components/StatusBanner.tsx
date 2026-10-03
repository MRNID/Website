import React from 'react';
import { AlertCircle, CheckCircle2, Loader2, PlayCircle, ShieldCheck } from 'lucide-react';

export type SessionState = 'IDLE' | 'WAITING' | 'RECORDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'INDETERMINATE_TIMEOUT';

interface StatusBannerProps {
  state: SessionState;
  trackingCode: string | null;
  elapsedSeconds: number;
  errorMessage?: string | null;
  completedHash?: string | null;
  completedDuration?: number | null;
}

export const StatusBanner: React.FC<StatusBannerProps> = ({
  state,
  trackingCode,
  elapsedSeconds,
  errorMessage,
  completedHash,
  completedDuration
}) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (state === 'RECORDING') {
    return (
      <div className="w-full bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white px-8 py-5 rounded-2xl shadow-2xl flex items-center justify-between border-2 border-red-400">
        <div className="flex items-center space-x-6">
          <div className="relative flex items-center justify-center">
            <span className="w-6 h-6 rounded-full bg-white animate-ping absolute opacity-75" />
            <span className="w-5 h-5 rounded-full bg-white shadow-lg" />
          </div>
          <div>
            <div className="flex items-center space-x-3">
              <span className="text-3xl font-extrabold tracking-wider uppercase">
                ĐANG QUAY VIDEO ĐÓNG HÀNG
              </span>
              <span className="bg-red-950/60 text-red-200 border border-red-400/50 text-xs px-2.5 py-0.5 rounded-full font-bold uppercase animate-pulse">
                REC LIVE
              </span>
            </div>
            <div className="text-red-100 text-sm font-medium mt-1 flex items-center space-x-2">
              <span>Mã vận đơn:</span>
              <span className="bg-white/20 px-2 py-0.5 rounded text-white font-mono font-bold tracking-wider text-base">
                {trackingCode || 'CHƯA CÓ'}
              </span>
            </div>
          </div>
        </div>

        {/* Giant Digital Timer */}
        <div className="text-right">
          <div className="text-xs uppercase tracking-widest text-red-200 font-semibold mb-0.5">
            Thời lượng quay
          </div>
          <div className="text-5xl font-mono font-black tracking-tight text-white drop-shadow font-mono-nums">
            {formatTime(elapsedSeconds)}
          </div>
        </div>
      </div>
    );
  }

  if (state === 'WAITING') {
    return (
      <div className="w-full bg-amber-600/90 text-white px-8 py-5 rounded-2xl shadow-xl flex items-center justify-between border border-amber-400 animate-pulse">
        <div className="flex items-center space-x-5">
          <Loader2 className="w-10 h-10 animate-spin text-white" />
          <div>
            <h2 className="text-2xl font-bold tracking-wide">
              ĐANG KHỞI ĐỘNG CAMERA & PHIÊN QUAY...
            </h2>
            <p className="text-amber-100 text-sm mt-0.5">
              Hệ thống đang mở luồng fMP4 và đồng bộ định danh vận đơn {trackingCode}
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-xl font-mono font-bold bg-amber-900/60 px-4 py-2 rounded-lg border border-amber-300">
            KHỞI TẠO...
          </span>
        </div>
      </div>
    );
  }

  if (state === 'PROCESSING') {
    return (
      <div className="w-full bg-indigo-700 text-white px-8 py-5 rounded-2xl shadow-xl flex items-center justify-between border border-indigo-400">
        <div className="flex items-center space-x-5">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-200" />
          <div>
            <h2 className="text-2xl font-bold tracking-wide">
              ĐANG KẾT THÚC & NIÊM PHONG SHA-256...
            </h2>
            <p className="text-indigo-200 text-sm mt-0.5">
              Đóng stream video, remux faststart và tính toán mã băm SHA-256 bất biến
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-sm font-semibold text-indigo-200 bg-indigo-900/80 px-3 py-1.5 rounded-lg border border-indigo-500">
            SEALING HASH...
          </span>
        </div>
      </div>
    );
  }

  if (state === 'COMPLETED') {
    return (
      <div className="w-full bg-emerald-600 text-white px-8 py-5 rounded-2xl shadow-xl flex items-center justify-between border-2 border-emerald-400">
        <div className="flex items-center space-x-5">
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center border border-white/40">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-3">
              <h2 className="text-2xl font-black tracking-wide">
                ĐÃ ĐÓNG GÓI THÀNH CÔNG & NIÊM PHONG VIDEO!
              </h2>
              <span className="bg-emerald-950/60 text-emerald-200 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center space-x-1 border border-emerald-400/40">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>SHA-256 VERIFIED</span>
              </span>
            </div>
            <div className="text-emerald-100 text-sm mt-1 flex items-center space-x-4">
              <span>Mã: <strong className="text-white font-mono text-base">{trackingCode}</strong></span>
              {completedDuration && (
                <span>Thời lượng: <strong>{completedDuration}s</strong></span>
              )}
              {completedHash && (
                <span className="text-xs bg-emerald-900/60 px-2 py-0.5 rounded font-mono text-emerald-200 border border-emerald-400/30">
                  Hash: {completedHash.slice(0, 16)}...
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs uppercase text-emerald-200 font-semibold mb-1">Trạng thái</div>
          <span className="text-lg font-bold bg-white text-emerald-800 px-4 py-1.5 rounded-lg shadow">
            SẴN SÀNG ĐƠN KẾ TIẾP
          </span>
        </div>
      </div>
    );
  }

  if (state === 'FAILED' || state === 'INDETERMINATE_TIMEOUT') {
    return (
      <div className="w-full bg-rose-700 text-white px-8 py-5 rounded-2xl shadow-xl flex items-center justify-between border-2 border-rose-400">
        <div className="flex items-center space-x-5">
          <div className="w-12 h-12 rounded-xl bg-rose-900/80 flex items-center justify-center border border-rose-400">
            <AlertCircle className="w-8 h-8 text-rose-200" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-wide">
              {state === 'INDETERMINATE_TIMEOUT' ? 'HẾT GIỜ KẾT NỐI CAMERA (TIMEOUT)' : 'LỖI PHIÊN QUAY VIDEO'}
            </h2>
            <p className="text-rose-100 text-sm mt-0.5 font-medium">
              {errorMessage || 'Camera mất tín hiệu hoặc Video Worker gặp sự cố. Bấm [F8] để thử lại hoặc mở khóa trạm.'}
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-sm font-bold bg-rose-950 text-rose-200 px-3 py-1.5 rounded-lg border border-rose-500">
            BẤM [F8] ĐỂ THỬ LẠI
          </span>
        </div>
      </div>
    );
  }

  // Default: IDLE
  return (
    <div className="w-full bg-slate-800 text-slate-100 px-8 py-5 rounded-2xl shadow-lg flex items-center justify-between border border-slate-700">
      <div className="flex items-center space-x-5">
        <div className="w-12 h-12 rounded-xl bg-blue-600/20 flex items-center justify-center border border-blue-500/30">
          <PlayCircle className="w-8 h-8 text-blue-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white tracking-wide">
            SẴN SÀNG ĐÓNG GÓI - QUÉT MÃ VẬN ĐƠN
          </h2>
          <p className="text-slate-400 text-sm mt-0.5">
            Dùng máy quét bắn vào mã vạch trên phiếu gửi hàng, hoặc gõ mã và nhấn Enter / [F2]
          </p>
        </div>
      </div>

      <div className="text-right">
        <span className="text-xs uppercase tracking-wider text-slate-400 block mb-1">Máy quét HID</span>
        <span className="text-sm font-semibold bg-slate-700 text-blue-300 px-3 py-1.5 rounded-lg border border-slate-600">
          AUTO-DETECT ACTIVE
        </span>
      </div>
    </div>
  );
};
