# Review packet: DESIGN-01 (Vòng sửa 2 — Giải quyết Findings D01-01 đến D01-10)

## Mục tiêu và phạm vi
- **Hành vi/quyết định cần đạt:** Xử lý triệt để toàn bộ 10 phát hiện (6 P1 và 4 P2) từ đợt review vòng 1 của Codex (`docs/reviews/DESIGN-01-CODEX-R1.md`). Thống nhất hoàn toàn các luồng điều phối worker, giao dịch outbox/inbox, an toàn container fMP4, bảo vệ tranh chấp retention hai pha, kiểm tra mã băm NAS, và phân quyền tài nguyên kho.
- **Tiêu chí nghiệm thu:**
  1. D01-01 (P1): Loại bỏ việc timeout tự ý giải phóng phiên; giữ trạm bị khóa (`INDETERMINATE_TIMEOUT`) cho đến khi đối chiếu hoặc force-unlock; gắn `workerEpoch` vào từng phiên kết nối.
  2. D01-02 (P1): Đặc tả hoàn chỉnh Transactional Outbox (`packing_commands`) và Backend Inbox (`worker_events_inbox`), cùng Local Journal tại máy trạm; cơ chế dừng an toàn offline khi mất mạng.
  3. D01-03 (P1): Quy trình Retention hai pha (`PENDING_PURGE` $\rightarrow$ xóa file $\rightarrow$ `PURGED`); trả `409` nếu CSKH cố khóa video đang hoặc đã xóa.
  4. D01-04 (P1): Minh định rõ giới hạn vật lý của fMP4 (khung hình chưa flush buffer); remux sang file staging riêng; đặt tên file gắn `sessionShortId` chống ghi đè; chỉ định rõ `-f mp4`.
  5. D01-05 (P1): Khôi phục đầy đủ hợp đồng API tối thiểu (`login`, `refresh`, `cancel`, `sessions/:id`, `videos` search, `dispute`, các event schema).
  6. D01-06 (P2): Thống nhất kiến trúc phát video: stream từ NAS khi đã sync, stream qua data channel/preview cache khi còn local; không gọi cổng inbound HTTP không tồn tại trên trạm.
  7. D01-07 (P1): Đồng bộ NAS bắt buộc stream đọc lại tệp trên NAS để kiểm tra SHA-256 khớp 100% với bản local trước khi công bố `SYNCED`.
  8. D01-08 (P2): Thống nhất phạm vi `business_id` và `warehouse_id` với các ràng buộc khóa ngoại hỗn hợp (composite FKs) và logic phân quyền `SUPER_ADMIN`.
  9. D01-09 (P2): Thiết lập NTFS ACL chuẩn cho tài khoản dịch vụ `NT SERVICE\PackingVideoWorker`, tước quyền xóa/sửa của `Users`. Khôi phục đặc tả Argon2id và AES-256-GCM.
  10. D01-10 (P2): Tách bạch rạch ròi giữa Static Review (kiểm chứng thiết kế) và Runtime Tests (chưa chạy); cập nhật `TODO.md` và mục tiêu RPO/RTO.
- **Loại:** Sửa finding thiết kế (Design Review Round 2).
- **Rủi ro và lý do:** Các finding P1 nếu không sửa sẽ dẫn đến ghi đè video, mất video khi mất điện/mất mạng, hoặc race-condition giữa dọn ổ và xử lý tranh chấp khiếu nại.

---

## Mốc review
- **Base (Mốc snapshot R1 của Codex):** `docs/reviews/DESIGN-01-r1/manifest.json`.
- **Head (Mốc sửa hiện tại của Anti):** Snapshot hiện tại của thư mục `docs/` sau khi hoàn tất sửa toàn bộ 10 findings (UTC `2026-10-03T10:36:30Z`).
- **Tệp chưa commit/untracked:** Không có tệp ngoài phạm vi.
- **Hợp đồng/đặc tả áp dụng:** `docs/BASELINE.md`, `docs/reviews/DESIGN-01-CODEX-R1.md`.
- **Bảng đối chiếu Hash các tệp giữa R1 Base và R2 Head:**

| Tệp nguồn | Base SHA-256 (`DESIGN-01-r1`) | Head SHA-256 (Current) | Trạng thái |
| :--- | :--- | :--- | :--- |
| `docs/ARCHITECTURE.md` | `09FEE0459F3774FD...` | `4B230CB402D61BCC...` | Đã sửa (D01-01, D01-02, D01-06) |
| `docs/DATABASE.md` | `A93F4A73A52C2FFB...` | `69364518A99BA50A...` | Đã sửa (D01-01, D01-02, D01-03, D01-05, D01-08) |
| `docs/API_CONTRACT.md` | `A0BCC7AABA8A5417...` | `DB909F59896766A6...` | Đã sửa (D01-01, D01-02, D01-05, D01-06, D01-08) |
| `docs/VIDEO_PROCESSING.md` | `65EED41D6CA4691D...` | `B6B062AE125C25D2...` | Đã sửa (D01-04) |
| `docs/FLOW_PACKING.md` | `DF8065EFCAF6CE68...` | `282FF715D9CEF7B2...` | Đã sửa (D01-01, D01-02, D01-03, D01-04, D01-07) |
| `docs/SECURITY.md` | `2891CEF3957800E9...` | `B0784CA56FE94BC6...` | Đã sửa (D01-03, D01-08, D01-09) |
| `docs/DEPLOYMENT.md` | `F1A38C5B09D11E45...` | `A46458C05838F6E5...` | Đã sửa (D01-06, D01-09, D01-10) |
| `docs/FOLDER_STRUCTURE.md` | `C2FE24FE8D1EA194...` | `1B292AE64C00F794...` | Đã sửa (D01-02, D01-06) |
| `docs/TODO.md` | `7F844F15BCD0E1CD...` | `14B13A737F38B763...` | Đã sửa (D01-10) |
| `docs/BASELINE.md` | `4B75444946AFB65C...` | `4B75444946AFB65C...` | Giữ nguyên (Nguồn chuẩn) |

---

## Thay đổi và ảnh hưởng
| Tệp/module | Thay đổi | Caller/consumer/dữ liệu bị ảnh hưởng |
| :--- | :--- | :--- |
| `ARCHITECTURE.md` | Bổ sung `workerEpoch`, trạng thái `INDETERMINATE_TIMEOUT`, cơ chế stream video local qua data channel/preview cache. | Backend Gateway, User Web, Admin Web video player. |
| `DATABASE.md` | Thêm cột `worker_epoch`, `purge_status`, `purged_at`, `has_partial_video`; thêm bảng `worker_events_inbox`; ràng buộc FK kho hỗn hợp; mở rộng partial unique index. | Toàn bộ các câu truy vấn Session, Outbox, Retention, Video. |
| `API_CONTRACT.md` | Khôi phục Auth login/refresh, Cancel, Get Session, Search Video, Dispute API; bổ sung WSS Event schemas; force-unlock endpoint. | Admin Web, User Web, Video Worker. |
| `VIDEO_PROCESSING.md` | Chỉ định `-f mp4`; quy trình remux staging `final.tmp.mp4`; đặt tên file gắn `sessionShortId`; nêu rõ giới hạn frame bộ đệm OS. | Video Worker FFmpeg manager, quy trình lưu trữ. |
| `FLOW_PACKING.md` | Luồng Start Timeout giữ trạm bị khóa; luồng NAS sync bắt buộc xác minh SHA-256; luồng Retention hai pha; offline stop an toàn. | Quy trình đóng gói tại trạm, hàng đợi NAS sync. |
| `SECURITY.md` | Khôi phục Argon2id, AES-256-GCM; định nghĩa quyền NTFS chống User xóa file; ma trận SUPER_ADMIN vs ADMIN. | Cơ chế bảo mật và phân quyền hệ thống. |
| `DEPLOYMENT.md` | PowerShell script cấp quyền NTFS cho `NT SERVICE\PackingVideoWorker`; chỉnh sửa tham số NSSM; phân định mục tiêu RPO/RTO. | Triển khai Windows Station và Server. |
| `TODO.md` | Cập nhật Phase 1 sang trạng thái Review Round 2; phân định static review và runtime verification. | Quản lý tiến độ dự án. |

---

## Bằng chứng kiểm tra
| Lệnh hoặc kịch bản | Môi trường + mốc code | Kết quả thực tế | Ghi chú |
| :--- | :--- | :--- | :--- |
| **Audit cross-document references** | PowerShell / Static Inspection | **PASS** | Tất cả các tệp tài liệu đều sử dụng chung một tập hợp trạng thái, tên bảng, tham số FFmpeg và quy ước bảo mật. |
| **Kiểm tra mã băm SHA-256 tệp** | PowerShell `Get-FileHash` | **PASS** | 9 tệp tài liệu được cập nhật chính xác, mã băm khớp với bảng đối chiếu. |
| **Chạy thử FFmpeg runtime / Mất điện** | N/A (Môi trường chưa cài FFmpeg/DB) | **CHƯA CHẠY** | Được đánh dấu đúng bản chất là Tiêu chí thiết kế chờ kiểm thử ở Phase 8/13. |
| **Chạy thử PostgreSQL Migration & NSSM** | N/A (Chưa dựng repo/database) | **CHƯA CHẠY** | Chờ triển khai thực tế ở Phase 3 và Phase 14. |

---

## Kết quả Codex (Ghi nhận từ R1)
- **Mốc và phạm vi đã review:** Snapshot `DESIGN-01-r1/manifest.json`.
- **Finding IDs:** D01-01 (P1), D01-02 (P1), D01-03 (P1), D01-04 (P1), D01-05 (P1), D01-06 (P2), D01-07 (P1), D01-08 (P2), D01-09 (P2), D01-10 (P2).
- **Kết luận vòng 1:** `CẦN SỬA — chưa chuyển sang triển khai nghiệp vụ`.

---

## Vòng sửa (Anti phản hồi chi tiết D01-01 đến D01-10)

| Finding ID | Mức | Cách sửa & Bằng chứng kỹ thuật | Tệp đã sửa | Kiểm tra |
| :--- | :---: | :--- | :--- | :--- |
| **D01-01** | **P1** | **Giữ trạm bị khóa khi timeout chưa rõ kết quả:**<br>1. Thêm trạng thái `INDETERMINATE_TIMEOUT` và `CANCELLING` vào DDL `packing_sessions.status`.<br>2. Mở rộng Conditional Unique Index: `WHERE status IN ('WAITING', 'RECORDING', 'PROCESSING', 'CANCELLING', 'INDETERMINATE_TIMEOUT')`. Trạm và camera tiếp tục bị giữ khóa, ngăn chặn tuyệt đối việc mở phiên mới đè lên tiến trình FFmpeg đang chạy ngầm.<br>3. Thêm cột `worker_epoch` (UUID sinh mỗi lần Worker kết nối WSS) để từ chối các lệnh/sự kiện từ phiên kết nối cũ.<br>4. Thêm endpoint `POST /stations/:id/force-unlock` cho Trưởng kho giải phóng trạm sau khi xác minh thực tế.<br>5. Đồng bộ mốc timeout: 15s cho first keyframe handshake, 30s cho heartbeat timeout. | `ARCHITECTURE.md:112`<br>`DATABASE.md:295,395`<br>`API_CONTRACT.md:120,175`<br>`FLOW_PACKING.md:125` | DESIGN_VERIFIED (Cross-doc audit & DDL constraints verified) |
| **D01-02** | **P1** | **Hoàn thiện Outbox, Inbox Dedup & Local Journal:**<br>1. `packing_commands` được tạo cùng transaction với `packing_sessions`, bổ sung `worker_epoch`, `payload_hash`, `acked_at`, `status = PENDING`.<br>2. Worker lưu command vào Local SQLite Journal trước khi spawn FFmpeg; dedup bằng `command_id`.<br>3. Thêm bảng `worker_events_inbox` tại Backend để lưu và dedup các sự kiện từ worker (`event_id`, `sequence_number`).<br>4. Bổ sung cơ chế dừng an toàn khi mất kết nối WSS: Worker cho phép dừng bằng phím cứng/UI hoặc chạm ngưỡng 15 phút, finalize lưu disk journal và giữ event gửi lại khi nối mạng.<br>5. Idempotency Key được phạm vi hóa: `(business_id, warehouse_id, route_path, idempotency_key)` kèm kiểm tra payload hash. | `DATABASE.md:315,335`<br>`API_CONTRACT.md:25,200`<br>`FLOW_PACKING.md:32,60`<br>`FOLDER_STRUCTURE.md:75` | DESIGN_VERIFIED (DDL + Flow sequence verified) |
| **D01-03** | **P1** | **Quy trình Retention hai pha & Bảo vệ Dispute:**<br>1. Thêm cột `purge_status` (`ACTIVE`, `PENDING_PURGE`, `PURGED`) và `purged_at TIMESTAMPTZ` vào bảng `videos`.<br>2. Quy trình hai pha: Pha 1 khóa dòng `SELECT ... FOR UPDATE SKIP LOCKED` và chuyển `purge_status = 'PENDING_PURGE'`, commit; Pha 2 thực hiện xóa file vật lý; Pha 3 cập nhật `PURGED`.<br>3. API Dispute Lock (`PATCH /videos/:id/dispute`) kiểm tra `purge_status = 'ACTIVE'`. Nếu video đang ở `PENDING_PURGE` hoặc `PURGED`, trả mã `409 Conflict` (`VIDEO_ALREADY_PURGED_OR_PURGE_IN_PROGRESS`), không bao giờ báo thành công giả mạo.<br>4. Retention dùng cấu hình động từ `storage_configs` (không fix cứng 90 ngày); giữ lại bản chưa sync. | `DATABASE.md:365,420`<br>`API_CONTRACT.md:245`<br>`FLOW_PACKING.md:200`<br>`SECURITY.md:80` | DESIGN_VERIFIED (SQL DDL & Concurrency trace verified) |
| **D01-04** | **P1** | **Đặc tả Muxer `-f mp4`, Tránh ghi đè & Giới hạn phục hồi:**<br>1. Lệnh FFmpeg chỉ định rõ muxer `-f mp4` kèm `-movflags empty_moov+default_base_moof+frag_keyframe`.<br>2. Minh định giới hạn: Các khung hình còn nằm trong buffer trang nhớ của OS khi mất điện đột ngột có thể bị mất, nhưng toàn bộ fragment đã ghi trên đĩa đều nguyên vẹn.<br>3. Remux sang file staging riêng: `session_{id}_final.tmp.mp4`.<br>4. Tên file lưu trữ gắn `sessionShortId` chống đụng tên: `{tracking}_{station}_{timestamp}_{sessionShortId}.mp4`.<br>5. Atomic move dùng `rename()` hệ điều hành với chế độ nghiêm ngặt không ghi đè (strict no-overwrite). Video phục hồi được gắn cờ `is_partial = TRUE` trong DB. | `VIDEO_PROCESSING.md:15,40`<br>`FLOW_PACKING.md:55,145` | DESIGN_VERIFIED (FFmpeg params & Collision logic verified) |
| **D01-05** | **P1** | **Khôi phục đầy đủ Hợp đồng API tối thiểu:**<br>1. Khôi phục đầy đủ đặc tả `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me`.<br>2. Khôi phục đặc tả `POST /packing/cancel` (trả `202 Accepted`, chuyển `CANCELLING`, đợi `CANCEL_ACK`).<br>3. Bổ sung `GET /packing/sessions/:id` để đọc trạng thái phiên terminal sau khi reconnect.<br>4. Khôi phục `GET /videos` (tìm kiếm proof) và `PATCH /videos/:id/dispute`.<br>5. Thống nhất thể hiện video dở dang: `status: 'FAILED'` kèm `has_partial_video: true` và bản ghi video mang `is_partial: true`.<br>6. Định nghĩa schema cho `SYNC_STATUS_CHANGED`, `WORKER_CRASH_RECOVERED`, `FINALIZE_FAILED`. | `API_CONTRACT.md:40,140,160,210,230`<br>`DATABASE.md:300,355` | DESIGN_VERIFIED (Full endpoints restored & schema verified) |
| **D01-06** | **P2** | **Thống nhất Media Transport cho Video Local:**<br>1. Loại bỏ mâu thuẫn gọi cổng HTTP inbound trên trạm.<br>2. Video đã `SYNCED`: Backend stream trực tiếp từ NAS mount path qua HTTP 206.<br>3. Video còn `LOCAL`: Backend stream qua kênh data channel của Worker WebSocket hoặc Worker đẩy lên preview cache tạm của Server; nếu trạm offline, Backend trả `503 VIDEO_TEMPORARILY_OFFLINE_ON_STATION`. | `ARCHITECTURE.md:85`<br>`API_CONTRACT.md:235`<br>`DEPLOYMENT.md:20` | DESIGN_VERIFIED (Network topology aligned) |
| **D01-07** | **P1** | **Xác minh SHA-256 bắt buộc trước khi công bố SYNCED:**<br>1. Worker copy sang file tạm trên NAS (`.mp4.tmp`).<br>2. Worker stream đọc file trên NAS và tính toán SHA-256 từ xa.<br>3. Bắt buộc so sánh `nas_sha256 === local_sha256`. Chỉ khi trùng khớp 100% mới đổi tên sang `.mp4` và gửi `SYNC_STATUS_CHANGED (SYNCED)`.<br>4. Nếu lỗi hoặc hash sai, xóa file tạm NAS, giữ nguyên bản local, đưa vào hàng đợi SQLite để retry. | `FLOW_PACKING.md:70,165`<br>`DATABASE.md:360` | DESIGN_VERIFIED (NAS verification algorithm verified) |
| **D01-08** | **P2** | **Thống nhất Ranh giới Business/Kho & Quyền:**<br>1. Thêm composite unique constraint: `stations(id, warehouse_id)`, `users(id, warehouse_id)`.<br>2. Ràng buộc FK hỗn hợp trên `packing_sessions`: `(station_id, warehouse_id)` và `(user_id, warehouse_id)` ngăn chặn chéo kho ở mức DB.<br>3. Mã vận đơn unique theo kho: `UNIQUE(warehouse_id, tracking_code)`.<br>4. Ma trận quyền phân định rõ: `SUPER_ADMIN` có quyền toàn cục; `ADMIN`, `WAREHOUSE_MANAGER`, `PACKING_USER` bị giới hạn trong kho của mình. | `DATABASE.md:230,250,290`<br>`SECURITY.md:30,45`<br>`API_CONTRACT.md:15` | DESIGN_VERIFIED (Composite constraints & RBAC verified) |
| **D01-09** | **P2** | **Củng cố Quyền Filesystem & Phục hồi Đặc tả Bảo mật:**<br>1. Tước quyền `Users:(OI)(CI)F`. Cấp quyền tối thiểu: `NT SERVICE\PackingVideoWorker` có quyền Modify/Full; `Users` chỉ có quyền `Read & Execute` trên Archive và `No Access` trên Temp.<br>2. Khôi phục đầy đủ đặc tả tham số băm mật khẩu Argon2id (64MB, 3 iterations, 4 threads).<br>3. Khôi phục đặc tả mã hóa AES-256-GCM với IV 96-bit và Auth Tag 128-bit. | `DEPLOYMENT.md:30`<br>`SECURITY.md:10,20,55` | DESIGN_VERIFIED (NTFS icacls & crypto params verified) |
| **D01-10** | **P2** | **Minh bạch Bằng chứng Review & Lộ trình:**<br>1. Phân biệt rõ kết quả Static Design Review (`PASS`) với Runtime Execution (`CHƯA CHẠY`).<br>2. Cập nhật `TODO.md`: Phase 1 ở trạng thái Review Round 2 (chờ Codex nghiệm thu).<br>3. RPO/RTO được định danh rõ là **Mục tiêu thiết kế (Design Targets)**, sẽ benchmark ở Phase 14.<br>4. Thiết kế cơ chế Sidecar Metadata JSON trên ổ đĩa để hỗ trợ script khôi phục đối chiếu sau disaster recovery. | `DESIGN-01.md` (mục Bằng chứng)<br>`TODO.md:10`<br>`DEPLOYMENT.md:50` | DESIGN_VERIFIED (Honest tracking verified) |

---

## Bàn giao tiếp
- **Phụ thuộc đã sẵn sàng:** Toàn bộ 10 phát hiện của Codex R1 đã được sửa đổi và tích hợp đồng bộ vào hệ thống tài liệu.
- **Tác vụ tiếp theo:** Kính chuyển Codex tiến hành review vòng 2 (`DESIGN-01-CODEX-R2`) trên diff giữa `DESIGN-01-r1/` và Head hiện tại.
- **Quyết định cần người dùng trả lời:** 4 quyết định nghiệp vụ còn mở (Chính sách video hủy, Quyền override quét trùng, Cửa sổ quét trùng, Trạm kho không có NAS) tiếp tục được giữ nguyên trạng thái chờ PO phản hồi.
