# Sườn triển khai Packing Video Proof

Trạng thái: bản thiết kế để rà soát, chưa phải hệ thống đã triển khai hoặc đã nghiệm thu.

Mục tiêu: làm rõ phạm vi, trách nhiệm, dữ liệu và cách phục hồi trước khi viết chức năng. Tài liệu này là điểm vào để xử lý các chỗ chưa thống nhất trong bộ thiết kế; các mục còn mở bên dưới phải được giải quyết trước giai đoạn phụ thuộc.

## 1. Phạm vi và hiện trạng

- Sản phẩm mục tiêu: quét mã đơn → quay đóng gói → lưu video tại máy trạm → đồng bộ NAS → tra cứu bằng chứng.
- Code Express, admin HTML và SQL Server ở thư mục gốc là demo cũ, không phải phần triển khai của kiến trúc mới.
- Sườn đang dùng giả định một doanh nghiệp, nhiều kho. Nếu cần nhiều doanh nghiệp dùng chung hệ thống, phải bổ sung ranh giới tenant vào dữ liệu và phân quyền trước khi làm migration.
- Mất internet không được ảnh hưởng quy trình trong LAN. Mất LAN, backend hoặc database là các tình huống riêng, không mặc định được phép bắt đầu đơn mới.
- Bản đầu ưu tiên một camera cho mỗi phiên quay. Nhiều camera, tích hợp sàn và chỉnh sửa video nằm ngoài luồng tối thiểu.

## 2. Ranh giới các thành phần

| Thành phần | Trách nhiệm | Ranh giới |
| --- | --- | --- |
| Admin web | Cấu hình, tra cứu, phân quyền, theo dõi lỗi | Không truy cập database hoặc đường dẫn ổ đĩa trực tiếp |
| User web | Quét mã, yêu cầu bắt đầu/dừng, hiển thị trạng thái | Không quyết định phiên đã quay hay đã hoàn tất bằng trạng thái trong trình duyệt |
| Backend API | Quyền truy cập, điều phối phiên, dữ liệu nghiệp vụ, audit | Không chạy FFmpeg; chỉ xác nhận kết quả đã đối chiếu với worker |
| Video worker | Camera, FFmpeg, tệp local, nhật ký bền vững, hàng đợi NAS | Chỉ nhận công việc cho trạm được cấp; không tự đổi quyền hoặc đơn hàng |
| PostgreSQL | Nguồn trạng thái nghiệp vụ trung tâm | Giao dịch database không được coi là giao dịch nguyên tử với tệp hoặc worker |
| NAS | Bản sao video đã xác minh | NAS lỗi không được làm mất bản local đang chờ đồng bộ |

Hướng phụ thuộc: web → hợp đồng API; backend → nghiệp vụ → database/worker adapter; worker → hợp đồng điều phối và media/storage adapter. Không import mã nội bộ giữa các ứng dụng. Shared UI không chứa nghiệp vụ; shared types không chứa secrets hoặc database client.

Stack dự kiến để thống nhất tài liệu: TypeScript, React/Vite, Fastify, PostgreSQL/Prisma, worker Node.js/FFmpeg; pnpm workspace. Phiên bản và lockfile được xác minh, chốt ở giai đoạn dựng repository. Không để hai lựa chọn ORM/framework song song trong hợp đồng triển khai cuối cùng.

## 3. Quy tắc không được phá vỡ

1. Mỗi trạm và camera chỉ có tối đa một phiên đang hoạt động. Backend phải bảo vệ bằng giao dịch và ràng buộc dữ liệu; debounce ở UI chỉ hỗ trợ thao tác.
2. Start/stop/cancel và sự kiện worker phải có mã chống xử lý trùng. Cùng mã và cùng nội dung trả lại kết quả cũ; cùng mã nhưng khác nội dung phải bị từ chối.
3. Backend lưu ý định và công việc cần gửi trong cùng giao dịch. Worker lưu nhận lệnh bền vững trước khi thực thi; retry không được tạo thêm tiến trình quay.
4. Chỉ hiển thị `RECORDING` sau khi worker xác nhận có dữ liệu video và tiến trình khỏe, không chỉ sau khi spawn có PID.
5. Chỉ chuyển `COMPLETED` khi tệp final đã được kiểm tra, có dung lượng/thời lượng/hash và metadata đã được ghi nhận. Thumbnail lỗi được xử lý riêng, không xóa video hợp lệ.
6. Worker lưu kết quả chưa được backend xác nhận để gửi lại sau khi kết nối phục hồi. Sự kiện lặp hoặc đến muộn không được làm trạng thái lùi về bước trước.
7. NAS copy vào tệp tạm, xác minh dung lượng/hash rồi mới công bố bản đích và trạng thái `SYNCED`. Không ghi đè bằng chứng có sẵn.
8. Chưa đồng bộ xong hoặc đang khóa tranh chấp thì không được tự xóa bản local. Tác vụ xóa và thao tác khóa phải có cơ chế phối hợp tránh chạy đua.
9. Mọi API, sự kiện worker và thao tác đọc video phải kiểm tra quyền theo tài nguyên. ID trạm trong URL/localStorage không phải bằng chứng được cấp quyền.
10. Không hứa phục hồi đầy đủ sau mọi lần mất điện. Giữ tệp dở và báo trạng thái rõ; chỉ công nhận bằng chứng phục hồi sau khi kiểm tra thực tế.

## 4. Vòng đời phiên và phản hồi API

Luồng mục tiêu: `WAITING → RECORDING → PROCESSING → COMPLETED`. Lỗi được ghi thành `FAILED` cùng nguyên nhân và tham chiếu tệp còn giữ. Hủy chuyển sang `CANCELLED` sau khi worker xác nhận đã ngừng ghi; chính sách giữ tệp hủy cần chốt riêng.

- Start trả `202` với session/operation ID khi mới nhận lệnh; `201` kèm `RECORDING` chỉ khi đã có xác nhận worker.
- Stop trả `202` trong khi finalize còn chạy; không trả `COMPLETED` chỉ vì đã gửi lệnh dừng.
- Có endpoint đọc lại trạng thái phiên/operation. WebSocket chỉ thông báo thay đổi; khi nối lại, UI tải snapshot từ API.
- Timeout nghĩa là chưa biết kết quả. Client truy vấn hoặc gửi lại cùng mã chống trùng, không tạo một phiên khác.
- Worker mất heartbeat không tự động chứng minh camera đã dừng. Trạm bị chặn phiên mới đến khi đối chiếu được phiên/tiến trình cũ.
- Thời gian lưu theo UTC; ngày nghiệp vụ tính theo múi giờ kho. Tên tệp chứa session ID để tránh đụng tên.

## 5. Những hợp đồng phải hoàn thiện trước khi code nghiệp vụ

| Hạng mục | Tài liệu cần cập nhật | Điều kiện hoàn tất |
| --- | --- | --- |
| Phạm vi doanh nghiệp/kho | DATABASE, SECURITY | Chốt single-business hay multi-tenant; tất cả tài nguyên có đường xác định phạm vi quyền |
| Điều phối worker | API_CONTRACT, DEPLOYMENT | Chốt kênh backend ↔ máy trạm, định danh/cấp quyền worker, retry, timeout và chống sự kiện cũ |
| Lệnh và sự kiện | API_CONTRACT | Có schema cho start/stop/cancel/status/finalize/sync/heartbeat; mã lỗi và idempotency rõ ràng |
| Dữ liệu phục hồi | DATABASE | Có worker identity, command/outbox, event deduplication, phiên bản trạng thái và ràng buộc phiên hoạt động |
| Tệp sau crash | VIDEO_PROCESSING | Chốt định dạng ghi tạm và cách kiểm tra/phục hồi bằng thử nghiệm; không xem lệnh sửa MP4 là bảo đảm |
| Xem video local | API_CONTRACT, DEPLOYMENT | Backend ở server phải đọc video từ worker hoặc NAS qua kênh có xác thực; không coi ổ D: máy trạm là ổ server |
| Retention và tranh chấp | DATABASE, SECURITY | Phân biệt xóa bản local, bản NAS và metadata; xác định trường hợp không cấu hình NAS và tranh chấp đã giải quyết |
| Quét mã và quay lại | FLOW_PACKING | Chốt phạm vi trùng mã, quyền override, mã hãng vận chuyển bằng dữ liệu mẫu thực tế |
| Backup/restore | DEPLOYMENT | Có phục hồi database, metadata, khóa mã hóa và đối chiếu tệp; ghi rõ mục tiêu mất dữ liệu/thời gian phục hồi |

Lưu ý đối chiếu: loopback `127.0.0.1` chỉ dùng cho các tiến trình trên cùng máy; topology server riêng và worker tại trạm cần hợp đồng mạng tương ứng. Các ví dụ SQL, FFmpeg, quyền thư mục và Docker hiện có là bản nháp, chưa phải cấu hình triển khai đã kiểm chứng.

## 6. Thứ tự xây dựng và điểm kiểm tra

| Giai đoạn | Đầu ra | Điều kiện chuyển bước |
| --- | --- | --- |
| A. Chốt thiết kế | Phạm vi, sơ đồ, state machine, API, schema, ma trận quyền thống nhất | Giải quyết các mục mở ảnh hưởng bước tiếp theo; ghi quyết định và lý do |
| B. Dựng sườn repository | apps/packages, cấu hình build/typecheck/lint, env mẫu, CI | Các package build độc lập, kiểm tra dependency, không dùng auth demo làm nền |
| C. Luồng tối thiểu trên một trạm | Đăng nhập → start → stop → lưu → tra cứu video | Kiểm chứng với camera và ổ đĩa thực tế trước khi mở rộng màn hình quản trị |
| D. Chịu lỗi và phục hồi | Retry, journal, đối chiếu trạng thái, NAS queue | Vượt ma trận lỗi bên dưới, không tạo phiên trùng hoặc báo thành công sai |
| E. Mở rộng và vận hành | Nhiều trạm, quản trị, giám sát, retention, backup | Kiểm tra tải theo số trạm mục tiêu và diễn tập restore trước khi dùng thật |

Không đợi hoàn thiện toàn bộ giao diện mới thử camera, mất kết nối và phục hồi. Không coi việc đã viết tài liệu là đã nghiệm thu kiến trúc.

## 7. Ma trận nghiệm thu bắt buộc cho luồng tối thiểu

| Tình huống | Kết quả cần chứng minh |
| --- | --- |
| Hai tab bắt đầu cùng một trạm | Chỉ một phiên và một tiến trình ghi được chấp nhận |
| Start thành công nhưng HTTP mất phản hồi | Retry trả lại phiên cũ, không quay thêm |
| Stop/finalize được gửi nhiều lần | Một video, một kết quả cuối, metadata không bị ghi đè |
| Backend/DB mất kết nối giữa lúc quay | Worker giữ việc ghi và nhật ký; có cách dừng an toàn đã thiết kế; phục hồi đối chiếu được |
| Worker restart trong khi quay/finalize | Không tự xóa tệp dở, không mở phiên mới khi tiến trình cũ chưa rõ trạng thái |
| NAS ngắt giữa lúc copy | Không công bố tệp chưa hoàn tất; retry không làm mất bản local |
| Gần đầy đĩa hoặc camera ngắt | Chặn start khi không đủ điều kiện; phiên đang chạy báo lỗi cụ thể, giữ dữ liệu còn lại |
| Khóa tranh chấp đồng thời với retention | Không xóa video đã được khóa thành công |
| Tài khoản khác kho gọi API/video URL | Bị từ chối ở server, không chỉ bị ẩn nút trên UI |
| Khôi phục sau sự cố máy chủ | Đối chiếu được metadata, hash và vị trí bản video; ghi nhận phần thiếu thay vì báo đủ |

Kết quả thử phải kèm môi trường, cách gây lỗi, trạng thái DB/tệp trước-sau và điểm còn hạn chế. Các mục trên hiện là tiêu chí thiết kế, chưa phải kết quả test.
