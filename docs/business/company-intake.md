# Liên hệ doanh nghiệp và ứng tuyển Creator

Landing có ba nhóm. **Yêu cầu tư vấn** đi vào luồng Customer/Staff hiện có. Hai nhóm hợp tác có form riêng, không yêu cầu đăng nhập:

- `/business-contact`: họ tên, email, điện thoại tùy chọn, tên doanh nghiệp và nhu cầu hợp tác.
- `/creator-application`: họ tên, email, điện thoại tùy chọn, Creator/sinh viên, chuyên môn, **CV PDF tối đa 10 MB**, 1–5 link portfolio HTTPS và giới thiệu tùy chọn.

Form hiện ngay, không đợi danh mục dịch vụ. Khi gửi lỗi, các trường và CV đã chọn vẫn nằm trong form; nút gửi được khóa trong lúc xử lý. Xác nhận thành công chỉ thông báo đã nhận thông tin, không thông báo đã gửi email hoặc đã cấp tài khoản.

Admin mở **Liên hệ & ứng tuyển** (`/admin/leads`):

1. Lọc theo liên hệ chung, yêu cầu dự án cũ, liên hệ doanh nghiệp hoặc ứng tuyển Creator.
2. Mở hồ sơ để xem chuyên môn, phân loại Creator/sinh viên, portfolio và tải CV riêng tư.
3. Chọn **Soạn email phản hồi** để mở ứng dụng email. Admin tự kiểm tra nội dung và gửi email; hệ thống chưa tích hợp SMTP để tự gửi.
4. Cập nhật trạng thái và ghi chú nội bộ. Với ứng tuyển, “Phù hợp” chỉ là kết quả xét hồ sơ, không xác nhận đã ký hợp đồng.
5. Sau khi thực sự ký hợp đồng hợp tác với công ty, dùng **Cấp tài khoản Creator sau hợp đồng** để đi tới luồng cấp/import tài khoản hiện có. Luồng đó yêu cầu thông tin hợp đồng riêng.

Gửi ứng tuyển không tạo tài khoản Auth, không đổi role của tài khoản có sẵn, không tạo Customer/dự án và không mở chat. “Sinh viên” là thông tin hồ sơ. Chức năng chuyển liên hệ thành Customer bị chặn cho hồ sơ Creator ở cả API và database.

CV dùng kho riêng tư `lead-attachments`; chỉ API Admin cấp link tải có hạn 5 phút. Customer, Staff, Creator và Guest không đọc được bảng hồ sơ hoặc tải CV qua hệ thống. Link portfolio không được server tự truy cập; Admin mở link để xem xét.

Migration **031_company_intake.sql** bổ sung nguồn liên hệ và trường ứng tuyển, giữ nguyên dữ liệu/nguồn/tệp lịch sử. Kiểm tra SQL chạy trong giao dịch rollback, không lưu tài khoản, hồ sơ hay tệp thử. Các kiểm tra HTTP dùng mock dữ liệu/kho tệp, không gửi hồ sơ thử hay email tới người thật.

Chờ nghiệm thu trực tiếp trên desktop/mobile và kiểm tra trình soạn email thực tế. Thông tin email công ty/SMTP được cấu hình ở đợt tích hợp cuối; chưa deploy bản mới.
