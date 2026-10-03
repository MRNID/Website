# Packing Video Proof — thiết kế trước, triển khai sau

Mục tiêu hiện tại là hoàn thiện sườn kiến trúc trước khi code chức năng. Bắt đầu tại [docs/BASELINE.md](docs/BASELINE.md) để xem phạm vi, ranh giới module, quy tắc dữ liệu, các quyết định còn mở và điều kiện nghiệm thu từng giai đoạn.

Bộ tài liệu trong `docs/` mô tả hệ thống quay video đóng gói dự kiến. Code Express/admin HTML và SQL Server hiện có là demo cũ; chưa triển khai kiến trúc này và chưa dùng làm nền bảo mật cho sản phẩm.

Quy trình phối hợp triển khai và review: [Anti–Codex](docs/AI_WORKFLOW.md). Mẫu bàn giao: [Review packet](docs/REVIEW_PACKET_TEMPLATE.md).

## Demo cũ: Multi-tenant Admin Starter

Một nền tảng quản trị doanh nghiệp theo mô hình multi-tenant, có cấu trúc code sạch và sẵn sàng tích hợp SQL Server.

## Cấu trúc chính

- [admin/index.html](admin/index.html): giao diện quản trị
- [config/app.js](config/app.js): cấu hình ứng dụng
- [config/database.js](config/database.js): kết nối SQL Server
- [config/tenants.js](config/tenants.js): cấu hình tenant mẫu
- [functions/tenant.js](functions/tenant.js): logic tenant
- [functions/utils.js](functions/utils.js): helper chung
- [plugins/demo-plugin.js](plugins/demo-plugin.js): plugin mẫu
- [database/schema.sql](database/schema.sql): schema SQL Server
- [database/seed.sql](database/seed.sql): dữ liệu mẫu

## SQL Server setup

Tạo database trước rồi chạy các script theo thứ tự:

1. [database/schema.sql](database/schema.sql)
2. [database/seed.sql](database/seed.sql)

Cấu hình biến môi trường trong [.env.example](.env.example):

```env
DB_SERVER=localhost
DB_PORT=1433
DB_NAME=TenantAdminDB
DB_USER=sa
DB_PASSWORD=YourStrong!Passw0rd
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=false
```

## Chạy ứng dụng

```bash
npm install
npm start
```

Mở:

- http://localhost:3000/admin/
- http://localhost:3000/api/health
- http://localhost:3000/api/tenants

## Mục tiêu kiến trúc

- Multi-tenant rõ ràng
- Tách admin / config / functions / assets / plugins
- Dễ tùy biến theo từng doanh nghiệp
- Dễ mở rộng module mới
