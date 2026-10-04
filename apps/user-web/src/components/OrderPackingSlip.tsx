import React from 'react';
import { Package, User, MapPin, CheckSquare, Square, ShoppingBag, ArrowRight, Sparkles } from 'lucide-react';

export interface OrderItem {
  sku: string;
  name: string;
  quantity: number;
  price?: number;
}

export interface CustomerInfo {
  customerName?: string;
  phone?: string;
  address?: string;
  note?: string;
  items?: OrderItem[];
}

interface OrderPackingSlipProps {
  trackingCode: string | null;
  orderCode?: string | null;
  platform?: string | null;
  customer?: CustomerInfo | null;
  checkedItems: Record<number, boolean>;
  onToggleItem: (index: number) => void;
  pendingOrders: any[];
  onSelectPendingOrder: (order: any) => void;
  onSeedOrders: () => void;
  isSeeding?: boolean;
  isRecording: boolean;
  scannedCounts?: Record<number, number>;
  onSimulateScanSku?: (sku: string) => void;
  lastScannedAlert?: { type: 'success' | 'warning' | 'error'; message: string } | null;
}

export const OrderPackingSlip: React.FC<OrderPackingSlipProps> = ({
  trackingCode,
  orderCode,
  platform,
  customer,
  checkedItems,
  onToggleItem,
  pendingOrders,
  onSelectPendingOrder,
  onSeedOrders,
  isSeeding,
  isRecording,
  scannedCounts = {},
  onSimulateScanSku,
  lastScannedAlert
}) => {
  // If we have an active order being packed
  if (trackingCode && customer) {
    const items = customer.items || [];
    const totalItems = items.reduce((acc, it) => acc + (it.quantity || 1), 0);
    const totalScanned = items.reduce((acc, _, idx) => acc + (scannedCounts[idx] || (checkedItems[idx] ? items[idx].quantity : 0)), 0);
    const checkedCount = items.filter((_, idx) => checkedItems[idx] || (scannedCounts[idx] || 0) >= items[idx].quantity).length;
    const isAllPacked = checkedCount === items.length && items.length > 0;

    return (
      <div className="bg-slate-800/95 border border-slate-700 rounded-2xl p-4 shadow-xl space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700/80 pb-2.5">
          <div className="flex items-center space-x-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
              isAllPacked ? 'bg-emerald-600/30 border-emerald-500' : 'bg-blue-600/20 border-blue-500/30'
            }`}>
              <ShoppingBag className={`w-4 h-4 ${isAllPacked ? 'text-emerald-300' : 'text-blue-400'}`} />
            </div>
            <div>
              <span className="text-xs font-black text-white uppercase tracking-wider block">
                CHI TIẾT ĐƠN HÀNG ĐANG ĐÓNG GÓI
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Mã đơn: <strong className="text-slate-200">{orderCode || trackingCode}</strong> | Sàn: <strong className="text-emerald-400">{platform || 'SHOPEE'}</strong>
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-slate-400 block">Tiến độ đếm sản phẩm:</span>
            <span className={`text-xs font-black ${isAllPacked ? 'text-emerald-400' : 'text-amber-400'}`}>
              {totalScanned} / {totalItems} cái ({checkedCount}/{items.length} món)
            </span>
          </div>
        </div>

        {/* Real-time Scan Alert Banner */}
        {lastScannedAlert ? (
          <div className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition animate-pulse ${
            lastScannedAlert.type === 'error'
              ? 'bg-rose-950/80 border-rose-600 text-rose-200'
              : lastScannedAlert.type === 'warning'
              ? 'bg-amber-950/80 border-amber-600 text-amber-200'
              : 'bg-emerald-950/80 border-emerald-600 text-emerald-200'
          }`}>
            <span>{lastScannedAlert.message}</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/40">SCAN-TO-COUNT</span>
          </div>
        ) : isAllPacked ? (
          <div className="p-2.5 rounded-xl border border-emerald-500/80 bg-emerald-950/60 text-emerald-200 text-xs font-black flex items-center justify-between">
            <span>🎉 ĐÃ ĐẾM ĐỦ 100% SẢN PHẨM! BẤM [SPACE / F4] ĐỂ HOÀN TẤT VÀ NIÊM PHONG</span>
            <span className="px-2 py-0.5 rounded bg-emerald-600 text-slate-950 text-[10px] uppercase font-black">XÁC THỰC XONG</span>
          </div>
        ) : (
          <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-700/60 text-[11px] text-slate-300 flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
              <span>Quét mã vạch sản phẩm (SKU) để hệ thống tự động đếm số lượng</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Chống đóng nhầm hàng</span>
          </div>
        )}

        {/* Customer Info row */}
        <div className="grid grid-cols-2 gap-2 text-xs bg-slate-900/80 p-2.5 rounded-xl border border-slate-700/60">
          <div className="space-y-1">
            <div className="flex items-center space-x-1.5 text-slate-300 font-semibold">
              <User className="w-3.5 h-3.5 text-blue-400" />
              <span>{customer.customerName || 'Khách hàng Shopee'} ({customer.phone || '098****'})</span>
            </div>
            {customer.address && (
              <div className="flex items-start space-x-1 text-[11px] text-slate-400">
                <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                <span className="line-clamp-1">{customer.address}</span>
              </div>
            )}
          </div>

          {customer.note && (
            <div className="bg-amber-950/40 border border-amber-800/50 p-2 rounded-lg text-[11px] text-amber-300 flex items-center">
              <span><strong>Ghi chú:</strong> {customer.note}</span>
            </div>
          )}
        </div>

        {/* Items Checklist Table with Scan-to-Count */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <span>Sản phẩm cần kiểm & đóng gói:</span>
            <span>Trạng thái đếm</span>
          </div>

          <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
            {items.map((item, idx) => {
              const currentCount = scannedCounts[idx] || 0;
              const isFull = currentCount >= item.quantity;
              const isChecked = Boolean(checkedItems[idx]) || isFull;

              return (
                <div
                  key={idx}
                  className={`p-2.5 rounded-xl border transition flex flex-col space-y-1.5 ${
                    isFull
                      ? 'bg-emerald-950/40 border-emerald-600/70 shadow-sm'
                      : currentCount > 0
                      ? 'bg-amber-950/30 border-amber-600/60'
                      : 'bg-slate-900/70 border-slate-700/80 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2.5">
                      <button
                        type="button"
                        onClick={() => onToggleItem(idx)}
                        className="cursor-pointer text-slate-400 hover:text-white transition"
                        title="Bấm để tích thủ công nếu không quét mã"
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-500 shrink-0" />
                        )}
                      </button>

                      <div>
                        <span className={`font-semibold block leading-tight ${isFull ? 'text-emerald-200' : 'text-white'}`}>
                          {item.name}
                        </span>
                        <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-mono mt-0.5">
                          <span>MÃ SKU: <strong className="text-amber-300 font-bold">{item.sku}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      {/* Interactive Count Status Badge */}
                      <span className={`text-xs font-black px-2.5 py-1 rounded-lg border font-mono ${
                        isFull
                          ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300'
                          : currentCount > 0
                          ? 'bg-amber-600/30 border-amber-500 text-amber-300 animate-pulse'
                          : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}>
                        {currentCount} / {item.quantity} {isFull ? '✓ ĐỦ' : 'CÁI'}
                      </span>

                      {/* Quick Simulate Scan Button */}
                      {onSimulateScanSku && !isFull && (
                        <button
                          type="button"
                          onClick={() => onSimulateScanSku(item.sku)}
                          className="px-2 py-1 bg-blue-600/40 hover:bg-blue-600 border border-blue-500 text-blue-200 rounded text-[10px] font-bold transition cursor-pointer"
                          title={`Bấm để giả lập quét mã SKU: ${item.sku}`}
                        >
                          +1 Quét
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Quantity Progress Bar */}
                  <div className="w-full bg-slate-950/80 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        isFull ? 'bg-emerald-500' : currentCount > 0 ? 'bg-amber-400' : 'bg-slate-700'
                      }`}
                      style={{ width: `${Math.min(100, (currentCount / item.quantity) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Otherwise, show Pending Orders Queue
  return (
    <div className="bg-slate-800/95 border border-slate-700 rounded-2xl p-4 shadow-xl space-y-3">
      {/* Queue Header */}
      <div className="flex items-center justify-between border-b border-slate-700/80 pb-2.5">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
            <Package className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h3 className="text-xs font-black text-white uppercase tracking-wider">
              ĐƠN HÀNG THỰC TẾ CHỜ ĐÓNG GÓI ({pendingOrders.length} ĐƠN)
            </h3>
            <p className="text-[10px] text-slate-400">
              Nhấp &quot;ĐÓNG ĐƠN NÀY&quot; để chọn nhanh hoặc quét mã vạch trên nhãn hàng
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onSeedOrders}
          disabled={isSeeding}
          className="px-2.5 py-1 bg-purple-900/60 hover:bg-purple-800 text-purple-300 border border-purple-700 rounded-lg text-[10px] font-bold flex items-center space-x-1 transition shadow cursor-pointer"
        >
          <Sparkles className="w-3 h-3 text-purple-400" />
          <span>{isSeeding ? 'Đang nạp...' : '+ Nạp 5 Đơn Mẫu'}</span>
        </button>
      </div>

      {/* Orders List */}
      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
        {pendingOrders.length === 0 ? (
          <div className="py-6 text-center text-slate-500 text-xs space-y-2">
            <p>Chưa có đơn hàng nào trong hàng đợi chờ đóng gói.</p>
            <button
              onClick={onSeedOrders}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition"
            >
              Bấm vào đây để tạo 5 đơn hàng mẫu thực tế
            </button>
          </div>
        ) : (
          pendingOrders.map((ord, idx) => {
            const cust = ord.customer;
            const items = cust?.items || [];
            const isNext = idx === 0;

            return (
              <div
                key={ord.id}
                className={`rounded-xl p-3 flex items-center justify-between text-xs transition ${
                  isNext
                    ? 'bg-emerald-950/30 border border-emerald-500/50 shadow-md ring-1 ring-emerald-500/20'
                    : 'bg-slate-900/80 border border-slate-700/70 hover:border-slate-500'
                }`}
              >
                <div className="space-y-1 pr-3">
                  <div className="flex items-center space-x-2">
                    {isNext && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500 text-[10px] font-black text-slate-950 uppercase tracking-wider animate-pulse">
                        ĐƠN TIẾP THEO
                      </span>
                    )}
                    <span className="font-mono font-bold text-white text-xs">{ord.trackingCode}</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-blue-300 border border-slate-700">
                      {ord.platform}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      ({cust?.customerName || 'Khách lẻ'})
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400 line-clamp-1">
                    {items.map((it: any) => `${it.name} (x${it.quantity})`).join(', ') || 'Chưa có thông tin sản phẩm'}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isRecording}
                  onClick={() => onSelectPendingOrder(ord)}
                  className={`px-3 py-1.5 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center space-x-1 shrink-0 shadow transition cursor-pointer ${
                    isNext
                      ? 'bg-emerald-600 hover:bg-emerald-500 ring-2 ring-emerald-400/30'
                      : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                  }`}
                >
                  <span>{isNext ? 'ĐÓNG ĐƠN (F2)' : 'ĐÓNG ĐƠN'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
