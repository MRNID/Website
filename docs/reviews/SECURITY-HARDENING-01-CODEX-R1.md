# SECURITY-HARDENING-01 — Codex review R1

Ngày review: 2026-10-08. Kết quả: **CẦN SỬA**.

Review working tree trên HEAD `6c9f9f5bf273076a62769fd9e1cf88ab69604b2d`, đối chiếu packet SECURITY-HARDENING-01 và các caller liên quan. Không sửa implementation.

## SH-R1-01 — P1: Client mobile không gửi token cho API vừa bắt buộc xác thực

- Vị trí: `apps/user-web/src/components/MobilePackingWorkbench.tsx:264`; `apps/backend-api/src/routes/mobile.routes.ts:14`.
- Hàm upload dùng fetch với method/body nhưng không có Authorization. Backend mới yêu cầu Bearer token, nên cả người dùng đã đăng nhập cũng nhận 401 khi tải video từ giao diện này.
- Sửa: gửi token qua API client chung hoặc Authorization header; lấy trạm hợp lệ của người dùng thay cho mã MOBILE01 cố định. Kiểm thử luồng upload từ giao diện thực tế, không chỉ request tự tạo trong script.

## SH-R1-02 — P1: Broadcast thiếu scope vẫn gửi đến mọi doanh nghiệp

- Vị trí: `apps/backend-api/src/websocket/station-gateway.ts:200`, `apps/backend-api/src/websocket/worker-gateway.ts:149`.
- Worker gọi broadcast SYNC_STATUS_CHANGED không truyền scope. Gateway chỉ lọc khi scope có giá trị, nên videoId và syncStatus được gửi cho mọi client, kể cả doanh nghiệp khác và client đăng ký trạm khác.
- broadcastSessionState cũng tiếp tục gửi nếu tra cứu phạm vi trạm thất bại và details không có phạm vi.
- Sửa: bắt buộc scope cho sự kiện tài nguyên, bỏ gửi khi không xác định được phạm vi; cập nhật toàn bộ caller, gồm sự kiện đồng bộ video.
- Tái hiện độc lập trên module dist mới biên dịch với socket giả trong bộ nhớ: client tenant-b nhận SYNC_STATUS_CHANGED mang videoId video-tenant-a khi gọi đúng dạng broadcast của worker. Không truy cập hay sửa database.

## SH-R1-03 — P1: Nhân viên chưa gán kho có thể nhận sự kiện của các kho trong doanh nghiệp

- Vị trí: `apps/backend-api/src/main.ts:123`, `apps/backend-api/src/websocket/station-gateway.ts:220`.
- Kết nối có token nhưng bỏ cả stationId/stationCode sẽ bỏ qua kiểm tra quyền trạm. Với PACKING_USER hoặc WAREHOUSE_MANAGER có warehouseId null, điều kiện lọc kho cũng bị bỏ qua vì yêu cầu client.warehouseId phải có giá trị.
- Kết quả: tài khoản chưa được gán kho vẫn nhận SESSION_STATE_CHANGED có scope thuộc một kho trong doanh nghiệp.
- Sửa: từ chối vai trò vận hành thiếu kho tại handshake và tại bộ lọc broadcast. Nếu cho phép đăng ký toàn kho, vẫn phải kiểm tra kho và doanh nghiệp bắt buộc.
- Tái hiện độc lập trên gateway bằng socket giả PACKING_USER, warehouseId null, không đăng ký trạm: nhận sự kiện có businessId khớp và warehouseId của kho bất kỳ.

## Kiểm tra và giới hạn

- `corepack pnpm -r build`: PASS toàn bộ workspace; Vite cảnh báo bundle User Web lớn hơn 500 kB.
- Unit test từ dist vừa biên dịch: 10/10 PASS; lỗi barcode `123` trước đây đã được xử lý.
- Hai phép tái hiện gateway trong bộ nhớ đều xác nhận hành vi vượt phạm vi nói trên.
- Đã đọc code auth upload, handshake, gateway, hook WebSocket, caller worker và client mobile, validator cùng packet/test script liên quan.
- Không chạy lại script tích hợp có thao tác lên tài khoản/database hiện có; kết quả 22/22 và 31/31 trong packet là báo cáo của Anti, không phải kết quả xác minh độc lập ở lượt này.
- Chưa kiểm thử camera vật lý, giao diện trên thiết bị thật, mất mạng hoặc phục hồi sau mất điện.
