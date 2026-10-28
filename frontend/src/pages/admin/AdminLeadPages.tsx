import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useApi } from "../../hooks/useApi";
import { ActionForm, Field, Pagination, State } from "../../components/ui";
import { api, patch, post } from "../../services/api";

type Collection<T> = { items: T[]; total: number };

const intakeSourceLabels: Record<string, string> = {
  CONTACT: "Liên hệ chung",
  PROJECT_REQUEST: "Yêu cầu dự án cũ",
  BUSINESS_CONTACT: "Liên hệ doanh nghiệp",
  CREATOR_APPLICATION: "Ứng tuyển Creator",
};
const leadStatusLabels: Record<string, string> = {
  NEW: "Mới nhận",
  CONTACTED: "Đã trao đổi",
  QUALIFIED: "Phù hợp",
  CONVERTED: "Đã chuyển thành khách hàng",
  LOST: "Không tiếp tục",
};
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
      <p>
        Tiếp nhận liên hệ doanh nghiệp và hồ sơ Creator. Hồ sơ riêng tư; trao
        đổi tiếp qua email của người gửi.
      </p>
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
            <option key={s} value={s}>
              {leadStatusLabels[s]}
            </option>
          ))}
        </select>
        <select
          aria-label="Loại liên hệ"
          value={source}
          onChange={(event) => {
            setSource(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Mọi loại liên hệ</option>
          {Object.entries(intakeSourceLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
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
  } | null>(
    lead && lead.source !== "CREATOR_APPLICATION"
      ? `/admin/leads/${id}/customer`
      : null,
  );
  return (
    <section className="dash-page">
      <Link to="/admin/leads">← Liên hệ & ứng tuyển</Link>
      <State query={query}>
        {lead && (
          <>
            <p className="eyebrow">
              {intakeSourceLabels[lead.source] || lead.source}
            </p>
            <h1>{lead.full_name}</h1>
            <div className="panel">
              <p>
                {lead.email} · {lead.phone}
              </p>
              {lead.company && <p>{lead.company}</p>}
              {lead.source === "CREATOR_APPLICATION" && (
                <>
                  <p>
                    Thông tin:{" "}
                    {lead.applicant_type === "STUDENT"
                      ? "Sinh viên"
                      : "Creator"}
                  </p>
                  <p>Chuyên môn: {lead.specialty}</p>
                  <h2>Portfolio / sản phẩm</h2>
                  <ul>
                    {lead.portfolio_urls.map((url) => (
                      <li key={url}>
                        <a href={url} target="_blank" rel="noopener noreferrer">
                          {url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </>
              )}
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
                    window.open(
                      data.signedUrl,
                      "_blank",
                      "noopener,noreferrer",
                    );
                  }}
                />
              )}
            </div>
            {lead.status !== "CONVERTED" && (
              <>
                {lead.source !== "CREATOR_APPLICATION" && (
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
                            Yêu cầu dự án có dịch vụ đã chọn sẽ được chuyển
                            thành dự án của khách hàng này.
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
                )}
                <section className="panel">
                  <h2>
                    {lead.source === "CREATOR_APPLICATION"
                      ? "Xét hồ sơ hợp tác"
                      : "Trao đổi qua email"}
                  </h2>
                  <a
                    className="btn btn-ghost"
                    href={`mailto:${encodeURIComponent(lead.email)}?subject=${encodeURIComponent(`MediaHub — ${intakeSourceLabels[lead.source] || "Liên hệ"}`)}&body=${encodeURIComponent(`Chào ${lead.full_name},\n\nMediaHub đã nhận thông tin của bạn.\n\n`)}`}
                  >
                    Soạn email phản hồi
                  </a>
                  {lead.source === "CREATOR_APPLICATION" && (
                    <>
                      <p>
                        Đánh dấu phù hợp chỉ ghi nhận kết quả xét hồ sơ. Tài
                        khoản Creator được cấp riêng sau hợp đồng hợp tác với
                        công ty.
                      </p>
                      <Link to="/admin/creators">
                        Cấp tài khoản Creator sau hợp đồng →
                      </Link>
                    </>
                  )}
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
                        <option key={s} value={s}>
                          {leadStatusLabels[s]}
                        </option>
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
