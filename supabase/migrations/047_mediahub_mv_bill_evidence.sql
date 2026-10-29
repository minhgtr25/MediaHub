begin;

-- Administrator-supplied bill evidence is stored separately from invoices.
-- Actual receipt values are entered privately and are never committed to source control.
create table public.mediahub_mv_bill_evidence (
  source_key text primary key,
  amount numeric(16,2) not null check (amount > 0),
  received_at timestamptz not null,
  payer_label text not null,
  payee_label text not null,
  bank_transaction_reference text unique,
  source_note text not null
);
alter table public.mediahub_mv_bill_evidence enable row level security;
revoke all on public.mediahub_mv_bill_evidence from public, anon, authenticated;
grant select on public.mediahub_mv_bill_evidence to service_role;

create function public.admin_mediahub_mv_bill_report(actor_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin
  if not exists(select 1 from profiles where id=actor_id and role='ADMIN' and active) then
    raise exception 'Administrator required';
  end if;
  return jsonb_build_object(
    'total',(select coalesce(sum(amount),0) from mediahub_mv_bill_evidence),
    'count',(select count(*) from mediahub_mv_bill_evidence),
    'by_month',(select coalesce(jsonb_agg(t order by t.label),'[]'::jsonb) from (
      select to_char(received_at at time zone 'Asia/Ho_Chi_Minh','YYYY-MM') as label,
             sum(amount) as value
      from mediahub_mv_bill_evidence group by 1
    ) t),
    'items',(select coalesce(jsonb_agg(t order by t.received_at desc),'[]'::jsonb) from (
      select source_key,amount,received_at,payer_label,payee_label,bank_transaction_reference
      from mediahub_mv_bill_evidence
    ) t)
  );
end $$;
revoke all on function public.admin_mediahub_mv_bill_report(uuid) from public,anon,authenticated;
grant execute on function public.admin_mediahub_mv_bill_report(uuid) to service_role;

commit;
