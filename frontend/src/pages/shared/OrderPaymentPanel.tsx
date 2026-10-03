import { useOrderUpdates } from "../../hooks/useOrderUpdates";
import { useEffect, useRef, useState } from "react";
import { ActionForm, Field, State, Status, money } from "../../components/ui";
import { useAuth } from "../../contexts/AuthContext";
import { useApi } from "../../hooks/useApi";
import { post } from "../../services/api";
import { isCustomerRole } from "../../lib/permissions";
import { businessToday, quoteExpired } from "../../lib/commerce";
import type { OrderPayment, OrderPayments } from "../../types/commerce";

const kinds = { DEPOSIT: "Cọc theo báo giá", FULL: "Toàn bộ", MILESTONE: "Theo mốc", REMAINING: "Phần còn lại" };
export function OrderPaymentPanel({ id, onChanged }: { id: string; onChanged: () => void }) {
  const { role } = useAuth(), customer = isCustomerRole(role), query = useApi<OrderPayments>(`/orders/${id}/payments`, true), data = query.data;
  useOrderUpdates(id,query.reload);
  const callback = useRef(onChanged);
  useEffect(() => { callback.current = onChanged; }, [onChanged]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") { query.reload(); callback.current(); } };
    const timer = window.setInterval(refresh, 45000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [id]);
  const changed = () => { query.reload(); onChanged(); };
  return <section className="panel contract-panel" id="payments" aria-label="Thanh toán theo đơn"><header><h2>Thanh toán theo đơn</h2><button className="btn btn-ghost" disabled={query.loading} onClick={changed}>Làm mới thanh toán</button></header><State query={query}>{data && <>
    <div className="payment-summary"><div><span>Giá trị đơn</span><strong>{money(data.total)}</strong></div><div><span>Đã thu và xác minh</span><strong>{money(data.collected)}</strong></div><div><span>Còn phải thu</span><strong>{money(data.remaining)}</strong></div><div><span>Yêu cầu đang mở</span><strong>{money(data.pending)}</strong></div></div>
    <p className="muted">Báo đã chuyển khoản cần người phụ trách/Admin đối soát. Đơn được xác nhận khi khoản nhận đã xác minh đạt {money(data.required_to_confirm)} theo điều kiện báo giá.</p>
    {!data.payment_eligible && <p>Đơn chưa đủ điều kiện phát hành yêu cầu thu hoặc đã đóng. Hồ sơ thanh toán đã có vẫn được lưu để tra cứu.</p>}
    {data.payment_eligible && !data.bank_configured && <p className="notice">Người phụ trách/Admin cần cấu hình tài khoản nhận tiền trước khi phát hành yêu cầu thu mới.</p>}
    {data.payments.map(p => <PaymentCard key={p.id} id={id} payment={p} customer={customer} admin={role === "ADMIN" || role === "STAFF"} active={data.payment_eligible} bankEnabled={data.bank_enabled} receipt={data.receipts.find(r => r.payment_request_id === p.id)} onChanged={changed} />)}
    {!data.payments.length && <p>Chưa có yêu cầu thanh toán cho đơn này.</p>}
    {data.final_funds ? <p className="contract-evidence">Người phụ trách đã xác nhận thu đủ lúc {new Date(data.final_funds.confirmed_at).toLocaleString("vi-VN")}. Creator có thể bàn giao bản hoàn thiện sau khi nghiệm thu.</p> : data.can_confirm_final && <details><summary>Xác nhận đã thu đủ toàn bộ giá trị đơn</summary><ActionForm label="Xác nhận thu đủ" onSubmit={f=>post(`/orders/${id}/final-funds`,{verified:f.get('final-funds-verified')==='on',note:f.get('final-funds-note')})} onSuccess={changed}><Field name="final-funds-note" label="Ghi chú đối chiếu nội bộ" type="textarea"/><label className="contract-checkbox"><input type="checkbox" name="final-funds-verified" required/><span>Tôi đã đối chiếu toàn bộ khoản thực nhận với giá trị đơn. Khách đã thanh toán đủ.</span></label></ActionForm></details>}

    {!customer && data.payment_eligible && data.bank_configured && data.available > 0 && <PaymentBuilder id={id} available={data.available} collected={data.collected} pending={data.pending} onChanged={changed} />}
  </>}</State></section>;
}
function PaymentBuilder({ id, available, collected, pending, onChanged }: { id: string; available: number; collected: number; pending: number; onChanged: () => void }) {
  const [kind, setKind] = useState<keyof typeof kinds>(pending > 0 ? "MILESTONE" : collected > 0 ? "REMAINING" : "DEPOSIT");
  const [mode, setMode] = useState("amount"), [key, setKey] = useState(() => crypto.randomUUID()), [completed, setCompleted] = useState(false);
  if (completed) return <p>Yêu cầu thu đã lưu. <button className="btn btn-ghost" onClick={() => { setKey(crypto.randomUUID()); setCompleted(false); }}>Chuẩn bị yêu cầu khác</button></p>;
  return <details className="commerce-editor"><summary>Tạo yêu cầu thu mới</summary><ActionForm key={key} label="Phát hành yêu cầu thanh toán" onSubmit={form => post(`/orders/${id}/payments/create`, {
    kind, amount: kind === "MILESTONE" && mode === "amount" ? Number(form.get("payment-amount")) : null,
    percentage: kind === "MILESTONE" && mode === "percentage" ? Number(form.get("payment-percentage")) : null,
    due_date: form.get("payment-due"), note: form.get("payment-note") || "", idempotency_key: key,
  })} onSuccess={() => { setCompleted(true); onChanged(); }}>
    <div className="field"><label htmlFor="payment-kind">Loại yêu cầu thu</label><select id="payment-kind" value={kind} onChange={e => setKind(e.target.value as keyof typeof kinds)}>{Object.entries(kinds).map(([value, label]) => <option key={value} value={value} disabled={value !== "MILESTONE" && pending > 0 || ["DEPOSIT", "FULL"].includes(value) && collected > 0}>{label}</option>)}</select></div>
    <p>Có thể yêu cầu thêm tối đa {money(available)}. Cọc, toàn bộ và phần còn lại được tính từ đơn và khoản đã xác minh.</p>
    {kind === "MILESTONE" && <><div className="field"><label htmlFor="payment-mode">Cách tính khoản theo mốc</label><select id="payment-mode" value={mode} onChange={e => setMode(e.target.value)}><option value="amount">Nhập số tiền</option><option value="percentage">Phần trăm giá trị đơn</option></select></div>{mode === "amount" ? <Field name="payment-amount" label="Số tiền theo mốc (VND)" type="number" /> : <Field name="payment-percentage" label="Phần trăm giá trị đơn (%)" type="number" />}</>}
    <Field name="payment-due" label="Hạn thanh toán" type="date" value={businessToday()} /><Field name="payment-note" label="Mô tả khoản thu (hiển thị cho khách)" type="textarea" required={false} />
  </ActionForm></details>;
}
function PaymentCard({ id, payment: p, customer, admin, active, bankEnabled, receipt, onChanged }: { id: string; payment: OrderPayment; customer: boolean; admin: boolean; active: boolean; bankEnabled: boolean; receipt?: OrderPayments["receipts"][number]; onChanged: () => void }) {
  const expired = quoteExpired(p.due_date), action = (operation: string, extra = {}) => post(`/orders/${id}/payments/${operation}`, { payment_id: p.id, ...extra });
  return <article className="quote-card payment-card" id={`payment-${p.id}`}><header><div><strong>{kinds[p.kind]} · {money(p.amount)}</strong><small className="wrap-anywhere">{p.reference}</small></div><Status value={p.status} /></header><p>Hạn thanh toán: {new Date(p.due_date).toLocaleDateString("vi-VN")}{expired && p.status === "PENDING" && " · Đã quá hạn"}</p><p className="preserve-lines">{p.note}</p>{p.response_reason && <p className="quote-response">Lý do/phản hồi: {p.response_reason}</p>}
    {receipt ? <div className="contract-evidence"><strong>Khoản nhận đã được người phụ trách/Admin đối soát: {money(receipt.amount)}</strong><p>Thực nhận lúc {new Date(receipt.received_at).toLocaleString("vi-VN")}</p></div> : p.status === "AWAITING_VERIFICATION" && <p className="notice">Đang chờ người phụ trách/Admin đối soát khoản nhận. Chưa ghi nhận là tiền đã thu.</p>}
    {["PENDING", "AWAITING_VERIFICATION", "PAID"].includes(p.status) && <details><summary>Thông tin chuyển khoản và hồ sơ</summary><dl className="payment-bank"><dt>Ngân hàng</dt><dd>{p.bank_snapshot.bank_name}</dd><dt>Chủ tài khoản</dt><dd>{p.bank_snapshot.account_name}</dd><dt>Số tài khoản</dt><dd>{p.bank_snapshot.account_number}</dd><dt>Số tiền yêu cầu</dt><dd>{money(p.amount)}</dd><dt>Nội dung chuyển khoản</dt><dd>{p.reference}</dd></dl><p className="preserve-lines">{p.bank_snapshot.instructions}</p>{p.transfer_note && <p className="preserve-lines">Khách báo chuyển khoản: {p.transfer_note}</p>}
      {customer && active && p.status === "PENDING" && !expired && bankEnabled && <ActionForm label="Báo đã chuyển khoản" onSubmit={form => action("report", { transfer_note: form.get(`transfer-${p.id}`) })} onSuccess={onChanged}><Field name={`transfer-${p.id}`} label="Thông tin giao dịch để người phụ trách/Admin đối soát" type="textarea" /><p className="muted">Chỉ gửi sau khi bạn đã chuyển tiền theo thông tin trên.</p></ActionForm>}
      {customer && p.status === "PENDING" && !bankEnabled && <p>Nhận báo chuyển khoản đang tạm dừng; hãy trao đổi với người phụ trách.</p>}
      {admin && active && p.status === "AWAITING_VERIFICATION" && <div className="quote-response-actions"><details><summary>Đối soát khoản nhận thực tế</summary><ActionForm label="Xác nhận khoản nhận đã đối soát" onSubmit={form => action("confirm", { verified: form.get(`verify-${p.id}`) === "on", received_amount: Number(form.get(`received-amount-${p.id}`)), bank_transaction_reference: form.get(`bank-reference-${p.id}`), received_at: new Date(String(form.get(`received-at-${p.id}`))).toISOString(), reason: form.get(`verify-note-${p.id}`) })} onSuccess={onChanged}><Field name={`received-amount-${p.id}`} label="Số tiền thực nhận (phải khớp yêu cầu)" type="number" value={p.amount} /><Field name={`bank-reference-${p.id}`} label="Mã giao dịch ngân hàng thực tế" /><Field name={`received-at-${p.id}`} label="Thời điểm thực nhận theo ngân hàng" type="datetime-local" /><Field name={`verify-note-${p.id}`} label="Ghi chú đối soát nội bộ (lưu audit)" type="textarea" /><label className="contract-checkbox"><input name={`verify-${p.id}`} type="checkbox" required /><span>Tôi đã đối chiếu tài khoản nhận, số tiền và mã giao dịch với khoản nhận thực tế.</span></label></ActionForm></details><details><summary>Chưa xác minh được khoản nhận</summary><ActionForm label="Trả lại báo chuyển khoản" onSubmit={form => action("reject", { reason: form.get(`reject-payment-${p.id}`) })} onSuccess={onChanged}><Field name={`reject-payment-${p.id}`} label="Lý do công khai để khách bổ sung" type="textarea" /></ActionForm></details></div>}
    </details>}
    {!customer && active && p.status === "PENDING" && <div className="commerce-buttons">{expired && <ActionForm label="Đánh dấu hết hạn" onSubmit={() => action("expire")} onSuccess={onChanged} />}<details><summary>Hủy yêu cầu thu chưa chuyển khoản</summary><ActionForm label="Hủy yêu cầu thu" onSubmit={form => action("cancel", { reason: form.get(`cancel-payment-${p.id}`) })} onSuccess={onChanged}><Field name={`cancel-payment-${p.id}`} label="Lý do hủy (hiển thị cho khách)" type="textarea" /></ActionForm></details></div>}
  </article>;
}
