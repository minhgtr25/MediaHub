import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ActionForm, Field, State, Status, money } from "../../components/ui";
import { useApi } from "../../hooks/useApi";
import { useAuth } from "../../contexts/AuthContext";
import { post } from "../../services/api";
import { businessToday, ordersHome, quoteExpired } from "../../lib/commerce";
import type { RequestQuote } from "../../types/commerce";
import { CreatorRoster } from "../../components/CreatorRoster";

type Services = { items: { id: string; name: string }[] };

export function QuoteCard({
  quote: q,
  id,
  customer,
  active,
  onChanged,
}: {
  quote: RequestQuote;
  id: string;
  customer: boolean;
  active: boolean;
  onChanged: () => void;
}) {
  const navigate = useNavigate(),
    { role } = useAuth(),
    [viewError, setViewError] = useState("");
  const viewLock = useRef(false),
    expired = quoteExpired(q.valid_until),
    awaiting = ["SENT", "VIEWED"].includes(q.status);
  const action = (operation: string, extra = {}) =>
    post(`/requests/${id}/commerce/${operation}`, { quote_id: q.id, ...extra });
  async function viewed(open: boolean) {
    if (
      !open ||
      !customer ||
      !active ||
      q.status !== "SENT" ||
      expired ||
      viewLock.current
    )
      return;
    viewLock.current = true;
    setViewError("");
    try {
      await action("quote_view");
      onChanged();
    } catch (e) {
      setViewError((e as Error).message);
    } finally {
      viewLock.current = false;
    }
  }
  return (
    <article id={`quote-${q.id}`} className="quote-card">
      <header>
        <div>
          <strong>Báo giá v{q.version}</strong>
          <small>{q.quotation_number}</small>
        </div>
        <Status value={q.status} />
      </header>
      <div className="quote-total">
        <strong>{money(q.total)}</strong>
        <span>
          Cọc theo báo giá: {money(q.deposit_amount)} · Phần còn lại:{" "}
          {money(q.remaining_amount)}
        </span>
      </div>
      <p>
        Hiệu lực đến {new Date(q.valid_until).toLocaleDateString("vi-VN")}
        {expired && " · Đã qua hạn"}
      </p>
      <details
        onToggle={(e) => {
          void viewed(e.currentTarget.open);
        }}
      >
        <summary>Xem hạng mục và điều kiện v{q.version}</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Hạng mục</th>
                <th>SL</th>
                <th>Đơn giá</th>
                <th>Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {q.items.map((i) => (
                <tr key={i.id}>
                  <td className="quote-description">{i.description}</td>
                  <td>{i.quantity}</td>
                  <td>{money(i.unit_price)}</td>
                  <td>{money(i.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="quote-breakdown">
          <dt>Tạm tính</dt>
          <dd>{money(q.subtotal)}</dd>
          <dt>Giảm giá</dt>
          <dd>{money(q.discount)}</dd>
          <dt>Thuế ({q.tax_rate}%)</dt>
          <dd>{money(q.tax)}</dd>
          <dt>Tổng cộng</dt>
          <dd>{money(q.total)}</dd>
          <dt>Tỷ lệ cọc</dt>
          <dd>{q.deposit_percent}%</dd>
        </dl>
        <CreatorRoster team={q.team_snapshot} />
        <h3>Phạm vi &amp; chính sách chỉnh sửa</h3>
        <p className="preserve-lines">{q.revision_policy}</p>
        {q.notes && <p className="preserve-lines">{q.notes}</p>}
        {q.response_reason && (
          <p className="quote-response">
            Phản hồi của khách: {q.response_reason}
          </p>
        )}
        {viewError && (
          <p className="error" role="alert">
            {viewError}
          </p>
        )}
        {customer && active && awaiting && !expired && (
          <div className="quote-response-actions">
            <ActionForm
              label={`Chấp nhận v${q.version} và tạo đơn`}
              onSubmit={async () => {
                const result = await post<{ order_id: string }>(
                  `/requests/${id}/commerce/quote_accept`,
                  { quote_id: q.id },
                );
                navigate(`${ordersHome(role)}/${result.order_id}`);
              }}
            />
            <details>
              <summary>Yêu cầu chỉnh báo giá</summary>
              <ActionForm
                label="Gửi yêu cầu chỉnh"
                onSubmit={(form) =>
                  action("quote_revise", { reason: form.get(`revise_${q.id}`) })
                }
                onSuccess={onChanged}
              >
                <Field
                  name={`revise_${q.id}`}
                  label="Nội dung cần chỉnh"
                  type="textarea"
                />
              </ActionForm>
            </details>
            <details>
              <summary>Từ chối báo giá</summary>
              <ActionForm
                label="Gửi lý do từ chối"
                onSubmit={(form) =>
                  action("quote_reject", {
                    reason: form.get(`quote_reject_${q.id}`),
                  })
                }
                onSuccess={onChanged}
              >
                <Field
                  name={`quote_reject_${q.id}`}
                  label="Lý do từ chối báo giá"
                  type="textarea"
                />
              </ActionForm>
            </details>
          </div>
        )}
      </details>
      {!customer && active && (
        <div className="commerce-buttons">
          {q.status === "DRAFT" && (
            <>
              <ActionForm
                label={`Gửi báo giá v${q.version}`}
                onSubmit={() => action("quote_send")}
                onSuccess={onChanged}
              />
              <ActionForm
                label="Hủy bản nháp"
                onSubmit={() => action("quote_cancel")}
                onSuccess={onChanged}
              />
            </>
          )}
          {awaiting && expired && (
            <ActionForm
              label="Đóng phiên bản hết hạn"
              onSubmit={() => action("quote_expire")}
              onSuccess={onChanged}
            />
          )}
        </div>
      )}
    </article>
  );
}
export function QuoteBuilder({
  id,
  serviceId,
  draft,
  onChanged,
}: {
  id: string;
  serviceId: string;
  draft?: RequestQuote;
  onChanged: () => void;
}) {
  const services = useApi<Services>("/public/services?limit=100");
  const [items, setItems] = useState(
    () =>
      draft?.items.map((i) => ({
        key: i.id,
        service_id: i.service_id,
        description: i.description,
        quantity: String(i.quantity),
        unit_price: String(i.unit_price),
      })) ?? [
        {
          key: crypto.randomUUID(),
          service_id: serviceId,
          description: "",
          quantity: "1",
          unit_price: "",
        },
      ],
  );
  const edit = (key: string, field: string, value: string) =>
    setItems((previous) =>
      previous.map((i) => (i.key === key ? { ...i, [field]: value } : i)),
    );
  return (
    <ActionForm
      label="Lưu bản nháp để kiểm tra"
      onSubmit={(form) =>
        post(`/requests/${id}/commerce/quote_save`, {
          items: items.map((i) => ({
            service_id: i.service_id,
            description: i.description,
            quantity: Number(i.quantity),
            unit_price: Number(i.unit_price),
          })),
          discount: Number(form.get("quote_discount")),
          tax_rate: Number(form.get("quote_tax")),
          deposit_percent: Number(form.get("quote_deposit")),
          valid_until: form.get("quote_valid_until"),
          revision_policy: form.get("quote_revisions"),
          notes: form.get("quote_notes") || "",
        })
      }
      onSuccess={onChanged}
    >
      <State query={services}>
        {items.map((i, index) => (
          <fieldset className="quote-item-editor" key={i.key}>
            <legend>Hạng mục {index + 1}</legend>
            <div className="field">
              <label htmlFor={`item-service-${i.key}`}>
                Dịch vụ hạng mục {index + 1}
              </label>
              <select
                id={`item-service-${i.key}`}
                required
                value={i.service_id}
                onChange={(e) => edit(i.key, "service_id", e.target.value)}
              >
                <option value="">Chọn dịch vụ</option>
                {services.data?.items.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor={`item-description-${i.key}`}>
                Phạm vi hạng mục {index + 1}
              </label>
              <textarea
                id={`item-description-${i.key}`}
                required
                maxLength={5000}
                value={i.description}
                onChange={(e) => edit(i.key, "description", e.target.value)}
              />
            </div>
            <div className="request-form-grid">
              <div className="field">
                <label htmlFor={`item-quantity-${i.key}`}>
                  Số lượng hạng mục {index + 1}
                </label>
                <input
                  id={`item-quantity-${i.key}`}
                  type="number"
                  required
                  min={1}
                  max={10000}
                  step={1}
                  value={i.quantity}
                  onChange={(e) => edit(i.key, "quantity", e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor={`item-price-${i.key}`}>
                  Đơn giá hạng mục {index + 1} (VND)
                </label>
                <input
                  id={`item-price-${i.key}`}
                  type="number"
                  required
                  min={0}
                  max={1e12}
                  step="0.01"
                  value={i.unit_price}
                  onChange={(e) => edit(i.key, "unit_price", e.target.value)}
                />
              </div>
            </div>
            {items.length > 1 && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() =>
                  setItems((previous) =>
                    previous.filter((item) => item.key !== i.key),
                  )
                }
              >
                Bỏ hạng mục {index + 1}
              </button>
            )}
          </fieldset>
        ))}
      </State>
      {items.length < 50 && (
        <button
          className="btn btn-ghost"
          type="button"
          onClick={() =>
            setItems((previous) => [
              ...previous,
              {
                key: crypto.randomUUID(),
                service_id: serviceId,
                description: "",
                quantity: "1",
                unit_price: "",
              },
            ])
          }
        >
          Thêm hạng mục
        </button>
      )}
      <div className="request-form-grid">
        <Field
          name="quote_discount"
          label="Giảm giá (VND)"
          type="number"
          value={draft?.discount ?? 0}
        />
        <Field
          name="quote_tax"
          label="Thuế (%)"
          type="number"
          value={draft?.tax_rate ?? 0}
        />
        <Field
          name="quote_deposit"
          label="Cọc theo báo giá (tối thiểu 30%)"
          type="number"
          value={draft?.deposit_percent ?? 30}
        />
        <Field
          name="quote_valid_until"
          label="Ngày hết hiệu lực"
          type="date"
          value={draft?.valid_until ?? businessToday()}
        />
      </div>
      <Field
        name="quote_revisions"
        label="Chính sách chỉnh sửa và đầu ra"
        type="textarea"
        value={draft?.revision_policy}
      />
      <Field
        name="quote_notes"
        label="Ghi chú báo giá (hiển thị cho khách)"
        type="textarea"
        required={false}
        value={draft?.notes}
      />
      <p className="muted">
        Tổng tiền và số tiền cọc được máy chủ tính khi lưu. Hãy kiểm tra bản
        nháp trước khi gửi cho khách.
      </p>
    </ActionForm>
  );
}
