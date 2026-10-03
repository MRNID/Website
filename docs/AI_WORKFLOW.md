# Quy trình Anti triển khai — Codex review

Mục tiêu: tận dụng Anti cho triển khai và kiểm tra rộng; dùng Codex để kiểm tra độc lập các thay đổi có rủi ro. Đây là quy ước dự án, không phải cam kết mức tiết kiệm quota của sản phẩm.

## 1. Phân vai

| Vai trò | Công việc |
| --- | --- |
| Người dùng | Chốt yêu cầu nghiệp vụ, ưu tiên và quyết định còn thiếu |
| Anti | Đọc dự án, phân tích tác động, chia việc, triển khai, cập nhật tài liệu, chạy kiểm tra, tự review và sửa lỗi trước khi bàn giao |
| Codex | Review thay đổi thực tế, kiểm tra các ràng buộc và chỗ liên kết giữa module; trả phát hiện có bằng chứng |

Codex mặc định không viết lại phần Anti đang làm trong lượt review. Nếu người dùng giao sửa trực tiếp thì có thể chuyển vai cho tác vụ đó. Không coi nhận xét của bất kỳ AI nào là đúng chỉ vì tên model hoặc gói dịch vụ; đối chiếu bằng code, đặc tả và test.

## 2. Một vòng làm việc

1. Anti nhận một mục tiêu có tiêu chí hoàn tất và ranh giới tệp/module. Với thiết kế, đầu ra là hợp đồng đã thống nhất; với code, đầu ra là một hành vi kiểm chứng được.
2. Anti làm trọn gói, tự kiểm tra và xử lý lỗi đã biết. Không chuyển từng sửa nhỏ sang Codex.
3. Anti đóng gói bàn giao theo `REVIEW_PACKET_TEMPLATE.md`, ghi mốc trước/sau, thay đổi, tác động và kết quả kiểm tra thực tế.
4. Codex đọc packet, diff và những phần phụ thuộc cần thiết; không đọc lại toàn bộ repo mặc định, cũng không chỉ tin bản tóm tắt.
5. Codex trả một danh sách phát hiện tổng hợp: mức độ, tệp/dòng, tình huống gây lỗi, tác động, hướng sửa. Phân biệt lỗi chặn, lỗi không chặn và câu hỏi chưa xác minh. Tránh sửa phong cách ngoài yêu cầu.
6. Anti sửa các phát hiện, giữ ID của từng lỗi và bổ sung bằng chứng kiểm tra.
7. Codex review diff sửa lỗi và các tác động mới. Không mở lại phần đã ổn trừ khi có thay đổi hoặc bằng chứng mới.
8. Anti tích hợp và cập nhật trạng thái. Sau khi tích hợp nhiều nhánh, kiểm tra lại tổ hợp cuối cùng; kết quả test một nhánh không đại diện cho tổ hợp.

Review có ba kết quả: `CẦN SỬA`, `CHƯA ĐỦ BẰNG CHỨNG`, hoặc `KHÔNG PHÁT HIỆN LỖI CHẶN TRONG PHẠM VI`. Kết quả cuối không phải bảo đảm toàn hệ thống không có lỗi. Thiếu camera/môi trường phải ghi chưa kiểm tra, không đánh dấu đã đạt.

## 3. Dùng nhiều tác vụ ở Anti

- Một tác vụ điều phối giữ danh sách công việc, phụ thuộc, người sở hữu tệp và mốc tích hợp.
- Làm song song khi hợp đồng đã ổn định và phạm vi chỉnh sửa độc lập. Dùng nhánh/worktree riêng khi có Git; chưa có Git thì dùng bản sao làm việc riêng, không cho nhiều tác vụ cùng ghi một tệp.
- Ví dụ sau khi chốt hợp đồng: tác vụ A làm backend; B làm UI với mock theo cùng schema; C làm worker adapter; D làm kịch bản kiểm thử độc lập từ tiêu chí nghiệm thu.
- Những tệp chung như schema, migration, shared types, lockfile chỉ có một đầu mối tích hợp. Các tác vụ khác đề xuất thay đổi cho đầu mối này.
- Thay đổi hợp đồng phải thông báo cho các tác vụ phụ thuộc và cập nhật test/mock. Không để backend, UI và worker tự định nghĩa ba phiên bản hợp đồng.
- Khi Codex review mốc đã đóng gói, Anti có thể làm việc độc lập tiếp theo ở nhánh khác. Không tiếp tục thay đổi mốc đang được review hoặc xây sâu trên quyết định còn bị chặn.
- Chia gói theo một hành vi hoặc quyết định, không chia cứng theo số dòng/tệp. Không gom hàng loạt tính năng thành một diff khổng lồ.

## 4. Khi nào dùng Codex

| Mức | Ví dụ | Cách review |
| --- | --- | --- |
| Thấp | Câu chữ, CSS, tài liệu không đổi hợp đồng | Anti tự kiểm tra; gộp review ở mốc tính năng nếu cần |
| Vừa | CRUD thông thường, kết nối UI với API | Review sau khi một luồng hoàn chỉnh và test liên quan đã chạy |
| Cao | Auth/quyền, schema/migration, state machine, đồng thời, retry, xóa dữ liệu, lưu video | Review quyết định trước khi triển khai phụ thuộc rộng; review implementation trước khi tích hợp |
| Mốc tích hợp | Quay một đơn hoàn chỉnh, nhiều trạm, phục hồi sự cố | Review các điểm giao tiếp và bằng chứng thử lỗi; không tự động audit lại toàn bộ code |

Không cần gọi Codex mỗi lần sửa database. Một gói database gồm thay đổi schema/migration, truy vấn và hợp đồng bị ảnh hưởng, cùng test; review một lượt có ngữ cảnh đủ. Thay đổi phá hợp đồng, phạm vi quyền hoặc có nguy cơ mất dữ liệu cần xem riêng trước khi các tác vụ khác tiếp tục phụ thuộc.

## 5. Ngân sách đọc của Codex

- Bắt đầu từ packet ngắn (mục tiêu khoảng một trang), danh sách tệp và diff. Log đầy đủ để ở tệp, chỉ đọc khi cần.
- Tra symbol, call site, ràng buộc schema và test có liên quan; chỉ mở rộng khi có đường phụ thuộc cụ thể, thiếu bằng chứng hoặc phát hiện phạm vi khai báo không đúng.
- Không cấm đọc thêm bằng hạn mức tệp cứng: bỏ sót call site hoặc migration có thể khiến review sai.
- Chạy lại kiểm tra có giá trị độc lập, đặc biệt tình huống rủi ro; không lặp toàn bộ bộ test chỉ để xác nhận log Anti. Test đầy đủ tại mốc tích hợp khi phù hợp.
- Nếu gói quá rộng, trả phần đã review và cách chia phần còn lại. Không tuyên bố đạt khi chưa kiểm tra hết phạm vi cần thiết.
- Sau một vòng sửa vẫn lặp cùng lỗi thiết kế, dừng vá liên tục và xử lý hợp đồng gốc.

## 6. Mốc so sánh và lưu bàn giao

Workspace hiện chưa có Git ở lần kiểm tra ban đầu. Trước vòng code đầu tiên, Anti thiết lập Git cục bộ với ignore cho secrets, node_modules và sản phẩm build; kiểm tra tệp được stage trước commit. Không cần đưa repository lên mạng để làm review.

Với Git: packet ghi base/head commit chính xác. Thay đổi đã commit mới được coi là thuộc packet; phần chưa commit phải được liệt kê riêng và đóng băng nếu cần review. Không bỏ sót tệp mới/untracked. Dùng diff trực tiếp giữa hai mốc để biết chính xác nội dung thay đổi.

Khi chưa có Git: giữ bản trước/sau, danh sách tệp thêm/sửa/xóa và hash của bản cần review. Một bản kể lại bằng lời không thay thế diff.

Lưu packet theo từng gói: `docs/reviews/<task-id>.md`. Ghi review áp dụng cho mốc nào, phát hiện nào đã sửa, bằng chứng nằm đâu. Không đổ toàn bộ lịch sử chat vào packet; không ghi credentials hoặc token vào log bàn giao.

## 7. Gói việc tiếp theo cho dự án này

Hiện vẫn ở giai đoạn thiết kế. Anti có thể phân tích song song ba phạm vi rồi có một đầu mối thống nhất:

1. Phạm vi doanh nghiệp/kho và ràng buộc dữ liệu trong DATABASE/SECURITY.
2. Vòng đời start/stop/finalize, retry và giao tiếp backend–worker trong API_CONTRACT/FLOW_PACKING.
3. Tệp local, NAS, crash recovery và topology trong VIDEO_PROCESSING/DEPLOYMENT.

Đầu ra chung: cập nhật nhất quán với BASELINE, danh sách quyết định còn thiếu, diff tài liệu và một packet review. Chưa triển khai nghiệp vụ khi hợp đồng liên quan chưa được chốt. Codex review phần thay đổi và chỗ giao nhau của ba phạm vi.

## 8. Prompt dùng lại

### Giao Anti

> Làm gói <ID/mục tiêu> theo docs/AI_WORKFLOW.md và thiết kế đã chốt. Tự chia tác vụ độc lập nếu môi trường hỗ trợ; giữ một đầu mối cho hợp đồng và tệp chung. Hoàn thiện, tự review, chạy kiểm tra phù hợp và sửa lỗi trước khi bàn giao. Tạo docs/reviews/<ID>.md theo REVIEW_PACKET_TEMPLATE.md, có mốc trước/sau và bằng chứng. Không mở rộng tính năng ngoài phạm vi.

### Giao Codex

> Review gói docs/reviews/<ID>.md theo docs/AI_WORKFLOW.md. Đọc diff thực tế và phụ thuộc liên quan; tập trung tính đúng, quyền, dữ liệu, đồng thời và phục hồi lỗi phù hợp với thay đổi. Không audit toàn repo mặc định. Trả phát hiện có bằng chứng, phạm vi đã kiểm tra và phần chưa xác minh. Lượt này chỉ review, chưa sửa implementation.

### Anti sửa sau review

> Xử lý các finding trong gói <ID>. Giữ nguyên ID để đối chiếu; mỗi lỗi ghi cách sửa và bằng chứng kiểm tra. Nếu không đồng ý, đưa lập luận/code/test cụ thể. Ghi mốc trước/sau vòng sửa và tác động mới để Codex review phần chênh lệch.

Tham khảo nguyên tắc giao việc rõ phạm vi và cung cấp ngữ cảnh phù hợp: [OpenAI — Best practices](https://learn.chatgpt.com/guides/best-practices). Phân vai và các mốc trong tài liệu này là đề xuất riêng cho dự án.
