import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ActionForm, Field, State, Status, money } from "../../components/ui";
import { useApi } from "../../hooks/useApi";
import { useAuth } from "../../contexts/AuthContext";
import { post } from "../../services/api";
import { isCustomerRole } from "../../lib/permissions";
import { businessToday, ordersHome, quoteExpired } from "../../lib/commerce";
import type { RequestCommerce, RequestQuote, Proposal } from "../../types/commerce";
import { CreatorRoster } from "../../components/CreatorRoster";
import { InlineCreatorProfile } from "../../components/InlineCreatorProfile";
import { CreatorTeamPanel, type CreatorTeam } from "./CreatorTeamPanel";
type Services = { items: { id: string; name: string }[] };

export function RequestCommercePanel({ id, serviceId, query, team, onChanged }: { id: string; serviceId: string; query: ReturnType<typeof useApi<RequestCommerce>>; team: ReturnType<typeof useApi<CreatorTeam>>; onChanged: () => void }) {
  const { role } = useAuth(), customer = isCustomerRole(role), data = query.data;
  const closed = data && ["CANCELLED", "CONVERTED"].includes(data.request_status);
  const canPropose = !customer && data && ["CONSULTING", "WAITING_CUSTOMER", "CREATOR_SELECTION", "QUOTE_PREPARING"].includes(data.request_status) && !data.selection_locked;
  const draft = data?.quotes.find(q => q.status === "DRAFT");
  return <section className="commerce-panel" aria-label="Đề xuất và báo giá"><State query={query}>{data && <>
    {data.order && <div className="panel order-banner"><div><strong>Đơn dịch vụ đã tạo</strong><p>{data.order.order_number}</p><Status value={data.order.status} /></div><Link className="btn btn-primary" to={`${ordersHome(role)}/${data.order.id}`}>Xem đơn dịch vụ →</Link></div>}
    <section className="panel"><h2>Creator được đề xuất</h2><p className="muted">So sánh phương án, lưu vào danh sách cân nhắc và chọn creator để chuẩn bị báo giá. Giá dự kiến cần được xác nhận trong báo giá.</p>
      {!data.proposals.length && <p className="muted">{customer ? "Người phụ trách sẽ đề xuất creator sau khi làm rõ brief." : "Chưa gửi đề xuất creator cho yêu cầu này."}</p>}
      {data.selection_locked && !closed && <p className="muted">Lựa chọn creator đã gắn với báo giá và được giữ nguyên trong lịch sử phiên bản.</p>}
      <div className="proposal-grid">{data.proposals.map(proposal => <ProposalCard key={proposal.id} proposal={proposal} id={id} customer={customer} locked={!!closed || data.selection_locked} selected={!!team.data?.selected.some(s => s.creator_id === proposal.creator_id)} onChanged={onChanged} />)}</div>
      {canPropose && <details className="commerce-editor"><summary>Gửi thêm đề xuất creator</summary><ProposalBuilder id={id} onChanged={onChanged} /></details>}
    </section>
    <CreatorTeamPanel id={id} query={team} locked={!!closed || data.selection_locked} onChanged={onChanged} />
    <section className="panel"><h2>Báo giá &amp; phiên bản</h2><p className="muted">Bản đã gửi được giữ nguyên. Mỗi lần chỉnh sau phản hồi của khách sẽ tạo một phiên bản mới.</p>
      {!data.quotes.length && <p className="muted">{customer ? "Bạn sẽ nhận báo giá tại đây sau khi chọn creator." : "Chọn creator cùng khách hàng trước khi chuẩn bị báo giá."}</p>}
      {data.quotes.map((quote, index) => <QuoteCard key={quote.id} quote={quote} id={id} customer={customer} active={!closed && index === 0} onChanged={onChanged} />)}
      {!customer && ["QUOTE_PREPARING", "QUOTE_REVISION"].includes(data.request_status) && <details className="commerce-editor" open><summary>{draft ? `Sửa bản nháp v${draft.version}` : "Chuẩn bị phiên bản báo giá mới"}</summary><QuoteBuilder key={draft?.id ?? "new"} id={id} serviceId={serviceId} draft={draft ?? data.quotes[0]} onChanged={onChanged} /></details>}
    </section>
  </>}</State></section>;
}
function ProposalCard({ proposal: p, id, customer, locked, selected, onChanged }: { proposal: Proposal; id: string; customer: boolean; locked: boolean; selected: boolean; onChanged: () => void }) {
  const available = ["PROPOSED", "SHORTLISTED", "SELECTED"].includes(p.status), action = (operation: string, extra = {}) => post(`/requests/${id}/commerce/${operation}`, { proposal_id: p.id, ...extra });
  return <article id={`proposal-${p.id}`} className="proposal-card"><div className="proposal-person"><div className="avatar-initials" aria-hidden="true">{p.creator_snapshot.display_name.slice(0, 1)}</div><div><Link to={`/creators/${p.creator_snapshot.slug}`}><strong>{p.creator_snapshot.display_name}</strong></Link><p>{p.creator_snapshot.title}</p></div></div><Status value={p.status} /><p className="preserve-lines">{p.reason}</p><dl><dt>Giá dự kiến</dt><dd>{p.estimated_price === null ? "Cần trao đổi" : money(p.estimated_price)}</dd><dt>Thời gian dự kiến</dt><dd>{p.estimated_days === null ? "Cần xác nhận" : `${p.estimated_days} ngày`}</dd></dl>{p.response_note && <p>Phản hồi: {p.response_note}</p>}
    <InlineCreatorProfile slug={p.creator_snapshot.slug} />{selected && <p className="muted">Đã chọn trong đội thực hiện.</p>}{available && !locked && <>{customer ? <><div className="commerce-buttons">{p.status === "PROPOSED" && <ActionForm label="Lưu cân nhắc" showSuccess={false} onSubmit={() => action("proposal_shortlist")} onSuccess={onChanged} />}{!selected && <ActionForm label="Chọn vào đội" showSuccess={false} onSubmit={() => post(`/requests/${id}/team/select`, { proposal_id: p.id })} onSuccess={onChanged} />}</div><details hidden={selected}><summary>Từ chối đề xuất</summary><ActionForm label="Gửi phản hồi" onSubmit={form => action("proposal_reject", { reason: form.get(`reject_${p.id}`) })} onSuccess={onChanged}><Field name={`reject_${p.id}`} label="Lý do từ chối creator" type="textarea" /></ActionForm></details></> : <ActionForm label="Thu hồi đề xuất" onSubmit={() => action("proposal_withdraw")} onSuccess={onChanged} />}</>}
  </article>;
}
function ProposalBuilder({ id, onChanged }: { id: string; onChanged: () => void }) {
  const [search, setSearch] = useState(""), [selected, setSelected] = useState("");
  const creators = useApi<{ items: { id: string; display_name: string; title: string }[] }>(`/requests/${id}/team/available?${new URLSearchParams({ search })}`);
  return <ActionForm label="Gửi đề xuất" onSubmit={form => post(`/requests/${id}/commerce/propose`, { creator_id: selected, reason: form.get("proposal_reason"), estimated_price: form.get("proposal_price") ? Number(form.get("proposal_price")) : null, estimated_days: form.get("proposal_days") ? Number(form.get("proposal_days")) : null })} onSuccess={onChanged}>
    <div className="field"><label htmlFor="proposal-search">Tìm creator theo tên</label><input id="proposal-search" value={search} onChange={e => setSearch(e.target.value)} /></div><State query={creators}><div className="field"><label htmlFor="proposal-creator">Creator phù hợp</label><select id="proposal-creator" required value={selected} onChange={e => setSelected(e.target.value)}><option value="">Chọn creator</option>{creators.data?.items.map(c => <option key={c.id} value={c.id}>{c.display_name} · {c.title}</option>)}</select></div></State>
    <Field name="proposal_reason" label="Lý do phù hợp (gửi cho khách)" type="textarea" /><div className="request-form-grid"><Field name="proposal_price" label="Giá dự kiến (VND, có thể bỏ trống)" type="number" required={false} /><Field name="proposal_days" label="Số ngày dự kiến (có thể bỏ trống)" type="number" required={false} /></div>
  </ActionForm>;
}
function QuoteCard({ quote: q, id, customer, active, onChanged }: { quote: RequestQuote; id: string; customer: boolean; active: boolean; onChanged: () => void }) {
  const navigate = useNavigate(), { role } = useAuth(), [viewError, setViewError] = useState("");
  const viewLock = useRef(false), expired = quoteExpired(q.valid_until), awaiting = ["SENT", "VIEWED"].includes(q.status);
  const action = (operation: string, extra = {}) => post(`/requests/${id}/commerce/${operation}`, { quote_id: q.id, ...extra });
  async function viewed(open: boolean) {
    if (!open || !customer || !active || q.status !== "SENT" || expired || viewLock.current) return;
    viewLock.current = true; setViewError("");
    try { await action("quote_view"); onChanged(); } catch (e) { setViewError((e as Error).message); } finally { viewLock.current = false; }
  }
  return <article id={`quote-${q.id}`} className="quote-card"><header><div><strong>Báo giá v{q.version}</strong><small>{q.quotation_number}</small></div><Status value={q.status} /></header><div className="quote-total"><strong>{money(q.total)}</strong><span>Cọc theo báo giá: {money(q.deposit_amount)} · Phần còn lại: {money(q.remaining_amount)}</span></div><p>Hiệu lực đến {new Date(q.valid_until).toLocaleDateString("vi-VN")}{expired && " · Đã qua hạn"}</p>
    <details onToggle={e => { void viewed(e.currentTarget.open); }}><summary>Xem hạng mục và điều kiện v{q.version}</summary><div className="table-scroll"><table><thead><tr><th>Hạng mục</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead><tbody>{q.items.map(i => <tr key={i.id}><td className="quote-description">{i.description}</td><td>{i.quantity}</td><td>{money(i.unit_price)}</td><td>{money(i.total)}</td></tr>)}</tbody></table></div><dl className="quote-breakdown"><dt>Tạm tính</dt><dd>{money(q.subtotal)}</dd><dt>Giảm giá</dt><dd>{money(q.discount)}</dd><dt>Thuế ({q.tax_rate}%)</dt><dd>{money(q.tax)}</dd><dt>Tổng cộng</dt><dd>{money(q.total)}</dd><dt>Tỷ lệ cọc</dt><dd>{q.deposit_percent}%</dd></dl><CreatorRoster team={q.team_snapshot}/><h3>Phạm vi &amp; chính sách chỉnh sửa</h3><p className="preserve-lines">{q.revision_policy}</p>{q.notes && <p className="preserve-lines">{q.notes}</p>}{q.response_reason && <p className="quote-response">Phản hồi của khách: {q.response_reason}</p>}{viewError && <p className="error" role="alert">{viewError}</p>}
      {customer && active && awaiting && !expired && <div className="quote-response-actions"><ActionForm label={`Chấp nhận v${q.version} và tạo đơn`} onSubmit={async () => { const result = await action("quote_accept"); navigate(`${ordersHome(role)}/${result.order_id}`); }} /><details><summary>Yêu cầu chỉnh báo giá</summary><ActionForm label="Gửi yêu cầu chỉnh" onSubmit={form => action("quote_revise", { reason: form.get(`revise_${q.id}`) })} onSuccess={onChanged}><Field name={`revise_${q.id}`} label="Nội dung cần chỉnh" type="textarea" /></ActionForm></details><details><summary>Từ chối báo giá</summary><ActionForm label="Gửi lý do từ chối" onSubmit={form => action("quote_reject", { reason: form.get(`quote_reject_${q.id}`) })} onSuccess={onChanged}><Field name={`quote_reject_${q.id}`} label="Lý do từ chối báo giá" type="textarea" /></ActionForm></details></div>}
    </details>{!customer && active && <div className="commerce-buttons">{q.status === "DRAFT" && <><ActionForm label={`Gửi báo giá v${q.version}`} onSubmit={() => action("quote_send")} onSuccess={onChanged} /><ActionForm label="Hủy bản nháp" onSubmit={() => action("quote_cancel")} onSuccess={onChanged} /></>}{awaiting && expired && <ActionForm label="Đóng phiên bản hết hạn" onSubmit={() => action("quote_expire")} onSuccess={onChanged} />}</div>}
  </article>;
}
function QuoteBuilder({ id, serviceId, draft, onChanged }: { id: string; serviceId: string; draft?: RequestQuote; onChanged: () => void }) {
  const services = useApi<Services>("/public/services?limit=100");
  const [items, setItems] = useState(() => draft?.items.map(i => ({ key: i.id, service_id: i.service_id, description: i.description, quantity: String(i.quantity), unit_price: String(i.unit_price) })) ?? [{ key: crypto.randomUUID(), service_id: serviceId, description: "", quantity: "1", unit_price: "" }]);
  const edit = (key: string, field: string, value: string) => setItems(previous => previous.map(i => i.key === key ? { ...i, [field]: value } : i));
  return <ActionForm label="Lưu bản nháp để kiểm tra" onSubmit={form => post(`/requests/${id}/commerce/quote_save`, { items: items.map(i => ({ service_id: i.service_id, description: i.description, quantity: Number(i.quantity), unit_price: Number(i.unit_price) })), discount: Number(form.get("quote_discount")), tax_rate: Number(form.get("quote_tax")), deposit_percent: Number(form.get("quote_deposit")), valid_until: form.get("quote_valid_until"), revision_policy: form.get("quote_revisions"), notes: form.get("quote_notes") || "" })} onSuccess={onChanged}>
    <State query={services}>{items.map((i, index) => <fieldset className="quote-item-editor" key={i.key}><legend>Hạng mục {index + 1}</legend><div className="field"><label htmlFor={`item-service-${i.key}`}>Dịch vụ hạng mục {index + 1}</label><select id={`item-service-${i.key}`} required value={i.service_id} onChange={e => edit(i.key, "service_id", e.target.value)}><option value="">Chọn dịch vụ</option>{services.data?.items.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div><div className="field"><label htmlFor={`item-description-${i.key}`}>Phạm vi hạng mục {index + 1}</label><textarea id={`item-description-${i.key}`} required maxLength={5000} value={i.description} onChange={e => edit(i.key, "description", e.target.value)} /></div><div className="request-form-grid"><div className="field"><label htmlFor={`item-quantity-${i.key}`}>Số lượng hạng mục {index + 1}</label><input id={`item-quantity-${i.key}`} type="number" required min={1} max={10000} step={1} value={i.quantity} onChange={e => edit(i.key, "quantity", e.target.value)} /></div><div className="field"><label htmlFor={`item-price-${i.key}`}>Đơn giá hạng mục {index + 1} (VND)</label><input id={`item-price-${i.key}`} type="number" required min={0} max={1e12} step="0.01" value={i.unit_price} onChange={e => edit(i.key, "unit_price", e.target.value)} /></div></div>{items.length > 1 && <button type="button" className="btn btn-ghost" onClick={() => setItems(previous => previous.filter(item => item.key !== i.key))}>Bỏ hạng mục {index + 1}</button>}</fieldset>)}</State>
    {items.length < 50 && <button className="btn btn-ghost" type="button" onClick={() => setItems(previous => [...previous, { key: crypto.randomUUID(), service_id: serviceId, description: "", quantity: "1", unit_price: "" }])}>Thêm hạng mục</button>}
    <div className="request-form-grid"><Field name="quote_discount" label="Giảm giá (VND)" type="number" value={draft?.discount ?? 0} /><Field name="quote_tax" label="Thuế (%)" type="number" value={draft?.tax_rate ?? 0} /><Field name="quote_deposit" label="Cọc theo báo giá (tối thiểu 30%)" type="number" value={draft?.deposit_percent ?? 30} /><Field name="quote_valid_until" label="Ngày hết hiệu lực" type="date" value={draft?.valid_until ?? businessToday()} /></div><Field name="quote_revisions" label="Chính sách chỉnh sửa và đầu ra" type="textarea" value={draft?.revision_policy} /><Field name="quote_notes" label="Ghi chú báo giá (hiển thị cho khách)" type="textarea" required={false} value={draft?.notes} /><p className="muted">Tổng tiền và số tiền cọc được máy chủ tính khi lưu. Hãy kiểm tra bản nháp trước khi gửi cho khách.</p>
  </ActionForm>;
}

export function CommerceMessageLink({ kind, metadata }: { kind: string; metadata: Record<string, unknown> }) {
  const { role } = useAuth();
  if ((typeof metadata.replacement_id === "string" || typeof metadata.delay_id === "string") && (!["CREATOR","STUDENT_CREATOR"].includes(role||"") || String(metadata.event||"").startsWith("PRODUCTION_DELAY_") || metadata.event==='CREATOR_REPLACEMENT_COMPLETED')) return <a className="btn btn-ghost" href="#execution">Xem điều phối &amp; lịch ↓</a>;
  if (typeof metadata.variation_id === "string" && String(metadata.event || "").startsWith("ORDER_VARIATION_") && !["CREATOR", "STUDENT_CREATOR"].includes(role || "")) return <a className="btn btn-ghost" href={`#variation-${metadata.variation_id}`}>Xem phụ lục phát sinh ↓</a>;
  if (kind === "CREATOR_PROPOSAL" && typeof metadata.proposal_id === "string") return <a className="btn btn-ghost" href={`#proposal-${metadata.proposal_id}`}>Xem đề xuất creator ↓</a>;
  if (kind === "QUOTE" && typeof metadata.quote_id === "string") return <a className="btn btn-ghost" href={`#quote-${metadata.quote_id}`}>Xem báo giá và điều kiện ↓</a>;
  if (kind === "ORDER" && typeof metadata.order_id === "string") return <Link className="btn btn-primary" to={`${ordersHome(role)}/${metadata.order_id}`}>Mở đơn dịch vụ →</Link>;
  if (kind === "CONTRACT" && typeof metadata.order_id === "string" && typeof metadata.contract_id === "string") return <Link className="btn btn-primary" to={`${ordersHome(role)}/${metadata.order_id}#contract-${metadata.contract_id}`}>Xem điều khoản hợp đồng →</Link>;
  if (kind === "PAYMENT" && typeof metadata.order_id === "string" && typeof metadata.payment_id === "string") return <Link className="btn btn-primary" to={`${ordersHome(role)}/${metadata.order_id}#payment-${metadata.payment_id}`}>Xem yêu cầu thanh toán →</Link>;
  if (["CREATOR", "STUDENT_CREATOR"].includes(role || "")) return null;
  if (kind === "PROJECT" && typeof metadata.order_id === "string") return <Link className="btn btn-primary" to={`${ordersHome(role)}/${metadata.order_id}#production`}>Xem kế hoạch sản xuất →</Link>;
  return null;
}
