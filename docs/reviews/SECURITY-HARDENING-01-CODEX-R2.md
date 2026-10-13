# SECURITY-HARDENING-01 — Codex review R2

Ngày: 2026-10-08. Review working tree trên HEAD `6c9f9f5bf273076a62769fd9e1cf88ab69604b2d`.

Kết quả: **CẦN SỬA**, còn phần chọn trạm của SH-R1-01. Không sửa implementation.

## Đối chiếu R1

- SH-R1-01: Đã gửi Authorization và bỏ userId/warehouseId giả định trong upload. Chọn trạm còn lỗi khi props tải bất đồng bộ, chi tiết bên dưới.
- SH-R1-02: Đã chặn broadcast thiếu businessId, bỏ gửi khi không resolve được business scope của trạm; caller SYNC_STATUS_CHANGED đã truyền businessId/warehouseId/stationId.
- SH-R1-03: Đã chặn vai trò vận hành thiếu warehouseId cả tại handshake và bộ lọc broadcast.

## SH-R1-01 (tiếp) — P2: Mobile giữ PACK01 sau khi tải xong danh sách trạm

- Vị trí: `apps/user-web/src/components/MobilePackingWorkbench.tsx:37`, `:277`, `:352`; caller `apps/user-web/src/App.tsx:483`.
- App mặc định mở mobile ở màn hình hẹp hoặc URL có mobile. Lần render đầu, stations là mảng rỗng và currentStation là null; MobilePackingWorkbench được mount ngay, nên activeStationCode khởi tạo thành PACK01.
- initApp tải người dùng/trạm bất đồng bộ rồi cập nhật props, nhưng useState không khởi tạo lại khi props đổi. Component không có logic đồng bộ activeStationCode với danh sách trạm mới.
- Tình huống: mở mới/reload mobile với tài khoản đã đăng nhập, có đúng một trạm PACK02 (hoặc mã bất kỳ khác PACK01). Khi API trả trạm, giao diện vẫn giữ PACK01 và upload gửi PACK01. Nếu trạm đó ngoài phạm vi hoặc không tồn tại, server trả 403/404. Nếu người dùng có quyền với PACK01 nhưng trạm được chọn ban đầu khác, video có thể gắn sai trạm.
- Với đúng một trạm, giao diện chỉ hiển thị chữ thay vì select, nên không thể chọn lại trạm đúng trong mobile.
- Sửa: không dùng mã trạm giả định; chỉ cho quay/upload khi đã có trạm hợp lệ. Khi danh sách tải xong hoặc thay đổi, giữ lựa chọn hiện tại nếu còn hợp lệ, nếu không thì chọn trạm hiện tại hợp lệ hoặc trạm đầu tiên được phép. Tránh đổi trạm giữa phiên quay/upload.
- Kiểm thử cần bổ sung: mount mobile với stations=[], sau đó cập nhật thành một trạm có mã khác PACK01; xác nhận mã hiển thị và multipart stationCode đều đúng. Thử cả danh sách rỗng/lỗi tải và nhiều trạm. Các test 4.1/4.2 hiện tự truyền stationCode vào HTTP helper, không chạy component nên chưa bắt được lỗi này.
- Phát hiện dựa trên code và vòng đời state/props; chưa chạy giao diện trên thiết bị thật.

## Kiểm tra độc lập

- `corepack pnpm -r build`: PASS toàn bộ workspace; còn cảnh báo bundle User Web lớn hơn 500 kB.
- Unit test shared-utils: 10/10 PASS.
- Gateway từ dist vừa biên dịch, socket giả trong bộ nhớ: chặn thiếu scope, thiếu businessId, khác doanh nghiệp, thiếu kho, khác kho, khác trạm; gửi được cho đúng client; bỏ sự kiện session khi không resolve được trạm. Tất cả assertion PASS, không sửa database.
- Đã đọc handshake để xác nhận guard thiếu kho chạy trước nhánh stationId/stationCode tùy chọn.
- Không chạy lại suite tích hợp có thao tác lên database/tài khoản hiện có. 30/30 trong packet là kết quả Anti báo cáo.
- Phạm vi review giới hạn vào ba finding R1 và caller liên quan. Chưa xác minh camera, thiết bị mobile thực, mất mạng/mất điện; không kết luận toàn hệ thống đã sẵn sàng production.
