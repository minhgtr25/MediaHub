import { useState, type ReactNode } from "react";
import { ActionForm, Field, Pagination, State } from "../../components/ui";
import { useAuth } from "../../contexts/AuthContext";
import { useApi } from "../../hooks/useApi";
import {
  notifyOrderUpdated,
  useOrderUpdates,
} from "../../hooks/useOrderUpdates";
import { post } from "../../services/api";
import { isCustomerRole } from "../../lib/permissions";
import { parties, statuses } from "./execution-shared";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { useIdempotencyKey } from "../../hooks/useIdempotencyKey";
import { ReplacementBuilder, DelayDecision } from "./ExecutionActions";
import type { Delay, Member } from "./execution.types";
type Invite = {
  id: string;
  creator_snapshot: { display_name: string };
  work_scope: string;
  deadline: string;
  expires_at: string;
  effective_status: string;
};
type Replacement = {
  id: string;
  reason: string;
  status: string;
  response_note: string | null;
  old_snapshot: { creator: { display_name: string } };
  invites: Invite[];
};
type Execution = {
  responsible_creators: Pick<Member, "creator_id" | "display_name">[];
  team: Member[];
  replacements: Replacement[];
  delays: Delay[];
  replacement_count: number;
  delay_count: number;
  page: number;
  can_change: boolean;
  has_project: boolean;
  deadline: string | null;
};
function PartyField({ name = "responsibility" }: { name?: string }) {
  return (
    <label className="field">
      BÃªn liÃªn quan
      <select name={name} required defaultValue="UNDETERMINED">
        {Object.entries(parties).map(([v, label]) => (
          <option key={v} value={v}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
export function ExecutionPanel({
  id,
  onChanged,
  active = true,
}: {
  id: string;
  onChanged: () => void;
  active?: boolean;
}) {
  const { role } = useAuth(),
    customer = isCustomerRole(role),
    operator = ["STAFF", "ADMIN"].includes(role || ""),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    query = useApi<Execution>(`/execution/${id}?page=${page}`),
    intent = useIdempotencyKey();
  useAutoRefresh(query.reload, { intervalMs: 15000, enabled: active });
  useOrderUpdates(id, query.reload);
  const changed = () => {
    notifyOrderUpdated(id);
    onChanged();
  };
  const action = (op: string, input: Record<string, unknown>) =>
    post(`/execution/${id}/${op}`, input);
  return (
    <section className="panel contract-panel" id="execution">
      <header>
        <h2>Äiá»u phá»‘i &amp; lá»‹ch</h2>
        <button
          className="btn btn-ghost"
          disabled={query.loading}
          onClick={changed}
        >
          LÃ m má»›i
        </button>
      </header>
      <State query={query}>
        {query.data && (
          <>
            <h3>Äá»™i Ä‘ang phá»¥ trÃ¡ch</h3>
            <p>
              Háº¡n dá»± Ã¡n hiá»‡n táº¡i:{" "}
              {query.data.deadline || "Staff chÆ°a chá»‘t lá»‹ch"}
            </p>
            {query.data.team.map((m) => (
              <article className="team-progress" key={m.assignment_id}>
                <strong>{m.display_name}</strong>
                <p className="preserve-lines">{m.work_scope}</p>
                <p>Háº¡n pháº§n viá»‡c: {m.deadline || "ChÆ°a cÃ³"}</p>
              </article>
            ))}
            {customer && query.data.can_change && (
              <details>
                <summary>YÃªu cáº§u Ä‘á»•i Creator</summary>
                <p>
                  NgÆ°á»i hiá»‡n táº¡i tiáº¿p tá»¥c phá»¥ trÃ¡ch Ä‘áº¿n khi
                  ngÆ°á»i thay tháº¿ xÃ¡c nháº­n. Má»i thay Ä‘á»•i giÃ¡ hoáº·c
                  pháº¡m vi Ä‘Æ°á»£c chá»‘t riÃªng á»Ÿ PhÃ¡t sinh.
                </p>
                <ActionForm
                  key={revision}
                  label="Gá»­i yÃªu cáº§u Ä‘á»•i"
                  onSubmit={(f) => {
                    const input = {
                      assignment_id: f.get("assignment_id"),
                      reason: f.get("reason"),
                    };
                    return action("replacement_request", {
                      ...input,
                      idempotency_key: intent([revision, input]),
                    });
                  }}
                  onSuccess={() => {
                    setRevision((v) => v + 1);
                    changed();
                  }}
                >
                  <label className="field">
                    NgÆ°á»i cáº§n thay tháº¿
                    <select required name="assignment_id">
                      <option value="">Chá»n Creator</option>
                      {query
                        .data!.team.filter((m) => m.status === "ACCEPTED")
                        .map((m) => (
                          <option key={m.assignment_id} value={m.assignment_id}>
                            {m.display_name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <Field
                    name="reason"
                    label="LÃ½ do vÃ  mong muá»‘n (Customer, Staff xem)"
                    type="textarea"
                    maxLength={2000}
                  />
                </ActionForm>
              </details>
            )}
            {query.data.replacements.map((v) => (
              <article className="quote-version" key={v.id}>
                <h3>Äá»•i {v.old_snapshot.creator.display_name}</h3>
                <span className="status">{statuses[v.status]}</span>
                <p className="preserve-lines">{v.reason}</p>
                {v.response_note && (
                  <p>Staff/Customer pháº£n há»“i: {v.response_note}</p>
                )}
                {v.invites.map((i) => (
                  <article key={i.id}>
                    <strong>
                      {i.creator_snapshot.display_name} Â·{" "}
                      {statuses[i.effective_status]}
                    </strong>
                    <p>
                      {i.work_scope} Â· Háº¡n {i.deadline}
                    </p>
                    <small>
                      Giá»¯ chá»— Ä‘áº¿n{" "}
                      {new Date(i.expires_at).toLocaleString("vi-VN")}
                    </small>
                  </article>
                ))}
                {["REQUESTED", "INVITED"].includes(v.status) &&
                  query.data!.can_change && (
                    <>
                      {operator && (
                        <LazyDetails label="PhÃª duyá»‡t vÃ  má»i ngÆ°á»i thay tháº¿">
                          <ReplacementBuilder
                            id={id}
                            replacementId={v.id}
                            deadline={query.data!.deadline}
                            onChanged={changed}
                          />
                        </LazyDetails>
                      )}
                      {(operator || customer) && (
                        <details>
                          <summary>
                            {customer
                              ? "RÃºt yÃªu cáº§u"
                              : "Tá»« chá»‘i yÃªu cáº§u"}
                          </summary>
                          <ActionForm
                            label="LÆ°u lÃ½ do Ä‘Ã³ng"
                            onSubmit={(f) =>
                              action(
                                customer
                                  ? "replacement_withdraw"
                                  : "replacement_reject",
                                {
                                  replacement_id: v.id,
                                  reason: f.get("reason"),
                                },
                              )
                            }
                            onSuccess={changed}
                          >
                            <Field
                              name="reason"
                              label="LÃ½ do"
                              type="textarea"
                              maxLength={2000}
                            />
                          </ActionForm>
                        </details>
                      )}
                    </>
                  )}
              </article>
            ))}
            {query.data.can_change && query.data.has_project && (
              <details>
                <summary>BÃ¡o cÃ¡o nguy cÆ¡ hoáº·c trá»… háº¡n</summary>
                <p>
                  BÃ¡o cÃ¡o chÆ°a thay Ä‘á»•i lá»‹ch. Staff xÃ¡c minh nguyÃªn
                  nhÃ¢n, bÃªn chá»‹u trÃ¡ch nhiá»‡m vÃ  háº¡n má»›i.
                </p>
                <ActionForm
                  key={`delay-${revision}`}
                  label="Gá»­i bÃ¡o cÃ¡o"
                  onSubmit={(f) => {
                    const input = {
                      description: f.get("description"),
                      responsibility: f.get("responsibility"),
                      ...(f.get("proposed_deadline")
                        ? { proposed_deadline: f.get("proposed_deadline") }
                        : {}),
                    };
                    return action("delay_report", {
                      ...input,
                      idempotency_key: intent([revision, input]),
                    });
                  }}
                  onSuccess={() => {
                    setRevision((v) => v + 1);
                    changed();
                  }}
                >
                  <Field
                    name="description"
                    label="NguyÃªn nhÃ¢n vÃ  áº£nh hÆ°á»Ÿng Ä‘áº¿n bÃ n giao"
                    type="textarea"
                    maxLength={3000}
                  />
                  <PartyField />
                  <Field
                    name="proposed_deadline"
                    label="Háº¡n Ä‘á» xuáº¥t (cÃ³ thá»ƒ bá» trá»‘ng)"
                    type="date"
                    required={false}
                  />
                </ActionForm>
              </details>
            )}
            <h3>BÃ¡o cÃ¡o lá»‹ch vÃ  trÃ¡ch nhiá»‡m</h3>
            {!query.data.delays.length && <p>ChÆ°a cÃ³ bÃ¡o cÃ¡o.</p>}
            {query.data.delays.map((d) => (
              <article className="quote-version" key={d.id}>
                <span className="status">{statuses[d.status]}</span>
                <p className="preserve-lines">{d.description}</p>
                <small>NgÆ°á»i bÃ¡o cÃ¡o: {d.reported_by_name}</small>
                <p>
                  Äá» nghá»‹: {parties[d.proposed_responsibility]} Â· Háº¡n{" "}
                  {d.proposed_deadline || "ChÆ°a Ä‘á» xuáº¥t"}
                </p>
                {d.decision_note && (
                  <>
                    <p>
                      {d.decided_by_name || "Staff"} xÃ¡c minh:{" "}
                      {d.responsibility
                        ? parties[d.responsibility]
                        : "ÄÃ³ng bÃ¡o cÃ¡o"}{" "}
                      Â· Lá»‹ch {d.previous_deadline || "ChÆ°a chá»‘t"} â†’{" "}
                      {d.new_deadline || "Giá»¯ nguyÃªn"}
                    </p>
                    <p>{d.decision_note}</p>
                    {d.responsible_creator_id && (
                      <p>
                        Creator chá»‹u trÃ¡ch nhiá»‡m:{" "}
                        {d.responsible_creator_name ||
                          "Creator trong lá»‹ch sá»­ phÃ¢n cÃ´ng"}
                      </p>
                    )}
                  </>
                )}
                {operator &&
                  d.status === "REPORTED" &&
                  query.data!.can_change && (
                    <DelayDecision
                      id={id}
                      delay={d}
                      team={query.data!.responsible_creators}
                      onChanged={changed}
                    />
                  )}
              </article>
            ))}
            <Pagination
              page={page}
              total={Math.max(
                query.data.replacement_count,
                query.data.delay_count,
              )}
              limit={10}
              onChange={setPage}
            />
          </>
        )}
      </State>
    </section>
  );
}
function LazyDetails({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [visited, setVisited] = useState(false);
  return (
    <details
      onToggle={(e) => {
        if (e.currentTarget.open) setVisited(true);
      }}
    >
      <summary>{label}</summary>
      {visited && children}
    </details>
  );
}
