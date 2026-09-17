import { useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../../hooks/useApi";
import { State, Pagination, Page } from "../../components/ui";
type Collection<T> = { items: T[]; total: number };
type Setting = { key: string; title: string; content: string; image: string };
export function ContentPage({ name, title }: { name: string; title: string }) {
  const query = useApi<Setting | null>(`/public/pages/${name}`);
  return (
    <section className="page section">
      <State query={query}>
        <h1>{query.data?.title ?? title}</h1>
        {query.data ? (
          <>
            {query.data.image && (
              <img
                className="catalog-image"
                src={query.data.image}
                alt={query.data.title}
              />
            )}
            <article className="preserve-lines">{query.data.content}</article>
          </>
        ) : (
          <p>
            Nội dung chưa được công bố. Vui lòng liên hệ MediaHub để được hỗ
            trợ.
          </p>
        )}
        <Link className="btn btn-primary" to="/contact">
          Liên hệ MediaHub
        </Link>
      </State>
    </section>
  );
}
type Partner = {
  id: string;
  name: string;
  logo: string;
  website: string;
  description: string;
  industry: string;
};
export function PartnersPage({ embedded = false }: { embedded?: boolean }) {
  const [page, setPage] = useState(1);
  const query = useApi<Collection<Partner>>(`/public/partners?page=${page}`);
  if (embedded && !query.loading && !query.error && !query.data?.items.length)
    return null;
  return (
    <section className={embedded ? "section" : "page section"}>
      {embedded ? <h2>Đối tác MediaHub</h2> : <h1>Đối tác MediaHub</h1>}
      <State query={query}>
        <div className="service-grid">
          {query.data?.items.map((partner) => (
            <article className="service-card" key={partner.id}>
              {partner.logo && (
                <img
                  className="partner-logo"
                  src={partner.logo}
                  alt={partner.name}
                  loading="lazy"
                />
              )}
              <h2>{partner.name}</h2>
              <p>{partner.industry}</p>
              <p>{partner.description}</p>
              {partner.website && (
                <a
                  href={partner.website}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Website đối tác
                </a>
              )}
            </article>
          ))}
        </div>
        {!query.data?.items.length && <p>Chưa có đối tác được công bố.</p>}
        <Pagination
          page={page}
          total={query.data?.total ?? 0}
          onChange={setPage}
        />
      </State>
    </section>
  );
}
type Process = {
  id: string;
  title: string;
  description: string;
  step: number;
  image: string;
};
export function ProcessPage({ embedded = false }: { embedded?: boolean }) {
  const [page, setPage] = useState(1);
  const query = useApi<Collection<Process>>(`/public/process?page=${page}`);
  return (
    <section className={embedded ? "section" : "page section"}>
      {embedded ? <h2>Quy trình thực hiện</h2> : <h1>Quy trình thực hiện</h1>}
      <State query={query}>
        <div className="steps">
          {query.data?.items.map((step) => (
            <article className="step" key={step.id}>
              <span>{String(step.step).padStart(2, "0")}</span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
              {step.image && (
                <img
                  className="catalog-image"
                  src={step.image}
                  alt={step.title}
                  loading="lazy"
                />
              )}
            </article>
          ))}
        </div>
        {!query.data?.items.length && (
          <p>
            Liên hệ MediaHub để trao đổi quy trình phù hợp với dự án của bạn.
          </p>
        )}
        <Pagination
          page={page}
          total={query.data?.total ?? 0}
          onChange={setPage}
        />
      </State>
    </section>
  );
}
type Audit = {
  id: string;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string;
  created_at: string;
};
export function ActivityLogs() {
  const [page, setPage] = useState(1);
  const query = useApi<Collection<Audit>>(`/admin/activity-logs?page=${page}`);
  return (
    <Page title="Nhật ký hoạt động">
      <State query={query}>
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Người thực hiện</th>
                <th>Thao tác</th>
                <th>Đối tượng</th>
                <th>Mã</th>
                <th>Thời điểm</th>
              </tr>
            </thead>
            <tbody>
              {query.data?.items.map((row) => (
                <tr key={row.id}>
                  <td>{row.actor_id ?? "Hệ thống / API"}</td>
                  <td>{row.action}</td>
                  <td>{row.entity}</td>
                  <td>{row.entity_id}</td>
                  <td>{new Date(row.created_at).toLocaleString("vi-VN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!query.data?.items.length && <p>Chưa có hoạt động.</p>}
        <Pagination
          page={page}
          total={query.data?.total ?? 0}
          onChange={setPage}
        />
      </State>
    </Page>
  );
}
