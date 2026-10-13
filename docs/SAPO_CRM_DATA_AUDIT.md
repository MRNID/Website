# Kiểm tra dữ liệu Sapo cho CRM — 13/10/2026

Đã đọc trực tiếp một trang chi tiết đơn và hồ sơ khách hàng được liên kết từ đơn trong Chrome đang đăng nhập. Chỉ đọc giao diện; chưa kiểm tra API nội bộ, chưa gửi đơn về backend và chưa đồng bộ toàn bộ cửa hàng. Không lưu thông tin liên hệ cá nhân trong tài liệu này.

## Các trường xác nhận có trên mẫu

| Nhóm | Nguồn trên giao diện |
| --- | --- |
| Shop và ID đơn | Host cửa hàng + `/admin/orders/{id}` |
| Mã đơn, trạng thái, ngày bán | Tiêu đề và thông tin đơn |
| ID khách hàng | Link `/admin/customers/{id}` trong đơn |
| Tên khách, điện thoại, địa chỉ giao hàng | Khối thông tin khách trên đơn |
| ID sản phẩm và phiên bản | Link `/admin/products/{id}/variants/{id}` trong dòng hàng |
| SKU | Nội dung link phiên bản trong ô tên sản phẩm; không có cột SKU riêng |
| Tên và phiên bản | Paragraph tên sản phẩm và heading phiên bản trong cùng ô |
| Số lượng, đơn giá, chiết khấu, thành tiền | Các cột của bảng sản phẩm |
| VAT, phí giao hàng, tổng phải trả | Khối tổng kết đơn |
| Đã trả, còn phải trả | Khối thanh toán |
| Nguồn, chi nhánh, người bán, ghi chú, tags | Thông tin đơn |
| Mã khách, nhóm, nhân viên phụ trách | Hồ sơ khách hàng |
| Điểm, công nợ, tổng chi tiêu, ngày mua cuối | Hồ sơ khách hàng |
| Lịch sử mua, trạng thái thanh toán/xuất kho | Bảng lịch sử có phân trang |

Email và ngày sinh mẫu đang hiển thị `---`: giữ null, không suy ra giá trị. Đơn mẫu chưa có thông tin giao hàng: trackingCode phải null, không thay bằng mã đơn hoặc mã sinh ngẫu nhiên.

## Kết quả đối chiếu

- Bảng mẫu có một dòng SKU với số lượng 15. Giá trị trước thuế 51.944.442 + VAT 4.155.555 = tổng phải trả 56.099.997; đã thanh toán 0.
- Hồ sơ báo 179 đơn trong chỉ tiêu mua hàng nhưng bảng lịch sử có 226 bản ghi, gồm cả đơn hủy. Không dùng số tổng hợp làm số bản ghi cần tải; cần theo phân trang, giữ trạng thái gốc và định nghĩa chỉ tiêu CRM riêng.
- Tổng chi tiêu hiển thị giữa trang đơn và trang khách lệch 1 đồng. Cần lưu nguồn/thời điểm quan sát, không tự sửa hoặc coi hai tổng hợp là cùng định nghĩa.
- Bảng lịch sử tách header và body thành hai table. Parser chỉ đọc table đầu tiên sẽ bỏ sót dữ liệu.
- `textContent` trong ô có thể chứa CSS của tooltip; lấy nội dung hiển thị và các phần tử cụ thể, tránh trộn nội dung ẩn vào dữ liệu.

## Lỗi của extension hiện tại cần thay trước khi dùng làm CRM

- Parser có thể lấy link SKU làm tên sản phẩm rồi sinh SKU ngẫu nhiên vì không tìm thấy cột SKU.
- Chưa lưu đầy đủ ID nguồn, quan hệ khách–đơn–phiên bản và trạng thái thanh toán.
- Luồng danh sách tạo sản phẩm thay thế và số lượng 1, không đại diện cho chi tiết đơn thật.
- Giá trị mặc định và mã vận đơn thay thế làm mất phân biệt dữ liệu thiếu với dữ liệu thật.

## Điều kiện nghiệm thu bộ đồng bộ tiếp theo

1. Parser chi tiết dùng đúng cấu trúc đã quan sát; null và danh sách trường thiếu thay cho dữ liệu giả.
2. Upsert theo `(business_id, source_shop, entity_type, source_id)`; không chỉ theo tên/điện thoại/mã hiển thị.
3. Lưu snapshot nguồn và thời điểm thu thập, tách trạng thái đơn/giao hàng/thanh toán; ghi chú CRM không bị ghi đè.
4. Nhập đủ phân trang và chi tiết từng đơn, có checkpoint để tiếp tục; snapshot thiếu không xóa dữ liệu đã đầy đủ.
5. Có kiểm thử trang đơn nhiều dòng, số lượng lẻ, hoàn/hủy, nhiều vận đơn và khách sàn bị che thông tin trước khi kết luận đủ dữ liệu toàn cửa hàng.
6. Đồng bộ định kỳ phụ thuộc Chrome và phiên Sapo; hiển thị thời điểm thành công cuối, số bản ghi lỗi/thiếu, không gọi là realtime bảo đảm.

Đợt kiểm tra này xác nhận có dữ liệu hữu ích cho CRM trong giao diện mẫu, chưa xác nhận đồng bộ vào database hoặc phạm vi đầy đủ của toàn bộ dữ liệu.
