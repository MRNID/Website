import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  HardDrive,
  ShieldCheck,
  XCircle,
  Cloud,
  Copy,
  Check,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export interface SessionItem {
  id: string;
  status: string;
  trackingCode: string;
  orderCode: string;
  platform: string;
  startTime: string | null;
  endTime: string | null;
  createdAt: string;
  video?: {
    id: string;
    duration: number | string;
    fileSize: number | string | bigint;
    sha256: string;
    syncStatus: string;
    localPath?: string;
  } | null;
}

interface PackingHistoryProps {
  sessions: SessionItem[];
  isLoading: boolean;
}

export const PackingHistory: React.FC<PackingHistoryProps> = ({ sessions, isLoading }) => {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const formatTime = (isoString?: string | null) => {
    if (!isoString) return '--:--:--';
    try {
      return new Date(isoString).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } catch {
      return '--:--:--';
    }
  };

  const formatFileSize = (bytes?: number | string | bigint | null) => {
    if (!bytes) return 'Chưa xác định';
    const num = Number(bytes);
    if (num <= 0 || isNaN(num)) return 'Chưa xác định';
    const mb = num / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const formatDuration = (sec?: number | string | null) => {
    if (sec === undefined || sec === null) return 'Chưa xác định';
    const num = Math.round(Number(sec));
    if (isNaN(num) || num < 0) return 'Chưa xác định';
    return `${num}s`;
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(id);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const renderCloudSyncBadge = (syncStatus?: string) => {
    switch (syncStatus) {
      case 'SYNCED':
        return (
          <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-emerald-950/70 border border-emerald-500/30 text-emerald-300 text-[10px] font-medium">
            <Cloud className="w-3 h-3 text-emerald-400" />
            <span>Google Drive: Đã lưu</span>
          </span>
        );
      case 'SYNCING':
        return (
          <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-blue-950/70 border border-blue-500/30 text-blue-300 text-[10px] font-medium animate-pulse">
            <Cloud className="w-3 h-3 text-blue-400" />
            <span>Google Drive: Đang đồng bộ</span>
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-rose-950/70 border border-rose-500/30 text-rose-300 text-[10px] font-medium">
            <Cloud className="w-3 h-3 text-rose-400" />
            <span>Google Drive: Lỗi, sẽ thử lại</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-amber-950/70 border border-amber-500/30 text-amber-300 text-[10px] font-medium">
            <Clock className="w-3 h-3 text-amber-400" />
            <span>Google Drive: Chờ đồng bộ</span>
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-4 shadow-xl flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800 shrink-0">
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-blue-400" />
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wide">
            LỊCH SỬ ĐÓNG GÓI HÔM NAY ({sessions.length})
          </h3>
        </div>
        <span className="text-[11px] text-slate-400 font-mono">Bấm vào đơn để xem mã băm SHA-256</span>
      </div>

      {/* List container with strict internal scroll */}
      <div className="flex-1 overflow-y-auto mt-2 space-y-2 pr-1 min-h-0">
        {isLoading && sessions.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">Đang tải lịch sử đóng gói...</div>
        ) : sessions.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            Chưa có đơn hàng nào được đóng gói tại trạm này hôm nay.
          </div>
        ) : (
          sessions.map((item) => {
            const isCompleted = item.status === 'COMPLETED';
            const isExpanded = selectedSessionId === item.id;
            const hasVideo = !!item.video;
            const sha256 = item.video?.sha256;

            return (
              <div
                key={item.id}
                className={`bg-slate-950/80 hover:bg-slate-950 border rounded-xl transition cursor-pointer ${
                  isExpanded ? 'border-blue-500/60 shadow-lg' : 'border-slate-800 hover:border-slate-700'
                }`}
                onClick={() => setSelectedSessionId(isExpanded ? null : item.id)}
              >
                {/* Main Row */}
                <div className="p-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-3 min-w-0">
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-white text-sm truncate">
                          {item.trackingCode}
                        </span>
                        <span className="bg-slate-800 text-blue-400 px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0">
                          {item.platform || 'SHOPEE'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 flex items-center space-x-2 flex-wrap">
                        <span className="text-slate-300 font-mono">{formatTime(item.createdAt)}</span>
                        {hasVideo && (
                          <>
                            <span className="text-slate-600">•</span>
                            <span>{formatDuration(item.video?.duration)}</span>
                            <span className="text-slate-600">•</span>
                            <span className="text-slate-300">{formatFileSize(item.video?.fileSize)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right side: Storage Badge & Expand Arrow */}
                  <div className="flex items-center space-x-2 shrink-0">
                    <div className="flex flex-col items-end space-y-1">
                      {hasVideo ? (
                        <>
                          <div className="flex items-center space-x-1.5">
                            <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-medium border border-slate-700">
                              <HardDrive className="w-3 h-3 text-cyan-400" />
                              <span>Đã lưu tại kho</span>
                            </span>
                            {renderCloudSyncBadge(item.video?.syncStatus)}
                          </div>
                        </>
                      ) : (
                        <span className="text-[10px] text-slate-500">Chưa có video</span>
                      )}
                    </div>

                    <div className="text-slate-500 pl-1">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Forensic Detail Drawer */}
                {isExpanded && (
                  <div
                    className="px-3 py-2.5 bg-slate-900 border-t border-slate-800 rounded-b-xl text-[11px] space-y-2 animate-fadeIn"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-semibold flex items-center space-x-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>MÃ BĂM NIÊM PHONG (SHA-256):</span>
                      </span>
                      {sha256 && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(sha256, item.id)}
                          className="flex items-center space-x-1 text-[10px] font-mono text-blue-400 hover:text-blue-300 px-2 py-0.5 rounded bg-slate-800 border border-slate-700 cursor-pointer"
                        >
                          {copiedHash === item.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400 font-bold">ĐÃ SAO CHÉP</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Sao chép hash</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {sha256 ? (
                      <div className="p-2 bg-slate-950 rounded-lg border border-slate-800/80 font-mono text-[10px] text-emerald-300 break-all select-all">
                        {sha256}
                      </div>
                    ) : (
                      <div className="text-slate-500 italic text-[10px]">
                        Chưa có mã băm SHA-256 (phiên chưa hoàn tất hoặc video chưa được tạo).
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 pt-1 text-[10px] text-slate-400 font-mono">
                      <div>
                        Mã đơn hàng: <strong className="text-slate-200">{item.orderCode || item.trackingCode}</strong>
                      </div>
                      <div>
                        Trạng thái: <strong className={isCompleted ? 'text-emerald-400' : 'text-rose-400'}>{item.status}</strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
