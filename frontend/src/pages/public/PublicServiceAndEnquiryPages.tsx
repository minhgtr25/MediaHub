import { useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { CompanyContact } from "../../contexts/SiteSettings";
import { useApi } from "../../hooks/useApi";
import { ActionForm, Field, State, Pagination, money } from "../../components/ui";
import { Metadata } from "../../components/Metadata";
import { api, post, patch } from "../../services/api";
import { isCustomerRole } from "../../lib/permissions";
import type { ServicePackage } from "../../types/requests";

type Service = {
  features: string[];
  deliverables: string[];
  seo_title: string;
  seo_description: string;
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  starting_price: number | null;
  price_max: number | null;
  estimated_days: number | null;
  thumbnail_url: string | null;
};
type Collection<T> = { items: T[]; total: number };
export function Services() {
  const [page, setPage] = useState(1);
  const query = useApi<Collection<Service>>(`/public/services?page=${page}`);
  return (
    <section className="page section">
      <h1>Dịch vụ MediaHub</h1>
      <p>
        Chọn dịch vụ phù hợp để cùng xác định phạm vi, ngân sách và thời gian
        thực hiện.
      </p>
      <State query={query}>
        <div className="service-grid">
          {query.data?.items.map((service) => (
            <article className="service-card" key={service.id}>
              {service.thumbnail_url && (
                <img
                  className="catalog-image"
                  src={service.thumbnail_url}
                  alt={service.name}
                  loading="lazy"
                />
              )}
              <h2>
                <Link to={`/services/${service.slug}`}>{service.name}</Link>
              </h2>
              <p>{service.description}</p>
              <div className="service-card-meta"><div><small>Giá tham khảo</small><strong>{service.starting_price == null ? "Staff tư vấn báo giá" : `Từ ${money(service.starting_price)}`}</strong></div><div><small>Thời gian dự kiến</small><strong>{service.estimated_days ? `${service.estimated_days} ngày` : "Theo phạm vi dự án"}</strong></div></div>
              <div className="service-card-actions"><Link to={`/services/${service.slug}`}>Xem dịch vụ</Link><Link className="btn btn-primary" to={`/request-project?service=${service.id}`}>Yêu cầu tư vấn</Link></div>
            </article>
          ))}
        </div>
        {!query.data?.items.length && <p>Chưa có dịch vụ được công bố.</p>}
        <Pagination
          page={page}
          total={query.data?.total ?? 0}
          onChange={setPage}
        />
      </State>
    </section>
  );
}
export function ServiceDetail() {
  const { slug } = useParams();
  const query = useApi<Service>(`/public/services/${encodeURIComponent(slug ?? "")}`);
  const service = query.data;
  return <section className="page section service-detail-page">
    <Link className="service-back" to="/services">← Tất cả dịch vụ</Link>
    <State query={query}>{service && <>
      <Metadata title={service.seo_title || service.name} description={service.seo_description || service.description || undefined}/>
      <header className="service-detail-heading"><p className="eyebrow">{service.category || "DỊCH VỤ MEDIAHUB"}</p><h1>{service.name}</h1><p className="muted">MediaHub tư vấn, điều phối Creator và đồng hành từ yêu cầu đến bàn giao.</p></header>
      <div className="service-detail-layout"><div className="service-detail-content">
        {service.thumbnail_url && <img className="service-detail-image" src={service.thumbnail_url} alt={service.name}/>}
        <section className="service-detail-block"><h2>Giới thiệu dịch vụ</h2><p className="preserve-lines">{service.description || "Trao đổi với Staff để xác định phương án phù hợp với nhu cầu của bạn."}</p></section>
        <div className="service-detail-inclusions">{service.features?.length > 0 && <section className="service-detail-block"><h2>Dịch vụ bao gồm</h2><ul>{service.features.map(item=><li key={item}>{item}</li>)}</ul></section>}{service.deliverables?.length > 0 && <section className="service-detail-block"><h2>Sản phẩm bàn giao</h2><ul>{service.deliverables.map(item=><li key={item}>{item}</li>)}</ul></section>}</div>
      </div><aside className="service-quote-summary"><p className="eyebrow">DỰ KIẾN CHO DỊCH VỤ</p><span>Giá tham khảo</span><strong>{service.starting_price == null ? "Liên hệ tư vấn" : `Từ ${money(service.starting_price)}`}</strong>{service.price_max != null && service.starting_price != null && service.price_max > service.starting_price && <p>Khoảng tham khảo đến {money(service.price_max)}</p>}<dl><div><dt>Thời gian dự kiến</dt><dd>{service.estimated_days ? `${service.estimated_days} ngày` : "Theo phạm vi dự án"}</dd></div><div><dt>Người đồng hành</dt><dd>Staff phụ trách riêng</dd></div><div><dt>Đặt cọc khi chốt</dt><dd>Tối thiểu 30%</dd></div></dl><p className="muted">Giá và thời gian được Staff xác nhận trong báo giá theo brief, số lượng sản phẩm và phạm vi chỉnh sửa.</p><Link className="btn btn-primary" to={`/request-project?service=${service.id}`}>Yêu cầu tư vấn dịch vụ</Link><small>Gửi yêu cầu chưa tạo đơn hàng hoặc phát sinh thanh toán.</small></aside></div>
      <ServicePackages serviceId={service.id}/>
    </>}</State>
  </section>;
}
function ServicePackages({ serviceId }: { serviceId: string }) {
  const query = useApi<ServicePackage[]>(`/public/services/${serviceId}/packages`);
  return <section className="section"><h2>Gói dịch vụ</h2><p>Chọn gói tham khảo hoặc để MediaHub tư vấn theo brief.</p><State query={query}><div className="service-grid">{query.data?.map(pack => <article className="service-card" key={pack.id}><h3>{pack.name}</h3><p>{pack.description}</p>{pack.starting_price !== null && <p>Tham khảo từ {money(pack.starting_price)}</p>}{pack.estimated_days && <p>Dự kiến {pack.estimated_days} ngày</p>}<ul>{pack.deliverables.map(item => <li key={item}>{item}</li>)}</ul><Link className="btn btn-primary" to={`/request-project?service=${serviceId}&package=${pack.id}`}>Chọn gói này</Link></article>)}</div>{!query.data?.length && <p>Chưa có gói công bố. Bạn vẫn có thể gửi yêu cầu để nhận tư vấn.</p>}</State></section>;
}
export function Enquiry({ contact = false }: { contact?: boolean }) {
  const auth = useAuth();
  const [params] = useSearchParams();
  const [done, setDone] = useState(false);
  const query = useApi<Collection<Service>>("/public/services?limit=100");
  if (!contact && auth.loading) return <div className="panel" role="status">Đang xác thực…</div>;
  if (!contact && !auth.currentUser)
    return <Navigate to="/login" state={{ from: `/request-project${params.size ? `?${params}` : ""}` }} replace />;
  if (!contact && isCustomerRole(auth.role))
    return <Navigate to={`/customer/requests/new${params.size ? `?${params}` : ""}`} replace />;
  if (!contact)
    return <section className="page section"><h1>Yêu cầu dịch vụ</h1><p>Vui lòng sử dụng tài khoản khách hàng để gửi yêu cầu.</p><Link to="/services">Xem dịch vụ</Link></section>;
  return (
    <section className="page section enquiry">
      <h1>{contact ? "Liên hệ MediaHub" : "Bắt đầu dự án"}</h1>
      {contact && <CompanyContact />}
      <p>
        Chia sẻ nhu cầu của bạn. MediaHub sẽ liên hệ để làm rõ phạm vi và báo
        giá.
      </p>
      {done ? (
        <div className="panel" role="status">
          <h2>Cảm ơn bạn!</h2>
          <p>Đội ngũ MediaHub sẽ sớm liên hệ với bạn.</p>
          <Link to="/services">Xem dịch vụ</Link>
        </div>
      ) : (
        <State query={query}>
          <ActionForm
            label="Gửi yêu cầu"
            onSuccess={() => setDone(true)}
            onSubmit={(data) => {
              const payload = {
                full_name: data.get("full_name"),
                email: data.get("email"),
                phone: data.get("phone"),
                company: data.get("company"),
                service_id: data.get("service_id") || null,
                project_type: data.get("project_type") || "",
                message: data.get("message"),
                budget_range: data.get("budget_range") || "",
                deadline: data.get("deadline") || null,
                source: contact ? "CONTACT" : "PROJECT_REQUEST",
              };
              const attachment = data.get("attachment");
              if (attachment instanceof File && attachment.size) {
                if (attachment.size > 10 * 1024 * 1024)
                  throw new Error("Tệp không được vượt quá 10 MB.");
                const form = new FormData();
                form.set("payload", JSON.stringify(payload));
                form.set("attachment", attachment);
                return api("/public/leads", { method: "POST", body: form });
              }
              return post("/public/leads", payload);
            }}
          >
            <Field
              name="full_name"
              label="Họ và tên"
              value={auth.profile?.full_name}
            />
            <Field
              name="email"
              label="Email"
              type="email"
              value={auth.profile?.email}
            />
            <Field
              name="phone"
              label="Điện thoại"
              type="tel"
              required={false}
            />
            <Field name="company" label="Công ty" required={false} />
            <div className="field">
              <label htmlFor="service_id">Dịch vụ</label>
              <select
                id="service_id"
                name="service_id"
                defaultValue={params.get("service") ?? ""}
              >
                <option value="">Cần tư vấn lựa chọn</option>
                {query.data?.items.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            {!contact && (
              <>
                <Field name="project_type" label="Loại dự án" />
                <Field
                  name="budget_range"
                  label="Khoảng ngân sách"
                  required={false}
                />
                <Field
                  name="deadline"
                  label="Ngày hoàn thành mong muốn"
                  type="date"
                  required={false}
                />
              </>
            )}
            <div className="field">
              <label htmlFor="attachment">
                Tệp tham khảo (PDF hoặc ảnh, tối đa 10 MB)
              </label>
              <input
                id="attachment"
                name="attachment"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
              />
            </div>
            <Field
              name="message"
              label={contact ? "Nội dung" : "Mô tả yêu cầu dự án"}
              type="textarea"
            />
          </ActionForm>
        </State>
      )}
    </section>
  );
}
const intakeSourceLabels: Record<string, string> = { CONTACT: "Liên hệ chung", PROJECT_REQUEST: "Yêu cầu dự án cũ", BUSINESS_CONTACT: "Liên hệ doanh nghiệp", CREATOR_APPLICATION: "Ứng tuyển Creator" };
const leadStatusLabels: Record<string, string> = { NEW: "Mới nhận", CONTACTED: "Đã trao đổi", QUALIFIED: "Phù hợp", CONVERTED: "Đã chuyển thành khách hàng", LOST: "Không tiếp tục" };
type Lead = {
  applicant_type: "CREATOR" | "STUDENT" | null;
  specialty: string;
  portfolio_urls: string[];
  attachment_name: string | null;
  id: string;
  full_name: string;
  email: string;
  phone: string;
  company: string;
  message: string;
  source: string;
  status: string;
  notes: string;
  created_at: string;
  budget_range: string;
  deadline: string | null;
};
export function AdminLeads() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [page, setPage] = useState(1);
  const query = useApi<Collection<Lead>>(
    `/admin/leads?page=${page}&search=${encodeURIComponent(search)}${status ? `&status=${status}` : ""}${source ? `&source=${source}` : ""}`,
  );
  return (
    <section className="dash-page">
      <h1>Liên hệ &amp; ứng tuyển</h1>
      <p>Tiếp nhận liên hệ doanh nghiệp và hồ sơ Creator. Hồ sơ riêng tư; trao đổi tiếp qua email của người gửi.</p>
      <div className="toolbar">
        <input
          aria-label="Tìm theo tên"
          placeholder="Tìm theo tên"
          value={search}
          maxLength={100}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <select
          aria-label="Trạng thái"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Mọi trạng thái</option>
          {["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "LOST"].map((s) => (
            <option key={s} value={s}>{leadStatusLabels[s]}</option>
          ))}
        </select>
        <select aria-label="Loại liên hệ" value={source} onChange={event => { setSource(event.target.value); setPage(1); }}>
          <option value="">Mọi loại liên hệ</option>
          {Object.entries(intakeSourceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <State query={query}>
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Người gửi</th>
                <th>Công ty</th>
                <th>Nguồn</th>
                <th>Trạng thái</th>
                <th>Ngày gửi</th>
              </tr>
            </thead>
            <tbody>
              {query.data?.items.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <Link to={`/admin/leads/${lead.id}`}>{lead.full_name}</Link>
                  </td>
                  <td>{lead.company}</td>
                  <td>{intakeSourceLabels[lead.source] || lead.source}</td>
                  <td>{leadStatusLabels[lead.status] || lead.status}</td>
                  <td>
                    {new Date(lead.created_at).toLocaleDateString("vi-VN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!query.data?.items.length && <p>Chưa có yêu cầu phù hợp.</p>}
        <Pagination
          page={page}
          total={query.data?.total ?? 0}
          onChange={setPage}
        />
      </State>
    </section>
  );
}
export function AdminLeadDetail() {
  const { id } = useParams();
  const query = useApi<Lead>(`/admin/leads/${id}`);
  const lead = query.data;
  const matchingCustomer = useApi<{
    id: string;
    full_name: string;
    email: string;
  } | null>(lead && lead.source !== "CREATOR_APPLICATION" ? `/admin/leads/${id}/customer` : null);
  return (
    <section className="dash-page">
      <Link to="/admin/leads">← Liên hệ & ứng tuyển</Link>
      <State query={query}>
        {lead && (
          <>
            <p className="eyebrow">{intakeSourceLabels[lead.source] || lead.source}</p>
            <h1>{lead.full_name}</h1>
            <div className="panel">
              <p>
                {lead.email} · {lead.phone}
              </p>
              {lead.company && <p>{lead.company}</p>}
              {lead.source === "CREATOR_APPLICATION" && <><p>Thông tin: {lead.applicant_type === "STUDENT" ? "Sinh viên" : "Creator"}</p><p>Chuyên môn: {lead.specialty}</p><h2>Portfolio / sản phẩm</h2><ul>{lead.portfolio_urls.map(url => <li key={url}><a href={url} target="_blank" rel="noopener noreferrer">{url}</a></li>)}</ul></>}
              <p className="preserve-lines">{lead.message}</p>
              {lead.budget_range && <p>Ngân sách: {lead.budget_range}</p>}
              {lead.deadline && <p>Hạn dự kiến: {lead.deadline}</p>}
              {lead.attachment_name && (
                <ActionForm
                  label={`Tải ${lead.attachment_name}`}
                  onSubmit={async () => {
                    const data = await api<{ signedUrl: string }>(
                      `/admin/leads/${id}/attachment`,
                    );
                    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
                  }}
                />
              )}
            </div>
            {lead.status !== "CONVERTED" && (
              <>
                {lead.source !== "CREATOR_APPLICATION" && <section className="panel">
                  <h2>Chuyển thành khách hàng</h2>
                  <State query={matchingCustomer}>
                    {matchingCustomer.data ? (
                      <>
                        <p>
                          {matchingCustomer.data.full_name} ·{" "}
                          {matchingCustomer.data.email}
                        </p>
                        <p>
                          Yêu cầu dự án có dịch vụ đã chọn sẽ được chuyển thành
                          dự án của khách hàng này.
                        </p>
                        <ActionForm
                          label="Chuyển thành khách hàng"
                          onSubmit={() =>
                            post(`/admin/leads/${id}/convert`, {
                              customer_id: matchingCustomer.data?.id,
                            })
                          }
                          onSuccess={query.reload}
                        />
                      </>
                    ) : (
                      <p>
                        Chưa có tài khoản customer trùng email. Mời khách hàng
                        tại <Link to="/admin/users">Quản lý tài khoản</Link>,
                        sau đó quay lại yêu cầu này.
                      </p>
                    )}
                  </State>
                </section>}
                <section className="panel"><h2>{lead.source === "CREATOR_APPLICATION" ? "Xét hồ sơ hợp tác" : "Trao đổi qua email"}</h2><a className="btn btn-ghost" href={`mailto:${encodeURIComponent(lead.email)}?subject=${encodeURIComponent(`MediaHub — ${intakeSourceLabels[lead.source] || "Liên hệ"}`)}&body=${encodeURIComponent(`Chào ${lead.full_name},\n\nMediaHub đã nhận thông tin của bạn.\n\n`)}`}>Soạn email phản hồi</a>{lead.source === "CREATOR_APPLICATION" && <><p>Đánh dấu phù hợp chỉ ghi nhận kết quả xét hồ sơ. Tài khoản Creator được cấp riêng sau hợp đồng hợp tác với công ty.</p><Link to="/admin/creators">Cấp tài khoản Creator sau hợp đồng →</Link></>}</section>
                <ActionForm
                  onSuccess={query.reload}
                  onSubmit={(data) =>
                    patch(`/admin/leads/${id}`, {
                      status: data.get("status"),
                      notes: data.get("notes"),
                    })
                  }
                >
                  <div className="field">
                    <label htmlFor="status">Trạng thái</label>
                    <select
                      name="status"
                      id="status"
                      defaultValue={lead.status}
                    >
                      {["NEW", "CONTACTED", "QUALIFIED", "LOST"].map((s) => (
                        <option key={s} value={s}>{leadStatusLabels[s]}</option>
                      ))}
                    </select>
                  </div>
                  <Field
                    name="notes"
                    label="Ghi chú nội bộ"
                    type="textarea"
                    value={lead.notes}
                    required={false}
                  />
                </ActionForm>
              </>
            )}
          </>
        )}
      </State>
    </section>
  );
}
