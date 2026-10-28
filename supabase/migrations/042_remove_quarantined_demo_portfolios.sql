begin;

-- Remove only portfolio samples already quarantined by migration 037.
-- Keep the demo Creator accounts and all request/order history attached to them.
lock table public.portfolio, public.creator_portfolio in access exclusive mode;
lock table public.creator_profiles in share mode;

do $$
begin
  if exists (
    select 1 from public.portfolio where is_demo and published
  ) then
    raise exception 'Refusing to remove a published demo company case';
  end if;

  if exists (
    select 1
    from public.creator_portfolio item
    left join public.creator_profiles creator on creator.id = item.creator_id
    where item.is_demo and (creator.id is null or not creator.is_demo)
  ) then
    raise exception 'Refusing to remove demo samples attached to a non-demo Creator';
  end if;
end;
$$;

delete from public.creator_portfolio where is_demo;
delete from public.portfolio where is_demo and not published;

notify pgrst, 'reload schema';
commit;
