import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  FolderKanban,
  Clock3,
  CheckCircle2,
  Wallet,
  Plus,
  Search,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useApi } from "../../hooks/useApi";
import {
  Page,
  State,
  Status,
  Pagination,
  money,
  labels,
} from "../../components/ui";
import { RequestOverview } from "./RequestPages";
import { MediaHubMvBillPanel } from "../../components/MediaHubMvBillPanel";

type DashboardData = {
  total_projects?: number;
  active_projects?: number;
  completed_projects?: number;
  total_revenue?: number;
  pending_payment?: number;
  new_leads?: number;
  pending_quotations?: number;
  pending_reviews?: number;
  outstanding_invoices?: number;
  recent_notifications?: {
    id: string;
    title: string;
    message: string;
    created_at?: string;
    read_at?: string | null;
  }[];
  by_status?: { status: string; count: number }[];
  showcase_completed_projects?: {
    id: string;
    slug: string;
    title: string;
    category: string;
  }[];
};
type ProjectSummary = {
  id: string;
  title: string;
  category: string;
  budget: number;
  deadline: string | null;
  status: string;
};
export function CustomerDashboard() {
  return <Dashboard />;
}
export function AdminDashboard() {
  return <Dashboard admin />;
}
function Dashboard({ admin = false }: { admin?: boolean }) {
  const auth = useAuth();
  const query = useApi<DashboardData>(
    admin ? "/admin/dashboard" : "/customer/dashboard",
  );
  return (
    <Page title={`Xin chào, ${auth.profile?.full_name || "bạn"} 👋`}>
      <div className="workspace-intro">
        <p>Cùng biến ý tưởng thành những sản phẩm ấn tượng.</p>
        {!admin && (
          <Link className="btn btn-primary" to="/customer/requests/new">
            <Plus size={17} /> Gửi yêu cầu dịch vụ
          </Link>
        )}
        {admin && (
          <Link className="btn btn-ghost" to="/admin/visit-analytics">
            Xem lượt truy cập <ArrowRight size={16} />
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
        <div className="dashboard-lower-grid">
          <section className="panel dashboard-recent">
            <div className="panel-head">
              <h2>Thông báo gần đây</h2>
              <Link
                to={admin ? "/admin/notifications" : "/customer/notifications"}
              >
                Xem tất cả →
              </Link>
            </div>
            {query.data?.recent_notifications?.map((notification) => (
              <article
                className={
                  notification.read_at ? "recent-read" : "recent-unread"
                }
                key={notification.id}
              >
                <div className="recent-heading">
                  <h3>{notification.title}</h3>
                  <span className="badge">
                    {notification.read_at ? "Đã đọc" : "Chưa đọc"}
                  </span>
                </div>
                <p>{notification.message}</p>
                {notification.created_at && (
                  <time dateTime={notification.created_at}>
                    {new Date(notification.created_at).toLocaleString("vi-VN")}
                  </time>
                )}
              </article>
            ))}
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
              {(query.data?.by_status ?? []).map((s) => (
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
          </div>
        </div>
      </State>
      {admin && <MediaHubMvBillPanel />}
      {admin && Boolean(query.data?.showcase_completed_projects?.length) && (
        <section className="panel">
          <h2>Dự án MediaHub đã hoàn thành</h2>
          <p>
            Ba MV thực hiện cùng Ngô Duy Anh, được công bố trong HỒ SƠ DỰ ÁN.
          </p>
          {query.data?.showcase_completed_projects?.map((project) => (
            <div className="panel-head" key={project.id}>
              <span>{project.title}</span>
              <Link to={`/projects/${project.slug}`}>Xem hồ sơ →</Link>
            </div>
          ))}
        </section>
      )}
      <h2 className="workspace-section-title">
        {admin ? "Dự án đang quản lý" : "Dự án của bạn"}
      </h2>
      <ProjectList admin={admin} />
    </Page>
  );
}
function Metrics({
  data,
  admin = false,
}: {
  data: DashboardData | null;
  admin?: boolean;
}) {
  const cards: [string, string | number, ReactNode][] = [
    ["Tổng dự án", data?.total_projects ?? 0, <FolderKanban />],
    ["Đang thực hiện", data?.active_projects ?? 0, <Clock3 />],
    ["Đã hoàn thành", data?.completed_projects ?? 0, <CheckCircle2 />],
    [
      admin ? "Doanh thu đã thu" : "Chờ thanh toán",
      money((admin ? data?.total_revenue : data?.pending_payment) ?? 0),
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
  const query = useApi<{ items: ProjectSummary[]; total: number }>(
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
              {query.data?.items.map((p) => (
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
export const date = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("vi-VN") : "—";
