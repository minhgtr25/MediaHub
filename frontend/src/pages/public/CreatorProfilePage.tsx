import { avatarPlaceholder } from "../../lib/avatar";
import { VerifiedCreatorReviews } from "../../components/VerifiedCreatorReviews";
import {
  ArrowLeft,
  BadgeCheck,
  Briefcase,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  GraduationCap,
  Languages,
  MapPin,
  ShieldCheck,
  Star,
  Wrench,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { money, State } from "../../components/ui";
import { useApi } from "../../hooks/useApi";
import { MessageCreator } from "./CreatorPublicActions";
import type { PublicCreatorDetail } from "./creator-profile.types";

export function CreatorProfile() {
  const { slug } = useParams();
  const query = useApi<PublicCreatorDetail>(
    slug ? `/public/creators/${encodeURIComponent(slug)}` : null,
  );
  const c = query.data;
  return (
    <main className="creator-profile-page">
      <Link className="creator-back" to="/creators">
        <ArrowLeft /> Quay lại danh sách Creator
      </Link>
      <State query={query}>
        {c && (
          <>
            <section className="creator-profile-hero">
              {c.is_showcase && (
                <p className="showcase-label">
                  {c.is_demo
                    ? "DỮ LIỆU MINH HỌA · HỒ SƠ GIỚI THIỆU"
                    : "HỒ SƠ GIỚI THIỆU DO ADMIN QUẢN LÝ · KHÔNG NHẬN YÊU CẦU TRỰC TIẾP"}
                </p>
              )}
              <div className="creator-cover">
                {(c.cover_url || c.creator_portfolio[0]?.thumbnail_url) && (
                  <img
                    src={c.cover_url || c.creator_portfolio[0]?.thumbnail_url}
                    alt={`Ảnh bìa hồ sơ ${c.display_name}`}
                  />
                )}
              </div>
              <div className="creator-identity">
                <img
                  src={c.avatar_url || avatarPlaceholder(c.display_name)}
                  alt={`Ảnh đại diện ${c.display_name}`}
                />
                <div>
                  {!c.is_showcase && (
                    <span className="creator-availability">
                      <i />
                      {
                        (
                          {
                            AVAILABLE: "Sẵn sàng nhận dự án",
                            LIMITED: "Cần trao đổi lịch",
                            BUSY: "Đang nhận việc hoặc giữ chỗ",
                            UNAVAILABLE: "Tạm ngừng nhận việc mới",
                          } as Record<string, string>
                        )[c.availability]
                      }
                    </span>
                  )}
                  <h1>
                    {c.display_name} {c.verified && <BadgeCheck />}
                  </h1>
                  <p>{c.title}</p>
                  <small>
                    <MapPin /> {c.location || "Làm việc từ xa"}
                  </small>
                </div>
                {!c.is_showcase && (
                  <div className="creator-profile-action">
                    <span>Chi phí tham khảo từ</span>
                    <strong>
                      {c.price_from ? money(c.price_from) : "Liên hệ"}
                    </strong>
                    <MessageCreator creator={c} />
                    <Link
                      className="btn btn-ghost"
                      to={`/request-project?creator=${c.id}`}
                    >
                      Gửi yêu cầu với creator này
                    </Link>
                  </div>
                )}
              </div>
            </section>
            {!c.is_showcase && (
              <section className="creator-profile-stats">
                <div>
                  <Star />
                  <strong>{c.rating ?? "Mới"}</strong>
                  <span>{c.review_count} đánh giá đã xác minh</span>
                </div>
                <div>
                  <Briefcase />
                  <strong>{c.completed_projects}</strong>
                  <span>Đơn hoàn thành trên MediaHub</span>
                </div>
                <div>
                  <CheckCircle2 />
                  <strong>
                    {c.verified ? "Đã xác minh" : "Xem portfolio"}
                  </strong>
                  <span>Hồ sơ năng lực</span>
                </div>
                <div>
                  <Clock3 />
                  <strong>Staff tư vấn</strong>
                  <span>Xác nhận lịch trước khi chốt</span>
                </div>
              </section>
            )}
            <div className="creator-profile-grid">
              <div className="creator-profile-main">
                <section>
                  <p className="profile-kicker">GIỚI THIỆU</p>
                  <h2>Về {c.display_name}</h2>
                  <p className="creator-bio">
                    {c.bio ||
                      "Creator thuộc mạng lưới MediaHub, sẵn sàng tham gia các dự án phù hợp với chuyên môn."}
                  </p>
                </section>
                <section>
                  <p className="profile-kicker">
                    SẢN PHẨM DO CREATOR CÔNG KHAI
                  </p>
                  <h2>Portfolio · {c.creator_portfolio.length} sản phẩm</h2>
                  {c.creator_portfolio.length ? (
                    <div className="creator-portfolio-grid">
                      {c.creator_portfolio.map((item) => (
                        <article key={item.id}>
                          {item.thumbnail_url ? (
                            <img src={item.thumbnail_url} alt={item.title} />
                          ) : (
                            <div className="portfolio-image-placeholder">
                              <Briefcase />
                              <span>Chưa có ảnh minh họa</span>
                            </div>
                          )}
                          <div>
                            <small>
                              {item.category ||
                                item.project_year ||
                                "Dự án sáng tạo"}
                            </small>
                            <h3>{item.title}</h3>
                            <p>{item.description}</p>
                            {item.project_url && (
                              <a
                                href={item.project_url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Xem dự án <ExternalLink />
                              </a>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="creator-empty">
                      <Briefcase />
                      <h3>Portfolio đang được cập nhật</h3>
                      <p>
                        Liên hệ MediaHub để nhận hồ sơ năng lực phù hợp với
                        brief của bạn.
                      </p>
                    </div>
                  )}
                </section>
                {!c.is_showcase && (
                  <VerifiedCreatorReviews key={c.slug} slug={c.slug} />
                )}
              </div>
              <aside className="creator-profile-side">
                <section>
                  <h2>Chuyên môn</h2>
                  <div className="skill-chips">
                    {c.creator_skills.map((x) => (
                      <span key={x.skills.id}>{x.skills.name}</span>
                    ))}
                  </div>
                  {c.creator_categories.length > 0 && (
                    <div className="profile-categories">
                      {c.creator_categories.map((x) => (
                        <span key={x.categories.id}>{x.categories.name}</span>
                      ))}
                    </div>
                  )}
                </section>
                <section>
                  <h2>Năng lực làm việc</h2>
                  <dl>
                    <div>
                      <dt>
                        <Wrench /> Công cụ
                      </dt>
                      <dd>{c.tools.join(", ") || "Theo yêu cầu dự án"}</dd>
                    </div>
                    <div>
                      <dt>
                        <Languages /> Ngôn ngữ
                      </dt>
                      <dd>{c.languages.join(", ")}</dd>
                    </div>
                    {(c.university || c.major) && (
                      <div>
                        <dt>
                          <GraduationCap /> Học vấn
                        </dt>
                        <dd>
                          {[c.university, c.major].filter(Boolean).join(" · ")}
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt>
                        <CircleDollarSign /> Cấp độ
                      </dt>
                      <dd>{c.experience_level}</dd>
                    </div>
                  </dl>
                </section>
                <section className="creator-trust">
                  <ShieldCheck />
                  <div>
                    <h2>MediaHub bảo chứng</h2>
                    <p>
                      {c.verified
                        ? "Hồ sơ có dấu xác minh MediaHub. Xem portfolio và trao đổi phạm vi trước khi đặt dịch vụ."
                        : "Xem portfolio và trao đổi với MediaHub để xác nhận năng lực phù hợp với yêu cầu của bạn."}
                    </p>
                  </div>
                </section>
              </aside>
            </div>
          </>
        )}
      </State>
    </main>
  );
}
