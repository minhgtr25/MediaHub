begin;

create or replace function public.admin_manage_creator_showcase(actor_id uuid, operation text, payload jsonb default '{}') returns jsonb
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
 select to_jsonb(creator_row)||jsonb_build_object('category_ids',coalesce((select jsonb_agg(category_id) from public.creator_categories where creator_id=cid),'[]'::jsonb),'skill_ids',coalesce((select jsonb_agg(skill_id) from public.creator_skills where creator_id=cid),'[]'::jsonb)) into output from public.creator_profiles creator_row where creator_row.id=cid;
 return output;
end $$;

revoke all on function public.admin_manage_creator_showcase(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.admin_manage_creator_showcase(uuid,text,jsonb) to service_role;

commit;
