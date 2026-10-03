Cập nhật 03/10/2026: migration **034** đã áp dụng cho phát sinh/phụ lục trong cùng hội thoại: phiên bản báo giá, xác nhận Customer, công nợ, mốc/lịch mới và thống kê theo kỳ; Creator chỉ thấy phạm vi đã chốt. Nghiệm thu trình duyệt còn chờ. Xem `ORDER_VARIATIONS.md` và `TIEN_DO_HOAN_THIEN.md`.

# MediaHub — kế hoạch đã chốt

Cập nhật 03/10/2026: migration **033** đã triển khai cho chat dịch vụ dùng chung, tìm kiếm/preview/unread, panel độc lập, reply và tệp theo quyền; API/SQL/build đạt, nghiệm thu trình duyệt còn chờ. Xem `SERVICE_CHAT.md` và `TIEN_DO_HOAN_THIEN.md`.


Cập nhật 03/10/2026: đã triển khai và áp dụng migration **032** cho danh sách hồ sơ công ty hợp nhất, trang chi tiết trích đoạn và phân trang/tìm kiếm chung. Khung UI tải độc lập dữ liệu; kiểm thử API/SQL/build đã đạt, nghiệm thu trình duyệt và deploy còn chờ. Xem `COMPANY_PORTFOLIO.md` và `TIEN_DO_HOAN_THIEN.md`.


Chốt ngày 2026-10-03; người dùng đã yêu cầu triển khai. Tài liệu này thay thế các quyết định role/hoa hồng/phân công trước đó. Giữ nguyên danh tính và dữ liệu đang có; không sửa migration đã áp dụng, không tự deploy. Yêu cầu UI/UX bổ sung cùng ngày được hợp nhất tại `UI_UX_SUPPLEMENT.md`; các mục dưới đây ghi rõ thay đổi so với giao diện đã triển khai.

## Role

- Guest: xem nội dung công khai; không phải role tài khoản.
- Customer: gửi yêu cầu, trao đổi, chọn đội Creator, xác nhận báo giá/hợp đồng, thanh toán, nghiệm thu và đánh giá.
- Staff: tư vấn, báo giá trong quy định công ty, điều phối, xác nhận tiền ở bước thanh toán cuối và bàn giao.
- Creator: Admin cấp tài khoản sau hợp đồng hợp tác; xác nhận nhận việc, cập nhật tiến độ, gửi sản phẩm.
- Admin: hệ thống, tài khoản, danh sách import Creator, đối tác, tài chính, nhật ký và nội dung công khai.
- Role cấp mới: CUSTOMER, STAFF, CREATOR, ADMIN. BUSINESS là quan hệ đối tác; STUDENT_CREATOR là phân loại hồ sơ. Các giá trị cũ được giữ trong giai đoạn migration có kiểm soát.

## Phân công và hội thoại

- Yêu cầu tự giao cho Staff đang không tư vấn yêu cầu chưa chốt; ưu tiên thời gian rảnh lâu nhất. Không có người rảnh thì vào hàng đợi. Chốt đơn giải phóng suất tư vấn; Staff vẫn quản lý đơn cũ.
- Một dự án có nhiều Creator, mỗi người có phần việc/hạn riêng. Customer và Staff thống nhất rồi gửi yêu cầu xác nhận; giữ chỗ chống giao trùng. Phản hồi 5–15 phút; Staff liên hệ trực tiếp cùng lúc. Creator bận đến khi dự án bàn giao xong.
- Mỗi yêu cầu có một hội thoại xuyên suốt. Tạo đơn/thay Staff/thêm Creator không tạo chat mới. Không có chat riêng Customer–Creator trong hệ thống. Một yêu cầu độc lập mới có hội thoại mới.
- Trái: hội thoại; giữa: tin nhắn; phải: công cụ/tài liệu theo quyền. Ghi chú nội bộ riêng. Trao đổi ngoài hệ thống phải cập nhật tiến độ/thống nhất liên quan.

## Thương mại và sản xuất

- Tư vấn → đội Creator xác nhận → báo giá → đơn → hợp đồng/ ký điện tử → cọc tối thiểu 30% → sản xuất → bản nghiệm thu có watermark → Customer duyệt → thu phần còn lại → Staff xác nhận đủ tiền → bàn giao đầy đủ bản không watermark → hoàn thành.
- Customer khởi tạo phát sinh trong dự án; Staff báo giá/phạm vi/thời hạn; Customer xác nhận phụ lục trước khi làm. Không ghi đè hợp đồng đã ký; tính khoản bổ sung vào điều kiện thu đủ.
- Phân biệt sửa lỗi, sửa trong phạm vi và đổi phạm vi; trễ hạn có lý do/bên liên quan/hạn mới, không suy đoán lỗi. Customer đề nghị đổi Creator; Staff duyệt.
- Bản cuối private, không cấp URL cho Customer trước khi thu đủ. Thu đủ nhưng chưa bàn giao đủ chưa hoàn thành. Không yêu cầu nghiệm thu lại nếu chỉ bỏ watermark bản đã duyệt.
- Hủy/hoàn tiền để hoàn thiện sau, Staff tiếp nhận/Admin xử lý, chưa tự động hoàn tiền.

## Thống kê và nội dung

- Staff theo tháng/năm: đã tư vấn, chốt đơn, đang làm/hoàn thành, giá trị bán, tiền thực nhận trong tháng, còn phải thu và hạn. Admin xem toàn bộ/truy chứng từ. Tách người chốt và người phụ trách, không chuyển thành tích theo phân công hiện tại.
- Hoa hồng ngoài hệ thống; không thêm tính toán/chi trả hoa hồng.
- Customer đánh giá kết quả và từng Creator đã tham gia sau hoàn thành; sửa 7 ngày từ lần gửi đầu.
- Customer chọn hiện tên/ẩn danh, thông báo quy định dùng trích đoạn nhỏ khi chốt. Admin duyệt trích đoạn sau hoàn thành và kiểm tra thông tin nhận diện.
- Hồ sơ Customer/Staff/Creator tự cập nhật avatar; Creator có portfolio. Hồ sơ đối tác có chi tiết công khai.

## UI và tích hợp

- Tài liệu bổ sung có 12 ảnh đã lưu trong `docs/ui-references/2026-10-03/`, với bảng đối chiếu trong README. Dùng ảnh Messenger làm mẫu bố cục chat; ảnh MediaHub là hiện trạng cần chỉnh. Lỗi “Không tìm thấy đường dẫn” ở khu vực portfolio phải được điều tra API/route/phiên bản đang chạy, không thay bằng thông báo không có dữ liệu để che lỗi.
- Landing có ba nhóm nội dung: cá nhân/doanh nghiệp nhỏ → **Yêu cầu tư vấn**; doanh nghiệp/công ty/agency → **Liên hệ doanh nghiệp** qua email/form ngắn; Creator/sinh viên → **Ứng tuyển vào MediaHub** với email, CV, portfolio/link và chuyên môn. Không tạo role mới; ứng tuyển không tự cấp tài khoản Creator, vẫn cần hợp đồng hợp tác rồi Admin cấp/import.
- Portfolio công ty dùng **HỒ SƠ DỰ ÁN / Dự án nổi bật / Những sản phẩm được MediaHub quản lý và triển khai.**, CTA **Xem hồ sơ dự án →**; thay tên “Dự án đã hoàn thành”. Hợp nhất trình bày portfolio cũ và trích đoạn mới, có hồ sơ chi tiết theo dữ liệu thực; gallery/team/kết quả công khai vẫn phải giữ quy định trích đoạn nhỏ, Admin duyệt và tên/ẩn danh.
- Chuẩn hóa ảnh/thẻ/chữ/tương phản/khoảng cách/nút; dịch vụ luôn qua tư vấn, dùng “Yêu cầu tư vấn”. Quy trình thiết kế cố định trong mã nguồn, dùng chung trang chủ/trang Quy trình, không lấy database, không phân trang và không chờ API. **Thay sáu ô hiện tại bằng hành trình tám chặng**: Gửi yêu cầu → MediaHub tư vấn → Thống nhất phạm vi & báo giá → Xác nhận hợp đồng & đặt cọc → MediaHub triển khai → Khách hàng nghiệm thu → Thanh toán → Bàn giao dự án. Desktop có đường nối, mobile timeline dọc; footer/contact rõ ràng.
- Sidebar Customer theo nhóm Tổng quan; Dịch vụ (Gửi yêu cầu, Yêu cầu tư vấn); Công việc (Đơn dịch vụ, Dự án); Tài chính (Báo giá, Thanh toán, Hóa đơn); Tài khoản (Thông báo, Hồ sơ & Bảo mật). Bỏ Trung tâm hỗ trợ khỏi menu Customer, dùng hội thoại tư vấn hiện có; giữ dữ liệu hỗ trợ lịch sử. Sidebar thu gọn có tooltip và lưu trạng thái localStorage; header chung có breadcrumb, tìm kiếm theo quyền, thông báo, avatar/tên/role/menu hồ sơ.
- Form yêu cầu trên desktop chia form 65–70%, panel phải 30–35% với tab Hướng dẫn và Thông tin dịch vụ. Dịch vụ/Creator thay đổi thì cập nhật panel tương ứng, không mất input hoặc nhận nhầm phản hồi tải cũ. Bỏ trường Link tham khảo khỏi form mới, không xóa link lịch sử; upload tham khảo trong form để sau. CV ứng tuyển là phần riêng.
- Chat dịch vụ dùng chung bố cục danh sách trái / hội thoại giữa / chi tiết và công cụ phải; cả hai panel phụ ẩn/hiện độc lập. Bổ sung tìm hội thoại, preview/unread, timestamp, reply, ảnh/tệp/link trong phạm vi quyền; Creator không thấy tin thương mại hoặc nội dung reply/tệp vượt quyền. Không tạo hội thoại mới khi đổi bước hoặc đổi bố cục.
- Tận dụng chiều rộng desktop, hướng tới max-width 1600px khi phù hợp; responsive tablet/mobile. Skeleton/empty/error/retry/thông báo/xác nhận theo tác vụ. Mã hiển thị đơn ngắn, ổn định và duy nhất từ server; giữ ID kỹ thuật, chứng từ và nội dung đối soát đã phát hành, không cắt UUID làm mã hoặc sửa mã chuyển khoản lịch sử.
- Khung cố định hiển thị ngay, tải theo vùng; giữ dữ liệu/draft/scroll khi làm mới, thu hồi cache khi mất quyền. Không báo thành công tài chính/ký/phân công trước server.
- Ngân hàng/QR theo số tiền và mã đơn, ký điện tử và email thực tế tích hợp cuối khi có cấu hình công ty. Không giả biên nhận/chữ ký hoặc gửi email thử đến người thật.

## Thứ tự

1. Quyền cấp mới, điều phối Staff an toàn, kế hoạch và quy chuẩn UI.
2. Đội Creator/xác nhận giữ chỗ, cấp tài khoản/import, hội thoại và công cụ dùng chung.
3. Phụ lục, sản phẩm/version/duyệt, xác nhận thu đủ/bàn giao cuối.
4. Thống kê tháng, hồ sơ/ảnh, đánh giá/nội dung công khai.
5. Áp dụng các hạng mục bổ sung trong `UI_UX_SUPPLEMENT.md`: dashboard shell → form và panel động → landing/liên hệ/ứng tuyển → portfolio/hành trình tám chặng → chat/panel → quy chuẩn và kiểm thử. Những nghiệp vụ phụ lục/đổi Creator/trễ hạn vẫn phải hoàn thiện.
6. Cấu hình công ty/tích hợp thực, kiểm thử các role, mobile/desktop và kiểm tra dữ liệu.

Mỗi phần có kiểm tra API/SQL phù hợp và cập nhật REFACTOR_PROGRESS.md. Các bảng lịch sử trong tài liệu khác mô tả implementation cũ, không thay thế quyết định này.

## Tiến độ UI bổ sung — 03/10/2026

Đã triển khai Dashboard dùng chung, sidebar thu gọn/lưu trạng thái, menu Customer theo nhóm, tìm kiếm thật theo role, form yêu cầu hai cột/panel động và hành trình 8 chặng cố định. Frontend build/lint, 12 unit tests và 6 API công khai chỉ đọc đã qua. Browser QA và triển khai bản mới còn chờ; migration mới nhất vẫn là 030. Portfolio mới chỉ đồng bộ lời giới thiệu trang chủ, chưa hợp nhất hoàn toàn hoặc bổ sung route chi tiết trích đoạn. Chi tiết việc còn lại trong `TIEN_DO_HOAN_THIEN.md` và `REFACTOR_PROGRESS.md`.

Đợt tiếp theo cùng ngày đã áp dụng migration 031 và triển khai landing ba nhóm, form doanh nghiệp/Creator, CV riêng tư và màn tiếp nhận Admin. Chỉ ghi nhận hồ sơ; không tự cấp tài khoản hoặc gửi email. SMTP và browser QA còn chờ; hướng dẫn trong `COMPANY_INTAKE.md`.

## Cập nhật 035 — 03/10/2026

Đã hoàn thiện module đổi Creator và trễ hạn ở SQL/API/giao diện: giữ người cũ đến khi người mới tự xác nhận, giữ chỗ giữa các Staff, cập nhật đội/hội thoại hiện tại và giữ hợp đồng gốc; báo cáo nguyên nhân, Staff chốt trách nhiệm/lịch mới. Tab **Điều phối & lịch** dùng chung khu tài liệu; Creator nhận lời mời tại trang công việc, không phát sinh chat mới. Kiểm thử SQL có rollback và HTTP đã qua; UI trên trình duyệt và deploy chưa xác minh. Chi tiết: `EXECUTION_COORDINATION.md`, `TIEN_DO_HOAN_THIEN.md`. Tiếp theo là hồ sơ/tìm Creator, tích hợp công ty và nghiệm thu toàn bộ.

## Cập nhật 036 — 03/10/2026

Đã bổ sung hồ sơ nghề nghiệp Creator tự sửa chuyên môn/portfolio, tải ảnh bìa/portfolio theo quyền, đồng bộ tìm kiếm công khai/Staff với đánh giá đã xác minh và lịch nhận việc từ phân công/giữ chỗ. Giữ các trường công ty quản lý; không thêm role/tài khoản/hội thoại. Kiểm tra code/SQL đạt; browser QA và deploy vẫn chờ. Vòng đời ảnh không còn tham chiếu và tích hợp công ty là việc còn lại. Chi tiết: `CREATOR_PROFILES.md`, `TIEN_DO_HOAN_THIEN.md`.
