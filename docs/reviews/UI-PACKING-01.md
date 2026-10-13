# Gói Bàn Giao Đánh Giá Giao Diện: UI-PACKING-01

> **Mục tiêu:** Cải tiến toàn diện giao diện bàn đóng gói (Desktop User Web trên cổng 3000) nhằm tối ưu công thái học, trực quan hóa trạng thái camera/phiên quay, chống đóng nhầm đơn hàng, giữ vững phong cách nền tối (Dark Theme) và không làm ảnh hưởng đến logic backend/mobile.

---

## 1. Danh sách file thay đổi

| STT | Đường dẫn file | Mục đích thay đổi |
|:---:|:---|:---|
| 1 | `apps/user-web/src/components/Header.tsx` | Thu gọn chiều cao header (`h-12`), hiển thị đầy đủ Trạm, Nhân viên, Trạng thái Worker/WS/Camera, đồng hồ timecode thực tế, dọn dẹp các liên kết phân quyền nhầm sang Admin Portal. |
| 2 | `apps/user-web/src/components/StatusBanner.tsx` | Tối ưu banner trạng thái dạng compact (`h-12`/`h-13`), phân biệt rõ các trạng thái `SẴN SÀNG`, `ĐANG QUAY`, `XỬ LÝ/LƯU TRỮ`, `HOÀN TẤT`, `SỰ CỐ/TIMEOUT`; hiển thị badge nơi lưu `Local OK` và `Google Drive: Đã lưu / Chờ đồng bộ`. |
| 3 | `apps/user-web/src/components/CameraViewport.tsx` | Nhận diện trạng thái luồng hình ảnh trung thực (`isStreamLoaded` & `streamError`), loại bỏ nhãn `LIVE` giả khi chưa có hình; thay thông số giả `1080p @ 30FPS` bằng `Độ phân giải: Chưa xác định • fMP4`; bổ sung viền đỏ phát sáng, badge `REC`, mã đơn nổi bật khi đang quay. |
| 4 | `apps/user-web/src/components/ActionControls.tsx` | Tái cấu trúc khu vực thao tác: Ô nhập mã vận đơn nằm riêng một dòng với nhãn `MÃ VẬN ĐƠN`; nút chính biến đổi nổi bật theo trạng thái phiên (`[F2] Bắt đầu` → `[F4/Space] Hoàn tất` + `[ESC] Hủy` → `Đang lưu...`); hiển thị lý do disable khi chưa hợp lệ; ẩn phím Mở khóa trạm `[F8]` vào ngăn xử lý sự cố dành riêng cho Quản lý. |
| 5 | `apps/user-web/src/components/OrderPackingSlip.tsx` | Tích hợp thời gian tạo đơn chuẩn `vi-VN` (giờ:phút:giây) vào danh sách đơn chờ đóng; tinh chỉnh khung checklist sản phẩm để cuộn mượt mà bên trong cột thao tác. |
| 6 | `apps/user-web/src/components/PackingHistory.tsx` | Định dạng thời gian `vi-VN`, xử lý dung lượng file trung thực (`Chưa xác định` thay vì `0.0 MB`), chuyển đổi nhãn lưu trữ sang `Local OK` và `Google Drive: Đã lưu / Đang đồng bộ / Chờ đồng bộ / Lỗi sync` (loại bỏ nhãn `NAS OK`); cho phép bấm vào từng đơn để mở ngăn chi tiết xem và sao chép mã băm SHA-256 niêm phong. |
| 7 | `apps/user-web/src/App.tsx` | Tái cấu trúc bố cục thành 2 cột chuẩn: Cột trái (~60% width) gồm Camera + Lịch sử đóng gói; Cột phải (~40% width) theo thứ tự Mã vận đơn → Checklist sản phẩm → Nút bấm chính ghim đáy (Pinned). Tối ưu hóa kích thước hiển thị hoàn hảo ở cả độ phân giải 1366×768 và 1920×1080. |

---

## 2. Mô tả chi tiết giao diện Trước & Sau (Before vs After)

### 2.1. Bố cục tổng thể (Layout & Viewport Space)
- **Trước đây:**
  - Banner và Header chiếm nhiều diện tích dọc (>160px), đẩy nội dung thao tác trôi xuống dưới nếp gấp màn hình (fold).
  - Cột trái chứa Camera và Checklist; cột phải chứa Ô nhập + Nút bấm + Lịch sử. Nhân viên phải liếc mắt qua lại giữa 2 cột để vừa kiểm tra mã vừa bấm nút.
  - Khi danh sách sản phẩm dài hoặc màn hình 1366×768, trang xuất hiện thanh cuộn ngoài cùng (root scrollbar), che khuất các nút bấm chính.
- **Sau cải tiến:**
  - Header thu gọn còn `h-12` (48px) và StatusBanner `h-12` (48px). Toàn bộ chiều cao trang vừa khít `h-screen`, `overflow-hidden` tuyệt đối.
  - Bố cục 2 cột công thái học:
    - **Cột trái (khoảng 60% chiều rộng):** Chuyên trách hình ảnh & pháp lý, gồm Khung Camera Viewport lớn ở trên và Lịch sử đóng gói gần đây ở dưới.
    - **Cột phải (khoảng 40% chiều rộng):** Đi theo đúng quy trình thao tác đóng hàng: **Mã vận đơn (trên cùng) → Checklist sản phẩm (ở giữa, cuộn nội bộ) → Nút hành động chính (ghim chặt đáy, không bao giờ bị che khuất)**.
  - Nhân viên chỉ cần tập trung mắt vào cột phải để quét mã, kiểm đếm sản phẩm và bấm hoàn tất.

### 2.2. Nhận diện trạng thái Camera & Luồng video
- **Trước đây:**
  - Luôn hiện chữ `LIVE` màu xanh lá và thông số `1080p @ 30FPS` ngay cả khi camera chưa kết nối hoặc đang bị lỗi hình ảnh.
- **Sau cải tiến:**
  - Tách bạch 4 trạng thái luồng video trung thực:
    1. **Đang kết nối:** Biểu tượng spinner màu vàng hổ phách `ĐANG KẾT NỐI CAMERA TRẠM...`.
    2. **Chưa có hình:** Biểu tượng cảnh báo màu đỏ hồng `CHƯA CÓ HÌNH (CAMERA CHƯA SẴN SÀNG)`.
    3. **Sẵn sàng:** Chấm xanh tròn `SẴN SÀNG` (chỉ bật khi luồng MJPEG đã tải frame thành công).
    4. **Đang ghi hình:** Khung viền camera phát sáng đỏ `border-2 border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.35)]`, huy hiệu `REC` nhấp nháy cùng đồng hồ đếm giây, mã vận đơn hiển thị cỡ lớn màu vàng nổi bật.
  - Bỏ hoàn toàn thông số giả: hiển thị trung thực `Độ phân giải: Chưa xác định • fMP4`.

### 2.3. Khu vực thao tác & Phím tắt (Action Controls)
- **Trước đây:**
  - Ô mã vận đơn bị nhét chung dòng, nhãn bị ép chật hẹp.
  - Nút `Mở khóa trạm [F8]` đặt ngang hàng với các nút đóng gói khiến nhân viên dễ bấm nhầm khi đang thao tác.
  - Nút Bắt đầu khi bị disable không giải thích rõ tại sao không bấm được.
- **Sau cải tiến:**
  - Ô mã vận đơn đặt riêng một hàng độc lập với nhãn `MÃ VẬN ĐƠN` in hoa rõ ràng.
  - Nút hành động biến đổi nổi bật theo ngữ cảnh:
    - `IDLE`: Nút lớn xanh dương `[ F2 ] BẮT ĐẦU ĐÓNG GÓI`. Khi disable, có dòng thông báo lý do trực quan bên dưới (vd: *Chưa quét hoặc nhập mã vận đơn*, hoặc *Mất kết nối Video Worker — chưa thể quay*).
    - `RECORDING`: Nút xanh ngọc cực lớn `[ F4 / SPACE ] HOÀN TẤT ĐÓNG GÓI` chiếm ưu thế kèm nút đỏ `[ ESC ] HỦY`.
    - `PROCESSING`: Nút hiệu ứng chờ `ĐANG LƯU & NIÊM PHONG VIDEO...` kèm vòng xoay tải dữ liệu.
  - Phím `[F8] Mở khóa trạm` được chuyển xuống ngăn kéo "Xử lý sự cố (Quản lý)", chỉ hiển thị khi tài khoản có quyền Quản trị/Quản lý kho hoặc khi phiên rơi vào trạng thái lỗi/timeout.
  - Bổ sung thanh hướng dẫn phím tắt trực quan cố định: `F2: Bắt đầu • F4/Space: Hoàn tất • ESC: Hủy`.

### 2.4. Lịch sử đóng gói & Nơi lưu trữ (Storage & History)
- **Trước đây:**
  - Ghi nhãn tĩnh `NAS OK` gây hiểu nhầm về hạ tầng lưu trữ.
  - Dung lượng file video khi chưa sẵn sàng hiển thị `0.0 MB`.
  - Không xem được mã băm SHA-256 đầy đủ.
- **Sau cải tiến:**
  - Hiển thị song song hai đích lưu trữ chính xác:
    - **Local OK:** Video đã được ghi nhận trên ổ đĩa máy trạm.
    - **Google Drive:** `Đã lưu` (xanh ngọc), `Đang đồng bộ` (xanh dương nhấp nháy), `Chờ đồng bộ` (vàng hổ phách), hoặc `Lỗi sync` (đỏ).
  - Dung lượng file: hiển thị `Chưa xác định` nếu chưa có thông số thay vì `0.0 MB`.
  - Thời gian hiển thị theo định dạng Việt Nam (`HH:mm:ss`).
  - Cho phép click vào bất kỳ dòng đơn nào để mở ngăn chi tiết (Drawer), hiển thị toàn bộ chuỗi mã băm SHA-256 niêm phong pháp lý cùng nút bấm "Sao chép hash" tiện lợi.

---

## 3. Tóm tắt Diff Code chính

### 3.1. `apps/user-web/src/components/CameraViewport.tsx`
```diff
@@ -33,6 +33,7 @@
   const imgRef = useRef<HTMLImageElement | null>(null);
   const [timecode, setTimecode] = useState('');
   const [streamError, setStreamError] = useState(false);
+  const [isStreamLoaded, setIsStreamLoaded] = useState(false);
   const [retryCount, setRetryCount] = useState(0);

@@ -210,7 +210,13 @@
   return (
-    <div className="relative w-full h-full min-h-[360px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex items-center justify-center">
+    <div
+      className={`relative w-full h-full min-h-[340px] bg-slate-950 rounded-2xl overflow-hidden transition-all duration-300 flex items-center justify-center ${
+        state === 'RECORDING'
+          ? 'border-2 border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.35)] ring-2 ring-red-500/30'
+          : 'border border-slate-800 shadow-xl'
+      }`}
+    >
       {/* Real Live Camera Video Stream */}
       {stationId && !streamError ? (
         <img
@@ -215,8 +215,13 @@
           src={`http://localhost:4000/api/v1/stations/${stationId}/live-preview?t=${retryCount}`}
           alt="Live Camera Feed"
           crossOrigin="anonymous"
+          onLoad={() => {
+            setIsStreamLoaded(true);
+            setStreamError(false);
+          }}
           onError={() => {
             console.warn('Live camera stream disconnected, retrying in 3s...');
+            setIsStreamLoaded(false);
             setStreamError(true);
           }}
           className="absolute inset-0 w-full h-full object-cover"
@@ -250,9 +255,27 @@
-        {!streamError && (
-          <>
-            <span className="text-slate-500">•</span>
-            <span className="flex items-center space-x-1 text-emerald-400 text-[10px] font-bold">
-              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
-              <span>LIVE</span>
-            </span>
-          </>
-        )}
+        {streamError ? (
+          <span className="flex items-center space-x-1 text-rose-400 text-[11px] font-bold">
+            <AlertCircle className="w-3 h-3 text-rose-400" />
+            <span>CHƯA CÓ HÌNH</span>
+          </span>
+        ) : !isStreamLoaded ? (
+          <span className="flex items-center space-x-1 text-amber-400 text-[11px] font-bold">
+            <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
+            <span>ĐANG KẾT NỐI</span>
+          </span>
+        ) : state === 'RECORDING' ? (
+          <span className="flex items-center space-x-1 text-rose-400 text-[11px] font-bold">
+            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
+            <span>ĐANG GHI HÌNH</span>
+          </span>
+        ) : (
+          <span className="flex items-center space-x-1 text-emerald-400 text-[11px] font-bold">
+            <span className="w-2 h-2 rounded-full bg-emerald-400" />
+            <span>SẴN SÀNG</span>
+          </span>
+        )}
```

### 3.2. `apps/user-web/src/components/PackingHistory.tsx`
```diff
@@ -32,7 +32,9 @@
-  const formatFileSize = (bytes?: number) => {
-    if (!bytes) return '0 MB';
-    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
+  const formatFileSize = (bytes?: number | string | bigint | null) => {
+    if (!bytes) return 'Chưa xác định';
+    const num = Number(bytes);
+    if (num <= 0 || isNaN(num)) return 'Chưa xác định';
+    const mb = num / (1024 * 1024);
+    return `${mb.toFixed(1)} MB`;
   };

@@ -107,3 +115,10 @@
-    <span className="text-emerald-400 flex items-center space-x-0.5">
-      <HardDrive className="w-3 h-3" />
-      <span>NAS OK</span>
-    </span>
+    <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-medium border border-slate-700">
+      <HardDrive className="w-3 h-3 text-cyan-400" />
+      <span>Local OK</span>
+    </span>
+    {renderCloudSyncBadge(item.video?.syncStatus)}
```

### 3.3. `apps/user-web/src/App.tsx`
```diff
@@ -517,11 +517,11 @@
-        {/* Center Grid: Viewport + Controls + History */}
-        <div className="flex-1 grid grid-cols-12 gap-5 min-h-0">
-          {/* Left Column: Camera Viewport + Order Checklist / Pending Queue (7 cols) */}
-          <div className="col-span-7 flex flex-col space-y-3.5 h-full overflow-y-auto pr-1">
-            <div className="h-[310px] shrink-0">
-              <CameraViewport ... />
-            </div>
-            <OrderPackingSlip ... />
-          </div>
+        {/* Center Grid: 2 Columns (Left ~60% Camera + History, Right ~40% Barcode -> Checklist -> Controls) */}
+        <div className="flex-1 grid grid-cols-12 gap-3.5 min-h-0">
+          {/* Left Column: Camera Viewport (~60% width) + Packed History */}
+          <div className="col-span-7 flex flex-col space-y-2.5 h-full min-h-0">
+            <div className="flex-1 min-h-[300px]">
+              <CameraViewport ... />
+            </div>
+            <div className="h-[210px] shrink-0">
+              <PackingHistory ... />
+            </div>
+          </div>

-          {/* Right Column: Ergonomic Controls + Packed History (5 cols) */}
-          <div className="col-span-5 flex flex-col space-y-4 h-full">
-            <ActionControls ... />
-            <div className="flex-1 min-h-0">
-              <PackingHistory ... />
-            </div>
-          </div>
+          {/* Right Column: Thao tác (~40% width): Mã vận đơn -> Checklist -> Nút chính pinned */}
+          <div className="col-span-5 flex flex-col h-full min-h-0">
+            <ActionControls ...>
+              <OrderPackingSlip ... />
+            </ActionControls>
+          </div>
```

---

## 4. Mô hình Trực quan Trước & Sau với Dữ liệu Kiểm thử Thực tế

### 4.1. Giao diện Trước Cải tiến (Before)
```
+-------------------------------------------------------------------------------------------------------------------+
| HEADER (Cồng kềnh ~70px, có menu nhầm sang Admin Portal: Quản trị Admin | Google Drive | Trạm | Packer)               |
+-------------------------------------------------------------------------------------------------------------------+
| STATUS BANNER (Chiếm ~80px, hiển thị to quá mức)                                                                  |
+-----------------------------------------------------------------+-------------------------------------------------+
| CỘT TRÁI (~58%):                                                | CỘT PHẢI (~42%):                                |
|                                                                 |                                                 |
| [ CAMERA VIEWPORT ]                                             | [ Ô NHẬP MÃ (chung dòng với nút Bắt đầu) ]      |
| - Luôn hiện LIVE giả dù chưa có hình                            |                                                 |
| - Hiện 1080p @ 30FPS giả                                        | [ CÁC NÚT ĐIỀU KHIỂN CHÍNH ]                    |
|                                                                 | - Nút Hoàn tất, Hủy, và Mở khóa [F8]            |
| [ CHECKLIST SẢN PHẨM / ĐƠN CHỜ ĐÓNG ]                           |   nằm chung hàng -> nhân viên dễ bấm nhầm F8.   |
| - Nằm ở cột trái bên dưới camera                                |                                                 |
| - Nhân viên phải nhìn sang trái để xem checklist rồi lại        | [ LỊCH SỬ ĐÓNG GÓI ]                            |
|   nhìn sang phải để bấm nút thao tác.                           | - Ghi "NAS OK" cố định                          |
|                                                                 | - Dung lượng video chưa có ghi 0.0 MB           |
| (BỊ THANH CUỘN LỒNG NHAU TRÊN 1366x768 - Nút bấm bị trôi)       | - Không xem được mã SHA-256 đầy đủ              |
+-----------------------------------------------------------------+-------------------------------------------------+
```

### 4.2. Giao diện Sau Cải tiến ở 1366×768 (After - Không thanh cuộn trang)
```
+-------------------------------------------------------------------------------------------------------------------+
| [PACK01] Trạm Hà Đông | NV: packer01 | Worker: ONLINE (ws) | Cam: Dahua 4K | 23:25:10          [Chế độ Mobile]    | (h-12)
+-------------------------------------------------------------------------------------------------------------------+
| SẴN SÀNG ĐÓNG GÓI | Quét mã vạch đơn hàng để bắt đầu ghi hình tự động  • [F2] Bắt đầu • [F4] Hoàn tất • [ESC] Hủy| (h-12)
+-----------------------------------------------------------------+-------------------------------------------------+
| CỘT TRÁI (~60% width - Hình ảnh & Pháp lý):                     | CỘT PHẢI (~40% width - Thao tác đóng hàng):     |
|                                                                 |                                                 |
| +-------------------------------------------------------------+ | +---------------------------------------------+ |
| | [CAM_PACK01] • SẴN SÀNG               2026-10-05 23:25:10.12| | | MÃ VẬN ĐƠN                      [F2 để nhập]| |
| |                                                             | | | [ SPXVN0888999123                         ] | |
| |             [ LUỒNG HÌNH ẢNH CAMERA DAHUA ]                 | | +---------------------------------------------+ |
| |                                                             | | | CHI TIẾT ĐƠN HÀNG ĐANG ĐÓNG GÓI             | |
| |                                                             | | | Mã đơn: SPXVN0888999123 | Sàn: SHOPEE       | |
| |                                                             | | | Tiến độ đếm: 1/2 cái (1/2 món)              | |
| |-------------------------------------------------------------| | | +-----------------------------------------+ | |
| | Mã: CHỜ QUÉT | Trạm: PACK01 | NV: packer01 | Đ/p: Chưa XĐ  | | | | [x] Áo Thun Unisex (x1)         1/1 ĐỦ  | | |
| +-------------------------------------------------------------+ | | | [ ] Quần Jean Slimfit (x1)      0/1 CÁI | | |
|                                                                 | | +-----------------------------------------+ | |
| +-------------------------------------------------------------+ | | (Cuộn nội bộ êm ái, không đẩy nút xuống)    | |
| | LỊCH SỬ ĐÓNG GÓI HÔM NAY (5)         Bấm xem mã băm SHA-256 | | +---------------------------------------------+ |
| | +---------------------------------------------------------+ | | NÚT HÀNH ĐỘNG CHÍNH (GHIM ĐÁY - KHÔNG BỊ CHE) | |
| | | ✓ SPX_SAFE_B_1791192195826 [SPX] 23:23:15 • 4s • 0.6 MB | | |                                                 | |
| | |   [Local OK] [Google Drive: Đã lưu]         [Sao chép]  | | | [ F2 ] BẮT ĐẦU ĐÓNG GÓI                     | |
| | |   SHA: c368a6bd4c46bdc41a7fde0a3e282215d4eb7f...        | | | (Khi đang quay chuyển thành nút lớn xanh ngọc| |
| | +---------------------------------------------------------+ | |  [F4/SPACE] HOÀN TẤT ĐÓNG GÓI + [ESC] HỦY)    | |
| | (Cuộn nội bộ danh sách lịch sử)                           | | |                                                 | |
| +-------------------------------------------------------------+ | | Phím tắt: F2 Bắt đầu • F4/Space Hoàn tất    | |
|                                                                 | | > Xử lý sự cố & Mở khóa [F8] (Quản lý)      | |
|                                                                 | +---------------------------------------------+ |
+-----------------------------------------------------------------+-------------------------------------------------+
```

### 4.3. Giao diện Sau Cải tiến ở 1920×1080 khi đang GHI HÌNH (RECORDING Mode)
```
+-------------------------------------------------------------------------------------------------------------------+
| [PACK01] Trạm Hà Đông | NV: packer01 | Worker: ONLINE (ws) | Cam: Dahua 4K | 23:25:35          [Chế độ Mobile]    |
+-------------------------------------------------------------------------------------------------------------------+
| ● ĐANG GHI HÌNH ĐÓNG GÓI: [ SPXVN0888999123 ]  • Thời lượng: 00:15                               [F4 để hoàn tất] |
+-----------------------------------------------------------------+-------------------------------------------------+
| CỘT TRÁI (~60% - Khung viền đỏ rực phát sáng shadow đỏ):        | CỘT PHẢI (~40% - Khu vực thao tác tập trung):   |
|                                                                 |                                                 |
| +======================= VIỀN ĐỎ PHÁT SÁNG ===================+ | +---------------------------------------------+ |
| | [CAM_PACK01] • ● ĐANG GHI HÌNH         [REC 00:15] 23:25:35 | | | MÃ VẬN ĐƠN          [ĐANG KHÓA KHI ĐANG QUAY] |
| |                                                             | | | [ SPXVN0888999123                         ] | |
| |             [ LUỒNG HÌNH ẢNH CAMERA DAHUA ]                 | | +---------------------------------------------+ |
| |                  (Laser quét mã đỏ nhạt)                    | | | TIẾN ĐỘ KIỂM ĐẾM SẢN PHẨM:                  | |
| |                                                             | | | 🎉 ĐÃ ĐẾM ĐỦ 100%! BẤM F4 ĐỂ HOÀN TẤT       | |
| |-------------------------------------------------------------| | | +-----------------------------------------+ | |
| | Mã: SPXVN0888999123 (VÀNG ĐẬM) | Trạm: PACK01 | fMP4        | | | | [x] Áo Thun Unisex (x1)         1/1 ĐỦ  | | |
| +=============================================================+ | | | [x] Quần Jean Slimfit (x1)      1/1 ĐỦ  | | |
|                                                                 | | +-----------------------------------------+ | |
| +-------------------------------------------------------------+ | +---------------------------------------------+ |
| | LỊCH SỬ ĐÓNG GÓI HÔM NAY (5)                                | | [ F4 / SPACE ] HOÀN TẤT ĐÓNG GÓI  | [ESC] HỦY | |
| | (Danh sách các kiện đã đóng trước đó)                       | | (Nút xanh ngọc cực đại nổi bật, phát sáng)    | |
| +-------------------------------------------------------------+ | +---------------------------------------------+ |
+-----------------------------------------------------------------+-------------------------------------------------+
```

---

## 5. Bảng Ma Trận Kiểm Thử Thực Tế Trạng Thái (State Verification Matrix)

| Trạng thái | Điều kiện kích hoạt | Giao diện Camera | Banner đầu trang | Nút thao tác chính | Đích lưu trữ & Ghi chú |
|:---|:---|:---|:---|:---|:---|
| **IDLE (Sẵn sàng)** | Trạm rảnh, Worker online, Cam đã tải | Huy hiệu `SẴN SÀNG` (chấm xanh), OSD đen mờ | Xanh lá: `SẴN SÀNG ĐÓNG GÓI` | `[F2] BẮT ĐẦU ĐÓNG GÓI` (Xanh dương) | Ô mã mở, tự động focus con trỏ |
| **IDLE (Chưa nhập mã)** | Chưa quét/nhập barcode | Huy hiệu `SẴN SÀNG`, OSD hiện `CHỜ QUÉT` | Xanh lá `SẴN SÀNG` | `[F2] BẮT ĐẦU` (Disable) | Dòng thông báo: *Chưa quét hoặc nhập mã vận đơn* |
| **RECORDING (Đang quay)** | Đã quét mã hợp lệ và bấm F2 | **Khung viền đỏ 2px phát sáng**, `REC 00:xx`, laser quét đỏ | Đỏ: `ĐANG GHI HÌNH [Mã đơn]` kèm timer | `[F4/SPACE] HOÀN TẤT` (Xanh ngọc lớn) + `[ESC] HỦY` (Đỏ) | Ô mã bị khóa chống sửa đổi |
| **PROCESSING (Đang lưu)** | Bấm F4 hoàn tất | Khung viền trở lại bình thường | Xanh dương: `ĐANG XỬ LÝ & LƯU TRỮ VIDEO...` | `ĐANG LƯU & NIÊM PHONG VIDEO...` (Disable kèm Spinner) | Ngăn chặn bấm đúp hoặc hủy lúc đang render fMP4 |
| **COMPLETED (Đã lưu)** | Backend xác nhận lưu xong | OSD hiện mã vừa đóng | Xanh lục đậm: `ĐÃ HOÀN TẤT ĐÓNG GÓI` | Tự động chuyển về IDLE sau 3.5s để đóng đơn tiếp theo | Hiển thị `Local OK` + `Google Drive: Đã lưu` + SHA-256 |
| **CAMERA ERROR** | Mất tín hiệu RTSP/IP | Màn tối + Cảnh báo đỏ: `CHƯA CÓ HÌNH (CAMERA CHƯA SẴN SÀNG)` | Vàng: `CHỜ TÍN HIỆU CAMERA` | `[F2] BẮT ĐẦU` | **Không hiện LIVE giả**, tự retry mỗi 3s |
| **WORKER OFFLINE** | Video-worker mất kết nối | Camera hiện luồng nhưng worker tắt | Đỏ: `MẤT KẾT NỐI WORKER: Dịch vụ ghi hình chưa sẵn sàng` | `[F2] BẮT ĐẦU` (Disable) | Dòng thông báo: *Mất kết nối Video Worker — chưa thể quay* |
| **SYNC FAILED** | Lỗi upload Google Drive | N/A | N/A | N/A | Trong lịch sử hiện huy hiệu đỏ: `Google Drive: Lỗi sync` |

---

## 6. Kết quả Biên dịch & Kiểm tra Tự động

1. **Biên dịch TypeScript & Vite Build:**
   ```
   > @packing-proof/user-web@1.0.0 build
   > tsc && vite build
   ✓ 1752 modules transformed.
   ✓ built in 15.63s
   dist/index.html                   0.58 kB
   dist/assets/index-DDk7-GAS.css   38.60 kB
   dist/assets/index-Uray3kU2.js   703.87 kB
   ```
   *(0 lỗi TypeScript, 0 cảnh báo cú pháp)*

2. **Dịch vụ chạy thực tế (Production Preview):**
   - User Web: `https://localhost:3000/` (HTTPS, task-5294 đang chạy ổn định).
   - Backend API: `http://localhost:4000/` (task-5057 đang chạy ổn định).
   - Video Worker: `task-4808` đang kết nối WebSocket gateway ổn định.

---

## 7. Điểm Còn Thiếu & Cần Bổ Sung Backend Trong Tương Lai (Backlog)

1. **API trả về thông số phân giải & FPS thực tế của Camera:**
   - Hiện tại backend API chỉ trả về `name`, `type`, `rtspUrl` của camera mà chưa có endpoint thông báo độ phân giải và framerate thực tế (ví dụ: `1920x1080 @ 25fps`).
   - Do tuân thủ tuyệt đối quy định không tự ý sửa đổi backend/database trong gói này, giao diện đã hiển thị đúng chuẩn trung thực: `Độ phân giải: Chưa xác định • fMP4`.
   - Đề xuất bổ sung trong tương lai: Endpoint `GET /api/v1/stations/:id/stream-meta` để client truy vấn probe metadata từ ffmpeg.
2. **Âm thanh cảnh báo bằng giọng nói (Text-to-Speech):**
   - Đọc to mã đơn hoặc cảnh báo "Mã trùng lặp" qua loa bàn làm việc khi nhân viên không nhìn màn hình.

---
<!-- GOAL_COMPLETE -->

