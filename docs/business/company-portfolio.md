# Hồ sơ dự án công ty

Trang chủ và `/projects` dùng chung một danh sách **Dự án nổi bật**. Danh sách lấy portfolio công ty đang công khai và trích đoạn được Admin duyệt sau khi hoàn tất dự án. Tìm kiếm, tổng kết quả và phân trang thực hiện trên cả hai nguồn ở server; không nối hai trang dữ liệu riêng ở trình duyệt.

## Cách sử dụng

- Trang chủ xem 6 hồ sơ mới cập nhật; **Xem hồ sơ dự án** mở danh sách đầy đủ.
- Trang Dự án: nhập từ khóa/danh mục hoặc chọn loại hồ sơ, nhấn **Tìm kiếm**. Từ khóa tìm trong tiêu đề, giới thiệu, tên khách hàng công khai và danh mục; ký tự `%`/`_` là ký tự thường.
- Trích đoạn hiện chưa có trường danh mục được Admin duyệt riêng, nên lọc một danh mục cụ thể chỉ trả về những hồ sơ đã có danh mục đó. Chọn tất cả danh mục để xem cả trích đoạn.
- Thẻ có ảnh 16:10, tiêu đề, khách hàng/năm/danh mục khi có dữ liệu và CTA xem chi tiết. Ảnh chưa có được biểu thị bằng khung chờ cập nhật, không dùng ảnh sản phẩm khác làm ví dụ.
- Hồ sơ cũ giữ trang chi tiết `/projects/:slug` và đường dẫn `/portfolio/:id` tương thích. Nội dung kết quả, bộ ảnh và thông tin khác chỉ xuất hiện khi đã có dữ liệu công khai trong hồ sơ.
- Trích đoạn có trang riêng `/projects/case/:public_id`. Trang này chỉ hiển thị phần Admin đã duyệt, không tự đưa file hoàn thiện, giá, hợp đồng, chat, thông tin đội thực hiện hay tài liệu riêng của đơn lên web.

## Admin chuẩn bị nội dung

1. Portfolio công ty cũ vẫn được quản lý tại `/admin/portfolio`.
2. Với dự án theo đơn dịch vụ, hoàn tất nghiệm thu, thu đủ và bàn giao đầy đủ trước. Customer phải được ghi nhận lựa chọn tên/ẩn danh.
3. Mở `/admin/case-studies`, tải **ảnh trích đoạn nhỏ** đã cắt/che thông tin cần ẩn, nhập tiêu đề và giới thiệu ngắn. Không tải toàn bộ bộ file sản phẩm vào mục này.
4. Kiểm tra giới hạn trích đoạn và đúng lựa chọn danh tính; xác nhận hai mục kiểm tra rồi công khai. Không có thao tác tự động đăng sản phẩm đầy đủ.
5. Gỡ công khai tại cùng trang. Nếu Customer đổi lựa chọn tên/ẩn danh, hồ sơ tự ngừng công khai để Admin kiểm tra lại nội dung/ảnh trước khi duyệt lại.

Định danh hồ sơ trích đoạn tách khỏi định danh đơn và giữ nguyên khi duyệt lại. Hồ sơ chưa công khai/đã gỡ trả 404 có thông báo và liên kết quay về danh sách. Lỗi server có nút thử lại, không được coi là danh sách trống. Khung trang/tìm kiếm xuất hiện ngay; vùng dữ liệu tải riêng.

## Kiểm tra và giới hạn hiện tại

Migration 032 đã áp dụng. Kiểm thử API giả lập và SQL rollback xác nhận quyền, bộ lọc, phân trang chung, ẩn danh và ngừng công khai. Các hồ sơ cũ/danh sách/thống kê trang chủ được kiểm tra API chỉ đọc. Không tạo trích đoạn hoặc đơn hàng thử công khai trong database đang dùng.

Danh sách public có cache 60 giây; trang chi tiết trích đoạn không cache. Ảnh trích đoạn dùng URL có hạn 180 giây, nên URL ảnh đã cấp trước khi gỡ có thể còn dùng đến khi hết hạn. Cần nghiệm thu bố cục desktop/mobile/bàn phím trên trình duyệt và triển khai bản mới; kiểm tra API local không xác nhận web đang deploy đã thay đổi.
