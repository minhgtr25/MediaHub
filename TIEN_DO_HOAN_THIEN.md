# Tiến độ MediaHub — 03/10/2026

Đã có luồng chính từ tư vấn đến đánh giá: tự phân Staff, đội nhiều Creator và xác nhận nhận việc, báo giá/hợp đồng, cọc, đối soát, tiến độ, nghiệm thu có watermark, xác nhận thu đủ, bàn giao bản hoàn thiện, đánh giá và Admin duyệt trích đoạn. Migration mới nhất đã áp dụng là **036** (hồ sơ nghề nghiệp và tìm Creator).

“Đã viết code” dưới đây chưa đồng nghĩa với đã nghiệm thu trên web đang deploy. Không dùng phần trăm tổng vì phạm vi tích hợp và kiểm thử còn mở.

| Hạng mục | Hiện trạng | Việc còn lại |
| --- | --- | --- |
| Dashboard, header, sidebar | Đã viết code cho 4 role; thu gọn/lưu trạng thái, breadcrumb, tìm kiếm, thông báo, hồ sơ/đăng xuất | Kiểm tra trực tiếp bố cục, bàn phím và các kích thước màn hình |
| Menu Customer | Đã chia 5 nhóm; tách Gửi yêu cầu/Yêu cầu tư vấn; ẩn Trung tâm hỗ trợ | Kiểm tra hành trình thực tế, giữ liên kết dữ liệu hỗ trợ cũ |
| Form yêu cầu | Đã có form/panel 2:1, tab hướng dẫn/thông tin dịch vụ, xem portfolio Creator; tải theo vùng; bỏ link tham khảo mới | Nghiệm thu việc đổi lựa chọn/thu gọn khi đang nhập, lỗi mạng và gửi yêu cầu trên trình duyệt |
| Quy trình | Đã thay 6 ô bằng 8 chặng có đường nối, dùng chung trang chủ/trang Quy trình; không cần database | Kiểm tra trình bày desktop/mobile |
| Landing ba đối tượng | Đã viết ba nhóm và CTA; form liên hệ doanh nghiệp, ứng tuyển Creator có CV/portfolio/chuyên môn; Admin tiếp nhận riêng tư, lọc hồ sơ, xem CV và soạn email; không tự cấp tài khoản | Nghiệm thu form/landing trên desktop/mobile; cấu hình gửi email tự động nếu dùng SMTP |
| Hồ sơ dự án công ty | Đã hợp nhất portfolio cũ và trích đoạn đã duyệt trên trang chủ/trang Dự án; tìm kiếm/lọc/phân trang chung; trang chi tiết trích đoạn; thẻ ảnh và chữ thống nhất | Nghiệm thu bố cục/tìm kiếm trên trình duyệt; kiểm tra phiên bản web đang deploy và dữ liệu công khai thực tế |
| Chat dịch vụ | Đã dùng chung bố cục và composer cho Customer/Staff/Admin/Creator; tìm kiếm/preview/unread có phân trang, đóng/mở hai panel, reply/ảnh/tệp, thành viên và file theo quyền; giữ một hội thoại/yêu cầu | Nghiệm thu trên trình duyệt: cuộn/draft/focus, mobile, tab/hash tài liệu, realtime và mạng lỗi; chưa có kiểm thử UI trực tiếp |
| Phát sinh/phụ lục | Đã triển khai: Customer đề nghị, Staff báo giá theo phiên bản, Customer xác nhận; cộng công nợ, thêm mốc và lịch mới; Creator xem phạm vi đã chốt; giữ một hội thoại | Nghiệm thu trên trình duyệt; tích hợp ký điện tử ngoài bằng chứng xác nhận APPLICATION hiện có |
| Đổi Creator/trễ hạn | Đã triển khai: Customer yêu cầu, Staff duyệt, Creator mới tự xác nhận; giữ chỗ độc quyền 5–15 phút, người cũ tiếp tục đến khi đổi thành công; lịch/nguyên nhân/trách nhiệm có bằng chứng | Nghiệm thu trên trình duyệt; giao diện báo cáo hiện ở cấp dự án, API đã hỗ trợ gắn mốc |
| Hồ sơ và tìm Creator | Đã triển khai sửa chuyên môn/portfolio, tải ảnh bìa/ảnh portfolio, quyền chủ hồ sơ; điểm/số dự án từ đơn hoàn tất, lịch nhận việc từ phân công/giữ chỗ; Staff và Customer cùng nguồn tìm kiếm | Nghiệm thu UI/mobile; vòng đời ảnh đã tải nhưng không còn tham chiếu |
| Tài chính | Có thực thu/còn thiếu, thống kê tháng/năm Staff và tổng hợp Admin, xác nhận thu đủ; tách phát sinh theo kỳ xác nhận và số dư cuối kỳ | Nghiệm thu xuyên suốt; cấu hình ngân hàng công ty và QR gắn đúng tiền/nội dung chuyển khoản |
| Tích hợp/hoàn thiện chung | Chưa hoàn tất | Email cấp tài khoản, nhà cung cấp ký điện tử, mã hiển thị ngắn từ server, thẻ/chữ/loading/toast thống nhất, giảm bundle và kiểm thử toàn bộ role |
| Deploy bản mới | Chưa thực hiện | Hoàn tất kiểm thử và chuẩn bị cấu hình triển khai |

Kiểm tra đến đợt phát sinh/phụ lục: backend và frontend build/lint đạt; **115 backend HTTP/unit tests**, **14 frontend unit tests** và **138 kiểm tra quyền chỉ đọc** trên 6 tài khoản test đạt; migration 034 và 15 bộ kiểm tra SQL (gồm chat và phụ lục: xác nhận đúng phiên bản/hash, chống gửi lặp, công nợ/thực nhận, quyền Creator, mốc/lịch mới và số dư theo kỳ) đã qua với dữ liệu thử được rollback. API hồ sơ chung, 6 chi tiết portfolio cũ, hồ sơ không tồn tại và số hồ sơ trên trang chủ đã được kiểm tra chỉ đọc; bundle không chứa các bí mật được cấu hình. API phụ lục của các đơn hiện có được phép xem và API phạm vi bổ sung cũng đã kiểm tra chỉ đọc; dữ liệu nghiệm thu dương cho Creator/phụ lục được xác minh bằng SQL rollback. Các API kiểm tra sử dụng backend local với database đã cấu hình, không xác nhận bản web đang deploy đã được cập nhật.

Thứ tự tiếp theo: vòng đời ảnh và cấu hình tích hợp → nghiệm thu UI và hành trình toàn bộ → chuẩn bị deploy.

Hoa hồng vẫn ngoài hệ thống. Quy định hủy đơn/hoàn tiền được để lại theo yêu cầu.

Luồng tiếp nhận mới và hướng dẫn Admin: `COMPANY_INTAKE.md`. Không gửi hồ sơ/CV thử tới hệ thống thật hoặc gửi email thử cho người thật.

Hướng dẫn hồ sơ công ty: `COMPANY_PORTFOLIO.md`. Trích đoạn mới chỉ có tiêu đề/nội dung/ảnh đã duyệt; không tự lấy toàn bộ file bàn giao, tài liệu, thông tin đội làm hay dữ liệu tài chính để công khai.

Chat đã được kiểm tra SQL rollback và HTTP giả lập; kiểm tra API thật chỉ đọc danh sách/hội thoại/tài liệu đã có. Không gửi tin nhắn hoặc tải tệp test vào hội thoại thật. Hướng dẫn: `SERVICE_CHAT.md`.

Hướng dẫn phát sinh: `ORDER_VARIATIONS.md`. Cọc đã thỏa thuận giữ nguyên; tiền phụ lục đã chốt cộng vào khoản còn phải thu. Phát sinh có chỉ tiêu theo kỳ xác nhận riêng trên thống kê. Chưa gửi phụ lục hoặc xác nhận khoản thu thử vào đơn thật.

Đợt 035: build/lint backend và frontend đạt; **129 backend HTTP/unit tests**, **14 frontend unit tests** và **16 bộ SQL** đạt. Migration 035 đã áp dụng vào database cấu hình; dữ liệu thử SQL rollback. Đã kiểm tra cả thay người trước khởi tạo sản xuất, giữ chỗ giữa hai Staff, từ chối/hết hạn, người cũ mất quyền, giữ hợp đồng/số tiền, trách nhiệm và hạn mới, bàn giao đủ đội và đánh giá đúng Creator mới. **156 kiểm tra quyền API chỉ đọc trên 6 tài khoản test đạt**; hướng dẫn trong `EXECUTION_COORDINATION.md`. Chưa triển khai code lên web đang deploy.

Đợt 036: migration đã áp dụng, 004–035 giữ nguyên checksum. Build/lint backend/frontend, **144 backend HTTP/unit tests**, **14 frontend unit tests**, **17 bộ SQL rollback** đạt. Hồ sơ Creator và tìm kiếm/đánh giá/lịch nhận việc đã nối API và UI; bộ lọc gửi khi áp dụng, module nghề nghiệp tải riêng cho Creator, không tải lại khung ứng dụng. 162 kiểm tra quyền chỉ đọc trên 6 tài khoản test và kiểm tra API công khai đạt. Hướng dẫn: `CREATOR_PROFILES.md`. UI trực tiếp và deploy còn chờ; ảnh không còn tham chiếu chưa được tự dọn.


## Bổ sung nhận diện theo logo — 2026-10-03

Đã thống nhất logo gốc, Montserrat/Inter, token cam–tím–xanh dương và hero hai cột theo reference/mẫu mới. Mã màu chính thức do người dùng xác nhận: #E66C3A / #8E4AAD / #2854DA; xem BRAND_IDENTITY.md. Chưa nghiệm thu UI trực tiếp/chưa deploy. **Tạm hoãn riêng tích hợp ngân hàng/QR/email/ký điện tử theo yêu cầu; dọn ảnh và hoàn thiện UI/UX vẫn tiếp tục. Deploy để sau.**


## Hoàn thiện các bổ sung UI — 2026-10-04

- Logo ngang theo mẫu, giữ biểu tượng khi sidebar thu gọn; nút thu gọn ở cuối sidebar, desktop bỏ nút trùng trên header; click khoảng trống vẫn hoạt động.
- Hero hòa nền navy; home theo prototype, chi tiết dự án theo reference riêng; dịch vụ có giá/thời gian và khối thông tin chi tiết. Các nút service căn hai bên, Creator cùng hàng/cùng chiều cao.
- Footer 4 cột; 4 trang /operating-rules, /terms, /privacy, /payment-policy với mục lục. Nội dung theo phiên bản nghiệp vụ hiện tại, không tự quy định chính sách hoàn tiền chưa chốt.
- Quy trình có 8 card nổi bật; 3 nhóm đối tượng và CTA cam/xanh/tím khác nhau; đối tác có banner nền và thông tin căn chỉnh.
- Bộ lọc dark theme; Creator desktop 6 thành phần cùng hàng, responsive; dự án nổi bật trên home cũng tìm kiếm/lọc/phân trang. Pagination dùng chung căn giữa và ẩn khi không có hoặc chỉ một trang.
- Thông báo có màu/nhãn đọc và chưa đọc, search tiêu đề/nội dung, lọc trạng thái, đánh dấu tất cả và phân trang. API kiểm tra user_id từ xác thực, từ chối overposting; search escape wildcard và quoted PostgREST filter.
- Dashboard thông báo gần đây gọn, có trạng thái/thời gian, link danh sách; tiến độ nằm bên cạnh trên desktop.
- Chat rộng hơn (chỉ rail + hội thoại), tài liệu/công cụ mở native dialog có backdrop/Escape/focus về nút; link sự kiện mở đúng mục trong dialog. Tin nhắn fit-content, trái/phải, composer rộng; bỏ Làm mới trong header. Giữ realtime/history, reply, ảnh/PDF/video và URL an toàn.
- Lỗi API công khai/chat cũ do tiến trình backend local chạy bản dist cũ; đã khởi động lại bản build hiện tại tại 5000. Không coi mọi 404 là lỗi: tài nguyên không tồn tại/không có quyền vẫn bị chặn.

Kiểm tra: 145 backend tests, 14 frontend tests; build/lint frontend, build backend, bundle secrets scan, diff whitespace đạt. 180 lượt kiểm tra quyền API thật chỉ đọc trên 6 tài khoản; không gửi chat/tệp thử, không đánh dấu thông báo thật. Ảnh và log tại .qa/ui-2026-10-04 và .qa/backend-tests-2026-10-04.log. Trang công khai và mobile Creator 390px đã kiểm tra trực tiếp (không tràn ngang, CTA cùng hàng). Bản preview riêng 5174 dùng tài khoản QA đã xác nhận login/register, dashboard, sidebar thu gọn còn logo, notification đọc/chưa đọc/search/empty và chuyển trang 10 thông báo/trang (18 kết quả, trang 2 có 8), modal tài liệu và mở báo giá từ sự kiện chat; Escape đóng modal và trả focus về nút, ô nhập rộng 707px và tin ngắn chỉ 265px ở viewport desktop. Không gửi chat/upload/chấp nhận thương mại hoặc bấm read-all trên database thật; phép mutation này được test bằng fixture. Phiên gốc người dùng giữ nguyên. Chưa deploy; ngân hàng/QR/email/e-sign vẫn tạm hoãn.
