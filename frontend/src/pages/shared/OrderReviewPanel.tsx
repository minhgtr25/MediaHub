import { useEffect, useId, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useApi } from '../../hooks/useApi';
import { ActionForm, Field, State } from '../../components/ui';
import { post } from '../../services/api';
import { isCustomerRole } from '../../lib/permissions';
type CreatorReview={creator_id:string;rating:number;content:string};
type ReviewData={review:{rating:number;content:string;submitted_at:string;updated_at:string}|null;creators:CreatorReview[];preference:{show_name:boolean}|null;team:{creator_id:string;creator_profiles:{display_name:string}}[];eligible:boolean;can_review:boolean;editable_until:string|null};
export function PublicationNameField({value=false}:{value?:boolean}){
 const fieldId=useId();
 return <div className="field"><label htmlFor={fieldId}>Tên trên đánh giá và dự án tiêu biểu</label><select name="show_name" id={fieldId} defaultValue={String(value)}><option value="false">Ẩn danh</option><option value="true">Hiển thị tên của tôi</option></select><p className="muted">Sau khi hoàn thành, Admin có thể công khai một trích đoạn nhỏ để giới thiệu dự án. Tệp sản phẩm đầy đủ và tài liệu hợp đồng vẫn riêng tư. Nếu chọn ẩn danh, Admin phải kiểm tra cả chữ và ảnh để che thông tin nhận diện. Bạn cũng nên tránh ghi thông tin cá nhân trong nhận xét công khai.</p></div>;
}
export function OrderReviewPanel({id,onChanged,active=true}:{id:string;onChanged:()=>void;active?:boolean}){
 const {role}=useAuth(),customer=isCustomerRole(role),query=useApi<ReviewData>(`/order-feedback/${id}`);
 const data=query.data,refresh=()=>{query.reload();onChanged();};
 const opened=useRef(false);
 useEffect(()=>{
  if(!active)return;
  if(opened.current)query.reload();else opened.current=true;
  const refreshVisible=()=>{if(document.visibilityState==='visible')query.reload();};
  const timer=window.setInterval(refreshVisible,30000);window.addEventListener('focus',refreshVisible);
  return ()=>{window.clearInterval(timer);window.removeEventListener('focus',refreshVisible);};
 },[id,active]);
 return <section className="panel review-panel"><header><h2>Đánh giá sau bàn giao</h2><button className="btn btn-ghost" disabled={query.loading} onClick={query.reload}>Làm mới</button></header><p className="muted">Đánh giá kết quả dịch vụ và từng Creator đã thực hiện. Có thể sửa trong 7 ngày từ lần gửi đầu tiên.</p><State query={query}>{data&&<>
  {!data.eligible&&<p>Đánh giá mở sau khi đã nghiệm thu, xác nhận thu đủ và nhận toàn bộ bản không watermark.</p>}
  {data.review&&<article className="review-summary"><strong>Kết quả: {data.review.rating}/5 sao</strong><p className="preserve-lines">{data.review.content}</p><small>Gửi lần đầu: {new Date(data.review.submitted_at).toLocaleString('vi-VN')} · Hạn sửa: {new Date(data.editable_until!).toLocaleString('vi-VN')}</small>{data.creators.map(item=><div key={item.creator_id}><strong>{data.team.find(x=>x.creator_id===item.creator_id)?.creator_profiles.display_name} · {item.rating}/5 sao</strong><p className="preserve-lines">{item.content}</p></div>)}</article>}
  {data.can_review&&<ActionForm key={data.review?.updated_at??'first'} label={data.review?'Lưu đánh giá đã sửa':'Gửi đánh giá'} onSubmit={form=>post(`/order-feedback/${id}/review`,{rating:Number(form.get('result-rating')),content:form.get('result-content'),show_name:form.get('show_name')==='true',notice_version:'EXCERPT_V1',creators:data.team.map(member=>({creator_id:member.creator_id,rating:Number(form.get(`rating-${member.creator_id}`)),content:form.get(`content-${member.creator_id}`)}))})} onSuccess={refresh}>
   <Stars name="result-rating" label="Mức độ hài lòng với kết quả" value={data.review?.rating}/><Field name="result-content" label="Nhận xét kết quả đạt được" type="textarea" maxLength={3000} value={data.review?.content}/>
   {data.team.map(member=>{const existing=data.creators.find(x=>x.creator_id===member.creator_id);return <section className="review-creator" key={member.creator_id}><h3>{member.creator_profiles.display_name}</h3><Stars name={`rating-${member.creator_id}`} label="Đánh giá Creator" value={existing?.rating}/><Field name={`content-${member.creator_id}`} label="Nhận xét về phối hợp và sản phẩm" type="textarea" maxLength={2000} value={existing?.content}/></section>;})}
   <PublicationNameField value={data.preference?.show_name}/>
  </ActionForm>}
  {customer&&!data.can_review&&<ActionForm key={String(data.preference?.show_name)} label="Lưu lựa chọn hiển thị tên" onSubmit={form=>post(`/order-feedback/${id}/preference`,{show_name:form.get('show_name')==='true',notice_version:'EXCERPT_V1'})} onSuccess={refresh}><PublicationNameField value={data.preference?.show_name}/></ActionForm>}
  {customer&&data.eligible&&!data.can_review&&<p>Đã hết thời gian sửa nội dung đánh giá. Bạn vẫn có thể thay đổi lựa chọn hiển thị tên.</p>}
 </>}</State></section>;
}
function Stars({name,label,value}:{name:string;label:string;value?:number}){return <div className="field"><label htmlFor={name}>{label}</label><select id={name} name={name} defaultValue={value??''} required><option value="" disabled>Chọn số sao</option>{[5,4,3,2,1].map(score=><option key={score} value={score}>{score} sao</option>)}</select></div>;}
