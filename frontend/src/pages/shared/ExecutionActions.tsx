import { useState } from "react";
import { ActionForm, Field, State } from "../../components/ui";
import { useApi } from "../../hooks/useApi";
import { post } from "../../services/api";
import { InlineCreatorProfile } from "../../components/InlineCreatorProfile";
import { parties } from "./execution-shared";
import { useIdempotencyKey } from "../../hooks/useIdempotencyKey";
import type { Delay, Member } from "./execution.types";

export function ReplacementBuilder({
  id,
  replacementId,
  deadline,
  onChanged,
}: {
  id: string;
  replacementId: string;
  deadline: string | null;
  onChanged: () => void;
}) {
  const [search, setSearch] = useState(""),
    [selected, setSelected] = useState(""),
    intent = useIdempotencyKey(),
    q = useApi<{
      items: {
        id: string;
        display_name: string;
        title: string;
        slug: string;
      }[];
    }>(`/execution/${id}/candidates?${new URLSearchParams({ search })}`),
    creator = q.data?.items.find((c) => c.id === selected);
  return (
    <ActionForm
      label="PhÃª duyá»‡t vÃ  gá»­i lá»i má»i"
      onSubmit={(f) => {
        const input = {
          replacement_id: replacementId,
          creator_id: selected,
          reason: f.get("reason"),
          work_scope: f.get("work_scope"),
          deadline: f.get("deadline"),
          response_minutes: Number(f.get("response_minutes")),
        };
        return post(`/execution/${id}/replacement_invite`, {
          ...input,
          idempotency_key: intent(input),
        });
      }}
      onSuccess={onChanged}
    >
      <label className="field">
        TÃ¬m Creator
        <input
          value={search}
          maxLength={100}
          onChange={(e) => {
            setSearch(e.target.value);
            setSelected("");
          }}
        />
      </label>
      <State query={q}>
        <label className="field">
          Creator Ä‘ang ráº£nh
          <select
            required
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Chá»n ngÆ°á»i phÃ¹ há»£p</option>
            {q.data?.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name} Â· {c.title}
              </option>
            ))}
          </select>
        </label>
        {q.data && !q.data.items.length && (
          <p>
            ChÆ°a cÃ³ Creator ráº£nh phÃ¹ há»£p. Thá»­ tá»« khÃ³a khÃ¡c hoáº·c
            lÃ m má»›i sau.
          </p>
        )}
      </State>
      {creator && <InlineCreatorProfile slug={creator.slug} />}
      <Field
        name="reason"
        label="CÄƒn cá»© phÃª duyá»‡t cá»§a Staff"
        type="textarea"
        maxLength={2000}
      />
      <Field
        name="work_scope"
        label="Pháº§n viá»‡c gá»­i cho Creator má»›i"
        type="textarea"
        maxLength={3000}
      />
      <Field
        name="deadline"
        label="Háº¡n pháº§n viá»‡c (trong lá»‹ch dá»± Ã¡n)"
        type="date"
        value={deadline || undefined}
      />
      <label className="field">
        Giá»¯ chá»— (phÃºt)
        <input
          required
          name="response_minutes"
          type="number"
          min={5}
          max={15}
          step={1}
          defaultValue={15}
        />
      </label>
    </ActionForm>
  );
}
export function DelayDecision({
  id,
  delay,
  team,
  onChanged,
}: {
  id: string;
  delay: Delay;
  team: Pick<Member, "creator_id" | "display_name">[];
  onChanged: () => void;
}) {
  const [party, setParty] = useState("UNDETERMINED");
  return (
    <details>
      <summary>XÃ¡c minh bÃ¡o cÃ¡o</summary>
      <ActionForm
        label="Ghi nháº­n trÃ¡ch nhiá»‡m vÃ  lá»‹ch má»›i"
        onSubmit={(f) =>
          post(`/execution/${id}/delay_apply`, {
            delay_id: delay.id,
            reason: f.get("reason"),
            responsibility: party,
            new_deadline: f.get("new_deadline"),
            ...(party === "CREATOR"
              ? { responsible_creator_id: f.get("responsible_creator_id") }
              : {}),
          })
        }
        onSuccess={onChanged}
      >
        <label className="field">
          BÃªn chá»‹u trÃ¡ch nhiá»‡m
          <select value={party} onChange={(e) => setParty(e.target.value)}>
            {Object.entries(parties).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {party === "CREATOR" && (
          <label className="field">
            Creator chá»‹u trÃ¡ch nhiá»‡m
            <select required name="responsible_creator_id">
              <option value="">Chá»n Creator</option>
              {team.map((m) => (
                <option key={m.creator_id} value={m.creator_id}>
                  {m.display_name}
                </option>
              ))}
            </select>
          </label>
        )}
        <Field
          name="new_deadline"
          label="Háº¡n dá»± Ã¡n má»›i"
          type="date"
          value={delay.proposed_deadline || undefined}
        />
        <Field
          name="reason"
          label="CÄƒn cá»© Ä‘Ã£ xÃ¡c minh (cáº£ Ä‘á»™i xem Ä‘Æ°á»£c)"
          type="textarea"
          maxLength={2000}
        />
      </ActionForm>
      <ActionForm
        label="ÄÃ³ng bÃ¡o cÃ¡o, giá»¯ lá»‹ch"
        onSubmit={(f) =>
          post(`/execution/${id}/delay_dismiss`, {
            delay_id: delay.id,
            reason: f.get("reason"),
          })
        }
        onSuccess={onChanged}
      >
        <Field
          name="reason"
          label="LÃ½ do Ä‘Ã³ng"
          type="textarea"
          maxLength={2000}
        />
      </ActionForm>
    </details>
  );
}
