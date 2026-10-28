import { useState } from "react";
import { Link } from "react-router-dom";
import { ActionForm, Field, State, Status, money } from "../../components/ui";
import { useApi } from "../../hooks/useApi";
import { post } from "../../services/api";
import type { Proposal } from "../../types/commerce";
import { InlineCreatorProfile } from "../../components/InlineCreatorProfile";

export function ProposalCard({
  proposal: p,
  id,
  customer,
  locked,
  selected,
  onChanged,
}: {
  proposal: Proposal;
  id: string;
  customer: boolean;
  locked: boolean;
  selected: boolean;
  onChanged: () => void;
}) {
  const available = ["PROPOSED", "SHORTLISTED", "SELECTED"].includes(p.status),
    action = (operation: string, extra = {}) =>
      post(`/requests/${id}/commerce/${operation}`, {
        proposal_id: p.id,
        ...extra,
      });
  return (
    <article id={`proposal-${p.id}`} className="proposal-card">
      <div className="proposal-person">
        <div className="avatar-initials" aria-hidden="true">
          {p.creator_snapshot.display_name.slice(0, 1)}
        </div>
        <div>
          <Link to={`/creators/${p.creator_snapshot.slug}`}>
            <strong>{p.creator_snapshot.display_name}</strong>
          </Link>
          <p>{p.creator_snapshot.title}</p>
        </div>
      </div>
      <Status value={p.status} />
      <p className="preserve-lines">{p.reason}</p>
      <dl>
        <dt>Giá dự kiến</dt>
        <dd>
          {p.estimated_price === null
            ? "Cần trao đổi"
            : money(p.estimated_price)}
        </dd>
        <dt>Thời gian dự kiến</dt>
        <dd>
          {p.estimated_days === null
            ? "Cần xác nhận"
            : `${p.estimated_days} ngày`}
        </dd>
      </dl>
      {p.response_note && <p>Phản hồi: {p.response_note}</p>}
      <InlineCreatorProfile slug={p.creator_snapshot.slug} />
      {selected && <p className="muted">Đã chọn trong đội thực hiện.</p>}
      {available && !locked && (
        <>
          {customer ? (
            <>
              <div className="commerce-buttons">
                {p.status === "PROPOSED" && (
                  <ActionForm
                    label="Lưu cân nhắc"
                    showSuccess={false}
                    onSubmit={() => action("proposal_shortlist")}
                    onSuccess={onChanged}
                  />
                )}
                {!selected && (
                  <ActionForm
                    label="Chọn vào đội"
                    showSuccess={false}
                    onSubmit={() =>
                      post(`/requests/${id}/team/select`, { proposal_id: p.id })
                    }
                    onSuccess={onChanged}
                  />
                )}
              </div>
              <details hidden={selected}>
                <summary>Từ chối đề xuất</summary>
                <ActionForm
                  label="Gửi phản hồi"
                  onSubmit={(form) =>
                    action("proposal_reject", {
                      reason: form.get(`reject_${p.id}`),
                    })
                  }
                  onSuccess={onChanged}
                >
                  <Field
                    name={`reject_${p.id}`}
                    label="Lý do từ chối creator"
                    type="textarea"
                  />
                </ActionForm>
              </details>
            </>
          ) : (
            <ActionForm
              label="Thu hồi đề xuất"
              onSubmit={() => action("proposal_withdraw")}
              onSuccess={onChanged}
            />
          )}
        </>
      )}
    </article>
  );
}
export function ProposalBuilder({
  id,
  onChanged,
}: {
  id: string;
  onChanged: () => void;
}) {
  const [search, setSearch] = useState(""),
    [selected, setSelected] = useState("");
  const creators = useApi<{
    items: { id: string; display_name: string; title: string }[];
  }>(`/requests/${id}/team/available?${new URLSearchParams({ search })}`);
  return (
    <ActionForm
      label="Gửi đề xuất"
      onSubmit={(form) =>
        post(`/requests/${id}/commerce/propose`, {
          creator_id: selected,
          reason: form.get("proposal_reason"),
          estimated_price: form.get("proposal_price")
            ? Number(form.get("proposal_price"))
            : null,
          estimated_days: form.get("proposal_days")
            ? Number(form.get("proposal_days"))
            : null,
        })
      }
      onSuccess={onChanged}
    >
      <div className="field">
        <label htmlFor="proposal-search">Tìm creator theo tên</label>
        <input
          id="proposal-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <State query={creators}>
        <div className="field">
          <label htmlFor="proposal-creator">Creator phù hợp</label>
          <select
            id="proposal-creator"
            required
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Chọn creator</option>
            {creators.data?.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name} · {c.title}
              </option>
            ))}
          </select>
        </div>
      </State>
      <Field
        name="proposal_reason"
        label="Lý do phù hợp (gửi cho khách)"
        type="textarea"
      />
      <div className="request-form-grid">
        <Field
          name="proposal_price"
          label="Giá dự kiến (VND, có thể bỏ trống)"
          type="number"
          required={false}
        />
        <Field
          name="proposal_days"
          label="Số ngày dự kiến (có thể bỏ trống)"
          type="number"
          required={false}
        />
      </div>
    </ActionForm>
  );
}
