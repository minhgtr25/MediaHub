import { useState } from "react";
import { Search, X } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { Page, State, Pagination, Status } from "../../components/ui";
import { date } from "../shared/DashboardPages";

type CustomerRow = {
  id: string;
  company_name: string | null;
  created_at: string;
  profiles: { full_name: string; email: string } | null;
};
type CustomerDetailsData = {
  customer: {
    profiles: { full_name: string; email: string; phone: string | null } | null;
  };
  projects: {
    total: number;
    items: { id: string; title: string; status: string }[];
  };
};

export function AdminCustomers() {
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState("");
  const query = useApi<{ items: CustomerRow[]; total: number }>(
    `/admin/customers?page=${page}&search=${encodeURIComponent(search)}`,
  );
  return (
    <Page title="Quản lý khách hàng">
      <p>Thông tin doanh nghiệp và lịch sử hợp tác.</p>
      <div className="toolbar">
        <div className="search-input">
          <Search size={18} />
          <input
            aria-label="Tìm khách hàng"
            placeholder="Tìm tên doanh nghiệp…"
            maxLength={100}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>
      <State query={query}>
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Khách hàng</th>
                <th>Doanh nghiệp</th>
                <th>Email</th>
                <th>Ngày tham gia</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {query.data?.items.map((c) => (
                <tr key={c.id}>
                  <td>
                    <b>{c.profiles?.full_name}</b>
                  </td>
                  <td>{c.company_name || "—"}</td>
                  <td>{c.profiles?.email}</td>
                  <td>{date(c.created_at)}</td>
                  <td>
                    <button
                      className="btn btn-ghost"
                      onClick={() => setSelected(c.id)}
                    >
                      Chi tiết
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!query.data?.items.length && (
            <div className="empty-state">Chưa có khách hàng phù hợp.</div>
          )}
        </div>
        <Pagination
          page={page}
          total={query.data?.total ?? 0}
          onChange={setPage}
        />
      </State>
      {selected && (
        <CustomerDetails
          key={selected}
          id={selected}
          close={() => setSelected("")}
        />
      )}
    </Page>
  );
}

function CustomerDetails({ id, close }: { id: string; close: () => void }) {
  const query = useApi<CustomerDetailsData>("/admin/customers/" + id);
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Thông tin khách hàng</h2>
        <button className="icon-btn" aria-label="Đóng chi tiết" onClick={close}>
          <X />
        </button>
      </div>
      <State query={query}>
        <h3>{query.data?.customer.profiles?.full_name}</h3>
        <p>
          {query.data?.customer.profiles?.email} ·{" "}
          {query.data?.customer.profiles?.phone || "Chưa có số điện thoại"}
        </p>
        <p>{query.data?.projects.total ?? 0} dự án</p>
        {query.data?.projects.items.map((p) => (
          <p key={p.id}>
            {p.title} · <Status value={p.status} />
          </p>
        ))}
      </State>
    </section>
  );
}
