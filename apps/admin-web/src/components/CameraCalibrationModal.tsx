import React, { useState } from 'react';
import {
  Camera,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Crosshair,
  ShieldCheck,
  Radio,
  Loader2
} from 'lucide-react';
import { adminApi } from '../services/api';
import { API_BASE } from '../services/endpoints';

interface CameraCalibrationModalProps {
  isOpen: boolean;
  station: any;
  onClose: () => void;
  onSavePreset?: (preset: { zoom: number; panX: number; panY: number }) => void;
}

export const CameraCalibrationModal: React.FC<CameraCalibrationModalProps> = ({
  isOpen,
  station,
  onClose,
  onSavePreset
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [ptzStatus, setPtzStatus] = useState<string | null>(null);
  const [isSendingPtz, setIsSendingPtz] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen || !station) return null;

  const cameraIp = station.ipAddress || '192.168.0.15';
  const cameraName = station.camera?.name || `CAM_${station.code}`;

  const sendHardwarePtz = async (code: 'Up' | 'Down' | 'Left' | 'Right' | 'ZoomWide' | 'ZoomTele') => {
    setIsSendingPtz(true);
    setPtzStatus(`Đang gửi lệnh ${code} tới camera IP ${cameraIp}...`);
    try {
      const res = await adminApi.sendPtzCommand({
        ipAddress: cameraIp,
        action: 'start',
        code,
        arg1: 0,
        arg2: 5,
        arg3: 0
      });
      setPtzStatus(res.message || `Lệnh ${code} thành công`);
    } catch (err: any) {
      setPtzStatus(`Lệnh ${code}: ${err.message}`);
    } finally {
      setIsSendingPtz(false);
    }
  };

  const handleTiltUp = () => {
    setPanY((y) => Math.min(45, y + 8));
    sendHardwarePtz('Up');
  };

  const handleTiltDown = () => {
    setPanY((y) => Math.max(-45, y - 8));
    sendHardwarePtz('Down');
  };

  const handlePanLeft = () => {
    setPanX((x) => Math.min(45, x + 8));
    sendHardwarePtz('Left');
  };

  const handlePanRight = () => {
    setPanX((x) => Math.max(-45, x - 8));
    sendHardwarePtz('Right');
  };

  const handleZoomIn = () => {
    setZoom((z) => Math.min(3.5, +(z + 0.25).toFixed(2)));
    sendHardwarePtz('ZoomTele');
  };

  const handleZoomOut = () => {
    setZoom((z) => {
      const next = Math.max(1, +(z - 0.25).toFixed(2));
      if (next === 1) {
        setPanX(0);
        setPanY(0);
      }
      return next;
    });
    sendHardwarePtz('ZoomWide');
  };

  const handleResetCenter = () => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
    setPtzStatus('Đã đặt lại góc nhìn mặc định 1.0x (Căn giữa)');
  };

  const handleSave = () => {
    if (onSavePreset) {
      onSavePreset({ zoom, panX, panY });
    }
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-5xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
              <Camera className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <span>CÂN CHỈNH MẮT CAMERA & THU PHÓNG (ZOOM / PAN / TILT)</span>
                <span className="px-2 py-0.5 rounded-full bg-blue-950 border border-blue-600/40 text-[11px] font-mono text-blue-300">
                  {station.code} - {station.name}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Điều chỉnh góc quay mắt camera lên/xuống/trái/phải và thu phóng ống kính căn chuẩn mặt bàn đóng hàng
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition font-bold"
          >
            ✕
          </button>
        </div>

        {/* Content Body: 2 Columns */}
        <div className="grid grid-cols-12 gap-5 flex-1 min-h-0">
          {/* Left Column: Live Stream Preview Screen (7 cols) */}
          <div className="col-span-7 flex flex-col space-y-2">
            <div className="relative w-full aspect-video bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-xl flex items-center justify-center group">
              {/* Live Preview Image Container with Zoom & Pan */}
              <div
                className="absolute inset-0 w-full h-full transition-transform duration-100 ease-out origin-center flex items-center justify-center"
                style={{
                  transform: `scale(${zoom}) translate(${panX}%, ${panY}%)`
                }}
              >
                {!streamError ? (
                  <img
                    src={`${API_BASE}/stations/${station.id}/live-preview?t=${Date.now()}`}
                    alt="Live Stream Preview"
                    onError={() => setStreamError(true)}
                    className="w-full h-full object-cover select-none pointer-events-none"
                  />
                ) : (
                  <div className="text-center p-6 space-y-2">
                    <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
                    <div className="text-xs font-bold text-slate-300">Đang chờ luồng tín hiệu từ camera...</div>
                    <div className="text-[11px] text-slate-500 font-mono">IP: {cameraIp}</div>
                  </div>
                )}
              </div>

              {/* Crosshair / Alignment Grid Overlay */}
              {showGrid && (
                <div className="absolute inset-0 pointer-events-none border border-emerald-500/20">
                  {/* Rule of Thirds Grid Lines */}
                  <div className="absolute inset-x-0 top-1/3 border-b border-emerald-500/25 border-dashed" />
                  <div className="absolute inset-x-0 top-2/3 border-b border-emerald-500/25 border-dashed" />
                  <div className="absolute inset-y-0 left-1/3 border-r border-emerald-500/25 border-dashed" />
                  <div className="absolute inset-y-0 left-2/3 border-r border-emerald-500/25 border-dashed" />

                  {/* Center Target Box for Barcode / Packaging Area */}
                  <div className="absolute inset-0 m-auto w-48 h-32 border-2 border-amber-400/70 rounded-xl bg-amber-500/5 flex items-center justify-center shadow-lg">
                    <Crosshair className="w-6 h-6 text-amber-300 animate-pulse" />
                    <span className="absolute bottom-1 text-[9px] font-bold text-amber-300 uppercase tracking-widest bg-black/60 px-1.5 py-0.5 rounded">
                      KHU VỰC ĐÓNG HÀNG
                    </span>
                  </div>
                </div>
              )}

              {/* OSD Live Badges */}
              <div className="absolute top-2.5 left-2.5 flex items-center space-x-1.5 bg-black/75 px-2.5 py-1 rounded-lg border border-white/10 text-[11px] font-medium text-slate-200">
                <Radio className="w-3 h-3 text-red-400 animate-pulse" />
                <span>LIVE PREVIEW</span>
                <span className="text-slate-500">•</span>
                <span className="text-blue-300 font-mono">{zoom.toFixed(1)}x</span>
              </div>

              <button
                type="button"
                onClick={() => setShowGrid(!showGrid)}
                className="absolute top-2.5 right-2.5 px-2 py-1 rounded-lg bg-black/75 hover:bg-slate-800 text-[11px] font-medium text-slate-300 border border-white/10 transition flex items-center space-x-1"
              >
                <Crosshair className="w-3 h-3 text-emerald-400" />
                <span>{showGrid ? 'Ẩn lưới dóng' : 'Hiện lưới dóng'}</span>
              </button>
            </div>

            <div className="text-[11px] text-slate-400 flex items-center justify-between px-1">
              <span>Mắt camera: <strong className="text-slate-200">{cameraName}</strong></span>
              <span className="font-mono text-cyan-300">RTSP: {station.camera?.rtspUrl || `rtsp://${cameraIp}:554`}</span>
            </div>
          </div>

          {/* Right Column: Directional PTZ & Zoom Controls (5 cols) */}
          <div className="col-span-5 bg-slate-950/80 rounded-2xl p-4 border border-slate-800 flex flex-col justify-between space-y-4">
            {/* Section 1: Directional D-Pad (Lên / Xuống / Trái / Phải) */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wide flex items-center space-x-1.5">
                <Sliders className="w-3.5 h-3.5 text-blue-400" />
                <span>1. ĐIỀU CHỈNH HƯỚNG MẮT CAMERA</span>
              </span>

              {/* D-Pad Controller */}
              <div className="flex flex-col items-center justify-center p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1.5">
                {/* Up */}
                <button
                  type="button"
                  onClick={handleTiltUp}
                  className="px-4 py-2 bg-slate-800 hover:bg-blue-600 active:bg-blue-700 text-slate-200 hover:text-white font-bold rounded-xl text-xs flex items-center space-x-1 shadow transition border border-slate-700 cursor-pointer"
                >
                  <ChevronUp className="w-4 h-4" />
                  <span>LÊN TRÊN (TILT UP)</span>
                </button>

                {/* Left, Center, Right */}
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handlePanLeft}
                    className="px-3 py-2 bg-slate-800 hover:bg-blue-600 active:bg-blue-700 text-slate-200 hover:text-white font-bold rounded-xl text-xs flex items-center space-x-1 shadow transition border border-slate-700 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>TRÁI</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResetCenter}
                    title="Đặt lại về góc nhìn chính giữa 1.0x"
                    className="px-2.5 py-2 bg-blue-950 hover:bg-blue-900 text-blue-300 border border-blue-600/40 rounded-xl text-xs font-bold transition flex items-center space-x-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>GIỮA</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePanRight}
                    className="px-3 py-2 bg-slate-800 hover:bg-blue-600 active:bg-blue-700 text-slate-200 hover:text-white font-bold rounded-xl text-xs flex items-center space-x-1 shadow transition border border-slate-700 cursor-pointer"
                  >
                    <span>PHẢI</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Down */}
                <button
                  type="button"
                  onClick={handleTiltDown}
                  className="px-4 py-2 bg-slate-800 hover:bg-blue-600 active:bg-blue-700 text-slate-200 hover:text-white font-bold rounded-xl text-xs flex items-center space-x-1 shadow transition border border-slate-700 cursor-pointer"
                >
                  <ChevronDown className="w-4 h-4" />
                  <span>XUỐNG DƯỚI (TILT DOWN)</span>
                </button>
              </div>
            </div>

            {/* Section 2: Zoom Slider & Controls */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wide flex items-center space-x-1.5">
                  <ZoomIn className="w-3.5 h-3.5 text-emerald-400" />
                  <span>2. ĐIỀU CHỈNH THU PHÓNG (ZOOM)</span>
                </span>
                <span className="font-mono font-bold text-emerald-400 text-xs px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800">
                  {zoom.toFixed(1)}x
                </span>
              </div>

              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-2.5">
                <input
                  type="range"
                  min="1"
                  max="3.5"
                  step="0.1"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />

                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={handleZoomOut}
                    disabled={zoom <= 1}
                    className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-bold rounded-lg text-xs flex items-center justify-center space-x-1 border border-slate-700 transition"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                    <span>THU NHỎ (-)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleZoomIn}
                    disabled={zoom >= 3.5}
                    className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold rounded-lg text-xs flex items-center justify-center space-x-1 transition shadow"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                    <span>PHÓNG TO (+)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Hardware PTZ Feedback Status */}
            {ptzStatus && (
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300 font-mono truncate flex items-center space-x-1.5">
                {isSendingPtz ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400 shrink-0" />
                ) : (
                  <span>📡</span>
                )}
                <span className="truncate">{ptzStatus}</span>
              </div>
            )}

            {savedSuccess && (
              <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-bold flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Đã lưu cấu hình góc quay mặc định cho trạm!</span>
              </div>
            )}

            {/* Actions: Save & Close */}
            <div className="flex items-center space-x-2 pt-1 border-t border-slate-800">
              <button
                type="button"
                onClick={handleSave}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow transition cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>LƯU GÓC QUAY NÀY</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition"
              >
                ĐÓNG
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
