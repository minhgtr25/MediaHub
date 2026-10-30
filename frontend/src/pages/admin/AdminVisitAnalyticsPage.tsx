import { useState } from "react";
import { Page, State } from "../../components/ui";
import { useApi } from "../../hooks/useApi";

type Period = "day" | "week";
type VisitPoint = { start: string; real: number; demo: number };
type VisitReport = {
  period: Period;
  timezone: string;
  points: VisitPoint[];
  total_real: number;
  current_real: number;
  total_demo: number;
};

const number = new Intl.NumberFormat("vi-VN");
const shortDate = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "UTC",
  day: "2-digit",
  month: "2-digit",
});
const fullDate = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "UTC",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function label(day: string, full = false) {
  const date = new Date(`${day}T00:00:00Z`);
  return (full ? fullDate : shortDate).format(date);
}

export function AdminVisitAnalyticsPage() {
  const [period, setPeriod] = useState<Period>("day");
  const query = useApi<VisitReport>(`/admin/visit-analytics?period=${period}`);
  const points = query.data?.points ?? [];
  const maximum = Math.max(
    1,
    ...points.flatMap((point) => [point.real, point.demo]),
  );

  return (
    <Page title="Lượt truy cập website">
      <p className="visit-intro">
        Mỗi phiên truy cập được ghi một lần. Làm mới trang trong cùng phiên
        không tăng lượt. Ngày và tuần tính theo giờ Việt Nam.
      </p>
      <div className="visit-periods" aria-label="Khoảng thời gian">
        <button
          type="button"
          className={period === "day" ? "active" : ""}
          aria-pressed={period === "day"}
          onClick={() => setPeriod("day")}
        >
          Theo ngày · 30 ngày
        </button>
        <button
          type="button"
          className={period === "week" ? "active" : ""}
          aria-pressed={period === "week"}
          onClick={() => setPeriod("week")}
        >
          Theo tuần · 12 tuần
        </button>
      </div>
      <State query={query}>
        <div className="visit-metrics">
          <div className="panel">
            <small>Lượt thực trong kỳ</small>
            <strong>{number.format(query.data?.total_real ?? 0)}</strong>
          </div>
          <div className="panel">
            <small>{period === "day" ? "Hôm nay" : "Tuần này"}</small>
            <strong>{number.format(query.data?.current_real ?? 0)}</strong>
          </div>
          <div className="panel visit-demo-metric">
            <small>Dữ liệu minh họa trong kỳ</small>
            <strong>{number.format(query.data?.total_demo ?? 0)}</strong>
          </div>
        </div>
        <section className="panel visit-chart-panel">
          <div className="visit-chart-heading">
            <div>
              <h2>Biểu đồ lượt truy cập</h2>
              <p>Cột màu cam là lượt thực; cột màu xanh là dữ liệu minh họa.</p>
            </div>
            <div className="visit-legend" aria-hidden="true">
              <span>
                <i className="visit-real-key" /> Lượt thực
              </span>
              <span>
                <i className="visit-demo-key" /> Minh họa
              </span>
            </div>
          </div>
          <div className="visit-chart-scroll">
            <div
              className={`visit-chart ${period === "week" ? "visit-chart-week" : ""}`}
            >
              {points.map((point, index) => (
                <div
                  className="visit-chart-column"
                  key={point.start}
                  aria-label={`${period === "day" ? "Ngày" : "Tuần từ"} ${label(point.start, true)}: ${point.real} lượt thực, ${point.demo} lượt minh họa`}
                >
                  <div className="visit-chart-bars">
                    <span
                      className="visit-bar visit-bar-real"
                      style={{ height: `${(point.real / maximum) * 100}%` }}
                      title={`${number.format(point.real)} lượt thực`}
                    />
                    <span
                      className="visit-bar visit-bar-demo"
                      style={{ height: `${(point.demo / maximum) * 100}%` }}
                      title={`${number.format(point.demo)} lượt minh họa`}
                    />
                  </div>
                  <small>
                    {period === "week" ||
                    index % 5 === 0 ||
                    index === points.length - 1
                      ? label(point.start)
                      : ""}
                  </small>
                </div>
              ))}
            </div>
          </div>
          <p className="visit-sample-note">
            Dữ liệu minh họa được lưu riêng để xem trước biểu đồ và không cộng
            vào số liệu truy cập thực.
          </p>
        </section>
        <section className="panel table-wrap visit-table">
          <h2>Chi tiết {period === "day" ? "theo ngày" : "theo tuần"}</h2>
          <table>
            <thead>
              <tr>
                <th>{period === "day" ? "Ngày" : "Tuần bắt đầu"}</th>
                <th>Lượt thực</th>
                <th>Minh họa</th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((point) => (
                <tr key={point.start}>
                  <td>{label(point.start, true)}</td>
                  <td>{number.format(point.real)}</td>
                  <td>{number.format(point.demo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </State>
    </Page>
  );
}
