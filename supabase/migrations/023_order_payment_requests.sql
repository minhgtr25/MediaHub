begin;

-- Separate order-origin payments preserve project-only legacy plans/receipts.
create table public.order_payment_requests (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references orders(id),
 kind text not null check(kind in ('DEPOSIT','FULL','MILESTONE','REMAINING')),
 amount numeric(16,2) not null check(amount>0), percentage numeric(5,2) check(percentage>0 and percentage<=100),
 due_date date not null, note text not null default '' check(length(note)<=2000),
 reference text not null unique default ('MHO-'||upper(replace(gen_random_uuid()::text,'-',''))),
 bank_snapshot jsonb not null, created_by uuid not null references profiles(id),
 idempotency_key uuid not null, request_input jsonb not null,
 status text not null default 'PENDING' check(status in ('PENDING','AWAITING_VERIFICATION','PAID','EXPIRED','CANCELLED')),
 transfer_note text not null default '' check(length(transfer_note)<=2000), reported_at timestamptz,
 response_reason text check(length(response_reason)<=2000), paid_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(order_id,idempotency_key)
);
create index order_payments_history_idx on order_payment_requests(order_id,created_at desc,id desc);
create index order_payments_due_idx on order_payment_requests(status,due_date);
create trigger touch before update on order_payment_requests for each row execute function touch_updated();
create table public.order_payment_receipts (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references orders(id),
 payment_request_id uuid not null unique references order_payment_requests(id),
 amount numeric(16,2) not null check(amount>0), receiving_account_key text not null,
 bank_transaction_reference text not null unique check(length(bank_transaction_reference) between 1 and 120),
 received_at timestamptz not null, verified_by uuid not null references profiles(id),
 verification_method text not null default 'MANUAL_BANK' check(verification_method='MANUAL_BANK'),
 payment_snapshot jsonb not null, created_at timestamptz not null default now(),
 unique(receiving_account_key,bank_transaction_reference)
);
alter table order_payment_requests enable row level security;
alter table order_payment_receipts enable row level security;
revoke all on order_payment_requests,order_payment_receipts from anon,authenticated;
grant select on order_payment_requests,order_payment_receipts to authenticated;
grant all on order_payment_requests,order_payment_receipts to service_role;
create policy order_payment_reader on order_payment_requests for select to authenticated using(can_access_order(order_id));
create policy order_receipt_reader on order_payment_receipts for select to authenticated using(can_access_order(order_id));

create function public.guard_order_payment_request() returns trigger language plpgsql set search_path=public as $$
declare oid uuid;
begin
 oid:=case when TG_OP='INSERT' then new.order_id else old.order_id end;
 if current_user not in ('postgres','supabase_admin','service_role') or nullif(current_setting('app.payment_order',true),'')::uuid is distinct from oid then raise exception 'Yêu cầu thu chỉ thay đổi qua workflow thanh toán.'; end if;
 if TG_OP='DELETE' then raise exception 'Giữ nguyên lịch sử yêu cầu thu.'; end if;
 if TG_OP='UPDATE' then
  if (to_jsonb(new)-array['status','transfer_note','reported_at','response_reason','paid_at','updated_at']) is distinct from (to_jsonb(old)-array['status','transfer_note','reported_at','response_reason','paid_at','updated_at']) then raise exception 'Số tiền/thông tin nhận tiền đã phát hành là bất biến; cần hủy và tạo yêu cầu mới.'; end if;
  if old.status in ('PAID','EXPIRED','CANCELLED') and new is distinct from old then raise exception 'Không được sửa yêu cầu thu đã đóng.'; end if;
  if new.status<>old.status and not ((old.status='PENDING' and new.status in ('AWAITING_VERIFICATION','EXPIRED','CANCELLED')) or (old.status='AWAITING_VERIFICATION' and new.status in ('PAID','PENDING','EXPIRED'))) then raise exception 'Chuyển trạng thái yêu cầu thu không hợp lệ.'; end if;
 end if;
 return new;
end $$;
create trigger order_payment_guard before insert or update or delete on order_payment_requests for each row execute function guard_order_payment_request();
create function public.guard_order_payment_receipt() returns trigger language plpgsql set search_path=public as $$
declare p order_payment_requests; o orders;
begin
 if TG_OP<>'INSERT' then raise exception 'Khoản thu đã xác minh là bất biến; điều chỉnh cần bút toán riêng.'; end if;
 select * into p from order_payment_requests where id=new.payment_request_id;
 select * into o from orders where id=p.order_id;
 if current_user not in ('postgres','supabase_admin','service_role') or nullif(current_setting('app.payment_order',true),'')::uuid is distinct from p.order_id
  or p.id is null or new.order_id<>p.order_id or new.amount<>p.amount or p.status<>'PAID' or new.payment_snapshot is distinct from to_jsonb(p)
  or new.receiving_account_key<>encode(sha256(convert_to(lower(btrim(p.bank_snapshot->>'bank_name'))||':'||btrim(p.bank_snapshot->>'account_number'),'UTF8')),'hex')
  or new.bank_transaction_reference<>upper(btrim(new.bank_transaction_reference)) or new.received_at>now() or new.received_at<p.created_at
  or new.verified_by is distinct from nullif(current_setting('app.actor',true),'')::uuid or not exists(select 1 from profiles where id=new.verified_by and role='ADMIN' and active)
  or (select coalesce(sum(amount),0) from order_payment_receipts where order_id=p.order_id)+new.amount>o.total
 then raise exception 'Khoản thu không khớp yêu cầu/đơn hoặc chưa có admin xác minh.'; end if;
 return new;
end $$;
create trigger order_receipt_guard before insert or update or delete on order_payment_receipts for each row execute function guard_order_payment_receipt();

alter table conversation_messages drop constraint conversation_messages_kind_check;
alter table conversation_messages add constraint conversation_messages_kind_check check(kind in ('TEXT','SYSTEM','CREATOR_PROPOSAL','QUOTE','ORDER','CONTRACT','PAYMENT'));
create or replace function public.record_request_event(actor uuid,rid uuid,event_name text,event_text text,event_metadata jsonb,previous jsonb,next_value jsonb,event_reason text default null) returns void language plpgsql security definer set search_path=public as $$
begin
 insert into conversation_messages(conversation_id,sender_id,content,kind,event_data)
 select id,actor,event_text,case event_name when 'CREATOR_PROPOSED' then 'CREATOR_PROPOSAL' when 'QUOTE_SENT' then 'QUOTE' when 'ORDER_CREATED' then 'ORDER' when 'CONTRACT_SENT' then 'CONTRACT' when 'PAYMENT_REQUESTED' then 'PAYMENT' else 'SYSTEM' end,
 jsonb_build_object('event',event_name)||coalesce(event_metadata,'{}') from conversations where request_id=rid;
 insert into audit_logs(actor_id,action,entity,entity_id,old_value,new_value,reason,metadata)
 values(actor,event_name,'requests',rid,previous,next_value,event_reason,coalesce(event_metadata,'{}'));
end $$;

create function public.order_payment_action(actor_id uuid,oid uuid,operation text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public as $$
declare u profiles; o orders; r requests; p order_payment_requests; receipt order_payment_receipts; bank payment_settings;
 owner_id uuid; operator boolean; customer_actor boolean; net numeric; reserved numeric; available numeric; value numeric; rate numeric; required_amount numeric;
 reason text:=btrim(coalesce(payload->>'reason','')); txref text:=upper(btrim(coalesce(payload->>'bank_transaction_reference','')));
 input jsonb; prior jsonb; event_name text; event_text text; receiving_key text;
begin
 select * into u from profiles where id=actor_id and active;
 if u.id is null or u.role not in ('ADMIN','STAFF','CUSTOMER','BUSINESS') then raise exception 'Không có quyền truy cập.'; end if;
 select request_id into owner_id from orders where id=oid;
 select * into r from requests where id=owner_id for update;
 select * into o from orders where id=oid for update;
 if o.id is null or r.id is null then raise exception 'Không tìm thấy đơn.'; end if;
 select profile_id into owner_id from customers where id=o.customer_id;
 operator:=u.role='ADMIN' or (u.role='STAFF' and o.assigned_to=u.id and r.assigned_to=u.id);
 customer_actor:=u.role in ('CUSTOMER','BUSINESS') and owner_id=u.id;
 if not(operator or customer_actor) then raise exception 'Không có quyền truy cập đơn.'; end if;
 if operation in ('create','cancel','expire') and not operator then raise exception 'Chỉ người phụ trách/admin được tạo/quản lý yêu cầu thu.'; end if;
 if operation='report' and not customer_actor then raise exception 'Chỉ chủ đơn được báo đã chuyển khoản.'; end if;
 if operation in ('confirm','reject') and u.role<>'ADMIN' then raise exception 'Chỉ admin được đối soát khoản thu.'; end if;
 if operation='confirm' and payload->'verified' is distinct from 'true'::jsonb then raise exception 'Cần xác nhận đã đối chiếu khoản nhận thực tế.'; end if;
 if operation not in ('create','report','confirm','reject','cancel','expire') then raise exception 'Thao tác thanh toán không được hỗ trợ.'; end if;
 perform set_config('app.actor',u.id::text,true); perform set_config('app.payment_order',o.id::text,true);
 if operation='create' then
  input:=jsonb_build_object('kind',payload->>'kind','amount',payload->'amount','percentage',payload->'percentage','due_date',payload->>'due_date','note',btrim(coalesce(payload->>'note','')));
  if payload->>'idempotency_key' is null then raise exception 'Cần khóa chống gửi lặp.'; end if;
  select * into p from order_payment_requests where order_id=o.id and idempotency_key=(payload->>'idempotency_key')::uuid;
  if p.id is not null then
   if p.request_input is distinct from input then raise exception 'Khóa chống gửi lặp đã dùng với nội dung khác.'; end if;
   return jsonb_build_object('id',p.id,'order_id',o.id,'reused',true);
  end if;
 else
  select * into p from order_payment_requests where id=(payload->>'payment_id')::uuid and order_id=o.id for update;
  if p.id is null then raise exception 'Không tìm thấy yêu cầu thu của đơn.'; end if;
  if operation='confirm' and p.status='PAID' then
   select * into receipt from order_payment_receipts where payment_request_id=p.id;
   if receipt.bank_transaction_reference=txref and receipt.amount=(payload->>'received_amount')::numeric and receipt.received_at=(payload->>'received_at')::timestamptz then return jsonb_build_object('id',p.id,'order_id',o.id,'reused',true); end if;
   raise exception 'Yêu cầu đã thu; thông tin xác minh lặp không khớp.';
  end if;
  if operation='report' and p.status in ('AWAITING_VERIFICATION','PAID') then
   if p.transfer_note=btrim(coalesce(payload->>'transfer_note','')) then return jsonb_build_object('id',p.id,'order_id',o.id,'reused',true); end if;
   raise exception 'Báo chuyển khoản đang chờ đối soát/đã thu; không sửa nội dung đã gửi.';
  end if;
 end if;
 if o.status not in ('WAITING_PAYMENT','CONFIRMED','IN_PROGRESS','WAITING_ACCEPTANCE') or r.status<>'CONVERTED'
  or not exists(select 1 from contract_acknowledgments where order_id=o.id) then raise exception 'Đơn chưa xác nhận điều khoản hoặc đã đóng.'; end if;
 select coalesce(sum(amount),0) into net from order_payment_receipts where order_id=o.id;
 select coalesce(sum(amount),0) into reserved from order_payment_requests where order_id=o.id and status in ('PENDING','AWAITING_VERIFICATION');
 available:=o.total-net-reserved;
 prior:=jsonb_build_object('order_status',o.status,'payment_status',p.status,'collected',net);
 if operation='create' then
  select * into bank from payment_settings where id='default' for share;
  if not coalesce(bank.enabled,false) or length(btrim(bank.bank_name))=0 or length(btrim(bank.account_name))=0 or length(btrim(bank.account_number))=0 then raise exception 'Admin cần cấu hình tài khoản nhận tiền đang hoạt động.'; end if;
  if not exists(select 1 from profiles where id=o.assigned_to and active and role in ('STAFF','ADMIN')) then raise exception 'Cần người phụ trách đang hoạt động.'; end if;
  if (payload->>'due_date')::date is null or (payload->>'due_date')::date<(now() at time zone 'Asia/Ho_Chi_Minh')::date or length(coalesce(payload->>'note',''))>2000 then raise exception 'Hạn thanh toán/ghi chú không hợp lệ.'; end if;
  if payload->>'kind' in ('DEPOSIT','FULL','REMAINING') then
   if payload->'amount' not in ('null'::jsonb) and payload->'amount' is not null or payload->'percentage' not in ('null'::jsonb) and payload->'percentage' is not null then raise exception 'Số tiền loại này được tính từ điều kiện đơn, không nhập lại.'; end if;
   if reserved<>0 then raise exception 'Cần đối soát/hủy yêu cầu đang mở trước khi thu cọc/toàn bộ/phần còn lại.'; end if;
   if payload->>'kind' in ('DEPOSIT','FULL') and net<>0 then raise exception 'Đơn đã có khoản thu; dùng yêu cầu phần còn lại hoặc theo mốc.'; end if;
   value:=case payload->>'kind' when 'DEPOSIT' then o.deposit_amount when 'FULL' then o.total else o.total-net end;
  elsif payload->>'kind'='MILESTONE' then
   if ((payload->>'amount') is null) = ((payload->>'percentage') is null) then raise exception 'Nhập đúng một trong số tiền hoặc phần trăm theo mốc.'; end if;
   rate:=(payload->>'percentage')::numeric;
   if rate is not null and (rate<=0 or rate>100 or rate<>round(rate,2)) then raise exception 'Phần trăm không hợp lệ.'; end if;
   value:=case when rate is null then (payload->>'amount')::numeric else round(o.total*rate/100,2) end;
  else raise exception 'Loại yêu cầu thu không hợp lệ.'; end if;
  if value is null or value<=0 or value<>round(value,2) or value>available then raise exception 'Số tiền phải dương, tối đa hai số thập phân và không vượt phần còn có thể yêu cầu.'; end if;
  insert into order_payment_requests(order_id,kind,amount,percentage,due_date,note,bank_snapshot,created_by,idempotency_key,request_input)
  values(o.id,payload->>'kind',value,rate,(payload->>'due_date')::date,btrim(coalesce(payload->>'note','')),
   jsonb_build_object('bank_name',bank.bank_name,'account_number',bank.account_number,'account_name',bank.account_name,'instructions',bank.instructions),u.id,(payload->>'idempotency_key')::uuid,input) returning * into p;
  event_name:='PAYMENT_REQUESTED'; event_text:='MediaHub đã gửi yêu cầu thanh toán '||p.reference||' với số tiền '||p.amount||' VND.';
 elsif operation='report' then
  if p.status<>'PENDING' or p.due_date<(now() at time zone 'Asia/Ho_Chi_Minh')::date or not exists(select 1 from payment_settings where id='default' and enabled) or length(btrim(coalesce(payload->>'transfer_note',''))) not between 1 and 2000 then raise exception 'Yêu cầu thu không còn đủ điều kiện báo chuyển khoản hoặc thiếu ghi chú.'; end if;
  update order_payment_requests set status='AWAITING_VERIFICATION',transfer_note=btrim(payload->>'transfer_note'),reported_at=now(),response_reason=null where id=p.id returning * into p;
  event_name:='PAYMENT_REPORTED'; event_text:='Khách hàng báo đã chuyển khoản '||p.reference||'; Admin cần đối soát khoản nhận. Chưa ghi nhận khoản thu.';
 elsif operation='confirm' then
  if p.status<>'AWAITING_VERIFICATION' or (payload->>'received_amount')::numeric is distinct from p.amount or (payload->>'received_at')::timestamptz is null or (payload->>'received_at')::timestamptz>now() or (payload->>'received_at')::timestamptz<p.created_at
   or length(txref) not between 1 and 120 or length(reason) not between 1 and 2000 or net+p.amount>o.total then raise exception 'Cần đúng số tiền, mã giao dịch ngân hàng, thời điểm thực nhận và ghi chú đối soát.'; end if;
  receiving_key:=encode(sha256(convert_to(lower(btrim(p.bank_snapshot->>'bank_name'))||':'||btrim(p.bank_snapshot->>'account_number'),'UTF8')),'hex');
  if exists(select 1 from order_payment_receipts where bank_transaction_reference=txref) then raise exception 'Mã giao dịch ngân hàng đã được ghi nhận; cần đối soát nếu ngân hàng dùng lại mã.'; end if;
  update order_payment_requests set status='PAID',paid_at=(payload->>'received_at')::timestamptz,response_reason=null where id=p.id returning * into p;
  insert into order_payment_receipts(order_id,payment_request_id,amount,receiving_account_key,bank_transaction_reference,received_at,verified_by,payment_snapshot)
  values(o.id,p.id,p.amount,receiving_key,txref,p.paid_at,u.id,to_jsonb(p));
  net:=net+p.amount;
  required_amount:=case when o.deposit_amount>0 then o.deposit_amount else o.total end;
  if o.status='WAITING_PAYMENT' and net>0 and net>=required_amount then update orders set status='CONFIRMED' where id=o.id returning * into o; end if;
  event_name:='PAYMENT_VERIFIED'; event_text:='Admin đã xác minh khoản nhận '||p.amount||' VND cho '||p.reference||'.';
 elsif operation='reject' then
  if p.status<>'AWAITING_VERIFICATION' or length(reason) not between 1 and 2000 then raise exception 'Cần yêu cầu chờ xác minh và lý do công khai trả lại.'; end if;
  update order_payment_requests set status=case when due_date<(now() at time zone 'Asia/Ho_Chi_Minh')::date then 'EXPIRED' else 'PENDING' end,response_reason=reason where id=p.id returning * into p;
  event_name:='PAYMENT_REPORT_REJECTED'; event_text:='Báo chuyển khoản '||p.reference||' chưa được xác minh. Lý do: '||reason;
 elsif operation='cancel' then
  if p.status<>'PENDING' or length(reason) not between 1 and 2000 then raise exception 'Chỉ hủy yêu cầu chưa báo chuyển khoản, kèm lý do.'; end if;
  update order_payment_requests set status='CANCELLED',response_reason=reason where id=p.id returning * into p;
  event_name:='PAYMENT_CANCELLED'; event_text:='Yêu cầu thanh toán '||p.reference||' đã hủy. Lý do: '||reason;
 elsif operation='expire' then
  if p.status<>'PENDING' or p.due_date>=(now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'Chỉ hết hạn yêu cầu chưa báo chuyển khoản và đã quá hạn.'; end if;
  update order_payment_requests set status='EXPIRED' where id=p.id returning * into p;
  event_name:='PAYMENT_EXPIRED'; event_text:='Yêu cầu thanh toán '||p.reference||' đã hết hạn.';
 end if;
 perform record_request_event(u.id,r.id,event_name,event_text,jsonb_build_object('order_id',o.id,'payment_id',p.id,'reference',p.reference),prior,jsonb_build_object('order_status',o.status,'payment_status',p.status,'collected',net),nullif(reason,''));
 return jsonb_build_object('id',p.id,'order_id',o.id);
end $$;
revoke all on function public.order_payment_action(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.order_payment_action(uuid,uuid,text,jsonb) to service_role;

commit;
