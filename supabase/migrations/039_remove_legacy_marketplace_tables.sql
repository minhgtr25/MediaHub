begin;

-- The old open marketplace is not part of the managed request workflow.
-- Migration 037 marked synthetic Creator profiles from the seed script.
lock table public.project_applications, public.creator_reviews in access exclusive mode;
lock table public.creator_profiles in share mode;

do $$
begin
  if exists (
    select 1
    from public.project_applications application
    left join public.creator_profiles creator on creator.id = application.creator_id
    where creator.id is null or creator.is_demo is not true
  ) then
    raise exception 'Refusing to drop project_applications: non-demo or unclassified records remain';
  end if;

  if exists (
    select 1
    from public.creator_reviews review
    left join public.creator_profiles creator on creator.id = review.creator_id
    where creator.id is null or creator.is_demo is not true
  ) then
    raise exception 'Refusing to drop creator_reviews: non-demo or unclassified records remain';
  end if;
end;
$$;

-- These relations have no callers, triggers or incoming foreign keys.
-- No CASCADE: unexpected database dependencies must stop the migration.
drop table public.project_applications;
drop table public.creator_reviews;

notify pgrst, 'reload schema';
commit;
