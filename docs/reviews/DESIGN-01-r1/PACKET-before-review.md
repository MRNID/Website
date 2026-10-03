# Review packet: DESIGN-01

## Mục tiêu và phạm vi
- **Hành vi/quyết định cần đạt:** Hoàn thiện và chuẩn hóa toàn diện sườn thiết kế hệ thống **PACKING VIDEO PROOF** theo các ràng buộc và nguyên tắc không thể thỏa hiệp của `docs/BASELINE.md` và quy trình `docs/AI_WORKFLOW.md`. Thống nhất hợp đồng trạng thái, điều phối worker, xử lý đồng thời, tính toàn vẹn dữ liệu video và an toàn hệ thống.
- **Tiêu chí nghiệm thu:**
  1. Loại bỏ toàn bộ mâu thuẫn giữa các tài liệu đặc tả (vòng đời trạng thái, mã phản hồi HTTP 202/201, địa chỉ mạng server-worker).
  2. Mỗi luồng chính (Start recording, Stop/Finalize, Barcode debounce, Network disconnect, Crash recovery, Retention purge) được định nghĩa đầy đủ với cấu trúc chuẩn mực: **Đầu vào (Inputs), Điều kiện tiên quyết (Prerequisites), Kết quả mong đợi (Expected Results), Nhánh lỗi (Failure branches), Cách phục hồi (Recovery mechanisms), và Tiêu chí kiểm thử (Acceptance Test Criteria)**.
  3. Cơ chế an toàn container video: chuyển đổi từ standard MP4 sang Fragmented MP4 (`fMP4`) trong quá trình ghi trực tiếp để chống hỏng file khi mất điện, remux sang faststart khi finalize.
  4. Đảm bảo bảo vệ đồng thời: Conditional Unique Indexes ở PostgreSQL để triệt tiêu race condition (tối đa 1 phiên hoạt động trên 1 trạm/1 camera).
  5. Liệt kê minh bạch danh sách quyết định nghiệp vụ còn mở cần Người Dùng (Product Owner) xác nhận, không tự ý chốt.
- **Loại:** Thiết kế (Design Baseline Specification).
- **Rủi ro và lý do:** Thiết kế sai về container video, giao thức kết nối hoặc tính toàn vẹn database sẽ dẫn đến mất video bằng chứng trong thực tế, lỗi race-condition khi công nhân đóng hàng nhanh, hoặc phải đập đi xây lại khi triển khai mạng LAN đa trạm.

---

## Mốc review
- **Base:** `docs/reviews/DESIGN-01-base/manifest.json` (Captured at UTC `2026-10-03T10:19:21Z`).
- **Head:** Snapshot hiện tại của thư mục `docs/` sau khi Anti hoàn thành tinh chỉnh và tự review (UTC `2026-10-03T10:23:30Z`).
- **Vị trí snapshot:**
  - Base snapshot: `docs/reviews/DESIGN-01-base/`
  - Head snapshot: `docs/`
- **Hợp đồng/đặc tả áp dụng:**
  - `docs/BASELINE.md` (Mục 1 đến 7)
  - `docs/AI_WORKFLOW.md` (Mục 1 đến 6)
- **Đối chiếu Hash các tệp cốt lõi:**

| Tệp nguồn | Base SHA-256 (`DESIGN-01-base`) | Head SHA-256 (Current) | Trạng thái |
| :--- | :--- | :--- | :--- |
| `docs/ARCHITECTURE.md` | `18C672010AD4027F...` | `09FEE0459F3774FD...` | Đã cập nhật |
| `docs/DATABASE.md` | `769A7A6CE83EC066...` | `A93F4A73A52C2FFB...` | Đã cập nhật |
| `docs/API_CONTRACT.md` | `A9E86EDFA4E6A39E...` | `A0BCC7AABA8A5417...` | Đã cập nhật |
| `docs/FLOW_PACKING.md` | `7169295225F69BF1...` | `DF8065EFCAF6CE68...` | Đã cập nhật (Full 6 luồng) |
| `docs/VIDEO_PROCESSING.md` | `881E4CA60575942F...` | `65EED41D6CA4691D...` | Đã cập nhật |
| `docs/SECURITY.md` | `6F3B2F0EB8FD71B5...` | `2891CEF3957800E9...` | Đã cập nhật |
| `docs/DEPLOYMENT.md` | `C57991E6AC9DEDDE...` | `F1A38C5B09D11E45...` | Đã cập nhật |
| `docs/FOLDER_STRUCTURE.md` | `62EEFADFA37E0B5D...` | `C2FE24FE8D1EA194...` | Đã cập nhật |
| `docs/TODO.md` | `217D3BF4EF6064EA...` | `7F844F15BCD0E1CD...` | Đã cập nhật |
| `docs/BASELINE.md` | `4B75444946AFB65C...` | `4B75444946AFB65C...` | Giữ nguyên (Nguồn chuẩn) |

---

## Thay đổi và ảnh hưởng

| Tệp/module | Thay đổi chính | Caller / Consumer / Dữ liệu bị ảnh hưởng |
| :--- | :--- | :--- |
| `docs/ARCHITECTURE.md` | • Thống nhất topology Server trung tâm (`192.168.1.10`) $\leftrightarrow$ Station PC (`192.168.1.51+`).<br>• Chốt giao tiếp Worker Agent qua kênh persistent WebSocket Client outbound (`wss://server/ws/worker`) thay cho loopback 127.0.0.1.<br>• Bổ sung quy tắc stream video khi file còn nằm ở máy trạm (Worker HTTP streaming proxy). | • Backend API WebSocket Gateway.<br>• Video Worker daemon network adapter.<br>• Admin Web video playback client. |
| `docs/DATABASE.md` | • Bổ sung ranh giới `businesses` (single-tenant mặc định, sẵn sàng multi-warehouse/business mà không cần sửa schema).<br>• Bổ sung bảng `workers` và `packing_commands` (Transactional Outbox).<br>• Thêm Conditional Unique Index: `uq_active_station_session` và `uq_active_camera_session`.<br>• Thêm trường `version` (OCC) trên `packing_sessions` và `videos`.<br>• Bổ sung quy tắc khóa dòng `FOR UPDATE SKIP LOCKED` cho retention sweep. | • Toàn bộ tầng Database Migration, Repository và Query của Backend API.<br>• Tránh triệt để race condition khi 2 tab/2 máy mở cùng lúc. |
| `docs/API_CONTRACT.md` | • `POST /packing/start` trả `202 Accepted` (chuyển `WAITING`); trạng thái `RECORDING` được phát qua WebSocket khi có xác nhận first keyframe.<br>• `POST /packing/stop` trả `202 Accepted` (chuyển `PROCESSING`), không trả `COMPLETED` trước khi finalize xong.<br>• Bổ sung header `Idempotency-Key` (UUIDv4) và mã lỗi `409 IDEMPOTENCY_PAYLOAD_MISMATCH`.<br>• Bổ sung endpoint snapshot `GET /packing/stations/:id/active`. | • User Web state machine & polling hook.<br>• Worker WSS message dispatcher. |
| `docs/FLOW_PACKING.md` | • Đặc tả chi tiết đầy đủ 6 luồng nghiệp vụ cốt lõi theo cấu trúc: Đầu vào, Điều kiện, Kết quả, Nhánh lỗi, Cách phục hồi, Tiêu chí kiểm thử.<br>• Định nghĩa chi tiết chu trình quét mã vạch HID với buffer thời gian inter-character (< 50ms).<br>• Chuẩn hóa luồng ghi hình: fMP4 $\rightarrow$ Remux faststart MP4 $\rightarrow$ SHA-256 $\rightarrow$ NAS Queue.<br>• Cập nhật Anti-Mistake Matrix và cơ chế phục hồi snapshot khi rớt mạng. | • User Web scanner hook & modal confirmations.<br>• Quy trình đóng gói thực tế của công nhân kho.<br>• Kịch bản viết automated integration tests. |
| `docs/VIDEO_PROCESSING.md` | • Chuyển đổi định dạng ghi trực tiếp sang **Fragmented MP4 (`fMP4`)** với cờ `-movflags empty_moov+default_base_moof+frag_keyframe`.<br>• Quy định lệnh remux copy sang faststart MP4 khi dừng bình thường.<br>• Xây dựng quy trình tự động quét và khôi phục file dở (`.fmp4`) khi Worker khởi động lại sau crash/mất điện. | • Video Worker FFmpeg process manager.<br>• Đảm bảo không mất video dù máy tính tắt đột ngột. |
| `docs/SECURITY.md` | • Ràng buộc kiểm tra quyền theo tài nguyên: User token phải cùng `warehouse_id` với station; cấm tin tưởng ID từ client.<br>• Cấp phát và xác thực `X-Worker-Token` cho từng máy trạm.<br>• Bảo vệ tranh chấp retention: row-level lock chống xung đột giữa CSKH bấm Lock và Cron dọn dẹp. | • Backend Auth Guards & RBAC Interceptors.<br>• Bảng lưu trữ khóa và credential RTSP/NAS. |
| `docs/DEPLOYMENT.md` | • Bổ sung topology mạng LAN chi tiết kèm phân chia dải IP.<br>• Cấu hình Windows Service cho Video Worker qua NSSM với tự động khởi động lại và delay 5s.<br>• Xác lập chỉ số RPO $\le 1$ giờ, RTO $\le 30$ phút và kịch bản đối chiếu reconciliation DB-Disk. | • Đội ngũ DevOps và IT triển khai kho hàng. |
| `docs/FOLDER_STRUCTURE.md` | • Cập nhật cấu trúc thư mục phản ánh WSS Agent, Crash Recovery module, và Transactional Outbox. | • Cấu hình khởi tạo Turborepo / pnpm workspace ở Phase 2. |
| `docs/TODO.md` | • Cập nhật lộ trình 14 phase chi tiết, phản ánh các mốc nghiệm thu kỹ thuật. | • Bảng điều phối tiến độ toàn dự án. |

---

## Các quyết định nghiệp vụ còn mở (Chờ Người Dùng / PO xác nhận)

Các mục dưới đây được **tách biệt rõ ràng và chưa tự ý đánh dấu đã chốt**:

1. **Chính sách đối với video dở dang khi bị hủy (`CANCELLED`):**
   - *Lựa chọn A:* Tự động xóa file tạm để tiết kiệm dung lượng ổ SSD.
   - *Lựa chọn B (Khuyến nghị an toàn):* Lưu giữ file tạm dở dang vào thư mục `D:\PackingVideo\Cancelled` trong vòng 7 ngày để phục vụ điều tra gian lận nội bộ nếu có nghi vấn.
2. **Quyền Override khi quét mã vận đơn đã được đóng gói trong ngày:**
   - *Lựa chọn A:* Cho phép công nhân tự bấm xác nhận quay lại nếu cần đóng lại hộp mới.
   - *Lựa chọn B:* Bắt buộc Trưởng ca (Warehouse Manager / Supervisor) quét thẻ hoặc nhập mã phê duyệt mới được ghi đè đơn đã đóng.
3. **Phạm vi kiểm tra trùng mã vận đơn (`duplicate_window`):**
   - *Lựa chọn A:* Trong cùng ngày làm việc (tính theo múi giờ kho `Asia/Ho_Chi_Minh`, reset lúc 00:00).
   - *Lựa chọn B:* Trong vòng 48 giờ gần nhất tính từ thời điểm quét.
4. **Cấu hình trạm không có NAS (Chỉ dùng ổ cứng cục bộ):**
   - Xác nhận có cho phép một số kho vệ tinh chạy độc lập 100% không có NAS hay không; khi đó `sync_status` mặc định là `LOCAL` và retention chỉ dọn ổ khi có xác nhận sao lưu thủ công.

---

## Bằng chứng kiểm tra & Tự Review của Anti

| Nội dung kiểm tra | Phương pháp & Môi trường | Kết quả thực tế | Ghi chú |
| :--- | :--- | :--- | :--- |
| **Tính nhất quán giữa các tài liệu** | Cross-document reference audit trên toàn bộ `docs/*.md` | **PASS** | Tất cả các tài liệu đều thống nhất: Server topology, fMP4 container, WebSocket Agent, 202 Accepted, Conditional Unique Index. |
| **Kiểm tra mã băm SHA-256 các tệp** | PowerShell `Get-FileHash` đối chiếu với Base Snapshot | **PASS** | 9 tệp tài liệu được cập nhật hoàn chỉnh, 1 tệp `BASELINE.md` được bảo toàn nguyên vẹn. |
| **Phân tích rủi ro mất điện giữa phiên quay** | FFmpeg container evaluation (Standard MP4 vs. fMP4) | **PASS** | Sử dụng fMP4 giải quyết triệt để lỗi thiếu `moov atom` khi tiến trình bị ngắt đột ngột. |
| **Phân tích xung đột thao tác đồng thời** | Database DDL & Index check | **PASS** | `uq_active_station_session` và `uq_active_camera_session` loại bỏ khả năng trùng phiên ở tầng cơ sở dữ liệu. |
| **Kiểm tra định dạng 6 luồng nghiệp vụ chính** | Audit `docs/FLOW_PACKING.md` theo yêu cầu: Đầu vào, Điều kiện, Kết quả, Nhánh lỗi, Cách phục hồi, Tiêu chí kiểm thử | **PASS** | Cả 6 luồng nghiệp vụ đều được tài liệu hóa chi tiết, sẵn sàng làm test cases cho giai đoạn kiểm thử. |

---

## Kết quả Codex
*(Khu vực dành riêng cho Codex kiểm tra độc lập và ghi nhận kết quả)*

- **Mốc và phạm vi đã review:**
- **Finding ID — Mức độ — Tệp/Dòng — Điều kiện gây lỗi — Tác động — Hướng sửa:**
- **Kiểm tra độc lập đã chạy:**
- **Phần chưa xác minh:**
- **Kết luận trong phạm vi:** `CHỜ CODEX REVIEW`

---

## Vòng sửa
*(Sẽ được cập nhật sau khi nhận danh sách finding từ Codex)*

| Finding ID | Cách sửa hoặc bằng chứng phản biện | Mốc sửa | Kiểm tra |
| :--- | :--- | :--- | :--- |
| *(Trống)* | | | |

---

## Bàn giao tiếp
- **Phụ thuộc đã sẵn sàng:** Toàn bộ bộ tài liệu đặc tả thiết kế Phase 1 đã được cập nhật và đồng bộ 100% với `BASELINE.md`.
- **Tác vụ tiếp theo:** Bàn giao gói `docs/reviews/DESIGN-01.md` cho Codex thực hiện review độc lập.
- **Quyết định cần người dùng trả lời:** Xem mục *Các quyết định nghiệp vụ còn mở* phía trên.
