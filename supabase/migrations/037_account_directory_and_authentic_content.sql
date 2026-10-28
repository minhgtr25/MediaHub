begin;
-- Quarantine only records with signatures from seed-demo.mjs. Preserve records and relationships.
alter table creator_profiles add column is_demo boolean not null default false;
alter table creator_portfolio add column is_demo boolean not null default false;
alter table portfolio add column is_demo boolean not null default false;
update creator_profiles set is_demo=true
 where slug ~ '^creator-([1-9]|1[0-8])$'
 and bio=display_name||' có kinh nghiệm triển khai dự án truyền thông thực tế cho thương hiệu Việt Nam, từ brief đến nghiệm thu.'
 and social_links->>'behance'='https://behance.net/mediahub-'||slug;
update creator_portfolio set is_demo=true
 where id::text ~ '^000000(0[1-9a-f]|1[0-2])-0000-4000-8000-00000000000[1-3]$'
 and description='Dự án thực tế được triển khai và nghiệm thu bởi MediaHub.';
update portfolio set is_demo=true,published=false where
 (slug in ('the-coffee-house-demo','lamer-perfume-demo','techtalk-live-demo','summer-vibes-demo')
  and description='Dự án demo trình bày theo nội dung trong mẫu thiết kế MediaHub.')
 or (slug ~ '^mediahub-case-([5-9]|1[0-9]|2[0-4])$' and description in (
 'Case study thực tế của đội ngũ sáng tạo MediaHub.',
 'Một case study có mô tả dài nhằm kiểm tra khả năng co giãn của card, giới hạn dòng và bố cục responsive khi nội dung thực tế thay đổi đáng kể trên nhiều kích thước màn hình.'));
alter policy public_portfolio on portfolio using(published and not is_demo);
create or replace view creator_discovery_projection as
select c.id,c.slug,c.display_name,c.title,c.bio,c.avatar_url,c.cover_url,c.location,c.university,c.major,c.experience_level,c.tools,c.languages,c.price_from,c.verified,c.featured,
 case when c.profile_id is null then 'UNAVAILABLE'
 when exists(select 1 from creator_assignments a where a.creator_id=c.id and (a.status='ACCEPTED' or a.status='PENDING' and a.expires_at>clock_timestamp())) or exists(select 1 from creator_replacement_invites i where i.creator_id=c.id and i.status='PENDING' and i.expires_at>clock_timestamp()) then 'BUSY'
 else c.availability end availability,
 (select round(avg(cr.rating),1) from order_creator_reviews cr join orders o on o.id=cr.order_id and o.status='COMPLETED' where cr.creator_id=c.id) rating,
 (select count(*) from order_creator_reviews cr join orders o on o.id=cr.order_id and o.status='COMPLETED' where cr.creator_id=c.id) review_count,
 (select count(distinct a.request_id) from creator_assignments a join orders o on o.request_id=a.request_id and o.status='COMPLETED' where a.creator_id=c.id and a.status='COMPLETED' and exists(select 1 from production_submissions f where f.order_id=o.id and f.assignment_id=a.id and f.kind='FINAL')) completed_projects,
 coalesce((select jsonb_agg(jsonb_build_object('skills',jsonb_build_object('id',s.id,'name',s.name,'slug',s.slug)) order by s.name,s.id) from creator_skills cs join skills s on s.id=cs.skill_id and s.active where cs.creator_id=c.id),'[]') creator_skills,
 coalesce((select jsonb_agg(jsonb_build_object('categories',jsonb_build_object('id',cat.id,'name',cat.name,'slug',cat.slug)) order by cat.display_order,cat.id) from creator_categories cc join categories cat on cat.id=cc.category_id and cat.active where cc.creator_id=c.id),'[]') creator_categories,
 coalesce((select jsonb_agg(jsonb_build_object('id',item.id,'title',item.title,'description',item.description,'thumbnail_url',item.thumbnail_url,'category',item.category,'client',item.client,'project_year',item.project_year,'project_url',case when item.project_url ~ '^https://[^[:space:]@]+$' then item.project_url else null end,'featured',item.featured,'gallery',item.gallery,'video_url',case when item.video_url ~ '^https://[^[:space:]@]+$' then item.video_url else null end) order by item.featured desc,item.created_at desc,item.id) from creator_portfolio item where item.creator_id=c.id and not item.is_demo),'[]') creator_portfolio
from creator_profiles c left join profiles p on p.id=c.profile_id
where not c.is_demo and c.profile_id is not null and p.active and p.role in ('CREATOR','STUDENT_CREATOR') and exists(select 1 from creator_company_agreements agreement where agreement.creator_id=c.id);
create or replace function public.company_portfolio_projection() returns table(
 public_id text,kind text,slug text,title text,description text,customer_name text,
 category text,image_url text,image_path text,year integer,updated_at timestamptz
) language sql stable security definer set search_path=public as $$
 select p.id::text,'PORTFOLIO',p.slug,p.title,p.description,p.client,p.category,p.image_url,null::text,p.year,coalesce(p.updated_at,p.created_at)
 from portfolio p where p.published and not p.is_demo
 union all
 select cs.public_id::text,'EXCERPT',null::text,cs.title,cs.excerpt,
  case when pref.show_name then coalesce(nullif(p.full_name,''),'Khách hàng') else 'Khách hàng ẩn danh' end,
  null::text,null::text,cs.image_path,null::integer,cs.updated_at
 from order_case_studies cs join order_publication_preferences pref on pref.order_id=cs.order_id
 left join profiles p on p.id=pref.customer_profile_id
 where cs.published and completed_delivery_eligible(cs.order_id)
$$;


-- A single snapshot supplies global counts and a filtered page; no API row-limit truncation.
create function admin_user_directory(actor_id uuid, filters jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare pg integer:=coalesce((filters->>'page')::integer,1);term text:=btrim(coalesce(filters->>'search',''));output jsonb;
begin
 if not exists(select 1 from profiles where id=actor_id and role='ADMIN' and active) then raise exception 'Administrator required';end if;
 if pg not between 1 and 100000 or length(term)>100
 or (filters->>'role' is not null and filters->>'role' not in ('ADMIN','STAFF','CUSTOMER','BUSINESS','CREATOR','STUDENT_CREATOR'))
 or (filters->>'active' is not null and filters->>'active' not in ('true','false')) then raise exception 'Bộ lọc tài khoản không hợp lệ.';end if;
 with filtered as materialized (
  select id,full_name,email,role,active,created_at from profiles p
  where (term='' or strpos(lower(concat_ws(' ',p.full_name,p.email)),lower(term))>0)
  and (filters->>'role' is null or p.role=filters->>'role')
  and (filters->>'active' is null or p.active=(filters->>'active')::boolean)
 ), paged as (select * from filtered order by created_at desc,id limit 20 offset (pg-1)*20),
 role_counts as (
  select r.role,count(p.id) total,count(p.id) filter(where p.active) active,count(p.id) filter(where not p.active) inactive
  from unnest(array['ADMIN','STAFF','CUSTOMER','BUSINESS','CREATOR','STUDENT_CREATOR']) r(role)
  left join profiles p on p.role=r.role group by r.role
 ) select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(p) order by created_at desc,id) from paged p),'[]'),
 'total',(select count(*) from filtered),'page',pg,'limit',20,
 'summary',jsonb_build_object('total',(select count(*) from profiles),'active',(select count(*) from profiles where active),
 'inactive',(select count(*) from profiles where not active),'by_role',(select jsonb_agg(to_jsonb(r) order by role) from role_counts r))) into output;
 return output;
end $$;
create function admin_create_creator_profile(actor_id uuid,payload jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare cid uuid;
begin
 if not exists(select 1 from profiles where id=actor_id and role='ADMIN' and active) then raise exception 'Administrator required';end if;
 if payload->>'content_confirmed' is distinct from 'true' or coalesce(length(btrim(payload->>'display_name')),0) not between 1 and 150
 or coalesce(length(btrim(payload->>'title')),0) not between 1 and 200 or coalesce(payload->>'slug','') !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
 then raise exception 'Cần thông tin Creator thật và xác nhận quyền công khai.';end if;
 insert into creator_profiles(slug,display_name,title,bio,location,avatar_url,cover_url)
 values(payload->>'slug',btrim(payload->>'display_name'),btrim(payload->>'title'),coalesce(payload->>'bio',''),coalesce(payload->>'location',''),nullif(payload->>'avatar_url',''),nullif(payload->>'cover_url','')) returning id into cid;
 insert into audit_logs(actor_id,action,entity,entity_id) values(actor_id,'CREATE_REAL_CREATOR','creator_profiles',cid);
 return jsonb_build_object('id',cid);
end $$;
revoke all on function admin_user_directory(uuid,jsonb),admin_create_creator_profile(uuid,jsonb) from public,anon,authenticated;
grant execute on function admin_user_directory(uuid,jsonb),admin_create_creator_profile(uuid,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
