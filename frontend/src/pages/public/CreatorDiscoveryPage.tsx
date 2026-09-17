import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, BadgeCheck, Briefcase, CheckCircle2, CircleDollarSign, Clock3, ExternalLink, GraduationCap, Languages, MapPin, Search, ShieldCheck, Star, Wrench } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { money, Pagination, State } from "../../components/ui";
import { useApi } from "../../hooks/useApi";
import { useAuth } from "../../contexts/AuthContext";
import { post } from "../../services/api";

type Option = { id: string; name: string; slug: string };
type Creator = { id:string; slug:string; display_name:string; title:string; avatar_url?:string; location:string; rating?:number; review_count:number; completed_projects:number; verified:boolean; featured:boolean; response_time:string; creator_skills:{skills:Option}[]; creator_portfolio:{id:string;title:string;thumbnail_url?:string}[] };
type CreatorDetail = Omit<Creator,"creator_portfolio"> & { bio:string; cover_url?:string; university?:string; major?:string; experience_level:string; tools:string[]; languages:string[]; completion_rate:number; response_rate:number; availability:string; price_from?:number; creator_categories:{categories:Option}[]; creator_portfolio:{id:string;title:string;description:string;thumbnail_url?:string;gallery:string[];video_url?:string;category:string;client:string;project_year?:number;project_url?:string;featured:boolean}[] };
type Collection<T> = { items:T[]; total:number; page:number; limit:number };

export function Creators() {
  const [params]=useSearchParams();
  const [page,setPage]=useState(1), [search,setSearch]=useState(params.get("search")??""), [category,setCategory]=useState(params.get("category")??""), [experience,setExperience]=useState(params.get("experience")??""), [location,setLocation]=useState(params.get("location")??""), [sort,setSort]=useState("recommended");
  const options=useApi<{categories:Option[];skills:Option[]}>("/public/creators/filters");
  const path=useMemo(()=>{const p=new URLSearchParams({page:String(page),limit:"6",search,sort}); if(category)p.set("category",category); if(experience)p.set("experience",experience); if(location)p.set("location",location); return `/public/creators?${p}`},[page,search,category,experience,location,sort]);
  const query=useApi<Collection<Creator>>(path);
  const change=(setter:(v:string)=>void)=>(e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement>)=>{setter(e.target.value);setPage(1)};
  return <main className="creator-page">
    <section className="creator-heading"><small>TRANG CHỦ / <b>TÌM CREATOR</b></small><div><div><h1>Khám phá <span>Creator trẻ &amp; Đội ngũ</span> Sáng tạo</h1><p>Mạng lưới creator được định hướng, kiểm soát quy trình và chịu trách nhiệm sản phẩm cuối cùng bởi MediaHub.</p></div><div className="creator-proof"><strong>100%</strong><span>Đã test tay nghề</span><strong>24/7</strong><span>MediaHub hỗ trợ</span></div></div></section>
    <section className="creator-filter" aria-label="Bộ lọc Creator"><label className="creator-search"><Search size={18}/><input value={search} onChange={change(setSearch)} placeholder="Tìm kỹ năng, tên Creator, phần mềm…"/></label><select aria-label="Chuyên môn" value={category} onChange={change(setCategory)}><option value="">Tất cả chuyên môn</option>{options.data?.categories.map(x=><option key={x.id} value={x.slug}>{x.name}</option>)}</select><label className="location-filter"><MapPin size={16}/><input value={location} onChange={change(setLocation)} placeholder="Toàn quốc / Remote"/></label><select aria-label="Cấp độ" value={experience} onChange={change(setExperience)}><option value="">Cấp độ &amp; Đội ngũ</option><option value="STUDENT">Sinh viên</option><option value="JUNIOR">Junior</option><option value="MID">Middle</option><option value="SENIOR">Senior</option><option value="LEAD">Lead</option></select><button type="button" className="btn btn-primary" onClick={()=>setPage(1)}>Áp dụng <ArrowRight size={16}/></button><div className="popular-filters"><span>Bộ lọc phổ biến:</span>{options.data?.categories.slice(0,5).map(x=><button type="button" className={category===x.slug?"active":""} onClick={()=>{setCategory(category===x.slug?"":x.slug);setPage(1)}} key={x.id}>#{x.name.replaceAll(" ","")}</button>)}<label>Sắp xếp: <select value={sort} onChange={change(setSort)}><option value="recommended">MediaHub đề xuất</option><option value="rating">Đánh giá cao</option><option value="projects">Nhiều dự án</option><option value="price">Giá thấp trước</option></select></label></div></section>
    <section className="creator-results"><div className="results-meta"><span>Hiển thị {query.data?.items.length??0} trong số <b>{query.data?.total??0}+</b> Creator</span><span><ShieldCheck size={15}/> Đảm bảo giao đúng cam kết &amp; nghiệm thu kỹ thuật</span></div><State query={query}><div className="creator-market-grid">{query.data?.items.map(c=><CreatorCard key={c.id} creator={c}/>)}</div>{!query.data?.items.length&&<div className="creator-empty"><Search/><h2>Chưa tìm thấy Creator phù hợp</h2><p>Hãy thử bỏ bớt bộ lọc hoặc tìm bằng kỹ năng khác.</p></div>}<Pagination page={page} total={query.data?.total??0} onChange={setPage}/></State></section>
    <section className="creator-cta"><div><small>QUY TRÌNH MANAGED AGENCY</small><h2>Bạn chưa biết chọn Creator nào để tối ưu ngân sách?</h2><p>Đội ngũ Account &amp; Art Director của MediaHub sẽ tư vấn và chịu trách nhiệm toàn diện từ A–Z.</p></div><Link className="btn btn-primary" to="/request-project">Gửi Brief nhận tư vấn miễn phí <ArrowRight/></Link></section>
  </main>;
}
function CreatorCard({creator:c}:{creator:Creator}) { return <article className={`market-card ${c.featured?"lead":""}`}>{c.featured&&<span className="lead-ribbon">★ MEDIAHUB LEAD CREATOR</span>}<header><img src={c.avatar_url||`https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(c.display_name)}`} alt={c.display_name}/><div><h2>{c.display_name} {c.verified&&<BadgeCheck size={16}/>}</h2><p>{c.title}</p><small><MapPin size={12}/>{c.location}</small></div><span className="rating"><Star size={13}/> {c.rating??"Mới"}<small>{c.review_count} đánh giá</small></span></header><div className="skill-chips">{c.creator_skills.slice(0,5).map(x=><span key={x.skills.id}>{x.skills.name}</span>)}</div><div className="portfolio-label"><span>Dự án nổi bật</span><b>{c.completed_projects} dự án</b></div><div className="creator-thumbs">{c.creator_portfolio.slice(0,3).map((p,i)=><img key={p.id} src={p.thumbnail_url||`/assets/project-${i+1}.png`} alt={p.title} loading="lazy"/>)}</div><p className="creator-assurance"><ShieldCheck size={16}/> Phối hợp cùng Account Director MediaHub, phản hồi {c.response_time.toLowerCase()}.</p><footer><Link className="btn btn-ghost" to={`/creators/${c.slug}`}><Briefcase size={15}/> Xem Portfolio</Link><MessageCreator creator={c}/></footer></article> }
function MessageCreator({creator}:{creator:Creator}){const nav=useNavigate(),auth=useAuth();const [busy,setBusy]=useState(false),[error,setError]=useState("");return <div className="message-action"><button className="btn btn-primary" disabled={busy} onClick={async()=>{if(!auth.currentUser){nav("/login",{state:{from:`/creators/${creator.slug}`}});return}setBusy(true);setError("");try{const conversation=await post("/messages",{creator_id:creator.id,subject:`Trao đổi với ${creator.display_name}`});nav(`/messages/${conversation.id}`)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}}>{busy?"Đang mở…":"Nhắn tin"}<ArrowRight size={15}/></button>{error&&<small role="alert" className="error">{error}</small>}</div>}

export function CreatorProfile(){
  const {slug}=useParams();
  const query=useApi<CreatorDetail>(slug?`/public/creators/${encodeURIComponent(slug)}`:null);
  const c=query.data;
  return <main className="creator-profile-page">
    <Link className="creator-back" to="/creators"><ArrowLeft/> Quay lại danh sách Creator</Link>
    <State query={query}>{c&&<>
      <section className="creator-profile-hero">
        <div className="creator-cover"><img src={c.cover_url||c.creator_portfolio[0]?.thumbnail_url||"/assets/project-1.png"} alt={`Ảnh bìa hồ sơ ${c.display_name}`}/></div>
        <div className="creator-identity">
          <img src={c.avatar_url||`https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(c.display_name)}`} alt={`Ảnh đại diện ${c.display_name}`}/>
          <div><span className="creator-availability"><i/>{c.availability==="AVAILABLE"?"Sẵn sàng nhận dự án":"Trao đổi lịch làm việc"}</span><h1>{c.display_name} {c.verified&&<BadgeCheck/>}</h1><p>{c.title}</p><small><MapPin/> {c.location||"Làm việc từ xa"}</small></div>
          <div className="creator-profile-action"><span>Chi phí tham khảo từ</span><strong>{c.price_from?money(c.price_from):"Liên hệ"}</strong><MessageCreator creator={c}/></div>
        </div>
      </section>
      <section className="creator-profile-stats">
        <div><Star/><strong>{c.rating??"Mới"}</strong><span>{c.review_count} đánh giá</span></div>
        <div><Briefcase/><strong>{c.completed_projects}</strong><span>Dự án hoàn thành</span></div>
        <div><CheckCircle2/><strong>{c.completion_rate}%</strong><span>Tỷ lệ hoàn thành</span></div>
        <div><Clock3/><strong>{c.response_time}</strong><span>Thời gian phản hồi</span></div>
      </section>
      <div className="creator-profile-grid">
        <div className="creator-profile-main">
          <section><p className="profile-kicker">GIỚI THIỆU</p><h2>Về {c.display_name}</h2><p className="creator-bio">{c.bio||"Creator thuộc mạng lưới MediaHub, sẵn sàng tham gia các dự án phù hợp với chuyên môn."}</p></section>
          <section><p className="profile-kicker">DỰ ÁN ĐÃ THỰC HIỆN</p><h2>Portfolio nổi bật</h2>{c.creator_portfolio.length?<div className="creator-portfolio-grid">{c.creator_portfolio.map((item,i)=><article key={item.id}><img src={item.thumbnail_url||`/assets/project-${i%3+1}.png`} alt={item.title}/><div><small>{item.category||item.project_year||"Dự án sáng tạo"}</small><h3>{item.title}</h3><p>{item.description}</p>{item.project_url&&<a href={item.project_url} target="_blank" rel="noreferrer">Xem dự án <ExternalLink/></a>}</div></article>)}</div>:<div className="creator-empty"><Briefcase/><h3>Portfolio đang được cập nhật</h3><p>Liên hệ MediaHub để nhận hồ sơ năng lực phù hợp với brief của bạn.</p></div>}</section>
        </div>
        <aside className="creator-profile-side">
          <section><h2>Chuyên môn</h2><div className="skill-chips">{c.creator_skills.map(x=><span key={x.skills.id}>{x.skills.name}</span>)}</div>{c.creator_categories.length>0&&<div className="profile-categories">{c.creator_categories.map(x=><span key={x.categories.id}>{x.categories.name}</span>)}</div>}</section>
          <section><h2>Năng lực làm việc</h2><dl><div><dt><Wrench/> Công cụ</dt><dd>{c.tools.join(", ")||"Theo yêu cầu dự án"}</dd></div><div><dt><Languages/> Ngôn ngữ</dt><dd>{c.languages.join(", ")}</dd></div>{(c.university||c.major)&&<div><dt><GraduationCap/> Học vấn</dt><dd>{[c.university,c.major].filter(Boolean).join(" · ")}</dd></div>}<div><dt><CircleDollarSign/> Cấp độ</dt><dd>{c.experience_level}</dd></div></dl></section>
          <section className="creator-trust"><ShieldCheck/><div><h2>MediaHub bảo chứng</h2><p>Creator đã được xác minh năng lực. MediaHub theo sát tiến độ và chất lượng đến khi nghiệm thu.</p></div></section>
        </aside>
      </div>
    </>}</State>
  </main>
}
