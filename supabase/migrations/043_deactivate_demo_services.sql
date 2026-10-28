begin;

-- Keep demo service rows referenced by historical requests and orders, but
-- remove them from the active catalog exposed to customers.
lock table public.services in share row exclusive mode;

do $$
declare
  demo_count integer;
  changed_count integer;
begin
  select count(*) into demo_count
  from public.services
  where description ilike '%demo%MediaHub:%';

  if demo_count <> 6 then
    raise exception 'Expected six recognizable demo services; found %', demo_count;
  end if;

  update public.services
  set active = false, updated_at = now()
  where active and description ilike '%demo%MediaHub:%';

  get diagnostics changed_count = row_count;
  if changed_count <> 6 then
    raise exception 'Expected to deactivate six demo services; changed %', changed_count;
  end if;
end;
$$;

commit;
