import React, { useState, useRef } from 'react';
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, X, Plus } from 'lucide-react';
import { adminApi } from '../services/api';

interface ImportOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ImportOrdersModal: React.FC<ImportOrdersModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [parsedOrders, setParsedOrders] = useState<any[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Simple, robust CSV line parser supporting quoted fields with commas
  const parseCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if (c === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.trim());
    return result.map((s) => s.replace(/^"|"$/g, '').trim());
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParseError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = (evt.target?.result as string) || '';
        // Remove UTF-8 BOM if present
        const cleanText = text.replace(/^\uFEFF/, '');
        const lines = cleanText.split(/\r?\n/).filter((l) => l.trim().length > 0);

        if (lines.length < 2) {
          throw new Error('File không có dữ liệu hoặc thiếu dòng tiêu đề');
        }

        // Header mapping
        const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
        const trackingIdx = headers.findIndex((h) => h.includes('vandon') || h.includes('tracking'));
        const orderIdx = headers.findIndex((h) => h.includes('madon') || h.includes('order'));
        const platformIdx = headers.findIndex((h) => h.includes('san') || h.includes('platform'));
        const nameIdx = headers.findIndex((h) => h.includes('tenkhach') || h.includes('customer'));
        const phoneIdx = headers.findIndex((h) => h.includes('sdt') || h.includes('phone') || h.includes('dienthoai'));
        const addrIdx = headers.findIndex((h) => h.includes('diachi') || h.includes('address'));
        const skuIdx = headers.findIndex((h) => h.includes('sku'));
        const prodNameIdx = headers.findIndex((h) => h.includes('tensanpham') || h.includes('product') || h.includes('name'));
        const qtyIdx = headers.findIndex((h) => h.includes('soluong') || h.includes('quantity') || h.includes('qty'));
        const priceIdx = headers.findIndex((h) => h.includes('giatien') || h.includes('price') || h.includes('gia'));
        const noteIdx = headers.findIndex((h) => h.includes('ghichu') || h.includes('note'));

        if (trackingIdx === -1) {
          throw new Error('Không tìm thấy cột "Mã Vận Đơn" (MaVanDon) trong file');
        }

        // Group rows by Tracking Code
        const ordersMap = new Map<string, any>();

        for (let i = 1; i < lines.length; i++) {
          const row = parseCsvLine(lines[i]);
          const tracking = (row[trackingIdx] || '').trim().toUpperCase();
          if (!tracking) continue;

          const orderCode = orderIdx !== -1 && row[orderIdx] ? row[orderIdx].trim() : tracking;
          const platform = platformIdx !== -1 && row[platformIdx] ? row[platformIdx].trim().toUpperCase() : 'OTHER';
          const customerName = nameIdx !== -1 && row[nameIdx] ? row[nameIdx].trim() : 'Khách lẻ';
          const phone = phoneIdx !== -1 && row[phoneIdx] ? row[phoneIdx].trim() : '';
          const address = addrIdx !== -1 && row[addrIdx] ? row[addrIdx].trim() : '';
          const note = noteIdx !== -1 && row[noteIdx] ? row[noteIdx].trim() : '';

          const sku = skuIdx !== -1 && row[skuIdx] ? row[skuIdx].trim().toUpperCase() : '';
          const prodName = prodNameIdx !== -1 && row[prodNameIdx] ? row[prodNameIdx].trim() : (sku || 'Sản phẩm');
          const qty = qtyIdx !== -1 && row[qtyIdx] ? parseInt(row[qtyIdx], 10) || 1 : 1;
          const price = priceIdx !== -1 && row[priceIdx] ? parseInt(row[priceIdx].replace(/\D/g, ''), 10) || 0 : 0;

          if (!ordersMap.has(tracking)) {
            ordersMap.set(tracking, {
              orderCode,
              trackingCode: tracking,
              platform,
              customerName,
              phone,
              address,
              note,
              items: []
            });
          }

          if (sku || prodName) {
            ordersMap.get(tracking).items.push({
              sku: sku || 'SKU_GEN',
              name: prodName,
              quantity: qty,
              price
            });
          }
        }

        const ordersList = Array.from(ordersMap.values());
        if (ordersList.length === 0) {
          throw new Error('Không có dòng đơn hàng hợp lệ nào được tìm thấy');
        }

        setParsedOrders(ordersList);
      } catch (err: any) {
        setParseError(err.message || 'Lỗi đọc file CSV');
        setParsedOrders([]);
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleConfirmImport = async () => {
    if (parsedOrders.length === 0) return;
    setIsSubmitting(true);
    try {
      const res = await adminApi.importOrders(parsedOrders);
      alert(`Thành công: ${res.message}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(`Lỗi nhập đơn: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-4xl w-full p-6 shadow-2xl flex flex-col max-h-[90vh] space-y-5 animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">NHẬP DANH SÁCH ĐƠN HÀNG TỪ EXCEL / CSV</h3>
              <p className="text-xs text-slate-400">Tải lên danh sách đơn hàng Shopee, TikTok, Lazada để nhân viên đóng gói</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Bar: Download template + File Picker */}
        <div className="flex items-center justify-between bg-slate-800/80 p-4 rounded-2xl border border-slate-700">
          <div className="flex items-center space-x-3">
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center space-x-2 transition shadow-lg cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>{fileName ? `Đổi file (${fileName})` : 'Chọn file CSV / Excel'}</span>
            </button>

            {fileName && (
              <span className="text-xs text-emerald-400 font-semibold flex items-center space-x-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>Đã đọc {parsedOrders.length} đơn hàng</span>
              </span>
            )}
          </div>

          <a
            href={adminApi.getTemplateUrl()}
            download="Mau_Nhap_Don_Hang_Dong_Goi.csv"
            className="px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-semibold flex items-center space-x-1.5 border border-slate-600 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>TẢI FILE MẪU CSV (.CSV UTF-8)</span>
          </a>
        </div>

        {/* Error notification */}
        {parseError && (
          <div className="bg-rose-950/60 border border-rose-800 text-rose-200 px-4 py-3 rounded-xl text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{parseError}</span>
          </div>
        )}

        {/* Preview Table */}
        <div className="flex-1 overflow-y-auto min-h-[220px] max-h-[360px] border border-slate-800 rounded-2xl bg-slate-950/50">
          {parsedOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-500 space-y-2">
              <Upload className="w-8 h-8 opacity-40" />
              <p className="text-xs">Vui lòng tải file mẫu về, điền thông tin và bấm chọn file để xem trước</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900 sticky top-0 border-b border-slate-800 text-[10px] uppercase font-bold text-slate-400">
                <tr>
                  <th className="py-2.5 px-3">Mã Vận Đơn</th>
                  <th className="py-2.5 px-3">Mã Đơn</th>
                  <th className="py-2.5 px-3">Sàn</th>
                  <th className="py-2.5 px-3">Khách Hàng</th>
                  <th className="py-2.5 px-3">Sản Phẩm Cần Đóng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {parsedOrders.map((ord, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40">
                    <td className="py-2 px-3 font-mono font-bold text-amber-300">{ord.trackingCode}</td>
                    <td className="py-2 px-3 font-mono text-slate-400">{ord.orderCode}</td>
                    <td className="py-2 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-blue-300">
                        {ord.platform}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <div className="font-semibold text-slate-200">{ord.customerName}</div>
                      <div className="text-[10px] text-slate-400">{ord.phone}</div>
                    </td>
                    <td className="py-2 px-3">
                      <div className="space-y-0.5">
                        {ord.items.map((it: any, i: number) => (
                          <div key={i} className="text-[11px] text-slate-300 flex items-center justify-between">
                            <span className="truncate max-w-[200px]">• {it.name}</span>
                            <span className="font-bold text-emerald-400 ml-2">x{it.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-4">
          <span className="text-xs text-slate-400">
            {parsedOrders.length > 0 && `Sẵn sàng nhập ${parsedOrders.length} đơn hàng vào danh sách chờ đóng gói`}
          </span>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
            >
              HỦY BỎ
            </button>
            <button
              type="button"
              disabled={parsedOrders.length === 0 || isSubmitting}
              onClick={handleConfirmImport}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold rounded-xl text-xs flex items-center space-x-2 transition shadow-lg shadow-emerald-900/40 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isSubmitting ? 'ĐANG NHẬP...' : `XÁC NHẬN NHẬP (${parsedOrders.length} ĐƠN)`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
