import { Link, Navigate, useLocation, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useApi } from "../../hooks/useApi";
import { Page, Pagination, State, Status, money } from "../../components/ui";
import { isCustomerRole } from "../../lib/permissions";
import { ordersHome, orderNextAction } from "../../lib/commerce";
import { requestsHome } from "../../lib/requests";
import type { OrderSummary, OrderDetail } from "../../types/commerce";
export function OrderList() {
  const { role } = useAuth(), [params, setParams] = useSearchParams(), page = Math.max(1, Number(params.get("page")) || 1);
  const query = useApi<{ items: (OrderSummary & { request: { title: string; request_number: string }; assigned_staff: { full_name: string } })[]; total: number }>(`/orders?page=${page}`);
  return <Page title="Đơn dịch vụ"><p>Đơn được tạo từ đúng phiên bản báo giá bạn đã chấp nhận. Theo dõi hợp đồng, thanh toán và việc thực hiện tại đây.</p><State query={query}><div className="request-list">{query.data?.items.map(o => <article className="panel request-list-card" key={o.id}><div><small className="wrap-anywhere">{o.order_number}</small><h2><Link to={`${ordersHome(role)}/${o.id}`}>{o.request.title}</Link></h2><Status value={o.status} /><p>{money(o.total)} · Phụ trách: {o.assigned_staff.full_name}</p><p>{orderNextAction(o.status, isCustomerRole(role))}</p></div><Link className="btn btn-ghost" to={`${ordersHome(role)}/${o.id}`}>Xem đơn →</Link></article>)}</div>{!query.data?.items.length && <div className="panel empty-state"><p>Chưa có đơn dịch vụ.</p><Link to={requestsHome(role)}>Xem yêu cầu và báo giá →</Link></div>}<Pagination page={page} total={query.data?.total ?? 0} onChange={value => setParams({ page: String(value) })} /></State></Page>;
}
export function OrderWorkspace() {
  const { id } = useParams(), { role } = useAuth(), location = useLocation();
  const query = useApi<OrderDetail>(`/orders/${id}`, true);
  return <Page title="Mở hội thoại dịch vụ"><State query={query}>{query.data && <Navigate replace to={`${requestsHome(role)}/${query.data.order.request_id}${location.hash || "#commercial"}`} />}</State></Page>;
}
