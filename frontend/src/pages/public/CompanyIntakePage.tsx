import { useState } from "react";
import { Link } from "react-router-dom";
import { BriefcaseBusiness, CheckCircle2, FileText, Users } from "lucide-react";
import { ActionForm, Field } from "../../components/ui";
import { CompanyContact } from "../../contexts/SiteSettings";
import { Metadata } from "../../components/Metadata";
import { api, post } from "../../services/api";

export function CompanyIntakePage({ kind }: { kind: "business" | "creator" }) {
  const [done, setDone] = useState(false);
  const creator = kind === "creator", Icon = creator ? Users : BriefcaseBusiness;
  const title = creator ? "Ứng tuyển vào MediaHub" : "Liên hệ doanh nghiệp";
  const description = creator ? "Chia sẻ chuyên môn, CV và sản phẩm bạn đã thực hiện để công ty xem xét hợp tác." : "Trao đổi cùng MediaHub về chiến dịch, sản xuất nội dung hoặc hợp tác dài hạn.";
  return <main className="page section company-intake-page">
    <Metadata title={title} description={description}/>
    <Link className="back" to="/">← Trang chủ</Link>
    <header className="company-intake-heading"><span className="eyebrow">{creator ? "GIA NHẬP ĐỘI NGŨ SÁNG TẠO" : "HỢP TÁC CÙNG MEDIAHUB"}</span><h1>{title}</h1><p>{description}</p></header>
    <div className="company-intake-layout">
      <section className="panel company-intake-form" aria-label={title}>
        {done ? <div className="company-intake-success" role="status"><CheckCircle2 size={36} aria-hidden="true"/><h2>{creator ? "Đã nhận hồ sơ ứng tuyển" : "Đã nhận thông tin liên hệ"}</h2><p>Thông tin đã được lưu để MediaHub xem xét và liên hệ qua email bạn cung cấp.</p>{creator && <p>Hồ sơ ứng tuyển chưa tạo tài khoản. Sau khi thống nhất hợp tác và ký hợp đồng công ty, Admin sẽ cấp tài khoản Creator.</p>}<Link className="btn btn-ghost" to="/">Về trang chủ</Link></div> : <ActionForm label={creator ? "Gửi hồ sơ ứng tuyển" : "Gửi liên hệ doanh nghiệp"} showSuccess={false} onSuccess={() => setDone(true)} onSubmit={async form => {
          const person = { full_name: String(form.get("full_name") || "").trim(), email: String(form.get("email") || "").trim(), phone: String(form.get("phone") || "").trim() };
          if (!creator) return post("/public/business-contact", { ...person, company: String(form.get("company") || "").trim(), message: form.get("message") });
          const cv = form.get("attachment");
          if (!(cv instanceof File) || !cv.size) throw new Error("Vui lòng chọn CV dạng PDF.");
          if (cv.size > 10 * 1024 * 1024 || !cv.name.toLowerCase().endsWith(".pdf")) throw new Error("CV cần là tệp PDF, tối đa 10 MB.");
          const urls = String(form.get("portfolio_urls") || "").split(/\r?\n/).map(value => value.trim()).filter(Boolean);
          if (!urls.length || urls.length > 5 || urls.some(value => {
            try { const url = new URL(value); return url.protocol !== "https:" || !!url.username || !!url.password || value.length > 2000; } catch { return true; }
          })) throw new Error("Nhập từ 1 đến 5 link portfolio HTTPS, mỗi link một dòng.");
          const payload = { ...person, applicant_type: form.get("applicant_type"), specialty: form.get("specialty"), portfolio_urls: urls, message: form.get("message") || "" };
          const body = new FormData(); body.set("payload", JSON.stringify(payload)); body.set("attachment", cv);
          return api("/public/creator-applications", { method: "POST", body });
        }}>
          <h2>Thông tin liên hệ</h2>
          <Field name="full_name" label="Họ và tên" maxLength={150}/>
          <div className="request-form-grid"><Field name="email" label="Email để MediaHub liên hệ" type="email" maxLength={254}/><Field name="phone" label="Số điện thoại (không bắt buộc)" type="tel" required={false} maxLength={30}/></div>
          {creator ? <>
            <h2>Hồ sơ sáng tạo</h2>
            <div className="field"><label htmlFor="application-type">Thông tin của bạn</label><select id="application-type" name="applicant_type" defaultValue="CREATOR"><option value="CREATOR">Creator / người làm sáng tạo</option><option value="STUDENT">Sinh viên</option></select></div>
            <Field name="specialty" label="Chuyên môn: ví dụ quay phim, chụp ảnh, thiết kế" maxLength={200}/>
            <div className="field"><label htmlFor="application-cv">CV dạng PDF · tối đa 10 MB</label><input id="application-cv" type="file" name="attachment" accept=".pdf,application/pdf" required aria-describedby="application-cv-note"/><small id="application-cv-note">CV được lưu riêng tư để Admin xem xét hồ sơ.</small></div>
            <Field name="portfolio_urls" label="Link portfolio hoặc sản phẩm (1–5 link HTTPS, mỗi link một dòng)" type="textarea" maxLength={10004}/>
            <Field name="message" label="Giới thiệu thêm về bạn (không bắt buộc)" type="textarea" required={false}/>
          </> : <><Field name="company" label="Tên doanh nghiệp / công ty / agency" maxLength={200}/><Field name="message" label="Nhu cầu hợp tác, chiến dịch hoặc dự án cần triển khai" type="textarea"/></>}
          <p className="company-intake-privacy">Thông tin{creator ? " và CV" : ""} được dùng để tiếp nhận {creator ? "hồ sơ hợp tác" : "nhu cầu doanh nghiệp"}; chỉ Admin có quyền xem trong hệ thống. <Link to="/privacy">Chính sách bảo mật</Link>.</p>
        </ActionForm>}
      </section>
      <aside className="panel company-intake-context"><Icon size={28} aria-hidden="true"/><h2>{creator ? "Quy trình hợp tác Creator" : "Một đầu mối cho nhu cầu của bạn"}</h2>
        <ol>{(creator ? ["Gửi hồ sơ, CV và portfolio.", "Công ty xem xét chuyên môn và liên hệ qua email.", "Thống nhất hợp tác và ký hợp đồng với công ty.", "Admin cấp tài khoản để xác nhận phân công và cập nhật tiến độ."] : ["Gửi thông tin và nhu cầu doanh nghiệp.", "MediaHub xem xét và trao đổi qua email.", "Thống nhất phạm vi, nguồn lực và phương án hợp tác."]).map(item => <li key={item}>{item}</li>)}</ol>
        {!creator && <p>Bạn muốn thuê một dịch vụ cụ thể? <Link to="/request-project">Gửi yêu cầu tư vấn</Link> để Staff đồng hành trong hội thoại dịch vụ.</p>}
        {creator && <p><FileText size={16} aria-hidden="true"/> Sinh viên là thông tin hồ sơ. Mọi Creator đều được cấp tài khoản theo quy trình hợp tác của công ty.</p>}
        <div className="company-intake-contact"><h3>Liên hệ MediaHub</h3><CompanyContact/></div>
      </aside>
    </div>
  </main>;
}
