begin;

-- New briefs stay separate from legacy projects. No historical backfill.
create table public.service_packages (
 id uuid primary key default gen_random_uuid(),
 service_id uuid not null references public.services(id),
 name text not null check(length(btrim(name)) between 1 and 150),
 description text not null default '' check(length(description)<=5000),
 starting_price numeric(16,2) check(starting_price between 0 and 1000000000000),
 estimated_days integer check(estimated_days between 1 and 3650),
 deliverables text[] not null default '{}' check(cardinality(deliverables)<=30),
 active boolean not null default false,
 display_order integer not null default 0 check(display_order>=0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(service_id,name)
);
create sequence public.request_number_seq;
create table public.requests (
 id uuid primary key default gen_random_uuid(),
 request_number text not null unique default ('MH-R-'||nextval('public.request_number_seq')),
 customer_id uuid not null references public.customers(id),
 service_id uuid not null references public.services(id),
 package_id uuid references public.service_packages(id),
 package_snapshot jsonb,
 title text not null check(length(btrim(title)) between 1 and 200),
 brief text not null check(length(btrim(brief)) between 1 and 5000),
 budget_min numeric(16,2) check(budget_min between 0 and 1000000000000),
 budget_max numeric(16,2) check(budget_max between 0 and 1000000000000),
 deadline date,
 reference_urls text[] not null default '{}' check(cardinality(reference_urls)<=10),
 creator_preference text not null default 'ADVICE' check(creator_preference in ('ADVICE','PREFERRED')),
 preferred_creator_id uuid references public.creator_profiles(id),
 assigned_to uuid references public.profiles(id),
 status text not null default 'UNASSIGNED' check(status in (
  'UNASSIGNED','ASSIGNED','CONSULTING','WAITING_CUSTOMER','CREATOR_SELECTION','QUOTE_PREPARING',
  'QUOTE_SENT','QUOTE_REVISION','READY_TO_ORDER','CONVERTED','CANCELLED')),
 cancellation_reason text,
 idempotency_key uuid not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(customer_id,idempotency_key),
 check(budget_min is null or budget_max is null or budget_max>=budget_min),
 check((creator_preference='ADVICE' and preferred_creator_id is null) or (creator_preference='PREFERRED' and preferred_creator_id is not null)),
 check(status not in ('ASSIGNED','CONSULTING','WAITING_CUSTOMER') or assigned_to is not null),
 check(status<>'UNASSIGNED' or assigned_to is null)
);
alter sequence public.request_number_seq owned by public.requests.request_number;
create table public.request_assignments (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references public.requests(id),
 staff_id uuid not null references public.profiles(id), assigned_by uuid not null references public.profiles(id),
 reason text not null default '' check(length(reason)<=2000),
 assigned_at timestamptz not null default now(), ended_at timestamptz, ended_by uuid references public.profiles(id),
 end_reason text check(length(end_reason)<=2000)
);
create unique index one_current_request_assignment on public.request_assignments(request_id) where ended_at is null;
create table public.request_notes (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references public.requests(id),
 author_id uuid not null references public.profiles(id),
 content text not null check(length(btrim(content)) between 1 and 5000), created_at timestamptz not null default now()
);
create table public.request_attachments (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references public.requests(id),
 uploaded_by uuid not null references public.profiles(id),
 file_name text not null check(length(file_name) between 1 and 255),
 storage_path text not null unique, file_type text not null,
 file_size bigint not null check(file_size between 1 and 52428800), created_at timestamptz not null default now()
);
alter table public.conversations add column request_id uuid unique references public.requests(id);
alter table public.conversation_messages add column kind text not null default 'TEXT' check(kind in ('TEXT','SYSTEM'));
alter table public.conversation_messages add column event_data jsonb not null default '{}';
alter table public.notifications add column target_path text;
alter table public.audit_logs add column old_value jsonb;
alter table public.audit_logs add column new_value jsonb;
alter table public.audit_logs add column reason text;
alter table public.audit_logs add column metadata jsonb not null default '{}';

create index service_packages_display_idx on public.service_packages(service_id,active,display_order);
create index requests_customer_idx on public.requests(customer_id,created_at desc,id);
create index requests_staff_idx on public.requests(assigned_to,status,updated_at desc);
create index requests_queue_idx on public.requests(created_at,id) where status='UNASSIGNED';
create index requests_service_idx on public.requests(service_id);
create index requests_package_idx on public.requests(package_id);
create index requests_creator_idx on public.requests(preferred_creator_id);
create index request_assignments_history_idx on public.request_assignments(request_id,assigned_at);
create index request_notes_history_idx on public.request_notes(request_id,created_at);
create index request_attachments_request_idx on public.request_attachments(request_id,created_at);
create index conversation_messages_cursor_idx on public.conversation_messages(conversation_id,created_at desc,id desc);
create trigger touch before update on public.requests for each row execute function public.touch_updated();
create trigger touch before update on public.service_packages for each row execute function public.touch_updated();

create function public.can_access_request(rid uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from requests r join customers c on c.id=r.customer_id cross join profiles p
 where r.id=rid and p.auth_user_id=auth.uid() and p.active and
 (p.role='ADMIN' or (p.role in ('CUSTOMER','BUSINESS') and c.profile_id=p.id) or (p.role='STAFF' and r.assigned_to=p.id)))
$$;
create function public.is_active_admin() returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from profiles p where p.auth_user_id=auth.uid() and p.active and p.role='ADMIN')
$$;
revoke all on function public.is_active_admin() from public;
grant execute on function public.is_active_admin() to anon,authenticated,service_role;
create function public.is_request_operator(rid uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from requests r cross join profiles p where r.id=rid and p.auth_user_id=auth.uid() and p.active
 and (p.role='ADMIN' or (p.role='STAFF' and r.assigned_to=p.id)))
$$;
revoke all on function public.can_access_request(uuid),public.is_request_operator(uuid) from public,anon;
grant execute on function public.can_access_request(uuid),public.is_request_operator(uuid) to authenticated,service_role;

do $$ declare t text; begin
 foreach t in array array['service_packages','requests','request_assignments','request_notes','request_attachments'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
revoke all on sequence public.request_number_seq from public,anon,authenticated;
grant usage,select on sequence public.request_number_seq to service_role;
grant select on public.service_packages to anon;
create policy published_package on public.service_packages for select to anon,authenticated using (
 (active and exists(select 1 from public.services s where s.id=service_id and s.active)) or
 public.is_active_admin()
);
create policy request_reader on public.requests for select to authenticated using(public.can_access_request(id));
create policy attachment_reader on public.request_attachments for select to authenticated using(public.can_access_request(request_id));
create policy assignment_reader on public.request_assignments for select to authenticated using(public.is_request_operator(request_id));
create policy note_reader on public.request_notes for select to authenticated using(public.is_request_operator(request_id));

-- Linked commercial conversations derive access from current ownership/assignment;
-- historic direct conversations retain active member-only access.
create or replace function public.is_conversation_member(cid uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from conversations c where c.id=cid and
 ((c.request_id is not null and public.can_access_request(c.request_id)) or
 (c.request_id is null and exists(select 1 from conversation_members cm join profiles p on p.id=cm.profile_id
  where cm.conversation_id=cid and p.auth_user_id=auth.uid() and p.active))))
$$;
create or replace function public.touch_conversation_message() returns trigger
language plpgsql security definer set search_path=public as $$
declare rid uuid;
begin
 update conversations set updated_at=now(),last_message_at=new.created_at,last_message_preview=left(new.content,120)
 where id=new.conversation_id returning request_id into rid;
 insert into notifications(user_id,title,message,type,target_path)
 select p.id,case when rid is null then 'Tin nhắn mới' else 'Cập nhật yêu cầu dịch vụ' end,left(new.content,160),
 case when rid is null then 'MESSAGE' else 'REQUEST' end,
 case when rid is null then '/messages/'||new.conversation_id else
  case p.role when 'ADMIN' then '/admin/requests/' when 'STAFF' then '/staff/requests/' else '/customer/requests/' end||rid end
 from conversation_members cm join profiles p on p.id=cm.profile_id
 where cm.conversation_id=new.conversation_id and p.id<>new.sender_id and p.active and
 (rid is null or p.role='ADMIN' or
  exists(select 1 from requests r join customers c on c.id=r.customer_id where r.id=rid and
   ((p.role='STAFF' and r.assigned_to=p.id) or (p.role in ('CUSTOMER','BUSINESS') and c.profile_id=p.id))));
 return new;
end $$;

create function public.save_service_package(actor_id uuid,package_id uuid,payload jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare u profiles; pack service_packages; previous jsonb;
begin
 select * into u from profiles where id=actor_id and active;
 if u.id is null or u.role<>'ADMIN' then raise exception 'Chỉ quản trị viên được quản lý gói dịch vụ.'; end if;
 if not exists(select 1 from services where id=(payload->>'service_id')::uuid) then raise exception 'Không tìm thấy dịch vụ.'; end if;
 if package_id is not null then
  select * into pack from service_packages where id=package_id for update;
  if pack.id is null then raise exception 'Không tìm thấy gói dịch vụ.'; end if;
  previous:=to_jsonb(pack);
  if pack.service_id<>(payload->>'service_id')::uuid then raise exception 'Không thể chuyển gói sang dịch vụ khác.'; end if;
 end if;
 insert into service_packages(id,service_id,name,description,starting_price,estimated_days,deliverables,active,display_order)
 values(coalesce(package_id,gen_random_uuid()),(payload->>'service_id')::uuid,btrim(payload->>'name'),coalesce(payload->>'description',''),
  nullif(payload->>'starting_price','')::numeric,nullif(payload->>'estimated_days','')::integer,
  array(select jsonb_array_elements_text(coalesce(payload->'deliverables','[]'))),
  coalesce((payload->>'active')::boolean,false),coalesce((payload->>'display_order')::integer,0))
 on conflict(id) do update set name=excluded.name,description=excluded.description,starting_price=excluded.starting_price,
  estimated_days=excluded.estimated_days,deliverables=excluded.deliverables,active=excluded.active,display_order=excluded.display_order
 returning * into pack;
 insert into audit_logs(actor_id,action,entity,entity_id,old_value,new_value)
 values(u.id,case when previous is null then 'PACKAGE_CREATED' else 'PACKAGE_UPDATED' end,'service_packages',pack.id,previous,to_jsonb(pack));
 return jsonb_build_object('id',pack.id);
end $$;

create function public.request_action(actor_id uuid,rid uuid,operation text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public as $$
declare u profiles; r requests; s services; pack service_packages; cid uuid; owner_id uuid; conv uuid;
 target profiles; key uuid; previous jsonb; action_reason text:=btrim(coalesce(payload->>'reason',''));
 event_text text; event_kind text; message_id uuid; allowed boolean; pack_snapshot jsonb;
begin
 select * into u from profiles where id=actor_id and active;
 if u.id is null or u.role not in ('CUSTOMER','BUSINESS','STAFF','ADMIN') then raise exception 'Tài khoản không có quyền xử lý yêu cầu.'; end if;
 if operation='create' then
  if u.role not in ('CUSTOMER','BUSINESS') then raise exception 'Chỉ khách hàng được gửi yêu cầu dịch vụ.'; end if;
  select id into cid from customers where profile_id=u.id;
  if cid is null then raise exception 'Hồ sơ khách hàng chưa đầy đủ.'; end if;
  key:=(payload->>'idempotency_key')::uuid;
  if key is null then raise exception 'Thiếu mã chống gửi lặp.'; end if;
  -- Concurrent retries serialize on the same customer/key, then reuse the original brief.
  perform pg_advisory_xact_lock(hashtextextended(cid::text||key::text,0));
  select * into r from requests where customer_id=cid and idempotency_key=key;
  if r.id is not null then return jsonb_build_object('id',r.id,'reused',true); end if;
  select * into s from services where id=(payload->>'service_id')::uuid and active for share;
  if s.id is null then raise exception 'Vui lòng chọn dịch vụ đang hoạt động.'; end if;
  if nullif(payload->>'package_id','') is not null then
   select * into pack from service_packages where id=(payload->>'package_id')::uuid and service_id=s.id and active for share;
   if pack.id is null then raise exception 'Gói dịch vụ không thuộc dịch vụ đã chọn hoặc đã ngừng cung cấp.'; end if;
   pack_snapshot:=jsonb_build_object('name',pack.name,'description',pack.description,'starting_price',pack.starting_price,'estimated_days',pack.estimated_days,'deliverables',pack.deliverables);
  end if;
  if nullif(payload->>'deadline','')::date<current_date then raise exception 'Ngày mong muốn không được ở quá khứ.'; end if;
  if payload->>'creator_preference'='PREFERRED' and not exists(select 1 from creator_profiles where id=(payload->>'preferred_creator_id')::uuid and availability<>'UNAVAILABLE') then raise exception 'Creator đã chọn chưa sẵn sàng nhận yêu cầu.'; end if;
  if exists(select 1 from jsonb_array_elements_text(coalesce(payload->'reference_urls','[]')) url where url!~'^https://[^[:space:]]+$') then raise exception 'Link tham khảo phải sử dụng HTTPS.'; end if;
  insert into requests(customer_id,service_id,package_id,package_snapshot,title,brief,budget_min,budget_max,deadline,reference_urls,creator_preference,preferred_creator_id,idempotency_key)
  values(cid,s.id,pack.id,pack_snapshot,btrim(payload->>'title'),btrim(payload->>'brief'),
   nullif(payload->>'budget_min','')::numeric,nullif(payload->>'budget_max','')::numeric,nullif(payload->>'deadline','')::date,
   array(select jsonb_array_elements_text(coalesce(payload->'reference_urls','[]'))),coalesce(payload->>'creator_preference','ADVICE'),nullif(payload->>'preferred_creator_id','')::uuid,key)
  returning * into r;
  insert into conversations(subject,request_id) values(r.title,r.id) returning id into conv;
  insert into conversation_members(conversation_id,profile_id,last_read_at) values(conv,u.id,now());
  insert into conversation_messages(conversation_id,sender_id,content,kind,event_data)
  values(conv,u.id,'Yêu cầu đã gửi. MediaHub sẽ tiếp nhận và tư vấn phạm vi dịch vụ.','SYSTEM','{"event":"REQUEST_CREATED"}');
  insert into notifications(user_id,title,message,type,target_path)
  select id,'Yêu cầu dịch vụ mới',r.request_number||': '||r.title,'REQUEST',
   case role when 'ADMIN' then '/admin/requests' else '/staff/requests?scope=queue' end
  from profiles where active and role in ('STAFF','ADMIN');
  insert into audit_logs(actor_id,action,entity,entity_id,new_value)
  values(u.id,'REQUEST_CREATED','requests',r.id,jsonb_build_object('status',r.status,'service_id',r.service_id,'package_id',r.package_id));
  return jsonb_build_object('id',r.id,'conversation_id',conv,'reused',false);
 end if;
 select * into r from requests where id=rid for update;
 if r.id is null then raise exception 'Không tìm thấy yêu cầu.'; end if;
 select profile_id into owner_id from customers where id=r.customer_id;
 allowed:=u.role='ADMIN' or (u.role in ('CUSTOMER','BUSINESS') and owner_id=u.id) or (u.role='STAFF' and r.assigned_to=u.id);
 if operation='claim' then
  if u.role not in ('STAFF','ADMIN') or r.status<>'UNASSIGNED' or r.assigned_to is not null then raise exception 'Yêu cầu đã được tiếp nhận hoặc bạn không có quyền nhận.'; end if;
 elsif not allowed then raise exception 'Không có quyền truy cập yêu cầu này.';
 end if;
 select id into conv from conversations where request_id=r.id;
 if conv is null then raise exception 'Hội thoại yêu cầu chưa được thiết lập.'; end if;
 previous:=jsonb_build_object('status',r.status,'assigned_to',r.assigned_to);
 if operation='read' then
  update conversation_members set last_read_at=now() where conversation_id=conv and profile_id=u.id;
  return jsonb_build_object('id',r.id);
 end if;
 if r.status in ('CANCELLED','CONVERTED') then raise exception 'Yêu cầu đã đóng; không thể thay đổi.'; end if;
 if operation in ('claim','assign','release','status','note') and u.role not in ('STAFF','ADMIN') then raise exception 'Chỉ nhân viên phụ trách hoặc quản trị viên được thực hiện.'; end if;
 if operation in ('claim','assign','release') and r.status not in ('UNASSIGNED','ASSIGNED','CONSULTING','WAITING_CUSTOMER') then raise exception 'Chỉ được chuyển phân công trong giai đoạn tư vấn.'; end if;
 if operation in ('claim','assign') then
  if operation='claim' then target:=u;
  else
   select * into target from profiles where id=(payload->>'assigned_to')::uuid and active and role in ('STAFF','ADMIN');
   if target.id is null then raise exception 'Vui lòng chọn nhân viên đang hoạt động.'; end if;
  end if;
  if r.assigned_to=target.id then return jsonb_build_object('id',r.id); end if;
  if r.assigned_to is not null and length(action_reason) not between 1 and 2000 then raise exception 'Cần ghi lý do chuyển người phụ trách.'; end if;
  update request_assignments set ended_at=now(),ended_by=u.id,end_reason=action_reason where request_id=r.id and ended_at is null;
  insert into request_assignments(request_id,staff_id,assigned_by,reason) values(r.id,target.id,u.id,action_reason);
  update requests set assigned_to=target.id,status='ASSIGNED' where id=r.id returning * into r;
  delete from conversation_members where conversation_id=conv and profile_id<>owner_id;
  insert into conversation_members(conversation_id,profile_id) values(conv,target.id) on conflict do nothing;
  event_kind:=case when previous->>'assigned_to' is null then 'REQUEST_ASSIGNED' else 'REQUEST_TRANSFERRED' end;
  event_text:=target.full_name||' đã được phân công phụ trách yêu cầu.';
 elsif operation='release' then
  if r.assigned_to is null or length(action_reason) not between 1 and 2000 then raise exception 'Cần có người phụ trách và lý do trả về hàng đợi.'; end if;
  update request_assignments set ended_at=now(),ended_by=u.id,end_reason=action_reason where request_id=r.id and ended_at is null;
  update requests set assigned_to=null,status='UNASSIGNED' where id=r.id returning * into r;
  delete from conversation_members where conversation_id=conv and profile_id<>owner_id;
  event_kind:='REQUEST_RELEASED'; event_text:='Yêu cầu đã trở lại hàng đợi để MediaHub phân công người phù hợp.';
 elsif operation='status' then
  if not ((r.status='ASSIGNED' and payload->>'status'='CONSULTING') or (r.status='CONSULTING' and payload->>'status'='WAITING_CUSTOMER') or (r.status='WAITING_CUSTOMER' and payload->>'status'='CONSULTING')) then raise exception 'Chuyển trạng thái tư vấn không hợp lệ.'; end if;
  update requests set status=payload->>'status' where id=r.id returning * into r;
  event_kind:='REQUEST_STATUS'; event_text:=case r.status when 'CONSULTING' then 'Nhân viên phụ trách đang tư vấn và làm rõ yêu cầu.' else 'Đang chờ khách hàng bổ sung thông tin.' end;
 elsif operation='cancel' then
  if u.role='STAFF' then raise exception 'Nhân viên có thể trả về hàng đợi; khách hàng hoặc admin mới được hủy.'; end if;
  if length(action_reason) not between 1 and 2000 then raise exception 'Vui lòng ghi lý do hủy yêu cầu.'; end if;
  update request_assignments set ended_at=now(),ended_by=u.id,end_reason=action_reason where request_id=r.id and ended_at is null;
  update requests set status='CANCELLED',cancellation_reason=action_reason where id=r.id returning * into r;
  event_kind:='REQUEST_CANCELLED'; event_text:='Yêu cầu đã được hủy. Lý do: '||action_reason;
 elsif operation='note' then
  if length(btrim(payload->>'content')) not between 1 and 5000 then raise exception 'Ghi chú không hợp lệ.'; end if;
  insert into request_notes(request_id,author_id,content) values(r.id,u.id,btrim(payload->>'content')) returning id into message_id;
  insert into audit_logs(actor_id,action,entity,entity_id,metadata) values(u.id,'REQUEST_NOTE','requests',r.id,jsonb_build_object('note_id',message_id));
  return jsonb_build_object('id',r.id);
 elsif operation='message' then
  if length(btrim(payload->>'content')) not between 1 and 5000 then raise exception 'Tin nhắn không hợp lệ.'; end if;
  insert into conversation_messages(conversation_id,sender_id,content) values(conv,u.id,btrim(payload->>'content')) returning id into message_id;
  update conversation_members set last_read_at=now() where conversation_id=conv and profile_id=u.id;
  update requests set updated_at=now() where id=r.id;
  return jsonb_build_object('id',r.id,'message_id',message_id);
 elsif operation='attachment' then
  if (select count(*) from request_attachments where request_id=r.id)>=20 then raise exception 'Tối đa 20 tệp tham khảo mỗi yêu cầu.'; end if;
  if coalesce(payload->>'path','')!~('^requests/'||r.id||'/[0-9a-f-]{36}\.(pdf|png|jpg|jpeg|webp|mp4|mov)$') then raise exception 'Đường dẫn tệp không hợp lệ.'; end if;
  insert into request_attachments(request_id,uploaded_by,file_name,storage_path,file_type,file_size)
  values(r.id,u.id,payload->>'name',payload->>'path',payload->>'type',(payload->>'size')::bigint) returning id into message_id;
  event_kind:='REQUEST_ATTACHMENT'; event_text:=u.full_name||' đã thêm tệp tham khảo: '||left(payload->>'name',255);
 else raise exception 'Thao tác yêu cầu chưa được hỗ trợ.';
 end if;
 insert into conversation_messages(conversation_id,sender_id,content,kind,event_data)
 values(conv,u.id,event_text,'SYSTEM',jsonb_build_object('event',event_kind,'status',r.status));
 insert into audit_logs(actor_id,action,entity,entity_id,old_value,new_value,reason,metadata)
 values(u.id,event_kind,'requests',r.id,previous,jsonb_build_object('status',r.status,'assigned_to',r.assigned_to),nullif(action_reason,''),jsonb_build_object('attachment_id',message_id));
 return jsonb_build_object('id',r.id,'conversation_id',conv);
end $$;
revoke all on function public.request_action(uuid,uuid,text,jsonb),public.save_service_package(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.request_action(uuid,uuid,text,jsonb),public.save_service_package(uuid,uuid,jsonb) to service_role;

commit;
