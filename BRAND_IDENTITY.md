# MediaHub — nhận diện theo logo và mẫu tham khảo

Nguồn: logo.jpg do người dùng cung cấp, bảng nhận diện và hai bố cục landing mới tại docs/ui-references/2026-10-03/brand; tham khảo thêm reference/stitch_mediahub_creative_agency_web_platform. Bố cục mới áp dụng hero hai cột: thông điệp/tư vấn bên trái, hình sản xuất bên phải; xuống một cột trên mobile. Không dùng toàn bộ ảnh mẫu làm website, không sao chép số liệu thành tích mẫu.

## Mã màu đã kiểm tra

| Màu | Mã | Nguồn |
| --- | --- | --- |
| Vibrant Orange | #E66C3A | Mã hợp lệ người dùng cung cấp, giữ làm cam thương hiệu |
| Electric Purple | #8E4AAD | Mã người dùng xác nhận |
| Deep Blue | #2854DA | Mã người dùng xác nhận |

#SE44AD không hợp lệ vì S không phải ký tự hex. #28540A hợp lệ nhưng là xanh lá đậm. Người dùng đã xác nhận thay bằng #8E4AAD và #2854DA, được dùng chính thức trong token; không dùng các màu lấy mẫu gradient làm mã thương hiệu.

Token nằm ở frontend/src/brand.css, được import sau styles.css. Màu chữ trên nền tối dùng sắc độ sáng; nền nút gradient dùng sắc độ đậm để chữ trắng đọc rõ. Không dùng màu trang trí để thay đổi ý nghĩa trạng thái thanh toán/lỗi/thành công.

Montserrat dùng tiêu đề, Inter dùng nội dung với fallback system-ui. Font tải Google Fonts có display=swap, nội dung vẫn hiện khi font chưa tải. JPG gốc được giữ lại; PNG tách nền dùng cho biểu tượng thu gọn và favicon. Wordmark PNG ngang (biểu tượng + chữ MediaHub nghiêng cam/xanh) được phục dựng từ ảnh mẫu bằng imagegen; đây là tài sản raster, không phải bản vector gốc. BrandLogo dùng chung header/footer và sidebar các vai trò. Hero 3D được tạo theo hình tham khảo, hòa viền bằng CSS mask trên nền navy.

Đợt hoàn thiện UI bổ sung API tìm kiếm/lọc thông báo và đánh dấu tất cả đã đọc theo đúng user_id xác thực. Không thay migration/database schema hay quy trình tài chính. Chưa deploy. Tích hợp ngân hàng/QR/email/ký điện tử tạm hoãn theo yêu cầu; dọn ảnh và các hạng mục UI/UX vẫn trong kế hoạch.

Kiểm tra: build/lint frontend, build backend, 145 backend tests và 14 frontend tests đạt. UI công khai đã kiểm tra trên IAB, gồm chuyển trang/tìm kiếm/rỗng và mobile Creator 390px. Workspace được kiểm tra trên bản preview cổng riêng bằng tài khoản QA để giữ nguyên phiên người dùng; đã xác nhận sidebar và tìm/lọc thông báo.
