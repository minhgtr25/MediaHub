# Đánh giá và dự án tiêu biểu — đã triển khai qua migration 030

Khách mở **Hội thoại dịch vụ → Tài liệu & công cụ → Đánh giá**. Form chỉ mở khi đã nghiệm thu, Staff xác nhận thu đủ tiền và mọi bản hoàn thiện không watermark đã được bàn giao. Đánh giá gồm số sao/nhận xét về kết quả và từng Creator thực hiện. Mỗi dự án chỉ có một bộ đánh giá; sửa trong 7 ngày kể từ lần gửi đầu tiên, giữ lịch sử trong log. Staff/Admin xem trong phạm vi quyền nhưng không đánh giá thay khách.

Lựa chọn **Ẩn danh / Hiển thị tên của tôi** xuất hiện khi khách xác nhận điều khoản. Các đơn trước đây có thể bổ sung lựa chọn trong tab Đánh giá. Chỉ nội dung đánh giá bị giới hạn sửa 7 ngày; khách vẫn được đổi lựa chọn tên sau đó. Nhận xét Creator và điểm trung bình từ đơn đã bàn giao có một khu vực riêng trên hồ sơ công khai. Các số liệu hồ sơ cũ vẫn giữ nguyên để tránh viết lại dữ liệu lịch sử; cần đồng bộ phần lọc/sắp xếp Creator trong bước tiếp theo.

Admin mở **Duyệt dự án tiêu biểu**. Sau khi đơn hoàn thành và đã ghi nhận lựa chọn tên của khách, Admin chuẩn bị một ảnh trích đoạn riêng, tải lên JPG/PNG/WEBP tối đa 5 MB, xem trước và viết giới thiệu tối đa 1.000 ký tự. Admin xác nhận ảnh/chữ chỉ là một phần nhỏ, đã xử lý thông tin nhận diện theo lựa chọn khách, rồi duyệt. Hệ thống không tự cắt ảnh hoặc che tên/logo. Không dùng tệp sản phẩm đầy đủ, hợp đồng hay chứng từ thanh toán làm ảnh công khai.

Trích đoạn được duyệt xuất hiện ở trang chủ và trang dự án. Admin có thể gỡ công khai. Khi khách đổi lựa chọn tên, bản đang công khai được gỡ để Admin kiểm tra lại ảnh và chữ trước khi duyệt lại. Ảnh nháp nằm trong bucket riêng tư; chỉ API hợp lệ cấp đường dẫn tạm thời. Link đã cấp có hạn 180 giây; danh sách công khai có bộ nhớ đệm tối đa 60 giây.

Đã qua build/lint, 74 kiểm tra backend, 8 kiểm tra frontend, các kiểm tra SQL với toàn bộ dữ liệu thử được rollback, và 90 kiểm tra phân quyền bằng tài khoản test hiện có. Chưa xác nhận giao diện trực tiếp trên trình duyệt và chưa deploy thay đổi ứng dụng. Không tạo dự án/hợp đồng/chứng từ thật chỉ để chạy thử.
