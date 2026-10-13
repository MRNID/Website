# Triển khai lưu video tại khách hàng

## Dữ liệu nằm ở đâu?

| Thành phần | Nơi lưu |
| --- | --- |
| Video gốc | Máy Windows tại kho, mặc định `D:/PackingVideo/<mã bàn>` |
| Bản sao video | Google Drive của doanh nghiệp đã kết nối |
| Tài khoản, đơn hàng, đường dẫn, checksum, trạng thái | SQL Server của hệ thống |
| Hàng đợi và thông tin tiếp tục upload | Thư mục `journal` tại máy kho |

Worker tại kho chủ động kết nối WSS tới máy chủ. Không cần mở cổng vào mạng kho. Worker upload video trực tiếp lên Google Drive; OAuth credentials chỉ ở backend. Máy chủ có thể chuyển tiếp video khi xem hoặc nhận video điện thoại, nhưng không tạo kho video trên ổ đĩa máy chủ. Upload điện thoại dùng bộ nhớ, tối đa hai yêu cầu đồng thời, mỗi file 100 MiB; cần dự trù RAM cho backend và proxy.

Đây là sao lưu một chiều từ kho lên Drive, chưa phải đồng bộ hai chiều hoặc tự tải lại Drive về ổ D. Không tự xóa video ở cả hai nơi. Các giá trị số ngày lưu cũ chưa kích hoạt thao tác xóa. Khi ổ kho gần đầy cần xử lý dung lượng trước khi tiếp tục ghi hình.

## Chuẩn bị máy chủ

1. Cài Node.js hỗ trợ `process.loadEnvFile` (Node 22), Corepack/pnpm và SQL Server có thể kết nối từ backend. Compose PostgreSQL cũ trong repository không dùng cho hệ thống SQL Server này.
2. Tạo `.env` riêng từ `.env.example`; điền SQL Server, mật khẩu riêng, JWT_SECRET ngẫu nhiên ít nhất 32 ký tự. Production đặt `NODE_ENV=production`, `HOST=127.0.0.1`. Với TCP đặt `DB_PORT`; với named instance bỏ DB_PORT và đặt DB_INSTANCE. Production mặc định bật mã hóa kết nối SQL và xác minh chứng chỉ.
3. Điền Google OAuth client ID/secret riêng, callback HTTPS `/api/v1/auth/google/callback`, ADMIN_WEB_URL đúng tên miền quản trị. Đăng ký callback tương ứng trong Google Cloud. Không chuyển `.env` máy chủ sang kho.
4. Chạy từ thư mục gốc:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm -r build
corepack pnpm test
node scripts/migrate-customer-storage.mjs --apply
node apps/backend-api/dist/main.js
```

Database mới phải được khởi tạo bằng `packages/database/sqlserver/schema.sql` trước. Database đang hoạt động cần sao lưu trước migration. Migration chỉ thêm cột, giữ video cũ là LEGACY; không tự chuyển file cũ sang máy kho. Cần đối soát và chuyển file cũ riêng trước khi tắt nơi lưu cũ.

Phục vụ `apps/admin-web/dist` và `apps/user-web/dist` trên hai tên miền HTTPS. Cả hai proxy `/api/` và `/ws/` tới backend. Frontend mặc định dùng cùng origin. Dùng mẫu `infrastructure/nginx/customer-storage.locations.conf` bên trong mỗi server block; thay domain, chứng chỉ TLS và static root theo máy thực tế. Cấu hình SPA `try_files $uri $uri/ /index.html` tại location `/`.

Chạy backend bằng dịch vụ tự khởi động của hệ điều hành. Không mở SQL Server hoặc cổng backend trực tiếp ra Internet. Access log của proxy không được ghi query string vì URL xem video có vé truy cập tạm thời; mẫu đã tắt log trên các location chuyển tiếp.

## Cấp worker cho mỗi bàn

Tạo doanh nghiệp, kho, bàn và camera trong quản trị. Lấy UUID của bàn, chạy trên máy có quyền truy cập database:

```powershell
node scripts/provision-worker.mjs --station-id UUID-CUA-BAN --backend wss://packing.example.com/ws/worker --out PACK01.worker.env
```

Lệnh tạo secret riêng và thay secret trước đó của bàn. Không chạy lại tùy tiện trên bàn đang hoạt động. Chuyển file sinh ra riêng tư đến máy kho; không gửi vào chat hoặc commit. Mỗi bàn dùng file và thư mục riêng.

Trên Windows tại kho, cài Node.js, dependencies và build repository. Đảm bảo ổ D tồn tại, tài khoản chạy worker có quyền ghi. Có thể sửa các thư mục trong file worker env sang ổ khác nếu cần. Chạy:

```powershell
powershell -File scripts/start-warehouse-worker.ps1 -WorkerEnvFile C:/Packing/PACK01.worker.env
```

Đặt lệnh này trong Task Scheduler với tài khoản có quyền đọc camera và ghi ổ lưu trữ, tự chạy khi khởi động và khởi động lại nếu lỗi. Worker cần truy cập HTTPS ra máy chủ và Google, RTSP tới camera trong LAN. Kiểm tra URL camera và ffmpeg thực tế; video mô phỏng không được dùng để nghiệm thu.

Kết nối Google Drive từ tài khoản quản trị doanh nghiệp. Khi chưa kết nối hoặc Drive hết quota, bản kho vẫn được giữ và hàng đợi thử lại. Giữ cả video, file `.proof.json` và thư mục journal khi di chuyển/khôi phục máy kho. Không xóa journal để thử lại upload.

## Hành vi và kiểm tra nghiệm thu

- Quay một đơn thật: kiểm tra file tại ổ kho, tìm lại đơn trên web, xem và tua video.
- Ngắt Internet rồi kết nối lại: bản gốc vẫn còn, hàng đợi tự thử lại. Kiểm tra thêm tình huống khởi động lại worker giữa upload.
- Chỉ báo Drive thành công sau khi backend đối chiếu ID, dung lượng và SHA-256 do Google trả về. Kiểm tra file thật trong tài khoản Drive của đúng doanh nghiệp.
- Tắt máy kho sau khi Drive đã xác nhận: xem lại qua bản Drive. Nếu cả hai bản đều không truy cập được, giao diện báo lỗi, không giả báo thành công.
- Quay bằng điện thoại: nếu kho offline, video tạm còn trong trình duyệt để gửi lại hoặc tải xuống. Tránh xóa dữ liệu trình duyệt; khi trình duyệt thiếu dung lượng phải giữ tab và tải bản sao xuống. Chỉ bỏ bản tạm khi máy kho xác minh đầy đủ file.
- Dùng tài khoản doanh nghiệp khác: không được tìm/xem video ngoài quyền. Link chia sẻ mở trang quản trị và yêu cầu đăng nhập, không công khai file.

Kiểm thử tự động: `corepack pnpm test`. Kiểm thử SQL thật tùy chọn: `node scripts/test-customer-storage-db.mjs` tạo và dọn dữ liệu fixture riêng; chạy trên database kiểm thử. Test Google dùng mock, không thay cho nghiệm thu OAuth/Drive thật.

Giới hạn triển khai: camera preview/PTZ hiện vẫn có luồng xử lý tại backend, nên máy chủ ngoài mạng kho cần đường mạng phù hợp để dùng những tính năng đó; chưa có relay preview/PTZ qua worker. Không coi kiểm thử lưu trữ là nghiệm thu toàn bộ hệ thống camera. Chưa xác minh giao diện bằng trình duyệt tự động trong phiên này vì Browser không khả dụng.

Thiết kế upload tham chiếu [Google Drive resumable uploads](https://developers.google.com/workspace/drive/api/guides/manage-uploads) và [File metadata/checksums](https://developers.google.com/workspace/drive/api/reference/rest/v3/files).
