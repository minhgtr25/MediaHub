begin;
alter table requests add column team_confirmation_required boolean not null default false;
alter table requests alter column team_confirmation_required set default true;
create table creator_team_settings(id boolean primary key default true check(id),enabled boolean not null default true);
insert into creator_team_settings(id) values(true);
alter table creator_team_settings enable row level security;
revoke all on creator_team_settings from anon,authenticated;
grant all on creator_team_settings to service_role;

create table creator_company_agreements (
 creator_id uuid primary key references creator_profiles(id),agreement_reference text not null check(length(agreement_reference) between 1 and 200),
 signed_at timestamptz not null check(signed_at<=now()),verified_by uuid not null references profiles(id),created_at timestamptz not null default now()
);
create table request_creator_selections (
 request_id uuid not null references requests(id),creator_id uuid not null references creator_profiles(id),proposal_id uuid not null references creator_proposals(id),
 selected_by uuid not null references profiles(id),selected_at timestamptz not null default now(),primary key(request_id,creator_id)
);
create table creator_assignments (
 id uuid primary key default gen_random_uuid(),request_id uuid not null references requests(id),creator_id uuid not null references creator_profiles(id),
 proposal_id uuid not null references creator_proposals(id),work_scope text not null check(length(work_scope) between 1 and 3000),deadline date,
 status text not null default 'PENDING' check(status in ('PENDING','ACCEPTED','DECLINED','EXPIRED','RELEASED','COMPLETED')),
 invited_by uuid not null references profiles(id),invited_at timestamptz not null default now(),expires_at timestamptz not null,
 responded_at timestamptz,response_note text not null default '',unique(request_id,creator_id),check(expires_at>invited_at)
);
create unique index creator_single_reservation on creator_assignments(creator_id) where status in ('PENDING','ACCEPTED');
create index creator_request_team on creator_assignments(request_id,status);
create function audit_creator_assignment() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into audit_logs(actor_id,action,entity,entity_id,old_value,new_value)
 values(nullif(current_setting('app.actor',true),'')::uuid,'CREATOR_ASSIGNMENT_'||tg_op,'creator_assignments',new.id,case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 return new;
end $$;
create trigger creator_assignment_audit after insert or update on creator_assignments for each row execute function audit_creator_assignment();
revoke all on function audit_creator_assignment() from public,anon,authenticated,service_role;
alter table quotations add column team_snapshot jsonb not null default '[]';
alter table orders add column team_snapshot jsonb not null default '[]';
alter table order_contracts add column team_snapshot jsonb not null default '[]';
alter table conversation_messages add column audience text not null default 'CUSTOMER_STAFF' check(audience in ('CUSTOMER_STAFF','TEAM'));
-- Existing negotiations are private. New shared text is permitted only after acknowledgment.
alter table conversation_messages alter column audience set default 'TEAM';
create function guard_message_audience() returns trigger language plpgsql security definer set search_path=public as $$
declare rid uuid; begin
 select request_id into rid from conversations where id=new.conversation_id;
 if rid is not null and (new.kind in ('QUOTE','ORDER','CONTRACT','PAYMENT','CREATOR_PROPOSAL') or coalesce(new.event_data->>'event','') ~ '^(QUOTE_|ORDER_|CONTRACT_|PAYMENT_)' or not exists(
  select 1 from orders o join contract_acknowledgments a on a.order_id=o.id where o.request_id=rid
 )) then new.audience:='CUSTOMER_STAFF'; end if;
 return new;
end $$;
create trigger message_audience_guard before insert on conversation_messages for each row execute function guard_message_audience();
revoke all on function guard_message_audience() from public,anon,authenticated,service_role;
create function guard_team_snapshot() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_table_name='orders' and tg_op='INSERT' then
  new.team_snapshot:=(select team_snapshot from quotations where id=new.accepted_quotation_id);
 elsif tg_table_name='order_contracts' and tg_op='INSERT' then
  new.team_snapshot:=(select team_snapshot from orders where id=new.order_id);
 elsif tg_op='UPDATE' and new.team_snapshot is distinct from old.team_snapshot and (tg_table_name in ('orders','order_contracts') or old.status<>'DRAFT') then
  raise exception 'Đội của báo giá đã gửi và đơn đã chốt được lưu bất biến.';
 end if;
 return new;
end $$;
create trigger quote_team_snapshot_guard before update on quotations for each row execute function guard_team_snapshot();
create trigger order_team_snapshot_guard before insert or update on orders for each row execute function guard_team_snapshot();
create trigger contract_team_snapshot_guard before insert or update on order_contracts for each row execute function guard_team_snapshot();
revoke all on function guard_team_snapshot() from public,anon,authenticated,service_role;
create table creator_progress_updates (
 id uuid primary key default gen_random_uuid(),assignment_id uuid not null references creator_assignments(id),author_id uuid not null references profiles(id),
 progress integer not null check(progress between 0 and 100),content text not null check(length(content) between 1 and 3000),created_at timestamptz not null default now()
);

create function public.is_creator_participant(rid uuid,pid uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from creator_assignments a join creator_profiles c on c.id=a.creator_id join profiles p on p.id=c.profile_id
 join orders o on o.request_id=a.request_id join contract_acknowledgments ack on ack.order_id=o.id
 where a.request_id=rid and p.id=pid and p.active and p.role in ('CREATOR','STUDENT_CREATOR')
 and a.status in ('ACCEPTED','COMPLETED') and o.status not in ('CANCELLED','REFUNDED'))
$$;
revoke all on function is_creator_participant(uuid,uuid) from public,anon,authenticated,service_role;
create function public.creator_chat_access(rid uuid) returns boolean language sql stable security definer set search_path=public as $$
 select is_creator_participant(rid,(select id from profiles where auth_user_id=auth.uid()))
$$;
revoke all on function creator_chat_access(uuid) from public,anon;
grant execute on function creator_chat_access(uuid) to authenticated,service_role;
-- Do NOT broaden can_access_request: quotation and financial RLS uses that helper.
create or replace function public.is_conversation_member(cid uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from conversations c where c.id=cid and
 ((c.request_id is not null and (can_access_request(c.request_id) or creator_chat_access(c.request_id))) or
 (c.request_id is null and exists(select 1 from conversation_members cm join profiles p on p.id=cm.profile_id
  where cm.conversation_id=cid and p.auth_user_id=auth.uid() and p.active))))
$$;
create function can_read_team_message(cid uuid,message_audience text) returns boolean language sql stable security definer set search_path=public as $$
 select is_conversation_member(cid) and (message_audience='TEAM' or not exists(
  select 1 from profiles p join conversations c on c.id=cid
  where p.auth_user_id=auth.uid() and p.role in ('CREATOR','STUDENT_CREATOR') and c.request_id is not null
 ))
$$;
revoke all on function can_read_team_message(uuid,text) from public,anon;
grant execute on function can_read_team_message(uuid,text) to authenticated,service_role;
drop policy member_messages on conversation_messages;
create policy member_messages on conversation_messages for select to authenticated using(can_read_team_message(conversation_id,audience));
create function public.sync_creator_conversation(rid uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 insert into conversation_members(conversation_id,profile_id)
 select conv.id,c.profile_id from conversations conv join creator_assignments a on a.request_id=conv.request_id
 join creator_profiles c on c.id=a.creator_id where conv.request_id=rid and c.profile_id is not null and is_creator_participant(rid,c.profile_id)
 on conflict do nothing;
end $$;
revoke all on function sync_creator_conversation(uuid) from public,anon,authenticated,service_role;
create function public.creator_contract_participants() returns trigger language plpgsql security definer set search_path=public as $$
begin perform sync_creator_conversation((select request_id from orders where id=new.order_id)); return new; end $$;
create trigger contract_creator_members after insert on contract_acknowledgments for each row execute function creator_contract_participants();
revoke all on function creator_contract_participants() from public,anon,authenticated,service_role;
create or replace function public.touch_conversation_message() returns trigger language plpgsql security definer set search_path=public as $$
declare rid uuid; begin
 select request_id into rid from conversations where id=new.conversation_id;
 update conversations set updated_at=now(),last_message_at=new.created_at,last_message_preview=case when rid is not null and new.audience='CUSTOMER_STAFF' then 'Trao đổi riêng giữa Customer và Staff' else left(new.content,120) end where id=new.conversation_id;
 insert into notifications(user_id,title,message,type,target_path)
 select p.id,'Tin nhắn dịch vụ mới',left(new.content,160),case when rid is null then 'MESSAGE' else 'REQUEST' end,
 case when rid is null then '/messages/'||new.conversation_id else
  case p.role when 'ADMIN' then '/admin/requests/' when 'STAFF' then '/staff/requests/' when 'CREATOR' then '/creator/requests/' when 'STUDENT_CREATOR' then '/creator/requests/' else '/customer/requests/' end||rid end
 from conversation_members cm join profiles p on p.id=cm.profile_id where cm.conversation_id=new.conversation_id and p.id<>new.sender_id and p.active
 and (rid is null or p.role='ADMIN' or (new.audience='TEAM' and is_creator_participant(rid,p.id)) or exists(select 1 from requests r join customers c on c.id=r.customer_id where r.id=rid and
 ((p.role='STAFF' and r.assigned_to=p.id) or (p.role in ('CUSTOMER','BUSINESS') and c.profile_id=p.id))));
 return new;
end $$;

do $$ declare t text; begin
 foreach t in array array['creator_company_agreements','request_creator_selections','creator_assignments','creator_progress_updates'] loop
  execute format('alter table %I enable row level security',t);
  execute format('revoke all on %I from anon,authenticated',t);
  execute format('grant all on %I to service_role',t);
 end loop;
end $$;
-- Creator reads only their invitation through API. Browser realtime access is
-- limited to messages; business/financial records retain their existing RLS.

create function public.creator_team_action(actor_id uuid,rid uuid,operation text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public as $$
declare u profiles; r requests; cp creator_proposals; cr creator_profiles; a creator_assignments; owner_id uuid; op boolean;
 scope text:=btrim(coalesce(payload->>'work_scope','')); reason text:=btrim(coalesce(payload->>'reason','')); minutes integer; previous jsonb;
begin
 select * into u from profiles where id=actor_id and active;
 if u.id is null then raise exception 'Tài khoản không hoạt động.'; end if;
 perform set_config('app.actor',u.id::text,true);
 -- Same lock order as request/commerce dispatch wrappers.
 perform pg_advisory_xact_lock(736231934);
 select * into r from requests where id=rid for update;
 if r.id is null then raise exception 'Không tìm thấy yêu cầu.'; end if;
 select profile_id into owner_id from customers where id=r.customer_id;
 op:=u.role='ADMIN' or (u.role='STAFF' and r.assigned_to=u.id);
 if operation in ('select','deselect') then
  if u.id<>owner_id or u.role not in ('CUSTOMER','BUSINESS') then raise exception 'Chỉ Customer được chọn đội Creator.'; end if;
  if r.status in ('CANCELLED','CONVERTED') or exists(select 1 from quotations where request_id=rid and status<>'CANCELLED') then raise exception 'Đội đã gắn với báo giá; thay đổi phải qua yêu cầu phát sinh.'; end if;
  select * into cp from creator_proposals where id=(payload->>'proposal_id')::uuid and request_id=rid and status in ('PROPOSED','SHORTLISTED','SELECTED') for update;
  if cp.id is null then raise exception 'Đề xuất không còn khả dụng.'; end if;
  if operation='deselect' then
   if exists(select 1 from creator_assignments where request_id=rid and creator_id=cp.creator_id and status in ('PENDING','ACCEPTED')) then raise exception 'Staff cần thu hồi phân công trước khi bỏ chọn.'; end if;
   delete from request_creator_selections where request_id=rid and creator_id=cp.creator_id;
   if r.selected_proposal_id=cp.id then
    update creator_proposals set status='SHORTLISTED' where id=cp.id;
    update requests set selected_proposal_id=null,status='CREATOR_SELECTION' where id=rid;
    select p.* into cp from creator_proposals p join request_creator_selections s on s.proposal_id=p.id where s.request_id=rid order by s.selected_at limit 1;
    if cp.id is not null then perform request_commerce_action(actor_id,rid,'proposal_select',jsonb_build_object('proposal_id',cp.id)); end if;
   end if;
  else
   if (select count(*) from request_creator_selections where request_id=rid)>=10 and not exists(select 1 from request_creator_selections where request_id=rid and creator_id=cp.creator_id) then raise exception 'Tối đa 10 Creator mỗi yêu cầu.'; end if;
   if r.selected_proposal_id is null then perform request_commerce_action(actor_id,rid,'proposal_select',jsonb_build_object('proposal_id',cp.id)); end if;
   insert into request_creator_selections(request_id,creator_id,proposal_id,selected_by) values(rid,cp.creator_id,cp.id,u.id) on conflict do nothing;
  end if;
  perform record_request_event(u.id,rid,'CREATOR_TEAM_SELECTED','Khách hàng cập nhật đội Creator được chọn.',jsonb_build_object('operation',operation),'{}','{}');
 elsif operation='invite' then
  if not op or r.status in ('CANCELLED','CONVERTED') then raise exception 'Chỉ Staff phụ trách được phân công trước khi chốt.'; end if;
  select * into cp from creator_proposals where id=(payload->>'proposal_id')::uuid and request_id=rid;
  if cp.id is null or not exists(select 1 from request_creator_selections where request_id=rid and creator_id=cp.creator_id) then raise exception 'Customer cần chọn Creator trước.'; end if;
  select * into cr from creator_profiles where id=cp.creator_id for update;
  if cr.availability not in ('AVAILABLE','LIMITED') or not exists(select 1 from profiles where id=cr.profile_id and active and role in ('CREATOR','STUDENT_CREATOR'))
   or not exists(select 1 from creator_company_agreements where creator_id=cr.id) then raise exception 'Creator cần tài khoản hoạt động và hợp đồng hợp tác đã được Admin xác nhận.'; end if;
  minutes:=coalesce((payload->>'response_minutes')::integer,15);
  if minutes not between 5 and 15 or length(scope) not between 1 and 3000 or nullif(payload->>'deadline','') is null or (payload->>'deadline')::date<(now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'Phạm vi và thời gian phản hồi 5–15 phút là bắt buộc.'; end if;
  update creator_assignments set status='EXPIRED',responded_at=clock_timestamp(),response_note='Hết thời gian giữ chỗ.' where creator_id=cr.id and status='PENDING' and expires_at<=clock_timestamp();
  select * into a from creator_assignments where creator_id=cr.id and status in ('PENDING','ACCEPTED');
  if a.id is not null then
   if a.request_id=rid and a.work_scope=scope and a.deadline is not distinct from (payload->>'deadline')::date then return jsonb_build_object('id',a.id,'reused',true); end if;
   raise exception 'Creator đang được giữ chỗ hoặc đang thực hiện dự án khác.';
  end if;
  insert into creator_assignments(request_id,creator_id,proposal_id,work_scope,deadline,invited_by,expires_at)
   values(rid,cr.id,cp.id,scope,(payload->>'deadline')::date,u.id,clock_timestamp()+make_interval(mins=>minutes))
   on conflict(request_id,creator_id) do update set work_scope=excluded.work_scope,deadline=excluded.deadline,status='PENDING',invited_by=excluded.invited_by,
    invited_at=clock_timestamp(),expires_at=excluded.expires_at,responded_at=null,response_note='' returning * into a;
  insert into notifications(user_id,title,message,type,target_path) values(cr.profile_id,'Xác nhận nhận việc',r.title||': '||scope,'REQUEST','/creator/assignments/'||a.id);
  perform record_request_event(u.id,rid,'CREATOR_INVITED',cr.display_name||' được mời xác nhận phần việc.',jsonb_build_object('assignment_id',a.id),'{}','{}');
 elsif operation in ('accept','decline') then
  select * into a from creator_assignments where id=(payload->>'assignment_id')::uuid and request_id=rid for update;
  if a.id is null or not exists(select 1 from creator_profiles where id=a.creator_id and profile_id=u.id) or u.role not in ('CREATOR','STUDENT_CREATOR') then raise exception 'Chỉ Creator được phân công mới được phản hồi.'; end if;
  if operation='accept' and a.status='ACCEPTED' then return jsonb_build_object('id',a.id,'reused',true); end if;
  if a.status<>'PENDING' or a.expires_at<=clock_timestamp() or r.status='CANCELLED' then raise exception 'Lời mời đã hết hạn hoặc không còn khả dụng.'; end if;
  if operation='decline' and length(reason) not between 1 and 2000 then raise exception 'Cần lý do từ chối.'; end if;
  update creator_assignments set status=case operation when 'accept' then 'ACCEPTED' else 'DECLINED' end,responded_at=now(),response_note=reason where id=a.id;
  perform sync_creator_conversation(rid);
  insert into notifications(user_id,title,message,type,target_path) values(r.assigned_to,'Creator đã phản hồi',r.title||': '||case operation when 'accept' then 'Đồng ý nhận việc' else 'Từ chối: '||reason end,'REQUEST','/staff/requests/'||rid);
  perform record_request_event(u.id,rid,'CREATOR_RESPONSE',u.full_name||case operation when 'accept' then ' xác nhận nhận việc.' else ' từ chối nhận việc.' end,jsonb_build_object('assignment_id',a.id),'{}','{}');
 elsif operation in ('release','expire') then
  if not op then raise exception 'Chỉ người phụ trách được thu hồi phân công.'; end if;
  select * into a from creator_assignments where id=(payload->>'assignment_id')::uuid and request_id=rid for update;
  if a.id is null then raise exception 'Không tìm thấy phân công.'; end if;
  if operation='expire' then
   if a.status<>'PENDING' or a.expires_at>clock_timestamp() then raise exception 'Lời mời chưa hết hạn.'; end if;
  else
   if length(reason) not between 1 and 2000 or a.status not in ('PENDING','ACCEPTED') or exists(select 1 from quotations where request_id=rid and status<>'CANCELLED') then raise exception 'Thu hồi cần lý do và chưa chốt báo giá; thay đổi sau chốt cần phụ lục.'; end if;
  end if;
  update creator_assignments set status=case operation when 'expire' then 'EXPIRED' else 'RELEASED' end,responded_at=now(),response_note=reason where id=a.id;
  perform record_request_event(u.id,rid,'CREATOR_RELEASED','Phân công Creator đã được thu hồi.',jsonb_build_object('assignment_id',a.id),'{}','{}',reason);
 elsif operation='progress' then
  select * into a from creator_assignments where id=(payload->>'assignment_id')::uuid and request_id=rid and status='ACCEPTED' for update;
  if a.id is null or not exists(select 1 from creator_profiles where id=a.creator_id and profile_id=u.id) or not is_creator_participant(rid,u.id) then raise exception 'Chỉ Creator phụ trách được cập nhật.'; end if;
  if not exists(select 1 from projects p join orders o on o.id=p.order_id where o.request_id=rid and p.production_status in ('IN_PROGRESS','ON_HOLD','REVISION')) then raise exception 'Dự án chưa trong giai đoạn thực hiện.'; end if;
  if coalesce((payload->>'progress')::integer,-1) not between 0 and 100 or coalesce(length(btrim(payload->>'content')),0) not between 1 and 3000 then raise exception 'Tiến độ và nội dung chưa hợp lệ.'; end if;
  insert into creator_progress_updates(assignment_id,author_id,progress,content) values(a.id,u.id,(payload->>'progress')::integer,btrim(payload->>'content'));
  perform record_request_event(u.id,rid,'CREATOR_PROGRESS',u.full_name||' cập nhật tiến độ: '||btrim(payload->>'content'),jsonb_build_object('assignment_id',a.id,'progress',(payload->>'progress')::integer),'{}','{}');
 else raise exception 'Thao tác đội Creator chưa hỗ trợ.'; end if;
 return jsonb_build_object('id',coalesce(a.id,cp.id),'request_id',rid);
end $$;
revoke all on function creator_team_action(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function creator_team_action(uuid,uuid,text,jsonb) to service_role;

alter function request_commerce_action(uuid,uuid,text,jsonb) rename to legacy_request_commerce_action_027;
revoke all on function legacy_request_commerce_action_027(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
create function public.request_commerce_action(actor_id uuid,rid uuid,operation text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public as $$
declare response jsonb; cp creator_proposals; restore_preparing boolean:=false;
begin
 if operation='quote_accept' then perform pg_advisory_xact_lock(736231934); end if;
 perform 1 from requests where id=rid for update;
 if operation in ('quote_save','quote_send','quote_accept') and exists(select 1 from creator_team_settings where enabled)
  and exists(select 1 from requests where id=rid and team_confirmation_required) then
  if not exists(select 1 from request_creator_selections where request_id=rid) or exists(
   select 1 from request_creator_selections s left join creator_assignments a on a.request_id=s.request_id and a.creator_id=s.creator_id
   where s.request_id=rid and (a.id is null or a.status<>'ACCEPTED' or not exists(select 1 from creator_profiles c join profiles p on p.id=c.profile_id join creator_company_agreements agr on agr.creator_id=c.id where c.id=s.creator_id and p.active and p.role in ('CREATOR','STUDENT_CREATOR')))
  ) then raise exception 'Mọi Creator trong đội đã chọn cần xác nhận trước khi chốt báo giá.'; end if;
 end if;
 if operation in ('proposal_withdraw','proposal_reject') and exists(select 1 from request_creator_selections where request_id=rid and proposal_id=(payload->>'proposal_id')::uuid) then raise exception 'Bỏ chọn trong đội và thu hồi phân công trước khi từ chối/thu hồi đề xuất.'; end if;
 if operation='propose' and exists(select 1 from requests where id=rid and status='QUOTE_PREPARING') and not exists(select 1 from quotations where request_id=rid and status<>'CANCELLED') then
  restore_preparing:=true; update requests set status='CREATOR_SELECTION' where id=rid;
 end if;
 response:=legacy_request_commerce_action_027(actor_id,rid,operation,payload);
 if restore_preparing then update requests set status='QUOTE_PREPARING' where id=rid; end if;
 if operation='quote_save' then
  update quotations set team_snapshot=coalesce((select jsonb_agg(jsonb_build_object('creator',p.creator_snapshot,'work_scope',a.work_scope,'deadline',a.deadline,'assignment_id',a.id) order by s.selected_at,s.creator_id)
   from request_creator_selections s join creator_proposals p on p.id=s.proposal_id left join creator_assignments a on a.request_id=s.request_id and a.creator_id=s.creator_id where s.request_id=rid),'[]') where id=(response->>'id')::uuid and status='DRAFT';
 end if;
 if operation='proposal_select' then
  select * into cp from creator_proposals where id=(payload->>'proposal_id')::uuid and request_id=rid;
  insert into request_creator_selections(request_id,creator_id,proposal_id,selected_by) values(rid,cp.creator_id,cp.id,actor_id) on conflict do nothing;
 end if;
 return response;
end $$;
revoke all on function request_commerce_action(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function request_commerce_action(uuid,uuid,text,jsonb) to service_role;

alter function request_action(uuid,uuid,text,jsonb) rename to legacy_request_action_027;
revoke all on function legacy_request_action_027(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
create function public.request_action(actor_id uuid,rid uuid,operation text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public as $$
declare conv uuid; mid uuid; u profiles; r requests; message_audience text:=coalesce(payload->>'audience','TEAM'); is_creator boolean; response jsonb;
begin
 select * into u from profiles where id=actor_id and active;
 is_creator:=coalesce(u.role in ('CREATOR','STUDENT_CREATOR'),false);
 if is_creator or operation='message' then
  select * into r from requests where id=rid for update;
  if u.id is null or r.id is null or operation not in ('read','message') or not (
   (is_creator and is_creator_participant(rid,actor_id)) or u.role='ADMIN' or
   (u.role='STAFF' and r.assigned_to=u.id) or (u.role in ('CUSTOMER','BUSINESS') and exists(select 1 from customers where id=r.customer_id and profile_id=u.id))
  ) then raise exception 'Không có quyền hội thoại dự án.'; end if;
  select id into conv from conversations where request_id=rid;
  if operation='message' then
   if r.status='CANCELLED' or (r.status='CONVERTED' and not exists(select 1 from orders where request_id=rid and status not in ('COMPLETED','CANCELLED','REFUNDED')))
    or coalesce(length(btrim(payload->>'content')),0) not between 1 and 5000 or message_audience not in ('TEAM','CUSTOMER_STAFF')
    or (is_creator and message_audience<>'TEAM') then raise exception 'Hội thoại đã đóng hoặc tin nhắn chưa hợp lệ.'; end if;
   insert into conversation_messages(conversation_id,sender_id,content,audience) values(conv,actor_id,btrim(payload->>'content'),message_audience) returning id into mid;
  end if;
  update conversation_members set last_read_at=now() where conversation_id=conv and profile_id=actor_id;
  return jsonb_build_object('id',rid,'message_id',mid);
 end if;
 response:=legacy_request_action_027(actor_id,rid,operation,payload);
 if operation='cancel' and not exists(select 1 from orders where request_id=rid) then
  perform set_config('app.actor',actor_id::text,true);
  update creator_assignments set status='RELEASED',responded_at=now(),response_note='Yêu cầu tư vấn đã hủy trước khi chốt đơn.' where request_id=rid and status in ('PENDING','ACCEPTED');
 end if;
 return response;
end $$;
revoke all on function request_action(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function request_action(uuid,uuid,text,jsonb) to service_role;

alter function order_action(uuid,uuid,text,jsonb) rename to legacy_order_action_027;
revoke all on function legacy_order_action_027(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
create function public.order_action(actor_id uuid,oid uuid,operation text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public as $$ declare response jsonb; begin
 response:=legacy_order_action_027(actor_id,oid,operation,payload);
 if operation='assign' then perform sync_creator_conversation((select request_id from orders where id=oid)); end if;
 return response;
end $$;
revoke all on function order_action(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function order_action(uuid,uuid,text,jsonb) to service_role;

alter function manage_user(uuid,uuid,text,boolean) rename to legacy_manage_user_027;
revoke all on function legacy_manage_user_027(uuid,uuid,text,boolean) from public,anon,authenticated,service_role;
create function public.manage_user(actor_id uuid,target_id uuid,new_role text,new_active boolean) returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if new_role='CREATOR' and not exists(select 1 from profiles where id=target_id and role='CREATOR') and not exists(
  select 1 from creator_profiles c join creator_company_agreements a on a.creator_id=c.id where c.profile_id=target_id
 ) then raise exception 'Cần hồ sơ Creator và hợp đồng hợp tác do Admin xác nhận trước khi cấp quyền.'; end if;
 return legacy_manage_user_027(actor_id,target_id,new_role,new_active);
end $$;
revoke all on function manage_user(uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function manage_user(uuid,uuid,text,boolean) to service_role;

alter function order_production_action(uuid,uuid,text,jsonb) rename to legacy_order_production_action_027;
revoke all on function legacy_order_production_action_027(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
create function order_production_action(actor_id uuid,oid uuid,operation text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public as $$
declare response jsonb; rid uuid;
begin
 if operation='create' or (operation='status' and payload->>'status' in ('READY','IN_PROGRESS')) then
  perform pg_advisory_xact_lock(736231934);
  select request_id into rid from orders where id=oid;
  if exists(select 1 from creator_team_settings where enabled) and exists(select 1 from requests where id=rid and team_confirmation_required) and exists(
   select 1 from request_creator_selections sel left join creator_assignments ass on ass.request_id=sel.request_id and ass.creator_id=sel.creator_id
   where sel.request_id=rid and (ass.status is distinct from 'ACCEPTED' or not exists(select 1 from creator_profiles c join profiles p on p.id=c.profile_id where c.id=sel.creator_id and p.active and p.role in ('CREATOR','STUDENT_CREATOR')))
  ) then raise exception 'Đội Creator chưa đủ điều kiện thực hiện; cần người phụ trách xử lý.'; end if;
 end if;
 response:=legacy_order_production_action_027(actor_id,oid,operation,payload);
 if operation='create' then
  insert into project_team_members(project_id,creator_id,role)
  select (response->>'id')::uuid,(item->'creator'->>'id')::uuid,'CREATOR' from orders o cross join lateral jsonb_array_elements(o.team_snapshot) item where o.id=oid
  on conflict(project_id,creator_id) do nothing;
 end if;
 return response;
end $$;
revoke all on function order_production_action(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function order_production_action(uuid,uuid,text,jsonb) to service_role;

create function onboard_creator(actor_id uuid,cid uuid,target_profile_id uuid,payload jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare c creator_profiles; p profiles; agreement creator_company_agreements; ref text:=btrim(payload->>'agreement_reference'); signed_time timestamptz:=(payload->>'signed_at')::timestamptz;
begin
 if not exists(select 1 from profiles where id=actor_id and active and role='ADMIN') then raise exception 'Chỉ Admin được cấp tài khoản Creator.'; end if;
 perform pg_advisory_xact_lock(736231934);
 select * into c from creator_profiles where id=cid for update;
 select * into p from profiles where id=target_profile_id for update;
 if c.id is null or p.id is null or p.role not in ('CREATOR','STUDENT_CREATOR','CUSTOMER') or (c.profile_id is not null and c.profile_id<>p.id)
  or exists(select 1 from creator_profiles where profile_id=p.id and id<>cid) then raise exception 'Hồ sơ hoặc tài khoản đã thuộc người khác.'; end if;
 if p.role='CUSTOMER' and (exists(select 1 from requests r join customers cu on cu.id=r.customer_id where cu.profile_id=p.id) or exists(select 1 from projects pr join customers cu on cu.id=pr.customer_id where cu.profile_id=p.id)) then raise exception 'Tài khoản Customer có nghiệp vụ cần được xử lý riêng, không tự chuyển quyền.'; end if;
 if coalesce(length(ref),0) not between 1 and 200 or signed_time is null or signed_time>now() then raise exception 'Cần mã hồ sơ hợp tác đã ký và thời điểm ký thực tế.'; end if;
 select * into agreement from creator_company_agreements where creator_id=cid;
 if agreement.creator_id is not null and (agreement.agreement_reference<>ref or agreement.signed_at<>signed_time) then raise exception 'Hồ sơ hợp tác đã ghi nhận không được ghi đè.'; end if;
 insert into creator_company_agreements(creator_id,agreement_reference,signed_at,verified_by) values(cid,ref,signed_time,actor_id) on conflict do nothing;
 update creator_profiles set profile_id=p.id where id=cid;
 perform manage_user(actor_id,p.id,'CREATOR',true);
 insert into audit_logs(actor_id,action,entity,entity_id,new_value) values(actor_id,'CREATOR_ONBOARDED','creator_profiles',cid,jsonb_build_object('profile_id',p.id,'agreement_reference',ref,'signed_at',signed_time));
 return jsonb_build_object('creator_id',cid,'profile_id',p.id);
end $$;
revoke all on function onboard_creator(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function onboard_creator(uuid,uuid,uuid,jsonb) to service_role;
commit;
