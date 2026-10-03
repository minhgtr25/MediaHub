import { ClipboardList, MessagesSquare, Calculator, FileCheck2, Video, BadgeCheck, CircleDollarSign, PackageCheck } from "lucide-react";
import { Link } from "react-router-dom";

const steps = [
  { icon: ClipboardList, title: "Gửi yêu cầu", description: "Chọn dịch vụ, chia sẻ mục tiêu, ngân sách và thời gian mong muốn. Chưa phát sinh đơn hàng hoặc thanh toán.", actor: "Khách hàng" },
  { icon: MessagesSquare, title: "MediaHub tư vấn", description: "Staff tiếp nhận, làm rõ nhu cầu và đề xuất đội Creator. Bạn xem hồ sơ, sản phẩm và trao đổi trong cùng một hội thoại.", actor: "Khách hàng · Staff" },
  { icon: Calculator, title: "Thống nhất phạm vi & báo giá", description: "Chốt phần việc, đầu ra, lịch thực hiện và mức giá. Mỗi Creator xác nhận phân công trước khi Staff gửi báo giá chính thức.", actor: "Khách hàng · Staff · Creator" },
  { icon: FileCheck2, title: "Xác nhận hợp đồng & đặt cọc", description: "Khách hàng xem và xác nhận điều khoản. Khoản cọc tối thiểu 30% theo báo giá được kiểm tra thực nhận trước khi triển khai.", actor: "Khách hàng · Staff" },
  { icon: Video, title: "MediaHub triển khai", description: "Creator thực hiện và cập nhật tiến độ trên hệ thống. Staff điều phối, theo dõi và xử lý các nội dung cần trao đổi.", actor: "Khách hàng · Staff · Creator" },
  { icon: BadgeCheck, title: "Khách hàng nghiệm thu", description: "Xem bản có watermark, yêu cầu chỉnh sửa trong phạm vi đã thống nhất hoặc xác nhận kết quả đạt yêu cầu.", actor: "Khách hàng · Staff · Creator" },
  { icon: CircleDollarSign, title: "Thanh toán", description: "Khách hàng thanh toán phần còn thiếu. Staff phụ trách đối soát và xác nhận công ty đã thực nhận đủ tiền.", actor: "Khách hàng · Staff" },
  { icon: PackageCheck, title: "Bàn giao dự án", description: "Sau xác nhận thu đủ, Creator gửi bản hoàn thiện không watermark. Dự án chỉ hoàn thành khi cả đội bàn giao đủ sản phẩm.", actor: "Khách hàng · Staff · Creator" },
];

// The approved workflow is product copy, not a paginated CMS collection.
export function ServiceProcess({ embedded = false }: { embedded?: boolean }) {
  return <section className={`service-process ${embedded ? "home-section" : "page section"}`} aria-labelledby="service-process-title">
    <header className="service-process-heading">
      <p className="eyebrow">CÙNG MEDIAHUB TỪ TƯ VẤN ĐẾN BÀN GIAO</p>
      {embedded ? <h2 id="service-process-title">Quy trình thực hiện</h2> : <h1 id="service-process-title">Quy trình thực hiện</h1>}
      <p>Mỗi yêu cầu có một Staff phụ trách, một hội thoại và các bước rõ ràng để bạn theo dõi.</p>
    </header>
    <ol className="service-process-roadmap">{steps.map(({ icon: Icon, title, description, actor }, index) =>
      <li key={title}><div className="process-roadmap-marker"><span>{String(index + 1).padStart(2, "0")}</span><Icon size={20} aria-hidden="true" /></div><div className="process-roadmap-content"><h3>{title}</h3><p>{description}</p><small>{actor}</small></div></li>
    )}</ol>
    <div className="service-process-action"><p>Bạn chưa rõ dịch vụ hoặc đội thực hiện phù hợp? Staff sẽ tư vấn trước khi chốt.</p><Link className="btn btn-primary" to="/request-project">Yêu cầu tư vấn →</Link></div>
  </section>;
}
