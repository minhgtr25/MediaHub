import { useOrderUpdates } from "../../hooks/useOrderUpdates";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { ActionForm, Field, State, money } from "../../components/ui";
import { useAuth } from "../../contexts/AuthContext";
import { useApi } from "../../hooks/useApi";
import { post } from "../../services/api";
import { isCustomerRole } from "../../lib/permissions";
import type { OrderPayments } from "../../types/commerce";
import { PaymentBuilder, PaymentCard } from "./OrderPaymentForms";

export function OrderPaymentPanel({
  id,
  onChanged,
}: {
  id: string;
  onChanged: () => void;
}) {
  const { role } = useAuth(),
    customer = isCustomerRole(role),
    query = useApi<OrderPayments>(`/orders/${id}/payments`, true),
    data = query.data;
  useOrderUpdates(id, query.reload);
  useAutoRefresh(
    () => {
      query.reload();
      onChanged();
    },
    { intervalMs: 45000, resetKey: id },
  );
  const changed = () => {
    query.reload();
    onChanged();
  };
  return (
    <section
      className="panel contract-panel"
      id="payments"
      aria-label="Thanh toán theo đơn"
    >
      <header>
        <h2>Thanh toán theo đơn</h2>
        <button
          className="btn btn-ghost"
          disabled={query.loading}
          onClick={changed}
        >
          Làm mới thanh toán
        </button>
      </header>
      <State query={query}>
        {data && (
          <>
            <div className="payment-summary">
              <div>
                <span>Giá trị đơn</span>
                <strong>{money(data.total)}</strong>
              </div>
              <div>
                <span>Đã thu và xác minh</span>
                <strong>{money(data.collected)}</strong>
              </div>
              <div>
                <span>Còn phải thu</span>
                <strong>{money(data.remaining)}</strong>
              </div>
              <div>
                <span>Yêu cầu đang mở</span>
                <strong>{money(data.pending)}</strong>
              </div>
            </div>
            <p className="muted">
              Báo đã chuyển khoản cần người phụ trách/Admin đối soát. Đơn được
              xác nhận khi khoản nhận đã xác minh đạt{" "}
              {money(data.required_to_confirm)} theo điều kiện báo giá.
            </p>
            {!data.payment_eligible && (
              <p>
                Đơn chưa đủ điều kiện phát hành yêu cầu thu hoặc đã đóng. Hồ sơ
                thanh toán đã có vẫn được lưu để tra cứu.
              </p>
            )}
            {data.payment_eligible && !data.bank_configured && (
              <p className="notice">
                Người phụ trách/Admin cần cấu hình tài khoản nhận tiền trước khi
                phát hành yêu cầu thu mới.
              </p>
            )}
            {data.payments.map((p) => (
              <PaymentCard
                key={p.id}
                id={id}
                payment={p}
                customer={customer}
                admin={role === "ADMIN" || role === "STAFF"}
                active={data.payment_eligible}
                bankEnabled={data.bank_enabled}
                receipt={data.receipts.find(
                  (r) => r.payment_request_id === p.id,
                )}
                onChanged={changed}
              />
            ))}
            {!data.payments.length && (
              <p>Chưa có yêu cầu thanh toán cho đơn này.</p>
            )}
            {data.final_funds ? (
              <p className="contract-evidence">
                Người phụ trách đã xác nhận thu đủ lúc{" "}
                {new Date(data.final_funds.confirmed_at).toLocaleString(
                  "vi-VN",
                )}
                . Creator có thể bàn giao bản hoàn thiện sau khi nghiệm thu.
              </p>
            ) : (
              data.can_confirm_final && (
                <details>
                  <summary>Xác nhận đã thu đủ toàn bộ giá trị đơn</summary>
                  <ActionForm
                    label="Xác nhận thu đủ"
                    onSubmit={(f) =>
                      post(`/orders/${id}/final-funds`, {
                        verified: f.get("final-funds-verified") === "on",
                        note: f.get("final-funds-note"),
                      })
                    }
                    onSuccess={changed}
                  >
                    <Field
                      name="final-funds-note"
                      label="Ghi chú đối chiếu nội bộ"
                      type="textarea"
                    />
                    <label className="contract-checkbox">
                      <input
                        type="checkbox"
                        name="final-funds-verified"
                        required
                      />
                      <span>
                        Tôi đã đối chiếu toàn bộ khoản thực nhận với giá trị
                        đơn. Khách đã thanh toán đủ.
                      </span>
                    </label>
                  </ActionForm>
                </details>
              )
            )}

            {!customer &&
              data.payment_eligible &&
              data.bank_configured &&
              data.available > 0 && (
                <PaymentBuilder
                  id={id}
                  available={data.available}
                  collected={data.collected}
                  pending={data.pending}
                  onChanged={changed}
                />
              )}
          </>
        )}
      </State>
    </section>
  );
}
