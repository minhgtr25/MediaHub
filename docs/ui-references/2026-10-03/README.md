# Ảnh tham khảo UI/UX MediaHub — 2026-10-03

Người dùng gửi 12 ảnh để bổ sung cho `UI_UX_SUPPLEMENT.md`. Các ảnh gốc đã được sao lưu trong thư mục này và kiểm tra bản sao bằng SHA-256. Ảnh chỉ là tài liệu tham khảo, không chứng minh phiên bản API/database đang chạy hoặc thay thế nghiệp vụ đã chốt. Ảnh 3/4 và 6/7 trùng nhau.

| Ảnh | Vai trò | Điểm dùng khi triển khai |
| --- | --- | --- |
| [01 — Messenger](C:/Users/HuyNguyen/FA26/EXE/MediaHub/docs/ui-references/2026-10-03/01-chat-layout-reference.png) | Mẫu tổ chức chat | Danh sách trái, hội thoại giữa, chi tiết phải; header và composer cố định, mỗi vùng cuộn riêng, panel phụ đóng/mở. Giữ brand MediaHub và công cụ theo quyền; không thêm chat riêng hoặc các chức năng Facebook không thuộc yêu cầu. |
| [02 — Thanh toán hiện tại](C:/Users/HuyNguyen/FA26/EXE/MediaHub/docs/ui-references/2026-10-03/02-payment-current.png) | Hiện trạng cần cải thiện | Empty state có hướng dẫn bước tiếp theo và đường tới đơn/hội thoại; phân biệt trang thanh toán cũ với khoản thu của đơn dịch vụ mới. Copy phải nói đúng người phụ trách và điều kiện phát hành yêu cầu thanh toán. |
| [03 — Đơn dịch vụ](C:/Users/HuyNguyen/FA26/EXE/MediaHub/docs/ui-references/2026-10-03/03-orders-current.png), [04 — ảnh trùng](C:/Users/HuyNguyen/FA26/EXE/MediaHub/docs/ui-references/2026-10-03/04-orders-current-repeat.png) | Hiện trạng cần cải thiện | Khung đã rộng nhưng dữ liệu dồn trái và khoảng trống bên trong lớn. Tổ chức mã ngắn/tên/trạng thái/giá/Staff và hạn khi có dữ liệu, hành động rõ; giảm chiều cao card khi ít nội dung. Không chỉ tăng container hoặc sửa mã đối soát. |
| [05 — Sidebar Customer](C:/Users/HuyNguyen/FA26/EXE/MediaHub/docs/ui-references/2026-10-03/05-customer-sidebar-current.png) | Hiện trạng cần sắp xếp | Nhóm menu theo hành trình, bỏ Trung tâm hỗ trợ khỏi menu Customer, tránh trùng Yêu cầu dịch vụ/Yêu cầu tư vấn, đổi nhãn Thanh toán, thêm thu gọn/tooltip và header chung. |
| [06 — Form yêu cầu](C:/Users/HuyNguyen/FA26/EXE/MediaHub/docs/ui-references/2026-10-03/06-request-form-current.png), [07 — ảnh trùng](C:/Users/HuyNguyen/FA26/EXE/MediaHub/docs/ui-references/2026-10-03/07-request-form-current-repeat.png) | Hiện trạng cần cải thiện | Dùng khoảng trống phải cho panel Hướng dẫn/Thông tin dịch vụ; form 65–70%, panel 30–35%; bỏ trường Link tham khảo mới. |
| [08 — Lựa chọn Creator](C:/Users/HuyNguyen/FA26/EXE/MediaHub/docs/ui-references/2026-10-03/08-request-creator-selection-current.png) | Chi tiết tương tác form | Chọn dịch vụ/Creator thì cập nhật panel, giữ dữ liệu nhập và focus; chọn mong muốn tư vấn không đồng nghĩa Creator đã nhận phân công. |
| [09 — Quy trình sáu ô](C:/Users/HuyNguyen/FA26/EXE/MediaHub/docs/ui-references/2026-10-03/09-six-stage-process-current.png) | Hiện trạng cần thay bố cục | Giữ thông tin đúng nghiệp vụ, thay sáu ô bằng hành trình tám chặng hardcode theo tài liệu bổ sung. Desktop có đường nối, mobile timeline dọc. |
| [10 — Tiêu đề portfolio](C:/Users/HuyNguyen/FA26/EXE/MediaHub/docs/ui-references/2026-10-03/10-project-portfolio-heading-reference.png) | Mẫu nội dung cần giữ | HỒ SƠ DỰ ÁN / Dự án nổi bật / Những sản phẩm được MediaHub quản lý và triển khai. Hợp nhất khu vực portfolio, có CTA và hồ sơ chi tiết. |
| [11 — Lỗi khu vực dự án](C:/Users/HuyNguyen/FA26/EXE/MediaHub/docs/ui-references/2026-10-03/11-project-excerpts-route-error.png) | Lỗi cần điều tra riêng | Ảnh hiển thị “Không tìm thấy đường dẫn”. Cần kiểm tra API base URL/proxy, route đang chạy và phiên bản ứng dụng trước khi sửa giao diện. Chưa kết luận nguyên nhân từ ảnh; không trả empty state như thể database không có dữ liệu. |
| [12 — Landing hai đối tượng](C:/Users/HuyNguyen/FA26/EXE/MediaHub/docs/ui-references/2026-10-03/12-two-audience-landing-current.png) | Hiện trạng cần mở rộng | Thay bằng ba nhóm, ba CTA Yêu cầu tư vấn / Liên hệ doanh nghiệp / Ứng tuyển vào MediaHub; cân đối chiều cao, typography và nội dung theo từng đối tượng. |

## Các điểm ưu tiên rút ra từ ảnh

1. Điều tra lỗi route phần portfolio và phân biệt lỗi tải/không có dữ liệu.
2. Dashboard shell: header dùng chung, sidebar đúng nhóm và thu gọn.
3. Form có panel bên phải theo dịch vụ/Creator, giữ dữ liệu đang nhập.
4. Card đơn và trang thanh toán có mật độ thông tin, copy và hành động đúng luồng.
5. Landing ba nhóm, portfolio một khu vực và hành trình tám chặng.
6. Chat ba vùng, panel phụ đóng/mở độc lập, dữ liệu hiển thị đúng quyền.

Ảnh hiện trạng không phải bản nghiệm thu thiết kế. Đợt cập nhật này lưu ảnh và bổ sung kế hoạch; chưa thay đổi giao diện hoặc chạy kiểm thử trình duyệt.
