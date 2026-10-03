import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useApi } from "../../hooks/useApi";
import { State, Status, money } from "../../components/ui";
import type { OrderDetail } from "../../types/commerce";
import { ExecutionPanel } from "./ExecutionPanel";
import { OrderVariationPanel } from "./OrderVariationPanel";
import { OrderContractPanel, OrderAssignment } from "./OrderContractPanel";
import { OrderPaymentPanel } from "./OrderPaymentPanel";
import { OrderProductionPanel } from "./OrderProductionPanel";
import { OrderReviewPanel } from "./OrderReviewPanel";
import { OrderDeliveryPanel } from "./OrderDeliveryPanel";

const tabs = [ ["brief", "Yêu cầu"], ["commercial", "Creator & báo giá"], ["contracts", "Hợp đồng"], ["variations", "Phát sinh"], ["payments", "Thanh toán"], ["execution", "Điều phối & lịch"], ["production", "Tiến độ"], ["delivery", "Bàn giao"], ["reviews", "Đánh giá"] ] as const;
type Tab = typeof tabs[number][0];

export function ServiceWorkspaceDocuments({ requestId, orderId, brief, commerce, notes, onChanged }: {
 requestId: string; orderId?: string; brief: ReactNode; commerce: ReactNode; notes?: ReactNode; onChanged: () => void;
}) {
 const [selected, setSelected] = useState<Tab>("brief"), location = useLocation();
 const [visited, setVisited] = useState<Tab[]>(["brief"]);
 useEffect(() => { setVisited(previous => previous.includes(selected) ? previous : [...previous, selected]); }, [selected]);
 const opened = (tab:Tab) => selected === tab || visited.includes(tab);
 const order = useApi<OrderDetail>(orderId ? `/orders/${orderId}` : null);
 useEffect(() => {
  const hash = location.hash.slice(1);
  if (hash.startsWith("execution")) setSelected("execution");
  else if (hash.startsWith("variation")) setSelected("variations");
  else if (hash.startsWith("payment")) setSelected("payments");
  else if (hash.startsWith("contract")) setSelected("contracts");
  else if (hash.startsWith("production")) setSelected("production");
  else if (hash.startsWith("review")) setSelected("reviews");
  else if (hash.startsWith("delivery")) setSelected("delivery");
  else if (hash.startsWith("proposal") || hash.startsWith("quote") || hash === "commercial") setSelected("commercial");
 }, [location.hash, requestId]);
 const refresh = () => { order.reload(); onChanged(); };
 return <aside className="request-sidebar workspace-documents" aria-label="Tài liệu và công cụ dịch vụ">
  <header className="workspace-documents-heading"><h2>Tài liệu &amp; công cụ</h2><p>Cùng một hội thoại từ tư vấn đến bàn giao.</p></header>
  <div className="workspace-document-tabs" role="tablist" aria-label="Khu vực tài liệu">{tabs.map(([key, label]) =>
   <button key={key} type="button" role="tab" id={`tab-${key}`} aria-controls={`panel-${key}`} aria-selected={selected === key} tabIndex={selected === key ? 0 : -1}
    disabled={!orderId && ["contracts", "variations", "payments", "execution", "production", "delivery", "reviews"].includes(key)}
    onClick={() => setSelected(key)} onKeyDown={event => {
     if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
     event.preventDefault();
     const enabled = tabs.filter(([value]) => orderId || ["brief", "commercial"].includes(value)), index = enabled.findIndex(([value]) => value === key);
     const next = event.key === "Home" ? 0 : event.key === "End" ? enabled.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + enabled.length) % enabled.length;
     setSelected(enabled[next][0]); document.getElementById(`tab-${enabled[next][0]}`)?.focus();
    }}>{label}</button>)}</div>
  <div role="tabpanel" id="panel-brief" aria-labelledby="tab-brief" hidden={selected !== "brief"}>{brief}{notes}</div>
  <div role="tabpanel" id="panel-commercial" aria-labelledby="tab-commercial" hidden={selected !== "commercial"}>{commerce}
   {order.data && <section className="panel"><h2>Đơn đã chốt</h2><Status value={order.data.order.status} /><p>{order.data.order.order_number}</p><p>Tổng giá trị: {money(order.data.order.total)}</p><p>Cọc: {money(order.data.order.deposit_amount)}</p><p className="muted">Giá trị đơn không phải tiền thực nhận.</p><OrderAssignment id={orderId!} status={order.data.order.status} assignee={order.data.assigned_staff.id} onChanged={refresh} /></section>}
  </div>
  {orderId && <>
   <div role="tabpanel" id="panel-contracts" aria-labelledby="tab-contracts" hidden={selected !== "contracts"}>{opened("contracts")&&<State query={order}>{order.data && <OrderContractPanel id={orderId} orderStatus={order.data.order.status} onChanged={refresh} />}</State>}</div>
   <div role="tabpanel" id="panel-variations" aria-labelledby="tab-variations" hidden={selected !== "variations"}>{opened("variations")&&<OrderVariationPanel id={orderId} onChanged={refresh} active={selected === "variations"}/>}</div>
   <div role="tabpanel" id="panel-execution" aria-labelledby="tab-execution" hidden={selected !== "execution"}>{opened("execution")&&<ExecutionPanel id={orderId} onChanged={refresh} active={selected === "execution"}/>}</div>
   <div role="tabpanel" id="panel-payments" aria-labelledby="tab-payments" hidden={selected !== "payments"}>{opened("payments")&&<OrderPaymentPanel id={orderId} onChanged={refresh} />}</div>
   <div role="tabpanel" id="panel-production" aria-labelledby="tab-production" hidden={selected !== "production"}>{opened("production")&&<OrderProductionPanel id={orderId} onChanged={refresh} />}</div>
   <div role="tabpanel" id="panel-delivery" aria-labelledby="tab-delivery" hidden={selected !== "delivery"}>{opened("delivery")&&<OrderDeliveryPanel id={orderId} onChanged={refresh} />}</div>
   <div role="tabpanel" id="panel-reviews" aria-labelledby="tab-reviews" hidden={selected !== "reviews"}>{opened("reviews")&&<OrderReviewPanel id={orderId} onChanged={refresh} active={selected === "reviews"}/>}</div>
  </>}
 </aside>;
}
