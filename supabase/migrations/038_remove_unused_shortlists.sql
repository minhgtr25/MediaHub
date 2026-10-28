begin;

-- These empty legacy shortlist tables have no application routes or RPC callers.
-- Lock first so a concurrent write cannot slip between the emptiness check and drop.
lock table public.favorite_creators, public.saved_projects in access exclusive mode;

do $$
begin
  if exists (select 1 from public.favorite_creators) then
    raise exception 'Refusing to drop favorite_creators: rows remain';
  end if;
  if exists (select 1 from public.saved_projects) then
    raise exception 'Refusing to drop saved_projects: rows remain';
  end if;
end;
$$;

-- Deliberately omit CASCADE: unexpected dependencies must stop this migration.
drop table public.favorite_creators;
drop table public.saved_projects;

notify pgrst, 'reload schema';
commit;
