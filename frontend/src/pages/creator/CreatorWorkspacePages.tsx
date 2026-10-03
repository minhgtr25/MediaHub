import { useAuth } from "../../contexts/AuthContext";
import { ServiceChatLayout } from "../../components/ServiceChatLayout";
import { useEffect, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { ActionForm, Field, Page, State, Status } from "../../components/ui";
import { useApi } from "../../hooks/useApi";
import { post } from "../../services/api";
import { RequestConversation } from "../shared/RequestConversation";
import type { CreatorAssignment } from "../shared/CreatorTeamPanel";
import { ExecutionPanel, ReplacementInvitations } from "../shared/ExecutionPanel";
import { AcceptedVariationScopes } from "../shared/OrderVariationPanel";
import { OrderDeliveryPanel } from "../shared/OrderDeliveryPanel";
type AssignmentList={items:(CreatorAssignment & {request:{id:string;title:string;request_number:string}})[]};
type CreatorWorkspace={assignment:CreatorAssignment;request:{id:string;title:string;brief:string;request_number:string};staff:{full_name:string;avatar_url?:string|null}|null;order:{id:string;status:string}|null;conversation_id:string|null;chat_enabled:boolean;updates:{id:string;progress:number;content:string;created_at:string}[]};
export function CreatorDashboard() {
 const query=useApi<AssignmentList>('/creator/assignments');
 const [params] = useSearchParams();
 const search = (params.get('search') || '').trim().toLocaleLowerCase('vi-VN');
 const items = query.data?.items.filter(a => !search || `${a.request?.title || ''} ${a.request?.request_number || ''}`.toLocaleLowerCase('vi-VN').includes(search)) || [];
 return <Page title="Công việc của Creator"><p>Staff phân công dự án sau khi khách hàng chọn đội. Xác nhận nhận việc trong thời gian giữ chỗ và cập nhật tiến độ trên hệ thống khi thực hiện.</p><button className="btn btn-ghost" disabled={query.loading} onClick={query.reload}>Làm mới công việc</button><ReplacementInvitations onChanged={query.reload}/><State query={query}><div className="resource-grid">{items.map(a=><article className="panel" key={a.id}><small>{a.request?.request_number}</small><h2>{a.request?.title}</h2><Status value={a.status==='PENDING' && new Date(a.expires_at).getTime()<=Date.now() ? 'EXPIRED':a.status}/><p>{a.work_scope}</p><p>Hạn bàn giao: {a.deadline || 'Chưa có'}</p><Link className="btn btn-primary" to={`/creator/assignments/${a.id}`}>{a.status==='PENDING'?'Xem và xác nhận phân công':'Mở công việc'}</Link></article>)}</div>{!items.length && <section className="panel">{search ? "Không có công việc phù hợp với từ khóa. Thử tìm theo tên hoặc mã yêu cầu." : "Chưa có phân công. Staff sẽ gửi lời mời tại đây khi bạn phù hợp với nhu cầu của khách hàng."}</section>}</State></Page>;
}
export function CreatorWorkspacePage() {
 const {id=''}=useParams(), location=useLocation(),{profile}=useAuth();
 const resource=location.pathname.includes('/assignments/')?'assignments':'requests';
 const query=useApi<CreatorWorkspace>(`/creator/${resource}/${id}`), [now,setNow]=useState(Date.now());
 useEffect(()=>{const timer=window.setInterval(()=>{setNow(Date.now());query.reload()},15000);return()=>window.clearInterval(timer)},[id]);
 const d=query.data, expired=d?.assignment.status==='PENDING' && new Date(d.assignment.expires_at).getTime()<=now;
 return <Page title={d?.request.title || 'Phân công Creator'}><Link to="/creator/dashboard">← Công việc của tôi</Link><State query={query}>{d && <>
  <header className="panel request-workspace-header"><div><small>{d.request.request_number}</small><h2>Phần việc của bạn</h2><Status value={expired?'EXPIRED':d.assignment.status}/><p>Staff phụ trách: {d.staff?.full_name || 'Chờ cập nhật'}</p></div><button className="btn btn-ghost" onClick={query.reload} disabled={query.loading}>Làm mới</button></header>
  <ServiceChatLayout key={`layout-${profile?.id}-${d.request.id}`} enabled={d.chat_enabled} requestId={d.request.id} tools={<aside className="workspace-documents"><section className="panel"><h2>Phân công</h2><p className="preserve-lines">{d.assignment.work_scope}</p><p>Hạn bàn giao: {d.assignment.deadline || 'Chưa có'}</p><details><summary>Brief dự án</summary><p className="preserve-lines">{d.request.brief}</p></details>
   {d.assignment.status==='PENDING' && !expired && <><p>Giữ chỗ đến {new Date(d.assignment.expires_at).toLocaleTimeString('vi-VN')}</p><ActionForm label="Xác nhận nhận việc" onSubmit={()=>post(`/creator/requests/${d.request.id}/accept`,{assignment_id:d.assignment.id})} onSuccess={query.reload}/><details><summary>Từ chối phân công</summary><ActionForm label="Gửi lý do từ chối" onSubmit={f=>post(`/creator/requests/${d.request.id}/decline`,{assignment_id:d.assignment.id,reason:f.get('decline-reason')})} onSuccess={query.reload}><Field name="decline-reason" label="Lý do từ chối" type="textarea"/></ActionForm></details></>}
   {expired && <p>Lời mời hết thời gian giữ chỗ. Staff cần gửi lại để bạn xác nhận.</p>}{d.assignment.response_note && <p>{d.assignment.response_note}</p>}
  </section><section className="panel"><h2>Cập nhật tiến độ</h2><p className="muted">Cả khi trao đổi ngoài hệ thống, hãy lưu tình hình và các nội dung đã thống nhất tại đây. Tiến độ 100% chưa giải phóng lịch; Creator trở lại rảnh sau khi toàn bộ dự án bàn giao xong.</p>
   {d.chat_enabled && d.assignment.status==='ACCEPTED' && d.order?.status==='IN_PROGRESS' && <ActionForm label="Lưu cập nhật tiến độ" onSubmit={f=>post(`/creator/requests/${d.request.id}/progress`,{assignment_id:d.assignment.id,progress:Number(f.get('progress')),content:f.get('progress-note')})} onSuccess={query.reload}><label className="field">Tiến độ (%)<input name="progress" type="number" min={0} max={100} step={1} required/></label><Field name="progress-note" label="Kết quả, việc tiếp theo hoặc vấn đề cần Staff xử lý" type="textarea"/></ActionForm>}
   {d.updates.map(u=><article className="team-progress" key={u.id}><b>{u.progress}%</b><p>{u.content}</p><small>{new Date(u.created_at).toLocaleString('vi-VN')}</small></article>)}{!d.updates.length && <p>Chưa có cập nhật tiến độ.</p>}
  </section>{d.order&&d.chat_enabled&&<ExecutionPanel id={d.order.id} onChanged={query.reload}/>}
  {d.order&&d.chat_enabled&&<AcceptedVariationScopes id={d.order.id}/>}
  {d.order&&d.chat_enabled&&<OrderDeliveryPanel id={d.order.id} onChanged={query.reload}/>}</aside>}>
   {d.chat_enabled && d.conversation_id ? <RequestConversation key={`${profile?.id}-${d.request.id}`} id={d.request.id} title={d.request.title} staffName={d.staff?.full_name||"Chờ Staff tiếp nhận"} staffAvatar={d.staff?.avatar_url} status={d.assignment.status} conversationId={d.conversation_id} closed={d.order?.status==='COMPLETED'} onActivity={query.reload}/> : <section className="panel"><h2>Hội thoại dự án</h2><p>Hội thoại chung mở sau khi bạn xác nhận nhận việc và Customer xác nhận hợp đồng dịch vụ. Staff có thể trao đổi với bạn ngoài hệ thống để làm rõ phần việc.</p></section>}
</ServiceChatLayout>
 </>}</State></Page>;
}
