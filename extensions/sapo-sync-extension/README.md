# Sapo to Packing Proof Sync (Chrome Extension)

### Cập nhật 1.0.3 — lỗi yêu cầu F5 khi đồng bộ

Sau khi cập nhật mã, mở `chrome://extensions`, tìm Sapo Packing Sync và bấm Reload.
Tải lại tab Sapo đang mở một lần để thay content script cũ. Bản mới tự nạp thành phần
đọc trang nếu tab chưa có kết nối, chỉ trên tên miền Sapo được hỗ trợ; không tự gửi
lại đơn khi một yêu cầu đã gửi bị mất phản hồi. Bộ đếm popup không cộng trùng với trang.
Kiểm thử: `node --test scripts/sapo-extension.test.mjs`.

Cơ chế nạp script sử dụng [Chrome Scripting API](https://developer.chrome.com/docs/extensions/reference/api/scripting).
`Server Online` chỉ xác nhận backend phản hồi health check, chưa xác nhận đã đồng bộ đơn.

Tiện ích mở rộng Google Chrome giúp **tự động bắt dữ liệu đơn hàng và mã SKU từ phần mềm Sapo** (`*.mysapo.net`, `*.pos.sapo.vn`, `*.mysapogo.com`) đẩy sang **Hệ Thống Video Đóng Gói LAN (Packing Proof)** mà **không cần Sapo cấp quyền hay mở API**.

---

## 🚀 Hướng Dẫn Cài Đặt (Trong 30 giây)

1. Mở trình duyệt **Google Chrome** (hoặc Cốc Cốc / Edge / Brave).
2. Nhập vào thanh địa chỉ:
   ```text
   chrome://extensions
   ```
3. Bật công tắc **Developer mode (Chế độ cho nhà phát triển)** ở góc trên bên phải màn hình.
4. Bấm nút **Load unpacked (Tải tiện ích đã giải nén)** ở góc trên bên trái.
5. Chọn thư mục:
   ```text
   E:\Website\extensions\sapo-sync-extension
   ```
6. Xong! Biểu tượng tiện ích 📦 **Sapo Packing Sync** sẽ xuất hiện trên thanh công cụ của Chrome.

---

## 🎯 Cách Hoạt Động & Sử Dụng

### 1. Tự động hoàn toàn khi Bấm In Đơn trên Sapo
* Khi nhân viên bán hàng/kế toán vào Sapo bấm nút **"In đơn"**, **"In phiếu giao hàng"** hoặc **"In phiếu đóng gói"**:
* Tiện ích tự động đọc Mã vận đơn, Tên khách hàng, và Danh sách Mã SKU + Số lượng của từng món hàng.
* Tự động gửi ngầm sang máy chủ đóng gói (`http://localhost:4000`) trong **0.1 giây**.
* Góc dưới màn hình Sapo sẽ hiện thông báo xanh: `✓ Đã nạp đơn SPX... sang Bàn đóng gói!`.

### 2. Bấm nút nổi trên màn hình Sapo
* Trên mọi trang đơn hàng của Sapo, góc dưới bên phải sẽ có nút nổi màu xanh tím:
  `📦 Đóng Gói: Gửi đơn sang Bàn Quay`.
* Chỉ cần bấm 1 phát là toàn bộ thông tin đơn hàng hiện tại được nạp sang bàn đóng gói ngay lập tức.

### 3. Gửi đơn hàng thử nghiệm (Test)
* Bấm vào biểu tượng tiện ích 📦 trên góc Chrome $\rightarrow$ Chọn **"⚡ Gửi thử 1 đơn hàng mẫu"**.
* Mở giao diện đóng gói `https://localhost:3000` $\rightarrow$ Bắn mã vận đơn mẫu vừa gửi $\rightarrow$ Thấy ngay danh sách sản phẩm hiển thị trên bàn đóng hàng để quét đếm!

---

## ⚙️ Cấu Hình Địa Chỉ Server
Mặc định tiện ích kết nối tới:
* `http://localhost:4000` (Nếu trình duyệt chạy cùng máy với server).
* Nếu máy in đơn Sapo nằm ở máy khác trong mạng LAN, chỉ cần mở popup tiện ích và đổi thành địa chỉ IP máy chủ (ví dụ: `http://192.168.1.50:4000`).
