import { PublicationNameField } from "./OrderReviewPanel";
import { CreatorRoster } from "../../components/CreatorRoster";
import { useRef, useState } from "react";
import { ActionForm, Field, State, Status } from "../../components/ui";
import { useAuth } from "../../contexts/AuthContext";
import { useApi } from "../../hooks/useApi";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { post } from "../../services/api";
import { isCustomerRole } from "../../lib/permissions";
import { businessToday, quoteExpired } from "../../lib/commerce";
import type { OrderContract, OrderContracts } from "../../types/commerce";

export function OrderContractPanel({
  id,
  orderStatus,
  onChanged,
}: {
  id: string;
  orderStatus: string;
  onChanged: () => void;
}) {
  const { role } = useAuth(),
    customer = isCustomerRole(role),
    query = useApi<OrderContracts>(`/orders/${id}/contracts`, true);
  const waiting = orderStatus === "WAITING_CONTRACT",
    contracts = query.data?.contracts ?? [],
    draft = contracts.find((c) => c.status === "DRAFT");
  const pending = contracts.some((c) =>
    ["SENT", "VIEWED", "ACKNOWLEDGED"].includes(c.status),
  );
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
      aria-label="Há»£p Ä‘á»“ng vÃ  xÃ¡c nháº­n Ä‘iá»u khoáº£n"
    >
      <header>
        <h2>Há»£p Ä‘á»“ng &amp; Ä‘iá»u khoáº£n</h2>
        <button
          className="btn btn-ghost"
          disabled={query.loading}
          onClick={changed}
        >
          LÃ m má»›i Ä‘iá»u khoáº£n
        </button>
      </header>
      <p className="muted">
        XÃ¡c nháº­n trong á»©ng dá»¥ng lÆ°u phiÃªn báº£n vÃ  ná»™i dung báº¡n
        Ä‘Ã£ Ä‘á»c. Chá»¯ kÃ½ Ä‘iá»‡n tá»­ qua nhÃ  cung cáº¥p chÆ°a Ä‘Æ°á»£c
        tÃ­ch há»£p.
      </p>
      <State query={query}>
        {query.data?.acknowledgment && (
          <div className="contract-evidence">
            <strong>ÄÃ£ xÃ¡c nháº­n Ä‘iá»u khoáº£n trong á»©ng dá»¥ng</strong>
            <p>
              {new Date(
                query.data.acknowledgment.acknowledged_at,
              ).toLocaleString("vi-VN")}
            </p>
            <p className="muted">
              ÄÆ¡n chuyá»ƒn sang bÆ°á»›c thanh toÃ¡n. Viá»‡c xÃ¡c nháº­n Ä‘iá»u
              khoáº£n chÆ°a ghi nháº­n khoáº£n thu.
            </p>
          </div>
        )}
        {!contracts.length && (
          <p>
            {customer
              ? "NgÆ°á»i phá»¥ trÃ¡ch sáº½ gá»­i Ä‘iá»u khoáº£n cho Ä‘Ãºng bÃ¡o giÃ¡ Ä‘Ã£ cháº¥p nháº­n."
              : "ChÆ°a cÃ³ báº£n Ä‘iá»u khoáº£n cho Ä‘Æ¡n nÃ y."}
          </p>
        )}
        {contracts.map((contract, index) => (
          <ContractCard
            key={contract.id}
            contract={contract}
            id={id}
            customer={customer}
            active={waiting && index === 0}
            onChanged={changed}
          />
        ))}
        {!customer && waiting && !pending && (
          <details className="commerce-editor" open>
            <summary>
              {draft
                ? `Sá»­a báº£n nhÃ¡p Ä‘iá»u khoáº£n v${draft.version}`
                : "Chuáº©n bá»‹ phiÃªn báº£n Ä‘iá»u khoáº£n má»›i"}
            </summary>
            <ContractBuilder
              key={draft?.id ?? "new"}
              id={id}
              source={draft ?? contracts[0]}
              onChanged={changed}
            />
          </details>
        )}
      </State>
    </section>
  );
}
function ContractBuilder({
  id,
  source,
  onChanged,
}: {
  id: string;
  source?: OrderContract;
  onChanged: () => void;
}) {
  return (
    <ActionForm
      label="LÆ°u báº£n nhÃ¡p Ä‘iá»u khoáº£n"
      onSubmit={(form) =>
        post(`/orders/${id}/contract_save`, {
          title: form.get("contract-title"),
          content: form.get("contract-content"),
          valid_until: form.get("contract-valid-until"),
        })
      }
      onSuccess={onChanged}
    >
      <Field
        name="contract-title"
        label="TiÃªu Ä‘á» Ä‘iá»u khoáº£n"
        value={source?.title}
      />
      <div className="field">
        <label htmlFor="contract-content">
          Ná»™i dung Ä‘iá»u khoáº£n (gá»­i cho khÃ¡ch)
        </label>
        <textarea
          id="contract-content"
          name="contract-content"
          required
          maxLength={100000}
          rows={14}
          defaultValue={source?.content}
        />
      </div>
      <Field
        name="contract-valid-until"
        label="Háº¡n xÃ¡c nháº­n Ä‘iá»u khoáº£n"
        type="date"
        value={
          source?.valid_until && source.valid_until >= businessToday()
            ? source.valid_until
            : businessToday()
        }
      />
      <p className="muted">
        Kiá»ƒm tra pháº¡m vi, Ä‘áº§u ra, sá»‘ tiá»n vÃ  Ä‘iá»u kiá»‡n cá»§a
        Ä‘Ãºng bÃ¡o giÃ¡ Ä‘Ã£ Ä‘Æ°á»£c cháº¥p nháº­n trÆ°á»›c khi gá»­i. PhiÃªn
        báº£n Ä‘Ã£ gá»­i sáº½ Ä‘Æ°á»£c giá»¯ nguyÃªn.
      </p>
    </ActionForm>
  );
}
function ContractCard({
  contract: c,
  id,
  customer,
  active,
  onChanged,
}: {
  contract: OrderContract;
  id: string;
  customer: boolean;
  active: boolean;
  onChanged: () => void;
}) {
  const [viewError, setViewError] = useState(""),
    lock = useRef(false),
    expired = quoteExpired(c.valid_until),
    pending = ["SENT", "VIEWED"].includes(c.status);
  const action = (operation: string, extra = {}) =>
    post(`/orders/${id}/${operation}`, { contract_id: c.id, ...extra });
  async function viewed(open: boolean) {
    if (
      !open ||
      !customer ||
      !active ||
      c.status !== "SENT" ||
      expired ||
      lock.current
    )
      return;
    lock.current = true;
    setViewError("");
    try {
      await action("contract_view");
      onChanged();
    } catch (e) {
      setViewError((e as Error).message);
    } finally {
      lock.current = false;
    }
  }
  return (
    <article id={`contract-${c.id}`} className="quote-card">
      <header>
        <div>
          <strong>{c.title}</strong>
          <small>Äiá»u khoáº£n v{c.version}</small>
        </div>
        <Status value={c.status} />
      </header>
      <p>
        Háº¡n xÃ¡c nháº­n: {new Date(c.valid_until).toLocaleDateString("vi-VN")}
        {expired && " Â· ÄÃ£ qua háº¡n"}
      </p>
      <details
        onToggle={(event) => {
          void viewed(event.currentTarget.open);
        }}
      >
        <summary>Xem Ä‘iá»u khoáº£n v{c.version}</summary>
        <div className="contract-content preserve-lines">{c.content}</div>
        <CreatorRoster team={c.team_snapshot} />
        {c.response_reason && (
          <p className="quote-response">
            Pháº£n há»“i/lÃ½ do: {c.response_reason}
          </p>
        )}
        {viewError && (
          <p className="error" role="alert">
            {viewError}
          </p>
        )}
        {customer && active && pending && !expired && (
          <div className="quote-response-actions">
            <ActionForm
              label={`XÃ¡c nháº­n Ä‘iá»u khoáº£n v${c.version}`}
              onSubmit={async (form) => {
                await post(`/order-feedback/${id}/preference`, {
                  show_name: form.get("show_name") === "true",
                  notice_version: "EXCERPT_V1",
                });
                return action("contract_acknowledge", {
                  acknowledge: form.get(`acknowledge-${c.id}`) === "on",
                  content_hash: c.content_hash,
                });
              }}
              onSuccess={onChanged}
            >
              <PublicationNameField />
              <label className="contract-checkbox">
                <input type="checkbox" name={`acknowledge-${c.id}`} required />
                <span>
                  TÃ´i Ä‘Ã£ Ä‘á»c vÃ  Ä‘á»“ng Ã½ vá»›i ná»™i dung, Ä‘á»™i phá»¥
                  trÃ¡ch vÃ  pháº§n viá»‡c trong Ä‘iá»u khoáº£n phiÃªn báº£n{" "}
                  {c.version} hiá»ƒn thá»‹ á»Ÿ trÃªn.
                </span>
              </label>
            </ActionForm>
            <details>
              <summary>ChÆ°a Ä‘á»“ng Ã½ Ä‘iá»u khoáº£n</summary>
              <ActionForm
                label="Gá»­i pháº£n há»“i Ä‘iá»u khoáº£n"
                onSubmit={(form) =>
                  action("contract_reject", {
                    reason: form.get(`contract-reason-${c.id}`),
                  })
                }
                onSuccess={onChanged}
              >
                <Field
                  name={`contract-reason-${c.id}`}
                  label="Ná»™i dung cáº§n trao Ä‘á»•i vá» Ä‘iá»u khoáº£n"
                  type="textarea"
                />
              </ActionForm>
            </details>
          </div>
        )}
      </details>
      {!customer && active && (
        <div className="commerce-buttons">
          {c.status === "DRAFT" && (
            <ActionForm
              label={`Gá»­i Ä‘iá»u khoáº£n v${c.version}`}
              onSubmit={() => action("contract_send")}
              onSuccess={onChanged}
            />
          )}
          {pending && expired && (
            <ActionForm
              label="ÄÃ³ng Ä‘iá»u khoáº£n háº¿t háº¡n"
              onSubmit={() => action("contract_expire")}
              onSuccess={onChanged}
            />
          )}
          {["DRAFT", "SENT", "VIEWED"].includes(c.status) && (
            <details>
              <summary>Há»§y phiÃªn báº£n chÆ°a xÃ¡c nháº­n</summary>
              <ActionForm
                label="Há»§y phiÃªn báº£n Ä‘iá»u khoáº£n"
                onSubmit={(form) =>
                  action("contract_cancel", {
                    reason: form.get(`contract-cancel-${c.id}`),
                  })
                }
                onSuccess={onChanged}
              >
                <Field
                  name={`contract-cancel-${c.id}`}
                  label={
                    c.sent_at
                      ? "LÃ½ do há»§y (gá»­i cho khÃ¡ch)"
                      : "LÃ½ do há»§y báº£n nhÃ¡p (ná»™i bá»™)"
                  }
                  type="textarea"
                />
              </ActionForm>
            </details>
          )}
        </div>
      )}
    </article>
  );
}
export function OrderAssignment({
  id,
  status,
  assignee,
  onChanged,
}: {
  id: string;
  status: string;
  assignee: string;
  onChanged: () => void;
}) {
  const { role } = useAuth(),
    agents = useApi<{ id: string; full_name: string }[]>(
      ["ADMIN", "STAFF"].includes(role ?? "") ? "/requests/agents" : null,
    );
  if (
    !["ADMIN", "STAFF"].includes(role ?? "") ||
    ["COMPLETED", "CANCELLED", "REFUNDED"].includes(status)
  )
    return null;
  return (
    <details className="commerce-editor">
      <summary>Chuyá»ƒn ngÆ°á»i phá»¥ trÃ¡ch Ä‘Æ¡n</summary>
      <State query={agents}>
        <ActionForm
          label="LÆ°u ngÆ°á»i phá»¥ trÃ¡ch Ä‘Æ¡n"
          onSubmit={(form) =>
            post(`/orders/${id}/assign`, {
              assigned_to: form.get("order-assignee"),
              reason: form.get("order-assign-reason"),
            })
          }
          onSuccess={onChanged}
        >
          <div className="field">
            <label htmlFor="order-assignee">
              NhÃ¢n viÃªn phá»¥ trÃ¡ch má»›i
            </label>
            <select
              key={assignee}
              name="order-assignee"
              id="order-assignee"
              required
              defaultValue=""
            >
              <option value="">Chá»n nhÃ¢n viÃªn</option>
              {agents.data
                ?.filter((p) => p.id !== assignee)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
            </select>
          </div>
          <Field
            name="order-assign-reason"
            label="LÃ½ do chuyá»ƒn Ä‘Æ¡n (ná»™i bá»™)"
            type="textarea"
          />
        </ActionForm>
      </State>
    </details>
  );
}
