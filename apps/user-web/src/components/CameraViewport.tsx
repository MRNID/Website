import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  ScanLine,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeftRight,
  Move,
  Layers,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { SessionState } from './StatusBanner';
import { cameraBarcodeScanner } from '../services/cameraBarcodeScanner';
import { soundEffects } from '../utils/audioFeedback';

interface CameraViewportProps {
  stationId?: string;
  stationCode: string;
  cameraName: string;
  packerName?: string;
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
  packerName = 'packer01',
  state,
  trackingCode,
  elapsedSeconds,
  autoScanEnabled = true,
  onToggleAutoScan,
  onAutoScanBarcode
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [timecode, setTimecode] = useState('');
  const [streamError, setStreamError] = useState(false);
  const [isStreamLoaded, setIsStreamLoaded] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [detectedBanner, setDetectedBanner] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fullscreen toggle handler
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch((err) => {
        console.warn('Cannot enter fullscreen mode:', err);
      });
    } else {
      document.exitFullscreen?.().catch((err) => {
        console.warn('Cannot exit fullscreen mode:', err);
      });
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Dual-Camera Adaptive PiP state
  const [dualCamEnabled, setDualCamEnabled] = useState<boolean>(() => {
    return localStorage.getItem(`station_${stationCode}_dual_cam`) === 'true';
  });
  const [isSwapped, setIsSwapped] = useState<boolean>(false);
  const [pipCorner, setPipCorner] = useState<'top-right' | 'bottom-right' | 'top-left' | 'bottom-left'>(() => {
    return (localStorage.getItem(`station_${stationCode}_pip_corner`) as any) || 'top-right';
  });
  const [pipSize, setPipSize] = useState<'small' | 'medium' | 'large'>(() => {
    return (localStorage.getItem(`station_${stationCode}_pip_size`) as any) || 'medium';
  });

  const toggleDualCam = () => {
    const next = !dualCamEnabled;
    setDualCamEnabled(next);
    localStorage.setItem(`station_${stationCode}_dual_cam`, String(next));
  };

  const cyclePipCorner = () => {
    const corners: Array<'top-right' | 'bottom-right' | 'bottom-left' | 'top-left'> = [
      'top-right',
      'bottom-right',
      'bottom-left',
      'top-left'
    ];
    const nextIdx = (corners.indexOf(pipCorner) + 1) % corners.length;
    const next = corners[nextIdx];
    setPipCorner(next);
    localStorage.setItem(`station_${stationCode}_pip_corner`, next);
  };

  const cyclePipSize = () => {
    const sizes: Array<'small' | 'medium' | 'large'> = ['small', 'medium', 'large'];
    const nextIdx = (sizes.indexOf(pipSize) + 1) % sizes.length;
    const next = sizes[nextIdx];
    setPipSize(next);
    localStorage.setItem(`station_${stationCode}_pip_size`, next);
  };

  const getCornerClasses = () => {
    switch (pipCorner) {
      case 'top-left':
        return 'top-14 left-4';
      case 'bottom-left':
        return 'bottom-16 left-4';
      case 'bottom-right':
        return 'bottom-16 right-4';
      case 'top-right':
      default:
        return 'top-14 right-4';
    }
  };

  const getSizeClasses = () => {
    switch (pipSize) {
      case 'small':
        return 'w-[22%] min-w-[210px] max-w-[270px] aspect-[4/3]';
      case 'large':
        return 'w-[35%] min-w-[320px] max-w-[420px] aspect-[4/3]';
      case 'medium':
      default:
        return 'w-[28%] min-w-[260px] max-w-[340px] aspect-[4/3]';
    }
  };

  // Auto retry stream every 3s if it encounters an error
  useEffect(() => {
    if (!streamError) return;
    const timer = setTimeout(() => {
      setStreamError(false);
      setIsStreamLoaded(false);
      setRetryCount((prev: number) => prev + 1);
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
    <div
      ref={containerRef}
      onDoubleClick={toggleFullscreen}
      className={`relative w-full h-full min-h-[340px] bg-slate-950 overflow-hidden transition-all duration-300 flex items-center justify-center ${
        isFullscreen ? 'rounded-none' : 'rounded-2xl'
      } ${
        state === 'RECORDING'
          ? 'border-2 border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.35)] ring-2 ring-red-500/30'
          : 'border border-slate-800 shadow-xl'
      }`}
    >
      {/* Real Live Camera Video Stream (or Fullscreen Waybill if Swapped) */}
      {isSwapped ? (
        /* Fullscreen Macro Waybill when swapped */
        <div className="absolute inset-0 w-full h-full bg-slate-900 flex flex-col items-center justify-center p-6 text-slate-900 z-1">
          <div className="max-w-md w-full bg-white p-6 rounded-2xl border-2 border-amber-400 shadow-2xl text-center space-y-4">
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2">
              <span className="bg-red-600 text-white font-black text-sm px-2.5 py-0.5 rounded">SPX EXPRESS</span>
              <span className="font-mono text-xs font-bold text-slate-600">CẬN CẢNH FULL VẬN ĐƠN</span>
            </div>
            <div className="font-mono text-2xl font-black tracking-widest text-slate-950">
              {trackingCode || 'CHỜ BẮN MÃ VẬN ĐƠN'}
            </div>
            <div className="h-12 flex items-stretch justify-center space-x-1 opacity-95">
              {[3, 1, 4, 2, 1, 5, 2, 1, 4, 3, 1, 2, 4, 3, 2, 5, 1, 4, 2, 3, 1, 4].map((w, idx) => (
                <span key={idx} className="bg-black" style={{ width: `${w * 2}px` }} />
              ))}
            </div>
            <div className="border-t border-slate-200 pt-2 text-xs text-slate-600 text-left space-y-1">
              <div className="flex justify-between font-bold text-slate-900">
                <span>Người nhận: Chị Mai Lan</span>
                <span>0988***222</span>
              </div>
              <div>Địa chỉ: 12 Ba Đình, Hà Nội</div>
            </div>
          </div>
        </div>
      ) : stationId && !streamError ? (
        <img
          ref={imgRef}
          key={`${stationId}_${retryCount}`}
          src={`http://localhost:4000/api/v1/stations/${stationId}/live-preview?t=${retryCount}`}
          alt="Live Camera Feed"
          crossOrigin="anonymous"
          onLoad={() => {
            setIsStreamLoaded(true);
            setStreamError(false);
          }}
          onError={() => {
            console.warn('Live camera stream disconnected, retrying in 3s...');
            setIsStreamLoaded(false);
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
      {/* Top Left: Station & Camera info + Honest Live/Ready badge + Auto-Scan Toggle */}
      <div className="absolute top-3.5 left-3.5 flex items-center space-x-2 bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-xs font-medium text-slate-200 z-10">
        <Camera className="w-3.5 h-3.5 text-blue-400" />
        <span className="font-bold">{stationCode}</span>
        <span className="text-slate-500">•</span>
        <span className="text-slate-300">{cameraName}</span>

        {/* Honest Stream Status - NEVER show fake LIVE */}
        <span className="text-slate-500">•</span>
        {streamError ? (
          <span className="flex items-center space-x-1 text-rose-400 text-[11px] font-bold">
            <AlertCircle className="w-3 h-3 text-rose-400" />
            <span>CHƯA CÓ HÌNH</span>
          </span>
        ) : !isStreamLoaded ? (
          <span className="flex items-center space-x-1 text-amber-400 text-[11px] font-bold">
            <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
            <span>ĐANG KẾT NỐI</span>
          </span>
        ) : state === 'RECORDING' ? (
          <span className="flex items-center space-x-1 text-rose-400 text-[11px] font-bold">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span>ĐANG GHI HÌNH</span>
          </span>
        ) : (
          <span className="flex items-center space-x-1 text-emerald-400 text-[11px] font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>SẴN SÀNG</span>
          </span>
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

            <span className="text-slate-500">•</span>
            <button
              type="button"
              onClick={toggleDualCam}
              title="Bật/Tắt chế độ 2 Camera: Toàn cảnh + Cận cảnh vận đơn (PiP)"
              className={`flex items-center space-x-1.5 px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                dualCamEnabled
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                  : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
              }`}
            >
              <Layers className="w-3 h-3 text-amber-400" />
              <span>{dualCamEnabled ? '2 CAM (PiP): BẬT' : '1 CAM (ĐƠN)'}</span>
            </button>

            <span className="text-slate-500">•</span>
            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Thu nhỏ khung hình [ESC]' : 'Phóng to toàn màn hình'}
              className={`flex items-center space-x-1.5 px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                isFullscreen
                  ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/50 hover:bg-cyan-500/40'
                  : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3 h-3 text-cyan-300" />
                  <span>THU NHỎ</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3 h-3 text-cyan-400" />
                  <span>FULL MÀN HÌNH</span>
                </>
              )}
            </button>
          </>
        )}
      </div>

      {/* Top Center: Auto-scan prompt when active */}
      {autoScanEnabled && !streamError && isStreamLoaded && (
        <div className="absolute top-3.5 left-1/2 -translate-x-1/2 hidden md:flex items-center space-x-1.5 bg-black/75 backdrop-blur-md px-3.5 py-1 rounded-full border border-emerald-500/30 text-[11px] text-emerald-300 font-medium z-10">
          <ScanLine className="w-3 h-3 text-emerald-400" />
          <span>
            {state === 'RECORDING'
              ? 'Đưa mã SKU sản phẩm vào camera để tự động đếm'
              : 'Đưa mã vận đơn vào khung camera để tự động đóng đơn'}
          </span>
        </div>
      )}

      {/* Top Right: REC Indicator + Millisecond timecode + Fullscreen Button */}
      <div className="absolute top-3.5 right-3.5 flex items-center space-x-2 z-10">
        {state === 'RECORDING' && (
          <div className="flex items-center space-x-2 bg-red-600 text-white px-3.5 py-1 rounded-lg font-black text-xs shadow-lg shadow-red-950/50 animate-pulse">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
            <span>REC {formatTimer(elapsedSeconds)}</span>
          </div>
        )}
        <div className="bg-black/75 backdrop-blur-md text-emerald-400 font-mono text-xs px-3 py-1.5 rounded-lg border border-white/10 font-bold">
          {timecode}
        </div>
        <button
          type="button"
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Thu nhỏ về giao diện thường [ESC]' : 'Phóng to toàn màn hình'}
          className={`flex items-center justify-center p-1.5 rounded-lg backdrop-blur-md border transition cursor-pointer ${
            isFullscreen
              ? 'bg-cyan-600 text-white border-cyan-400 shadow-lg hover:bg-cyan-500'
              : 'bg-black/75 text-slate-300 border-white/10 hover:text-white hover:bg-slate-800'
          }`}
        >
          {isFullscreen ? (
            <Minimize2 className="w-3.5 h-3.5 text-white" />
          ) : (
            <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
          )}
        </button>
      </div>

      {/* Center Guidance text ONLY when offline or connecting */}
      {streamError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-sm z-5 p-4 text-center">
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 mb-2">
            <AlertCircle className="w-8 h-8 text-rose-400" />
          </div>
          <span className="text-sm font-bold text-rose-200">
            CHƯA CÓ HÌNH (CAMERA CHƯA SẴN SÀNG)
          </span>
          <span className="text-xs text-slate-400 mt-1 max-w-sm">
            Không nhận được luồng hình ảnh từ trạm {stationCode}. Vui lòng kiểm tra cáp mạng, nguồn camera hoặc tiến trình worker.
          </span>
        </div>
      ) : !isStreamLoaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 z-5 p-4 text-center">
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-2">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          </div>
          <span className="text-sm font-bold text-amber-200">
            ĐANG KẾT NỐI CAMERA TRẠM {stationCode}...
          </span>
          <span className="text-xs text-slate-400 mt-1">
            Đang tải luồng hình ảnh trực tiếp từ camera {cameraName}
          </span>
        </div>
      )}

      {/* Picture-in-Picture Sub-frame (Cận cảnh tem vận đơn - Auto Adaptive) */}
      {dualCamEnabled && (
        <div
          className={`absolute z-20 transition-all duration-300 rounded-2xl overflow-hidden border-2 border-amber-400/90 shadow-[0_12px_40px_rgba(0,0,0,0.85)] bg-slate-900 flex flex-col ${getCornerClasses()} ${getSizeClasses()}`}
        >
          {/* Sub-frame Header Bar */}
          <div className="bg-slate-950/90 px-2.5 py-1.5 flex items-center justify-between border-b border-amber-500/30 text-[10px] font-bold text-amber-300 shrink-0">
            <div className="flex items-center space-x-1.5 truncate">
              <ScanLine className="w-3 h-3 text-amber-400 animate-pulse shrink-0" />
              <span className="truncate">{isSwapped ? 'TOÀN CẢNH BÀN HÀNG' : '🔍 TEM VẬN ĐƠN (CẬN)'}</span>
            </div>
            <div className="flex items-center space-x-1 shrink-0">
              <button
                type="button"
                onClick={() => setIsSwapped(!isSwapped)}
                title="Đảo góc nhìn: Đưa cam phụ ra toàn màn hình"
                className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-white cursor-pointer transition"
              >
                <ArrowLeftRight className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={cyclePipCorner}
                title="Chuyển vị trí góc hiển thị (Góc trên-phải, dưới-phải, v.v.)"
                className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-white cursor-pointer transition"
              >
                <Move className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={cyclePipSize}
                title="Thay đổi kích thước góc tem (Nhỏ / Vừa / To)"
                className="px-1.5 py-0.5 hover:bg-slate-800 rounded text-[9px] font-mono text-amber-300 border border-slate-700 cursor-pointer transition"
              >
                {pipSize === 'small' ? '22%' : pipSize === 'medium' ? '28%' : '35%'}
              </button>
              <button
                type="button"
                onClick={toggleDualCam}
                title="Tắt chế độ 2 Cam (Trở về 1 Cam Full màn hình)"
                className="p-1 hover:bg-rose-900/60 rounded text-slate-400 hover:text-rose-400 cursor-pointer transition"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Sub-frame Content */}
          {isSwapped ? (
            /* Swapped: Small box shows the full packing bench */
            <div className="relative flex-1 bg-slate-950 flex items-center justify-center overflow-hidden">
              {stationId && !streamError ? (
                <img
                  src={`http://localhost:4000/api/v1/stations/${stationId}/live-preview?t=${retryCount}`}
                  alt="Mini Bench Feed"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-[10px] text-slate-400">Toàn cảnh bàn đóng gói</div>
              )}
              <div className="absolute bottom-1 left-1.5 bg-black/70 text-slate-300 px-1 py-0.5 rounded text-[8px]">
                Toàn Cảnh
              </div>
            </div>
          ) : (
            /* Normal: Small box shows the high-res Macro Waybill */
            <div className="relative flex-1 bg-white text-slate-900 p-2.5 flex flex-col justify-between overflow-hidden select-none">
              {/* Top Carrier Brand */}
              <div className="flex items-center justify-between border-b-2 border-slate-900 pb-1">
                <div className="flex items-center space-x-1.5">
                  <span className="font-black text-[11px] tracking-tight bg-red-600 text-white px-1.5 py-0.5 rounded">
                    SPX
                  </span>
                  <span className="font-black text-xs text-slate-900 tracking-wider">EXPRESS</span>
                </div>
                <span className="text-[9px] font-extrabold text-slate-500 font-mono">MACRO HD</span>
              </div>

              {/* Waybill Tracking Code & High-Contrast Barcode */}
              <div className="my-auto py-1 text-center bg-slate-50 rounded border border-slate-200">
                <div className="font-mono text-sm md:text-base font-black tracking-widest text-slate-950 truncate px-1">
                  {trackingCode || 'CHỜ BẮN MÃ...'}
                </div>
                {/* Visual Barcode Graphic */}
                <div className="h-6 flex items-stretch justify-center space-x-[2px] mt-1 px-2 opacity-95">
                  <span className="w-[3px] bg-black"></span>
                  <span className="w-[1px] bg-black"></span>
                  <span className="w-[4px] bg-black"></span>
                  <span className="w-[2px] bg-black"></span>
                  <span className="w-[1px] bg-black"></span>
                  <span className="w-[5px] bg-black"></span>
                  <span className="w-[2px] bg-black"></span>
                  <span className="w-[1px] bg-black"></span>
                  <span className="w-[4px] bg-black"></span>
                  <span className="w-[3px] bg-black"></span>
                  <span className="w-[1px] bg-black"></span>
                  <span className="w-[2px] bg-black"></span>
                  <span className="w-[4px] bg-black"></span>
                  <span className="w-[3px] bg-black"></span>
                  <span className="w-[2px] bg-black"></span>
                  <span className="w-[5px] bg-black"></span>
                  <span className="w-[1px] bg-black"></span>
                  <span className="w-[4px] bg-black"></span>
                  <span className="w-[2px] bg-black"></span>
                  <span className="w-[3px] bg-black"></span>
                  <span className="w-[1px] bg-black"></span>
                  <span className="w-[4px] bg-black"></span>
                </div>
              </div>

              {/* Routing & Recipient Footer */}
              <div className="border-t border-slate-200 pt-1 text-[9px] text-slate-600 leading-tight">
                <div className="flex justify-between font-bold text-slate-900">
                  <span className="truncate">KH: Chị Mai Lan</span>
                  <span className="font-mono">0988***222</span>
                </div>
                <div className="truncate text-slate-500">Đ/C: 12 Ba Đình, Hà Nội</div>
              </div>

              {/* Animated Laser Barcode Scanner Beam while Recording */}
              {state === 'RECORDING' && (
                <div className="absolute inset-x-0 h-0.5 bg-red-600 shadow-[0_0_10px_#dc2626] animate-pulse top-1/2 -translate-y-1/2" />
              )}
            </div>
          )}
        </div>
      )}

      {/* Forensic Legal OSD Watermark Bar: Mã đơn | Trạm | NV | Ngày giờ */}
      <div className="absolute bottom-3 inset-x-3 bg-black/85 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/15 text-xs font-mono z-10 flex flex-wrap items-center justify-between gap-2 shadow-2xl">
        <div className="flex items-center space-x-2.5 flex-wrap">
          <div className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
            <span className="text-[11px] text-amber-400">Mã đơn:</span>
            <span className="text-amber-200 tracking-wider text-sm font-black">{trackingCode || 'CHỜ QUÉT'}</span>
          </div>
          <span className="text-slate-600">|</span>
          <span className="text-slate-300 text-xs">
            <span className="text-slate-400">Trạm: </span>
            <strong className="text-white font-bold">{stationCode}</strong>
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-300 text-xs">
            <span className="text-slate-400">NV: </span>
            <strong className="text-emerald-400 font-bold">{packerName}</strong>
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-300 text-xs">
            <span className="text-slate-400">Ngày giờ: </span>
            <strong className="text-cyan-300 font-mono font-bold">{timecode.slice(0, 19)}</strong>
          </span>
        </div>
        <div className="text-[10px] text-slate-400 font-mono tracking-tight hidden lg:block">
          Độ phân giải: Chưa xác định • fMP4
        </div>
      </div>
    </div>
  );
};
