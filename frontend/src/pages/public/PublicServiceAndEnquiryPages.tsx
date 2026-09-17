import { useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { CompanyContact } from "../../contexts/SiteSettings";
import { useApi } from "../../hooks/useApi";
import { ActionForm, Field, State, Pagination, money } from "../../components/ui";
import { Metadata } from "../../components/Metadata";
import { api, post, patch } from "../../services/api";

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
              {service.starting_price !== null && (
                <p>Từ {money(service.starting_price)}</p>
              )}
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
  const query = useApi<Service>(
    `/public/services/${encodeURIComponent(slug ?? "")}`,
  );
  const service = query.data;
  return (
    <section className="page section">
      <Link to="/services">← Dịch vụ</Link>
      <State query={query}>
        {service && (
          <>
            <Metadata
              title={service.seo_title || service.name}
              description={
                service.seo_description || service.description || undefined
              }
            />
            <h1>{service.name}</h1>
            <p>{service.category}</p>
            {service.thumbnail_url && (
              <img
                className="catalog-image"
                src={service.thumbnail_url}
                alt={service.name}
              />
            )}
            <p className="preserve-lines">{service.description}</p>
            {service.features?.length > 0 && (
              <>
                <h2>Dịch vụ bao gồm</h2>
                <ul>
                  {service.features.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </>
            )}
            {service.deliverables?.length > 0 && (
              <>
                <h2>Sản phẩm bàn giao</h2>
                <ul>
                  {service.deliverables.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </>
            )}
            {service.estimated_days && (
              <p>Thời gian dự kiến: {service.estimated_days} ngày</p>
            )}
            {service.starting_price !== null && (
              <p>
                Giá khởi điểm: {money(service.starting_price)}. Báo giá cuối
                cùng được xác nhận theo yêu cầu dự án.
              </p>
            )}
            <Link
              className="btn btn-primary"
              to={`/request-project?service=${service.id}`}
            >
              Yêu cầu dịch vụ này
            </Link>
          </>
        )}
      </State>
    </section>
  );
}
export function Enquiry({ contact = false }: { contact?: boolean }) {
  const auth = useAuth();
  const [params] = useSearchParams();
  const [done, setDone] = useState(false);
  const query = useApi<Collection<Service>>("/public/services?limit=100");
  if (!contact && auth.role === "CUSTOMER")
    return <Navigate to="/customer/projects/new" replace />;
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
type Lead = {
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
  const [page, setPage] = useState(1);
  const query = useApi<Collection<Lead>>(
    `/admin/leads?page=${page}&search=${encodeURIComponent(search)}${status ? `&status=${status}` : ""}`,
  );
  return (
    <section className="dash-page">
      <h1>Yêu cầu khách hàng</h1>
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
          <option value="">Tất cả</option>
          {["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "LOST"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <State query={query}>
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Khách hàng</th>
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
                  <td>{lead.source}</td>
                  <td>{lead.status}</td>
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
  } | null>(`/admin/leads/${id}/customer`);
  return (
    <section className="dash-page">
      <Link to="/admin/leads">← Yêu cầu khách hàng</Link>
      <State query={query}>
        {lead && (
          <>
            <h1>{lead.full_name}</h1>
            <div className="panel">
              <p>
                {lead.email} · {lead.phone}
              </p>
              <p>{lead.company}</p>
              <p className="preserve-lines">{lead.message}</p>
              <p>Ngân sách: {lead.budget_range || "Chưa xác định"}</p>
              <p>Hạn dự kiến: {lead.deadline || "Chưa xác định"}</p>
              {lead.attachment_name && (
                <ActionForm
                  label={`Tải ${lead.attachment_name}`}
                  onSubmit={async () => {
                    const data = await api<{ signedUrl: string }>(
                      `/admin/leads/${id}/attachment`,
                    );
                    window.location.assign(data.signedUrl);
                  }}
                />
              )}
            </div>
            {lead.status !== "CONVERTED" && (
              <>
                <section className="panel">
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
                </section>
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
                        <option key={s}>{s}</option>
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
