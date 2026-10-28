# Quản lý tài khoản và dữ liệu công khai

## Tài khoản

Vào **Admin → Quản lý tài khoản** để xem tổng số tài khoản, số được phép truy cập, số bị vô hiệu hóa và số lượng theo từng vai trò. Số tổng quan không thay đổi theo bộ lọc; danh sách bên dưới lọc theo tên/email, vai trò và quyền truy cập. Các vai trò cũ BUSINESS và STUDENT_CREATOR vẫn được thống kê riêng. Tài khoản thử nghiệm vẫn nằm trong thống kê.

Admin chỉnh vai trò và quyền truy cập của tài khoản. Backend kiểm tra trạng thái hoạt động trong mỗi yêu cầu đã đăng nhập. Quyền tự vô hiệu hóa/hạ quyền Admin và Admin cuối cùng tiếp tục được bảo vệ bằng `manage_user`. Cấp Creator mới phải đi qua hồ sơ hợp tác đã ký.

## Nhập dữ liệu thật từ website

- **Admin → Cấp tài khoản Creator → Thêm hồ sơ Creator thật**: nhập tên, chuyên môn, đường dẫn, giới thiệu, khu vực và tải ảnh đại diện/ảnh bìa. Hồ sơ chỉ công khai sau khi liên kết tài khoản Creator đang hoạt động và ghi nhận hợp đồng hợp tác qua quy trình CSV hiện có.
- **Creator → Hồ sơ chuyên môn → Portfolio công khai**: thêm/chỉnh/xóa sản phẩm, tải ảnh, nhập mô tả vai trò thực hiện và liên kết sản phẩm. Chức năng này đã có sẵn và tiếp tục được dùng cho dữ liệu thật.
- **Admin → Hồ sơ dự án → Thêm mới**: nhập thông tin dự án, chọn ảnh bìa và nhiều ảnh thư viện từ máy tính; ảnh có xem trước, tải khi lưu. Hỗ trợ JPG/PNG/WEBP, mỗi ảnh tối đa 5 MB, tối đa 50 ảnh thư viện. Chọn Công khai khi nội dung hoàn chỉnh. Có thể lưu bản nháp trước.

Portfolio là sản phẩm Creator tự công khai. Số đơn hoàn thành trên MediaHub chỉ tính từ đơn COMPLETED, phân công COMPLETED và bản bàn giao FINAL của Creator; không lấy số nhập sẵn, không cộng số portfolio vào số đơn đã làm. Hồ sơ không có đơn thực tế hiển thị 0. Thiếu ảnh dùng chữ viết tắt tên.

## Triển khai

Chạy migration `037_account_directory_and_authentic_content.sql` qua `npm run db:migrate` trong `backend` trước khi triển khai API/frontend mới. Migration được thêm vào cả runner kiểm tra và runner áp dụng. `npm run db:check` kiểm tra trong transaction rồi rollback; không triển khai thay đổi.

Migration nhận diện bản mẫu theo tổ hợp slug/ID và nội dung chính xác từ `seed-demo.mjs`, đánh dấu `is_demo`, gỡ công khai portfolio mẫu, lọc chúng khỏi API, RLS, trang chủ và sitemap. Không xóa hồ sơ, tài khoản, đơn hay quan hệ nghiệp vụ. Hồ sơ Creator mẫu không được dùng để cấp tài khoản mới. Tạo hồ sơ thật mới để bổ sung nội dung; không lấy bản mẫu làm thông tin người thật. Nội dung có nguồn khác cần được người quản trị đối chiếu riêng, không tự suy đoán ảnh nào là AI.

Script seed chỉ được chạy với Supabase local, ngoài production, khi đặt `MEDIAHUB_ALLOW_DEMO_SEED=true`; Creator và portfolio sinh mới luôn được đánh dấu dữ liệu mẫu. Các migration cũ giữ nguyên checksum.

## Kiểm tra

`backend/test/account-content.test.mjs` kiểm tra quyền API, bộ lọc, tạo hồ sơ, chặn cấp Creator ngoài onboarding, loại ảnh và giới hạn upload. `backend/test/account-content.sql` kiểm tra thống kê thực tế, trạng thái tài khoản, điều kiện công khai hồ sơ và trường hợp chưa có đơn hoàn thành; chạy cùng bộ kiểm tra nghiệp vụ hiện có trong transaction.
