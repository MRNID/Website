# Sửa lỗi sẵn sàng vận hành — 2026-10-11

## Thay đổi

- JWT có loại `access`/`refresh`, chỉ chấp nhận HS256 và đúng loại token. Token cũ không có loại bị từ chối; người dùng cần đăng nhập lại. Tài khoản bị khóa không thể làm mới token.
- Backend bắt buộc có `JWT_SECRET` riêng, tối thiểu 32 ký tự; không dùng khóa demo. `.env` được đọc trước khi khởi tạo cấu hình, kể cả khi chạy từ thư mục backend.
- Google Drive không còn fallback giả lập, không lưu access token thay refresh token, không tự gán email. Phải xác nhận được tài khoản, thư mục và ID file từ Google trước khi báo thành công.
- Tắt `instant-connect` ở mọi môi trường. Các liên kết chứa token/thư mục giả cũ hiển thị chưa kết nối. Nút kiểm tra tải một tệp văn bản thật và chỉ trả thành công sau khi Google xác nhận, kèm dung lượng thật.
- Admin, bàn đóng gói, upload điện thoại và WebSocket dùng cùng quy tắc địa chỉ máy chủ. Link xem video được sửa đúng đường dẫn `/videos/:id/stream`.

## Cấu hình và khởi động

Node 24 và Corepack đã có trên máy kiểm tra. Từ thư mục gốc:

```powershell
corepack pnpm -r build
corepack pnpm test
node apps/backend-api/dist/main.js
```

Chạy worker và hai giao diện ở các terminal riêng theo cấu hình camera/SQL Server của hệ thống. Không chạy bộ test tích hợp cũ trên kho đang hoạt động: chúng có thao tác sửa dữ liệu và mở khóa trạm.

`JWT_SECRET` ngẫu nhiên đã được thêm vào `.env` local (Git bỏ qua); không đưa giá trị này vào tài liệu hoặc mã nguồn. Khi cài máy mới, tạo khóa riêng:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Google Drive cần `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` và tùy chọn `ADMIN_WEB_URL` trong `.env`. **Secret Google từng nằm trong mã nguồn cần được đổi tại Google Cloud Console**, rồi cập nhật `.env` và khởi động lại backend. Bản sửa bỏ secret khỏi mã nguồn nhưng không thay thế thao tác thu hồi/đổi secret tại Google. Không tự tạo chuỗi ngẫu nhiên để thay OAuth client secret.

Đặt `GOOGLE_REDIRECT_URI` đúng URI callback đã đăng ký với Google; đặt `ADMIN_WEB_URL` thành địa chỉ admin người dùng truy cập. Liên kết lại những tài khoản từng dùng mock. Quyền OAuth mới dùng `drive.file` để giới hạn quyền đối với file của ứng dụng.

HTTP LAN mặc định: mở `http://<IP-máy-chủ>:3001`, API trỏ về `http://<IP-máy-chủ>:4000`. HTTPS mặc định dùng reverse proxy cùng origin cho `/api/v1` và `/ws`; bản sửa không tự cài HTTPS. Có thể đặt `VITE_BACKEND_ORIGIN` trong `.env.local` của từng app web trước khi build nếu backend ở origin khác. Camera điện thoại cần HTTPS hoặc môi trường localhost được trình duyệt chấp nhận.

## Kiểm chứng và giới hạn

Bộ `scripts/readiness-regression.test.mjs` kiểm tra token, API bằng Fastify injection, các nhánh Google thất bại/thành công, bảo vệ thông tin xác thực và địa chỉ LAN/HTTPS/IPv6. Database và phản hồi Google được giả lập có kiểm soát trong test; không truy cập tài khoản Google hoặc sửa dữ liệu kho thật.

Cần nghiệm thu riêng với camera, SQL Server, NAS và tài khoản Google thật, bao gồm mất mạng và khởi động lại. Các bản ghi đã bị đánh dấu SYNCED giả trước bản sửa không được tự động sửa hoặc xóa: cần đối soát bản sao vật lý trước khi xử lý dữ liệu lịch sử. Bản sửa này không phải chứng nhận toàn bộ hệ thống đã sẵn sàng production.
