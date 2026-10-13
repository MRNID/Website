import React, { useEffect, useState, useCallback } from 'react';
import {
  PackageCheck,
  AlertCircle,
  Server,
  RefreshCw,
  ShieldCheck,
  Timer,
  TrendingUp,
  Award,
  BarChart3,
  Clock,
  ShoppingBag,
  Flame,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { adminApi, LogisticsDashboardData } from '../services/api';

export const DashboardPage: React.FC<{ onNavigateToVideos: () => void }> = ({ onNavigateToVideos }) => {
  const [data, setData] = useState<LogisticsDashboardData | null>(null);
  const [stations, setStations] = useState<any[]>([]);
  const [timeRange, setTimeRange] = useState<'today' | '7days' | '30days'>('today');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [dashData, stList] = await Promise.all([
        adminApi.getLogisticsDashboardStats(timeRange),
        adminApi.getStations()
      ]);
      setData(dashData);
      setStations(stList);
    } catch (err) {
      console.error('Failed to load logistics dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Find max hourly count for relative chart scaling
  const maxHourlyCount = Math.max(
    ...(data?.hourlyThroughput.map(h => h.orderCount) || [1]),
    5
  );

  const avgDur = data?.summary.avgDurationSeconds || 0;
  const fulfillmentRate = data?.summary.fulfillmentRate || 0;

  return (
    <div className="space-y-6">
      {/* Top Banner / Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-5 rounded-3xl shadow-xl">
        <div>
          <div className="flex items-center space-x-2.5">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <h2 className="text-2xl font-black text-white tracking-wide uppercase">
              HỆ QUẢN TRỊ & HIỆU SUẤT LOGISTICS
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Đo lường thời gian thao tác từng giây, giám sát năng suất ca làm việc và giải quyết đối soát sàn TMĐT
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Time range selector */}
          <div className="flex bg-slate-800/80 p-1 rounded-2xl border border-slate-700">
            <button
              type="button"
              onClick={() => setTimeRange('today')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                timeRange === 'today'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Hôm nay
            </button>
            <button
              type="button"
              onClick={() => setTimeRange('7days')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                timeRange === '7days'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              7 ngày qua
            </button>
            <button
              type="button"
              onClick={() => setTimeRange('30days')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                timeRange === '30days'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              30 ngày qua
            </button>
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>CẬP NHẬT</span>
          </button>
        </div>
      </div>

      {/* 4 Core Logistics KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* KPI 1: Average Packing Duration */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-3xl p-5 shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              THỜI GIAN ĐÓNG GÓI TB
            </span>
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
              <Timer className="w-5 h-5 text-amber-400" />
            </div>
          </div>

          <div className="mt-2">
            <div className="flex items-baseline space-x-2">
              <span className="text-4xl font-black text-white font-mono">
                {avgDur > 0 ? `${avgDur}s` : '--'}
              </span>
              <span className="text-xs text-slate-400 font-medium">/ đơn</span>
            </div>

            <div className="mt-3 flex items-center space-x-1.5 text-[11px]">
              {avgDur > 0 && avgDur <= 40 ? (
                <span className="text-emerald-400 font-bold bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 rounded-lg flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Tốc độ tối ưu (&lt;40s)</span>
                </span>
              ) : avgDur > 40 && avgDur <= 60 ? (
                <span className="text-amber-400 font-bold bg-amber-950/80 border border-amber-800/80 px-2 py-0.5 rounded-lg flex items-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>Tốc độ tiêu chuẩn</span>
                </span>
              ) : avgDur > 60 ? (
                <span className="text-rose-400 font-bold bg-rose-950/80 border border-rose-800/80 px-2 py-0.5 rounded-lg flex items-center space-x-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Cần tối ưu quy trình</span>
                </span>
              ) : (
                <span className="text-slate-400">Chưa có phiên đóng</span>
              )}
            </div>

            <div className="mt-2 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[10px] text-slate-400">
              <span>Nhanh nhất: <strong className="text-slate-200 font-mono">{data?.summary.minDurationSeconds || 0}s</strong></span>
              <span>Lâu nhất: <strong className="text-slate-200 font-mono">{data?.summary.maxDurationSeconds || 0}s</strong></span>
            </div>
          </div>
        </div>

        {/* KPI 2: Total Packed & Fulfillment */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-3xl p-5 shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              ĐÃ ĐÓNG GÓI / TỔNG ĐƠN
            </span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <PackageCheck className="w-5 h-5 text-emerald-400" />
            </div>
          </div>

          <div className="mt-2">
            <div className="flex items-baseline space-x-2">
              <span className="text-4xl font-black text-white font-mono">
                {data?.summary.completedOrders || 0}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                / {data?.summary.totalOrders || 0} đơn
              </span>
            </div>

            {/* Progress bar */}
            <div className="mt-3">
              <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden flex">
                <div
                  className="bg-emerald-500 h-2 transition-all duration-500"
                  style={{ width: `${fulfillmentRate}%` }}
                />
                <div
                  className="bg-rose-500 h-2 transition-all duration-500"
                  style={{ width: `${data?.summary.totalOrders ? ((data.summary.recordingOrders / data.summary.totalOrders) * 100) : 0}%` }}
                />
              </div>
            </div>

            <div className="mt-2 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[10px]">
              <span className="text-emerald-400 font-medium">
                Hoàn tất: <strong>{fulfillmentRate}%</strong>
              </span>
              <span className="text-amber-400 font-medium">
                Chờ đóng: <strong>{data?.summary.pendingOrders || 0}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* KPI 3: Packing Velocity / Active Stations */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-3xl p-5 shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              NĂNG SUẤT VẬN HÀNH CA
            </span>
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-400" />
            </div>
          </div>

          <div className="mt-2">
            <div className="flex items-baseline space-x-2">
              <span className="text-4xl font-black text-white font-mono">
                {data?.summary.totalPackingMinutes || 0}
              </span>
              <span className="text-xs text-slate-400 font-medium">phút thao tác</span>
            </div>

            <div className="mt-3 flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded-lg bg-blue-950/80 border border-blue-800/80 text-blue-300 font-bold text-[11px] flex items-center space-x-1">
                <Flame className="w-3 h-3 text-orange-400" />
                <span>
                  ~{data?.summary.totalPackingMinutes && data.summary.completedOrders
                    ? Math.round((data.summary.completedOrders / (data.summary.totalPackingMinutes / 60)) * 10) / 10
                    : (data?.summary.completedOrders || 0)} đơn/giờ
                </span>
              </span>
            </div>

            <div className="mt-2 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[10px] text-slate-400">
              <span>Trạm trực tuyến:</span>
              <span className="text-emerald-400 font-mono font-bold">
                {stations.filter(s => s.status === 'ONLINE').length}/{stations.length} bàn đóng
              </span>
            </div>
          </div>
        </div>

        {/* KPI 4: Disputes & Video Integrity */}
        <div
          onClick={onNavigateToVideos}
          className="bg-slate-800/90 hover:bg-slate-750 border border-slate-700/80 rounded-3xl p-5 shadow-lg relative overflow-hidden flex flex-col justify-between cursor-pointer transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              KHIẾU NẠI & ĐỐI SOÁT
            </span>
            <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-purple-400" />
            </div>
          </div>

          <div className="mt-2">
            <div className="flex items-baseline space-x-2">
              <span className="text-4xl font-black text-amber-300 font-mono">
                {data?.summary.disputedOrders || 0}
              </span>
              <span className="text-xs text-slate-400 font-medium">đơn cần bảo vệ</span>
            </div>

            <div className="mt-3 flex items-center space-x-1 text-[11px] text-emerald-400 font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>100% Niêm phong SHA-256</span>
            </div>

            <div className="mt-2 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[10px] text-purple-300">
              <span>Bấm xem danh sách đối soát</span>
              <span>→</span>
            </div>
          </div>
        </div>
      </div>

      {/* Hourly Packing Velocity Chart */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-700/70 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              <span>NĂNG SUẤT ĐÓNG GÓI THEO KHUNG GIỜ (THROUGHPUT BY HOUR)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Số lượng đơn hàng hoàn thành và thời gian trung bình theo từng giờ trong ngày làm việc
            </p>
          </div>

          <div className="flex items-center space-x-4 text-xs">
            <div className="flex items-center space-x-1.5 text-slate-400">
              <span className="w-3 h-3 rounded bg-blue-500"></span>
              <span>Sản lượng đơn (đơn)</span>
            </div>
          </div>
        </div>

        {/* Visual Bar Graph */}
        <div className="pt-4">
          <div className="flex items-end justify-between gap-1.5 h-48 border-b border-slate-700/80 pb-2 px-1">
            {data?.hourlyThroughput.map((item) => {
              const heightPercent = item.orderCount > 0
                ? Math.max(18, Math.round((item.orderCount / maxHourlyCount) * 100))
                : 6;

              return (
                <div key={item.hour} className="flex-1 flex flex-col items-center h-full justify-end group relative min-w-0">
                  {/* Tooltip on hover */}
                  <div className="opacity-0 group-hover:opacity-100 transition absolute -top-12 z-20 bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1 text-[11px] text-white shadow-2xl pointer-events-none whitespace-nowrap">
                    <div><strong>{item.hourLabel}</strong>: {item.orderCount} đơn</div>
                    {item.avgDuration > 0 && <div className="text-amber-300">TB: {item.avgDuration}s/đơn</div>}
                  </div>

                  {/* Value on top of bar if > 0 */}
                  {item.orderCount > 0 && (
                    <span className="text-[11px] font-mono font-bold text-blue-300 mb-1">
                      {item.orderCount}
                    </span>
                  )}

                  {/* Bar */}
                  <div
                    className={`w-full max-w-[42px] rounded-t-xl transition-all duration-300 ${
                      item.orderCount > 0
                        ? 'bg-gradient-to-t from-blue-600 via-cyan-500 to-emerald-400 shadow-md shadow-blue-500/30'
                        : 'bg-slate-700/30 hover:bg-slate-700/50'
                    }`}
                    style={{ height: `${heightPercent}%` }}
                  />

                  {/* Hour label */}
                  <span className={`text-[10px] font-mono mt-2 ${item.orderCount > 0 ? 'text-white font-bold' : 'text-slate-500'}`}>
                    {item.hourLabel.replace(':00', 'h')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom 2-Column Section: Leaderboard + Platform & Stations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Column Left: Operator Leaderboard */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-700/70 pb-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Award className="w-5 h-5 text-amber-400" />
                <span>BẢNG XẾP HẠNG NHÂN VIÊN KHO (OPERATOR LEADERBOARD)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Đánh giá sản lượng, tốc độ đóng gói và độ chính xác của từng nhân sự
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {!data?.operatorLeaderboard || data.operatorLeaderboard.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                Chưa có dữ liệu đóng gói của nhân viên trong khoảng thời gian này.
              </div>
            ) : (
              data.operatorLeaderboard.map((op, idx) => (
                <div
                  key={op.userId}
                  className="bg-slate-900/80 border border-slate-700/60 rounded-2xl p-4 flex items-center justify-between hover:border-slate-600 transition"
                >
                  <div className="flex items-center space-x-3.5">
                    {/* Rank Badge */}
                    <div className="w-9 h-9 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0">
                      {idx === 0 ? (
                        <span className="w-9 h-9 rounded-2xl bg-amber-500/20 border border-amber-400/50 text-amber-300 flex items-center justify-center text-base">
                          🥇
                        </span>
                      ) : idx === 1 ? (
                        <span className="w-9 h-9 rounded-2xl bg-slate-400/20 border border-slate-300/50 text-slate-200 flex items-center justify-center text-base">
                          🥈
                        </span>
                      ) : idx === 2 ? (
                        <span className="w-9 h-9 rounded-2xl bg-amber-700/20 border border-amber-600/50 text-amber-500 flex items-center justify-center text-base">
                          🥉
                        </span>
                      ) : (
                        <span className="w-9 h-9 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center font-mono">
                          #{idx + 1}
                        </span>
                      )}
                    </div>

                    <div>
                      <div className="font-bold text-sm text-white flex items-center space-x-2">
                        <span>{op.operatorName}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center space-x-3 mt-0.5">
                        <span>Tốc độ TB: <strong className="text-amber-400 font-mono">{op.avgDuration}s/đơn</strong></span>
                        <span>Độ chính xác: <strong className="text-emerald-400 font-mono">{op.accuracyRate}%</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-lg font-black text-white font-mono block">
                      {op.packedCount}
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">
                      đơn đã đóng
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column Right: Platforms & Stations */}
        <div className="space-y-6">
          {/* Platform Distribution */}
          <div className="bg-slate-800/90 border border-slate-700/80 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700/70 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <ShoppingBag className="w-5 h-5 text-purple-400" />
                  <span>PHÂN BỔ THEO SÀN TMĐT & ĐƠN VỊ VẬN CHUYỂN</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tỷ trọng đơn hàng theo từng kênh bán để điều phối ưu tiên giờ giao tài xế
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {!data?.platformBreakdown || data.platformBreakdown.length === 0 ? (
                <div className="py-6 text-center text-slate-500 text-xs">
                  Chưa có đơn hàng nào được phân loại sàn.
                </div>
              ) : (
                data.platformBreakdown.map((plat) => (
                  <div key={plat.platform} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-200">{plat.platform}</span>
                      <span className="text-slate-400 font-mono">
                        <strong className="text-white">{plat.packedCount}</strong> / {plat.totalCount} đơn ({plat.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden flex">
                      <div
                        className="bg-purple-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${plat.percentage}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Stations LAN Telemetry */}
          <div className="bg-slate-800/90 border border-slate-700/80 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700/70 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <Server className="w-5 h-5 text-emerald-400" />
                  <span>TÌNH TRẠNG CÁC TRẠM ĐÓNG GÓI (STATIONS)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Giám sát các bàn làm việc, camera Dahua RTSP và worker daemon
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {stations.map((st) => (
                <div
                  key={st.id}
                  className="bg-slate-900/80 border border-slate-700/60 rounded-2xl p-4 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${st.status === 'ONLINE' ? 'bg-emerald-400 shadow-md shadow-emerald-400/50' : 'bg-rose-500'}`} />
                    <div>
                      <div className="font-bold text-white text-sm">
                        {st.code} <span className="text-xs font-normal text-slate-400">({st.name})</span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        IP: {st.ipAddress || '192.168.0.15'} • Camera: {st.camera?.name || 'CAM_PACK01'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-1 rounded-xl bg-slate-800 text-[11px] font-semibold text-emerald-400 border border-emerald-900/40 flex items-center space-x-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>BẢO MẬT SHA-256</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
