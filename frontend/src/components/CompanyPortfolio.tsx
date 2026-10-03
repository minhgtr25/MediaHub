import { FormEvent, useState } from 'react';
import { ArrowRight, Search } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { Pagination, State } from './ui';

export type CompanyProject={public_id:string;kind:'PORTFOLIO'|'EXCERPT';title:string;description:string|null;customer_name:string|null;category:string|null;year:number|null;updated_at:string;image_url:string|null;href:string};
export function CompanyPortfolio({compact=false}:{compact?:boolean}){
 const [params]=useSearchParams();
 const [search,setSearch]=useState(params.get('search')?.slice(0,100)??'');
 const [category,setCategory]=useState(''),[kind,setKind]=useState('ALL'),[page,setPage]=useState(1);
 const [applied,setApplied]=useState({search,category,kind});
 const limit=6;
 const query=useApi<{items:CompanyProject[];total:number;limit:number}>(`/public/company-portfolio?${new URLSearchParams({page:String(page),limit:String(limit),search:applied.search,category:applied.category,kind:applied.kind})}`);
 function filter(event:FormEvent){event.preventDefault();setApplied({search:search.trim(),category:category.trim(),kind});setPage(1);}
 const Title=compact?'h2':'h1';
 return <section className={`company-portfolio ${compact?'home-section':'page section'}`}>
  <header className="company-portfolio-heading"><div><span className="eyebrow">HỒ SƠ DỰ ÁN</span><Title>Dự án nổi bật</Title><p className="muted">Những sản phẩm được MediaHub quản lý và triển khai.</p></div>{compact&&<Link className="btn btn-ghost" to="/projects">Xem hồ sơ dự án <ArrowRight/></Link>}</header>
  {<form className="company-portfolio-filters" onSubmit={filter}>
   <label><span>Tìm hồ sơ</span><div className="search-input"><Search/><input maxLength={100} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tên, khách hàng hoặc nội dung…"/></div></label>
   <label><span>Danh mục</span><input maxLength={100} value={category} onChange={e=>setCategory(e.target.value)} placeholder="Ví dụ: Video"/></label>
   <label><span>Loại hồ sơ</span><select value={kind} onChange={e=>setKind(e.target.value)}><option value="ALL">Tất cả hồ sơ</option><option value="PORTFOLIO">Hồ sơ công ty</option><option value="EXCERPT">Trích đoạn đã duyệt</option></select></label>
   <button className="btn btn-primary" type="submit">Tìm kiếm</button>
  </form>}
  <State query={query}><div className="company-project-grid">{query.data?.items.map(p=><Link className="company-project-card" key={`${p.kind}-${p.public_id}`} to={p.href}>
   <div className="company-project-image">{p.image_url?<img src={p.image_url} alt={p.title} loading="lazy" decoding="async"/>:<span className="muted">Ảnh hồ sơ đang được cập nhật</span>}</div>
   <div className="company-project-content"><span className="eyebrow">{p.category||(p.kind==='EXCERPT'?'Trích đoạn đã duyệt':'Hồ sơ công ty')}</span><h3>{p.title}</h3>{p.customer_name&&<p className="company-project-client">{p.customer_name}</p>}{p.description&&<p className="company-project-summary">{p.description}</p>}<footer>{p.year&&<span>{p.year}</span>}<span>Xem hồ sơ dự án <ArrowRight/></span></footer></div>
  </Link>)}</div>{query.data?.items.length===0&&<div className="panel company-project-empty"><p>{applied.search||applied.category||applied.kind!=='ALL'?'Không có hồ sơ phù hợp với bộ lọc.':'Hồ sơ dự án đang được cập nhật.'}</p>{(applied.search||applied.category||applied.kind!=='ALL')&&<button className="btn btn-ghost" onClick={()=>{setSearch('');setCategory('');setKind('ALL');setApplied({search:'',category:'',kind:'ALL'});setPage(1);}}>Xem tất cả hồ sơ</button>}</div>}
  {query.data&&query.data.total>limit&&<Pagination page={page} limit={limit} total={query.data.total} onChange={setPage}/>}</State>
 </section>;
}
