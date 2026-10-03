import { useLocation } from "react-router-dom";
import { useOrderUpdates, notifyOrderUpdated } from "../../hooks/useOrderUpdates";
import { useEffect, useRef, useState } from "react";
import { ActionForm, Field, State, Pagination, money } from "../../components/ui";
import { useAuth } from "../../contexts/AuthContext";
import { useApi } from "../../hooks/useApi";
import { post } from "../../services/api";
import { isCustomerRole } from "../../lib/permissions";
import { businessToday } from "../../lib/commerce";

type VariationQuote={id:string;version:number;scope:string;revision_policy:string;amount:number;deadline:string;valid_until:string;content_hash:string};
type Variation={id:string;title:string;description:string;status:string;created_at:string;response_note:string|null;quote_count:number;quotes:VariationQuote[];acknowledgment:{quote_id:string;acknowledged_at:string;method:string}|null};
type Variations={items:Variation[];page:number;total:number;limit:number;base_total:number;total_amount:number;can_request:boolean};
const statusLabels:Record<string,string>={REQUESTED:'Chờ Staff báo giá',QUOTED:'Chờ Customer xác nhận',ACCEPTED:'Phụ lục đã xác nhận',REJECTED:'Đã từ chối',WITHDRAWN:'Customer đã rút yêu cầu'};
function useRetryIntent(revision=0){const saved=useRef<{input:string;key:string}|null>(null);return(input:unknown)=>{const serialized=JSON.stringify([revision,input]);if(saved.current?.input!==serialized)saved.current={input:serialized,key:crypto.randomUUID()};return saved.current!.key;};}

export function OrderVariationPanel({id,onChanged,active=true}:{id:string;onChanged:()=>void;active?:boolean}){
 const location=useLocation(),[focusId,setFocusId]=useState('');
 useEffect(()=>{const match=/^#variation-([0-9a-f-]{36})$/i.exec(location.hash);setFocusId(match?.[1]||'');},[location.hash]);
 const {role}=useAuth(),customer=isCustomerRole(role),[page,setPage]=useState(1),[revision,setRevision]=useState(0),query=useApi<Variations>(`/order-variations/${id}?page=${page}${focusId?`&focus_id=${focusId}`:""}`),intent=useRetryIntent(revision);
 const reload=useRef(query.reload);reload.current=query.reload;
 useEffect(()=>{if(!active)return;const refresh=()=>{if(document.visibilityState==='visible')reload.current();};refresh();const timer=window.setInterval(refresh,45000);window.addEventListener('focus',refresh);return()=>{window.clearInterval(timer);window.removeEventListener('focus',refresh);};},[active,id]);
 useOrderUpdates(id,query.reload);
 const changed=()=>{notifyOrderUpdated(id);onChanged();};
 return <section className="panel contract-panel" id="variations" aria-label="Phát sinh và phụ lục"><header><h2>Phát sinh &amp; phụ lục</h2><button type="button" className="btn btn-ghost" disabled={query.loading} onClick={changed}>Làm mới</button></header>
  <p>Customer đề nghị bổ sung. Staff thống nhất phạm vi, mức chỉnh sửa, giá trọn gói và hạn dự án; Customer xác nhận rồi mới thực hiện phần thêm.</p>
  <State query={query}>{query.data&&<>
   <dl className="variation-totals"><div><dt>Đơn gốc</dt><dd>{money(query.data.base_total)}</dd></div><div><dt>Phát sinh đã chốt</dt><dd>{money(query.data.total_amount-query.data.base_total)}</dd></div><div><dt>Tổng cần thanh toán</dt><dd>{money(query.data.total_amount)}</dd></div></dl>
   <p className="muted">Giữ nguyên cọc đã thỏa thuận. Tiền phát sinh được cộng vào phần còn phải thu, chưa phải khoản thực nhận. Xác nhận tại đây lưu bằng chứng trong ứng dụng.</p>
   {customer&&query.data.can_request&&<details className="commerce-editor"><summary>Đề nghị phát sinh thêm</summary><ActionForm key={revision} label="Gửi đề nghị phát sinh" onSubmit={f=>{const input={title:f.get('title'),description:f.get('description')};return post(`/order-variations/${id}/request`,{...input,idempotency_key:intent(input)});}} onSuccess={()=>{setRevision(v=>v+1);setFocusId('');setPage(1);changed();}}><Field name="title" label="Tên yêu cầu bổ sung" maxLength={200}/><Field name="description" label="Nội dung, kết quả mong muốn và lý do bổ sung" type="textarea" maxLength={5000}/></ActionForm></details>}
   {!query.data.can_request&&<p>Phát sinh mở sau xác nhận cọc, trước khi gửi nghiệm thu và xác nhận thu đủ. Nếu đã nghiệm thu, hãy trao đổi với Staff về yêu cầu dịch vụ mới.</p>}
   {query.data.items.map(v=><VariationCard key={v.id} id={id} variation={v} customer={customer} canQuote={query.data!.can_request} onChanged={changed}/>)}
   {!query.data.items.length&&<p>Chưa có yêu cầu phát sinh cho đơn này.</p>}
   <Pagination page={query.data.page} total={query.data.total} limit={10} onChange={next=>{setFocusId('');setPage(next);}}/>
  </>}</State>
 </section>;
}
function VariationCard({id,variation:v,customer,canQuote,onChanged}:{id:string;variation:Variation;customer:boolean;canQuote:boolean;onChanged:()=>void}){
 const intent=useRetryIntent(),q=v.quotes[0],open=['REQUESTED','QUOTED'].includes(v.status),action=(operation:string,input:Record<string,unknown>)=>post(`/order-variations/${id}/${operation}`,{variation_id:v.id,...input});
 return <article className="quote-version variation-card" id={`variation-${v.id}`}><header><h3>{v.title}</h3><span className="status">{statusLabels[v.status]||v.status}</span></header><p className="preserve-lines">{v.description}</p><small>Gửi lúc {new Date(v.created_at).toLocaleString('vi-VN')}</small>
  {q&&<div className="variation-terms"><h4>Bản phụ lục {q.version}</h4><p className="preserve-lines">{q.scope}</p><p><b>Giá phát sinh trọn gói: {money(q.amount)}</b></p><p>Hạn dự án: {q.deadline} · Xác nhận trước: {q.valid_until}</p><p className="preserve-lines">Mức chỉnh sửa: {q.revision_policy}</p></div>}
  {v.acknowledgment&&<p className="contract-evidence">Customer đã xác nhận phiên bản được lưu lúc {new Date(v.acknowledgment.acknowledged_at).toLocaleString('vi-VN')}. Phạm vi bổ sung có mốc riêng trong Tiến độ.</p>}
  {v.response_note&&<p className="preserve-lines">Lý do đóng yêu cầu: {v.response_note}</p>}
  {open&&!customer&&canQuote&&<details className="commerce-editor"><summary>{q?'Gửi phiên bản phụ lục mới':'Soạn và gửi báo giá phụ lục'}</summary><ActionForm label="Gửi phụ lục cho Customer" onSubmit={f=>{const input={scope:f.get('scope'),revision_policy:f.get('revision_policy'),amount:Number(f.get('amount')),deadline:f.get('deadline'),valid_until:f.get('valid_until')};return action('quote',{...input,idempotency_key:intent(input)});}} onSuccess={onChanged}><Field name="scope" label="Phạm vi và sản phẩm bổ sung (chỉ phần thêm)" type="textarea" value={q?.scope}/><Field name="revision_policy" label="Mức chỉnh sửa bao gồm và trường hợp tính phát sinh" type="textarea" maxLength={2000} value={q?.revision_policy}/><label className="field">Giá trọn gói phát sinh (VND, đã gồm thuế nếu có)<input name="amount" type="number" required min="0" max="1000000000000" step="0.01" defaultValue={q?.amount}/></label><Field name="deadline" label="Hạn dự án mới (không sớm hơn hạn hiện tại)" type="date" value={q?.deadline}/><Field name="valid_until" label="Hạn Customer xác nhận (không sau hạn dự án)" type="date" value={q?.valid_until}/><p className="muted">Staff trao đổi với đội Creator trước khi gửi. Báo giá được gửi ngay và lưu thành phiên bản riêng.</p></ActionForm></details>}
  {customer&&open&&q&&canQuote&&q.valid_until>=businessToday()&&<ActionForm key={q.id} label="Xác nhận phụ lục và giá phát sinh" onSubmit={f=>action('accept',{quote_id:q.id,content_hash:q.content_hash,acknowledge:f.get('acknowledge')==='on'})} onSuccess={onChanged}><label className="contract-checkbox"><input name="acknowledge" type="checkbox" required/><span>Tôi đồng ý phạm vi, mức chỉnh sửa, giá {money(q.amount)} và hạn dự án {q.deadline} của bản {q.version}.</span></label></ActionForm>}
  {open&&<details><summary>{customer?'Rút yêu cầu phát sinh':'Từ chối yêu cầu phát sinh'}</summary><ActionForm label={customer?'Rút yêu cầu':'Gửi lý do từ chối'} onSubmit={f=>action(customer?'withdraw':'reject',{reason:f.get('reason')})} onSuccess={onChanged}><Field name="reason" label="Lý do (Customer và Staff đều xem được)" type="textarea" maxLength={2000}/></ActionForm></details>}
  {v.quotes.length>1&&<details><summary>Lịch sử phiên bản phụ lục</summary>{v.quote_count>20&&<p>Hiển thị 20 phiên bản gần nhất. Các bản trước được giữ trong hồ sơ hệ thống.</p>}{v.quotes.slice(1).map(old=><article key={old.id}><h4>Phiên bản {old.version} · {money(old.amount)}</h4><p className="preserve-lines">{old.scope}</p><p className="preserve-lines">Mức sửa: {old.revision_policy}</p><p>Hạn dự án: {old.deadline} · Hạn xác nhận: {old.valid_until}</p></article>)}</details>}
 </article>;
}
export function AcceptedVariationScopes({id}:{id:string}){
 const [page,setPage]=useState(1),query=useApi<{items:{id:string;title:string;scope:string;revision_policy:string;deadline:string}[];total:number;page:number;limit:number}>(`/order-variations/${id}/scope?page=${page}`),reload=useRef(query.reload);reload.current=query.reload;
 useOrderUpdates(id,query.reload);
 useEffect(()=>{const refresh=()=>{if(document.visibilityState==='visible')reload.current();};const timer=window.setInterval(refresh,45000);window.addEventListener('focus',refresh);return()=>{window.clearInterval(timer);window.removeEventListener('focus',refresh);};},[id]);
 return <section className="panel"><h2>Phạm vi bổ sung đã chốt</h2><p className="muted">Staff điều phối phần việc trong đội. Phần thêm cần được cập nhật tiến độ và bàn giao cùng dự án.</p><State query={query}>{query.data?.items.map(v=><article key={v.id}><h3>{v.title}</h3><p className="preserve-lines">{v.scope}</p><p className="preserve-lines">Mức chỉnh sửa: {v.revision_policy}</p><p>Hạn dự án: {v.deadline}</p></article>)}{query.data&&!query.data.items.length&&<p>Chưa có phạm vi bổ sung đã xác nhận.</p>}{query.data&&<Pagination page={page} total={query.data.total} limit={10} onChange={setPage}/>}</State></section>;
}
