import { useOrderUpdates } from "../../hooks/useOrderUpdates";
import { useEffect, useRef, useState } from "react";
import { ActionForm, Field, State, Status, labels } from "../../components/ui";
import { useAuth } from "../../contexts/AuthContext";
import { useApi } from "../../hooks/useApi";
import { post } from "../../services/api";
import { isCustomerRole } from "../../lib/permissions";
import { businessToday, quoteExpired } from "../../lib/commerce";
import type { OrderProduction, ProductionMilestone } from "../../types/commerce";
import { CreatorRoster } from "../../components/CreatorRoster";

export function OrderProductionPanel({ id, onChanged }: { id: string; onChanged: () => void }) {
  const { role } = useAuth(), customer = isCustomerRole(role), query = useApi<OrderProduction>(`/orders/${id}/production`, true), data = query.data;
  useOrderUpdates(id,query.reload);
  const callback = useRef(onChanged);
  useEffect(() => { callback.current = onChanged; }, [onChanged]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") { query.reload(); callback.current(); } };
    const timer = window.setInterval(refresh, 45000); window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [id]);
  const changed = () => { query.reload(); onChanged(); }, project = data?.project;
  const next = project?.production_status === "PLANNING" ? "READY" : ["READY", "ON_HOLD"].includes(project?.production_status ?? "") ? "IN_PROGRESS" : project?.production_status === "IN_PROGRESS" ? "ON_HOLD" : null;
  const canEdit = !!project && ["PLANNING", "READY", "IN_PROGRESS", "ON_HOLD"].includes(project.production_status);
  return <section className="panel contract-panel" id="production" aria-label="Kế hoạch sản xuất"><header><h2>Sản xuất &amp; các mốc thực hiện</h2><button className="btn btn-ghost" disabled={query.loading} onClick={changed}>Làm mới tiến độ</button></header><State query={query}>{data && <>
    {!project && <><p>{data.can_create ? "Đơn đã đủ điều kiện hợp đồng và khoản nhận được xác minh. Người phụ trách có thể lập kế hoạch sản xuất." : "Kế hoạch sản xuất được tạo sau khi đơn đã đủ điều kiện xác nhận. Báo chuyển khoản chưa được đối soát chưa mở bước này."}</p>{!customer && data.can_create && <ActionForm label="Tạo kế hoạch từ đơn đã xác nhận" onSubmit={() => post(`/orders/${id}/production/create`, {})} onSuccess={changed} />}</>}
    {project && <><p><Status value={project.production_status} /></p><h3>Đội theo hợp đồng gốc</h3><CreatorRoster team={data.team_snapshot}/><p className="muted">Đội đang thực hiện và lịch đổi người xem tại <a href="#execution">Điều phối &amp; lịch</a>.</p>{!data.team_snapshot?.length&&<p>Creator theo đơn: {data.creator.display_name}</p>}<dl><dt>Hạn dự án hiện tại</dt><dd>{project.deadline ? new Date(project.deadline).toLocaleDateString("vi-VN") : "Chưa đặt hạn trong brief"}</dd></dl><p className="preserve-lines">{project.scope}</p>
      {!customer && next && <details className="commerce-editor"><summary>Chuyển sang {labels[next].toLocaleLowerCase("vi-VN")}</summary>{next === "IN_PROGRESS" && !data.milestones.length ? <p>Thêm ít nhất một mốc thực hiện trước khi bắt đầu.</p> : <ActionForm label={`Chuyển sang ${labels[next].toLocaleLowerCase("vi-VN")}`} onSubmit={form => post(`/orders/${id}/production/status`, { status: next, reason: form.get(`production-reason-${next}`) })} onSuccess={changed}><Field name={`production-reason-${next}`} label="Nội dung chuyển trạng thái (hiển thị cho khách)" type="textarea" /></ActionForm>}</details>}
      <h3>Các mốc thực hiện</h3><p>{data.milestones.filter(m => m.status === "COMPLETED").length}/{data.milestones.length} mốc đã hoàn thành.</p>{!data.milestones.length && <p>Người phụ trách chưa thêm mốc sản xuất.</p>}
      {data.milestones.map(m => <MilestoneCard key={m.id} id={id} milestone={m} customer={customer} active={project.production_status === "IN_PROGRESS"} canEdit={canEdit} onChanged={changed} />)}
      {!customer && canEdit && <MilestoneBuilder id={id} nextOrder={data.milestones.length} onChanged={changed} />}
      <details><summary>Lịch sử sản xuất</summary>{data.history.map(h => <article key={h.id} className="production-history"><Status value={h.status} /><small>{new Date(h.created_at).toLocaleString("vi-VN")}</small><p className="preserve-lines">{h.note}</p></article>)}</details>
    </>}
  </>}</State></section>;
}
function MilestoneCard({ id, milestone: m, customer, active, canEdit, onChanged }: { id: string; milestone: ProductionMilestone; customer: boolean; active: boolean; canEdit: boolean; onChanged: () => void }) {
  const next = m.status === "PENDING" ? "IN_PROGRESS" : m.status === "IN_PROGRESS" ? "COMPLETED" : null;
  return <article className="quote-card"><header><strong>{m.title}</strong><Status value={m.status} /></header><p>Hạn: {new Date(m.due_date).toLocaleDateString("vi-VN")}{m.status !== "COMPLETED" && quoteExpired(m.due_date) && " · Quá hạn"}</p><p className="preserve-lines">{m.description}</p>
    {!customer && canEdit && m.status === "PENDING" && <details className="commerce-editor"><summary>Sửa mốc chưa bắt đầu</summary><MilestoneForm id={id} source={m} onChanged={onChanged} /></details>}
    {!customer && active && next && <details><summary>{next === "IN_PROGRESS" ? "Bắt đầu mốc này" : "Ghi nhận hoàn thành mốc"}</summary><ActionForm label={next === "IN_PROGRESS" ? "Bắt đầu mốc" : "Hoàn thành mốc"} onSubmit={form => post(`/orders/${id}/production/milestone_status`, { milestone_id: m.id, status: next, reason: form.get(`milestone-status-${m.id}`) })} onSuccess={onChanged}><Field name={`milestone-status-${m.id}`} label="Nội dung cập nhật (hiển thị cho khách)" type="textarea" /></ActionForm></details>}
  </article>;
}
function MilestoneBuilder({ id, nextOrder, onChanged }: { id: string; nextOrder: number; onChanged: () => void }) {
  const [done, setDone] = useState(false);
  return done ? <p>Mốc đã lưu. <button className="btn btn-ghost" onClick={() => setDone(false)}>Thêm mốc khác</button></p> : <details className="commerce-editor"><summary>Thêm mốc thực hiện</summary><MilestoneForm id={id} nextOrder={nextOrder} onChanged={() => { setDone(true); onChanged(); }} /></details>;
}
function MilestoneForm({ id, source, nextOrder = 0, onChanged }: { id: string; source?: ProductionMilestone; nextOrder?: number; onChanged: () => void }) {
  const [key] = useState(() => crypto.randomUUID()), prefix = source?.id ?? key;
  return <ActionForm label={source ? "Lưu mốc chưa bắt đầu" : "Thêm mốc thực hiện"} onSubmit={form => post(`/orders/${id}/production/milestone_save`, { milestone_id: source?.id ?? null, idempotency_key: key, title: form.get(`milestone-title-${prefix}`), description: form.get(`milestone-description-${prefix}`) || "", due_date: form.get(`milestone-due-${prefix}`), display_order: Number(form.get(`milestone-order-${prefix}`)) })} onSuccess={onChanged}>
    <Field name={`milestone-title-${prefix}`} label="Tên mốc" value={source?.title} /><Field name={`milestone-description-${prefix}`} label="Nội dung và đầu ra của mốc" type="textarea" value={source?.description} required={false} /><Field name={`milestone-due-${prefix}`} label="Hạn thực hiện mốc" type="date" value={source?.due_date ?? businessToday()} /><Field name={`milestone-order-${prefix}`} label="Thứ tự hiển thị (số nguyên)" type="number" value={source?.display_order ?? nextOrder} />
  </ActionForm>;
}
