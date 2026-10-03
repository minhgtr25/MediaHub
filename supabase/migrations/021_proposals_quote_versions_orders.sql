begin;

create table public.creator_proposals (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references requests(id),
 creator_id uuid not null references creator_profiles(id), creator_snapshot jsonb not null,
 proposed_by uuid not null references profiles(id), reason text not null check(length(btrim(reason)) between 1 and 3000),
 estimated_price numeric(16,2) check(estimated_price between 0 and 1000000000000),
 estimated_days integer check(estimated_days between 1 and 3650),
 status text not null default 'PROPOSED' check(status in ('PROPOSED','SHORTLISTED','SELECTED','REJECTED','WITHDRAWN')),
 response_note text check(length(response_note)<=2000), responded_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index one_active_creator_proposal on creator_proposals(request_id,creator_id) where status in ('PROPOSED','SHORTLISTED','SELECTED');
create unique index one_selected_creator_proposal on creator_proposals(request_id) where status='SELECTED';
create index creator_proposals_request_idx on creator_proposals(request_id,created_at,id);
create trigger touch before update on creator_proposals for each row execute function touch_updated();
alter table requests add column selected_proposal_id uuid references creator_proposals(id);

-- Reuse the existing quotation/item model. Legacy project quotations retain
-- their original links, unique indexes, RPCs and nullable version fields.
alter table quotations alter column project_id drop not null;
alter table quotations add column request_id uuid references requests(id);
alter table quotations add column version integer check(version>0);
alter table quotations add column previous_version_id uuid references quotations(id);
alter table quotations add column created_by uuid references profiles(id);
alter table quotations add column creator_proposal_id uuid references creator_proposals(id);
alter table quotations add column revision_policy text check(length(revision_policy)<=3000);
alter table quotations add column deposit_percent numeric(5,2) check(deposit_percent between 0 and 100);
alter table quotations add column deposit_amount numeric(16,2) check(deposit_amount>=0);
alter table quotations add column remaining_amount numeric(16,2) check(remaining_amount>=0);
alter table quotations add column sent_at timestamptz;
alter table quotations add column viewed_at timestamptz;
alter table quotations add column responded_at timestamptz;
alter table quotations add column response_reason text check(length(response_reason)<=2000);
alter table quotations drop constraint quotations_status_check;
alter table quotations add constraint quotations_status_check check(status in ('DRAFT','SENT','VIEWED','REVISION_REQUESTED','ACCEPTED','REJECTED','EXPIRED','CANCELLED'));
alter table quotations add constraint quotation_origin check((project_id is not null and request_id is null) or (project_id is null and request_id is not null));
alter table quotations add constraint request_quote_terms check(request_id is null or (version is not null and created_by is not null and creator_proposal_id is not null and revision_policy is not null and deposit_percent is not null and deposit_amount is not null and remaining_amount is not null and deposit_amount+remaining_amount=total));
create unique index request_quote_version on quotations(request_id,version) where request_id is not null;
create unique index one_request_quote_draft on quotations(request_id) where request_id is not null and status='DRAFT';
create unique index one_request_live_quote on quotations(request_id) where request_id is not null and status in ('SENT','VIEWED','ACCEPTED');
create index request_quote_history_idx on quotations(request_id,version desc);
alter table conversation_messages drop constraint conversation_messages_kind_check;
alter table conversation_messages add constraint conversation_messages_kind_check check(kind in ('TEXT','SYSTEM','CREATOR_PROPOSAL','QUOTE','ORDER'));

create table public.orders (
 id uuid primary key default gen_random_uuid(), order_number text not null unique default ('MH-O-'||upper(replace(gen_random_uuid()::text,'-',''))),
 request_id uuid not null unique references requests(id), customer_id uuid not null references customers(id),
 assigned_to uuid not null references profiles(id), creator_id uuid not null references creator_profiles(id),
 accepted_quotation_id uuid not null unique references quotations(id), quote_snapshot jsonb not null, creator_snapshot jsonb not null,
 total numeric(16,2) not null check(total between 0 and 1000000000000),
 deposit_amount numeric(16,2) not null check(deposit_amount>=0), remaining_amount numeric(16,2) not null check(remaining_amount>=0),
 status text not null default 'WAITING_CONTRACT' check(status in ('WAITING_CONTRACT','WAITING_PAYMENT','CONFIRMED','IN_PROGRESS','WAITING_ACCEPTANCE','COMPLETED','CANCELLED','REFUNDED')),
 accepted_at timestamptz not null default now(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(deposit_amount+remaining_amount=total)
);
create table public.order_items (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references orders(id), service_id uuid references services(id),
 description text not null, quantity integer not null check(quantity>0), unit_price numeric(16,2) not null check(unit_price>=0), total numeric(16,2) not null check(total>=0)
);
create index orders_customer_idx on orders(customer_id,created_at desc,id);
create index orders_staff_idx on orders(assigned_to,status,updated_at);
create index orders_creator_idx on orders(creator_id);
create index order_items_order_idx on order_items(order_id);
create trigger touch before update on orders for each row execute function touch_updated();

create function public.can_access_order(oid uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from orders o join profiles p on p.auth_user_id=auth.uid() and p.active
 where o.id=oid and (p.role='ADMIN' or (p.role='STAFF' and o.assigned_to=p.id) or
 (p.role in ('CUSTOMER','BUSINESS') and exists(select 1 from customers c where c.id=o.customer_id and c.profile_id=p.id))))
$$;
revoke all on function public.can_access_order(uuid) from public,anon;
grant execute on function public.can_access_order(uuid) to authenticated,service_role;
do $$ declare t text; begin
 foreach t in array array['creator_proposals','orders','order_items'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
create policy request_proposal_reader on creator_proposals for select to authenticated using(can_access_request(request_id));
create policy order_reader on orders for select to authenticated using(can_access_order(id));
create policy order_item_reader on order_items for select to authenticated using(can_access_order(order_id));
-- Legacy policies continue to apply only to legacy rows. New drafts are visible
-- solely to the current request operator; customer reads start at publication.
drop policy admin_all on quotations;
create policy admin_all on quotations for all to authenticated using(request_id is null and is_admin()) with check(request_id is null and is_admin());
create policy request_quote_reader on quotations for select to authenticated using(request_id is not null and (is_request_operator(request_id) or (sent_at is not null and can_access_request(request_id))));
drop policy admin_all on quotation_items;
create policy admin_all on quotation_items for all to authenticated
 using(exists(select 1 from quotations q where q.id=quotation_id and q.request_id is null and is_admin()))
 with check(exists(select 1 from quotations q where q.id=quotation_id and q.request_id is null and is_admin()));
create policy request_quote_item_reader on quotation_items for select to authenticated using(exists(select 1 from quotations q where q.id=quotation_id and q.request_id is not null and (is_request_operator(q.request_id) or (q.sent_at is not null and can_access_request(q.request_id)))));

create function public.guard_request_quotation() returns trigger language plpgsql set search_path=public as $$
declare link uuid;
begin
 link:=case when TG_OP='INSERT' then new.request_id else old.request_id end;
 if link is null then
  if TG_OP='UPDATE' and new.request_id is not null then raise exception 'Không thể chuyển báo giá cũ thành báo giá request.'; end if;
  if TG_OP='DELETE' then return old; end if; return new;
 end if;
 if current_user not in ('postgres','supabase_admin','service_role') or nullif(current_setting('app.commerce_request',true),'')::uuid is distinct from link then raise exception 'Báo giá request chỉ được thay đổi qua workflow thương mại.'; end if;
 if TG_OP='DELETE' then raise exception 'Giữ nguyên lịch sử báo giá; hãy hủy bản nháp.'; end if;
 if TG_OP='UPDATE' then
  if new.request_id is distinct from old.request_id or new.project_id is distinct from old.project_id or new.version is distinct from old.version or new.previous_version_id is distinct from old.previous_version_id or new.created_by is distinct from old.created_by or new.creator_proposal_id is distinct from old.creator_proposal_id then raise exception 'Không thể sửa liên kết/phiên bản của báo giá.'; end if;
  if old.status<>'DRAFT' and (to_jsonb(new)-array['status','viewed_at','responded_at','response_reason','updated_at']) is distinct from (to_jsonb(old)-array['status','viewed_at','responded_at','response_reason','updated_at']) then raise exception 'Nội dung báo giá đã gửi là bất biến; cần tạo phiên bản mới.'; end if;
  if new.status<>old.status and not ((old.status='DRAFT' and new.status in ('SENT','CANCELLED')) or (old.status='SENT' and new.status in ('VIEWED','REVISION_REQUESTED','ACCEPTED','REJECTED','EXPIRED')) or (old.status='VIEWED' and new.status in ('REVISION_REQUESTED','ACCEPTED','REJECTED','EXPIRED'))) then raise exception 'Chuyển trạng thái báo giá không hợp lệ.'; end if;
 end if;
 return new;
end $$;
create trigger request_quotation_guard before insert or update or delete on quotations for each row execute function guard_request_quotation();
create function public.guard_request_quotation_item() returns trigger language plpgsql set search_path=public as $$
declare q quotations; parent_id uuid;
begin
 parent_id:=case when TG_OP='INSERT' then new.quotation_id else old.quotation_id end;
 select * into q from quotations where id=parent_id for share;
 if q.request_id is not null and (q.status<>'DRAFT' or current_user not in ('postgres','supabase_admin','service_role') or nullif(current_setting('app.commerce_request',true),'')::uuid is distinct from q.request_id) then raise exception 'Không thể thay đổi hạng mục của báo giá đã gửi.'; end if;
 if TG_OP='UPDATE' and new.quotation_id<>old.quotation_id then raise exception 'Không thể chuyển hạng mục sang báo giá khác.'; end if;
 if TG_OP='DELETE' then return old; end if; return new;
end $$;
create trigger request_quotation_item_guard before insert or update or delete on quotation_items for each row execute function guard_request_quotation_item();

create function public.record_request_event(actor uuid,rid uuid,event_name text,event_text text,event_metadata jsonb,previous jsonb,next_value jsonb,event_reason text default null) returns void language plpgsql security definer set search_path=public as $$
begin
 insert into conversation_messages(conversation_id,sender_id,content,kind,event_data)
 select id,actor,event_text,case event_name when 'CREATOR_PROPOSED' then 'CREATOR_PROPOSAL' when 'QUOTE_SENT' then 'QUOTE' when 'ORDER_CREATED' then 'ORDER' else 'SYSTEM' end,
 jsonb_build_object('event',event_name)||coalesce(event_metadata,'{}') from conversations where request_id=rid;
 insert into audit_logs(actor_id,action,entity,entity_id,old_value,new_value,reason,metadata)
 values(actor,event_name,'requests',rid,previous,next_value,event_reason,coalesce(event_metadata,'{}'));
end $$;
revoke all on function public.record_request_event(uuid,uuid,text,text,jsonb,jsonb,jsonb,text) from public,anon,authenticated,service_role;

create function public.request_commerce_action(actor_id uuid,rid uuid,operation text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public as $$
declare u profiles; r requests; cp creator_proposals; creator creator_profiles; q quotations; prior quotations; o orders;
 owner_id uuid; operator boolean; customer_actor boolean; previous jsonb; event_name text; event_text text; metadata jsonb;
 item jsonb; subtotal_amount numeric; discount_amount numeric; rate numeric; tax_amount numeric; total_amount numeric; deposit_rate numeric;
 quote_id uuid; version_number integer; response text:=btrim(coalesce(payload->>'reason',''));
begin
 select * into u from profiles where id=actor_id and active;
 if u.id is null or u.role not in ('ADMIN','STAFF','CUSTOMER','BUSINESS') then raise exception 'Không có quyền truy cập.'; end if;
 select * into r from requests where id=rid for update;
 if r.id is null then raise exception 'Không tìm thấy yêu cầu.'; end if;
 select profile_id into owner_id from customers where id=r.customer_id;
 operator:=u.role='ADMIN' or (u.role='STAFF' and r.assigned_to=u.id);
 customer_actor:=u.role in ('CUSTOMER','BUSINESS') and owner_id=u.id;
 if not (operator or customer_actor) then raise exception 'Không có quyền truy cập yêu cầu này.'; end if;
 perform set_config('app.commerce_request',r.id::text,true);
 perform set_config('app.actor',u.id::text,true);
 -- Accept retries reuse the existing order even after request conversion.
 if operation='quote_accept' and customer_actor then
  select * into o from orders where request_id=r.id;
  if o.id is not null and o.accepted_quotation_id=(payload->>'quote_id')::uuid then return jsonb_build_object('id',o.id,'order_id',o.id,'request_id',r.id,'reused',true); end if;
 end if;
 if r.status in ('CANCELLED','CONVERTED') then raise exception 'Yêu cầu đã đóng; không thể thay đổi.'; end if;
 previous:=jsonb_build_object('status',r.status,'selected_proposal_id',r.selected_proposal_id);
 if operation in ('propose','proposal_withdraw','quote_save','quote_send','quote_cancel','quote_expire') and not operator then raise exception 'Chỉ người phụ trách hoặc admin được thực hiện.'; end if;
 if operation in ('proposal_shortlist','proposal_select','proposal_reject','quote_view','quote_revise','quote_reject','quote_accept') and not customer_actor then raise exception 'Chỉ chủ yêu cầu được phản hồi.'; end if;

 if operation='propose' then
  if r.assigned_to is null or r.status not in ('CONSULTING','WAITING_CUSTOMER','CREATOR_SELECTION') then raise exception 'Cần tư vấn trước khi đề xuất creator.'; end if;
  select * into creator from creator_profiles where id=(payload->>'creator_id')::uuid and availability<>'UNAVAILABLE' for share;
  if creator.id is null then raise exception 'Creator chưa sẵn sàng nhận yêu cầu.'; end if;
  insert into creator_proposals(request_id,creator_id,creator_snapshot,proposed_by,reason,estimated_price,estimated_days)
  values(r.id,creator.id,jsonb_build_object('id',creator.id,'slug',creator.slug,'display_name',creator.display_name,'title',creator.title,'avatar_url',creator.avatar_url,'availability',creator.availability),u.id,btrim(payload->>'reason'),nullif(payload->>'estimated_price','')::numeric,nullif(payload->>'estimated_days','')::integer) returning * into cp;
  update requests set status='CREATOR_SELECTION' where id=r.id returning * into r;
  event_name:='CREATOR_PROPOSED'; event_text:=u.full_name||' đề xuất creator '||creator.display_name||'.'; metadata:=jsonb_build_object('proposal_id',cp.id);
 elsif operation in ('proposal_shortlist','proposal_select','proposal_reject','proposal_withdraw') then
  select * into cp from creator_proposals where id=(payload->>'proposal_id')::uuid and request_id=r.id for update;
  if cp.id is null or cp.status not in ('PROPOSED','SHORTLISTED','SELECTED') then raise exception 'Đề xuất không còn khả dụng.'; end if;
  if exists(select 1 from quotations where request_id=r.id and status<>'CANCELLED') then raise exception 'Creator đã gắn với báo giá; cần giữ nguyên lựa chọn của phiên bản này.'; end if;
  if operation='proposal_select' then
   if not exists(select 1 from creator_profiles where id=cp.creator_id and availability<>'UNAVAILABLE') then raise exception 'Creator đã ngừng nhận yêu cầu; hãy chọn đề xuất khác.'; end if;
   update creator_proposals set status='SHORTLISTED' where request_id=r.id and status='SELECTED' and id<>cp.id;
   update creator_proposals set status='SELECTED',responded_at=now() where id=cp.id;
   update requests set selected_proposal_id=cp.id,status='QUOTE_PREPARING' where id=r.id returning * into r;
   event_name:='CREATOR_SELECTED'; event_text:='Khách hàng đã chọn '||(cp.creator_snapshot->>'display_name')||' để MediaHub chuẩn bị báo giá.';
  elsif operation='proposal_shortlist' then
   if cp.status='SELECTED' then raise exception 'Creator này đã được chọn.'; end if;
   update creator_proposals set status='SHORTLISTED',responded_at=now() where id=cp.id;
   event_name:='CREATOR_SHORTLISTED'; event_text:='Khách hàng đã lưu creator '||(cp.creator_snapshot->>'display_name')||' vào danh sách cân nhắc.';
  else
   if operation='proposal_reject' and length(response) not between 1 and 2000 then raise exception 'Vui lòng ghi lý do từ chối creator.'; end if;
   update creator_proposals set status=case operation when 'proposal_reject' then 'REJECTED' else 'WITHDRAWN' end,response_note=nullif(response,''),responded_at=now() where id=cp.id;
   if r.selected_proposal_id=cp.id then update requests set selected_proposal_id=null,status='CREATOR_SELECTION' where id=r.id returning * into r; end if;
   event_name:=case operation when 'proposal_reject' then 'CREATOR_REJECTED' else 'CREATOR_WITHDRAWN' end;
   event_text:=case operation when 'proposal_reject' then 'Khách hàng từ chối đề xuất creator. Lý do: '||response else 'Người phụ trách đã thu hồi đề xuất creator.' end;
  end if;
  metadata:=jsonb_build_object('proposal_id',cp.id);
 elsif operation='quote_save' then
  if r.assigned_to is null or r.status not in ('QUOTE_PREPARING','QUOTE_REVISION') then raise exception 'Cần có creator được khách chọn và yêu cầu đang chuẩn bị/chỉnh báo giá.'; end if;
  select * into cp from creator_proposals where id=r.selected_proposal_id and request_id=r.id and status='SELECTED';
  if cp.id is null then raise exception 'Chưa có creator được khách chọn.'; end if;
  if jsonb_typeof(payload->'items') is distinct from 'array' or jsonb_array_length(payload->'items') not between 1 and 50 then raise exception 'Cần từ 1 đến 50 hạng mục.'; end if;
  for item in select * from jsonb_array_elements(payload->'items') loop
   if not exists(select 1 from services where id=(item->>'service_id')::uuid and active) then raise exception 'Dịch vụ hạng mục chưa hoạt động.'; end if;
   if (item->>'quantity')::numeric not between 1 and 10000 or (item->>'quantity')::numeric<>trunc((item->>'quantity')::numeric) or (item->>'unit_price')::numeric not between 0 and 1000000000000 or (item->>'unit_price')::numeric<>round((item->>'unit_price')::numeric,2) or length(btrim(item->>'description')) not between 1 and 5000 then raise exception 'Hạng mục báo giá không hợp lệ.'; end if;
  end loop;
  select sum((v->>'quantity')::numeric*(v->>'unit_price')::numeric) into subtotal_amount from jsonb_array_elements(payload->'items') v;
  discount_amount:=coalesce((payload->>'discount')::numeric,0); rate:=coalesce((payload->>'tax_rate')::numeric,0); deposit_rate:=coalesce((payload->>'deposit_percent')::numeric,0);
  if subtotal_amount>1e12 or discount_amount not between 0 and subtotal_amount or discount_amount<>round(discount_amount,2) or rate not between 0 and 100 or rate<>round(rate,2) or deposit_rate not between 0 and 100 or deposit_rate<>round(deposit_rate,2) then raise exception 'Giảm giá, thuế hoặc tỷ lệ cọc không hợp lệ.'; end if;
  tax_amount:=round((subtotal_amount-discount_amount)*rate/100,2); total_amount:=subtotal_amount-discount_amount+tax_amount;
  if total_amount>1e12 or (payload->>'valid_until')::date is null or (payload->>'valid_until')::date<(now() at time zone 'Asia/Ho_Chi_Minh')::date or length(coalesce(payload->>'revision_policy',''))>3000 or length(coalesce(payload->>'notes',''))>5000 then raise exception 'Hạn, ghi chú hoặc tổng báo giá không hợp lệ.'; end if;
  select * into q from quotations where request_id=r.id and status='DRAFT' for update;
  if q.id is null then
   select * into prior from quotations where request_id=r.id order by version desc limit 1;
   version_number:=coalesce(prior.version,0)+1;
   insert into quotations(request_id,version,previous_version_id,created_by,creator_proposal_id,subtotal,discount,tax_rate,tax,total,valid_until,status,notes,revision_policy,deposit_percent,deposit_amount,remaining_amount)
   values(r.id,version_number,prior.id,u.id,cp.id,subtotal_amount,discount_amount,rate,tax_amount,total_amount,(payload->>'valid_until')::date,'DRAFT',coalesce(payload->>'notes',''),coalesce(payload->>'revision_policy',''),deposit_rate,round(total_amount*deposit_rate/100,2),total_amount-round(total_amount*deposit_rate/100,2)) returning * into q;
  else
   update quotations set subtotal=subtotal_amount,discount=discount_amount,tax_rate=rate,tax=tax_amount,total=total_amount,valid_until=(payload->>'valid_until')::date,notes=coalesce(payload->>'notes',''),revision_policy=coalesce(payload->>'revision_policy',''),deposit_percent=deposit_rate,deposit_amount=round(total_amount*deposit_rate/100,2),remaining_amount=total_amount-round(total_amount*deposit_rate/100,2) where id=q.id returning * into q;
   delete from quotation_items where quotation_id=q.id;
  end if;
  insert into quotation_items(quotation_id,service_id,description,quantity,unit_price,total)
  select q.id,(v->>'service_id')::uuid,btrim(v->>'description'),(v->>'quantity')::integer,(v->>'unit_price')::numeric,(v->>'quantity')::numeric*(v->>'unit_price')::numeric from jsonb_array_elements(payload->'items') v;
  insert into audit_logs(actor_id,action,entity,entity_id,new_value,metadata) values(u.id,'REQUEST_QUOTE_DRAFT','quotations',q.id,jsonb_build_object('total',q.total,'version',q.version),jsonb_build_object('request_id',r.id));
  return jsonb_build_object('id',q.id,'request_id',r.id,'version',q.version);
 elsif operation in ('quote_send','quote_cancel','quote_expire','quote_view','quote_revise','quote_reject','quote_accept') then
  select * into q from quotations where id=(payload->>'quote_id')::uuid and request_id=r.id for update;
  if q.id is null then raise exception 'Không tìm thấy báo giá của yêu cầu này.'; end if;
  if q.version<>(select max(version) from quotations where request_id=r.id) then raise exception 'Chỉ được phản hồi phiên bản báo giá mới nhất.'; end if;
  if operation='quote_cancel' then
   if q.status<>'DRAFT' then raise exception 'Chỉ hủy bản nháp; báo giá gửi phải giữ lịch sử.'; end if;
   update quotations set status='CANCELLED' where id=q.id;
   insert into audit_logs(actor_id,action,entity,entity_id,old_value,new_value) values(u.id,'REQUEST_QUOTE_DRAFT_CANCELLED','quotations',q.id,jsonb_build_object('status','DRAFT'),jsonb_build_object('status','CANCELLED'));
   return jsonb_build_object('id',q.id,'request_id',r.id);
  end if;
  if operation='quote_send' then
   if q.status<>'DRAFT' or r.status not in ('QUOTE_PREPARING','QUOTE_REVISION') or q.valid_until<(now() at time zone 'Asia/Ho_Chi_Minh')::date or length(btrim(q.revision_policy))=0 then raise exception 'Bản nháp chưa sẵn sàng gửi, thiếu chính sách chỉnh sửa hoặc đã hết hạn.'; end if;
   if not exists(select 1 from quotation_items where quotation_id=q.id) or exists(select 1 from quotation_items i left join services s on s.id=i.service_id where i.quotation_id=q.id and coalesce(s.active,false)=false) then raise exception 'Cần hạng mục dịch vụ đang hoạt động.'; end if;
   update quotations set status='SENT',sent_at=now() where id=q.id;
   update requests set status='QUOTE_SENT' where id=r.id returning * into r;
   event_name:='QUOTE_SENT'; event_text:='MediaHub đã gửi báo giá phiên bản '||q.version||'. Vui lòng xem phạm vi, giá và điều kiện trước khi phản hồi.';
  else
   if q.status not in ('SENT','VIEWED') or r.status<>'QUOTE_SENT' then raise exception 'Báo giá không còn chờ phản hồi.'; end if;
   if operation='quote_expire' then
    if q.valid_until>=(now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'Báo giá chưa hết hạn.'; end if;
    update quotations set status='EXPIRED',responded_at=now() where id=q.id;
    update requests set status='QUOTE_REVISION' where id=r.id returning * into r;
    event_name:='QUOTE_EXPIRED'; event_text:='Báo giá đã hết hạn. Người phụ trách cần gửi phiên bản mới.';
   else
    if q.valid_until<(now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'Báo giá đã hết hạn; cần phiên bản mới.'; end if;
    if operation='quote_view' then
     update quotations set status='VIEWED',viewed_at=coalesce(viewed_at,now()) where id=q.id;
     return jsonb_build_object('id',q.id,'request_id',r.id);
    elsif operation in ('quote_revise','quote_reject') then
     if length(response) not between 1 and 2000 then raise exception 'Vui lòng ghi nội dung chỉnh sửa/từ chối.'; end if;
     update quotations set status=case operation when 'quote_revise' then 'REVISION_REQUESTED' else 'REJECTED' end,response_reason=response,responded_at=now() where id=q.id;
     update requests set status='QUOTE_REVISION' where id=r.id returning * into r;
     event_name:=case operation when 'quote_revise' then 'QUOTE_REVISION_REQUESTED' else 'QUOTE_REJECTED' end;
     event_text:=case operation when 'quote_revise' then 'Khách hàng yêu cầu chỉnh báo giá: ' else 'Khách hàng từ chối báo giá: ' end||response;
    elsif operation='quote_accept' then
     if r.assigned_to is null or not exists(select 1 from profiles where id=r.assigned_to and active and role in ('STAFF','ADMIN')) then raise exception 'Cần người phụ trách đang hoạt động để tạo đơn.'; end if;
     select * into cp from creator_proposals where id=q.creator_proposal_id and request_id=r.id and status='SELECTED';
     if cp.id is null or r.selected_proposal_id<>cp.id then raise exception 'Creator của báo giá không khớp lựa chọn hiện tại.'; end if;
     update quotations set status='ACCEPTED',responded_at=now() where id=q.id returning * into q;
     insert into orders(request_id,customer_id,assigned_to,creator_id,accepted_quotation_id,quote_snapshot,creator_snapshot,total,deposit_amount,remaining_amount)
     values(r.id,r.customer_id,r.assigned_to,cp.creator_id,q.id,to_jsonb(q)||jsonb_build_object('items',(select jsonb_agg(to_jsonb(i) order by i.id) from quotation_items i where i.quotation_id=q.id)),cp.creator_snapshot,q.total,q.deposit_amount,q.remaining_amount) returning * into o;
     insert into order_items(order_id,service_id,description,quantity,unit_price,total) select o.id,service_id,description,quantity,unit_price,total from quotation_items where quotation_id=q.id;
     update requests set status='CONVERTED' where id=r.id returning * into r;
     perform record_request_event(u.id,r.id,'QUOTE_ACCEPTED','Khách hàng đã chấp nhận báo giá phiên bản '||q.version||'.',jsonb_build_object('quote_id',q.id),previous,jsonb_build_object('status',r.status),null);
     event_name:='ORDER_CREATED'; event_text:='Đơn dịch vụ đã được tạo và đang chờ hợp đồng. Chưa xác nhận thanh toán hay bắt đầu sản xuất.';
    end if;
   end if;
  end if;
  metadata:=jsonb_build_object('quote_id',q.id,'version',q.version,'order_id',o.id);
 else raise exception 'Thao tác thương mại chưa được hỗ trợ.';
 end if;
 perform record_request_event(u.id,r.id,event_name,event_text,metadata,previous,jsonb_build_object('status',r.status,'selected_proposal_id',r.selected_proposal_id),nullif(response,''));
 return jsonb_build_object('id',coalesce(o.id,q.id,cp.id,r.id),'request_id',r.id,'order_id',o.id);
end $$;
revoke all on function public.request_commerce_action(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.request_commerce_action(uuid,uuid,text,jsonb) to service_role;

-- A converted brief remains the commercial conversation for its order. Keep
-- the applied consultation implementation immutable and revoked as a base.
alter function public.request_action(uuid,uuid,text,jsonb) rename to request_action_consultation_base;
revoke all on function public.request_action_consultation_base(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
create function public.request_action(actor_id uuid,rid uuid,operation text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public as $$
declare r requests; o orders; u profiles; target profiles; owner_id uuid; conv uuid; new_id uuid; transfer_reason text;
begin
 if operation not in ('message','note','attachment','assign') or rid is null then return request_action_consultation_base(actor_id,rid,operation,payload); end if;
 select * into r from requests where id=rid for update;
 if operation='assign' and r.status in ('CREATOR_SELECTION','QUOTE_PREPARING','QUOTE_SENT','QUOTE_REVISION','READY_TO_ORDER') then
  select * into u from profiles where id=actor_id and active;
  if u.id is null or not (u.role='ADMIN' or (u.role='STAFF' and r.assigned_to=u.id)) then raise exception 'Chỉ người phụ trách/admin được chuyển yêu cầu.'; end if;
  select * into target from profiles where id=(payload->>'assigned_to')::uuid and active and role in ('STAFF','ADMIN');
  if target.id is null then raise exception 'Vui lòng chọn nhân viên đang hoạt động.'; end if;
  if target.id=r.assigned_to then return jsonb_build_object('id',r.id); end if;
  transfer_reason:=btrim(coalesce(payload->>'reason',''));
  if length(transfer_reason) not between 1 and 2000 then raise exception 'Cần ghi lý do chuyển người phụ trách.'; end if;
  select profile_id into owner_id from customers where id=r.customer_id;
  select id into conv from conversations where request_id=r.id;
  update request_assignments set ended_at=now(),ended_by=u.id,end_reason=transfer_reason where request_id=r.id and ended_at is null;
  insert into request_assignments(request_id,staff_id,assigned_by,reason) values(r.id,target.id,u.id,transfer_reason);
  delete from conversation_members where conversation_id=conv and profile_id<>owner_id;
  insert into conversation_members(conversation_id,profile_id) values(conv,target.id);
  update requests set assigned_to=target.id where id=r.id;
  perform record_request_event(u.id,r.id,'REQUEST_TRANSFERRED',target.full_name||' đã được phân công phụ trách yêu cầu.',null,jsonb_build_object('status',r.status,'assigned_to',r.assigned_to),jsonb_build_object('status',r.status,'assigned_to',target.id),transfer_reason);
  return jsonb_build_object('id',r.id,'conversation_id',conv);
 end if;
 if r.status is distinct from 'CONVERTED' or operation='assign' then return request_action_consultation_base(actor_id,rid,operation,payload); end if;
 select * into u from profiles where id=actor_id and active;
 select * into o from orders where request_id=r.id;
 select profile_id into owner_id from customers where id=r.customer_id;
 if u.id is null or not (u.role='ADMIN' or (u.role='STAFF' and r.assigned_to=u.id and o.assigned_to=u.id) or (u.role in ('CUSTOMER','BUSINESS') and owner_id=u.id)) then raise exception 'Không có quyền truy cập hội thoại đơn dịch vụ.'; end if;
 if o.id is null or o.status in ('COMPLETED','CANCELLED','REFUNDED') then raise exception 'Đơn dịch vụ đã đóng; hội thoại chỉ để xem lại.'; end if;
 select id into conv from conversations where request_id=r.id;
 if conv is null then raise exception 'Hội thoại chưa được thiết lập.'; end if;
 if operation in ('message','note') then
  if length(btrim(payload->>'content')) not between 1 and 5000 then raise exception 'Nội dung không hợp lệ.'; end if;
  if operation='note' then
   if u.role not in ('STAFF','ADMIN') then raise exception 'Chỉ người phụ trách/admin được ghi chú nội bộ.'; end if;
   insert into request_notes(request_id,author_id,content) values(r.id,u.id,btrim(payload->>'content')) returning id into new_id;
   insert into audit_logs(actor_id,action,entity,entity_id,metadata) values(u.id,'REQUEST_NOTE','requests',r.id,jsonb_build_object('note_id',new_id,'order_id',o.id));
  else
   insert into conversation_messages(conversation_id,sender_id,content) values(conv,u.id,btrim(payload->>'content')) returning id into new_id;
   update conversation_members set last_read_at=now() where conversation_id=conv and profile_id=u.id;
  end if;
 else
  if (select count(*) from request_attachments where request_id=r.id)>=20 then raise exception 'Tối đa 20 tệp tham khảo mỗi yêu cầu.'; end if;
  if coalesce(payload->>'path','')!~('^requests/'||r.id||'/[0-9a-f-]{36}\.(pdf|png|jpg|jpeg|webp|mp4|mov)$') then raise exception 'Đường dẫn tệp không hợp lệ.'; end if;
  insert into request_attachments(request_id,uploaded_by,file_name,storage_path,file_type,file_size) values(r.id,u.id,payload->>'name',payload->>'path',payload->>'type',(payload->>'size')::bigint) returning id into new_id;
  perform record_request_event(u.id,r.id,'REQUEST_ATTACHMENT',u.full_name||' đã thêm tệp tham khảo: '||left(payload->>'name',255),jsonb_build_object('attachment_id',new_id,'order_id',o.id),null,null,null);
 end if;
 update requests set updated_at=now() where id=r.id;
 return jsonb_build_object('id',r.id,'message_id',new_id);
end $$;
revoke all on function public.request_action(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.request_action(uuid,uuid,text,jsonb) to service_role;

commit;
