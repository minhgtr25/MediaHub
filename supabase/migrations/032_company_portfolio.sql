begin;
-- A public identity distinct from the private order identity, stable across republishing.
alter table public.order_case_studies add column public_id uuid not null default gen_random_uuid() unique;
create function public.guard_case_public_identity() returns trigger language plpgsql set search_path=public as $$
begin
 if new.public_id is distinct from old.public_id then raise exception 'Không đổi định danh hồ sơ công khai.';end if;
 return new;
end $$;
create trigger case_public_identity_guard before update on order_case_studies for each row execute function guard_case_public_identity();

-- Server-only projection: legacy published portfolio and approved small excerpts.
-- No private order/customer IDs, files, prices or production details are selected.
create function public.company_portfolio_projection() returns table(
 public_id text,kind text,slug text,title text,description text,customer_name text,
 category text,image_url text,image_path text,year integer,updated_at timestamptz
) language sql stable security definer set search_path=public as $$
 select p.id::text,'PORTFOLIO',p.slug,p.title,p.description,p.client,p.category,p.image_url,null::text,p.year,coalesce(p.updated_at,p.created_at)
 from portfolio p where p.published
 union all
 select cs.public_id::text,'EXCERPT',null::text,cs.title,cs.excerpt,
  case when pref.show_name then coalesce(nullif(p.full_name,''),'Khách hàng') else 'Khách hàng ẩn danh' end,
  null::text,null::text,cs.image_path,null::integer,cs.updated_at
 from order_case_studies cs join order_publication_preferences pref on pref.order_id=cs.order_id
 left join profiles p on p.id=pref.customer_profile_id
 where cs.published and completed_delivery_eligible(cs.order_id)
$$;

create function public.public_company_portfolio(
 portfolio_page integer default 1,portfolio_limit integer default 6,
 portfolio_search text default '',portfolio_category text default '',portfolio_kind text default 'ALL'
) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare output jsonb;
begin
 if portfolio_page is null or portfolio_page not between 1 and 100000 or portfolio_limit is null or portfolio_limit not between 1 and 12
  or portfolio_search is null or length(portfolio_search)>100 or portfolio_category is null or length(portfolio_category)>100
  or portfolio_kind is null or portfolio_kind not in ('ALL','PORTFOLIO','EXCERPT') then raise exception 'Bộ lọc hồ sơ chưa hợp lệ.';end if;
 with filtered as materialized (
  select * from company_portfolio_projection() p
  where (portfolio_kind='ALL' or p.kind=portfolio_kind)
   and (btrim(portfolio_category)='' or lower(p.category)=lower(btrim(portfolio_category)))
   and (btrim(portfolio_search)='' or strpos(lower(concat_ws(' ',p.title,p.description,p.customer_name,p.category)),lower(btrim(portfolio_search)))>0)
 ), paged as (
  select * from filtered order by updated_at desc nulls last,kind,public_id
  offset ((portfolio_page::bigint-1)*portfolio_limit) limit portfolio_limit
 ) select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(p) order by updated_at desc nulls last,kind,public_id) from paged p),'[]'::jsonb),
  'total',(select count(*) from filtered),'page',portfolio_page,'limit',portfolio_limit) into output;
 return output;
end $$;

create function public.public_company_excerpt(excerpt_public_id uuid) returns jsonb
language sql stable security definer set search_path=public as $$
 select to_jsonb(projected) from (
  select cs.public_id::text,'EXCERPT'::text as kind,null::text as slug,cs.title,cs.excerpt as description,
   case when pref.show_name then coalesce(nullif(p.full_name,''),'Khách hàng') else 'Khách hàng ẩn danh' end as customer_name,
   null::text as category,null::text as image_url,cs.image_path,null::integer as year,cs.updated_at
  from order_case_studies cs join order_publication_preferences pref on pref.order_id=cs.order_id
  left join profiles p on p.id=pref.customer_profile_id
  where cs.public_id=excerpt_public_id and cs.published and completed_delivery_eligible(cs.order_id)
 ) projected
$$;
revoke all on function company_portfolio_projection(),public_company_portfolio(integer,integer,text,text,text),public_company_excerpt(uuid),guard_case_public_identity() from public,anon,authenticated;
grant execute on function company_portfolio_projection(),public_company_portfolio(integer,integer,text,text,text),public_company_excerpt(uuid) to service_role;
notify pgrst,'reload schema';
commit;
