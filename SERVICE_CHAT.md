# Chat dịch vụ MediaHub

Một yêu cầu giữ **một hội thoại** từ tư vấn đến hoàn thành. Customer, Staff, Admin và Creator dùng chung bố cục danh sách — tin nhắn — công cụ. Creator tham gia sau xác nhận phần việc và Customer xác nhận hợp đồng. Không tạo chat riêng Customer–Creator.

## Giao diện và thao tác

- Danh sách có tìm kiếm theo tên yêu cầu/Staff, avatar Staff, preview, thời gian, số tin chưa đọc và phân trang 20 hội thoại. Creator chỉ thấy những tin thuộc đội họ được phép xem; nội dung thương mại không ảnh hưởng preview/unread của Creator.
- Hai nút phía trên đóng/mở danh sách và công cụ độc lập. Chỉ trạng thái bố cục được lưu theo tài khoản/role; không lưu nội dung chat. Thu gọn panel giữ vùng chat được gắn trên trang, draft, tệp đã chọn, lịch sử đã tải và vị trí cuộn.
- Header ghi tên yêu cầu, avatar/tên người phụ trách và trạng thái. Chưa có Staff sẽ hiển thị chờ tiếp nhận. Tin nhắn có tên/role, thời gian, người nhận và trạng thái đã đọc khi có timestamp thực của các thành viên khác.
- **Trả lời** gắn một tin nhắn cùng hội thoại. Tin Customer–Staff chỉ được trả lời trong cùng phạm vi; muốn đổi sang cả đội phải bỏ reply đó. Server cũng kiểm tra quy tắc, kể cả khi gọi API trực tiếp.
- Nút kẹp giấy nhận một JPG/PNG/WebP/PDF/MP4/MOV tối đa 50 MB, cho xem trước ảnh/bỏ tệp và thêm nội dung kèm tệp. File không hợp lệ bị chặn ở server; lỗi gửi giữ draft/tệp để thử lại. Enter gửi, Shift+Enter xuống dòng; không gửi khi đang gõ tiếng Việt bằng IME.
- **Xem ảnh/Mở tệp** lấy URL sau kiểm tra quyền; ảnh mở trong bubble, tệp khác mở trong tab mới. Nếu URL ảnh hết hạn, bấm xem lại để lấy URL mới.
- Panel phải có thành viên hiện tại và tệp trao đổi theo quyền, mỗi trang 10 tệp, cùng các công cụ workflow đang có. Creator chỉ có phần phân công/tiến độ/bàn giao; Customer/Staff/Admin vẫn dùng Creator/báo giá/hợp đồng/thanh toán/nghiệm thu/đánh giá theo quyền. Ghi chú nội bộ không xuất hiện trong chat khách hàng.

## Người nhận và bàn giao

**Customer & Staff** dành cho trao đổi thương mại riêng, gồm Admin được phép theo dõi. **Cả đội** cho những Creator đã đủ điều kiện tham gia. Trước khi khách xác nhận hợp đồng, server chuyển tin về phạm vi Customer–Staff. Gửi hợp đồng/QR/báo giá bằng các tab nghiệp vụ hoặc chọn đúng người nhận khi đính kèm tài liệu trao đổi.

Tệp trong chat dùng để trao đổi. Bản nghiệm thu/bản hoàn thiện đi qua **Bàn giao** và các điều kiện đã chốt: nghiệm thu bản có watermark → Customer thanh toán còn thiếu → Staff xác nhận thu đủ → Creator gửi đúng bản hoàn thiện → bàn giao đủ cả đội → hoàn thành. Gửi file trong chat không tự nghiệm thu, không xác nhận tiền và không hoàn thành dự án.

## Tải dữ liệu và quyền

Tìm danh sách có debounce; thay bố cục không tải lại toàn trang. Lịch sử tải từng 50 tin, giữ các trang cũ khi cập nhật và giữ vị trí khi xem tin trước. Realtime cập nhật tin mới, có fallback 45 giây khi cửa sổ hiển thị. Danh sách hội thoại/panel tài nguyên chỉ tải sau khi mở lần đầu, cập nhật khi mở lại và nhận cập nhật hoạt động khi đang hiện.

File nằm trong bucket private `project-files`; metadata/path không được đọc trực tiếp từ trình duyệt. URL cấp qua API có hạn 180 giây; URL đã cấp có thể còn dùng tới lúc hết hạn sau thay đổi quyền. Mỗi lần cấp mới kiểm tra hội thoại, request và người nhận. Hội thoại hoàn thành/hủy chỉ xem lại.

Gửi lại dùng mã client cố định; database không tạo tin thứ hai nếu server đã ghi tin trước khi mạng lỗi. Gửi lại khác nội dung/tệp với cùng mã bị từ chối. Tệp upload của lần bị workflow từ chối hoặc lần retry trùng được thử dọn ngay; nếu storage cleanup lỗi cần kiểm tra vận hành, không coi là đã xóa chắc chắn.

## Tiến độ kiểm tra

Migration **033** đã áp dụng, bộ SQL rollback và HTTP/unit đạt. Kiểm tra API với tài khoản thật chỉ đọc dữ liệu đã có, không gửi tin/tệp thử vào hội thoại của khách. Chưa nghiệm thu trực tiếp bố cục, bàn phím, scroll khi mở/đóng panel, realtime và gửi lại khi mất mạng trên trình duyệt. Web đang deploy chưa được xác nhận đã cập nhật bản này.
