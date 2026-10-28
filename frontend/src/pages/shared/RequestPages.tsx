import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ActionForm,
  Page,
  Pagination,
  State,
  Status,
} from "../../components/ui";
import { useAuth } from "../../contexts/AuthContext";
import { useApi } from "../../hooks/useApi";
import { post } from "../../services/api";
import { isCustomerRole } from "../../lib/permissions";
import { requestsHome } from "../../lib/requests";
import type { RequestMetrics, RequestSummary } from "../../types/requests";
import { formatRequestBudget, formatRequestDate } from "./request-view";
type Collection<T> = { items: T[]; total: number; limit?: number };
export function RequestOverview() {
  const { role } = useAuth(),
    query = useApi<RequestMetrics>("/requests/summary");
  return (
    <section
      className="request-overview"
      aria-label="Tổng quan yêu cầu dịch vụ"
    >
      <State query={query}>
        {query.data && (
          <>
            <div className="request-metrics">
              {[
                ["Đang xử lý", query.data.active],
                ["Chờ khách bổ sung", query.data.waiting_customer],
                ["Mong muốn trong 7 ngày", query.data.due_soon],
                ["Qua ngày mong muốn", query.data.overdue],
              ].map(([name, value]) => (
                <div className="panel" key={name}>
                  <small>{name}</small>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <div className="toolbar">
              <Link to={requestsHome(role)}>Xem yêu cầu dịch vụ →</Link>
              {!isCustomerRole(role) && (
                <Link to={`${requestsHome(role)}?scope=queue`}>
                  {query.data.queued} yêu cầu chờ tiếp nhận →
                </Link>
              )}
            </div>
          </>
        )}
      </State>
    </section>
  );
}
export function StaffRequestDashboard() {
  const availability = useApi<{ busy: boolean; consultations: number }>(
    "/requests/availability",
  );
  return (
    <Page title="Công việc của bạn">
      <p>
        Yêu cầu mới được tự động phân cho Staff đang rảnh lâu nhất. Sau khi chốt
        đơn, bạn có thể tư vấn khách mới và tiếp tục phụ trách dự án cũ.
      </p>
      <section className="panel">
        <h2>Trạng thái tư vấn</h2>
        <State query={availability}>
          {availability.data && (
            <>
              <strong>
                {availability.data.busy
                  ? "Đang tư vấn"
                  : "Sẵn sàng nhận tư vấn"}
              </strong>
              <p>
                {availability.data.consultations} yêu cầu chưa chốt đang phụ
                trách.
              </p>
              <button className="btn btn-ghost" onClick={availability.reload}>
                Cập nhật trạng thái
              </button>
            </>
          )}
        </State>
      </section>
      <RequestOverview />
      <div className="panel">
        <h2>Công việc tiếp theo</h2>
        <div className="toolbar">
          <Link
            className="btn btn-primary"
            to="/staff/requests?scope=mine&sort=deadline"
          >
            Yêu cầu đang phụ trách
          </Link>
          <Link className="btn btn-ghost" to="/staff/requests?scope=queue">
            Xem hàng chờ tư vấn
          </Link>
          <Link to="/staff/orders">Đơn đã chốt</Link>
          <Link to="/staff/support">Hàng đợi hỗ trợ</Link>
        </div>
      </div>
    </Page>
  );
}
export function RequestList() {
  const { role } = useAuth(),
    navigate = useNavigate(),
    [params, setParams] = useSearchParams();
  const customer = isCustomerRole(role),
    home = requestsHome(role);
  const scope = customer
    ? "mine"
    : params.get("scope") || (role === "ADMIN" ? "all" : "mine");
  const page = Math.max(1, Number(params.get("page")) || 1);
  const query = useApi<Collection<RequestSummary>>(
    `/requests?${new URLSearchParams({ scope, page: String(page), search: params.get("search") || "", ...(params.get("status") ? { status: params.get("status")! } : {}), sort: params.get("sort") || "newest" })}`,
  );
  function change(name: string, value: string) {
    const next = new URLSearchParams(params);
    value ? next.set(name, value) : next.delete(name);
    next.delete("page");
    setParams(next);
  }
  return (
    <Page title="Yêu cầu tư vấn">
      <div className="workspace-intro">
        <p>
          {scope === "queue"
            ? "Nhận yêu cầu để xem brief và bắt đầu trao đổi với khách hàng."
            : "Theo dõi người phụ trách, ngày mong muốn và bước tiếp theo của mỗi yêu cầu."}
        </p>
        {customer && (
          <Link className="btn btn-primary" to={`${home}/new`}>
            Gửi yêu cầu mới
          </Link>
        )}
      </div>
      {!customer && (
        <nav className="request-tabs" aria-label="Phạm vi yêu cầu">
          {[
            ["mine", "Của tôi"],
            ["queue", "Chưa phân công"],
            ...(role === "ADMIN" ? [["all", "Tất cả"]] : []),
          ].map(([value, label]) => (
            <button
              key={value}
              className={`btn ${scope === value ? "btn-primary" : "btn-ghost"}`}
              onClick={() => change("scope", value)}
            >
              {label}
            </button>
          ))}
        </nav>
      )}
      <div className="request-filters">
        <label>
          Tìm theo tiêu đề
          <input
            value={params.get("search") || ""}
            onChange={(e) => change("search", e.target.value)}
            placeholder="Tên yêu cầu…"
          />
        </label>
        <label>
          Trạng thái
          <select
            value={params.get("status") || ""}
            onChange={(e) => change("status", e.target.value)}
          >
            <option value="">Tất cả</option>
            {[
              ["UNASSIGNED", "Chờ tiếp nhận"],
              ["ASSIGNED", "Đã phân công"],
              ["CONSULTING", "Đang tư vấn"],
              ["WAITING_CUSTOMER", "Chờ khách bổ sung"],
              ["CREATOR_SELECTION", "Đang chọn creator"],
              ["QUOTE_PREPARING", "Đang chuẩn bị báo giá"],
              ["QUOTE_SENT", "Báo giá chờ phản hồi"],
              ["QUOTE_REVISION", "Đang chỉnh báo giá"],
              ["CONVERTED", "Đã tạo đơn dịch vụ"],
              ["CANCELLED", "Đã hủy"],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sắp xếp
          <select
            value={params.get("sort") || "newest"}
            onChange={(e) => change("sort", e.target.value)}
          >
            <option value="newest">Mới nhất</option>
            <option value="deadline">Ngày mong muốn gần nhất</option>
          </select>
        </label>
      </div>
      <State query={query}>
        <div className="request-list">
          {query.data?.items.map((r) => (
            <article className="panel request-list-card" key={r.id}>
              <div>
                <small>
                  {r.request_number} · {r.service_name}
                </small>
                <h2>
                  {scope === "queue" ? (
                    r.title
                  ) : (
                    <Link to={`${home}/${r.id}`}>{r.title}</Link>
                  )}
                </h2>
                <Status value={r.status} />
                <p>
                  {formatRequestBudget(r)} · Mong muốn:{" "}
                  {formatRequestDate(r.deadline)}
                </p>
                <p>
                  Phụ trách: {r.assigned_staff?.full_name || "Chờ phân công"}
                </p>
              </div>
              {scope === "queue" ? (
                <ActionForm
                  label="Nhận yêu cầu"
                  showSuccess={false}
                  onSubmit={() => post(`/requests/${r.id}/claim`)}
                  onSuccess={() => navigate(`${home}/${r.id}`)}
                />
              ) : (
                <Link className="btn btn-ghost" to={`${home}/${r.id}`}>
                  Mở workspace →
                </Link>
              )}
            </article>
          ))}
        </div>
        {!query.data?.items.length && (
          <div className="panel empty-state">
            {scope === "queue"
              ? "Không có yêu cầu chờ tiếp nhận."
              : "Chưa có yêu cầu trong phạm vi này."}
            {customer && (
              <p>
                <Link to={`${home}/new`}>Gửi brief để nhận tư vấn</Link>
              </p>
            )}
          </div>
        )}
        <Pagination
          page={page}
          total={query.data?.total ?? 0}
          onChange={(value) => {
            const next = new URLSearchParams(params);
            next.set("page", String(value));
            setParams(next);
          }}
        />
      </State>
    </Page>
  );
}

export { CreateRequest } from "./CreateServiceRequestPage";
