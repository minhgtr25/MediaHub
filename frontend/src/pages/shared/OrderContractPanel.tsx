import { PublicationNameField } from "./OrderReviewPanel";
import { CreatorRoster } from "../../components/CreatorRoster";
import { useEffect, useRef, useState } from "react";
import { ActionForm, Field, State, Status } from "../../components/ui";
import { useAuth } from "../../contexts/AuthContext";
import { useApi } from "../../hooks/useApi";
import { post } from "../../services/api";
import { isCustomerRole } from "../../lib/permissions";
import { businessToday, quoteExpired } from "../../lib/commerce";
import type { OrderContract, OrderContracts } from "../../types/commerce";

export function OrderContractPanel({ id, orderStatus, onChanged }: { id: string; orderStatus: string; onChanged: () => void }) {
  const { role } = useAuth(), customer = isCustomerRole(role), query = useApi<OrderContracts>(`/orders/${id}/contracts`, true);
  const waiting = orderStatus === "WAITING_CONTRACT", contracts = query.data?.contracts ?? [], draft = contracts.find(c => c.status === "DRAFT");
  const pending = contracts.some(c => ["SENT", "VIEWED", "ACKNOWLEDGED"].includes(c.status));
  const callback = useRef(onChanged);
  useEffect(() => { callback.current = onChanged; }, [onChanged]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") { query.reload(); callback.current(); } };
    const timer = window.setInterval(refresh, 45000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [id]);
  const changed = () => { query.reload(); onChanged(); };
  return <section className="panel contract-panel" aria-label="Hợp đồng và xác nhận điều khoản"><header><h2>Hợp đồng &amp; điều khoản</h2><button className="btn btn-ghost" disabled={query.loading} onClick={changed}>Làm mới điều khoản</button></header><p className="muted">Xác nhận trong ứng dụng lưu phiên bản và nội dung bạn đã đọc. Chữ ký điện tử qua nhà cung cấp chưa được tích hợp.</p><State query={query}>
    {query.data?.acknowledgment && <div className="contract-evidence"><strong>Đã xác nhận điều khoản trong ứng dụng</strong><p>{new Date(query.data.acknowledgment.acknowledged_at).toLocaleString("vi-VN")}</p><p className="muted">Đơn chuyển sang bước thanh toán. Việc xác nhận điều khoản chưa ghi nhận khoản thu.</p></div>}
    {!contracts.length && <p>{customer ? "Người phụ trách sẽ gửi điều khoản cho đúng báo giá đã chấp nhận." : "Chưa có bản điều khoản cho đơn này."}</p>}
    {contracts.map((contract, index) => <ContractCard key={contract.id} contract={contract} id={id} customer={customer} active={waiting && index === 0} onChanged={changed} />)}
    {!customer && waiting && !pending && <details className="commerce-editor" open><summary>{draft ? `Sửa bản nháp điều khoản v${draft.version}` : "Chuẩn bị phiên bản điều khoản mới"}</summary><ContractBuilder key={draft?.id ?? "new"} id={id} source={draft ?? contracts[0]} onChanged={changed} /></details>}
  </State></section>;
}
function ContractBuilder({ id, source, onChanged }: { id: string; source?: OrderContract; onChanged: () => void }) {
  return <ActionForm label="Lưu bản nháp điều khoản" onSubmit={form => post(`/orders/${id}/contract_save`, { title: form.get("contract-title"), content: form.get("contract-content"), valid_until: form.get("contract-valid-until") })} onSuccess={onChanged}>
    <Field name="contract-title" label="Tiêu đề điều khoản" value={source?.title} />
    <div className="field"><label htmlFor="contract-content">Nội dung điều khoản (gửi cho khách)</label><textarea id="contract-content" name="contract-content" required maxLength={100000} rows={14} defaultValue={source?.content} /></div>
    <Field name="contract-valid-until" label="Hạn xác nhận điều khoản" type="date" value={source?.valid_until && source.valid_until >= businessToday() ? source.valid_until : businessToday()} />
    <p className="muted">Kiểm tra phạm vi, đầu ra, số tiền và điều kiện của đúng báo giá đã được chấp nhận trước khi gửi. Phiên bản đã gửi sẽ được giữ nguyên.</p>
  </ActionForm>;
}
function ContractCard({ contract: c, id, customer, active, onChanged }: { contract: OrderContract; id: string; customer: boolean; active: boolean; onChanged: () => void }) {
  const [viewError, setViewError] = useState(""), lock = useRef(false), expired = quoteExpired(c.valid_until), pending = ["SENT", "VIEWED"].includes(c.status);
  const action = (operation: string, extra = {}) => post(`/orders/${id}/${operation}`, { contract_id: c.id, ...extra });
  async function viewed(open: boolean) {
    if (!open || !customer || !active || c.status !== "SENT" || expired || lock.current) return;
    lock.current = true; setViewError("");
    try { await action("contract_view"); onChanged(); } catch (e) { setViewError((e as Error).message); } finally { lock.current = false; }
  }
  return <article id={`contract-${c.id}`} className="quote-card"><header><div><strong>{c.title}</strong><small>Điều khoản v{c.version}</small></div><Status value={c.status} /></header><p>Hạn xác nhận: {new Date(c.valid_until).toLocaleDateString("vi-VN")}{expired && " · Đã qua hạn"}</p><details onToggle={event => { void viewed(event.currentTarget.open); }}><summary>Xem điều khoản v{c.version}</summary><div className="contract-content preserve-lines">{c.content}</div><CreatorRoster team={c.team_snapshot}/>{c.response_reason && <p className="quote-response">Phản hồi/lý do: {c.response_reason}</p>}{viewError && <p className="error" role="alert">{viewError}</p>}
      {customer && active && pending && !expired && <div className="quote-response-actions"><ActionForm label={`Xác nhận điều khoản v${c.version}`} onSubmit={async form => { await post(`/order-feedback/${id}/preference`, { show_name: form.get("show_name") === "true", notice_version: "EXCERPT_V1" }); return action("contract_acknowledge", { acknowledge: form.get(`acknowledge-${c.id}`) === "on", content_hash: c.content_hash }); }} onSuccess={onChanged}><PublicationNameField/><label className="contract-checkbox"><input type="checkbox" name={`acknowledge-${c.id}`} required /><span>Tôi đã đọc và đồng ý với nội dung, đội phụ trách và phần việc trong điều khoản phiên bản {c.version} hiển thị ở trên.</span></label></ActionForm><details><summary>Chưa đồng ý điều khoản</summary><ActionForm label="Gửi phản hồi điều khoản" onSubmit={form => action("contract_reject", { reason: form.get(`contract-reason-${c.id}`) })} onSuccess={onChanged}><Field name={`contract-reason-${c.id}`} label="Nội dung cần trao đổi về điều khoản" type="textarea" /></ActionForm></details></div>}
    </details>{!customer && active && <div className="commerce-buttons">{c.status === "DRAFT" && <ActionForm label={`Gửi điều khoản v${c.version}`} onSubmit={() => action("contract_send")} onSuccess={onChanged} />}{pending && expired && <ActionForm label="Đóng điều khoản hết hạn" onSubmit={() => action("contract_expire")} onSuccess={onChanged} />}{["DRAFT", "SENT", "VIEWED"].includes(c.status) && <details><summary>Hủy phiên bản chưa xác nhận</summary><ActionForm label="Hủy phiên bản điều khoản" onSubmit={form => action("contract_cancel", { reason: form.get(`contract-cancel-${c.id}`) })} onSuccess={onChanged}><Field name={`contract-cancel-${c.id}`} label={c.sent_at ? "Lý do hủy (gửi cho khách)" : "Lý do hủy bản nháp (nội bộ)"} type="textarea" /></ActionForm></details>}</div>}
  </article>;
}
export function OrderAssignment({ id, status, assignee, onChanged }: { id: string; status: string; assignee: string; onChanged: () => void }) {
  const { role } = useAuth(), agents = useApi<{ id: string; full_name: string }[]>(["ADMIN", "STAFF"].includes(role ?? "") ? "/requests/agents" : null);
  if (!["ADMIN", "STAFF"].includes(role ?? "") || ["COMPLETED", "CANCELLED", "REFUNDED"].includes(status)) return null;
  return <details className="commerce-editor"><summary>Chuyển người phụ trách đơn</summary><State query={agents}><ActionForm label="Lưu người phụ trách đơn" onSubmit={form => post(`/orders/${id}/assign`, { assigned_to: form.get("order-assignee"), reason: form.get("order-assign-reason") })} onSuccess={onChanged}><div className="field"><label htmlFor="order-assignee">Nhân viên phụ trách mới</label><select key={assignee} name="order-assignee" id="order-assignee" required defaultValue=""><option value="">Chọn nhân viên</option>{agents.data?.filter(p => p.id !== assignee).map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select></div><Field name="order-assign-reason" label="Lý do chuyển đơn (nội bộ)" type="textarea" /></ActionForm></State></details>;
}
