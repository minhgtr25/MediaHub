begin;

-- Current managed profiles use university/major/experience_level and verified
-- order-derived metrics. These legacy fields were only written by demo seeding.
lock table public.creator_profiles in access exclusive mode;

do $$
begin
  if exists (
    select 1 from public.creator_profiles where is_demo is not true
  ) then
    raise exception 'Refusing to remove legacy Creator fields while non-demo profiles exist';
  end if;
end;
$$;

-- No current API, view or function reads these columns. The rating index and
-- column-local defaults/checks are removed with their columns. RESTRICT is the
-- default; unexpected dependent objects must stop this migration.
alter table public.creator_profiles
  drop column study_year,
  drop column rating,
  drop column review_count,
  drop column completed_projects,
  drop column completion_rate,
  drop column response_rate,
  drop column response_time;

commit;
