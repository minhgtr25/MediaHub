begin;

create table public.site_visits (
  session_id uuid primary key,
  visited_at timestamptz not null default now()
);
create index site_visits_visited_at_idx on public.site_visits(visited_at);
alter table public.site_visits enable row level security;
revoke all on public.site_visits from anon, authenticated;
grant select, insert on public.site_visits to service_role;

create table public.site_visit_demo_daily (
  visit_day date primary key,
  visits integer not null check (visits >= 0)
);
alter table public.site_visit_demo_daily enable row level security;
revoke all on public.site_visit_demo_daily from anon, authenticated;
grant select on public.site_visit_demo_daily to service_role;

-- Historical sample values stay separate from recorded visits.
insert into public.site_visit_demo_daily(visit_day, visits)
select day,
  18 + ((n * 13) % 19) +
  case when extract(isodow from day) in (6, 7) then -8 else 14 end
from (
  select n,
    (now() at time zone 'Asia/Ho_Chi_Minh')::date - n as day
  from generate_series(1, 28) as offsets(n)
) as history
on conflict (visit_day) do nothing;

create function public.record_site_visit(visitor_session uuid) returns boolean
language plpgsql security definer set search_path=public as $$
declare inserted_count integer;
begin
  insert into public.site_visits(session_id)
  values (visitor_session)
  on conflict (session_id) do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count = 1;
end $$;
revoke all on function public.record_site_visit(uuid) from public, anon, authenticated;
grant execute on function public.record_site_visit(uuid) to service_role;

create function public.admin_visit_daily(from_day date, through_day date)
returns table(visit_day date, visits bigint, demo_visits integer)
language sql stable security definer set search_path=public as $$
  with real_counts as (
    select (visited_at at time zone 'Asia/Ho_Chi_Minh')::date as day,
      count(*) as total
    from public.site_visits
    where visited_at >= (from_day::timestamp at time zone 'Asia/Ho_Chi_Minh')
      and visited_at < ((through_day + 1)::timestamp at time zone 'Asia/Ho_Chi_Minh')
    group by 1
  )
  select days.day::date,
    coalesce(real_counts.total, 0)::bigint,
    coalesce(samples.visits, 0)::integer
  from generate_series(from_day, through_day, interval '1 day') as days(day)
  left join real_counts on real_counts.day = days.day::date
  left join public.site_visit_demo_daily samples on samples.visit_day = days.day::date
  order by days.day
$$;
revoke all on function public.admin_visit_daily(date,date) from public, anon, authenticated;
grant execute on function public.admin_visit_daily(date,date) to service_role;

commit;
