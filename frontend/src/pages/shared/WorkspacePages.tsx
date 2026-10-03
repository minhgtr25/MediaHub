import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  FolderKanban,
  Clock3,
  CheckCircle2,
  Wallet,
  Plus,
  Search,
  FileText,
  Download,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useApi } from "../../hooks/useApi";
import {
  ActionForm,
  Field,
  Page,
  State,
  Status,
  Pagination,
  money,
  labels,
} from "../../components/ui";
import {
  projectService,
  adminService,
  quotationService,
  uploadService,
  reviewService,
} from "../../services";
import { ProjectMessages, ProjectMilestones } from "../customer/CustomerBillingAndMessagesPages";
import { EditProject } from "../admin/ProjectFileManagementPage";
import { patch, post } from "../../services/api";
import { RequestOverview } from "./RequestPages";

export function CustomerDashboard() {
  return <Dashboard />;
}
export function AdminDashboard() {
  return <Dashboard admin />;
}
function Dashboard({ admin = false }: { admin?: boolean }) {
  const auth = useAuth();
  const query = useApi(admin ? "/admin/dashboard" : "/customer/dashboard");
  return (
    <Page title={`Xin chào, ${auth.profile?.full_name || "bạn"} 👋`}>
      <div className="workspace-intro">
        <p>Cùng biến ý tưởng thành những sản phẩm ấn tượng.</p>
        {!admin && (
          <Link className="btn btn-primary" to="/customer/requests/new">
            <Plus size={17} /> Gửi yêu cầu dịch vụ
          </Link>
        )}
      </div>
      <RequestOverview />
      <State query={query}>
        <Metrics data={query.data} admin={admin} />
        <div className="kpi-grid">
          {admin && (
            <div className="kpi">
              <div>
                <small>Lead mới</small>
                <b>{query.data?.new_leads ?? 0}</b>
              </div>
            </div>
          )}
          <div className="kpi">
            <div>
              <small>Báo giá chờ phản hồi</small>
              <b>{query.data?.pending_quotations ?? 0}</b>
            </div>
          </div>
          <div className="kpi">
            <div>
              <small>Dự án chờ duyệt</small>
              <b>{query.data?.pending_reviews ?? 0}</b>
            </div>
          </div>
          <div className="kpi">
            <div>
              <small>Hóa đơn chưa thanh toán</small>
              <b>{query.data?.outstanding_invoices ?? 0}</b>
            </div>
          </div>
        </div>
        <div className="dashboard-lower-grid"><section className="panel dashboard-recent">
          <div className="panel-head"><h2>Thông báo gần đây</h2><Link to={admin ? "/admin/notifications" : "/customer/notifications"}>Xem tất cả →</Link></div>
          {query.data?.recent_notifications?.map(
            (notification: { id: string; title: string; message: string; created_at?: string; read_at?: string }) => (
              <article className={notification.read_at ? "recent-read" : "recent-unread"} key={notification.id}>
                <div className="recent-heading"><h3>{notification.title}</h3><span className="badge">{notification.read_at ? "Đã đọc" : "Chưa đọc"}</span></div>
                <p>{notification.message}</p>{notification.created_at && <time dateTime={notification.created_at}>{new Date(notification.created_at).toLocaleString("vi-VN")}</time>}
              </article>
            ),
          )}
          {!query.data?.recent_notifications?.length && (
            <p>Chưa có thông báo.</p>
          )}
        </section>
        <div className="panel">
          <div className="panel-head">
            <b>Tiến độ dự án</b>
            <span>Cập nhật từ tất cả dự án của bạn</span>
          </div>
          <div className="status-overview">
            {(query.data?.by_status ?? []).map((s: any) => (
              <div key={s.status}>
                <Status value={s.status} />
                <strong>{s.count}</strong>
              </div>
            ))}
          </div>
          {!query.data?.total_projects && (
            <p>
              Chưa có dự án. Bắt đầu bằng cách gửi yêu cầu đầu tiên của bạn.
            </p>
          )}
        </div></div>
      </State>
      <h2 className="workspace-section-title">Dự án của bạn</h2>
      <ProjectList admin={admin} />
    </Page>
  );
}
function Metrics({ data, admin = false }: { data: any; admin?: boolean }) {
  const cards: [string, string | number, ReactNode][] = [
    ["Tổng dự án", data?.total_projects ?? 0, <FolderKanban />],
    ["Đang thực hiện", data?.active_projects ?? 0, <Clock3 />],
    ["Đã hoàn thành", data?.completed_projects ?? 0, <CheckCircle2 />],
    [
      admin ? "Doanh thu đã thu" : "Chờ thanh toán",
      money(admin ? data?.total_revenue : data?.pending_payment),
      <Wallet />,
    ],
  ];
  return (
    <div className="kpi-grid">
      {cards.map(([label, value, icon]) => (
        <div className="kpi" key={label}>
          <span>{icon}</span>
          <div>
            <small>{label}</small>
            <b>{value}</b>
          </div>
        </div>
      ))}
    </div>
  );
}
export function AdminProjects() {
  return (
    <Page title="Quản lý dự án">
      <p>Theo dõi yêu cầu, báo giá và tiến độ bàn giao.</p>
      <ProjectList admin />
    </Page>
  );
}
export function ProjectList({ admin = false }: { admin?: boolean }) {
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(1);
  const query = useApi(
    `${admin ? "/admin" : ""}/projects?page=${page}&search=${encodeURIComponent(search)}${status ? "&status=" + status : ""}`,
  );
  return (
    <>
      <div className="toolbar">
        <div className="search-input">
          <Search size={18} />
          <input
            aria-label="Tìm dự án"
            placeholder="Tìm theo tên dự án…"
            maxLength={100}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          aria-label="Trạng thái dự án"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Tất cả trạng thái</option>
          {[
            "DRAFT",
            "SUBMITTED",
            "REVIEWING",
            "QUOTATION_SENT",
            "QUOTATION_ACCEPTED",
            "IN_PROGRESS",
            "WAITING_REVIEW",
            "REVISION",
            "COMPLETED",
            "CANCELLED",
          ].map((s) => (
            <option key={s} value={s}>
              {labels[s]}
            </option>
          ))}
        </select>
      </div>
      <State query={query}>
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Dự án</th>
                <th>Dịch vụ</th>
                <th>Ngân sách</th>
                <th>Hạn bàn giao</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {query.data?.items.map((p: any) => (
                <tr key={p.id}>
                  <td>
                    <Link
                      to={`/${admin ? "admin" : "customer"}/projects/${p.id}`}
                    >
                      <b>{p.title}</b>
                    </Link>
                  </td>
                  <td>{p.category}</td>
                  <td>{money(p.budget)}</td>
                  <td>{date(p.deadline)}</td>
                  <td>
                    <Status value={p.status} />
                  </td>
                  <td>
                    <Link
                      aria-label={`Xem ${p.title}`}
                      to={`/${admin ? "admin" : "customer"}/projects/${p.id}`}
                    >
                      <ArrowRight size={17} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!query.data?.items.length && (
            <div className="empty-state">
              <FolderKanban />
              <h3>Chưa có dự án phù hợp</h3>
              <p>Thử thay đổi từ khóa hoặc trạng thái tìm kiếm.</p>
            </div>
          )}
        </div>
        <Pagination
          page={page}
          total={query.data?.total ?? 0}
          onChange={setPage}
        />
      </State>
    </>
  );
}
export const date = (value?: string) =>
  value ? new Date(value).toLocaleDateString("vi-VN") : "—";
export function CreateProject() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const query = useApi("/public/services?limit=100");
  const [selected, setSelected] = useState<string[]>(() => params.get("service") ? [params.get("service")!] : []),
    [step, setStep] = useState(0);
  return (
    <Page title="Bắt đầu dự án mới">
      <p>Chia sẻ ý tưởng của bạn. MediaHub sẽ tư vấn giải pháp phù hợp.</p>
      <div className="wizard">
        <div className="wizard-steps create-steps">
          {["Chọn dịch vụ", "Thông tin & gửi yêu cầu"].map((label, i) => (
            <div key={label} className={i <= step ? "active" : ""}>
              <span>{i + 1}</span>
              {label}
            </div>
          ))}
        </div>
        <State query={query}>
          <div className="form-panel">
            <ActionForm
              showSubmit={step > 0}
              label="Gửi yêu cầu dự án"
              onSubmit={async (data) => {
                if (!selected.length)
                  throw new Error("Vui lòng chọn ít nhất một dịch vụ.");
                const firstService = query.data?.items.find((s: {id: string}) => s.id === selected[0]);
                if (!firstService) throw new Error("Dịch vụ đã chọn không còn khả dụng. Vui lòng chọn lại.");
                const result = await projectService.create({
                  title: String(data.get("title")),
                  description: String(data.get("description")),
                  category: firstService.category || firstService.name,
                  budget: Number(data.get("budget")),
                  deadline: String(data.get("deadline")),
                  service_ids: selected,
                  status: "SUBMITTED",
                });
                navigate("/customer/projects/" + result.id);
              }}
            >
              <section hidden={step !== 0}>
                <h2>Bạn đang cần dịch vụ gì?</h2>
                <p>Có thể chọn nhiều dịch vụ cho cùng một dự án.</p>
                <div className="choice-grid">
                  {query.data?.items.map((s: any) => (
                    <button
                      type="button"
                      aria-pressed={selected.includes(s.id)}
                      className={`choice ${selected.includes(s.id) ? "chosen" : ""}`}
                      key={s.id}
                      onClick={() =>
                        setSelected((prev) =>
                          prev.includes(s.id)
                            ? prev.filter((id) => id !== s.id)
                            : [...prev, s.id],
                        )
                      }
                    >
                      <span>
                        {selected.includes(s.id) ? "✓ Đã chọn" : "＋ Lựa chọn"}
                      </span>
                      <b>{s.name}</b>
                      <small>{s.description}</small>
                      <small>Từ {money(s.starting_price)}</small>
                    </button>
                  ))}
                </div>
                {!query.data?.items.length && <p>Chưa có dịch vụ khả dụng.</p>}
                <div className="wizard-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!selected.length}
                    onClick={() => setStep(1)}
                  >
                    Tiếp tục <ArrowRight size={16} />
                  </button>
                </div>
              </section>
              <section hidden={step === 0}>
                <h2>Thông tin & ngân sách</h2>
                <Field name="title" label="Tên dự án" />
                <Field
                  name="description"
                  label="Mục tiêu, đối tượng và yêu cầu sản phẩm"
                  type="textarea"
                />
                <div className="form-grid">
                  <Field
                    name="budget"
                    label="Ngân sách dự kiến (VNĐ)"
                    type="number"
                  />
                  <Field
                    name="deadline"
                    label="Ngày bàn giao mong muốn"
                    type="date"
                  />
                </div>
                <div className="summary">
                  <b>Dịch vụ đã chọn</b>
                  <p>
                    {query.data?.items
                      .filter((s: any) => selected.includes(s.id))
                      .map((s: any) => s.name)
                      .join(" · ")}
                  </p>
                  <p>
                    MediaHub sẽ xem xét yêu cầu và gửi báo giá trước khi triển
                    khai.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setStep(0)}
                >
                  Quay lại chọn dịch vụ
                </button>
              </section>
            </ActionForm>
          </div>
        </State>
      </div>
    </Page>
  );
}
export function CustomerProject() {
  return <ProjectWorkspace />;
}
export function AdminProjectDetail() {
  return <ProjectWorkspace admin />;
}
function ProjectWorkspace({ admin = false }: { admin?: boolean }) {
  const { id = "" } = useParams();
  const query = useApi("/projects/" + id),
    p = query.data;
  const transitions: Record<string, string[]> = {
    SUBMITTED: ["REVIEWING", "CANCELLED"],
    REVIEWING: ["CANCELLED"],
    QUOTATION_SENT: ["CANCELLED"],
    QUOTATION_ACCEPTED: ["IN_PROGRESS"],
    IN_PROGRESS: ["WAITING_REVIEW"],
    REVISION: ["WAITING_REVIEW"],
  };
  return (
    <Page title="Chi tiết dự án">
      <Link
        className="back"
        to={admin ? "/admin/projects" : "/customer/dashboard"}
      >
        ← Quay lại danh sách
      </Link>
      <State query={query}>
        {p && (
          <div className="customer-project">
            <nav className="toolbar" aria-label="Nội dung dự án">
              {[
                ["quotation", "Báo giá"],
                ["deliverables", "Bàn giao"],
                ["files", "Tệp"],
                ["revisions", "Chỉnh sửa"],
                ["timeline", "Lịch sử"],
              ].map(([anchor, title]) => (
                <a className="btn btn-ghost" key={anchor} href={`#${anchor}`}>
                  {title}
                </a>
              ))}
              <Link
                className="btn btn-ghost"
                to={`${admin ? "/admin" : "/customer"}/projects/${id}/messages`}
              >
                Trao đổi
              </Link>
            </nav>
            <ProjectMilestones projectId={id} admin={admin} />
            <section className="panel">
              <div className="project-title">
                <div>
                  <span className="eyebrow">{p.category}</span>
                  <h2>{p.title}</h2>
                </div>
                <Status value={p.status} />
              </div>
              <p className="preserve-lines">{p.description}</p>
              {p.scope && <p className="preserve-lines">Phạm vi: {p.scope}</p>}
              <label>
                Tiến độ: {p.progress ?? 0}%{" "}
                <progress max="100" value={p.progress ?? 0} />
              </label>
              <div className="result-row">
                <div>
                  <span>Ngân sách dự kiến</span>
                  <b>{money(p.budget)}</b>
                </div>
                <div>
                  <span>Hạn bàn giao</span>
                  <b>{date(p.deadline)}</b>
                </div>
                <div>
                  <span>Ngày tạo</span>
                  <b>{date(p.created_at)}</b>
                </div>
              </div>
            </section>
            <div className="split">
              <div className="stack">
                <section className="panel">
                  <h2 id="quotation">Báo giá</h2>
                  {!p.quotations?.length && (
                    <p>MediaHub đang chuẩn bị báo giá cho dự án.</p>
                  )}
                  {p.quotations?.map((q: any) => (
                    <div className="quotation" key={q.id}>
                      <div className="panel-head">
                        <b>{money(q.total)}</b>
                        <Status value={q.status} />
                      </div>
                      <p>Hiệu lực đến {date(q.valid_until)}</p>
                      {q.quotation_items?.map((item: any) => (
                        <p key={item.id}>
                          {item.description} · {item.quantity} ×{" "}
                          {money(item.unit_price)}
                        </p>
                      ))}
                      <p>Giảm giá: {money(q.discount)}</p>
                      <p>
                        Tạm tính: {money(q.subtotal)} · Thuế ({q.tax_rate ?? 0}
                        %): {money(q.tax ?? 0)}
                      </p>
                      {admin && (
                        <Link to={`/admin/quotations/${q.id}`}>
                          Xem và quản lý báo giá
                        </Link>
                      )}
                      <p>{q.notes}</p>
                      {!admin &&
                        p.status === "QUOTATION_SENT" &&
                        q.status === "SENT" && (
                          <div className="toolbar">
                            <ActionForm
                              label="Chấp nhận báo giá"
                              onSubmit={() => {
                                if (
                                  !window.confirm(
                                    "Xác nhận chấp nhận báo giá và phạm vi dự án?",
                                  )
                                )
                                  throw new Error("Chưa xác nhận báo giá.");
                                return projectService.action(
                                  id,
                                  "accept-quotation",
                                );
                              }}
                              onSuccess={query.reload}
                            />
                            <ActionForm
                              label="Từ chối báo giá"
                              onSubmit={() => {
                                if (
                                  !window.confirm(
                                    "Từ chối báo giá sẽ hủy dự án. Bạn muốn tiếp tục?",
                                  )
                                )
                                  throw new Error("Chưa từ chối báo giá.");
                                return projectService.action(
                                  id,
                                  "reject-quotation",
                                );
                              }}
                              onSuccess={query.reload}
                            />
                          </div>
                        )}
                    </div>
                  ))}
                </section>
                <section className="panel">
                  <h2 id="deliverables">Sản phẩm bàn giao</h2>
                  <FileList
                    id={id}
                    files={p.deliverables ?? []}
                    kind="deliverables"
                  />
                  {admin && ["IN_PROGRESS", "REVISION"].includes(p.status) && (
                    <UploadForm
                      path={`/admin/projects/${id}/deliverables`}
                      reload={query.reload}
                    />
                  )}
                  {!admin && p.status === "WAITING_REVIEW" && (
                    <>
                      {p.deliverables
                        ?.filter(
                          (deliverable: { status: string }) =>
                            deliverable.status === "PENDING_APPROVAL",
                        )
                        .map((deliverable: { id: string; name: string }) => (
                          <ActionForm
                            key={deliverable.id}
                            label={`Duyệt: ${deliverable.name}`}
                            onSubmit={() => {
                              if (
                                !window.confirm(
                                  "Xác nhận duyệt sản phẩm bàn giao này?",
                                )
                              )
                                throw new Error("Chưa xác nhận.");
                              return projectService.action(
                                id,
                                "approve-deliverable",
                                { deliverable_id: deliverable.id },
                              );
                            }}
                            onSuccess={query.reload}
                          />
                        ))}
                      <ActionForm
                        label="Duyệt & hoàn thành dự án"
                        onSubmit={() => {
                          if (
                            !window.confirm(
                              "Xác nhận nghiệm thu sản phẩm và hoàn thành dự án?",
                            )
                          )
                            throw new Error("Chưa xác nhận nghiệm thu.");
                          return projectService.action(id, "complete");
                        }}
                        onSuccess={query.reload}
                      />
                      <ActionForm
                        label="Gửi yêu cầu chỉnh sửa"
                        onSubmit={(data) =>
                          projectService.action(id, "revisions", {
                            description: String(data.get("description")),
                            ...(data.get("deliverable_id")
                              ? {
                                  deliverable_id: String(
                                    data.get("deliverable_id"),
                                  ),
                                }
                              : {}),
                          })
                        }
                        onSuccess={query.reload}
                      >
                        <Field
                          name="description"
                          label="Nội dung cần chỉnh sửa"
                          type="textarea"
                        />
                        <label className="field">
                          Sản phẩm cần chỉnh sửa
                          <select name="deliverable_id">
                            <option value="">
                              Tất cả sản phẩm đang chờ duyệt
                            </option>
                            {p.deliverables
                              ?.filter(
                                (deliverable: { status: string }) =>
                                  deliverable.status === "PENDING_APPROVAL",
                              )
                              .map(
                                (deliverable: { id: string; name: string }) => (
                                  <option
                                    value={deliverable.id}
                                    key={deliverable.id}
                                  >
                                    {deliverable.name}
                                  </option>
                                ),
                              )}
                          </select>
                        </label>
                      </ActionForm>
                    </>
                  )}
                </section>
                <section className="panel">
                  <h2 id="files">Tài liệu dự án</h2>
                  <FileList
                    id={id}
                    files={p.project_files ?? []}
                    kind="files"
                  />
                  {!["COMPLETED", "CANCELLED"].includes(p.status) && (
                    <UploadForm
                      path={`/projects/${id}/files`}
                      reload={query.reload}
                    />
                  )}
                </section>
              </div>
              <aside className="stack">
                {admin && !["COMPLETED", "CANCELLED"].includes(p.status) && (
                  <EditProject project={p} reload={query.reload} />
                )}
                {admin && transitions[p.status]?.length > 0 && (
                  <section className="panel">
                    <h2>Cập nhật tiến độ</h2>
                    <ActionForm
                      onSubmit={(data) =>
                        adminService.status(id, String(data.get("status")))
                      }
                      onSuccess={query.reload}
                    >
                      <label className="field">
                        Trạng thái tiếp theo
                        <select name="status">
                          {transitions[p.status].map((s) => (
                            <option key={s} value={s}>
                              {labels[s]}
                            </option>
                          ))}
                        </select>
                      </label>
                    </ActionForm>
                  </section>
                )}
                {admin && p.status === "REVIEWING" && (
                  <QuoteForm
                    id={id}
                    services={p.project_services ?? []}
                    draft={p.quotations?.find(
                      (quote: { status: string }) => quote.status === "DRAFT",
                    )}
                    reload={query.reload}
                  />
                )}
                <section className="panel">
                  <h2 id="timeline">Lịch sử hoạt động</h2>
                  <ol className="activity-list">
                    {[...(p.project_status_history ?? [])]
                      .sort((a: any, b: any) =>
                        a.created_at.localeCompare(b.created_at),
                      )
                      .map((h: any) => (
                        <li key={h.id}>
                          <Status value={h.status} />
                          <p>{h.note || "Đã cập nhật trạng thái dự án"}</p>
                          <small>{date(h.created_at)}</small>
                        </li>
                      ))}
                  </ol>
                  {!p.project_status_history?.length && (
                    <p>Chưa có hoạt động.</p>
                  )}
                </section>
                <section className="panel">
                  <h2>Thanh toán</h2>
                  {p.invoices?.map((i: any) => (
                    <div key={i.id}>
                      <p>{i.invoice_number}</p>
                      <h3>{money(i.amount)}</h3>
                      <Status value={i.status} />
                      {admin && i.status === "DRAFT" && (
                        <Link to={`/admin/invoices/${i.id}`}>
                          Xem và phát hành hóa đơn
                        </Link>
                      )}
                      {admin && i.status === "PENDING" && (
                        <ActionForm
                          label="Xác nhận đã thanh toán"
                          onSubmit={() => {
                            if (
                              !window.confirm(
                                "Xác nhận đã nhận khoản thanh toán này?",
                              )
                            )
                              throw new Error("Chưa xác nhận thanh toán.");
                            return post(`/admin/projects/${id}/paid`);
                          }}
                          onSuccess={query.reload}
                        />
                      )}
                    </div>
                  ))}
                  {!p.invoices?.length && <p>Chưa phát sinh hóa đơn.</p>}
                </section>
                {p.revision_requests?.length > 0 && (
                  <section className="panel">
                    <h2 id="revisions">Yêu cầu chỉnh sửa</h2>
                    {p.revision_requests.map((r: any) => (
                      <div key={r.id}>
                        <Status value={r.status} />
                        <p>{r.description}</p>
                        {admin &&
                          ["PENDING", "REQUESTED", "IN_PROGRESS"].includes(
                            r.status,
                          ) && (
                            <ActionForm
                              onSubmit={(data) =>
                                patch(
                                  "/admin/projects/" +
                                    id +
                                    "/revisions/" +
                                    r.id,
                                  { status: data.get("revision_status") },
                                )
                              }
                              onSuccess={query.reload}
                            >
                              <label className="field">
                                Trạng thái
                                <select name="revision_status">
                                  <option>IN_PROGRESS</option>
                                  <option>RESOLVED</option>
                                  <option>CANCELLED</option>
                                </select>
                              </label>
                            </ActionForm>
                          )}
                      </div>
                    ))}
                  </section>
                )}
              </aside>
            </div>
            {!admin && p.status === "COMPLETED" && !p.reviews?.length && (
              <section className="panel">
                <h2>Đánh giá trải nghiệm</h2>
                <ActionForm
                  label="Gửi đánh giá"
                  onSubmit={(data) =>
                    reviewService.create(id, {
                      rating: Number(data.get("rating")),
                      quality_rating: Number(data.get("quality_rating")),
                      communication_rating: Number(
                        data.get("communication_rating"),
                      ),
                      value_rating: Number(data.get("value_rating")),
                      comment: String(data.get("comment")),
                    })
                  }
                  onSuccess={query.reload}
                >
                  <div className="form-grid">
                    {[
                      ["rating", "Tổng thể"],
                      ["quality_rating", "Chất lượng"],
                      ["communication_rating", "Trao đổi"],
                      ["value_rating", "Giá trị"],
                    ].map(([name, label]) => (
                      <label className="field" key={name}>
                        {label}
                        <select name={name}>
                          {[5, 4, 3, 2, 1].map((v) => (
                            <option key={v} value={v}>
                              {v} sao
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                  <Field
                    name="comment"
                    label="Chia sẻ trải nghiệm của bạn"
                    type="textarea"
                  />
                </ActionForm>
              </section>
            )}
          </div>
        )}
      </State>
    </Page>
  );
}
function FileList({
  id,
  files,
  kind,
}: {
  id: string;
  files: any[];
  kind: string;
}) {
  const [error, setError] = useState("");
  return (
    <>
      {!files.length && <p>Chưa có tệp được tải lên.</p>}
      {files.map((f) => (
        <div className="file" key={f.id}>
          <FileText />
          <div>
            <b>{f.file_name || f.name}</b>
            <small>
              {f.version ? `Phiên bản ${f.version}` : date(f.created_at)}
            </small>
          </div>
          <button
            className="icon-btn"
            aria-label={`Tải ${f.file_name || f.name}`}
            onClick={async () => {
              try {
                setError("");
                const result = await uploadService.download(id, kind, f.id);
                window.location.assign(result.signedUrl);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <Download size={17} />
          </button>
        </div>
      ))}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </>
  );
}
function UploadForm({ path, reload }: { path: string; reload: () => void }) {
  return (
    <ActionForm
      label="Tải tệp lên"
      onSubmit={(data) => {
        const file = data.get("file") as File;
        if (!file?.size) throw new Error("Vui lòng chọn tệp.");
        return uploadService.upload(path, file);
      }}
      onSuccess={reload}
    >
      <label className="upload">
        Ảnh, video hoặc PDF · Tối đa 50 MB
        <input
          aria-label="Chọn tệp tải lên"
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,application/pdf"
          required
        />
      </label>
    </ActionForm>
  );
}
function QuoteForm({
  id,
  services,
  reload,
  draft,
}: {
  id: string;
  services: any[];
  reload: () => void;
  draft?: {
    quotation_items: {
      service_id: string;
      description: string;
      quantity: number;
      unit_price: number;
    }[];
    discount: number;
    valid_until: string;
    notes: string;
    tax_rate: number;
  };
}) {
  return (
    <section className="panel">
      <h2>Soạn báo giá</h2>
      <ActionForm
        label="Lưu báo giá"
        onSubmit={(data) =>
          post(
            `/admin/projects/${id}/${data.get("mode") === "DRAFT" ? "quotation-draft" : "quotation"}`,
            {
              items: services.map((s, i) => ({
                service_id: s.service_id,
                description: String(data.get(`desc-${i}`)),
                quantity: Number(data.get(`quantity-${i}`)),
                unit_price: Number(data.get(`price-${i}`)),
              })),
              discount: Number(data.get("discount")),
              tax_rate: Number(data.get("tax_rate")),
              valid_until: String(data.get("valid_until")),
              notes: String(data.get("notes")),
            },
          )
        }
        onSuccess={reload}
      >
        {services.map((s, i) => (
          <div key={s.service_id}>
            <Field
              name={`desc-${i}`}
              label={`Hạng mục ${i + 1}`}
              value={
                draft?.quotation_items.find(
                  (item) => item.service_id === s.service_id,
                )?.description
              }
            />
            <label className="field">
              Số lượng
              <input
                type="number"
                name={`quantity-${i}`}
                min="1"
                max="10000"
                step="1"
                required
                defaultValue={
                  draft?.quotation_items.find(
                    (item) => item.service_id === s.service_id,
                  )?.quantity ?? 1
                }
              />
            </label>
            <Field
              name={`price-${i}`}
              label="Đơn giá (VNĐ)"
              type="number"
              value={
                draft?.quotation_items.find(
                  (item) => item.service_id === s.service_id,
                )?.unit_price
              }
            />
          </div>
        ))}
        <Field
          name="discount"
          label="Giảm giá (VNĐ)"
          type="number"
          value={draft?.discount ?? 0}
        />
        <Field
          name="tax_rate"
          label="Thuế (%)"
          type="number"
          value={draft?.tax_rate ?? 0}
        />
        <Field
          name="valid_until"
          label="Hiệu lực đến"
          type="date"
          value={draft?.valid_until}
        />
        <Field
          name="notes"
          label="Điều khoản và ghi chú"
          type="textarea"
          required={false}
          value={draft?.notes}
        />
        <label className="field">
          Thao tác
          <select name="mode" defaultValue="DRAFT">
            <option value="DRAFT">Lưu bản nháp để xem trước</option>
            <option value="SENT">Lưu và gửi cho khách hàng</option>
          </select>
        </label>
      </ActionForm>
    </section>
  );
}
