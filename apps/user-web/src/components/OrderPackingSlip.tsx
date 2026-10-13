import React from 'react';
import { Package, User, MapPin, CheckSquare, Square, ShoppingBag, ArrowRight, Sparkles, Barcode, Clock } from 'lucide-react';

export interface OrderItem {
  sku: string;
  name: string;
  quantity: number;
  price?: number;
  discount?: number;
  total?: number;
  variant?: string;
}

export interface CustomerInfo {
  customerName?: string;
  phone?: string;
  address?: string;
  note?: string;
  totalAmount?: number;
  codAmount?: number;
  paymentStatus?: string;
  carrier?: string;
  service?: string;
  deliveryCode?: string;
  discount?: number;
  items?: OrderItem[];
}

interface OrderPackingSlipProps {
  trackingCode: string | null;
  orderCode?: string | null;
  platform?: string | null;
  customer?: CustomerInfo | null;
  checkedItems: Record<number, boolean>;
  onToggleItem: (index: number) => void;
  onCheckAllItems?: () => void;
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
  onCheckAllItems,
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
                Mã đơn: <strong className="text-slate-200">{orderCode || trackingCode}</strong>
                {customer?.deliveryCode ? <> | Phiếu: <strong className="text-cyan-400">{customer.deliveryCode}</strong></> : null}
                {' '}| Sàn: <strong className="text-emerald-400">{platform || 'SHOPEE'}</strong>
                {customer?.carrier ? <> ({customer.carrier}{customer.service ? ` - ${customer.service}` : ''})</> : null}
              </span>
            </div>
          </div>

          <div className="text-right flex items-center space-x-2">
            <div>
              <span className="text-[10px] text-slate-400 block">Tiến độ đối chiếu:</span>
              <span className={`text-xs font-black ${isAllPacked ? 'text-emerald-400' : 'text-amber-400'}`}>
                {totalScanned} / {totalItems} cái ({checkedCount}/{items.length} món)
              </span>
            </div>
            {onCheckAllItems && !isAllPacked && (
              <button
                type="button"
                onClick={onCheckAllItems}
                title="Dành cho hàng không có mã vạch: Nhấn để xác thực nhanh bằng mắt"
                className="px-2 py-1 bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/50 rounded-lg text-[10px] font-bold transition cursor-pointer"
              >
                ⚡ Xác thực nhanh
              </button>
            )}
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
            {((customer.codAmount && customer.codAmount > 0) || (customer.totalAmount && customer.totalAmount > 0)) && (
              <div className="text-xs font-mono font-bold text-amber-300 pt-0.5 flex items-center space-x-1">
                <span>💵</span>
                <span>
                  {customer.codAmount && customer.codAmount > 0
                    ? `Tiền thu hộ COD: ${customer.codAmount.toLocaleString('vi-VN')} ₫`
                    : `Tổng tiền: ${customer.totalAmount?.toLocaleString('vi-VN')} ₫`}
                </span>
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
                        <div className="flex items-center flex-wrap gap-x-2 text-[10px] text-slate-400 font-mono mt-0.5">
                          <span>MÃ SKU: <strong className="text-amber-300 font-bold">{item.sku}</strong></span>
                          {item.variant ? <span className="text-slate-300">({item.variant})</span> : null}
                          {item.price && item.price > 0 ? (
                            <span className="text-emerald-400 font-semibold">
                              • Đơn giá: {item.price.toLocaleString('vi-VN')} ₫
                              {item.discount && item.discount > 0 ? ` (KM: -${item.discount.toLocaleString('vi-VN')} ₫)` : ''}
                              {item.quantity > 1 ? ` (T.tiền: ${(item.total || (item.price * item.quantity)).toLocaleString('vi-VN')} ₫)` : ''}
                            </span>
                          ) : null}
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
      <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
        {pendingOrders.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs space-y-2">
            <Package className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="font-semibold text-slate-400">Chưa có đơn hàng nào trong hàng đợi chờ đóng gói.</p>
            <p className="text-[11px] text-slate-500">Đơn hàng mới từ Sapo/Shopee/TikTok sẽ tự động hiển thị tại đây khi in tem.</p>
            <button
              type="button"
              onClick={onSeedOrders}
              className="mt-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow"
            >
              + Tạo 5 đơn hàng mẫu để kiểm thử
            </button>
          </div>
        ) : (
          <>
            {/* FEATURED: ĐƠN TIẾP THEO CẦN ĐÓNG (To, rõ ràng, có barcode lớn để scan dễ) */}
            {(() => {
              const nextOrd = pendingOrders[0];
              const cust = nextOrd.customer;
              const items = cust?.items || [];
              const timeStr = nextOrd.createdAt
                ? new Date(nextOrd.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
                : '';

              return (
                <div className="bg-slate-900 border-2 border-emerald-500/80 rounded-2xl p-4 shadow-[0_4px_25px_rgba(16,185,129,0.25)] space-y-3 relative overflow-hidden ring-2 ring-emerald-500/20">
                  {/* Top Bar: Badge Đơn tiếp theo + Nền tảng + Thời gian */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="px-2.5 py-1 rounded-md bg-emerald-500 text-slate-950 text-xs font-black uppercase tracking-wider flex items-center space-x-1 shadow">
                        <Sparkles className="w-3.5 h-3.5 text-slate-950 fill-current animate-pulse" />
                        <span>ĐƠN TIẾP THEO CẦN ĐÓNG</span>
                      </span>
                      <span className="px-2 py-0.5 rounded bg-blue-500/20 border border-blue-400/40 text-blue-300 font-bold text-xs">
                        {nextOrd.platform || 'SAPO'}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono">
                      {cust?.customerName && (
                        <span className="text-slate-300 font-semibold">Khách: {cust.customerName}</span>
                      )}
                      {((cust?.codAmount && cust.codAmount > 0) || (cust?.totalAmount && cust.totalAmount > 0)) && (
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-amber-300 font-mono font-bold text-xs">
                          {cust.codAmount && cust.codAmount > 0
                            ? `💵 Thu COD: ${cust.codAmount.toLocaleString('vi-VN')} ₫`
                            : `💰 Tổng: ${cust.totalAmount?.toLocaleString('vi-VN')} ₫`}
                        </span>
                      )}
                      {timeStr && (
                        <span className="flex items-center space-x-1 text-cyan-300">
                          <Clock className="w-3 h-3 text-cyan-400" />
                          <span>{timeStr}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Middle: Mã vận đơn siêu to + Barcode trực quan để scan dễ */}
                  <div className="bg-slate-950/90 border border-slate-700/80 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="space-y-1 text-center sm:text-left w-full sm:w-auto">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center space-x-1.5">
                        <Barcode className="w-4 h-4 text-amber-400" />
                        <span>MÃ VẬN ĐƠN (QUÉT SÚNG HOẶC BẤM ĐÓNG ĐƠN):</span>
                      </span>
                      <div className="font-mono text-xl sm:text-2xl font-black text-amber-300 tracking-widest select-all">
                        {nextOrd.trackingCode}
                      </div>

                      {/* Visual Barcode for easy scanning */}
                      <div className="flex items-center justify-center sm:justify-start space-x-0.5 pt-1 opacity-90">
                        {[2, 1, 3, 2, 1, 4, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 1, 2, 4, 2, 1, 3, 1, 2, 3, 1, 4, 2].map((w, i) => (
                          <span key={i} className="bg-amber-300/80 h-7 inline-block rounded-xs" style={{ width: `${w * 2}px` }} />
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isRecording}
                      onClick={() => onSelectPendingOrder(nextOrd)}
                      className="w-full sm:w-auto px-5 py-3.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white font-black text-sm rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-emerald-950/60 ring-2 ring-emerald-400/40 transition cursor-pointer shrink-0"
                    >
                      <span>[ F2 ] ĐÓNG ĐƠN NÀY</span>
                      <ArrowRight className="w-4 h-4 text-white animate-pulse" />
                    </button>
                  </div>

                  {/* Bottom: Danh sách sản phẩm chi tiết rõ ràng, không bị cụt */}
                  <div className="bg-slate-950/60 rounded-xl p-2.5 border border-slate-800 space-y-1.5">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                      SẢN PHẨM CẦN ĐÓNG GÓI:
                    </span>
                    {items.length === 0 ? (
                      <span className="text-xs text-slate-400 italic">Chưa có danh sách mặt hàng</span>
                    ) : (
                      <div className="space-y-1.5">
                        {items.map((it: any, i: number) => (
                          <div key={i} className="flex items-start justify-between text-xs bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 gap-3">
                            <div className="space-y-1 flex-1 min-w-0">
                              <div className="flex items-center space-x-2">
                                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold text-xs border border-amber-500/40 shrink-0">
                                  SKU: {it.sku || 'CHƯA CÓ'}
                                </span>
                              </div>
                              <div className="text-slate-100 font-medium text-xs leading-relaxed break-words">
                                {it.name}
                              </div>
                              {it.price && it.price > 0 ? (
                                <div className="text-[11px] font-mono text-emerald-400 font-medium">
                                  <span>Đơn giá: <strong>{it.price.toLocaleString('vi-VN')} ₫</strong></span>
                                  {it.quantity > 1 ? (
                                    <span className="text-slate-400 ml-2">• Thành tiền: <strong className="text-emerald-300">{(it.price * it.quantity).toLocaleString('vi-VN')} ₫</strong></span>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                            <span className="px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 font-mono font-black text-xs shrink-0 border border-emerald-500/40 whitespace-nowrap self-center">
                              x{it.quantity} cái
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* CÁC ĐƠN TIẾP THEO TRONG HÀNG ĐỢI (Nếu có từ 2 đơn trở lên) */}
            {pendingOrders.length > 1 && (
              <div className="space-y-2 pt-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block pl-1">
                  CÁC ĐƠN TIẾP THEO TRONG HÀNG ĐỢI ({pendingOrders.length - 1} đơn):
                </span>
                {pendingOrders.slice(1).map((ord, idx) => {
                  const cust = ord.customer;
                  const items = cust?.items || [];
                  const timeStr = ord.createdAt
                    ? new Date(ord.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
                    : '';

                  return (
                    <div
                      key={ord.id}
                      className="bg-slate-900/80 border border-slate-700/70 hover:border-slate-500 rounded-xl p-3 flex items-center justify-between text-xs transition"
                    >
                      <div className="space-y-1 pr-3">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono font-bold text-slate-400">
                            #{idx + 2}
                          </span>
                          <span className="font-mono font-bold text-white text-xs">{ord.trackingCode}</span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-blue-300 border border-slate-700">
                            {ord.platform}
                          </span>
                          {cust?.customerName && (
                            <span className="text-[11px] text-slate-400">
                              ({cust.customerName})
                            </span>
                          )}
                          {((cust?.codAmount && cust.codAmount > 0) || (cust?.totalAmount && cust.totalAmount > 0)) && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 text-amber-300 font-mono text-[10px] font-bold">
                              COD: {(cust.codAmount || cust.totalAmount).toLocaleString('vi-VN')} ₫
                            </span>
                          )}
                          {timeStr && (
                            <span className="text-[10px] text-cyan-300/80 font-mono">
                              • {timeStr}
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-400 line-clamp-1">
                          {items.map((it: any) => `${it.name}${it.price ? ` (${it.price.toLocaleString('vi-VN')}₫)` : ''} (x${it.quantity})`).join(', ') || 'Chưa có thông tin sản phẩm'}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isRecording}
                        onClick={() => onSelectPendingOrder(ord)}
                        className="px-3 py-1.5 disabled:opacity-50 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold rounded-lg text-xs flex items-center space-x-1 shrink-0 shadow transition cursor-pointer"
                      >
                        <span>ĐÓNG ĐƠN</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
