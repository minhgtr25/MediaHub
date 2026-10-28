# Hồ sơ nghề nghiệp và tìm Creator

Migration bổ sung 036, không sửa các migration 004–035 đã áp dụng. Không tạo role mới, không cấp tài khoản hoặc thay đổi hợp đồng hợp tác. Creator chỉ sử dụng hồ sơ đã được Admin liên kết với tài khoản và xác nhận hợp tác.

## Creator tự cập nhật

Trong **Hồ sơ & Bảo mật**, Creator có phần **Hồ sơ nghề nghiệp** để:

- Sửa tên hiển thị, chức danh, giới thiệu, khu vực, học vấn, cấp độ kinh nghiệm, công cụ/ngôn ngữ.
- Chọn tối đa 10 nhóm chuyên môn và 30 kỹ năng đang hoạt động. Lưu lại danh sách không làm mất mức kỹ năng đã có.
- Chọn sẵn sàng, cần trao đổi lịch hoặc tạm ngừng nhận việc mới. Lựa chọn này không tự giải phóng phân công đang thực hiện.
- Tải ảnh bìa và ảnh minh họa portfolio JPG/PNG/WEBP tối đa 5 MB; avatar tiếp tục dùng chức năng chung đã có.
- Thêm/sửa/xóa portfolio của mình; có tối đa 50 mục khi thêm mới. Giữ đường dẫn hồ sơ ổn định. Khi sửa portfolio cũ mà không tải ảnh mới, giữ ảnh cũ.

Điểm đánh giá, số dự án hoàn thành, dấu xác minh, đề xuất nổi bật và giá tham khảo không phải trường Creator được tự sửa. Admin quản lý xác minh/đề xuất/giá theo công cụ công ty hiện có; giới thiệu và portfolio là nội dung Creator tự khai, không biến thành đánh giá đã xác minh.

Ảnh bìa/portfolio lưu công khai. Trước upload, Creator phải xác nhận có quyền đăng và đã kiểm tra nội dung trong ảnh; trước đăng/sửa portfolio, phải xác nhận quyền công khai nội dung/tên khách hàng. Không lấy file nghiệm thu/bàn giao của Customer tự động vào portfolio. Xóa portfolio gỡ mục khỏi hồ sơ; các ảnh đã tải lên vẫn có thể còn trong kho công khai, chưa có tác vụ dọn ảnh không còn tham chiếu. Đây là hạng mục vòng đời tệp cần hoàn thiện sau; không dùng ảnh nhạy cảm như tài liệu giao dịch.

## Customer và Staff xem

Trang Tìm Creator, hồ sơ chi tiết và Creator trên trang chủ dùng cùng nguồn chiếu công khai:

- Điểm và số nhận xét lấy từ đánh giá Customer của đơn đã hoàn thành. Hồ sơ chưa có đánh giá hiển thị “Mới”, không dùng các điểm demo lưu sẵn.
- Số dự án tính từ phân công đã hoàn thành có bản FINAL trên đơn đã hoàn tất, không lấy số portfolio tự đăng làm số dự án đã bàn giao.
- Trạng thái bận gồm phân công đã nhận, lời mời ban đầu chưa hết hạn và lời mời thay thế còn giữ chỗ. Chỉ tiến độ 100% chưa làm Creator rảnh. Hết hạn/từ chối/giải phóng mới xét lại theo lựa chọn nhận việc.
- Creator có tài khoản bị vô hiệu hóa, sai vai trò hoặc thiếu hợp tác không xuất hiện công khai. Hồ sơ lịch sử chưa liên kết tài khoản vẫn được giữ để xem portfolio; không được coi là người sẵn sàng để Staff phân công.
- Tìm tên/chức danh/kỹ năng/công cụ theo chuỗi literal; lọc chuyên môn/kỹ năng/khu vực/cấp độ/lịch, sắp xếp theo đề xuất/điểm/số dự án/giá. Hồ sơ mới chưa có nhóm/kỹ năng không bị loại khi chưa bật bộ lọc.
- Staff tư vấn và đổi người tìm trên cùng nguồn lịch nhận việc, chỉ gợi ý Creator rảnh và có hợp đồng hợp tác. Từ khóa tìm cả chức danh, công cụ và kỹ năng. Workflow vẫn kiểm tra lại giữ chỗ khi gửi mời để chống tranh phân công.

JSON công khai chỉ có các trường hồ sơ/portfolio đã chọn, không chứa `profile_id`, thông tin hợp tác, email/số điện thoại tài khoản, khóa gửi lặp hoặc số liệu phản hồi/tỷ lệ hoàn thành demo. Địa chỉ ảnh là URL công khai của kho ảnh. Các bảng Creator không còn được trình duyệt đọc trực tiếp; API/RPC dùng projection an toàn. Không giả ảnh dự án mẫu cho portfolio chưa có ảnh; giao diện dùng ô trống có nhãn.

## API

`GET /api/creator/profile` chỉ Creator của chính hồ sơ đó. Tài khoản Creator chưa được liên kết hợp tác nhận thông báo 409; role khác nhận 403.

`POST /api/creator/profile/save|portfolio_save|portfolio_delete` nhận payload strict, actor lấy từ đăng nhập. Portfolio chỉ sửa/xóa khi thuộc Creator đang đăng nhập; thêm mới có khóa chống gửi lặp. RPC thay đổi trong transaction và ghi audit; giữ các trường do công ty/hệ thống quản lý.

`POST /api/creator/profile/images` nhận multipart file, loại cover/portfolio và xác nhận quyền công khai. Kiểm tra chữ ký file/kích thước và quyền trước upload; ảnh gắn vào nội dung phải thuộc đường dẫn tài khoản và tồn tại trong bucket. Nếu lưu ảnh bìa lỗi, xóa upload mới.

`GET /api/public/creators`, `/creators/:slug`, `/creator-reviews/:slug` dùng các RPC công khai chỉ backend gọi. Bộ lọc phân trang có giới hạn và không cho giả actor. Danh sách/điểm nhận xét được tính trong SQL, không lấy một trang dữ liệu giới hạn rồi tự tính trung bình.

## Kiểm tra và việc còn lại

Build/lint backend/frontend, 144 backend HTTP/unit tests, 14 frontend unit tests và 17 bộ SQL rollback đạt. Kiểm tra SQL gồm quyền sở hữu, trường được quản lý, kỹ năng/chuyên môn, upload thuộc tài khoản/tồn tại, chống gửi lặp, audit, trạng thái giữ chỗ/hết hạn/nhận việc/giải phóng, điểm từ dự án đã hoàn tất và JSON công khai không lộ trường tài khoản. 162 kiểm tra quyền chỉ đọc trên 6 tài khoản test và kiểm tra API công khai đạt; không sửa profile hoặc upload ảnh thử vào tài khoản thật.

Chưa có kiểm tra UI trực tiếp trên trình duyệt, kiểm tra mobile/focus/mạng lỗi hoặc deploy mới. Việc tiếp theo: vòng đời ảnh chưa tham chiếu, cấu hình ngân hàng/QR, email/ký điện tử và nghiệm thu toàn bộ.
