Cập nhật 03/10/2026: migration **034** đã áp dụng cho phát sinh/phụ lục trong cùng hội thoại: phiên bản báo giá, xác nhận Customer, công nợ, mốc/lịch mới và thống kê theo kỳ; Creator chỉ thấy phạm vi đã chốt. Nghiệm thu trình duyệt còn chờ. Xem `ORDER_VARIATIONS.md` và `TIEN_DO_HOAN_THIEN.md`.

> Cập nhật 03/10/2026, migration 031: đã có landing ba nhóm, form liên hệ doanh nghiệp/ứng tuyển Creator và nơi Admin tiếp nhận CV riêng tư. Xem `COMPANY_INTAKE.md`. Email phản hồi hiện mở trình soạn email; SMTP và nghiệm thu trình duyệt còn chờ.

Cập nhật 03/10/2026: migration **033** đã triển khai cho chat dịch vụ dùng chung, tìm kiếm/preview/unread, panel độc lập, reply và tệp theo quyền; API/SQL/build đạt, nghiệm thu trình duyệt còn chờ. Xem `SERVICE_CHAT.md` và `TIEN_DO_HOAN_THIEN.md`.


Cập nhật 03/10/2026: đã triển khai và áp dụng migration **032** cho danh sách hồ sơ công ty hợp nhất, trang chi tiết trích đoạn và phân trang/tìm kiếm chung. Khung UI tải độc lập dữ liệu; kiểm thử API/SQL/build đã đạt, nghiệm thu trình duyệt và deploy còn chờ. Xem `COMPANY_PORTFOLIO.md` và `TIEN_DO_HOAN_THIEN.md`.


> Cập nhật triển khai 03/10/2026: đã viết code Dashboard/header/sidebar, menu Customer, form hai cột và quy trình 8 chặng. Build/lint và 12 kiểm tra frontend đã qua; kiểm tra giao diện/bàn phím trực tiếp trên trình duyệt còn chờ. Các checkbox dưới đây là nghiệm thu đầy đủ nên chưa đánh dấu thay cho browser QA. Bảng tiến độ: `TIEN_DO_HOAN_THIEN.md`.

# MediaHub — yêu cầu UI/UX bổ sung

Bổ sung ngày 2026-10-03 theo tài liệu người dùng gửi. Đây là yêu cầu đã đưa vào phạm vi triển khai; cập nhật tài liệu không có nghĩa các chức năng bên dưới đã được viết hoặc kiểm thử. `IMPLEMENTATION_PLAN.md` vẫn là kế hoạch nghiệp vụ chính. Bản bổ sung này thay thế yêu cầu giao diện sáu ô quy trình trước đây bằng hành trình tám chặng.

Người dùng bổ sung 12 ảnh tham khảo, đã lưu tại `docs/ui-references/2026-10-03/`; bảng đối chiếu từng ảnh nằm trong README của thư mục. Messenger là mẫu tổ chức chat; các ảnh MediaHub ghi hiện trạng cần chỉnh. Ảnh 9 vẫn là sáu ô cũ, không thay thế yêu cầu hành trình tám chặng; ảnh 10 là mẫu tên portfolio cần dùng. Ảnh 11 cho thấy lỗi route phần dự án: cần điều tra cấu hình/phiên bản API đang chạy, không che lỗi bằng empty state. Card đơn trong ảnh đã rộng nhưng phân bố thông tin chưa hợp lý; cần sửa bên trong card, không chỉ nới container.

## 1. Landing page: ba nhóm đối tượng

| Nhóm | Nội dung chính | CTA và nơi tiếp nhận |
| --- | --- | --- |
| Cá nhân / doanh nghiệp nhỏ / chủ kinh doanh | Thuê media, hình ảnh, video quảng cáo, branding, social media; gửi brief để được tư vấn | **Yêu cầu tư vấn** → luồng yêu cầu dịch vụ hiện có; đăng nhập Customer khi gửi yêu cầu |
| Doanh nghiệp / công ty / agency | Hợp tác dài hạn, chiến dịch, outsource media, dự án phức tạp | **Liên hệ doanh nghiệp** → email hoặc form liên hệ ngắn; công ty tiếp tục trao đổi qua email |
| Creator / sinh viên / người muốn tham gia | Tham gia dự án thực tế, xây portfolio, tích lũy kinh nghiệm, cơ hội thu nhập và làm cùng đội MediaHub | **Ứng tuyển vào MediaHub** → email, CV, portfolio/link sản phẩm và chuyên môn; công ty nhận hồ sơ và trao đổi qua email |

Ba nhóm là nhóm nội dung tiếp thị, không phải ba role mới. Role cấp mới vẫn là CUSTOMER, STAFF, CREATOR, ADMIN; Guest không có tài khoản. Sinh viên là thông tin hồ sơ. Gửi ứng tuyển không tự cấp role Creator: công ty xét hồ sơ, ký hợp đồng hợp tác rồi Admin cấp tài khoản/import theo luồng đã chốt. Hồ sơ ứng tuyển và CV riêng tư, không đưa vào portfolio công khai.

## 2. Portfolio công ty

- Thay tên **Dự án đã hoàn thành** bằng cụm nội dung: **HỒ SƠ DỰ ÁN** / **Dự án nổi bật** / **Những sản phẩm được MediaHub quản lý và triển khai.**
- Một khu vực portfolio thống nhất, tránh hai khối cùng tên hoặc nội dung trùng nhau giữa dữ liệu portfolio cũ và trích đoạn dự án mới.
- Thẻ có thumbnail cùng tỉ lệ, tên, khách hàng hoặc lĩnh vực, loại dịch vụ, thời gian và mô tả ngắn theo dữ liệu thực có. CTA: **Xem hồ sơ dự án →**.
- Trang hồ sơ có thể bổ sung hạng mục MediaHub thực hiện, kết quả, team công khai và gallery ảnh/video. Các trường thiếu thì ẩn, không điền thông tin giả.
- Dự án từ đơn dịch vụ chỉ được công khai sau hoàn thành và Admin duyệt; giữ lựa chọn tên/ẩn danh. Ảnh, chữ, video/gallery đều chỉ là trích đoạn đã kiểm tra. Không công khai bản bàn giao đầy đủ, chat, hợp đồng, chứng từ hoặc liên kết private.
- Empty state: **Hồ sơ dự án đang được cập nhật.** Trường hợp không tồn tại: thông báo dễ hiểu kèm lối quay lại. Lỗi tải: thông báo và nút thử lại; không biến lỗi máy chủ thành trạng thái không có dữ liệu và không đưa thông báo kỹ thuật ra trang công khai.

## 3. Quy trình: hành trình tám chặng

1. **Gửi yêu cầu** — khách cung cấp nhu cầu và brief.
2. **MediaHub tư vấn** — Staff nhận việc, làm rõ nhu cầu và đề xuất đội Creator phù hợp.
3. **Thống nhất phạm vi & báo giá** — chốt phần việc; Creator xác nhận phân công trước khi xuất bản báo giá.
4. **Xác nhận hợp đồng & đặt cọc** — khách xác nhận điều khoản; khoản cọc tối thiểu 30% theo báo giá được kiểm tra thực nhận.
5. **MediaHub triển khai** — Creator thực hiện, cập nhật tiến độ; Staff điều phối và theo dõi.
6. **Khách hàng nghiệm thu** — duyệt bản có watermark hoặc phản hồi chỉnh sửa trong phạm vi.
7. **Thanh toán** — khách trả phần còn thiếu; Staff phụ trách xác nhận đã thực nhận đủ.
8. **Bàn giao dự án** — Creator gửi toàn bộ bản không watermark; chỉ hoàn thành khi cả đội bàn giao đủ.

Desktop dùng timeline/roadmap có đường nối, không dùng sáu ô rời. Mobile dùng timeline dọc. Có thể highlight chặng khi cuộn; không gây chuyển động khi người dùng chọn giảm hiệu ứng. Nội dung dùng chung trang chủ/trang Quy trình, được định nghĩa cứng trong mã nguồn, không tải database hoặc phân trang.

Highlight khi cuộn trên landing page chỉ biểu thị chặng đang được giới thiệu. Trạng thái thực tế của đơn ở workspace lấy từ workflow đã xác nhận; không suy ra từ vị trí cuộn hoặc tự đổi trạng thái đơn.

## 4. Sidebar và tư vấn Customer

- Bỏ mục **Trung tâm hỗ trợ** khỏi sidebar Customer. Điểm trao đổi chính là **Yêu cầu tư vấn / Tư vấn dự án**, dẫn tới hội thoại dịch vụ hiện có.
- Không tạo chat hỗ trợ mới cho một yêu cầu đã có hội thoại. Việc ẩn menu không xóa ticket hoặc lịch sử cũ; quyền xử lý hỗ trợ Staff/Admin vẫn được giữ cho đến khi có thay đổi riêng.
- Sắp xếp menu theo hành trình:

| Nhóm | Mục |
| --- | --- |
| Tổng quan | Tổng quan |
| Dịch vụ | Gửi yêu cầu; Yêu cầu tư vấn |
| Công việc | Đơn dịch vụ; Dự án |
| Tài chính | Báo giá; Thanh toán; Hóa đơn |
| Tài khoản | Thông báo; Hồ sơ & Bảo mật |

- Dùng **Thanh toán** thay cho **Cọc & Thanh toán**. Tư vấn dự án là tên điểm vào hội thoại, không thêm một mục khác trùng chức năng với Yêu cầu tư vấn.
- Các trang báo giá/thanh toán/hóa đơn phải mở đúng dữ liệu được cấp quyền; đơn mới ưu tiên workflow đơn dịch vụ. Không gộp hoặc đoán chứng từ, khoản thu từ sổ dữ liệu cũ.

## 5. Form yêu cầu dịch vụ và panel thông tin

- Desktop: form khoảng 65–70%, panel phải 30–35%; tablet/mobile chuyển bố cục phù hợp, không để khoảng trống lớn hoặc thu form quá hẹp.
- Panel phải có hai tab **Hướng dẫn** và **Thông tin dịch vụ**.
- Hướng dẫn nhắc khách chuẩn bị mục tiêu, đối tượng khách hàng, loại nội dung, số lượng sản phẩm, ngân sách dự kiến, deadline, phong cách và yêu cầu đặc biệt; có thể dùng checklist.
- Thông tin dịch vụ đổi theo lựa chọn trong form: mô tả, quy trình, thời gian dự kiến, sản phẩm nhận được, khoảng ngân sách tham khảo. Chỉ hiển thị các thông tin có dữ liệu; giá tham khảo chưa phải báo giá được chốt.
- Khi chọn Creator cụ thể, panel thêm avatar, tên, chuyên môn, kỹ năng, portfolio và dự án đã thực hiện. Chọn Creator ở đây thể hiện mong muốn tư vấn, chưa phải phân công/giữ chỗ đã được xác nhận.
- Cập nhật ngay vùng thông tin theo lựa chọn; chỉ tải dữ liệu cần thiết, giữ nguyên form và dữ liệu đang nhập. Hủy/bỏ phản hồi cũ nếu khách đổi lựa chọn trước khi request tải xong.
- Bỏ trường **Link tham khảo (HTTPS, mỗi link một dòng, tối đa 10)** khỏi form tạo yêu cầu mới. Giữ dữ liệu link lịch sử trong database; không xóa những tham chiếu đã lưu.
- Chưa mở rộng upload tài liệu tham khảo trong form mới ở đợt này. Tệp/chat/tài liệu đã có trong workspace vẫn dùng được; CV ở form ứng tuyển là một nhu cầu riêng cần triển khai.

## 6. Dashboard shell dùng chung

- Sidebar có trạng thái mở rộng và thu gọn; có nút đóng/mở. Khi thu gọn giữ icon, tên truy cập và tooltip dùng được bằng chuột/bàn phím.
- Lưu trạng thái bố cục bằng localStorage để reload vẫn giữ lựa chọn. Chỉ lưu lựa chọn giao diện, không lưu thêm nội dung chat hoặc dữ liệu riêng tư.
- Header thống nhất cho Customer/Staff/Creator/Admin: nút sidebar, breadcrumb, tìm kiếm theo phạm vi phù hợp, thông báo, avatar, tên, role và menu hồ sơ/đăng xuất. Search phải có chức năng thực và tuân theo quyền, không đặt ô tìm kiếm trang trí.
- Mobile dùng điều hướng dạng drawer phù hợp; mở/đóng panel không làm mất focus, dữ liệu nhập hoặc hội thoại đang xem.
- Nội dung desktop tận dụng chiều rộng, hướng tới `width: 100%` và `max-width: 1600px` ở các trang phù hợp. Danh sách đơn/yêu cầu có thông tin rõ và hành động căn chỉnh; dùng hàng rộng hoặc grid responsive theo lượng dữ liệu.

## 7. Chat dịch vụ dùng chung

- Tham khảo cách tổ chức Messenger Desktop: cột danh sách hội thoại, vùng trao đổi chính, panel chi tiết/công cụ. Một yêu cầu xuyên suốt tư vấn đến bàn giao vẫn chỉ có một hội thoại.
- Danh sách: avatar, tên yêu cầu/dự án, Staff phụ trách, tin nhắn gần nhất, thời gian, unread badge và tìm hội thoại. Preview/unread của Creator chỉ tính phần tin nhắn họ được phép xem.
- Header trao đổi: avatar, tên yêu cầu/dự án, Staff phụ trách và trạng thái; hiển thị cả trạng thái chờ Staff khi chưa được phân công.
- Tin nhắn phân biệt người gửi, role và timestamp; hỗ trợ text, ảnh, tệp, link và reply trong phạm vi quyền. Reply không được trích tin nhắn thương mại/nội bộ vào phần TEAM khi Creator không có quyền xem.
- Composer có nút đính kèm, ô nhập và gửi. Chỉ hiển thị các công cụ đã có chức năng; kiểm tra trạng thái gửi, lỗi, retry và tệp theo quyền.
- Panel phải có thông tin dự án, Customer, Staff, đội Creator, trạng thái, deadline; các nhóm có thể thu gọn gồm Thành viên, File phương tiện, Tài liệu dự án, Báo giá, Hợp đồng và các công cụ workflow hiện có.
- Báo giá/hợp đồng/thanh toán chỉ hiện đúng cho Customer/Staff/Admin. Creator chỉ tham gia sau xác nhận phần việc và khách xác nhận hợp đồng; không mở chat riêng Customer–Creator.
- Danh sách trái và panel phải đều có thể ẩn/hiện độc lập; khi ẩn cả hai, vùng trao đổi mở rộng. Không tạo thêm conversation, không làm mất draft, lịch sử hoặc vị trí cuộn khi đổi bố cục.

## 8. Quy chuẩn giao diện và trạng thái

- Giữ dark theme MediaHub; chuẩn hóa chữ, tương phản, khoảng cách, border radius, nút và status badge. Card vừa với nội dung, tránh quá cao; heading phù hợp với cấp thông tin.
- Responsive desktop/tablet/mobile; trạng thái hover/focus rõ ràng. Có skeleton theo vùng, empty state, error/retry, thông báo thao tác và xác nhận cho hành động cần quyết định.
- Khung tĩnh hiện ngay, không chờ API. Không tải lại toàn trang khi một vùng dữ liệu thay đổi; giữ draft/scroll. Thu hồi dữ liệu khi hết quyền hoặc đổi tài khoản.
- Pagination/infinite scroll theo loại danh sách; chat vẫn giữ phân trang lịch sử theo thứ tự ổn định.
- Không đưa UUID hoặc mã đơn dài ra UI. Mã hiển thị ngắn phải ổn định và duy nhất, được cấp từ server, ví dụ **#MH-1024**. Giữ ID kỹ thuật và mã chứng từ/đối soát đã phát hành trong database; không cắt UUID để tạo mã dễ trùng hoặc tự đổi nội dung chuyển khoản cũ.

## 9. Thứ tự triển khai và tiêu chí nghiệm thu

1. Dashboard shell, sidebar/header và menu Customer.
2. Form yêu cầu hai cột/panel động; bỏ link tham khảo trên form.
3. Landing ba đối tượng, liên hệ doanh nghiệp và tiếp nhận ứng tuyển.
4. Portfolio công ty thống nhất và hành trình cố định tám chặng.
5. Chat ba cột, hai panel đóng/mở, tìm kiếm/unread/preview và reply/tệp theo quyền.
6. Chuẩn hóa component, mã hiển thị ngắn, skeleton/lỗi/thông báo; kiểm tra các role và thiết bị.

Phát sinh/phụ lục, đổi Creator, ghi nhận trễ hạn, hồ sơ/portfolio và các tích hợp thật vẫn thuộc kế hoạch chính; bản bổ sung không loại bỏ những việc này. Hoa hồng ngoài hệ thống; hủy/hoàn tiền vẫn để sau.

- [ ] Ba nhóm landing và CTA hoạt động, không tạo role hoặc account ngoài quy trình cấp quyền.
- [ ] Liên hệ doanh nghiệp/ứng tuyển được tiếp nhận và chỉ người phụ trách có quyền đọc hồ sơ; kiểm thử bằng dữ liệu thử, không gửi email thử tới người thật.
- [ ] Portfolio đúng tên, có hồ sơ chi tiết và chỉ trích đoạn được duyệt; empty/error state dễ hiểu.
- [ ] Tám chặng dùng chung, hardcode; desktop có đường nối, mobile timeline dọc.
- [ ] Sidebar Customer đúng thứ tự, thu gọn và giữ trạng thái; header dùng chung có tác vụ thật.
- [ ] Form/panel phản ánh lựa chọn mới nhất, không mất input; không còn trường link tham khảo mới.
- [ ] Chat chỉ có một hội thoại/yêu cầu; cả hai panel đóng/mở; preview/unread/reply/file không vượt quyền.
- [ ] Card/chữ/tương phản/chiều rộng phù hợp và không lộ mã kỹ thuật dài.
- [ ] Browser QA desktop/tablet/mobile, bàn phím, lỗi mạng và thu hồi quyền hoàn tất trước nghiệm thu ứng dụng.

## Cập nhật 035 — 03/10/2026

Đã hoàn thiện module đổi Creator và trễ hạn ở SQL/API/giao diện: giữ người cũ đến khi người mới tự xác nhận, giữ chỗ giữa các Staff, cập nhật đội/hội thoại hiện tại và giữ hợp đồng gốc; báo cáo nguyên nhân, Staff chốt trách nhiệm/lịch mới. Tab **Điều phối & lịch** dùng chung khu tài liệu; Creator nhận lời mời tại trang công việc, không phát sinh chat mới. Kiểm thử SQL có rollback và HTTP đã qua; UI trên trình duyệt và deploy chưa xác minh. Chi tiết: `EXECUTION_COORDINATION.md`, `TIEN_DO_HOAN_THIEN.md`. Tiếp theo là hồ sơ/tìm Creator, tích hợp công ty và nghiệm thu toàn bộ.

## Cập nhật 036 — 03/10/2026

Đã bổ sung hồ sơ nghề nghiệp Creator tự sửa chuyên môn/portfolio, tải ảnh bìa/portfolio theo quyền, đồng bộ tìm kiếm công khai/Staff với đánh giá đã xác minh và lịch nhận việc từ phân công/giữ chỗ. Giữ các trường công ty quản lý; không thêm role/tài khoản/hội thoại. Kiểm tra code/SQL đạt; browser QA và deploy vẫn chờ. Vòng đời ảnh không còn tham chiếu và tích hợp công ty là việc còn lại. Chi tiết: `CREATOR_PROFILES.md`, `TIEN_DO_HOAN_THIEN.md`.
