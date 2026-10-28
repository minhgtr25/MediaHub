import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useApi } from "../../hooks/useApi";
import {
  Page,
  State,
  ActionForm,
  Field,
  Pagination,
} from "../../components/ui";
import { api, post } from "../../services/api";
type Settings = {
  bank_name: string;
  account_number: string;
  account_name: string;
  qr_image: string;
  deposit_percent: number;
  enabled: boolean;
  instructions: string;
};
type Installment = {
  id: string;
  stage: string;
  amount: number;
  status: string;
  reference: string;
  transfer_note: string;
  paid_at: string | null;
};
type Plan = {
  id: string;
  total: number;
  deposit_percent: number;
  project: { id: string; title: string; status: string };
  installments: Installment[];
};
const money = (n: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    n,
  );
export function PaymentSettingsPage() {
  const q = useApi<Settings>("/payments/settings");
  const [qr, setQr] = useState<string | null>(null),
    [fileError, setFileError] = useState("");
  return (
    <Page title="Ngân hàng & QR thanh toán">
      <State query={q}>
        {q.data && (
          <section className="panel">
            <p>
              Cấu hình tài khoản nhận tiền, ảnh QR và tỷ lệ cọc mặc định. Mỗi dự
              án lưu riêng tỷ lệ tại thời điểm tạo lịch thanh toán.
            </p>
            <ActionForm
              onSubmit={(d) =>
                api("/payments/settings", {
                  method: "PUT",
                  body: JSON.stringify({
                    bank_name: d.get("bank_name"),
                    account_number: d.get("account_number"),
                    account_name: d.get("account_name"),
                    qr_image: qr ?? String(d.get("qr_image")),
                    deposit_percent: Number(d.get("deposit_percent")),
                    enabled: d.has("enabled"),
                    instructions: d.get("instructions"),
                  }),
                })
              }
              onSuccess={q.reload}
            >
              <Field
                name="bank_name"
                label="Ngân hàng"
                value={q.data.bank_name}
              />
              <Field
                name="account_number"
                label="Số tài khoản"
                value={q.data.account_number}
              />
              <Field
                name="account_name"
                label="Chủ tài khoản"
                value={q.data.account_name}
              />
              <label className="field">
                Tỷ lệ cọc (%)
                <input
                  type="number"
                  name="deposit_percent"
                  min={1}
                  max={99}
                  required
                  defaultValue={q.data.deposit_percent}
                />
              </label>
              <label className="field">
                URL ảnh QR (HTTPS)
                <input
                  name="qr_image"
                  defaultValue={
                    q.data.qr_image.startsWith("data:") ? "" : q.data.qr_image
                  }
                  onChange={() => setQr(null)}
                />
              </label>
              <label className="field">
                Hoặc tải QR PNG/JPEG/WebP (tối đa 400 KB)
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (
                      f.size > 400000 ||
                      !["image/png", "image/jpeg", "image/webp"].includes(
                        f.type,
                      )
                    ) {
                      setFileError(
                        "Chọn ảnh QR đúng định dạng, không quá 400 KB.",
                      );
                      return;
                    }
                    setFileError("");
                    const r = new FileReader();
                    r.onload = () => setQr(String(r.result));
                    r.readAsDataURL(f);
                  }}
                />
              </label>
              {fileError && <p role="alert">{fileError}</p>}
              {(qr ?? q.data.qr_image) && (
                <img
                  className="payment-qr"
                  src={qr ?? q.data.qr_image}
                  alt="QR nhận tiền"
                />
              )}
              <label className="field">
                Hướng dẫn
                <textarea
                  name="instructions"
                  defaultValue={q.data.instructions}
                  maxLength={1000}
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  name="enabled"
                  defaultChecked={q.data.enabled}
                />{" "}
                Kích hoạt chuyển khoản ngân hàng
              </label>
            </ActionForm>
          </section>
        )}
      </State>
    </Page>
  );
}
export function PaymentsPage() {
  const { role } = useAuth(),
    admin = role === "ADMIN";
  const [page, setPage] = useState(1);
  const q = useApi<{ items: Plan[]; total: number }>("/payments?page=" + page),
    settings = useApi<Settings>("/payments/settings"),
    projects = useApi<{ id: string; title: string }[]>(
      admin ? "/payments/eligible-projects" : null,
    );
  return (
    <Page title={admin ? "Quản lý cọc & thanh toán" : "Thanh toán dự án"}>
      {admin && (
        <details className="panel">
          <summary>Tạo lịch thanh toán từ báo giá đã chấp nhận</summary>
          <ActionForm
            label="Tạo 2 đợt thanh toán"
            onSubmit={(d) =>
              post("/payments/" + d.get("project_id") + "/create-plan", {
                deposit_percent: Number(d.get("deposit_percent")),
              })
            }
            onSuccess={q.reload}
          >
            <label className="field">
              Dự án
              <select name="project_id" required>
                <option value="">Chọn dự án</option>
                {projects.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Cọc trước (%)
              <input
                type="number"
                name="deposit_percent"
                min={1}
                max={99}
                defaultValue={settings.data?.deposit_percent ?? 30}
                required
              />
            </label>
          </ActionForm>
        </details>
      )}
      <State query={q}>
        {q.data?.items.map((plan) => (
          <section className="panel" key={plan.id}>
            <h2>{plan.project.title}</h2>
            <p>
              Tổng báo giá: <b>{money(plan.total)}</b> · Cọc{" "}
              {plan.deposit_percent}% · Còn lại {100 - plan.deposit_percent}%
              sau nghiệm thu
            </p>
            <div className="resource-grid">
              {[...plan.installments]
                .sort((a) => (a.stage === "DEPOSIT" ? -1 : 1))
                .map((item) => (
                  <article className="payment-card" key={item.id}>
                    <span className="eyebrow">
                      {item.stage === "DEPOSIT"
                        ? "ĐỢT 1 · TIỀN CỌC"
                        : "ĐỢT 2 · SAU NGHIỆM THU"}
                    </span>
                    <h2>{money(item.amount)}</h2>
                    <p>
                      {
                        (
                          {
                            PENDING: "Chưa thanh toán",
                            REPORTED: "Chờ admin kiểm tra",
                            PAID: "Đã xác nhận thanh toán",
                          } as Record<string, string>
                        )[item.status]
                      }
                    </p>
                    <p>
                      Nội dung chuyển khoản: <strong>{item.reference}</strong>
                    </p>
                    {item.transfer_note && (
                      <p>Thông tin giao dịch: {item.transfer_note}</p>
                    )}
                    {!admin &&
                      item.status === "PENDING" &&
                      settings.data?.enabled &&
                      (item.stage === "DEPOSIT" ||
                        plan.project.status === "COMPLETED") && (
                        <>
                          <img
                            className="payment-qr"
                            src={settings.data.qr_image}
                            alt="QR ngân hàng MediaHub"
                          />
                          <p>
                            {settings.data.bank_name} ·{" "}
                            {settings.data.account_number}
                            <br />
                            {settings.data.account_name}
                          </p>
                          <p>{settings.data.instructions}</p>
                          <p>
                            Nhập đúng số tiền và nội dung chuyển khoản ở trên
                            khi quét QR.
                          </p>
                          <ActionForm
                            label="Tôi đã chuyển khoản"
                            onSubmit={(d) =>
                              post("/payments/" + item.id + "/report", {
                                transfer_note: d.get("transfer_note"),
                              })
                            }
                            onSuccess={q.reload}
                          >
                            <Field
                              name="transfer_note"
                              label="Mã giao dịch / thời gian chuyển"
                            />
                          </ActionForm>
                        </>
                      )}
                    {!admin &&
                      !settings.data?.enabled &&
                      item.status === "PENDING" && (
                        <p>
                          Chưa có thông tin nhận tiền. Vui lòng liên hệ hỗ trợ.
                        </p>
                      )}
                    {!admin &&
                      item.stage === "BALANCE" &&
                      plan.project.status !== "COMPLETED" && (
                        <p>
                          Thanh toán đợt này được mở sau khi nghiệm thu dự án.
                        </p>
                      )}
                    {admin && item.status === "REPORTED" && (
                      <>
                        <ActionForm
                          label="Xác nhận đã nhận đủ tiền"
                          onSubmit={() => {
                            if (
                              !window.confirm(
                                "Bạn đã kiểm tra sao kê và nhận đúng số tiền này?",
                              )
                            )
                              throw Error("Chưa xác nhận.");
                            return post("/payments/" + item.id + "/confirm");
                          }}
                          onSuccess={q.reload}
                        />
                        <ActionForm
                          label="Chưa nhận được — yêu cầu kiểm tra"
                          onSubmit={() =>
                            post("/payments/" + item.id + "/reject")
                          }
                          onSuccess={q.reload}
                        />
                      </>
                    )}
                  </article>
                ))}
            </div>
          </section>
        ))}
        {!q.data?.items.length && (
          <div className="panel">
            Chưa có lịch thanh toán. Admin sẽ tạo lịch sau khi báo giá được chấp
            nhận.
          </div>
        )}
        <Pagination page={page} total={q.data?.total ?? 0} onChange={setPage} />
      </State>
    </Page>
  );
}
