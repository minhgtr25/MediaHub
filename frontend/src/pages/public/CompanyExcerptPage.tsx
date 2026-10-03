import { Link, useParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { State } from '../../components/ui';
import { Metadata } from '../../components/Metadata';
import type { CompanyProject } from '../../components/CompanyPortfolio';

export function CompanyExcerptPage(){
 const {id}=useParams(),query=useApi<CompanyProject>(`/public/company-portfolio/case/${id}`),p=query.data;
 return <main className="page section company-excerpt-detail">
  <Link className="back" to="/projects">← Xem tất cả hồ sơ dự án</Link>
  <State query={query}>{p&&<>
   <Metadata title={p.title} description={p.description??'Trích đoạn dự án được MediaHub duyệt công khai.'}/>
   <header><span className="eyebrow">HỒ SƠ DỰ ÁN · TRÍCH ĐOẠN ĐÃ DUYỆT</span><h1>{p.title}</h1>{p.customer_name&&<p className="muted">Khách hàng: {p.customer_name}</p>}</header>
   {p.image_url&&<img className="company-excerpt-image" src={p.image_url} alt={`Trích đoạn: ${p.title}`}/>}
   <article className="panel"><h2>Giới thiệu dự án</h2><p className="preserve-lines">{p.description}</p><p className="muted">Đây là trích đoạn sản phẩm đã được duyệt công khai sau khi dự án hoàn thành.</p></article>
   <Link className="btn btn-primary" to="/request-project">Yêu cầu tư vấn dịch vụ tương tự <ArrowRight/></Link>
  </>}</State>
 </main>;
}
