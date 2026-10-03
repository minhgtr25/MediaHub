begin;
alter table projects add column order_id uuid unique references orders(id);
alter table projects add column production_status text check(production_status in ('PLANNING','READY','IN_PROGRESS','ON_HOLD','WAITING_REVIEW','REVISION','READY_TO_DELIVER','DELIVERED','COMPLETED','CANCELLED'));
alter table projects add constraint project_origin_status check((order_id is null and production_status is null) or (order_id is not null and production_status is not null));
alter table project_milestones add column idempotency_key uuid;
create unique index production_milestone_intent on project_milestones(project_id,idempotency_key) where idempotency_key is not null;
-- Legacy status remains DRAFT on new-origin rows; production_status is authoritative.
create function public.guard_order_project() returns trigger language plpgsql set search_path=public as $$
declare oid uuid; o orders;
begin
 oid:=case when TG_OP='INSERT' then new.order_id else old.order_id end;
 if oid is null then
  if TG_OP='UPDATE' and new.order_id is not null then raise exception 'Không chuyển dự án cũ sang đơn bằng suy đoán.'; end if;
  if TG_OP='DELETE' then return old; end if;
  return new;
 end if;
 if TG_OP='DELETE' then raise exception 'Giữ nguyên hồ sơ sản xuất theo đơn.'; end if;
 if current_user not in ('postgres','supabase_admin','service_role') or nullif(current_setting('app.production_order',true),'')::uuid is distinct from oid then raise exception 'Dự án theo đơn chỉ thay đổi qua workflow sản xuất.'; end if;
 select * into o from orders where id=oid;
 if new.order_id is distinct from oid or new.customer_id<>o.customer_id or new.status<>'DRAFT' then raise exception 'Không sửa nguồn/chủ đơn hoặc dùng trạng thái dự án cũ cho sản xuất.'; end if;
 if TG_OP='INSERT' and (new.production_status<>'PLANNING' or o.status<>'CONFIRMED' or not exists(select 1 from contract_acknowledgments where order_id=o.id)
  or (select coalesce(sum(amount),0) from order_payment_receipts where order_id=o.id)<case when o.deposit_amount>0 then o.deposit_amount else o.total end) then raise exception 'Dự án chỉ tạo từ đơn đã xác nhận đủ bằng chứng điều khoản/khoản thu.'; end if;
 return new;
end $$;
create trigger order_project_guard before insert or update or delete on projects for each row execute function guard_order_project();
alter function project_action(uuid,uuid,text,jsonb) rename to legacy_project_action_024;
revoke all on function legacy_project_action_024(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
create function public.project_action(actor_id uuid,pid uuid,action text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if exists(select 1 from projects where id=pid and order_id is not null) then raise exception 'Dự án theo đơn phải dùng workflow sản xuất.'; end if;
 return legacy_project_action_024(actor_id,pid,action,payload);
end $$;
revoke all on function project_action(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function project_action(uuid,uuid,text,jsonb) to service_role;
alter function edit_project(uuid,uuid,jsonb) rename to legacy_edit_project_024;
revoke all on function legacy_edit_project_024(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
create function public.edit_project(actor_id uuid,pid uuid,payload jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if exists(select 1 from projects where id=pid and order_id is not null) then raise exception 'Dự án theo đơn phải dùng workflow sản xuất.'; end if;
 return legacy_edit_project_024(actor_id,pid,payload);
end $$;
revoke all on function edit_project(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function edit_project(uuid,uuid,jsonb) to service_role;
create function public.guard_order_project_child() returns trigger language plpgsql set search_path=public as $$
declare old_id uuid; new_id uuid; oid uuid;
begin
 if TG_OP<>'INSERT' then old_id:=old.project_id; end if;
 if TG_OP<>'DELETE' then new_id:=new.project_id; end if;
 for oid in select order_id from projects where id in (old_id,new_id) and order_id is not null loop
  if TG_TABLE_NAME in ('quotations','payment_plans','invoices') then raise exception 'Dự án theo đơn dùng hồ sơ thương mại của đơn; không tạo chứng từ theo luồng dự án cũ.'; end if;
  if current_user not in ('postgres','supabase_admin','service_role') or nullif(current_setting('app.production_order',true),'')::uuid is distinct from oid then raise exception 'Nội dung sản xuất theo đơn chỉ thay đổi qua workflow sản xuất.'; end if;
 end loop;
 if TG_OP='DELETE' then return old; end if;
 return new;
end $$;
do $$ declare t text; begin
 foreach t in array array['project_services','project_files','project_status_history','deliverables','revision_requests','reviews','project_messages','project_milestones','project_team_members','quotations','payment_plans','invoices'] loop
  execute format('create trigger order_origin_guard before insert or update or delete on %I for each row execute function guard_order_project_child()',t);
 end loop;
end $$;
-- Retain the complete legacy trigger behavior, skipping its legacy URLs/statuses
-- for order-origin production. Its events use the scoped request conversation.
create or replace function public.track_project() returns trigger language plpgsql set search_path=public as $$ declare actor uuid; begin
 if new.order_id is not null then return new; end if;
 actor:=nullif(current_setting('app.actor',true),'')::uuid;
 if TG_OP='UPDATE' then
  if new.status=old.status then return new; end if;
  if not ((old.status='DRAFT' and new.status='SUBMITTED') or (old.status='SUBMITTED' and new.status in ('REVIEWING','CANCELLED')) or (old.status='REVIEWING' and new.status in ('QUOTATION_SENT','CANCELLED')) or (old.status='QUOTATION_SENT' and new.status in ('QUOTATION_ACCEPTED','CANCELLED')) or (old.status='QUOTATION_ACCEPTED' and new.status='IN_PROGRESS') or (old.status='IN_PROGRESS' and new.status='WAITING_REVIEW') or (old.status='WAITING_REVIEW' and new.status in ('REVISION','COMPLETED')) or (old.status='REVISION' and new.status='WAITING_REVIEW')) then raise exception 'Chuyển trạng thái không hợp lệ'; end if;
 end if;
 insert into project_status_history(project_id,status,created_by) values(new.id,new.status,actor);
 insert into notifications(user_id,title,message,type) select id,'Cập nhật dự án',new.title||': '||new.status,'PROJECT_STATUS' from profiles where role='ADMIN' or id=(select profile_id from customers where id=new.customer_id);
 return new; end $$;

create function public.can_access_production(pid uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from projects where id=pid and order_id is not null and can_access_order(order_id))
$$;
revoke all on function can_access_production(uuid) from public,anon;
grant execute on function can_access_production(uuid) to authenticated,service_role;
create policy order_project_reader on projects for select to authenticated using(order_id is not null and can_access_order(order_id));
do $$ declare t text; begin
 foreach t in array array['project_services','project_files','project_status_history','deliverables','revision_requests','reviews','project_milestones','project_team_members'] loop
  execute format('create policy order_production_reader on %I for select to authenticated using(can_access_production(project_id))',t);
 end loop;
end $$;

alter table conversation_messages drop constraint conversation_messages_kind_check;
alter table conversation_messages add constraint conversation_messages_kind_check check(kind in ('TEXT','SYSTEM','CREATOR_PROPOSAL','QUOTE','ORDER','CONTRACT','PAYMENT','PROJECT'));
create or replace function public.record_request_event(actor uuid,rid uuid,event_name text,event_text text,event_metadata jsonb,previous jsonb,next_value jsonb,event_reason text default null) returns void language plpgsql security definer set search_path=public as $$
begin
 insert into conversation_messages(conversation_id,sender_id,content,kind,event_data)
 select id,actor,event_text,case event_name when 'CREATOR_PROPOSED' then 'CREATOR_PROPOSAL' when 'QUOTE_SENT' then 'QUOTE' when 'ORDER_CREATED' then 'ORDER' when 'CONTRACT_SENT' then 'CONTRACT' when 'PAYMENT_REQUESTED' then 'PAYMENT' when 'PRODUCTION_CREATED' then 'PROJECT' else 'SYSTEM' end,
 jsonb_build_object('event',event_name)||coalesce(event_metadata,'{}') from conversations where request_id=rid;
 insert into audit_logs(actor_id,action,entity,entity_id,old_value,new_value,reason,metadata)
 values(actor,event_name,'requests',rid,previous,next_value,event_reason,coalesce(event_metadata,'{}'));
end $$;

create function public.order_production_action(actor_id uuid,oid uuid,operation text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public as $$
declare u profiles; o orders; r requests; p projects; m project_milestones; collected numeric; threshold numeric;
 previous jsonb; event_name text; event_text text; reason text:=btrim(coalesce(payload->>'reason','')); target_status text;
begin
 select * into u from profiles where id=actor_id and active and role in ('STAFF','ADMIN');
 if u.id is null then raise exception 'Chỉ người phụ trách/Admin quản lý sản xuất.'; end if;
 select request_id into r.id from orders where id=oid;
 select * into r from requests where id=r.id for update;
 select * into o from orders where id=oid for update;
 if o.id is null or r.id is null or (u.role<>'ADMIN' and (o.assigned_to<>u.id or r.assigned_to<>u.id)) then raise exception 'Không có quyền truy cập đơn sản xuất.'; end if;
 select * into p from projects where order_id=o.id for update;
 perform set_config('app.actor',u.id::text,true); perform set_config('app.production_order',o.id::text,true);
 if operation='create' and p.id is not null then return jsonb_build_object('id',p.id,'order_id',o.id,'reused',true); end if;
 if o.status not in ('CONFIRMED','IN_PROGRESS') or not exists(select 1 from contract_acknowledgments where order_id=o.id) or r.status<>'CONVERTED' then raise exception 'Đơn chưa đủ điều kiện sản xuất hoặc đã đóng.'; end if;
 select coalesce(sum(amount),0) into collected from order_payment_receipts where order_id=o.id;
 threshold:=case when o.deposit_amount>0 then o.deposit_amount else o.total end;
 if collected<=0 or collected<threshold or not exists(select 1 from profiles where id=o.assigned_to and active and role in ('STAFF','ADMIN')) then raise exception 'Cần khoản nhận đủ điều kiện đã xác minh và người phụ trách đang hoạt động.'; end if;
 previous:=jsonb_build_object('order_status',o.status,'production_status',p.production_status);
 if operation='create' then
  if o.status<>'CONFIRMED' then raise exception 'Đơn chưa được xác nhận.'; end if;
  insert into projects(order_id,customer_id,title,description,scope,budget,deadline,status,production_status)
  values(o.id,o.customer_id,r.title,r.brief,coalesce(o.quote_snapshot->>'revision_policy',''),o.total,r.deadline,'DRAFT','PLANNING') returning * into p;
  insert into project_services(project_id,service_id,quantity)
  select p.id,service_id,sum(quantity)::integer from order_items where order_id=o.id and service_id is not null group by service_id;
  insert into project_team_members(project_id,creator_id,role) values(p.id,o.creator_id,'CREATOR');
  insert into project_status_history(project_id,status,created_by) values(p.id,'PLANNING',u.id);
  event_name:='PRODUCTION_CREATED'; event_text:='Đơn đã đủ điều kiện; người phụ trách đã tạo kế hoạch sản xuất.';
 elsif p.id is null then raise exception 'Chưa có kế hoạch sản xuất.';
 elsif operation='status' then
  target_status:=payload->>'status';
  if length(reason) not between 1 and 2000 or not ((p.production_status='PLANNING' and target_status='READY') or (p.production_status='READY' and target_status='IN_PROGRESS') or (p.production_status='IN_PROGRESS' and target_status='ON_HOLD') or (p.production_status='ON_HOLD' and target_status='IN_PROGRESS')) then raise exception 'Chuyển trạng thái sản xuất chưa hợp lệ hoặc thiếu lý do.'; end if;
  if target_status='IN_PROGRESS' and not exists(select 1 from project_milestones where project_id=p.id) then raise exception 'Cần ít nhất một mốc sản xuất trước khi bắt đầu.'; end if;
  update projects set production_status=target_status where id=p.id returning * into p;
  if target_status='IN_PROGRESS' and o.status='CONFIRMED' then update orders set status='IN_PROGRESS' where id=o.id returning * into o; end if;
  insert into project_status_history(project_id,status,note,created_by) values(p.id,target_status,reason,u.id);
  event_name:='PRODUCTION_STATUS'; event_text:='Trạng thái sản xuất: '||case target_status when 'READY' then 'Sẵn sàng thực hiện' when 'IN_PROGRESS' then 'Đang thực hiện' else 'Tạm dừng' end||'. Lý do: '||reason;
 elsif operation='milestone_save' then
  if p.production_status not in ('PLANNING','READY','IN_PROGRESS','ON_HOLD') or length(btrim(coalesce(payload->>'title',''))) not between 1 and 200 or length(coalesce(payload->>'description',''))>5000 or (payload->>'due_date')::date is null
   or coalesce((payload->>'display_order')::integer,-1) not between 0 and 10000 then raise exception 'Mốc sản xuất chưa hợp lệ.'; end if;
  if payload->>'milestone_id' is null then
   if payload->>'idempotency_key' is null then raise exception 'Cần khóa chống tạo mốc lặp.'; end if;
   select * into m from project_milestones where project_id=p.id and idempotency_key=(payload->>'idempotency_key')::uuid;
   if m.id is not null then
    if m.title<>btrim(payload->>'title') or m.description<>coalesce(payload->>'description','') or m.due_date is distinct from (payload->>'due_date')::date or m.display_order<>(payload->>'display_order')::integer then raise exception 'Khóa tạo mốc đã dùng với nội dung khác.'; end if;
    return jsonb_build_object('id',p.id,'order_id',o.id,'milestone_id',m.id,'reused',true);
   end if;
   insert into project_milestones(project_id,title,description,due_date,display_order,idempotency_key)
   values(p.id,btrim(payload->>'title'),coalesce(payload->>'description',''),(payload->>'due_date')::date,(payload->>'display_order')::integer,(payload->>'idempotency_key')::uuid) returning * into m;
  else
   select * into m from project_milestones where id=(payload->>'milestone_id')::uuid and project_id=p.id for update;
   if m.id is null or m.status<>'PENDING' then raise exception 'Chỉ sửa mốc chưa bắt đầu của đúng dự án.'; end if;
   update project_milestones set title=btrim(payload->>'title'),description=coalesce(payload->>'description',''),due_date=(payload->>'due_date')::date,display_order=(payload->>'display_order')::integer,updated_at=now() where id=m.id returning * into m;
  end if;
  event_name:='MILESTONE_SAVED'; event_text:='Mốc sản xuất đã cập nhật: '||m.title;
 elsif operation='milestone_status' then
  select * into m from project_milestones where id=(payload->>'milestone_id')::uuid and project_id=p.id for update;
  target_status:=payload->>'status';
  if p.production_status<>'IN_PROGRESS' or m.id is null or length(reason) not between 1 and 2000 or not ((m.status='PENDING' and target_status='IN_PROGRESS') or (m.status='IN_PROGRESS' and target_status='COMPLETED')) then raise exception 'Chuyển trạng thái mốc chưa hợp lệ hoặc dự án chưa đang thực hiện.'; end if;
  update project_milestones set status=target_status,updated_at=now() where id=m.id;
  event_name:='MILESTONE_STATUS'; event_text:='Mốc '||m.title||': '||case target_status when 'IN_PROGRESS' then 'Đang thực hiện' else 'Hoàn thành' end||'. Nội dung: '||reason;
 else raise exception 'Thao tác sản xuất chưa được hỗ trợ.'; end if;
 perform record_request_event(u.id,r.id,event_name,event_text,jsonb_build_object('order_id',o.id,'project_id',p.id,'milestone_id',m.id),previous,jsonb_build_object('order_status',o.status,'production_status',p.production_status),nullif(reason,''));
 return jsonb_build_object('id',p.id,'order_id',o.id,'milestone_id',m.id);
end $$;
revoke all on function order_production_action(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function order_production_action(uuid,uuid,text,jsonb) to service_role;
commit;
