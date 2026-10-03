import { Link, useParams } from "react-router-dom";
import { useApi } from "../../hooks/useApi";
import { State } from "../../components/ui";
type Partner = { id: string; name: string; logo: string; website: string; description: string; industry: string };

export function PartnerDetailPage() {
 const { id } = useParams(), query = useApi<Partner>(`/public/partners/${id}`), partner = query.data;
 const website = partner?.website && /^https?:\/\//i.test(partner.website) ? partner.website : null;
 return <section className="page section partner-detail"><Link to="/partners">← Đối tác MediaHub</Link><State query={query}>{partner && <>
  <header className="panel partner-detail-header">{partner.logo && <img className="partner-logo" src={partner.logo} alt={`Logo ${partner.name}`} />}<div><p className="eyebrow">ĐỐI TÁC MEDIAHUB</p><h1>{partner.name}</h1>{partner.industry && <p>{partner.industry}</p>}</div></header>
  <section className="panel"><h2>Thông tin hợp tác</h2><p className="preserve-lines">{partner.description || "Thông tin giới thiệu đang được cập nhật."}</p>{website && <a className="btn btn-ghost" href={website} target="_blank" rel="noopener noreferrer">Website chính thức ↗</a>}</section>
  <Link className="btn btn-primary" to="/request-project">Yêu cầu tư vấn dịch vụ</Link>
 </>}</State></section>;
}
