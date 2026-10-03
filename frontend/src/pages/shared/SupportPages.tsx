import {useState} from 'react';
import {Link,useParams,useNavigate} from 'react-router-dom';
import {useAuth} from '../../contexts/AuthContext';
import {useApi} from '../../hooks/useApi';
import {Page,State,ActionForm,Field,Pagination} from '../../components/ui';
import {post} from '../../services/api';
import {isCustomerRole} from '../../lib/permissions';
const labels:Record<string,string>={OPEN:'Mới',IN_PROGRESS:'Đang hỗ trợ',RESOLVED:'Đã giải quyết',CLOSED:'Đã đóng',GENERAL:'Tư vấn chung',PROJECT:'Dự án',PAYMENT:'Thanh toán',TECHNICAL:'Kỹ thuật'};
type Ticket={id:string;subject:string;category:string;status:string;assigned_to:string|null;updated_at:string};
export function SupportInbox(){
 const {role}=useAuth(),base=role==='ADMIN'?'/admin':role==='STAFF'?'/staff':'/customer';
 const [page,setPage]=useState(1),[status,setStatus]=useState('');
 const q=useApi<{items:Ticket[];total:number}>(
 '/support?page='+page+(status?'&status='+status:''));
 const nav=useNavigate();
 return <Page title={isCustomerRole(role)?'Trung tâm hỗ trợ':'Hàng đợi hỗ trợ'}><div className="support-intro panel"><span className="eyebrow">MEDIAHUB CARE</span><h2>Luôn đồng hành cùng bạn</h2><p>Trao đổi về dự án, báo giá và thanh toán. Mỗi yêu cầu được theo dõi đến khi giải quyết.</p></div>
 {isCustomerRole(role)&&<details className="panel"><summary className="btn btn-primary">Tạo yêu cầu hỗ trợ</summary><ActionForm label="Gửi yêu cầu" onSubmit={async d=>{const t=await post('/support',{subject:d.get('subject'),category:d.get('category'),message:d.get('message')});nav(base+'/support/'+t.id)}}><Field name="subject" label="Tiêu đề"/><label className="field">Chủ đề<select name="category">{['GENERAL','PROJECT','PAYMENT','TECHNICAL'].map(x=><option key={x} value={x}>{labels[x]}</option>)}</select></label><label className="field">Nội dung<textarea name="message" required maxLength={5000} rows={4}/></label></ActionForm></details>}
 <div className="toolbar"><select aria-label="Lọc trạng thái" value={status} onChange={e=>{setStatus(e.target.value);setPage(1)}}><option value="">Tất cả trạng thái</option>{['OPEN','IN_PROGRESS','RESOLVED','CLOSED'].map(x=><option key={x} value={x}>{labels[x]}</option>)}</select><button className="btn btn-ghost" onClick={q.reload}>Làm mới</button></div>
 <State query={q}><div className="resource-grid">{q.data?.items.map(t=><article className="panel" key={t.id}><span className="eyebrow">{labels[t.category]} · {labels[t.status]}</span><h2>{t.subject}</h2><p>{new Date(t.updated_at).toLocaleString('vi-VN')}</p>{role==='STAFF'&&!t.assigned_to?<ActionForm label="Nhận hỗ trợ" onSubmit={()=>post('/support/'+t.id+'/claim')} onSuccess={()=>nav(base+'/support/'+t.id)}/>:<Link className="btn btn-primary" to={base+'/support/'+t.id}>Mở hội thoại</Link>}</article>)}</div>{!q.data?.items.length&&<div className="panel">Chưa có yêu cầu hỗ trợ.</div>}<Pagination page={page} total={q.data?.total??0} onChange={setPage}/></State></Page>
}
export function SupportConversation(){
 const {id}=useParams(),{profile,role}=useAuth();const [page,setPage]=useState(1);
 const q=useApi<{ticket:Ticket;assigned_staff:{id:string;full_name:string;role:string}|null;messages:{id:string;sender_id:string;message:string;created_at:string}[];senders:{id:string;full_name:string;role:string}[];total:number}>('/support/'+id+'?page='+page);
 const agents=useApi<{id:string;full_name:string}[]>(role==='ADMIN'?'/support/agents':null);
 return <Page title={q.data?.ticket.subject??'Hội thoại hỗ trợ'}><State query={q}>{q.data&&<><div className="toolbar"><span className="badge">{labels[q.data.ticket.status]}</span><button className="btn btn-ghost" onClick={q.reload}>Làm mới tin nhắn</button></div>
 <section className="panel"><p>Mã yêu cầu: <strong>{q.data.ticket.id}</strong></p><p>Người phụ trách: <strong>{q.data.assigned_staff?.full_name??'Đang chờ MediaHub phân công'}</strong></p><p>{q.data.ticket.status==='CLOSED'?'Yêu cầu đã đóng. Bạn có thể tạo yêu cầu mới nếu cần hỗ trợ thêm.':q.data.ticket.status==='RESOLVED'?'Yêu cầu đã được giải quyết. Gửi tin nhắn nếu bạn cần hỗ trợ tiếp.':q.data.assigned_staff?'Trao đổi với người phụ trách trong hội thoại bên dưới.':'MediaHub sẽ tiếp nhận yêu cầu. Bạn có thể bổ sung thông tin trong hội thoại.'}</p></section>
 {role==='ADMIN'&&<ActionForm label="Phân công" onSubmit={d=>post('/support/'+id+'/assign',{assigned_to:d.get('assigned_to')})} onSuccess={q.reload}><label className="field">Nhân viên phụ trách<select required name="assigned_to" defaultValue={q.data.ticket.assigned_to??''}><option value="">Chọn nhân viên</option>{agents.data?.map(a=><option key={a.id} value={a.id}>{a.full_name}</option>)}</select></label></ActionForm>}
 <section className="panel support-thread" aria-label="Lịch sử hội thoại">{q.data.messages.map(m=><article key={m.id} className={'chat-bubble '+(m.sender_id===profile?.id?'mine':'')}><strong>{q.data?.senders.find(s=>s.id===m.sender_id)?.full_name??'MediaHub'}</strong><p>{m.message}</p><small>{new Date(m.created_at).toLocaleString('vi-VN')}</small></article>)}</section>
 <Pagination page={page} total={q.data.total} limit={50} onChange={setPage}/>
 {q.data.ticket.status!=='CLOSED'&&<ActionForm label="Gửi tin nhắn" onSubmit={d=>post('/support/'+id+'/message',{message:d.get('message')})} onSuccess={q.reload}><label className="field">Tin nhắn<textarea required name="message" maxLength={5000} rows={3}/></label></ActionForm>}
 {(role==='STAFF'||role==='ADMIN')&&<ActionForm label="Cập nhật trạng thái" onSubmit={d=>post('/support/'+id+'/status',{status:d.get('status')})} onSuccess={q.reload}><label className="field">Trạng thái<select name="status" defaultValue={q.data.ticket.status}>{['OPEN','IN_PROGRESS','RESOLVED','CLOSED'].map(x=><option key={x} value={x}>{labels[x]}</option>)}</select></label></ActionForm>}</>}</State></Page>
}
