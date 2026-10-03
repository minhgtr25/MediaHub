begin;
alter table creator_portfolio add column idempotency_key uuid;
create unique index creator_portfolio_retry on creator_portfolio(creator_id,idempotency_key) where idempotency_key is not null;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('creator-profile-assets','creator-profile-assets',true,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
-- Public projection never exposes linked identity, company agreements, commercial data,
-- contact fields, legacy synthetic rating/response metrics or internal idempotency keys.
create view creator_discovery_projection as
select c.id,c.slug,c.display_name,c.title,c.bio,c.avatar_url,c.cover_url,c.location,c.university,c.major,c.experience_level,c.tools,c.languages,c.price_from,c.verified,c.featured,
 case when c.profile_id is null then 'UNAVAILABLE'
 when exists(select 1 from creator_assignments a where a.creator_id=c.id and (a.status='ACCEPTED' or a.status='PENDING' and a.expires_at>clock_timestamp())) or exists(select 1 from creator_replacement_invites i where i.creator_id=c.id and i.status='PENDING' and i.expires_at>clock_timestamp()) then 'BUSY'
 else c.availability end availability,
 (select round(avg(cr.rating),1) from order_creator_reviews cr join orders o on o.id=cr.order_id and o.status='COMPLETED' where cr.creator_id=c.id) rating,
 (select count(*) from order_creator_reviews cr join orders o on o.id=cr.order_id and o.status='COMPLETED' where cr.creator_id=c.id) review_count,
 (select count(distinct a.request_id) from creator_assignments a join orders o on o.request_id=a.request_id and o.status='COMPLETED' where a.creator_id=c.id and a.status='COMPLETED' and exists(select 1 from production_submissions f where f.order_id=o.id and f.assignment_id=a.id and f.kind='FINAL')) completed_projects,
 coalesce((select jsonb_agg(jsonb_build_object('skills',jsonb_build_object('id',s.id,'name',s.name,'slug',s.slug)) order by s.name,s.id) from creator_skills cs join skills s on s.id=cs.skill_id and s.active where cs.creator_id=c.id),'[]') creator_skills,
 coalesce((select jsonb_agg(jsonb_build_object('categories',jsonb_build_object('id',cat.id,'name',cat.name,'slug',cat.slug)) order by cat.display_order,cat.id) from creator_categories cc join categories cat on cat.id=cc.category_id and cat.active where cc.creator_id=c.id),'[]') creator_categories,
 coalesce((select jsonb_agg(jsonb_build_object('id',item.id,'title',item.title,'description',item.description,'thumbnail_url',item.thumbnail_url,'category',item.category,'client',item.client,'project_year',item.project_year,'project_url',case when item.project_url ~ '^https://[^[:space:]@]+$' then item.project_url else null end,'featured',item.featured,'gallery',item.gallery,'video_url',case when item.video_url ~ '^https://[^[:space:]@]+$' then item.video_url else null end) order by item.featured desc,item.created_at desc,item.id) from creator_portfolio item where item.creator_id=c.id),'[]') creator_portfolio
from creator_profiles c left join profiles p on p.id=c.profile_id
where c.profile_id is null or p.active and p.role in ('CREATOR','STUDENT_CREATOR') and exists(select 1 from creator_company_agreements agreement where agreement.creator_id=c.id);
revoke all on creator_discovery_projection from public,anon,authenticated;
grant select on creator_discovery_projection to service_role;
revoke select on creator_profiles,creator_portfolio,creator_skills,creator_categories from anon,authenticated;
create function public_creator_search(filters jsonb default '{}') returns jsonb language plpgsql stable security definer set search_path=public as $$
declare items jsonb;cnt bigint;pg integer:=coalesce((filters->>'page')::integer,1);lim integer:=coalesce((filters->>'limit')::integer,6);sort_by text:=coalesce(filters->>'sort','recommended');
begin
 if pg not between 1 and 100000 or lim not between 1 and 48 or sort_by not in ('recommended','rating','projects','price') or length(coalesce(filters->>'search',''))>100 then raise exception 'Bộ lọc Creator không hợp lệ.';end if;
 with filtered as (
 select c.* from creator_discovery_projection c where
 (coalesce(filters->>'search','')='' or position(lower(filters->>'search') in lower(c.display_name||' '||c.title||' '||c.bio||' '||array_to_string(c.tools,' ')||' '||coalesce((select string_agg(x->'skills'->>'name',' ') from jsonb_array_elements(c.creator_skills) x),'')))>0)
 and (coalesce(filters->>'location','')='' or position(lower(filters->>'location') in lower(c.location))>0)
 and (coalesce(filters->>'category','')='' or exists(select 1 from jsonb_array_elements(c.creator_categories) x where x->'categories'->>'slug'=filters->>'category'))
 and (coalesce(filters->>'skill','')='' or exists(select 1 from jsonb_array_elements(c.creator_skills) x where x->'skills'->>'slug'=filters->>'skill'))
 and (filters->>'experience' is null or c.experience_level=filters->>'experience') and (filters->>'availability' is null or c.availability=filters->>'availability')
 and (filters->>'verified' is null or c.verified=(filters->>'verified')::boolean)
 and (filters->>'rating' is null or c.rating>=(filters->>'rating')::numeric) and (filters->>'price_max' is null or c.price_from<=(filters->>'price_max')::numeric)
 ), paged as (
 select * from filtered order by
 case when sort_by='recommended' then featured end desc nulls last,
 case when sort_by in ('recommended','rating') then rating end desc nulls last,
 case when sort_by='projects' then completed_projects end desc,
 case when sort_by='price' then price_from end asc nulls last,display_name,id
 limit lim offset (pg-1)*lim
 ) select (select count(*) from filtered),coalesce((select jsonb_agg(to_jsonb(p)-array['bio','cover_url','university','major','tools','languages','creator_categories']) from paged p),'[]') into cnt,items;
 return jsonb_build_object('items',items,'total',cnt,'page',pg,'limit',lim);
end $$;
create function creator_request_candidates(actor_id uuid,rid uuid,search_text text default '') returns jsonb language plpgsql stable security definer set search_path=public as $$
declare items jsonb;
begin
 if not exists(select 1 from profiles person join requests r on r.id=rid where person.id=actor_id and person.active and person.role in ('STAFF','ADMIN') and (person.role='ADMIN' or r.assigned_to=person.id)) then return null;end if;
 if length(search_text)>100 then raise exception 'Từ khóa quá dài.';end if;
 select coalesce(jsonb_agg(to_jsonb(candidate)),'[]') into items from (
 select c.id,c.slug,c.display_name,c.title,c.avatar_url,c.availability from creator_discovery_projection c where c.availability in ('AVAILABLE','LIMITED') and exists(select 1 from creator_company_agreements where creator_id=c.id)
 and (coalesce(search_text,'')='' or position(lower(search_text) in lower(c.display_name||' '||c.title||' '||array_to_string(c.tools,' ')||' '||coalesce((select string_agg(x->'skills'->>'name',' ') from jsonb_array_elements(c.creator_skills) x),'')))>0)
 order by c.display_name,c.id limit 24) candidate;
 return jsonb_build_object('items',items);
end $$;
create or replace function execution_candidates(actor_id uuid,oid uuid,search_text text default '') returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if not variation_commerce_reader(actor_id,oid) then return null;end if;
 return creator_request_candidates(actor_id,(select request_id from orders where id=oid),search_text);
end $$;
revoke all on function creator_request_candidates(uuid,uuid,text) from public,anon,authenticated;
grant execute on function creator_request_candidates(uuid,uuid,text) to service_role;
create function public_creator_detail(creator_slug text) returns jsonb language sql stable security definer set search_path=public as $$ select to_jsonb(c) from creator_discovery_projection c where slug=creator_slug $$;
create function creator_profile_state(actor_id uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare c creator_profiles;
begin
 select cp.* into c from creator_profiles cp join profiles p on p.id=cp.profile_id and p.active and p.role in ('CREATOR','STUDENT_CREATOR') join creator_company_agreements a on a.creator_id=cp.id where p.id=actor_id;
 if c.id is null then return null;end if;
 return jsonb_build_object('profile',jsonb_build_object('id',c.id,'slug',c.slug,'display_name',c.display_name,'title',c.title,'bio',c.bio,'location',c.location,'university',c.university,'major',c.major,'experience_level',c.experience_level,'tools',c.tools,'languages',c.languages,'availability',c.availability,'avatar_url',c.avatar_url,'cover_url',c.cover_url,'skill_ids',coalesce((select jsonb_agg(skill_id) from creator_skills where creator_id=c.id),'[]'),'category_ids',coalesce((select jsonb_agg(category_id) from creator_categories where creator_id=c.id),'[]')),'public',public_creator_detail(c.slug),'portfolio',coalesce((select jsonb_agg(to_jsonb(item)-'idempotency_key' order by item.created_at desc,item.id) from creator_portfolio item where creator_id=c.id),'[]'));
end $$;
create function creator_profile_action(actor_id uuid,operation text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public as $$
declare c creator_profiles;item creator_portfolio;before_value jsonb;after_value jsonb;img text:=payload->>'image_url';sid uuid;
begin
 select cp.* into c from creator_profiles cp join profiles person on person.id=cp.profile_id and person.active and person.role in ('CREATOR','STUDENT_CREATOR') join creator_company_agreements agreement on agreement.creator_id=cp.id where person.id=actor_id for update of cp;
 if c.id is null then raise exception 'Cần hồ sơ Creator được Admin cấp và hợp đồng hợp tác.';end if;
 perform set_config('app.actor',actor_id::text,true);before_value:=to_jsonb(c);
 if operation='save' then
  if coalesce(length(btrim(payload->>'display_name')),0) not between 1 and 150 or coalesce(length(btrim(payload->>'title')),0) not between 1 and 200 or coalesce(length(payload->>'bio'),0)>5000 or coalesce(payload->>'availability','') not in ('AVAILABLE','LIMITED','UNAVAILABLE') or coalesce(payload->>'experience_level','') not in ('STUDENT','JUNIOR','MID','SENIOR','LEAD') then raise exception 'Thông tin hồ sơ không hợp lệ.';end if;
  if jsonb_typeof(payload->'skill_ids') is distinct from 'array' or jsonb_typeof(payload->'category_ids') is distinct from 'array' or jsonb_array_length(payload->'skill_ids')>30 or jsonb_array_length(payload->'category_ids')>10 then raise exception 'Chọn tối đa 30 kỹ năng và 10 chuyên môn.';end if;
  if exists(select 1 from jsonb_array_elements_text(payload->'skill_ids') x where not exists(select 1 from skills where id=x::uuid and active)) or exists(select 1 from jsonb_array_elements_text(payload->'category_ids') x where not exists(select 1 from categories where id=x::uuid and active)) then raise exception 'Kỹ năng/chuyên môn không hoạt động.';end if;
  if jsonb_typeof(payload->'tools') is distinct from 'array' or jsonb_typeof(payload->'languages') is distinct from 'array' or jsonb_array_length(payload->'tools')>20 or jsonb_array_length(payload->'languages') not between 1 and 10 then raise exception 'Danh sách công cụ/ngôn ngữ không hợp lệ.';end if;
  update creator_profiles set display_name=btrim(payload->>'display_name'),title=btrim(payload->>'title'),bio=btrim(payload->>'bio'),location=btrim(payload->>'location'),university=nullif(btrim(payload->>'university'),''),major=nullif(btrim(payload->>'major'),''),experience_level=payload->>'experience_level',availability=payload->>'availability',tools=array(select distinct btrim(value) from jsonb_array_elements_text(payload->'tools')),languages=array(select distinct btrim(value) from jsonb_array_elements_text(payload->'languages')) where id=c.id returning to_jsonb(creator_profiles) into after_value;
  delete from creator_skills where creator_id=c.id and skill_id not in(select value::uuid from jsonb_array_elements_text(payload->'skill_ids'));insert into creator_skills(creator_id,skill_id) select c.id,value::uuid from jsonb_array_elements_text(payload->'skill_ids') on conflict do nothing;
  delete from creator_categories where creator_id=c.id and category_id not in(select value::uuid from jsonb_array_elements_text(payload->'category_ids'));insert into creator_categories(creator_id,category_id) select c.id,value::uuid from jsonb_array_elements_text(payload->'category_ids') on conflict do nothing;
  sid:=c.id;
 elsif operation='cover' then
  if img !~ ('^https://[^[:space:]]+/storage/v1/object/public/creator-profile-assets/'||actor_id||'/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$') or img is null then raise exception 'Ảnh bìa không thuộc tài khoản.';end if;
  if not exists(select 1 from storage.objects where bucket_id='creator-profile-assets' and name=split_part(img,'/storage/v1/object/public/creator-profile-assets/',2)) then raise exception 'Ảnh bìa chưa được tải lên.';end if;
  update creator_profiles set cover_url=img where id=c.id returning to_jsonb(creator_profiles) into after_value;sid:=c.id;
 elsif operation in ('portfolio_save','portfolio_delete') then
  if payload->>'id' is not null then select * into item from creator_portfolio where id=(payload->>'id')::uuid and creator_id=c.id for update;if item.id is null then raise exception 'Không tìm thấy portfolio của bạn.';end if;end if;
  before_value:=to_jsonb(item);
  if operation='portfolio_delete' then
   if item.id is null then raise exception 'Chọn portfolio cần xóa.';end if;sid:=item.id;delete from creator_portfolio where id=item.id;
  else
   if coalesce(length(btrim(payload->>'title')),0) not between 1 and 200 or coalesce(length(payload->>'description'),0)>5000 or payload->>'idempotency_key' is null or payload->>'rights_confirmed' is distinct from 'true' then raise exception 'Cần tiêu đề, khóa gửi và xác nhận quyền công khai portfolio.';end if;
   if img is not null and img !~ ('^https://[^[:space:]]+/storage/v1/object/public/creator-profile-assets/'||actor_id||'/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$') then raise exception 'Ảnh portfolio không thuộc tài khoản.';end if;
   if img is not null and not exists(select 1 from storage.objects where bucket_id='creator-profile-assets' and name=split_part(img,'/storage/v1/object/public/creator-profile-assets/',2)) then raise exception 'Ảnh portfolio chưa được tải lên.';end if;
   if payload->>'project_url' is not null and payload->>'project_url' !~ '^https://[^[:space:]@]+$' then raise exception 'Đường dẫn dự án cần HTTPS, không chứa thông tin đăng nhập.';end if;
   if item.id is null then
    select * into item from creator_portfolio where creator_id=c.id and idempotency_key=(payload->>'idempotency_key')::uuid;
    if item.id is not null then
     if item.title is distinct from btrim(payload->>'title') or item.description is distinct from btrim(payload->>'description') or item.thumbnail_url is distinct from img or item.category is distinct from btrim(payload->>'category') or item.client is distinct from btrim(payload->>'client') or item.project_url is distinct from payload->>'project_url' or item.project_year is distinct from (payload->>'project_year')::integer then raise exception 'Khóa gửi đã dùng với nội dung khác.';end if;
     return jsonb_build_object('id',item.id,'reused',true);
    end if;
    if (select count(*) from creator_portfolio where creator_id=c.id)>=50 then raise exception 'Hồ sơ có tối đa 50 portfolio.';end if;
    insert into creator_portfolio(creator_id,title,description,thumbnail_url,category,client,project_url,project_year,idempotency_key) values(c.id,btrim(payload->>'title'),btrim(payload->>'description'),img,btrim(payload->>'category'),btrim(payload->>'client'),payload->>'project_url',(payload->>'project_year')::integer,(payload->>'idempotency_key')::uuid) returning * into item;
   else
    -- Preserve historic thumbnail if the existing record predates managed uploads.
    update creator_portfolio set title=btrim(payload->>'title'),description=btrim(payload->>'description'),thumbnail_url=coalesce(img,thumbnail_url),category=btrim(payload->>'category'),client=btrim(payload->>'client'),project_url=payload->>'project_url',project_year=(payload->>'project_year')::integer where id=item.id returning * into item;
   end if;sid:=item.id;after_value:=to_jsonb(item);
  end if;
 else raise exception 'Thao tác hồ sơ chưa được hỗ trợ.';end if;
 insert into audit_logs(actor_id,action,entity,entity_id,old_value,new_value) values(actor_id,'CREATOR_PROFILE_'||upper(operation),case when operation like 'portfolio_%' then 'creator_portfolio' else 'creator_profiles' end,sid,before_value,after_value);
 return jsonb_build_object('id',sid);
end $$;
alter function public_completed_creator_reviews(text,integer) rename to legacy_public_completed_creator_reviews_036;
revoke all on function legacy_public_completed_creator_reviews_036(text,integer) from public,anon,authenticated,service_role;
create function public_completed_creator_reviews(creator_slug text,review_page integer default 1) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare c creator_discovery_projection;items jsonb;
begin
 if review_page is null or review_page not between 1 and 100000 then raise exception 'Trang không hợp lệ.';end if;
 select * into c from creator_discovery_projection where slug=creator_slug;if c.id is null then return null;end if;
 select coalesce(jsonb_agg(to_jsonb(projected)-'order_sort_id' order by submitted_at desc,order_sort_id),'[]') into items from (
 select cr.rating,cr.content,rr.submitted_at,rr.updated_at,cr.order_id order_sort_id,
 case when pref.show_name then coalesce(nullif(person.full_name,''),'Khách hàng') else 'Khách hàng ẩn danh' end customer_name
 from order_creator_reviews cr join orders o on o.id=cr.order_id and o.status='COMPLETED' join order_result_reviews rr on rr.order_id=cr.order_id
 left join order_publication_preferences pref on pref.order_id=cr.order_id left join profiles person on person.id=pref.customer_profile_id
 where cr.creator_id=c.id order by rr.submitted_at desc,cr.order_id limit 10 offset (review_page-1)*10) projected;
 return jsonb_build_object('items',items,'total',c.review_count,'rating',c.rating,'page',review_page,'limit',10);
end $$;
revoke all on function public_completed_creator_reviews(text,integer) from public,anon,authenticated;
grant execute on function public_completed_creator_reviews(text,integer) to service_role;
revoke all on function public_creator_search(jsonb),public_creator_detail(text),creator_profile_state(uuid),creator_profile_action(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public_creator_search(jsonb),public_creator_detail(text),creator_profile_state(uuid),creator_profile_action(uuid,text,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
