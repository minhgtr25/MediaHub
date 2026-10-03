begin;

-- Application acknowledgment is separate from a provider-backed e-signature.
create table public.order_contracts (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references orders(id),
 request_id uuid not null references requests(id), quotation_id uuid not null references quotations(id),
 version integer not null check(version>0), previous_version_id uuid references order_contracts(id),
 title text not null check(length(btrim(title)) between 1 and 200),
 content text not null check(length(btrim(content)) between 1 and 100000),
 content_hash text not null check(content_hash~'^[a-f0-9]{64}$'),
 valid_until date not null, status text not null default 'DRAFT' check(status in ('DRAFT','SENT','VIEWED','ACKNOWLEDGED','REJECTED','EXPIRED','CANCELLED')),
 created_by uuid not null references profiles(id), sent_at timestamptz, viewed_at timestamptz,
 responded_at timestamptz, response_reason text check(length(response_reason)<=2000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(order_id,version)
);
create unique index one_order_contract_draft on order_contracts(order_id) where status='DRAFT';
create unique index one_order_contract_live on order_contracts(order_id) where status in ('SENT','VIEWED','ACKNOWLEDGED');
create index order_contract_history_idx on order_contracts(order_id,version desc);
create trigger touch before update on order_contracts for each row execute function touch_updated();
create table public.contract_acknowledgments (
 contract_id uuid primary key references order_contracts(id), order_id uuid not null unique references orders(id),
 profile_id uuid not null references profiles(id), content_hash text not null, contract_snapshot jsonb not null,
 method text not null default 'APPLICATION' check(method='APPLICATION'), acknowledged_at timestamptz not null default now()
);
alter table order_contracts enable row level security;
alter table contract_acknowledgments enable row level security;
revoke all on order_contracts,contract_acknowledgments from anon,authenticated;
grant select on order_contracts,contract_acknowledgments to authenticated;
grant all on order_contracts,contract_acknowledgments to service_role;
create policy order_contract_reader on order_contracts for select to authenticated using(can_access_order(order_id) and (sent_at is not null or is_request_operator(request_id)));
create policy contract_acknowledgment_reader on contract_acknowledgments for select to authenticated using(can_access_order(order_id));

create function public.guard_order_contract() returns trigger language plpgsql set search_path=public as $$
declare oid uuid; o orders;
begin
 oid:=case when TG_OP='INSERT' then new.order_id else old.order_id end;
 if current_user not in ('postgres','supabase_admin','service_role') or nullif(current_setting('app.contract_order',true),'')::uuid is distinct from oid then raise exception 'Hợp đồng chỉ được thay đổi qua workflow của đơn.'; end if;
 if TG_OP='DELETE' then raise exception 'Giữ nguyên lịch sử hợp đồng; hãy hủy phiên bản.'; end if;
 select * into o from orders where id=oid;
 new.content_hash:=encode(sha256(convert_to(new.content,'UTF8')),'hex');
 if new.request_id is distinct from o.request_id or new.quotation_id is distinct from o.accepted_quotation_id then raise exception 'Hợp đồng phải liên kết đúng request và báo giá đã chấp nhận.'; end if;
 if TG_OP='UPDATE' then
  if new.order_id<>old.order_id or new.version<>old.version or new.previous_version_id is distinct from old.previous_version_id or new.created_by<>old.created_by then raise exception 'Không được sửa liên kết/phiên bản hợp đồng.'; end if;
  if old.status<>'DRAFT' and (to_jsonb(new)-array['content_hash','status','viewed_at','responded_at','response_reason','updated_at']) is distinct from (to_jsonb(old)-array['content_hash','status','viewed_at','responded_at','response_reason','updated_at']) then raise exception 'Nội dung đã gửi là bất biến; cần tạo phiên bản mới.'; end if;
  if new.status<>old.status and not ((old.status='DRAFT' and new.status in ('SENT','CANCELLED')) or (old.status='SENT' and new.status in ('VIEWED','ACKNOWLEDGED','REJECTED','EXPIRED','CANCELLED')) or (old.status='VIEWED' and new.status in ('ACKNOWLEDGED','REJECTED','EXPIRED','CANCELLED'))) then raise exception 'Chuyển trạng thái hợp đồng không hợp lệ.'; end if;
 end if;
 return new;
end $$;
create trigger order_contract_guard before insert or update or delete on order_contracts for each row execute function guard_order_contract();
create function public.guard_contract_acknowledgment() returns trigger language plpgsql set search_path=public as $$
declare c order_contracts; o orders;
begin
 if TG_OP<>'INSERT' then raise exception 'Bằng chứng xác nhận điều khoản là bất biến.'; end if;
 select * into c from order_contracts where id=new.contract_id;
 select * into o from orders where id=c.order_id;
 if current_user not in ('postgres','supabase_admin','service_role') or nullif(current_setting('app.contract_order',true),'')::uuid is distinct from c.order_id or new.order_id<>c.order_id or c.status<>'ACKNOWLEDGED' or new.content_hash<>c.content_hash or not exists(select 1 from customers where id=o.customer_id and profile_id=new.profile_id) or new.contract_snapshot is distinct from to_jsonb(c) then raise exception 'Bằng chứng xác nhận không khớp điều khoản và chủ đơn.'; end if;
 return new;
end $$;
create trigger contract_acknowledgment_guard before insert or update or delete on contract_acknowledgments for each row execute function guard_contract_acknowledgment();

alter table conversation_messages drop constraint conversation_messages_kind_check;
alter table conversation_messages add constraint conversation_messages_kind_check check(kind in ('TEXT','SYSTEM','CREATOR_PROPOSAL','QUOTE','ORDER','CONTRACT'));
create or replace function public.record_request_event(actor uuid,rid uuid,event_name text,event_text text,event_metadata jsonb,previous jsonb,next_value jsonb,event_reason text default null) returns void language plpgsql security definer set search_path=public as $$
begin
 insert into conversation_messages(conversation_id,sender_id,content,kind,event_data)
 select id,actor,event_text,case event_name when 'CREATOR_PROPOSED' then 'CREATOR_PROPOSAL' when 'QUOTE_SENT' then 'QUOTE' when 'ORDER_CREATED' then 'ORDER' when 'CONTRACT_SENT' then 'CONTRACT' else 'SYSTEM' end,
 jsonb_build_object('event',event_name)||coalesce(event_metadata,'{}') from conversations where request_id=rid;
 insert into audit_logs(actor_id,action,entity,entity_id,old_value,new_value,reason,metadata)
 values(actor,event_name,'requests',rid,previous,next_value,event_reason,coalesce(event_metadata,'{}'));
end $$;

create function public.order_action(actor_id uuid,oid uuid,operation text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public as $$
declare u profiles; o orders; r requests; c order_contracts; prior order_contracts; target profiles; ack contract_acknowledgments;
 owner_id uuid; operator boolean; customer_actor boolean; conv uuid;
 response text:=btrim(coalesce(payload->>'reason','')); event_name text; event_text text; previous jsonb;
begin
 select * into u from profiles where id=actor_id and active;
 if u.id is null or u.role not in ('ADMIN','STAFF','CUSTOMER','BUSINESS') then raise exception 'Không có quyền truy cập.'; end if;
 -- Match the request-first lock order used by quote acceptance/conversations.
 select request_id into conv from orders where id=oid;
 select * into r from requests where id=conv for update;
 select * into o from orders where id=oid for update;
 if o.id is null or r.id is null then raise exception 'Không tìm thấy đơn dịch vụ.'; end if;
 select profile_id into owner_id from customers where id=o.customer_id;
 operator:=u.role='ADMIN' or (u.role='STAFF' and o.assigned_to=u.id and r.assigned_to=u.id);
 customer_actor:=u.role in ('CUSTOMER','BUSINESS') and owner_id=u.id;
 if not (operator or customer_actor) then raise exception 'Không có quyền truy cập đơn.'; end if;
 perform set_config('app.actor',u.id::text,true);
 perform set_config('app.contract_order',o.id::text,true);
 if operation in ('assign','contract_save','contract_send','contract_cancel','contract_expire') and not operator then raise exception 'Chỉ người phụ trách/admin được thực hiện.'; end if;
 if operation in ('contract_view','contract_reject','contract_acknowledge') and not customer_actor then raise exception 'Chỉ chủ đơn được phản hồi điều khoản.'; end if;
 if operation='contract_acknowledge' then
  select * into ack from contract_acknowledgments where order_id=o.id;
  if ack.contract_id=(payload->>'contract_id')::uuid and ack.content_hash=payload->>'content_hash' and payload->'acknowledge'='true'::jsonb then return jsonb_build_object('id',ack.contract_id,'order_id',o.id,'reused',true); end if;
 end if;
 if o.status in ('COMPLETED','CANCELLED','REFUNDED') then raise exception 'Đơn đã đóng; không thể thay đổi.'; end if;
 previous:=jsonb_build_object('status',o.status,'assigned_to',o.assigned_to);
 if operation='assign' then
  select * into target from profiles where id=(payload->>'assigned_to')::uuid and active and role in ('STAFF','ADMIN');
  if target.id is null or length(response) not between 1 and 2000 then raise exception 'Cần nhân viên đang hoạt động và lý do chuyển.'; end if;
  if target.id=o.assigned_to then return jsonb_build_object('id',o.id,'order_id',o.id); end if;
  select id into conv from conversations where request_id=r.id;
  update request_assignments set ended_at=now(),ended_by=u.id,end_reason=response where request_id=r.id and ended_at is null;
  insert into request_assignments(request_id,staff_id,assigned_by,reason) values(r.id,target.id,u.id,response);
  delete from conversation_members where conversation_id=conv and profile_id<>owner_id;
  insert into conversation_members(conversation_id,profile_id) values(conv,target.id);
  update requests set assigned_to=target.id where id=r.id;
  update orders set assigned_to=target.id where id=o.id returning * into o;
  perform record_request_event(u.id,r.id,'ORDER_TRANSFERRED',target.full_name||' đã được phân công phụ trách đơn dịch vụ.',jsonb_build_object('order_id',o.id),previous,jsonb_build_object('status',o.status,'assigned_to',o.assigned_to),response);
  return jsonb_build_object('id',o.id,'order_id',o.id);
 end if;
 if o.status<>'WAITING_CONTRACT' then raise exception 'Đơn không còn chờ xác nhận điều khoản; cần quy trình phụ lục riêng.'; end if;
 if r.status<>'CONVERTED' or not exists(select 1 from quotations where id=o.accepted_quotation_id and request_id=r.id and status='ACCEPTED') then raise exception 'Đơn chưa có báo giá đã chấp nhận hợp lệ.'; end if;
 if operation='contract_save' then
  if length(btrim(coalesce(payload->>'title',''))) not between 1 and 200 or length(btrim(coalesce(payload->>'content',''))) not between 1 and 100000 or (payload->>'valid_until')::date is null or (payload->>'valid_until')::date<(now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'Tiêu đề, điều khoản hoặc hạn xác nhận không hợp lệ.'; end if;
  if exists(select 1 from order_contracts where order_id=o.id and status in ('SENT','VIEWED','ACKNOWLEDGED')) then raise exception 'Phiên bản đã gửi đang chờ phản hồi; không được sửa nội dung.'; end if;
  select * into c from order_contracts where order_id=o.id and status='DRAFT' for update;
  if c.id is null then
   select * into prior from order_contracts where order_id=o.id order by version desc limit 1;
   insert into order_contracts(order_id,request_id,quotation_id,version,previous_version_id,title,content,valid_until,created_by)
   values(o.id,r.id,o.accepted_quotation_id,coalesce(prior.version,0)+1,prior.id,btrim(payload->>'title'),payload->>'content',(payload->>'valid_until')::date,u.id) returning * into c;
  else
   update order_contracts set title=btrim(payload->>'title'),content=payload->>'content',valid_until=(payload->>'valid_until')::date where id=c.id returning * into c;
  end if;
  insert into audit_logs(actor_id,action,entity,entity_id,metadata) values(u.id,'CONTRACT_DRAFT','order_contracts',c.id,jsonb_build_object('order_id',o.id,'version',c.version));
  return jsonb_build_object('id',c.id,'order_id',o.id,'version',c.version);
 end if;
 select * into c from order_contracts where id=(payload->>'contract_id')::uuid and order_id=o.id for update;
 if c.id is null or c.version<>(select max(version) from order_contracts where order_id=o.id) then raise exception 'Cần đúng phiên bản điều khoản mới nhất của đơn.'; end if;
 if operation='contract_send' then
  if c.status<>'DRAFT' or c.valid_until<(now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'Bản nháp không còn đủ điều kiện gửi.'; end if;
  update order_contracts set status='SENT',sent_at=now() where id=c.id;
  event_name:='CONTRACT_SENT'; event_text:='MediaHub đã gửi điều khoản hợp đồng phiên bản '||c.version||' để bạn xem và xác nhận trong ứng dụng.';
 elsif operation='contract_cancel' then
  if c.status not in ('DRAFT','SENT','VIEWED') or length(response) not between 1 and 2000 then raise exception 'Cần phiên bản chưa xác nhận và lý do hủy.'; end if;
  update order_contracts set status='CANCELLED',responded_at=now(),response_reason=response where id=c.id;
  if c.sent_at is null then
   insert into audit_logs(actor_id,action,entity,entity_id,reason,metadata) values(u.id,'CONTRACT_DRAFT_CANCELLED','order_contracts',c.id,response,jsonb_build_object('order_id',o.id));
   return jsonb_build_object('id',c.id,'order_id',o.id);
  end if;
  event_name:='CONTRACT_CANCELLED'; event_text:='MediaHub đã hủy phiên bản điều khoản chưa xác nhận. Lý do: '||response;
 else
  if c.status not in ('SENT','VIEWED') then raise exception 'Phiên bản không còn chờ phản hồi.'; end if;
  if operation='contract_expire' then
   if c.valid_until>=(now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'Điều khoản chưa hết hạn xác nhận.'; end if;
   update order_contracts set status='EXPIRED',responded_at=now() where id=c.id;
   event_name:='CONTRACT_EXPIRED'; event_text:='Điều khoản đã hết hạn xác nhận; người phụ trách cần gửi phiên bản mới.';
  else
   if c.valid_until<(now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'Điều khoản đã hết hạn; cần phiên bản mới.'; end if;
   if operation='contract_view' then
    update order_contracts set status='VIEWED',viewed_at=coalesce(viewed_at,now()) where id=c.id;
    return jsonb_build_object('id',c.id,'order_id',o.id);
   elsif operation='contract_reject' then
    if length(response) not between 1 and 2000 then raise exception 'Vui lòng ghi nội dung chưa đồng ý.'; end if;
    update order_contracts set status='REJECTED',responded_at=now(),response_reason=response where id=c.id;
    event_name:='CONTRACT_REJECTED'; event_text:='Khách hàng chưa đồng ý điều khoản. Nội dung: '||response;
   elsif operation='contract_acknowledge' then
    if payload->'acknowledge' is distinct from 'true'::jsonb or payload->>'content_hash' is distinct from c.content_hash then raise exception 'Cần xác nhận rõ ràng đúng nội dung bạn vừa xem.'; end if;
    if not exists(select 1 from profiles where id=o.assigned_to and active and role in ('STAFF','ADMIN')) then raise exception 'Cần người phụ trách đang hoạt động.'; end if;
    update order_contracts set status='ACKNOWLEDGED',responded_at=now() where id=c.id returning * into c;
    insert into contract_acknowledgments(contract_id,order_id,profile_id,content_hash,contract_snapshot) values(c.id,o.id,u.id,c.content_hash,to_jsonb(c));
    update orders set status='WAITING_PAYMENT' where id=o.id returning * into o;
    event_name:='CONTRACT_ACKNOWLEDGED'; event_text:='Khách hàng đã xác nhận điều khoản trong ứng dụng. Đơn chuyển sang chờ thanh toán; chưa ghi nhận khoản thu.';
   else raise exception 'Thao tác đơn dịch vụ chưa được hỗ trợ.'; end if;
  end if;
 end if;
 perform record_request_event(u.id,r.id,event_name,event_text,jsonb_build_object('order_id',o.id,'contract_id',c.id,'version',c.version),previous,jsonb_build_object('status',o.status),nullif(response,''));
 -- The existing conversation trigger sends one scoped notification per event.
 return jsonb_build_object('id',c.id,'order_id',o.id);
end $$;
revoke all on function public.order_action(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.order_action(uuid,uuid,text,jsonb) to service_role;

commit;
