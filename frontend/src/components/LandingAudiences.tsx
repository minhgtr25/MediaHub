import { ArrowRight, BriefcaseBusiness, Check, Clapperboard, Users } from "lucide-react";
import { Link } from "react-router-dom";

const audiences = [
  {
    icon: Clapperboard, label: "CÁ NHÂN & DOANH NGHIỆP NHỎ", title: "Nội dung phù hợp với nhu cầu của bạn",
    description: "Thuê chụp ảnh, video, thiết kế hoặc nội dung truyền thông. Staff giúp bạn chọn dịch vụ và đội Creator theo ngân sách.",
    points: ["Chia sẻ nhu cầu, chưa cần chọn đủ mọi hạng mục.", "Xem Creator và báo giá ngay trong hội thoại.", "Theo dõi từ tư vấn đến bàn giao sản phẩm."],
    to: "/request-project", action: "Yêu cầu tư vấn",
  },
  {
    icon: BriefcaseBusiness, label: "DOANH NGHIỆP, CÔNG TY & AGENCY", title: "Đồng hành cùng chiến dịch của doanh nghiệp",
    description: "Trao đổi về hợp tác dài hạn, sản xuất nội dung theo chiến dịch hoặc triển khai dự án có nhiều hạng mục.",
    points: ["Một đầu mối tiếp nhận nhu cầu hợp tác.", "Làm rõ phạm vi, nguồn lực và lịch triển khai.", "Tiếp tục trao đổi qua email của doanh nghiệp."],
    to: "/business-contact", action: "Liên hệ doanh nghiệp",
  },
  {
    icon: Users, label: "CREATOR & SINH VIÊN", title: "Tham gia đội ngũ sáng tạo MediaHub",
    description: "Gửi CV, chuyên môn và portfolio để công ty xem xét hợp tác. Tích lũy kinh nghiệm qua các dự án phù hợp với năng lực.",
    points: ["Chia sẻ sản phẩm và lĩnh vực bạn có thể thực hiện.", "Công ty xem xét hồ sơ và trao đổi qua email.", "Admin cấp tài khoản sau khi ký hợp đồng hợp tác."],
    to: "/creator-application", action: "Ứng tuyển vào MediaHub",
  },
];

export function LandingAudiences() {
  return <section className="audience-section audience-three" aria-label="MediaHub dành cho bạn">
    {audiences.map(({ icon: Icon, label, title, description, points, to, action }, index) => <article key={to}>
      <div className="audience-heading"><Icon size={24} aria-hidden="true"/><small>{label}</small></div>
      <h2>{title}</h2><p>{description}</p>
      <ul>{points.map(point => <li key={point}><Check size={16} aria-hidden="true"/>{point}</li>)}</ul>
      <Link className={`btn ${index === 0 ? "btn-primary" : "btn-ghost"}`} to={to}>{action}<ArrowRight size={18}/></Link>
    </article>)}
  </section>;
}
