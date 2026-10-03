import { CompanyPortfolio } from "../../components/CompanyPortfolio";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, Search, PlayCircle } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { State } from "../../components/ui";
import { ProcessPage, PartnersPage } from "./PublicContentPages";
import { Metadata } from "../../components/Metadata";
export function Home() {
  const hero = useApi<{ title: string; content: string; image: string } | null>(
    "/public/pages/hero",
  );
  const catalog = useApi("/public/services?featured=true&limit=8"),
    portfolio = useApi("/public/portfolio?featured=true&limit=4"),
    testimonials = useApi("/public/testimonials?limit=6");
  const services = catalog.data?.items ?? [];
  const projects = (portfolio.data?.items ?? []).map(mapPortfolio);
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">CREATIVE MEDIA AGENCY · FOR SME</span>
          <h1>
            {hero.data?.title || (
              <>
                Kết nối sáng tạo
                <br />
                <span>– Bứt phá nội dung</span>
              </>
            )}
          </h1>
          <p>
            {hero.data?.content ||
              "MediaHub đồng hành cùng doanh nghiệp từ yêu cầu và báo giá đến sản xuất, nghiệm thu và bàn giao nội dung."}
          </p>
          <div className="hero-actions">
            <Link to="/request-project" className="btn btn-primary">
              Đăng dự án ngay <ArrowRight size={17} />
            </Link>
            <Link to="/projects" className="btn btn-ghost">
              Xem dự án <PlayCircle size={17} />
            </Link>
          </div>
          <p>
            MediaHub quản lý dự án và chịu trách nhiệm về chất lượng sản phẩm
            cuối cùng.
          </p>
        </div>
        <div className="hero-visual">
          <div className="hero-orb" />
          <div className="hero-image">
            <img
              src={hero.data?.image || "/assets/project-1.png"}
              alt="Dự án sản xuất nội dung MediaHub"
            />
            <div className="image-overlay" />
          </div>
          <div className="float-card fc1">
            <span>✦</span>
            <b>Video Production</b>
            <small>Creative team</small>
          </div>
        </div>
      </section>
      <form className="search-strip" action="/projects">
        <div className="search-box">
          <Search />
          <input
            name="search"
            maxLength={100}
            aria-label="Tìm kiếm dự án"
            placeholder="Tìm dự án, thương hiệu, nội dung sáng tạo…"
          />
        </div>
        <button type="submit" className="btn btn-primary">
          Tìm kiếm <ArrowRight size={16} />
        </button>
      </form>
      <section className="feature-row">
        {[
          ["✦", "Creator chất lượng", "Được tuyển chọn và đánh giá"],
          ["◎", "Quy trình chuyên nghiệp", "MediaHub trực tiếp quản lý"],
          ["◈", "Chi phí hợp lý", "Tối ưu ngân sách SME"],
          ["✓", "Hỗ trợ tận tâm", "Đồng hành đến khi bàn giao"],
        ].map((x) => (
          <div className="feature" key={x[1]}>
            <span>{x[0]}</span>
            <div>
              <b>{x[1]}</b>
              <small>{x[2]}</small>
            </div>
          </div>
        ))}
      </section>
      <section className="section" id="services">
        <SectionTitle
          kicker="DỊCH VỤ"
          title="Giải pháp truyền thông trọn gói"
          sub="Một đầu mối. Một quy trình. Một sản phẩm được MediaHub chịu trách nhiệm đến cùng."
        />
        <State query={catalog}>
          <div className="service-grid">
            {services.map((s: any, i: number) => (
              <div className="service-card" key={s.id}>
                <span>0{i + 1}</span>
                <h3>{s.name}</h3>
                <p>{s.description}</p>
                <Link to="/request-project">
                  Đăng yêu cầu <ArrowRight size={15} />
                </Link>
              </div>
            ))}
          </div>
          {!services.length && <p>Chưa có dịch vụ.</p>}
        </State>
      </section>
      <section className="section" id="du-an">
        <SectionTitle
          kicker="DỰ ÁN NỔI BẬT"
          title="Những sản phẩm tạo dấu ấn"
          sub="Case study thực tế từ mạng lưới sáng tạo của MediaHub."
        />
        <State query={portfolio}>
          <div className="project-grid">
            {projects.map((p: any) => (
              <ProjectCard key={p.id} p={p} />
            ))}
          </div>
          {!projects.length && <p>Chưa có dự án công khai.</p>}
        </State>
        <div className="center">
          <Link className="btn btn-ghost" to="/projects">
            Xem tất cả dự án <ArrowRight size={16} />
          </Link>
        </div>
      </section>
      <ProcessPage embedded />
      <section className="section">
        <h2>Về MediaHub</h2>
        <p>
          MediaHub cung cấp dịch vụ truyền thông được quản lý xuyên suốt: làm rõ
          yêu cầu, xác nhận phạm vi và báo giá, tổ chức sản xuất, kiểm soát chất
          lượng và bàn giao. Khách hàng làm việc qua một đầu mối và theo dõi
          tiến độ trong không gian dự án.
        </p>
        <Link className="btn btn-ghost" to="/about">
          Tìm hiểu MediaHub
        </Link>
      </section>
      <PartnersPage embedded />
      <section className="section">
        <SectionTitle kicker="KHÁCH HÀNG" title="Đánh giá về MediaHub" />
        <State query={testimonials}>
          <div className="creator-grid">
            {(testimonials.data?.items ?? []).map((t: any) => (
              <div className="creator-card" key={t.id}>
                <p>{t.content}</p>
              </div>
            ))}
          </div>
          {!testimonials.data?.items.length && (
            <p>Chưa có đánh giá công khai.</p>
          )}
        </State>
      </section>
      <section className="cta">
        <div>
          <span className="eyebrow">FOR SMALL BUSINESS</span>
          <h2>
            Bạn có ý tưởng.
            <br />
            <span>MediaHub biến nó thành nội dung.</span>
          </h2>
          <p>
            Không cần ngân sách lớn để sở hữu một sản phẩm truyền thông chuyên
            nghiệp.
          </p>
        </div>
        <Link to="/request-project" className="btn btn-primary">
          Bắt đầu dự án <ArrowRight />
        </Link>
      </section>
    </>
  );
}
function SectionTitle({
  kicker,
  title,
  sub,
}: {
  kicker: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="section-title">
      <span className="eyebrow">{kicker}</span>
      <h2>{title}</h2>
      {sub && <p>{sub}</p>}
    </div>
  );
}
function ProjectCard({ p }: { p: any }) {
  return (
    <Link to={`/portfolio/${p.slug || p.id}`} className="project-card">
      <div className="project-img">
        <img
          src={p.image || "/assets/project-1.png"}
          alt={p.title}
          loading="lazy"
        />
        <span>{p.category}</span>
      </div>
      <div className="project-info">
        <div>
          <h3>{p.title}</h3>
          <p>{p.client}</p>
        </div>
      </div>
    </Link>
  );
}
function mapPortfolio(p: any) {
  return { ...p, image: p.image_url, desc: p.description };
}
export function Projects() { return <CompanyPortfolio/>; }
type PublicProject = {title:string;seo_title?:string;seo_description?:string;description?:string;category?:string;client?:string;industry?:string;year?:number;duration?:string;image_url?:string;challenge?:string;solution?:string;result?:string;deliverables?:string[];gallery?:string[]};
export function ProjectDetail() {
  const {id} = useParams();
  const query = useApi<PublicProject>(`/public/portfolio/${encodeURIComponent(id || "")}`);
  const p = query.data;
  return <main className="page section project-case-page"><nav className="project-case-breadcrumbs" aria-label="Đường dẫn"><Link to="/">Trang chủ</Link><span>/</span><Link to="/projects">Dự án</Link><span>/</span><span>Hồ sơ dự án</span></nav><State query={query}>{p && <>
    <Metadata title={p.seo_title || p.title} description={p.seo_description || p.description}/>
    <header className="project-case-heading"><div className="project-case-tags">{p.category && <span>{p.category}</span>}{p.client && <span>Khách hàng: {p.client}</span>}{p.year && <span>Năm thực hiện: {p.year}</span>}</div><h1>{p.title}</h1>{p.description && <p>{p.description}</p>}</header>
    {p.image_url && <figure className="project-case-showcase"><img src={p.image_url} alt={p.title}/><figcaption>Hồ sơ sản phẩm MediaHub · {p.category || "Dự án truyền thông"}</figcaption></figure>}
    <div className="project-case-layout"><article className="project-case-story">{([['challenge','Đề bài & thách thức'],['solution','Giải pháp & ý tưởng sáng tạo'],['result','Kết quả dự án']] as const).map(([key,title])=>p[key] && <section className="project-story-panel" key={key}><span className="eyebrow">{key==='challenge'?'THE BRIEF':key==='solution'?'CREATIVE CONCEPT':'RESULTS & IMPACT'}</span><h2>{title}</h2><p className="preserve-lines">{p[key]}</p></section>)}{Boolean(p.deliverables?.length) && <section className="project-story-panel"><span className="eyebrow">DELIVERABLES</span><h2>Sản phẩm bàn giao</h2><ul className="project-deliverable-list">{p.deliverables?.map(item=><li key={item}>{item}</li>)}</ul></section>}{Boolean(p.gallery?.length) && <section className="project-case-gallery"><h2>Hình ảnh dự án</h2><div>{p.gallery?.map((url,index)=><img src={url} key={`${url}-${index}`} alt={`${p.title} — ảnh ${index+1}`} loading="lazy"/>)}</div></section>}</article>
    <aside className="project-case-sidebar"><section className="project-story-panel"><h2>Thông tin dự án</h2><dl>{[['Khách hàng',p.client],['Dịch vụ',p.category],['Lĩnh vực',p.industry],['Năm thực hiện',p.year],['Thời gian',p.duration]].map(([name,value])=>value && <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl></section><section className="project-case-cta"><h2>Bạn muốn thực hiện dự án tương tự?</h2><p>Chia sẻ mục tiêu và ngân sách. Staff sẽ tư vấn phạm vi, đội Creator và báo giá phù hợp.</p><Link className="btn btn-primary" to="/request-project">Yêu cầu tư vấn <ArrowRight size={16}/></Link><Link className="btn btn-ghost" to="/services">Khám phá dịch vụ</Link><small>Gửi yêu cầu chưa phát sinh thanh toán.</small></section></aside></div>
    <div className="project-case-more"><h2>Khám phá thêm sản phẩm</h2><p>Xem các hồ sơ công khai và trích đoạn đã được duyệt.</p><Link className="btn btn-ghost" to="/projects">Xem tất cả dự án <ArrowRight size={16}/></Link></div>
  </>}</State></main>;
}
export function NotFound() {
  return (
    <div className="not-found">
      <h1>404</h1>
      <p>Trang bạn tìm không tồn tại.</p>
      <Link to="/" className="btn btn-primary">
        Về trang chủ
      </Link>
    </div>
  );
}
