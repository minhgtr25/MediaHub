import { useState } from "react";
import { useApi } from "../../hooks/useApi";
import { Page, State, Pagination, Status, money } from "../../components/ui";
import { date } from "../shared/DashboardPages";

type RevenueData = {
  total_revenue: number;
  monthly_revenue: number;
  yearly_revenue: number;
  pending_payment: number;
  by_month: { label: string; value: number }[];
  by_service: { label: string; value: number }[];
};
type InvoiceRow = {
  id: string;
  invoice_number: string;
  amount: number;
  issued_at: string;
  status: string;
};

export function AdminRevenue() {
  const query = useApi<RevenueData>("/admin/revenue"),
    [page, setPage] = useState(1),
    invoices = useApi<{ items: InvoiceRow[]; total: number }>(
      "/admin/invoices?page=" + page,
    );
  return (
    <Page title="Doanh thu & Thanh toán">
      <p>Theo dõi doanh thu đã thu và các hóa đơn đang chờ thanh toán.</p>
      <State query={query}>
        <div className="kpi-grid">
          {[
            { label: "Tổng doanh thu", value: query.data?.total_revenue },
            { label: "Tháng hiện tại", value: query.data?.monthly_revenue },
            { label: "Năm hiện tại", value: query.data?.yearly_revenue },
            { label: "Chờ thanh toán", value: query.data?.pending_payment },
          ].map(({ label, value }) => (
            <div className="kpi" key={label}>
              <div>
                <small>{label}</small>
                <b>{money(value ?? 0)}</b>
              </div>
            </div>
          ))}
        </div>
        <div className="admin-grid">
          <section className="panel">
            <h2>Doanh thu theo tháng</h2>
            <div className="revenue-list">
              {query.data?.by_month.map((m) => (
                <div key={m.label}>
                  <span>{m.label}</span>
                  <meter
                    min={0}
                    max={Math.max(
                      1,
                      ...(query.data?.by_month ?? []).map((x) =>
                        Number(x.value),
                      ),
                    )}
                    value={Number(m.value)}
                    aria-label={`Doanh thu ${m.label}`}
                  />
                  <b>{money(m.value)}</b>
                </div>
              ))}
            </div>
            {!query.data?.by_month.length && <p>Chưa ghi nhận doanh thu.</p>}
          </section>
          <section className="panel">
            <h2>Theo dịch vụ</h2>
            {query.data?.by_service.map((s) => (
              <div className="panel-head" key={s.label}>
                <p>{s.label}</p>
                <b>{money(s.value)}</b>
              </div>
            ))}
            {!query.data?.by_service.length && <p>Chưa có dữ liệu dịch vụ.</p>}
          </section>
        </div>
      </State>
      <h2>Danh sách hóa đơn</h2>
      <State query={invoices}>
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Mã hóa đơn</th>
                <th>Số tiền</th>
                <th>Ngày tạo</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {invoices.data?.items.map((i) => (
                <tr key={i.id}>
                  <td>{i.invoice_number}</td>
                  <td>{money(i.amount)}</td>
                  <td>{date(i.issued_at)}</td>
                  <td>
                    <Status value={i.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!invoices.data?.items.length && (
            <div className="empty-state">Chưa có hóa đơn.</div>
          )}
        </div>
        <Pagination
          page={page}
          total={invoices.data?.total ?? 0}
          onChange={setPage}
        />
      </State>
    </Page>
  );
}
