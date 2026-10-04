import React, { useEffect, useRef, useState } from 'react';
import { Camera, Video, ScanLine, CheckCircle2 } from 'lucide-react';
import { SessionState } from './StatusBanner';
import { cameraBarcodeScanner } from '../services/cameraBarcodeScanner';
import { soundEffects } from '../utils/audioFeedback';

interface CameraViewportProps {
  stationId?: string;
  stationCode: string;
  cameraName: string;
  state: SessionState;
  trackingCode: string | null;
  elapsedSeconds: number;
  autoScanEnabled?: boolean;
  onToggleAutoScan?: () => void;
  onAutoScanBarcode?: (barcode: string) => void;
}

export const CameraViewport: React.FC<CameraViewportProps> = ({
  stationId,
  stationCode,
  cameraName,
  state,
  trackingCode,
  elapsedSeconds,
  autoScanEnabled = true,
  onToggleAutoScan,
  onAutoScanBarcode
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [timecode, setTimecode] = useState('');
  const [streamError, setStreamError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [detectedBanner, setDetectedBanner] = useState<string | null>(null);

  // Auto retry stream every 3s if it encounters an error
  useEffect(() => {
    if (!streamError) return;
    const timer = setTimeout(() => {
      setStreamError(false);
      setRetryCount((prev) => prev + 1);
    }, 3000);
    return () => clearTimeout(timer);
  }, [streamError]);

  // Live millisecond timecode clock
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTimecode(now.toISOString().replace('T', ' ').slice(0, 23));
    }, 50);
    return () => clearInterval(timer);
  }, []);

  // Hands-free Camera Barcode Scanner Loop
  useEffect(() => {
    if (!autoScanEnabled || streamError) return;

    let active = true;
    let isDecoding = false;

    const interval = setInterval(async () => {
      if (!active || isDecoding) return;
      const img = imgRef.current;
      if (!img || !img.complete || img.naturalWidth === 0) return;

      isDecoding = true;
      try {
        const result = await cameraBarcodeScanner.scanFrame(img);
        if (result && result.cleanedCode && active) {
          console.log('[CameraBarcodeScanner] Detected:', result.cleanedCode, result.carrier);
          soundEffects.playSuccessBeep();
          setDetectedBanner(result.cleanedCode);
          setTimeout(() => setDetectedBanner(null), 3000);

          if (onAutoScanBarcode) {
            onAutoScanBarcode(result.cleanedCode);
          }
        }
      } catch (err) {
        // Ignored frame scan error
      } finally {
        isDecoding = false;
      }
    }, 280);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [autoScanEnabled, state, streamError, onAutoScanBarcode]);

  // Animated background visualization / OSD guides
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let tick = 0;

    const render = () => {
      tick++;

      if (!streamError) {
        // Transparent clear so real camera video shows through
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      } else {
        // Fallback simulation background
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Subtle warehouse grid lines
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        const gridSize = 40;
        for (let x = 0; x < canvas.width; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height);
          ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvas.width, y);
          ctx.stroke();
        }
      }

      // Packing area guide box (center)
      const boxW = canvas.width * 0.7;
      const boxH = canvas.height * 0.65;
      const boxX = (canvas.width - boxW) / 2;
      const boxY = (canvas.height - boxH) / 2;

      ctx.strokeStyle = state === 'RECORDING' ? 'rgba(239, 68, 68, 0.7)' : 'rgba(59, 130, 246, 0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(boxX, boxY, boxW, boxH);

      // Corner brackets on packing zone
      const cornerLen = 20;
      ctx.strokeStyle = state === 'RECORDING' ? '#ef4444' : '#3b82f6';
      ctx.lineWidth = 4;
      // Top-left
      ctx.beginPath();
      ctx.moveTo(boxX, boxY + cornerLen);
      ctx.lineTo(boxX, boxY);
      ctx.lineTo(boxX + cornerLen, boxY);
      ctx.stroke();
      // Top-right
      ctx.beginPath();
      ctx.moveTo(boxX + boxW - cornerLen, boxY);
      ctx.lineTo(boxX + boxW, boxY);
      ctx.lineTo(boxX + boxW, boxY + cornerLen);
      ctx.stroke();
      // Bottom-left
      ctx.beginPath();
      ctx.moveTo(boxX, boxY + boxH - cornerLen);
      ctx.lineTo(boxX, boxY + boxH);
      ctx.lineTo(boxX + cornerLen, boxY + boxH);
      ctx.stroke();
      // Bottom-right
      ctx.beginPath();
      ctx.moveTo(boxX + boxW - cornerLen, boxY + boxH);
      ctx.lineTo(boxX + boxW, boxY + boxH);
      ctx.lineTo(boxX + boxW, boxY + boxH - cornerLen);
      ctx.stroke();

      // If recording, render subtle scanning laser line
      if (state === 'RECORDING') {
        const scanY = boxY + ((tick * 2) % boxH);
        const grad = ctx.createLinearGradient(boxX, scanY, boxX + boxW, scanY);
        grad.addColorStop(0, 'rgba(239, 68, 68, 0)');
        grad.addColorStop(0.5, 'rgba(239, 68, 68, 0.7)');
        grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(boxX, scanY - 1, boxW, 2);
      } else if (autoScanEnabled && (state === 'IDLE' || state === 'COMPLETED') && !streamError) {
        // Subtle emerald targeting scan line when auto-scan is active
        const scanY = boxY + ((tick * 1.5) % boxH);
        const grad = ctx.createLinearGradient(boxX, scanY, boxX + boxW, scanY);
        grad.addColorStop(0, 'rgba(16, 185, 129, 0)');
        grad.addColorStop(0.5, 'rgba(16, 185, 129, 0.6)');
        grad.addColorStop(1, 'rgba(16, 185, 129, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(boxX, scanY - 1, boxW, 2);
      }

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [state, streamError, autoScanEnabled]);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative w-full h-full min-h-[360px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex items-center justify-center">
      {/* Real Live Camera Video Stream */}
      {stationId && !streamError ? (
        <img
          ref={imgRef}
          key={`${stationId}_${retryCount}`}
          src={`http://localhost:4000/api/v1/stations/${stationId}/live-preview?t=${retryCount}`}
          alt="Live Camera Feed"
          crossOrigin="anonymous"
          onError={() => {
            console.warn('Live camera stream disconnected, retrying in 3s...');
            setStreamError(true);
          }}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : null}

      <canvas
        ref={canvasRef}
        width={960}
        height={540}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
      />

      {/* Detected Barcode Flash Banner */}
      {detectedBanner && (
        <div className="absolute top-16 inset-x-0 mx-auto w-fit z-30 flex items-center space-x-2 bg-emerald-600/95 text-white px-5 py-2.5 rounded-xl border border-emerald-400 shadow-2xl animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-white" />
          <span className="text-xs font-bold uppercase">
            TỰ ĐỘNG NHẬN DIỆN MÃ: <span className="font-mono text-amber-200 underline">{detectedBanner}</span>
          </span>
        </div>
      )}

      {/* Camera OSD Overlays */}
      {/* Top Left: Station & Camera info + Auto-Scan Toggle */}
      <div className="absolute top-4 left-4 flex items-center space-x-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-xs font-medium text-slate-200 z-10">
        <Camera className="w-3.5 h-3.5 text-blue-400" />
        <span>{stationCode}</span>
        <span className="text-slate-500">•</span>
        <span className="text-slate-300">{cameraName}</span>
        {!streamError && (
          <>
            <span className="text-slate-500">•</span>
            <span className="flex items-center space-x-1 text-emerald-400 text-[10px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>LIVE</span>
            </span>
          </>
        )}
        {onToggleAutoScan && (
          <>
            <span className="text-slate-500">•</span>
            <button
              type="button"
              onClick={onToggleAutoScan}
              title="Bật/Tắt chế độ tự động nhận diện mã vạch qua camera"
              className={`flex items-center space-x-1.5 px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                autoScanEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
              }`}
            >
              <ScanLine className={`w-3 h-3 ${autoScanEnabled ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
              <span>AUTO-SCAN: {autoScanEnabled ? 'BẬT' : 'TẮT'}</span>
            </button>
          </>
        )}
      </div>

      {/* Top Center: Auto-scan prompt when active */}
      {autoScanEnabled && !streamError && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 hidden md:flex items-center space-x-1.5 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-emerald-500/30 text-[11px] text-emerald-300 font-medium z-10">
          <ScanLine className="w-3 h-3 text-emerald-400" />
          <span>
            {state === 'RECORDING'
              ? 'Đưa mã SKU sản phẩm vào camera để tự động đếm'
              : 'Đưa mã vận đơn vào khung camera để tự động đóng đơn'}
          </span>
        </div>
      )}

      {/* Top Right: REC Indicator + Millisecond timecode */}
      <div className="absolute top-4 right-4 flex items-center space-x-3 z-10">
        {state === 'RECORDING' && (
          <div className="flex items-center space-x-2 bg-red-600/90 text-white px-3 py-1 rounded-md font-bold text-xs shadow-lg animate-pulse-fast">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
            <span>REC {formatTimer(elapsedSeconds)}</span>
          </div>
        )}
        <div className="bg-black/60 backdrop-blur-md text-emerald-400 font-mono text-xs px-3 py-1.5 rounded-lg border border-white/10 font-bold">
          {timecode}
        </div>
      </div>

      {/* Center Guidance text ONLY when offline or simulation */}
      {streamError && state === 'IDLE' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="p-4 rounded-full bg-amber-500/10 border border-amber-500/20 mb-3">
            <Video className="w-8 h-8 text-amber-400" />
          </div>
          <span className="text-sm font-semibold text-slate-300">
            ĐANG KẾT NỐI CAMERA DAHUA...
          </span>
          <span className="text-xs text-slate-500 mt-1">
            Đang tải luồng hình ảnh trực tiếp từ trạm {stationCode}
          </span>
        </div>
      )}

      {/* Bottom Left: Tracking Code Watermark */}
      <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur-md px-3.5 py-1.5 rounded-lg border border-white/10 text-xs font-mono z-10">
        <span className="text-slate-400">ĐƠN HÀNG: </span>
        <span className="text-amber-300 font-bold text-sm tracking-wider">
          {trackingCode || 'CHƯA CÓ'}
        </span>
      </div>

      {/* Bottom Right: Video Resolution / Technical OSD */}
      <div className="absolute bottom-4 right-4 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-[11px] text-slate-400 font-mono z-10">
        <span>1080p @ 30FPS • fMP4 H.264 • LOCAL SSD</span>
      </div>
    </div>
  );
};
