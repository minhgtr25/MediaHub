begin;

-- Four new access roles; legacy identity values are retained, not guessed or deleted.
alter function manage_user(uuid,uuid,text,boolean) rename to legacy_manage_user_025;
revoke all on function legacy_manage_user_025(uuid,uuid,text,boolean) from public,anon,authenticated,service_role;
create function public.manage_user(actor_id uuid,target_id uuid,new_role text,new_active boolean) returns jsonb
language plpgsql security definer set search_path=public as $$
begin
 perform pg_advisory_xact_lock(736231934);
 if new_role not in ('CUSTOMER','STAFF','CREATOR','ADMIN')
  and not exists(select 1 from profiles where id=target_id and role=new_role) then
  raise exception 'Chỉ cấp quyền CUSTOMER, STAFF, CREATOR hoặc ADMIN; giữ nguyên danh tính cũ khi chuyển đổi.';
 end if;
 perform legacy_manage_user_025(actor_id,target_id,new_role,new_active);
 perform dispatch_service_requests();
 return jsonb_build_object('id',target_id);
end $$;
revoke all on function manage_user(uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function manage_user(uuid,uuid,text,boolean) to service_role;

create table public.staff_dispatch_settings (
 id boolean primary key default true check(id), enabled boolean not null default true
);
insert into staff_dispatch_settings(id) values(true);
alter table staff_dispatch_settings enable row level security;
revoke all on staff_dispatch_settings from anon,authenticated;
grant all on staff_dispatch_settings to service_role;
alter table profiles add column consultation_idle_since timestamptz not null default now();
alter table profiles add column consultation_busy boolean not null default false;
update profiles p set consultation_busy=exists(
 select 1 from requests r where r.assigned_to=p.id and r.status not in ('CONVERTED','CANCELLED')
) where p.role='STAFF';

-- All consultation mutations take this lock before any request row lock.
-- No backfilled idle history: initial idle time is the feature's installation time.
create function public.dispatch_service_requests() returns integer
language plpgsql security definer set search_path=public as $$
declare person profiles; waiting requests; conv uuid; owner_id uuid; assigned integer:=0;
begin
 perform pg_advisory_xact_lock(736231934);
 if not exists(select 1 from staff_dispatch_settings where id and enabled) then return 0; end if;
 update profiles p set consultation_busy=false,consultation_idle_since=clock_timestamp()
 where p.role='STAFF' and p.consultation_busy and not exists(
  select 1 from requests r where r.assigned_to=p.id and r.status not in ('CONVERTED','CANCELLED'));
 update profiles p set consultation_busy=true where p.role='STAFF' and not p.consultation_busy
 and exists(select 1 from requests r where r.assigned_to=p.id and r.status not in ('CONVERTED','CANCELLED'));
 loop
  select * into waiting from requests where assigned_to is null and status='UNASSIGNED'
   and exists(select 1 from conversations c where c.request_id=requests.id)
   order by created_at,id limit 1 for update;
  if waiting.id is null then exit; end if;
  select * into person from profiles p where p.role='STAFF' and p.active and not p.consultation_busy
   and not exists(select 1 from requests r where r.assigned_to=p.id and r.status not in ('CONVERTED','CANCELLED'))
   order by consultation_idle_since,p.created_at,p.id limit 1 for update;
  if person.id is null then exit; end if;
  select id into conv from conversations where request_id=waiting.id;
  select profile_id into owner_id from customers where id=waiting.customer_id;
  insert into request_assignments(request_id,staff_id,assigned_by,reason)
   values(waiting.id,person.id,person.id,'Hệ thống phân công theo thời gian rảnh lâu nhất.');
  update requests set assigned_to=person.id,status='ASSIGNED',updated_at=now() where id=waiting.id;
  update profiles set consultation_busy=true where id=person.id;
  insert into conversation_members(conversation_id,profile_id) values(conv,person.id) on conflict do nothing;
  perform record_request_event(person.id,waiting.id,'REQUEST_AUTO_ASSIGNED',person.full_name||' được phân công tư vấn.',
   jsonb_build_object('assigned_to',person.id,'automatic',true),
   jsonb_build_object('status','UNASSIGNED','assigned_to',null),jsonb_build_object('status','ASSIGNED','assigned_to',person.id));
  insert into notifications(user_id,title,message,type,target_path) values
   (person.id,'Yêu cầu tư vấn được phân công',waiting.request_number||': '||waiting.title,'REQUEST','/staff/requests/'||waiting.id),
   (owner_id,'Staff đã tiếp nhận yêu cầu',person.full_name||' phụ trách tư vấn cho bạn.','REQUEST','/customer/requests/'||waiting.id);
  assigned:=assigned+1;
 end loop;
 return assigned;
end $$;
revoke all on function dispatch_service_requests() from public,anon,authenticated;
grant execute on function dispatch_service_requests() to service_role;

alter function request_action(uuid,uuid,text,jsonb) rename to legacy_request_action_025;
revoke all on function legacy_request_action_025(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
create function public.request_action(actor_id uuid,rid uuid,operation text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public as $$
declare response jsonb; target uuid;
begin
 if operation in ('create','claim','assign','release','cancel') then perform pg_advisory_xact_lock(736231934); end if;
 if operation in ('claim','assign') and exists(select 1 from staff_dispatch_settings where id and enabled) then
  target:=case when operation='claim' then actor_id else (payload->>'assigned_to')::uuid end;
  if exists(select 1 from profiles where id=target and role='STAFF') and exists(
   select 1 from requests where assigned_to=target and status not in ('CONVERTED','CANCELLED') and id<>rid
  ) then raise exception 'Staff đang tư vấn một khách hàng; chỉ phân công người đang rảnh.'; end if;
 end if;
 response:=legacy_request_action_025(actor_id,rid,operation,payload);
 if operation in ('create','claim','assign','release','cancel') then perform dispatch_service_requests(); end if;
 return response;
end $$;
revoke all on function request_action(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function request_action(uuid,uuid,text,jsonb) to service_role;

alter function request_commerce_action(uuid,uuid,text,jsonb) rename to legacy_request_commerce_action_025;
revoke all on function legacy_request_commerce_action_025(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
create function public.request_commerce_action(actor_id uuid,rid uuid,operation text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public as $$
declare response jsonb;
begin
 if operation='quote_accept' then perform pg_advisory_xact_lock(736231934); end if;
 -- Existing published evidence stays immutable. New quotes obey the approved minimum.
 if operation='quote_save' and coalesce((payload->>'deposit_percent')::numeric,0)<30 then
  raise exception 'Mức cọc tối thiểu là 30 phần trăm.';
 end if;
 response:=legacy_request_commerce_action_025(actor_id,rid,operation,payload);
 if operation='quote_accept' then perform dispatch_service_requests(); end if;
 return response;
end $$;
revoke all on function request_commerce_action(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function request_commerce_action(uuid,uuid,text,jsonb) to service_role;
commit;
