import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useApi } from "../../hooks/useApi";
import { State, Pagination, money } from "../../components/ui";
import { Metadata } from "../../components/Metadata";
import type { ServicePackage } from "../../types/requests";
import type { Collection, Service } from "./service.types";

export function Services() {
  const [page, setPage] = useState(1);
  const query = useApi<Collection<Service>>(`/public/services?page=${page}`);
  return (
    <section className="page section">
      <h1>Dịch vụ MediaHub</h1>
      <p>
        Chọn dịch vụ phù hợp để cùng xác định phạm vi, ngân sách và thời gian
        thực hiện.
      </p>
      <State query={query}>
        <div className="service-grid">
          {query.data?.items.map((service) => (
            <article className="service-card" key={service.id}>
              {service.thumbnail_url && (
                <img
                  className="catalog-image"
                  src={service.thumbnail_url}
                  alt={service.name}
                  loading="lazy"
                />
              )}
              <h2>
                <Link to={`/services/${service.slug}`}>{service.name}</Link>
              </h2>
              <p>{service.description}</p>
              <div className="service-card-meta">
                <div>
                  <small>Giá tham khảo</small>
                  <strong>
                    {service.starting_price == null
                      ? "Staff tư vấn báo giá"
                      : `Từ ${money(service.starting_price)}`}
                  </strong>
                </div>
                <div>
                  <small>Thời gian dự kiến</small>
                  <strong>
                    {service.estimated_days
                      ? `${service.estimated_days} ngày`
                      : "Theo phạm vi dự án"}
                  </strong>
                </div>
              </div>
              <div className="service-card-actions">
                <Link to={`/services/${service.slug}`}>Xem dịch vụ</Link>
                <Link
                  className="btn btn-primary"
                  to={`/request-project?service=${service.id}`}
                >
                  Yêu cầu tư vấn
                </Link>
              </div>
            </article>
          ))}
        </div>
        {!query.data?.items.length && <p>Chưa có dịch vụ được công bố.</p>}
        <Pagination
          page={page}
          total={query.data?.total ?? 0}
          onChange={setPage}
        />
      </State>
    </section>
  );
}
export function ServiceDetail() {
  const { slug } = useParams();
  const query = useApi<Service>(
    `/public/services/${encodeURIComponent(slug ?? "")}`,
  );
  const service = query.data;
  return (
    <section className="page section service-detail-page">
      <Link className="service-back" to="/services">
        ← Tất cả dịch vụ
      </Link>
      <State query={query}>
        {service && (
          <>
            <Metadata
              title={service.seo_title || service.name}
              description={
                service.seo_description || service.description || undefined
              }
            />
            <header className="service-detail-heading">
              <p className="eyebrow">
                {service.category || "DỊCH VỤ MEDIAHUB"}
              </p>
              <h1>{service.name}</h1>
              <p className="muted">
                MediaHub tư vấn, điều phối Creator và đồng hành từ yêu cầu đến
                bàn giao.
              </p>
            </header>
            <div className="service-detail-layout">
              <div className="service-detail-content">
                {service.thumbnail_url && (
                  <img
                    className="service-detail-image"
                    src={service.thumbnail_url}
                    alt={service.name}
                  />
                )}
                <section className="service-detail-block">
                  <h2>Giới thiệu dịch vụ</h2>
                  <p className="preserve-lines">
                    {service.description ||
                      "Trao đổi với Staff để xác định phương án phù hợp với nhu cầu của bạn."}
                  </p>
                </section>
                <div className="service-detail-inclusions">
                  {service.features?.length > 0 && (
                    <section className="service-detail-block">
                      <h2>Dịch vụ bao gồm</h2>
                      <ul>
                        {service.features.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </section>
                  )}
                  {service.deliverables?.length > 0 && (
                    <section className="service-detail-block">
                      <h2>Sản phẩm bàn giao</h2>
                      <ul>
                        {service.deliverables.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </section>
                  )}
                </div>
              </div>
              <aside className="service-quote-summary">
                <p className="eyebrow">DỰ KIẾN CHO DỊCH VỤ</p>
                <span>Giá tham khảo</span>
                <strong>
                  {service.starting_price == null
                    ? "Liên hệ tư vấn"
                    : `Từ ${money(service.starting_price)}`}
                </strong>
                {service.price_max != null &&
                  service.starting_price != null &&
                  service.price_max > service.starting_price && (
                    <p>Khoảng tham khảo đến {money(service.price_max)}</p>
                  )}
                <dl>
                  <div>
                    <dt>Thời gian dự kiến</dt>
                    <dd>
                      {service.estimated_days
                        ? `${service.estimated_days} ngày`
                        : "Theo phạm vi dự án"}
                    </dd>
                  </div>
                  <div>
                    <dt>Người đồng hành</dt>
                    <dd>Staff phụ trách riêng</dd>
                  </div>
                  <div>
                    <dt>Đặt cọc khi chốt</dt>
                    <dd>Tối thiểu 30%</dd>
                  </div>
                </dl>
                <p className="muted">
                  Giá và thời gian được Staff xác nhận trong báo giá theo brief,
                  số lượng sản phẩm và phạm vi chỉnh sửa.
                </p>
                <Link
                  className="btn btn-primary"
                  to={`/request-project?service=${service.id}`}
                >
                  Yêu cầu tư vấn dịch vụ
                </Link>
                <small>
                  Gửi yêu cầu chưa tạo đơn hàng hoặc phát sinh thanh toán.
                </small>
              </aside>
            </div>
            <ServicePackages serviceId={service.id} />
          </>
        )}
      </State>
    </section>
  );
}
function ServicePackages({ serviceId }: { serviceId: string }) {
  const query = useApi<ServicePackage[]>(
    `/public/services/${serviceId}/packages`,
  );
  return (
    <section className="section">
      <h2>Gói dịch vụ</h2>
      <p>Chọn gói tham khảo hoặc để MediaHub tư vấn theo brief.</p>
      <State query={query}>
        <div className="service-grid">
          {query.data?.map((pack) => (
            <article className="service-card" key={pack.id}>
              <h3>{pack.name}</h3>
              <p>{pack.description}</p>
              {pack.starting_price !== null && (
                <p>Tham khảo từ {money(pack.starting_price)}</p>
              )}
              {pack.estimated_days && <p>Dự kiến {pack.estimated_days} ngày</p>}
              <ul>
                {pack.deliverables.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <Link
                className="btn btn-primary"
                to={`/request-project?service=${serviceId}&package=${pack.id}`}
              >
                Chọn gói này
              </Link>
            </article>
          ))}
        </div>
        {!query.data?.length && (
          <p>Chưa có gói công bố. Bạn vẫn có thể gửi yêu cầu để nhận tư vấn.</p>
        )}
      </State>
    </section>
  );
}
