import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { api, post } from '../../services/api';
import { ActionForm, Field, Page, Pagination, State } from '../../components/ui';
type Candidate={id:string;request_id:string;order_number:string;requests:{title:string};preference:{show_name:boolean}|null;case_study:{title:string;excerpt:string;image_path:string;preview_url?:string;published:boolean;updated_at:string}|null};
export function CaseStudyReviewPage(){
 const [page,setPage]=useState(1),query=useApi<{items:Candidate[];total:number}>(`/admin/case-studies?page=${page}`);
 return <Page title="Duyệt dự án tiêu biểu"><p>Chỉ duyệt dự án đã bàn giao đầy đủ. Chuẩn bị ảnh trích đoạn riêng; kiểm tra nội dung và lựa chọn tên trước khi công khai.</p><State query={query}>{query.data?.items.map(order=><CaseEditor key={`${order.id}-${order.case_study?.updated_at??''}`} order={order} onChanged={query.reload}/>)}{!query.data?.items.length&&<p>Chưa có đơn dịch vụ hoàn thành để duyệt.</p>}<Pagination page={page} total={query.data?.total??0} limit={12} onChange={setPage}/></State></Page>;
}
function CaseEditor({order,onChanged}:{order:Candidate;onChanged:()=>void}){
 const [image,setImage]=useState(order.case_study?.image_path??''),[preview,setPreview]=useState(order.case_study?.preview_url??'');
 return <article className="panel case-editor"><header><h2><Link to={`/admin/requests/${order.request_id}`}>{order.requests.title}</Link></h2><small>{order.order_number} · {order.case_study?.published?'Đang công khai':'Chưa công khai'}</small></header><p>Khách chọn: <strong>{order.preference?(order.preference.show_name?'Hiển thị tên':'Ẩn danh'):'Chưa ghi nhận lựa chọn tên'}</strong></p>
 {!order.preference&&<p>Khách cập nhật lựa chọn ở mục Hợp đồng hoặc Đánh giá trong chính hội thoại dịch vụ trước khi Admin duyệt.</p>}
 <ActionForm label="Chuẩn bị ảnh trích đoạn" onSubmit={async form=>{const body=new FormData();body.set('file',form.get('excerpt-file')!);const uploaded=await api<{path:string;signedUrl:string}>(`/admin/case-studies/${order.id}/image`,{method:'POST',body});setImage(uploaded.path);setPreview(uploaded.signedUrl);}}><div className="field"><label htmlFor={`excerpt-${order.id}`}>Ảnh một phần nhỏ sản phẩm, tối đa 5 MB</label><input id={`excerpt-${order.id}`} name="excerpt-file" type="file" accept="image/jpeg,image/png,image/webp" required/></div><p className="muted">Ảnh phải được cắt/chỉnh riêng trước khi tải lên. Hệ thống không tự cắt ảnh hoặc che danh tính.</p></ActionForm>
 {preview&&<img className="case-excerpt-preview" src={preview} alt="Xem trước trích đoạn đang duyệt"/>}
 {image&&order.preference&&<ActionForm label="Duyệt và công khai trích đoạn" onSubmit={form=>post(`/admin/case-studies/${order.id}/publish`,{title:form.get('case-title'),excerpt:form.get('case-excerpt'),image_path:image,excerpt_checked:form.get('excerpt-checked')==='on',identity_checked:form.get('identity-checked')==='on'})} onSuccess={onChanged}><Field name="case-title" label="Tiêu đề công khai" maxLength={150} value={order.case_study?.title??order.requests.title}/><Field name="case-excerpt" label="Giới thiệu trích đoạn" type="textarea" maxLength={1000} value={order.case_study?.excerpt}/><label className="contract-checkbox"><input type="checkbox" name="excerpt-checked" required/><span>Tôi đã kiểm tra đây chỉ là trích đoạn nhỏ, không có hợp đồng, khoản tiền hoặc tệp đầy đủ.</span></label><label className="contract-checkbox"><input type="checkbox" name="identity-checked" required/><span>Tôi đã kiểm tra cả ảnh và chữ theo lựa chọn {order.preference.show_name?'hiển thị tên':'ẩn danh của khách; đã che tên, logo và thông tin nhận diện'}.</span></label></ActionForm>}
 {order.case_study?.published&&<ActionForm label="Gỡ công khai" onSubmit={()=>post(`/admin/case-studies/${order.id}/withdraw`)} onSuccess={onChanged}/>}
 </article>;
}
