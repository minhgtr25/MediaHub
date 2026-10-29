import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { State } from "./ui";
import type {
  CreatorCollection,
  PublicCreator,
} from "../pages/public/creator-profile.types";

export function FeaturedCreatorPortfolio() {
  const query = useApi<CreatorCollection<PublicCreator>>(
    "/public/creators?page=1&limit=48&sort=recommended",
  );
  const creators = query.data?.items ?? [];
  const projects = Array.from(
    {
      length: Math.max(
        0,
        ...creators.map((creator) => creator.creator_portfolio.length),
      ),
    },
    (_, index) =>
      creators.flatMap((creator) => {
        const project = creator.creator_portfolio[index];
        return project ? [{ creator, project }] : [];
      }),
  )
    .flat()
    .slice(0, 4);

  return (
    <section className="company-portfolio home-section" id="creator-projects">
      <header className="company-portfolio-heading">
        <div>
          <span className="eyebrow">PORTFOLIO CREATOR</span>
          <h2>Portfolio Creator nổi bật</h2>
          <p className="muted">
            Sản phẩm trong portfolio của các Creator. Mỗi dự án được ghi rõ là
            tác phẩm riêng hay được thực hiện cùng MediaHub.
          </p>
        </div>
        <Link className="btn btn-ghost" to="/creators">
          Xem hồ sơ Creator <ArrowRight />
        </Link>
      </header>
      <State query={query}>
        <div className="company-project-grid">
          {projects.map(({ creator, project }) => (
            <Link
              className="company-project-card"
              key={project.id}
              to={`/creators/${creator.slug}`}
            >
              <div className="company-project-image">
                {project.thumbnail_url && (
                  <img
                    src={project.thumbnail_url}
                    alt={project.title}
                    loading="lazy"
                    decoding="async"
                  />
                )}
              </div>
              <div className="company-project-content">
                <span className="eyebrow">
                  {project.client === "MediaHub"
                    ? "DỰ ÁN CÙNG MEDIAHUB"
                    : "DỰ ÁN RIÊNG CỦA CREATOR"}
                </span>
                <h3>{project.title}</h3>
                <p className="company-project-client">{creator.display_name}</p>
                <footer>
                  <span>
                    Xem portfolio <ArrowRight />
                  </span>
                </footer>
              </div>
            </Link>
          ))}
        </div>
        {!projects.length && <p>Chưa có portfolio Creator công khai.</p>}
      </State>
    </section>
  );
}
