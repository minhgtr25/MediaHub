begin;

alter table public.creator_profiles
  add column admin_managed boolean not null default false,
  add column published boolean not null default false,
  add constraint admin_managed_creator_unlinked
    check (not admin_managed or (profile_id is null and availability='UNAVAILABLE' and not verified));

alter table public.portfolio add column video_url text;

create or replace view public.creator_discovery_projection as
select c.id,c.slug,c.display_name,c.title,c.bio,c.avatar_url,c.cover_url,c.location,c.university,c.major,c.experience_level,c.tools,c.languages,c.price_from,
 case when c.admin_managed then false else c.verified end verified,c.featured,
 case when c.admin_managed then 'UNAVAILABLE'
      when exists(select 1 from creator_assignments a where a.creator_id=c.id and (a.status='ACCEPTED' or a.status='PENDING' and a.expires_at>clock_timestamp()))
        or exists(select 1 from creator_replacement_invites i where i.creator_id=c.id and i.status='PENDING' and i.expires_at>clock_timestamp()) then 'BUSY'
      else c.availability end availability,
 case when c.admin_managed then null::numeric else
   (select round(avg(cr.rating),1) from order_creator_reviews cr join orders o on o.id=cr.order_id and o.status='COMPLETED' where cr.creator_id=c.id) end rating,
 case when c.admin_managed then 0 else
   (select count(*) from order_creator_reviews cr join orders o on o.id=cr.order_id and o.status='COMPLETED' where cr.creator_id=c.id) end review_count,
 case when c.admin_managed then 0 else
   (select count(distinct a.request_id) from creator_assignments a join orders o on o.request_id=a.request_id and o.status='COMPLETED' where a.creator_id=c.id and a.status='COMPLETED' and exists(select 1 from production_submissions f where f.order_id=o.id and f.assignment_id=a.id and f.kind='FINAL')) end completed_projects,
 coalesce((select jsonb_agg(jsonb_build_object('skills',jsonb_build_object('id',s.id,'name',s.name,'slug',s.slug)) order by s.name,s.id) from creator_skills cs join skills s on s.id=cs.skill_id and s.active where cs.creator_id=c.id),'[]') creator_skills,
 coalesce((select jsonb_agg(jsonb_build_object('categories',jsonb_build_object('id',cat.id,'name',cat.name,'slug',cat.slug)) order by cat.display_order,cat.id) from creator_categories cc join categories cat on cat.id=cc.category_id and cat.active where cc.creator_id=c.id),'[]') creator_categories,
 coalesce((select jsonb_agg(jsonb_build_object('id',item.id,'title',item.title,'description',item.description,'thumbnail_url',item.thumbnail_url,'category',item.category,'client',item.client,'project_year',item.project_year,'project_url',case when item.project_url ~ '^https://[^[:space:]@]+$' then item.project_url else null end,'featured',item.featured,'gallery',item.gallery,'video_url',case when item.video_url ~ '^https://[^[:space:]@]+$' then item.video_url else null end) order by item.featured desc,item.created_at desc,item.id) from creator_portfolio item where item.creator_id=c.id and (not item.is_demo or c.admin_managed and c.published)),'[]') creator_portfolio,
 c.admin_managed is_showcase,c.is_demo
from creator_profiles c left join profiles p on p.id=c.profile_id
where (c.admin_managed and c.published)
   or (not c.admin_managed and not c.is_demo and c.profile_id is not null and p.active and p.role in ('CREATOR','STUDENT_CREATOR') and exists(select 1 from creator_company_agreements agreement where agreement.creator_id=c.id));

create or replace function public.admin_manage_creator_showcase(actor_id uuid,operation text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public as $$
declare cid uuid; c public.creator_profiles; output jsonb; n integer;
begin
 if not exists(select 1 from public.profiles where id=actor_id and role='ADMIN' and active) then raise exception 'Administrator required'; end if;
 if operation not in ('create','update','delete') then raise exception 'Unsupported Creator operation'; end if;
 perform set_config('app.actor',actor_id::text,true);
 if operation='delete' then
  cid:=(payload->>'id')::uuid;
  delete from public.creator_profiles where id=cid and admin_managed;
  if not found then raise exception 'Showcase Creator not found'; end if;
  insert into public.audit_logs(actor_id,action,entity,entity_id) values(actor_id,'DELETE_CREATOR_SHOWCASE','creator_profiles',cid);
  return jsonb_build_object('id',cid,'deleted',true);
 end if;
 if coalesce(payload->>'slug','') !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
   or coalesce(length(btrim(payload->>'display_name')),0) not between 1 and 150
   or coalesce(length(btrim(payload->>'title')),0) not between 1 and 200
   or length(coalesce(payload->>'bio',''))>5000
   or coalesce(payload->>'experience_level','') not in ('STUDENT','JUNIOR','MID','SENIOR','LEAD')
   or jsonb_typeof(payload->'tools') is distinct from 'array'
   or jsonb_typeof(payload->'languages') is distinct from 'array'
   or jsonb_typeof(payload->'category_ids') is distinct from 'array'
   or jsonb_typeof(payload->'skill_ids') is distinct from 'array'
   or jsonb_array_length(payload->'tools')>30
   or jsonb_array_length(payload->'languages')>20
   or jsonb_array_length(payload->'category_ids')>10
   or jsonb_array_length(payload->'skill_ids')>30
   or (payload->>'price_from' is not null and payload->>'price_from'<>'' and (payload->>'price_from')::numeric<0)
   or coalesce(payload->>'avatar_url','') !~ '^$|^https://[^[:space:]@]+$'
   or coalesce(payload->>'cover_url','') !~ '^$|^https://[^[:space:]@]+$'
 then raise exception 'Invalid Creator showcase fields'; end if;
 if exists(select 1 from jsonb_array_elements_text(payload->'category_ids') as items(value) where value !~* '^[0-9a-f-]{36}$')
   or exists(select 1 from jsonb_array_elements_text(payload->'skill_ids') as items(value) where value !~* '^[0-9a-f-]{36}$')
 then raise exception 'Invalid Creator category or skill'; end if;
 if operation='create' then
  insert into public.creator_profiles(profile_id,slug,display_name,title,bio,avatar_url,cover_url,location,university,major,experience_level,tools,languages,availability,price_from,verified,featured,is_demo,admin_managed,published)
  values(null,payload->>'slug',btrim(payload->>'display_name'),btrim(payload->>'title'),coalesce(payload->>'bio',''),nullif(payload->>'avatar_url',''),nullif(payload->>'cover_url',''),coalesce(payload->>'location',''),nullif(payload->>'university',''),nullif(payload->>'major',''),payload->>'experience_level',array(select jsonb_array_elements_text(payload->'tools')),array(select jsonb_array_elements_text(payload->'languages')),'UNAVAILABLE',nullif(payload->>'price_from','')::numeric,false,coalesce((payload->>'featured')::boolean,false),coalesce((payload->>'is_demo')::boolean,false),true,coalesce((payload->>'published')::boolean,false)) returning * into c;
 else
  cid:=(payload->>'id')::uuid;
  update public.creator_profiles set slug=payload->>'slug',display_name=btrim(payload->>'display_name'),title=btrim(payload->>'title'),bio=coalesce(payload->>'bio',''),avatar_url=nullif(payload->>'avatar_url',''),cover_url=nullif(payload->>'cover_url',''),location=coalesce(payload->>'location',''),university=nullif(payload->>'university',''),major=nullif(payload->>'major',''),experience_level=payload->>'experience_level',tools=array(select jsonb_array_elements_text(payload->'tools')),languages=array(select jsonb_array_elements_text(payload->'languages')),availability='UNAVAILABLE',price_from=nullif(payload->>'price_from','')::numeric,verified=false,featured=coalesce((payload->>'featured')::boolean,false),is_demo=coalesce((payload->>'is_demo')::boolean,false),published=coalesce((payload->>'published')::boolean,false),updated_at=now()
  where id=cid and admin_managed returning * into c;
  if c.id is null then raise exception 'Showcase Creator not found'; end if;
 end if;
 cid:=c.id;
 delete from public.creator_categories where creator_id=cid;
 insert into public.creator_categories(creator_id,category_id)
 select cid,category.id from public.categories category join (select distinct value::uuid id from jsonb_array_elements_text(payload->'category_ids') as items(value)) selected on selected.id=category.id where category.active;
 get diagnostics n=row_count; if n<>jsonb_array_length(payload->'category_ids') then raise exception 'Unknown or inactive Creator category'; end if;
 delete from public.creator_skills where creator_id=cid;
 insert into public.creator_skills(creator_id,skill_id)
 select cid,skill.id from public.skills skill join (select distinct value::uuid id from jsonb_array_elements_text(payload->'skill_ids') as items(value)) selected on selected.id=skill.id where skill.active;
 get diagnostics n=row_count; if n<>jsonb_array_length(payload->'skill_ids') then raise exception 'Unknown or inactive Creator skill'; end if;
 insert into public.audit_logs(actor_id,action,entity,entity_id) values(actor_id,case when operation='create' then 'CREATE_CREATOR_SHOWCASE' else 'UPDATE_CREATOR_SHOWCASE' end,'creator_profiles',cid);
 select to_jsonb(c)||jsonb_build_object('category_ids',coalesce((select jsonb_agg(category_id) from public.creator_categories where creator_id=cid),'[]'::jsonb),'skill_ids',coalesce((select jsonb_agg(skill_id) from public.creator_skills where creator_id=cid),'[]'::jsonb)) into output from public.creator_profiles c where c.id=cid;
 return output;
end $$;

revoke all on function public.admin_manage_creator_showcase(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.admin_manage_creator_showcase(uuid,text,jsonb) to service_role;

drop function public.public_company_portfolio(integer,integer,text,text,text);
drop function public.company_portfolio_projection();
create function public.company_portfolio_projection() returns table(
 public_id text,kind text,slug text,title text,description text,customer_name text,
 category text,image_url text,image_path text,year integer,updated_at timestamptz,video_url text
) language sql stable security definer set search_path=public as $$
 select p.id::text,'PORTFOLIO',p.slug,p.title,p.description,p.client,p.category,p.image_url,null::text,p.year,coalesce(p.updated_at,p.created_at),p.video_url
 from portfolio p where p.published and not p.is_demo
 union all
 select cs.public_id::text,'EXCERPT',null::text,cs.title,cs.excerpt,
  case when pref.show_name then coalesce(nullif(p.full_name,''),'Khách hàng') else 'Khách hàng ẩn danh' end,
  null::text,null::text,cs.image_path,null::integer,cs.updated_at,null::text
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

create or replace function public.public_company_excerpt(excerpt_public_id uuid) returns jsonb
language sql stable security definer set search_path=public as $$
 select to_jsonb(projected) from (
  select cs.public_id::text,'EXCERPT'::text as kind,null::text as slug,cs.title,cs.excerpt as description,
   case when pref.show_name then coalesce(nullif(p.full_name,''),'Khách hàng') else 'Khách hàng ẩn danh' end as customer_name,
   null::text as category,null::text as image_url,cs.image_path,null::integer as year,cs.updated_at,null::text as video_url
  from order_case_studies cs join order_publication_preferences pref on pref.order_id=cs.order_id
  left join profiles p on p.id=pref.customer_profile_id
  where cs.public_id=excerpt_public_id and cs.published and completed_delivery_eligible(cs.order_id)
 ) projected
$$;

revoke all on function public.company_portfolio_projection(),public.public_company_portfolio(integer,integer,text,text,text),public.public_company_excerpt(uuid),public.admin_manage_creator_showcase(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.company_portfolio_projection(),public.public_company_portfolio(integer,integer,text,text,text),public.public_company_excerpt(uuid),public.admin_manage_creator_showcase(uuid,text,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
