import { useApi } from "../hooks/useApi";
import { money, State } from "./ui";

type BillReport = {
  total: number;
  count: number;
  by_month: { label: string; value: number }[];
  items: {
    source_key: string;
    amount: number;
    received_at: string;
    bank_transaction_reference: string | null;
  }[];
};

export function MediaHubMvBillPanel() {
  const query = useApi<BillReport>("/admin/mediahub-mv-bills");
  const max = Math.max(
    1,
    ...(query.data?.by_month ?? []).map((m) => Number(m.value)),
  );
  return (
    <section className="panel">
      <h2>Khoản thu theo bill của 3 MV MediaHub</h2>
      <p>
        Gộp các bill có nội dung chuyển khoản “Dao Hoa” do Admin cung cấp. Chưa
        phân bổ từng khoản cho từng MV; các khoản này không phải hóa đơn trên hệ
        thống.
      </p>
      <State query={query}>
        <div className="panel-head">
          <b>Tổng {query.data?.count ?? 0} khoản</b>
          <b>{money(query.data?.total ?? 0)}</b>
        </div>
        <div className="revenue-list">
          {query.data?.by_month.map((month) => (
            <div key={month.label}>
              <span>{month.label}</span>
              <meter
                min={0}
                max={max}
                value={Number(month.value)}
                aria-label={`Khoản thu theo bill tháng ${month.label}`}
              />
              <b>{money(month.value)}</b>
            </div>
          ))}
        </div>
        {Boolean(query.data?.items.length) && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ngày nhận</th>
                  <th>Số tiền</th>
                  <th>Mã giao dịch</th>
                </tr>
              </thead>
              <tbody>
                {query.data?.items.map((bill) => (
                  <tr key={bill.source_key}>
                    <td>
                      {new Date(bill.received_at).toLocaleString("vi-VN", {
                        timeZone: "Asia/Ho_Chi_Minh",
                      })}
                    </td>
                    <td>{money(bill.amount)}</td>
                    <td>
                      {bill.bank_transaction_reference || "Chưa có trên ảnh"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </State>
    </section>
  );
}
