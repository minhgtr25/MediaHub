# Đổi Creator và ghi nhận trễ hạn

Module điều phối dùng chung hội thoại dịch vụ và khu tài liệu bên phải. Các role cấp mới vẫn là CUSTOMER, STAFF, CREATOR, ADMIN. Guest chỉ xem công khai; tài khoản BUSINESS/STUDENT_CREATOR cũ được bảo toàn.

## Đổi Creator

1. Customer mở **Điều phối & lịch**, chọn người đang phụ trách và gửi lý do. Staff/Admin không gửi yêu cầu thay Customer.
2. Staff phụ trách xem yêu cầu; từ chối kèm lý do hoặc chọn Creator có tài khoản hoạt động, hợp đồng hợp tác và đang rảnh. Có thể mở hồ sơ ngay trong panel. Lời mời ghi phần việc, hạn bàn giao, căn cứ phê duyệt và thời gian 5–15 phút.
3. Creator mới thấy lời mời trên **Công việc của Creator** và tự xác nhận hoặc từ chối. Trao đổi ngoài hệ thống không thay thế xác nhận này.
4. Người hiện tại tiếp tục phụ trách đến khi người mới xác nhận. Từ chối/hết hạn không giải phóng người cũ. Lịch sử các lời mời được giữ; hết hạn được hiển thị theo giờ server, lease được dọn khi gửi lại để giữ chỗ an toàn.
5. Khi xác nhận, hệ thống thay người trong đội hiện tại và thành viên hội thoại; người cũ mất quyền chat, xem dữ liệu sản xuất/bàn giao hiện tại. Phân công và cập nhật tiến độ của chính người cũ còn trong lịch sử. Cả lời mời thông thường và lời mời thay thế dùng chung cơ chế giữ chỗ để tránh hai Staff phân cùng người.
6. Hợp đồng, báo giá và đội gốc giữ nguyên; tab Tiến độ phân biệt đội theo hợp đồng gốc và đội hiện tại trong Điều phối. Mọi thay đổi giá/phạm vi phải dùng **Phát sinh**, không tự tăng tiền khi đổi người.

Đổi người mở sau xác nhận hợp đồng và trước gửi nghiệm thu/thu đủ. Chỉ khi các yêu cầu đổi người đang mở được chốt/đóng mới gửi nghiệm thu. Sau nghiệm thu hoặc thu đủ, giao diện hướng về hồ sơ hiện có; không cho thay đội đã chốt bàn giao. Nếu một Creator quay lại dự án, bản gửi trước lần nhận việc mới không được tái dùng làm bản nghiệm thu của phần việc thay thế.

## Trễ hạn

Customer, Staff/Admin và Creator hiện đang phụ trách có thể báo cáo nguyên nhân/ảnh hưởng, bên liên quan và hạn đề xuất khi dự án đang thực hiện. Báo cáo chưa đổi lịch hay kết luận trách nhiệm.

Staff phụ trách/Admin xác minh rồi ghi nhận bên chịu trách nhiệm, Creator cụ thể nếu có, căn cứ và hạn mới; hoặc đóng báo cáo và giữ lịch. Có thể chỉ định Creator trong lịch sử dự án. Hạn mới không rút ngắn lịch hiện tại. API hỗ trợ báo cáo gắn một mốc chưa hoàn thành; giao diện hiện báo cáo ở cấp dự án. Chưa có tự động áp dụng phạt/hoàn tiền.

Cả đội xem báo cáo và quyết định, tên người báo cáo/người xác minh, hạn trước/sau và tên Creator chịu trách nhiệm. Quyết định đã lưu không được ghi đè; cần báo cáo tiếp nếu có diễn biến mới. Sự kiện và lịch sử sản xuất nằm trong cùng dự án/hội thoại. Lý do yêu cầu đổi người, ghi chú Staff phê duyệt và lời mời thương mại chỉ Customer/Staff/Admin xem; Creator nhận phần việc và cập nhật vận hành theo quyền.

## API và dữ liệu

- `/api/execution/:orderId`: đội hiện tại, lịch sử đổi người theo quyền và báo cáo lịch, 10 bản ghi mỗi nhóm/trang.
- `/api/execution/:orderId/candidates`: Staff/Admin phụ trách tìm tối đa 24 Creator rảnh, lọc từ khóa tên/chuyên môn.
- `/api/execution/:orderId/:operation`: yêu cầu/rút/phê duyệt/từ chối đổi người, báo cáo/ghi nhận/đóng trễ hạn. Actor lấy từ đăng nhập, payload strict và server kiểm tra lại quyền/trạng thái sau khóa.
- `/api/execution/invitations`: Creator xem lời mời của mình, 10/trang.
- `/api/execution/invitations/:id/accept|decline`: chính Creator xác nhận/từ chối lời mời còn hiệu lực.

Ba bảng mới `creator_replacements`, `creator_replacement_invites`, `execution_delays` không mở đọc/ghi trực tiếp cho trình duyệt. Các RPC chỉ backend gọi, giữ ảnh chụp lịch sử, kiểm tra quyền và khóa điều phối/đơn, chống gửi lặp. Không tạo hội thoại mới. Giao diện chỉ tải panel khi được mở; form giữ nội dung khi lỗi hoặc làm mới dữ liệu. Creator nhận lời mời và panel đang mở làm mới dữ liệu mỗi 15 giây khi trang hiển thị; khung ứng dụng không tải lại.

## Kiểm tra

Migration 035 bổ sung sau 034, không sửa checksum migration đã áp dụng. Bộ SQL rollback kiểm tra phân quyền, từ chối/hết hạn, giữ chỗ giữa các luồng, thu hồi người cũ, tạo sản xuất với đội mới, bất biến hợp đồng/số tiền, quyết định trễ hạn, nghiệm thu đầy đủ → thu đủ → FINAL cho mọi Creator và đánh giá đúng đội đã bàn giao. HTTP giả lập kiểm tra server identity, scope, lease, strict payload, quyền Creator và lỗi workflow. 129 backend HTTP/unit tests, 14 frontend unit tests, 16 bộ SQL rollback và 156 kiểm tra quyền chỉ đọc trên 6 tài khoản test đạt; build/lint backend/frontend đạt. Tài khoản test thật chỉ kiểm tra API đọc; không gửi lời mời, tin nhắn hoặc khoản thu thử vào đơn thật.

Kiểm tra UI trên trình duyệt, tích hợp email/ký điện tử/ngân hàng và deploy bản mới còn chờ. Không dùng module này làm quy định hủy đơn/hoàn tiền; chính sách đó được để sau theo yêu cầu.
