# SECURITY-HARDENING-01 — Codex review R3

Ngày: 2026-10-08. Working tree trên HEAD `6c9f9f5bf273076a62769fd9e1cf88ab69604b2d`.

Kết quả: **KHÔNG PHÁT HIỆN LỖI CHẶN TRONG PHẠM VI** lỗi khởi tạo/chọn trạm mobile được nêu ở R2.

## Đối chiếu

- SH-R1-01 (phần R2): đã bỏ fallback PACK01, đồng bộ state khi props trạm tải bất đồng bộ qua useEffect; nút bắt đầu và native capture bị khóa khi chưa có trạm hợp lệ. Multipart dùng activeStationCode và gửi Bearer token.
- Giữ lựa chọn còn hợp lệ; chặn đổi trạm bằng setter/dropdown khi recording/uploading.
- SH-R1-02 và SH-R1-03: đã xử lý theo review R2; lượt này không audit lại toàn bộ WebSocket.

## Bằng chứng độc lập

- `corepack pnpm -r build`: PASS toàn bộ workspace; còn cảnh báo kích thước bundle User Web >500 kB.
- `node --test packages/shared-utils/dist/barcode-validator.test.js packages/shared-utils/dist/station-sync.test.js`: 15/15 PASS từ bản biên dịch mới.
- Chạy trực tiếp mã nguồn hook useMobileStationSync sau transpile trong VM, mô phỏng useState/useEffect/useCallback: ban đầu danh sách rỗng; tải một trạm PACK02; chọn thủ công; giữ lựa chọn; khóa khi quay; thay thế trạm bị loại; danh sách rỗng không có stationCode. Các assertion PASS. Đây là kiểm tra mô phỏng, không phải React DOM/browser hoặc camera thật.
- Đọc caller App, hook và các điểm chọn trạm, bắt đầu quay, upload trong MobilePackingWorkbench.
- Không thấy tiến trình node -e truy vấn packages/database còn tồn tại ở thời điểm kiểm tra; không khẳng định mọi script đã được bổ sung đóng pool.

## Ghi chú không chặn

- computeNextStationCode đang được định nghĩa hai nơi: shared-utils/station-sync.ts và hook useMobileStationSync.ts. Unit test trong repository kiểm tra bản shared-utils; nên để hook import cùng một hàm để tránh test và production lệch nhau. Lượt này đã kiểm tra thêm bản hook thực tế bằng mô phỏng.
- Không chạy lại các script tích hợp sửa database/tài khoản. Bằng chứng integration trong packet là của Anti.
- Chưa kiểm chứng DOM thực, camera/native capture trên điện thoại, mạng HTTPS, mất mạng/mất điện. Kết quả chỉ đóng finding R2, không chứng nhận toàn hệ thống sẵn sàng production.
