export function requestsHome(role: string | null) {
  return role === "ADMIN" ? "/admin/requests" : role === "STAFF" ? "/staff/requests" : "/customer/requests";
}
export function requestNextAction(status: string, customer: boolean, assigned: boolean) {
  if (status === "CANCELLED") return "Yêu cầu đã đóng. Bạn có thể xem lại nội dung trao đổi.";
  if (status === "CONVERTED") return "Yêu cầu đã chuyển sang đơn dịch vụ.";
  if (!assigned) return customer ? "MediaHub sẽ phân công nhân viên để làm rõ nhu cầu của bạn." : "Nhận hoặc phân công yêu cầu trước khi xem brief và trao đổi.";
  if (status === "WAITING_CUSTOMER") return customer ? "Vui lòng bổ sung thông tin trong hội thoại bên dưới." : "Theo dõi phản hồi của khách hàng rồi tiếp tục tư vấn.";
  if (status === "ASSIGNED") return customer ? "Nhân viên phụ trách sẽ trao đổi để xác nhận phạm vi và thời gian." : "Bắt đầu tư vấn và làm rõ brief, ngân sách, thời gian thực hiện.";
  if (status === "CREATOR_SELECTION") return customer ? "So sánh đề xuất bên dưới và chọn creator để chuẩn bị báo giá." : "Theo dõi lựa chọn của khách hoặc gửi thêm phương án creator phù hợp.";
  if (status === "QUOTE_PREPARING") return customer ? "Bạn đã chọn creator. Người phụ trách đang chuẩn bị báo giá." : "Lập bản nháp với phạm vi, giá và chính sách chỉnh sửa; kiểm tra trước khi gửi.";
  if (status === "QUOTE_SENT") return customer ? "Mở báo giá để xem hạng mục, giá và điều kiện trước khi phản hồi." : "Theo dõi phản hồi của khách đối với phiên bản báo giá đã gửi.";
  if (status === "QUOTE_REVISION") return customer ? "Người phụ trách sẽ gửi phiên bản mới theo phản hồi của bạn." : "Xem phản hồi của khách và tạo phiên bản báo giá mới, giữ nguyên lịch sử đã gửi.";
  return customer ? "Trao đổi với người phụ trách để làm rõ phương án dịch vụ." : "Làm rõ phạm vi và chuẩn bị phương án phù hợp với brief.";
}
export function referenceUrls(value: string) {
  const urls = value.split(/\r?\n/).map(url => url.trim()).filter(Boolean);
  if (urls.length > 10 || urls.some(url => { try { return new URL(url).protocol !== "https:"; } catch { return true; } })) throw new Error("Nhập tối đa 10 link HTTPS, mỗi link một dòng.");
  return urls;
}
