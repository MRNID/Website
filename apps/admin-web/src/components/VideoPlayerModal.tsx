import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Lock, Unlock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { VideoRecord, adminApi, HashVerifyResult } from '../services/api';

interface VideoPlayerModalProps {
  video: VideoRecord | null;
  onClose: () => void;
  onUpdated: () => void;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({ video, onClose, onUpdated }) => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<HashVerifyResult | null>(null);
  const [playback, setPlayback] = useState<{ url: string; source: string } | null>(null);
  const [playbackError, setPlaybackError] = useState('');
  const [playbackAttempt, setPlaybackAttempt] = useState(0);

  useEffect(() => {
    let disposed = false;
    setPlayback(null);
    setPlaybackError('');
    if (video) adminApi.getVideoPlayback(video.id).then(result => {
      if (!disposed) setPlayback(result);
    }).catch(error => { if (!disposed) setPlaybackError(error.message); });
    return () => { disposed = true; };
  }, [video?.id, playbackAttempt]);

  // Dispute editing state
  const [isLocked, setIsLocked] = useState(video?.is_locked || false);
  const [disputeStatus, setDisputeStatus] = useState<string>(video?.dispute_status || 'NONE');
  const [lockReason, setLockReason] = useState<string>('');
  const [isSavingDispute, setIsSavingDispute] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!video) return null;

  const handleVerifyHash = async () => {
    setIsVerifying(true);
    setVerifyResult(null);
    try {
      const res = await adminApi.verifyVideoHash(video.id);
      setVerifyResult(res);
    } catch (err: any) {
      alert(`Lỗi xác minh: ${err.message}`);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSaveDispute = async () => {
    setIsSavingDispute(true);
    setSaveSuccess(false);
    try {
      await adminApi.updateDisputeLock(video.id, isLocked, disputeStatus, lockReason);
      setSaveSuccess(true);
      onUpdated();
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: any) {
      alert(`Lỗi lưu khiếu nại: ${err.message}`);
    } finally {
      setIsSavingDispute(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="p-4 px-6 bg-slate-850 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="font-mono text-lg font-bold text-white tracking-wide">
              {video.tracking_code}
            </span>
            <span className="bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs px-2 py-0.5 rounded font-semibold">
              {video.platform}
            </span>
            {video.is_locked && (
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs px-2 py-0.5 rounded font-bold flex items-center space-x-1">
                <Lock className="w-3 h-3" />
                <span>KHIẾU NẠI - ĐÃ KHÓA XÓA</span>
              </span>
            )}
          </div>

          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-12 gap-6">
          {/* Left: Video Player (7 cols) */}
          <div className="col-span-7 flex flex-col space-y-3">
            <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-slate-700 shadow-inner flex items-center justify-center">
              {playback && !playbackError ? <video
                src={playback.url}
                onError={() => setPlaybackError('Chưa đọc được video. Kiểm tra máy kho hoặc thử mở lại bản sao Drive.')}
                controls
                autoPlay
                className="w-full h-full object-contain"
              >
                Trình duyệt không hỗ trợ phát thẻ video HTML5.
              </video> : <div className="text-sm text-slate-300 p-5 text-center">
                <p>{playbackError || 'Đang kết nối tới nơi lưu video...'}</p>
                {playbackError && <button className="mt-3 text-blue-300 underline" onClick={() => setPlaybackAttempt(n => n + 1)}>Thử lại</button>}
              </div>}
            </div>

            {/* Quick Playback Info */}
            <div className="grid grid-cols-3 gap-2 bg-slate-900/60 p-3 rounded-xl border border-slate-700/60 text-xs text-slate-300">
              <div>
                <span className="text-slate-500 block text-[10px]">Thời lượng:</span>
                <span className="font-mono font-bold text-white">{video.duration} giây</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Dung lượng:</span>
                <span className="font-mono font-bold text-white">
                  {(video.file_size / (1024 * 1024)).toFixed(2)} MB
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Bản sao Google Drive:</span>
                <span className="font-semibold text-emerald-400">{({ SYNCED: 'Đã xác nhận', SYNCING: 'Đang tải', FAILED: 'Sẽ thử lại', PENDING: 'Chờ đồng bộ', LOCAL: 'Chỉ có tại kho' } as Record<string, string>)[video.sync_status] || video.sync_status}</span>
              </div>
            </div>
            <p className="text-xs text-slate-400">Nguồn xem: {playback?.source === 'GOOGLE_DRIVE' ? 'Google Drive của khách hàng' : 'Máy tại kho'}. Server không giữ bản video.</p>
          </div>

          {/* Right: Forensic Details & Dispute Lock (5 cols) */}
          <div className="col-span-5 flex flex-col space-y-4">
            {/* Metadata Card */}
            <div className="bg-slate-900/80 rounded-2xl p-4 border border-slate-700 text-xs space-y-2">
              <h4 className="font-bold text-slate-200 border-b border-slate-800 pb-2">
                THÔNG TIN PHIÊN ĐÓNG GÓI
              </h4>
              <div className="flex justify-between">
                <span className="text-slate-400">Trạm đóng gói:</span>
                <span className="text-white font-semibold">{video.station_code} - {video.station_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Nhân viên đóng hàng:</span>
                <span className="text-white font-semibold">{video.operator_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Thời gian tạo:</span>
                <span className="text-white font-semibold">
                  {new Date(video.created_at).toLocaleString('vi-VN')}
                </span>
              </div>
              <div className="flex flex-col pt-1">
                <span className="text-slate-400">Mã băm SHA-256 (Cơ sở dữ liệu):</span>
                <span className="font-mono text-[11px] text-amber-300 break-all bg-slate-950 p-1.5 rounded mt-1 border border-slate-800 select-all">
                  {video.sha256}
                </span>
              </div>
            </div>

            {/* SHA-256 Integrity Verification Box */}
            <div className="bg-slate-900/80 rounded-2xl p-4 border border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs text-slate-200 flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>XÁC THỰC TOÀN VẸN VIDEO</span>
                </h4>
                <button
                  onClick={handleVerifyHash}
                  disabled={isVerifying}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-bold rounded-lg text-xs transition"
                >
                  {isVerifying ? 'Đang băm...' : 'XÁC MINH SHA-256'}
                </button>
              </div>

              {verifyResult && (
                <div
                  className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                    verifyResult.isMatch
                      ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                      : 'bg-rose-950/60 border-rose-500/50 text-rose-200'
                  }`}
                >
                  <div className="flex items-center space-x-2 font-bold">
                    {verifyResult.isMatch ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>VIDEO NGUYÊN BẢN 100% (KHÔNG BỊ THAY ĐỔI)</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 text-rose-400" />
                        <span>CẢNH BÁO: MÃ HASH KHÔNG KHỚP (FILE BỊ CAN THIỆP)</span>
                      </>
                    )}
                  </div>
                  <div className="text-[10px] font-mono break-all opacity-80 pt-1">
                    Calc: {verifyResult.calculatedHash}
                  </div>
                </div>
              )}
            </div>

            {/* Dispute Lock & Legal Protection Box */}
            <div className="bg-slate-900/80 rounded-2xl p-4 border border-slate-700 text-xs space-y-3">
              <h4 className="font-bold text-slate-200 flex items-center space-x-1.5">
                <Lock className="w-4 h-4 text-amber-400" />
                <span>QUẢN LÝ KHIẾU NẠI & KHÓA XÓA</span>
              </h4>

              <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="font-medium text-slate-300">Khóa video (Chống xóa định kỳ):</span>
                <button
                  type="button"
                  onClick={() => setIsLocked(!isLocked)}
                  className={`px-3 py-1 rounded-lg font-bold flex items-center space-x-1.5 transition ${
                    isLocked ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  <span>{isLocked ? 'ĐÃ KHÓA' : 'CHƯA KHÓA'}</span>
                </button>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Trạng thái khiếu nại:</label>
                <select
                  value={disputeStatus}
                  onChange={(e) => setDisputeStatus(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-medium focus:outline-none"
                >
                  <option value="NONE">Bình thường (Không khiếu nại)</option>
                  <option value="UNDER_REVIEW">Đang kiểm tra nội bộ</option>
                  <option value="SUBMITTED_TO_CARRIER">Đã gửi bằng chứng cho sàn / ĐVVC</option>
                  <option value="WON">Khiếu nại thành công (Thắng kiện)</option>
                  <option value="LOST">Khiếu nại thất bại (Thua kiện)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Ghi chú khiếu nại:</label>
                <input
                  type="text"
                  value={lockReason}
                  onChange={(e) => setLockReason(e.target.value)}
                  placeholder="VD: Khách khiếu nại giao thiếu tai nghe..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white placeholder-slate-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                {saveSuccess ? (
                  <span className="text-emerald-400 font-bold flex items-center space-x-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Đã cập nhật khiếu nại!</span>
                  </span>
                ) : (
                  <span />
                )}

                <button
                  onClick={handleSaveDispute}
                  disabled={isSavingDispute}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white font-bold rounded-lg transition"
                >
                  {isSavingDispute ? 'Đang lưu...' : 'LƯU THAY ĐỔI'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
