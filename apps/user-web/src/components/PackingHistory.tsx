import { CheckCircle2, Clock, HardDrive, ShieldCheck, XCircle } from 'lucide-react';

interface SessionItem {
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
    duration: number;
    fileSize: number;
    sha256: string;
    syncStatus: string;
  } | null;
}

interface PackingHistoryProps {
  sessions: SessionItem[];
  isLoading: boolean;
}

export const PackingHistory: React.FC<PackingHistoryProps> = ({ sessions, isLoading }) => {
  const formatTime = (isoString?: string | null) => {
    if (!isoString) return '--:--:--';
    return new Date(isoString).toLocaleTimeString('vi-VN');
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '0 MB';
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 shadow-xl flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 border-b border-slate-700 px-2">
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-bold text-slate-200">
            LỊCH SỬ ĐÓNG GÓI HÔM NAY ({sessions.length})
          </h3>
        </div>
        <span className="text-xs text-slate-400 font-mono">Tự động lưu & Niêm phong</span>
      </div>

      <div className="flex-1 overflow-y-auto mt-2 space-y-2 pr-1 max-h-[220px]">
        {isLoading && sessions.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500">Đang tải lịch sử...</div>
        ) : sessions.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500">
            Chưa có đơn hàng nào được đóng gói tại trạm này hôm nay.
          </div>
        ) : (
          sessions.map((item) => {
            const isCompleted = item.status === 'COMPLETED';
            return (
              <div
                key={item.id}
                className="bg-slate-900/70 hover:bg-slate-900 border border-slate-700/60 rounded-xl p-2.5 flex items-center justify-between text-xs transition"
              >
                <div className="flex items-center space-x-3">
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
                  )}
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-white text-sm">
                        {item.trackingCode}
                      </span>
                      <span className="bg-slate-800 text-blue-400 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                        {item.platform}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 flex items-center space-x-2">
                      <span>{formatTime(item.createdAt)}</span>
                      {item.video && (
                        <>
                          <span>•</span>
                          <span>{item.video.duration}s</span>
                          <span>•</span>
                          <span>{formatFileSize(item.video.fileSize)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right side: Hash & Sync Pill */}
                <div className="flex flex-col items-end space-y-1">
                  {item.video?.sha256 ? (
                    <div className="flex items-center space-x-1 bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-mono">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      <span>{item.video.sha256.slice(0, 8)}...</span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-500">Chưa có hash</span>
                  )}

                  <div className="flex items-center space-x-1 text-[10px] text-slate-400">
                    {item.video?.syncStatus === 'SYNCED' ? (
                      <span className="text-emerald-400 flex items-center space-x-0.5">
                        <HardDrive className="w-3 h-3" />
                        <span>NAS OK</span>
                      </span>
                    ) : (
                      <span className="text-amber-400 flex items-center space-x-0.5">
                        <Clock className="w-3 h-3" />
                        <span>Chờ sync</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
