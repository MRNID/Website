import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Flashlight,
  FlashlightOff,
  CheckCircle2,
  HardDriveDownload,
  RefreshCw,
  LogOut,
  ShieldCheck,
  Cloud
} from 'lucide-react';
import { sounds } from '../utils/audio';
import { useMobileStationSync } from '../hooks/useMobileStationSync';
import { API_BASE } from '../services/endpoints';
import { PendingMobileVideo, savePendingVideo, readPendingVideo, clearPendingVideo, mobileUploadId } from '../services/mobile-video-cache';

interface MobilePackingWorkbenchProps {
  user: any;
  onExitMobileMode: () => void;
  apiBaseUrl?: string;
  stationCode?: string;
  stations?: any[];
}

export const MobilePackingWorkbench: React.FC<MobilePackingWorkbenchProps> = ({
  user,
  onExitMobileMode,
  apiBaseUrl = new URL(API_BASE).origin,
  stationCode,
  stations = []
}) => {
  // Camera & Recording
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const pendingVideoRef = useRef<PendingMobileVideo | null>(null);
  const [cacheReady, setCacheReady] = useState(false);

  // States
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [trackingCode, setTrackingCode] = useState('');
  const [manualCodeInput, setManualCodeInput] = useState('');
  const [timecode, setTimecode] = useState('');

  // Upload & Storage Purge Status
  const [uploadState, setUploadState] = useState<'IDLE' | 'RECORDING' | 'UPLOADING' | 'PURGED_SUCCESS' | 'ERROR'>('IDLE');
  const [uploadProgressMsg, setUploadProgressMsg] = useState('');
  const [lastUploadedSession, setLastUploadedSession] = useState<{
    trackingCode: string;
    duration: number;
    fileSizeMb: string;
    sha256: string;
    purged: boolean;
  } | null>(null);

  // Dynamic station synchronization hook (SH-R1-01)
  const {
    activeStationCode,
    setActiveStationCode,
    isValidStation,
    statusMessage
  } = useMobileStationSync({
    stationCode,
    stations,
    isRecording,
    isUploading: uploadState === 'UPLOADING' || !!pendingVideoRef.current
  });

  useEffect(() => {
    let disposed = false;
    readPendingVideo(user.id).then(pending => {
      if (disposed || !pending) return;
      pendingVideoRef.current = pending;
      setTrackingCode(pending.code);
      setUploadState('ERROR');
      setUploadProgressMsg('Có video chưa được máy kho xác nhận. Bấm thử lại để tiếp tục gửi.');
    }).catch(() => {}).finally(() => { if (!disposed) setCacheReady(true); });
    const warn = (event: BeforeUnloadEvent) => { if (pendingVideoRef.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => { disposed = true; window.removeEventListener('beforeunload', warn); };
  }, [user.id]);

  // Packed stats in this mobile session
  const [packedCount, setPackedCount] = useState(0);
  const [googleDriveEmail, setGoogleDriveEmail] = useState<string | null>(null);

  // Check connected Google Drive on mount with auth token
  useEffect(() => {
    const bizId = user?.businessId;
    if (!bizId) return;

    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch(`${apiBaseUrl}/api/v1/businesses/${bizId}/google-drive`, { headers })
      .then((res) => res.json())
      .then((json) => {
        if (json.data?.connected && json.data?.email) {
          setGoogleDriveEmail(json.data.email);
        }
      })
      .catch(() => {});
  }, [user, apiBaseUrl]);

  // Timecode real-time ticker
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTimecode(now.toISOString().replace('T', ' ').slice(0, 19));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Elapsed recording timer
  useEffect(() => {
    let timer: any = null;
    if (isRecording) {
      timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => clearInterval(timer);
  }, [isRecording]);

  // Hidden Native Camera Input for iOS / Non-HTTPS fallback
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize Smartphone Camera (Back / Environment camera at 720p/1080p)
  const startMobileCamera = async () => {
    try {
      setCameraError(null);

      // Check if browser supports mediaDevices
      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const isHttp = typeof window !== 'undefined' && window.location.protocol === 'http:';
        if (isHttp) {
          throw new Error('iOS Safari chỉ cho phép Camera qua kết nối HTTPS bảo mật. Hãy chuyển sang https:// hoặc dùng nút Camera iPhone bên dưới.');
        } else {
          throw new Error('Trình duyệt chưa hỗ trợ Camera trực tiếp. Hãy dùng nút Camera iPhone bên dưới.');
        }
      }

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }

      // Constraints optimized for smartphones: Back camera, 720p for battery & storage efficiency
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Check for torch / flash capability
      const videoTrack = stream.getVideoTracks()[0];
      const capabilities: any = videoTrack?.getCapabilities ? videoTrack.getCapabilities() : {};
      if (capabilities.torch) {
        setHasTorch(true);
      }

      setCameraReady(true);
    } catch (err: any) {
      console.warn('[MobileCamera] Error starting camera:', err);
      setCameraError(err.message || 'Không thể mở Camera trên điện thoại.');
    }
  };

  useEffect(() => {
    startMobileCamera();
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Toggle Torch / Flashlight
  const toggleTorch = async () => {
    if (!mediaStreamRef.current) return;
    const track = mediaStreamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        const next = !torchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: next }]
        });
        setTorchOn(next);
      } catch (err) {
        console.warn('Could not toggle torch:', err);
      }
    }
  };

  // Start Packing Recording
  const startRecording = (code: string) => {
    if (!cacheReady || pendingVideoRef.current || uploadState === 'UPLOADING') return;
    if (!activeStationCode) {
      setUploadState('ERROR');
      setUploadProgressMsg('Chưa xác định trạm đóng gói hợp lệ. Vui lòng kiểm tra phân bổ trạm của kho.');
      sounds.playErrorBuzz();
      return;
    }

    if (!mediaStreamRef.current) {
      // If camera stream is unavailable, trigger native camera capture directly
      fileInputRef.current?.click();
      return;
    }
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return;

    try {
      recordedChunksRef.current = [];

      // Determine supported MIME type for iOS Safari and Android Chrome
      let mimeType = '';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('video/mp4')) {
          mimeType = 'video/mp4';
        } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
          mimeType = 'video/webm;codecs=vp8';
        } else if (MediaRecorder.isTypeSupported('video/webm')) {
          mimeType = 'video/webm';
        }
      }

      const recorder = mimeType
        ? new MediaRecorder(mediaStreamRef.current, { mimeType })
        : new MediaRecorder(mediaStreamRef.current);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const finalDuration = elapsedSeconds || 5;
        const videoBlob = new Blob(recordedChunksRef.current, { type: mimeType || 'video/webm' });
        uploadVideoBlob(videoBlob, cleanCode, finalDuration);
      };

      recorder.start(1000); // 1-second chunks
      mediaRecorderRef.current = recorder;

      setTrackingCode(cleanCode);
      setIsRecording(true);
      setUploadState('RECORDING');
      sounds.playRecordingStarted();
    } catch (err: any) {
      console.error('Failed to start MediaRecorder:', err);
      // Fallback to Native iOS camera capture
      fileInputRef.current?.click();
    }
  };

  // Stop Recording and trigger Background Sync & Auto Purge
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      sounds.playPackingCompleted();
    }
  };

  // Handle video captured from Native iOS Camera app
  const handleNativeVideoCaptured = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || pendingVideoRef.current) return;
    const code = manualCodeInput.trim() || `SPX${Math.floor(10000000 + Math.random() * 90000000)}`;
    setTrackingCode(code);
    uploadVideoBlob(file, code, 12);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Upload Video Blob/File to Server and Purge from Memory
  const uploadVideoBlob = async (videoData: Blob | File, code: string, durationSec: number) => {
    const token = localStorage.getItem('token');
    if (!token) {
      setUploadState('ERROR');
      setUploadProgressMsg('Vui lòng đăng nhập để thực hiện tải video lên máy chủ');
      sounds.playErrorBuzz();
      return;
    }

    if (!activeStationCode) {
      setUploadState('ERROR');
      setUploadProgressMsg('Chưa xác định trạm đóng gói hợp lệ. Vui lòng kiểm tra phân bổ trạm của kho.');
      sounds.playErrorBuzz();
      return;
    }

    const pending = pendingVideoRef.current || {
      userId: user.id, uploadId: mobileUploadId(), blob: videoData, code, duration: durationSec, stationCode: activeStationCode
    };
    pendingVideoRef.current = pending;
    setUploadState('UPLOADING');
    try { await savePendingVideo(pending); } catch { console.warn('Không lưu được bản tạm trên điện thoại; giữ tab này tới khi máy kho xác nhận.'); }
    const sizeMb = (videoData.size / (1024 * 1024)).toFixed(2);
    setUploadProgressMsg(`Đang truyền video (${sizeMb} MB) về máy kho...`);

    const ext = videoData.type.includes('quicktime') ? '.mov' : videoData.type.includes('mp4') ? '.mp4' : '.webm';
    const formData = new FormData();
    formData.append('video', videoData, `${code}_mobile${ext}`);
    formData.append('trackingCode', code);
    formData.append('stationCode', pending.stationCode);
    formData.append('uploadId', pending.uploadId);
    formData.append('orderCode', code);
    formData.append('duration', durationSec.toString());

    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/mobile/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (res.ok && data.success && data.purgeAllowed && data.storageOwner === 'WAREHOUSE') {
        // AUTO-PURGE: Free memory immediately
        recordedChunksRef.current = [];
        await clearPendingVideo(user.id).catch(() => {});
        pendingVideoRef.current = null;

        setUploadState('PURGED_SUCCESS');
        setPackedCount((prev) => prev + 1);
        setLastUploadedSession({
          trackingCode: code,
          duration: durationSec,
          fileSizeMb: sizeMb,
          sha256: data.sha256,
          purged: true
        });

        sounds.playScanSuccess();

        // Reset for next order after 4 seconds
        setTimeout(() => {
          setUploadState('IDLE');
          setTrackingCode('');
          setManualCodeInput('');
        }, 4500);
      } else {
        if (res.status === 401) {
          throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        } else if (res.status === 403) {
          throw new Error(data.error?.message || 'Không có quyền tải video cho trạm đóng gói này.');
        }
        throw new Error(data.error?.message || 'Lỗi khi đồng bộ lên máy chủ');
      }
    } catch (err: any) {
      console.error('[MobileUpload] Failed:', err);
      setUploadState('ERROR');
      setUploadProgressMsg(err.message || 'Lỗi kết nối máy chủ');
      sounds.playErrorBuzz();
    }
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-hidden touch-manipulation">
      {/* Top Mobile App Bar */}
      <header className="h-14 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Camera className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-xs font-black tracking-wide flex items-center space-x-1.5">
              <span>TRẠM DI ĐỘNG</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                PWA
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              NV: <span className="text-slate-200 font-bold">{user?.username || 'packer01'}</span> • Trạm:{' '}
              {stations && stations.length > 1 ? (
                <select
                  value={activeStationCode}
                  onChange={(e) => setActiveStationCode(e.target.value)}
                  disabled={isRecording || uploadState === 'UPLOADING'}
                  className="bg-slate-800 text-emerald-400 font-bold border border-slate-700 rounded px-1 text-[10px] cursor-pointer disabled:opacity-50"
                >
                  {stations.map((s: any) => (
                    <option key={s.id || s.code} value={s.code}>{s.code} - {s.name || s.code}</option>
                  ))}
                </select>
              ) : (
                <span className="text-emerald-400 font-bold">{activeStationCode || (stations.length === 0 ? 'Đang tải...' : 'Chưa có')}</span>
              )}{' '}
              • Đã gói: <strong className="text-amber-400">{packedCount}</strong> đơn
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {hasTorch && (
            <button
              onClick={toggleTorch}
              className={`p-2 rounded-xl border transition ${
                torchOn
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/30'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
              title="Bật/Tắt đèn Flash"
            >
              {torchOn ? <Flashlight className="w-4 h-4" /> : <FlashlightOff className="w-4 h-4" />}
            </button>
          )}

          <button
            onClick={onExitMobileMode}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-700 flex items-center space-x-1"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>PC</span>
          </button>
        </div>
      </header>

      {/* Center: Live Mobile Camera Viewport */}
      <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center">
        {/* Native Mobile Video Stream */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover pointer-events-none"
        />

        {/* Camera Permission / Error Overlay */}
        {cameraError && (
          <div className="absolute inset-0 bg-slate-950/95 z-30 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-3 shadow-xl">
              <Camera className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-white">Yêu Cầu Quyền Camera</h3>
            <p className="text-xs text-slate-300 mt-2 max-w-xs leading-relaxed">{cameraError}</p>

            {typeof window !== 'undefined' && window.location.protocol === 'http:' && (
              <button
                onClick={() => {
                  window.location.href = `https://${window.location.hostname}:3000${window.location.pathname}${window.location.search}`;
                }}
                className="mt-4 w-full max-w-xs py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-black shadow-lg shadow-blue-500/25 active:scale-95 transition"
              >
                👉 CHUYỂN SANG HTTPS ĐỂ BẬT CAMERA
              </button>
            )}

            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-2.5 w-full max-w-xs py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-400 text-xs font-bold shadow-md active:scale-95 transition flex items-center justify-center space-x-2"
            >
              <Camera className="w-4 h-4" />
              <span>📷 QUAY BẰNG CAMERA IPHONE (NATIVE)</span>
            </button>

            <button
              onClick={startMobileCamera}
              className="mt-2 text-slate-400 text-[11px] underline"
            >
              Thử kết nối lại
            </button>
          </div>
        )}

        {/* Hidden File Input for Native iOS Camera Capture */}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          capture="environment"
          className="hidden"
          onChange={handleNativeVideoCaptured}
        />

        {/* Camera Initializing */}
        {!cameraReady && !cameraError && (
          <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center z-25 text-center p-6">
            <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mb-2" />
            <span className="text-xs font-semibold text-slate-300">Đang khởi động Camera điện thoại...</span>
          </div>
        )}

        {/* Camera Reticle / Target Box for Label & Items */}
        <div className="absolute inset-8 border border-white/20 rounded-2xl pointer-events-none flex flex-col justify-between p-3">
          <div className="flex justify-between items-start">
            <div className="w-6 h-6 border-t-2 border-l-2 border-blue-400 rounded-tl-lg" />
            <div className="w-6 h-6 border-t-2 border-r-2 border-blue-400 rounded-tr-lg" />
          </div>

          {/* Aiming label when idle */}
          {!isRecording && uploadState === 'IDLE' && (
            <div className="self-center bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-[11px] text-slate-300 font-medium">
              Hướng camera vào bàn đóng hàng & tem đơn
            </div>
          )}

          <div className="flex justify-between items-end">
            <div className="w-6 h-6 border-b-2 border-l-2 border-blue-400 rounded-bl-lg" />
            <div className="w-6 h-6 border-b-2 border-r-2 border-blue-400 rounded-br-lg" />
          </div>
        </div>

        {/* Top Floating Status: REC Timer or Storage Badge */}
        <div className="absolute top-3 inset-x-3 flex items-center justify-between z-10 pointer-events-none">
          {isRecording ? (
            <div className="flex items-center space-x-2 bg-red-600/90 text-white px-3 py-1 rounded-lg font-bold text-xs shadow-xl animate-pulse">
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
              <span>ĐANG QUAY: {formatTimer(elapsedSeconds)}</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 text-[11px] text-emerald-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>SẴN SÀNG</span>
            </div>
          )}

          {/* Auto Purge Storage & Google Drive Badges */}
          <div className="flex items-center space-x-1.5">
            {googleDriveEmail && (
              <div className="flex items-center space-x-1 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg border border-blue-500/40 text-[10px] text-blue-300 font-mono shadow-md">
                <Cloud className="w-3 h-3 text-blue-400" />
                <span className="truncate max-w-[110px]">DRIVE: {googleDriveEmail}</span>
              </div>
            )}

            <div className="flex items-center space-x-1 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 text-[10px] text-cyan-300 font-mono">
              <HardDriveDownload className="w-3 h-3 text-cyan-400" />
              <span>LƯU TẠI MÁY KHO</span>
            </div>
          </div>
        </div>

        {/* Forensic Watermark Ribbon (Embedded on Screen) */}
        <div className="absolute bottom-3 inset-x-3 bg-black/85 backdrop-blur-md px-3 py-2 rounded-xl border border-white/15 text-[11px] font-mono z-10 shadow-2xl flex flex-col space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-amber-300 font-bold">
              MÃ ĐƠN: <strong className="text-white text-xs">{trackingCode || 'CHỜ BẮT ĐẦU'}</strong>
            </span>
            <span className="text-emerald-400 font-semibold">NV: {user?.username || 'packer01'}</span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5 border-t border-slate-800">
            <span>Trạm: <strong className={isValidStation ? "text-slate-200" : "text-amber-400 font-bold"}>{statusMessage}</strong></span>
            <span className="text-cyan-300">{timecode}</span>
          </div>
        </div>

        {/* Success Modal / Purged Badge Animation */}
        {uploadState === 'PURGED_SUCCESS' && lastUploadedSession && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md z-30 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 mb-4 shadow-xl shadow-emerald-500/20 animate-bounce">
              <ShieldCheck className="w-9 h-9" />
            </div>
            <h3 className="text-lg font-black text-white">ĐÓNG ĐƠN THÀNH CÔNG!</h3>
            <p className="text-xs text-slate-300 mt-1">
              Đơn hàng: <strong className="text-amber-300 font-mono">{lastUploadedSession.trackingCode}</strong>
            </p>
            <div className="mt-4 p-3 bg-slate-900 rounded-xl border border-slate-800 w-full max-w-xs text-left space-y-1.5 text-xs font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Thời lượng:</span>
                <span className="text-white font-bold">{lastUploadedSession.duration}s</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Dung lượng video:</span>
                <span className="text-white font-bold">{lastUploadedSession.fileSizeMb} MB</span>
              </div>
              <div className="flex justify-between text-emerald-400 pt-1.5 border-t border-slate-800 font-bold">
                <span>Bộ nhớ điện thoại:</span>
                <span>ĐÃ XÓA BẢN TẠM</span>
              </div>
            </div>
            <div className="mt-4 flex items-center space-x-1.5 text-xs text-emerald-400 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              <span>Đã lưu và kiểm tra video tại máy kho; Drive đang chờ đồng bộ</span>
            </div>
          </div>
        )}

        {uploadState === 'ERROR' && (
          <div role="alert" className="absolute inset-0 bg-slate-950/95 z-40 flex flex-col items-center justify-center p-6 text-center gap-4">
            <p className="text-sm text-amber-200">{uploadProgressMsg}</p>
            {pendingVideoRef.current ? <>
              <p className="text-xs text-slate-300">Video chưa được xóa. Giữ bản này tới khi máy kho xác nhận lưu thành công.</p>
              <button className="px-4 py-3 rounded-xl bg-blue-600 text-white" onClick={() => {
                const pending = pendingVideoRef.current!;
                void uploadVideoBlob(pending.blob, pending.code, pending.duration);
              }}>Thử gửi lại về máy kho</button>
              <button className="text-cyan-300 underline text-sm" onClick={() => {
                const pending = pendingVideoRef.current!;
                const url = URL.createObjectURL(pending.blob);
                const link = document.createElement('a'); link.href = url;
                link.download = pending.code + (pending.blob.type.includes('mp4') ? '.mp4' : pending.blob.type.includes('quicktime') ? '.mov' : '.webm');
                link.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
              }}>Lưu thêm bản video vào điện thoại</button>
            </> : <button className="text-blue-300 underline" onClick={() => setUploadState('IDLE')}>Quay lại</button>}
          </div>
        )}
        {/* Uploading Spinner */}
        {uploadState === 'UPLOADING' && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md z-30 flex flex-col items-center justify-center p-6 text-center">
            <RefreshCw className="w-12 h-12 text-blue-400 animate-spin mb-3" />
            <h4 className="text-base font-bold text-white">Đang chuyển video về máy kho...</h4>
            <p className="text-xs text-slate-400 mt-1 font-mono">{uploadProgressMsg}</p>
            <span className="text-[11px] text-amber-300/80 mt-3">
              Tự động giải phóng bộ nhớ điện thoại sau khi tải xong...
            </span>
          </div>
        )}
      </div>

      {/* Bottom Control Sheet: Big thumb buttons */}
      <div className="bg-slate-900 border-t border-slate-800 p-4 shrink-0 flex flex-col space-y-3 z-20">
        {!isRecording ? (
          /* Idle State: Enter tracking code & Start */
          <div className="flex flex-col space-y-2.5">
            <div className="flex space-x-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={manualCodeInput}
                  onChange={(e) => setManualCodeInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && manualCodeInput.trim() && isValidStation) {
                      startRecording(manualCodeInput);
                    }
                  }}
                  placeholder="Quét hoặc nhập mã vận đơn SPX..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm font-mono text-amber-300 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {manualCodeInput.trim() && (
                <button
                  onClick={() => setManualCodeInput('')}
                  className="px-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-400 text-xs"
                >
                  Xóa
                </button>
              )}
            </div>

            <button
              disabled={!isValidStation}
              onClick={() => {
                const code = manualCodeInput.trim() || `SPX${Math.floor(10000000 + Math.random() * 90000000)}`;
                startRecording(code);
              }}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white font-black text-sm shadow-xl shadow-blue-500/25 active:scale-[0.98] transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Camera className="w-4 h-4 text-white" />
              <span>
                {!isValidStation
                  ? (stations.length === 0 ? 'ĐANG TẢI TRẠM ĐÓNG GÓI...' : 'CHƯA CÓ TRẠM ĐƯỢC CHỌN')
                  : (manualCodeInput.trim() ? `BẮT ĐẦU ĐÓNG: ${manualCodeInput}` : 'BẮT ĐẦU ĐÓNG ĐƠN (MẪU TEST)')}
              </span>
            </button>

            <button
              type="button"
              disabled={!isValidStation}
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-400 font-bold text-xs active:scale-[0.98] transition flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>QUAY BẰNG CAMERA IPHONE (NATIVE)</span>
            </button>
          </div>
        ) : (
          /* Recording State: Finish button */
          <div className="flex flex-col space-y-2">
            <button
              onClick={stopRecording}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-black text-base shadow-xl shadow-emerald-500/30 active:scale-[0.98] transition flex items-center justify-center space-x-2 cursor-pointer"
            >
              <CheckCircle2 className="w-6 h-6 text-white" />
              <span>HOÀN TẤT & ĐỒNG BỘ BẰNG CHỨNG</span>
            </button>
            <div className="text-center text-[11px] text-slate-400 font-mono">
              Đang quay: <strong className="text-white">{trackingCode}</strong> • {formatTimer(elapsedSeconds)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
