# Phát sinh và phụ lục — migration 034

Đã triển khai trong cùng hội thoại yêu cầu, tại **Tài liệu & công cụ → Phát sinh**. Không tạo đơn hoặc đoạn chat mới.

## Cách sử dụng

1. Customer gửi tên và nội dung cần bổ sung. Yêu cầu có khóa chống gửi lặp; gửi lại khi lỗi mạng không tạo thêm yêu cầu.
2. Staff phụ trách hoặc Admin trao đổi với Customer và đội Creator, nhập phạm vi/sản phẩm phần thêm, mức chỉnh sửa bao gồm, giá phát sinh trọn gói đã gồm thuế nếu có, hạn dự án và hạn Customer xác nhận.
3. Nút gửi phát hành ngay một phiên bản phụ lục cho Customer. Mỗi lần điều chỉnh được lưu thành phiên bản mới; bản đã gửi không bị ghi đè.
4. Customer đọc và tích đồng ý đúng phiên bản mới nhất. Server kiểm tra phiên bản, hạn hiệu lực, hash nội dung và lưu bằng chứng xác nhận trong ứng dụng.
5. Sau xác nhận, giá trị đơn và khoản còn phải thu tăng đúng một lần. Giữ nguyên báo giá/hợp đồng gốc, cọc đã thỏa thuận, các khoản thực nhận đã đối soát và ghi nhận nhân viên chốt đơn.
6. Phạm vi bổ sung và hạn mới cập nhật vào dự án. Mỗi phụ lục có một mốc tiến độ riêng còn chờ thực hiện. Nếu dự án chưa được tạo, phạm vi/mốc được đưa vào khi Staff tạo kế hoạch.
7. Creator trong đội đã được cấp quyền xem phần **Phạm vi bổ sung đã chốt**: phạm vi, mức chỉnh sửa, hạn và tiêu đề. Staff điều phối phần việc cụ thể, trao đổi với Creator trước khi gửi phụ lục và ghi nhận tiến độ trong hệ thống. Không tự thêm Creator hoặc đổi phần phân công gốc.
8. Trước khi gửi nghiệm thu, phải chốt hoặc đóng mọi đề nghị đang mở và hoàn thành các mốc, gồm mốc phụ lục. Thanh toán phần còn lại tính cả phát sinh; xác nhận thu đủ và bàn giao không watermark vẫn theo luồng cũ.

Ví dụ: đơn gốc 1.000.000đ, đã nhận cọc 300.000đ, phát sinh được Customer xác nhận 250.000đ. Tổng mới 1.250.000đ, khoản còn phải thu 950.000đ; thực nhận vẫn 300.000đ. Staff có thể dùng yêu cầu thu theo mốc nếu cần thu thêm trước khi thực hiện phần bổ sung.

## Phạm vi và quyền

- Phát sinh mở từ đơn đã xác nhận cọc (CONFIRMED/IN_PROGRESS), trước vòng nghiệm thu đang chờ/đã chấp nhận và trước xác nhận thu đủ. Khi đã nghiệm thu, trao đổi với Staff để gửi yêu cầu dịch vụ mới.
- Customer chủ đơn khởi tạo, xác nhận hoặc rút yêu cầu. Staff hiện phụ trách/Admin báo giá và từ chối yêu cầu không thể đáp ứng. Không cho Staff xác nhận thay Customer.
- Cần người phụ trách đang hoạt động. Hạn dự án mới không được sớm hơn lịch dự án hoặc các phụ lục đã chốt trước đó.
- Rút/từ chối yêu cầu cần lý do, không làm tăng/giảm tiền hoặc xóa lịch sử. Đây là đóng đề nghị phát sinh, không phải hủy đơn/hoàn tiền.
- Giá có thể bằng 0 nếu bổ sung được thỏa thuận miễn phí; vẫn cần Customer xác nhận và mốc công việc.
- Creator chỉ nhận nội dung vận hành đã chốt qua RPC riêng và tin nhắn TEAM. Đề nghị của khách, giá, hash, bằng chứng thương mại và sự kiện ORDER_VARIATION_* thuộc Customer/Staff/Admin; bảng phụ lục không mở trực tiếp cho tài khoản Supabase authenticated/anon.
- Báo giá và bằng chứng xác nhận bất biến. Xác nhận lại đúng dữ liệu không cộng tiền lần hai; khóa gửi lặp không dùng được với nội dung khác. Sai phiên bản/hash hoặc đã đóng trả lỗi workflow để người dùng kiểm tra lại.

## Thống kê và phản hồi giao diện

Thống kê Staff/Admin có **Phát sinh chốt trong kỳ** riêng. Đơn gốc thuộc kỳ chốt báo giá; phụ lục thuộc kỳ Customer xác nhận. Khoản còn phải thu đến cuối kỳ chỉ gồm phụ lục đã xác nhận trước cuối kỳ, tránh thay đổi số dư tháng trước bằng phát sinh tháng sau. Chuyển người phụ trách không chuyển ghi nhận người chốt. Hoa hồng vẫn ngoài hệ thống.

Tab/phần hướng dẫn hiện ngay, chỉ nội dung phụ lục cần tải dữ liệu. Danh sách 10 yêu cầu/trang; mỗi yêu cầu trả tối đa 20 phiên bản gần nhất, toàn bộ bản cũ vẫn giữ trong database. Liên kết từ tin nhắn chọn đúng trang chứa phụ lục. Sau thay đổi, panel thanh toán/tiến độ/bàn giao đã mở tải lại dữ liệu mà không bị remount hoặc xóa form đang nhập; lỗi còn hiển thị và có nút thử lại. Poll chỉ phần dữ liệu khi cần, không tải lại khung trang.

## Xác minh và phần còn chờ

Migration 034 đã áp dụng vào database được cấu hình, giữ checksum 004–033. Backend/frontend build và lint đạt; 115 backend HTTP/unit tests, 14 frontend unit tests và 15 bộ kiểm tra SQL rollback đạt. SQL gồm gửi lặp, sửa phiên bản, hash giả, công nợ/tiền nhận, phụ lục giá 0, mốc trước/sau tạo dự án, lịch mới, tháng cũ, quyền Creator và link đúng trang. 138 kiểm tra quyền chỉ đọc trên 6 tài khoản hiện có đạt, gồm API phụ lục/phạm vi của các đơn được phép xem; luồng tạo/xác nhận/thu tiền và quyền Creator dương được kiểm tra bằng SQL rollback/HTTP giả lập. Bundle không chứa các bí mật được cấu hình; diff whitespace đạt. Không tạo phụ lục/đơn/hợp đồng/khoản thu/tài khoản thật để test.

Xác nhận hiện là bằng chứng APPLICATION, tương tự hợp đồng đang có. Tích hợp nhà cung cấp ký điện tử và SMTP, ngân hàng/QR, đổi Creator, ghi nhận trễ hạn và nghiệm thu UI trực tiếp trên trình duyệt còn chờ. Chưa commit, push hoặc deploy bản frontend/backend. Cọc ban đầu tối thiểu 30% theo luồng đã chốt; không tự thay điều kiện cọc cũ khi có phụ lục. Quy định hủy đơn/hoàn tiền giữ lại để hoàn thiện sau.
