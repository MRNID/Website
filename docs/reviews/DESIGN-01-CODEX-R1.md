# DESIGN-01 — Codex review vòng 1

Kết luận: **CẦN SỬA — chưa chuyển sang triển khai nghiệp vụ**.

Mốc review: snapshot `DESIGN-01-r1/manifest.json`, so với `DESIGN-01-base/manifest.json`. Xác minh 9 tài liệu thay đổi, BASELINE giữ nguyên; hash hiện tại khớp các prefix Anti ghi trong packet. Snapshot và diff từng tệp đã được giữ trong `DESIGN-01-r1/` để vòng sau chỉ review phần sửa.

Điểm đã cải thiện: start/stop trả 202; topology worker chủ động kết nối WSS; partial unique index cho trạm/camera; có phân biệt video local và bản NAS. Các điểm này chưa đủ chứng minh các luồng lỗi đã an toàn.

Các finding dưới đây là lỗi thiết kế qua đối chiếu tài liệu, không phải kết quả thử hệ thống đã triển khai. P1 chặn thiết kế nền tảng; P2 cần giải quyết trước triển khai module liên quan.

## D01-01 — P1: Timeout giải phóng phiên khi worker có thể vẫn đang quay

- Vị trí: `API_CONTRACT.md:117`, `FLOW_PACKING.md:111`, `ARCHITECTURE.md:114`, `DATABASE.md:403`.
- Tình huống: worker nhận START và bắt đầu ghi nhưng mất WSS trước khi gửi milestone. Backend hết 15 giây chuyển FAILED; partial index không còn giữ trạm/camera. Start mới được phép trong khi tiến trình cũ chưa xác nhận dừng. ARCHITECTURE còn dùng timeout 30 giây.
- Cần sửa: phân biệt timeout chưa rõ kết quả với lỗi camera đã xác nhận; giữ quyền chiếm trạm cho đến khi đối chiếu/dừng được tiến trình. Định nghĩa định danh lần chạy worker và cách từ chối lệnh/sự kiện cũ; CANCEL cũng chỉ giải phóng sau xác nhận dừng. Đồng bộ thời hạn giữa các tài liệu.
- Nghiệm thu thiết kế: trace START → worker quay → mất ACK → timeout → START mới phải bị chặn → worker nối lại và đối chiếu; không có hai tiến trình hoặc trạng thái lùi.

## D01-02 — P1: Outbox mới có tên bảng, chưa có hợp đồng thực thi và nhận kết quả bền vững

- Vị trí: `DATABASE.md:325`, `API_CONTRACT.md:209`, `API_CONTRACT.md:225`, `API_CONTRACT.md:234`, `FLOW_PACKING.md:62`.
- Tình huống: backend crash sau khi gửi START trước khi nhận ACK sẽ gửi lại; worker chưa được yêu cầu lưu command trước khi spawn. FINALIZE_SUCCESS thất lạc hoặc đến lại chưa có event ID, ACK sau commit, journal và quy tắc dedup. Có thể quay hai lần, mất metadata hoặc kẹt PROCESSING. Cột version tự nó chưa quy định sự kiện nào hợp lệ.
- Cần sửa: giao dịch session+outbox, cơ chế claim/retry/ACK; command journal tại worker, event journal và inbox/dedup tại backend; thứ tự commit/ACK; payload các lỗi/finalize/sync/recovery; ánh xạ videoId sau finalize; replay sau restart. Idempotency cần phạm vi user/business+route, fingerprint, lưu response và kiểm tra quyền trước replay.
- Nghiệm thu thiết kế: bảng xử lý crash trước/sau từng điểm commit, spawn, send, ACK; gửi lặp hoặc đảo thứ tự sự kiện vẫn có đúng một kết quả. Định nghĩa cách dừng an toàn phiên đang quay khi backend/DB mất kết nối.

## D01-03 — P1: Retention có thể xóa tệp rồi vẫn báo khóa tranh chấp thành công

- Vị trí: `DATABASE.md:434`, `FLOW_PACKING.md:234`, `FLOW_PACKING.md:244`.
- Tình huống: cron khóa dòng trước, xóa tệp; yêu cầu khóa của CSKH đợi transaction kết thúc rồi cập nhật is_locked=true. Thiết kế chưa yêu cầu từ chối khi đã xóa. Crash sau xóa nhưng trước commit cũng không khôi phục tệp bằng rollback DB. `purged_at` được flow sử dụng nhưng không có trong DDL.
- Cần sửa: trạng thái/ý định xóa bền vững, điểm quyết định thứ tự khóa-vs-xóa, kiểm tra và phản hồi khi đang xóa/đã xóa, ACK từ máy giữ tệp và đối chiếu sau crash. Phân biệt xóa local/NAS/metadata; dùng retention cấu hình thay vì 90 ngày cố định; giữ bản chưa sync và bản tranh chấp.
- Nghiệm thu thiết kế: cả hai thứ tự cron thắng/CSKH thắng, crash trước/sau thao tác tệp, NAS/worker không liên lạc được. Không có thông báo khóa thành công cho bằng chứng đã bị xóa.

## D01-04 — P1: Cam kết phục hồi toàn bộ video chưa có bằng chứng; finalize có thể ghi đè

- Vị trí: `VIDEO_PROCESSING.md:15`, `VIDEO_PROCESSING.md:63`, `FLOW_PACKING.md:220`, `API_CONTRACT.md:221`.
- Tài liệu hứa giữ đủ 42 giây khi mất điện và test đòi đúng 30 giây sau kill. Fragmentation hỗ trợ đọc tệp bị ngắt, nhưng không chứng minh mọi frame/buffer đã được lưu bền vững. Xem [FFmpeg: Fragmentation](https://ffmpeg.org/ffmpeg-formats.html#Fragmentation). Không coi review tài liệu là test mất điện PASS.
- Lệnh remux dùng `-y`, ghi trực tiếp tên final, tên mẫu không có session ID; replay/recovery hoặc đụng tên có thể ghi đè bằng chứng. Flow lại yêu cầu atomic move, nên hai tài liệu chưa thống nhất.
- Cần sửa: nêu giới hạn phục hồi và phần có thể mất; lưu partial với thông tin gián đoạn, không coi là đơn hoàn tất. Ghi final vào đường dẫn tạm riêng theo session, kiểm tra rồi publish không ghi đè; định nghĩa retry khi final đã tồn tại. Kiểm chứng muxer đầu ra cho đuôi `.fmp4` (chỉ định `-f mp4` rõ ràng trong thiết kế) khi có FFmpeg.
- Nghiệm thu thiết kế: crash giữa fragment, giữa remux, sau publish trước ACK; giữ được nguồn phục hồi, không ghi đè, không báo đủ thời lượng chưa kiểm chứng. Thử runtime để trạng thái CHƯA CHẠY nếu chưa thực hiện.

## D01-05 — P1: Các hợp đồng cần cho luồng tối thiểu còn thiếu hoặc bị xóa

- Vị trí: `API_CONTRACT.md:20`, `API_CONTRACT.md:151`, `FLOW_PACKING.md:218`, `DATABASE.md:314`; diff API so với base.
- `/packing/cancel` chỉ được nhắc tên, chưa có request/response/điều kiện/ACK. Chỉ có snapshot phiên active: nếu tab mất kết nối đến lúc phiên đã kết thúc, không có endpoint xác định kết quả session/operation đã nhận. `FAILED_WITH_PARTIAL_PROOF` chỉ xuất hiện trong recovery, không có trong state machine/schema quy ước.
- Diff còn xóa hợp đồng login/refresh, tìm video và dispute trong khi các luồng vẫn phụ thuộc. Chưa có schema SYNC_STATUS_CHANGED/WORKER_CRASH_RECOVERED hoặc lỗi finalize.
- Cần sửa: bổ sung bảng trạng thái/sự kiện chuẩn, endpoint truy vấn kết quả terminal, cancel và hợp đồng còn thiếu; giữ hoặc chỉ rõ tài liệu thay thế cho API bị loại bỏ. Partial proof phải được biểu diễn thống nhất, không đặt tên trạng thái riêng ở từng tài liệu.
- Nghiệm thu thiết kế: trace đăng nhập → start → refresh tab → stop/cancel → reconnect sau kết thúc → tra cứu/khóa video đều ánh xạ được đến hợp đồng cụ thể.

## D01-06 — P2: Phát video local vẫn phụ thuộc inbound port trái với topology mô tả

- Vị trí: `ARCHITECTURE.md:64`, `ARCHITECTURE.md:93`, `API_CONTRACT.md:264`, `DEPLOYMENT.md:18`.
- Thiết kế chọn outbound WSS để tránh inbound firewall/DHCP, nhưng playback gọi HTTP tới IP trạm:4005; sơ đồ lại ghi listener loopback. Deploy chưa có kênh server→worker này. Video chưa sync sẽ không xem được theo cấu hình mô tả.
- Cần sửa: chọn một phương án media transport rõ ràng (qua tunnel, hoặc LAN listener có route/firewall/auth tương ứng). Đặc tả token theo tài nguyên, Range, quyền, timeout và lỗi. Định nghĩa NAS đã SYNCED nhưng hiện offline có fallback local hay báo gì.
- Nghiệm thu thiết kế: truy cập local video từ máy admin khác trạm; đổi IP/ngắt NAS; yêu cầu video khác trạm bằng token sai phải bị từ chối.

## D01-07 — P1: Luồng NAS có thể công bố SYNCED chỉ sau kiểm tra dung lượng

- Vị trí: `FLOW_PACKING.md:185` đến bước cập nhật SYNCED, đối chiếu sequence tại dòng 71 và BASELINE quy tắc 7.
- Một tệp hỏng nhưng cùng dung lượng vượt qua các bước trong luồng chi tiết và được SYNCED; retention sau đó được phép xóa local. Sequence diagram nói kiểm tra hash, nhưng thuật toán chi tiết bỏ bước này.
- Cần sửa: hash bản NAS phải trùng hash đã niêm phong trước publish/SYNCED; quy định không ghi đè, xử lý file đích tồn tại và retry sau rename nhưng trước ACK. Queue phải bền vững qua restart, không chỉ backoff trong RAM.
- Nghiệm thu thiết kế: đổi một byte giữ nguyên dung lượng, copy đứt giữa chừng, restart sau rename; không báo SYNCED cho bản sai và không mất local.

## D01-08 — P2: Phạm vi business/kho chưa thống nhất với schema và quyền

- Vị trí: `DATABASE.md:236`, `DATABASE.md:296`, `DATABASE.md:308`, `SECURITY.md:12`, `API_CONTRACT.md:17`.
- Thêm businesses nhưng chưa chốt phạm vi theo BASELINE. Các FK độc lập cho phép session chứa order, station, camera, user khác kho; users có thể gắn role/business/warehouse không cùng business mà chưa có quy tắc giao dịch hoặc constraint cấm. Tracking code unique toàn hệ thống trái với kiểm tra duplicate theo kho/thời gian. SUPER_ADMIN được ngoại lệ trong SECURITY nhưng bị quy tắc API từ chối nếu khác kho.
- Cần sửa: ghi quyết định phạm vi hoặc giữ rõ trạng thái chờ PO; định nghĩa tính nhất quán các liên kết bằng constraint/transaction validation, khóa duy nhất theo phạm vi đã chốt, quyền admin có giới hạn rõ. Không tuyên bố sẵn sàng multi-business chỉ vì thêm business_id.
- Nghiệm thu thiết kế: cùng mã ở hai kho theo policy; thử tham chiếu chéo kho/business; kiểm tra admin hợp lệ và tài khoản kho khác.

## D01-09 — P2: Quyền filesystem phá mục tiêu bảo toàn bằng chứng

- Vị trí: `DEPLOYMENT.md:35`, đối chiếu `SECURITY.md:39`.
- Lệnh cấp `Users:(OI)(CI)F` cho temp và archive cho phép người dùng Windows thông thường sửa/xóa video. Đây là vấn đề cũ còn được giữ lại trong bản deploy mới, chưa được gói thống nhất thiết kế giải quyết. Hash chỉ phát hiện thay đổi, không giữ được bản đã xóa.
- Cần sửa: tài khoản dịch vụ riêng, ACL tối thiểu, quyền đọc/phát qua dịch vụ; mô tả rõ giới hạn chống tài khoản quản trị máy. Đồng thời khôi phục đặc tả password hashing, bảo vệ credential và audit đã bị rút khỏi SECURITY hoặc dẫn đến nguồn thay thế cụ thể.
- Nghiệm thu thiết kế: operator không có quyền sửa/xóa trực tiếp archive; worker vẫn ghi/sync/phục hồi được bằng tài khoản dịch vụ.

## D01-10 — P2: Bằng chứng review và trạng thái roadmap đang ghi quá mức đã xác minh

- Vị trí: `DESIGN-01.md` mục Bằng chứng kiểm tra/Bàn giao tiếp; `TODO.md:10`; `DEPLOYMENT.md:55`.
- Packet ghi đồng bộ 100%, kiểm tra mất điện PASS, trong khi không có log thử FFmpeg/DB/camera và các mâu thuẫn trên vẫn tồn tại. Mục tiêu RPO/RTO chưa có diễn tập; đối chiếu DB khôi phục không mô tả cách khôi phục metadata của video sinh sau bản backup.
- Cần sửa: tách static review, test dự kiến và runtime đã chạy; sửa Phase 1 thành chờ xử lý findings/review. RPO/RTO là mục tiêu chờ xác minh. Định nghĩa journal/sidecar để đối chiếu cả orphan file và missing file mà không bịa lại metadata. Giữ quyết định nghiệp vụ còn mở, không tự đánh dấu được duyệt.
- Nghiệm thu: packet có mốc đầy đủ, bằng chứng hoặc CHƯA CHẠY; mọi finding có phản hồi, phần thiếu và điều kiện nghiệm thu rõ.

## Phạm vi xác minh và giới hạn

- Đã đối chiếu hash của 10 tài liệu; 9 thay đổi đúng khai báo. Đọc bản hiện tại và diff các hợp đồng liên quan; lưu diff từng tài liệu cho vòng sửa.
- Đã đối chiếu mô tả fragmentation với tài liệu chính thức FFmpeg. Không có FFmpeg trong PATH tại lượt review; chưa chạy thử camera, kill/mất điện, PostgreSQL migration, NAS hay Windows Service. Không yêu cầu cài thêm chỉ để gọi review thiết kế là PASS.
- Không sửa thiết kế thay Anti, không sửa code ứng dụng. Snapshot R1 chỉ là mốc review, không phải bản đã được duyệt.
- Các lỗi command NSSM/port TLS cần được kiểm chứng khi hoàn thiện DEPLOYMENT; ví dụ AppParameters phải giữ entrypoint Node và các biến môi trường phải được cấp riêng. Chưa chạy NSSM ở lượt này.

## Bàn giao Anti

Sửa D01-01…D01-10 theo thứ tự phụ thuộc, có thể gộp 01/02/05 thành hợp đồng điều phối và 03/04/07 thành hợp đồng lưu trữ. Ghi từng ID đã sửa, tệp và bằng chứng; nếu phản biện cần chỉ rõ trace hoặc constraint giải quyết tình huống. Dùng `DESIGN-01-r1/` làm base vòng sửa; giữ nguyên snapshot. Chưa mở rộng code hoặc dựng nghiệp vụ khi các finding P1 còn mở.
