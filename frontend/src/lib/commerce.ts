export function ordersHome(role: string | null) {
  return role === "ADMIN" ? "/admin/orders" : role === "STAFF" ? "/staff/orders" : "/customer/orders";
}
export function businessToday(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
export function quoteExpired(validUntil: string, date = new Date()) { return validUntil < businessToday(date); }
export function orderNextAction(status: string, customer: boolean) {
  if (status === "WAITING_CONTRACT") return customer ? "Người phụ trách sẽ gửi hợp đồng để bạn xem điều kiện thực hiện." : "Chuẩn bị hợp đồng dựa trên đúng phiên bản báo giá đã được chấp nhận.";
  if (status === "WAITING_PAYMENT") return customer ? "Xem yêu cầu thanh toán và hướng dẫn chuyển khoản từ người phụ trách." : "Theo dõi khoản thanh toán và xác minh thực nhận trước khi xác nhận đơn.";
  if (status === "CONFIRMED") return "Đơn đã đủ điều kiện. Theo dõi kế hoạch sản xuất và các mốc bàn giao.";
  if (status === "COMPLETED") return "Đơn dịch vụ đã hoàn thành. Bạn có thể xem lại hồ sơ và trao đổi.";
  if (["CANCELLED", "REFUNDED"].includes(status)) return "Đơn đã đóng. Hồ sơ được lưu lại để tra cứu.";
  return "Theo dõi tiến độ và trao đổi với người phụ trách trong workspace.";
}
