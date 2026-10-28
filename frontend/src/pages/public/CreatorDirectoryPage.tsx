import { avatarPlaceholder } from "../../lib/avatar";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  MapPin,
  Search,
  ShieldCheck,
  Star,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { Pagination, State } from "../../components/ui";
import { useApi } from "../../hooks/useApi";
import { MessageCreator } from "./CreatorPublicActions";
import type {
  CreatorCollection,
  CreatorOption,
  PublicCreator,
} from "./creator-profile.types";

export function Creators() {
  const [params] = useSearchParams();
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(params.get("search") ?? ""),
    [category, setCategory] = useState(params.get("category") ?? ""),
    [priceMax, setPriceMax] = useState(params.get("price_max") ?? ""),
    [experience, setExperience] = useState(params.get("experience") ?? ""),
    [location, setLocation] = useState(params.get("location") ?? ""),
    [sort, setSort] = useState("recommended"),
    [availability, setAvailability] = useState("");
  const [applied, setApplied] = useState({
    search,
    category,
    priceMax,
    experience,
    location,
    sort,
    availability,
  });
  const apply = () => {
    setApplied({
      search,
      category,
      experience,
      location,
      sort,
      availability,
      priceMax,
    });
    setPage(1);
  };
  const options = useApi<{
    categories: CreatorOption[];
    skills: CreatorOption[];
    locations: string[];
    price_options: { value: number; label: string }[];
  }>("/public/creators/filters");
  const path = useMemo(() => {
    const p = new URLSearchParams({
      page: String(page),
      limit: "6",
      search: applied.search,
      sort: applied.sort,
    });
    for (const key of [
      "category",
      "experience",
      "location",
      "availability",
    ] as const)
      if (applied[key]) p.set(key, applied[key]);
    if (applied.priceMax) p.set("price_max", applied.priceMax);
    return `/public/creators?${p}`;
  }, [page, applied]);
  const query = useApi<CreatorCollection<PublicCreator>>(path);
  const change =
    (setter: (v: string) => void) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setter(e.target.value);
    };
  return (
    <main className="creator-page">
      <section className="creator-heading">
        <small>
          TRANG CHỦ / <b>TÌM CREATOR</b>
        </small>
        <div>
          <div>
            <h1>
              Khám phá <span>Creator trẻ &amp; Đội ngũ</span> Sáng tạo
            </h1>
            <p>
              Mạng lưới creator được định hướng, kiểm soát quy trình và chịu
              trách nhiệm sản phẩm cuối cùng bởi MediaHub.
            </p>
          </div>
          <div className="creator-proof">
            <strong>Portfolio</strong>
            <span>Xem năng lực thực tế</span>
            <strong>Tư vấn</strong>
            <span>Chọn creator phù hợp</span>
          </div>
        </div>
      </section>
      <form
        className="creator-filter"
        aria-label="Bộ lọc Creator"
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
      >
        <label className="creator-search">
          <Search size={18} />
          <input
            value={search}
            onChange={change(setSearch)}
            placeholder="Tìm kỹ năng, tên Creator, phần mềm…"
          />
        </label>
        <select
          aria-label="Chuyên môn"
          value={category}
          onChange={change(setCategory)}
        >
          <option value="">Tất cả chuyên môn</option>
          {options.data?.categories.map((x) => (
            <option key={x.id} value={x.slug}>
              {x.name}
            </option>
          ))}
        </select>
        <label className="location-filter">
          <MapPin size={16} />
          <select
            aria-label="Tỉnh thành"
            value={location}
            onChange={change(setLocation)}
          >
            <option value="">Tất cả tỉnh / thành</option>
            {options.data?.locations.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <select
          aria-label="Cấp độ"
          value={experience}
          onChange={change(setExperience)}
        >
          <option value="">Cấp độ &amp; Đội ngũ</option>
          <option value="STUDENT">Sinh viên</option>
          <option value="JUNIOR">Junior</option>
          <option value="MID">Middle</option>
          <option value="SENIOR">Senior</option>
          <option value="LEAD">Lead</option>
        </select>
        <select
          aria-label="Lịch nhận việc"
          value={availability}
          onChange={change(setAvailability)}
        >
          <option value="">Tất cả lịch nhận việc</option>
          <option value="AVAILABLE">Đang rảnh</option>
          <option value="LIMITED">Cần trao đổi lịch</option>
          <option value="BUSY">Đang bận/giữ chỗ</option>
          <option value="UNAVAILABLE">Tạm ngừng nhận việc</option>
        </select>
        <select
          aria-label="Mức giá tối đa"
          value={priceMax}
          onChange={(event) => setPriceMax(event.target.value)}
        >
          <option value="">Mọi mức giá</option>
          {options.data?.price_options.map((item) => (
            <option key={item.value} value={item.value}>
              Tối đa {item.label}
            </option>
          ))}
        </select>{" "}
        <button type="submit" className="btn btn-primary">
          Áp dụng <ArrowRight size={16} />
        </button>
        <div className="popular-filters">
          <span>Bộ lọc phổ biến:</span>
          {options.data?.categories.slice(0, 5).map((x) => (
            <button
              type="button"
              className={category === x.slug ? "active" : ""}
              onClick={() => {
                const next = category === x.slug ? "" : x.slug;
                setCategory(next);
                setApplied({
                  search,
                  category: next,
                  priceMax,
                  experience,
                  location,
                  sort,
                  availability,
                });
                setPage(1);
              }}
              key={x.id}
            >
              #{x.name.replaceAll(" ", "")}
            </button>
          ))}
          <label>
            Sắp xếp:{" "}
            <select value={sort} onChange={change(setSort)}>
              <option value="recommended">MediaHub đề xuất</option>
              <option value="rating">Đánh giá cao</option>
              <option value="projects">Nhiều dự án</option>
              <option value="price">Giá thấp trước</option>
            </select>
          </label>
        </div>
      </form>
      <section className="creator-results">
        <div className="results-meta">
          <span>
            Hiển thị {query.data?.items.length ?? 0} trong số{" "}
            <b>{query.data?.total ?? 0}</b> Creator
          </span>
          <span>
            <ShieldCheck size={15} /> Đảm bảo giao đúng cam kết &amp; nghiệm thu
            kỹ thuật
          </span>
        </div>
        <State query={query}>
          <div className="creator-market-grid">
            {query.data?.items.map((c) => (
              <CreatorCard key={c.id} creator={c} />
            ))}
          </div>
          {!query.data?.items.length && (
            <div className="creator-empty">
              <Search />
              <h2>Chưa tìm thấy Creator phù hợp</h2>
              <p>Hãy thử bỏ bớt bộ lọc hoặc tìm bằng kỹ năng khác.</p>
            </div>
          )}
          <Pagination
            page={page}
            total={query.data?.total ?? 0}
            limit={6}
            onChange={setPage}
          />
        </State>
      </section>
      <section className="creator-cta">
        <div>
          <small>QUY TRÌNH MANAGED AGENCY</small>
          <h2>Bạn chưa biết chọn Creator nào để tối ưu ngân sách?</h2>
          <p>
            Đội ngũ Account &amp; Art Director của MediaHub sẽ tư vấn và chịu
            trách nhiệm toàn diện từ A–Z.
          </p>
        </div>
        <Link className="btn btn-primary" to="/request-project">
          Gửi Brief nhận tư vấn miễn phí <ArrowRight />
        </Link>
      </section>
    </main>
  );
}
function CreatorCard({ creator: c }: { creator: PublicCreator }) {
  return (
    <article className={`market-card ${c.featured ? "lead" : ""}`}>
      {c.featured && <span className="lead-ribbon">★ MEDIAHUB ĐỀ XUẤT</span>}
      <header>
        <img
          src={c.avatar_url || avatarPlaceholder(c.display_name)}
          alt={c.display_name}
        />
        <div>
          <h2>
            {c.display_name} {c.verified && <BadgeCheck size={16} />}
          </h2>
          <p>{c.title}</p>
          <small>
            <MapPin size={12} />
            {c.location}
          </small>
        </div>
        {!c.is_showcase && (
          <span className="rating">
            <Star size={13} /> {c.rating ?? "Mới"}
            <small>{c.review_count} đánh giá đã xác minh</small>
          </span>
        )}
      </header>
      {c.is_showcase && (
        <p className="showcase-label">
          {c.is_demo
            ? "DỮ LIỆU MINH HỌA · HỒ SƠ GIỚI THIỆU"
            : "HỒ SƠ GIỚI THIỆU DO ADMIN QUẢN LÝ"}
        </p>
      )}
      {!c.is_showcase && (
        <p className="muted">
          {
            (
              {
                AVAILABLE: "Sẵn sàng nhận việc",
                LIMITED: "Cần trao đổi lịch",
                BUSY: "Đang nhận việc hoặc giữ chỗ",
                UNAVAILABLE: "Tạm ngừng nhận việc mới",
              } as Record<string, string>
            )[c.availability]
          }
        </p>
      )}
      <div className="skill-chips">
        {c.creator_skills.slice(0, 5).map((x) => (
          <span key={x.skills.id}>{x.skills.name}</span>
        ))}
      </div>
      <div className="portfolio-label">
        <span>Portfolio</span>
        <b>{c.creator_portfolio.length} sản phẩm công khai</b>
      </div>
      <div className="creator-thumbs">
        {c.creator_portfolio.slice(0, 3).map((p) =>
          p.thumbnail_url ? (
            <img
              key={p.id}
              src={p.thumbnail_url}
              alt={p.title}
              loading="lazy"
            />
          ) : (
            <div key={p.id} className="portfolio-image-placeholder">
              <Briefcase size={18} />
              <span>{p.title}</span>
            </div>
          ),
        )}
      </div>
      {!c.creator_portfolio.length && (
        <p className="muted">Chưa có sản phẩm portfolio công khai.</p>
      )}
      {!c.is_showcase && (
        <p className="muted">
          {c.completed_projects} đơn đã hoàn thành trên MediaHub
        </p>
      )}
      {!c.is_showcase && (
        <p className="creator-assurance">
          <ShieldCheck size={16} /> Staff tư vấn lịch làm việc và phạm vi trước
          khi chốt dịch vụ.
        </p>
      )}
      <footer>
        <Link className="btn btn-ghost" to={`/creators/${c.slug}`}>
          <Briefcase size={15} /> Xem Portfolio
        </Link>
        {!c.is_showcase && <MessageCreator creator={c} compact />}
      </footer>
    </article>
  );
}
