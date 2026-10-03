import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { Pagination, State } from './ui';
type Review={rating:number;content:string;customer_name:string;submitted_at:string;updated_at:string};
export function VerifiedCreatorReviews({slug}:{slug:string}){
 const [page,setPage]=useState(1),query=useApi<{items:Review[];total:number;rating:number|null}>(`/public/creator-reviews/${encodeURIComponent(slug)}?page=${page}`);
 return <section className="verified-creator-reviews"><h2>Đánh giá từ dự án đã bàn giao</h2><State query={query}>{query.data&&<><p>{query.data.rating===null?'Chưa có đánh giá từ đơn đã hoàn thành.':`${query.data.rating}/5 sao · ${query.data.total} đánh giá từ đơn đã hoàn thành`}</p>{query.data.items.map((item,index)=><article key={`${item.submitted_at}-${index}`}><strong>{item.customer_name} · {item.rating}/5 sao</strong><p className="preserve-lines">{item.content}</p><small>{new Date(item.updated_at).toLocaleDateString('vi-VN')}</small></article>)}<Pagination page={page} total={query.data.total} limit={10} onChange={setPage}/></>}</State></section>;
}
