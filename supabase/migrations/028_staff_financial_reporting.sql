begin;
-- Retain the original implementation as revoked history; use real Staff identity.
alter function order_payment_action(uuid,uuid,text,jsonb) rename to legacy_order_payment_action_028;
revoke all on function legacy_order_payment_action_028(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
create or replace function public.guard_order_payment_receipt() returns trigger language plpgsql set search_path=public as $$
declare p order_payment_requests; o orders;
begin
 if TG_OP<>'INSERT' then raise exception 'Khoản thu đã xác minh là bất biến; điều chỉnh cần bút toán riêng.'; end if;
 select * into p from order_payment_requests where id=new.payment_request_id;
 select * into o from orders where id=p.order_id;
 if current_user not in ('postgres','supabase_admin','service_role') or nullif(current_setting('app.payment_order',true),'')::uuid is distinct from p.order_id
  or p.id is null or new.order_id<>p.order_id or new.amount<>p.amount or p.status<>'PAID' or new.payment_snapshot is distinct from to_jsonb(p)
  or new.receiving_account_key<>encode(sha256(convert_to(lower(btrim(p.bank_snapshot->>'bank_name'))||':'||btrim(p.bank_snapshot->>'account_number'),'UTF8')),'hex')
  or new.bank_transaction_reference<>upper(btrim(new.bank_transaction_reference)) or new.received_at>now() or new.received_at<p.created_at
  or new.verified_by is distinct from nullif(current_setting('app.actor',true),'')::uuid or not exists(select 1 from profiles where id=new.verified_by and active and (role='ADMIN' or (role='STAFF' and o.assigned_to=id and exists(select 1 from requests where requests.id=o.request_id and assigned_to=profiles.id))))
  or (select coalesce(sum(amount),0) from order_payment_receipts where order_id=p.order_id)+new.amount>o.total
 then raise exception 'Khoản thu không khớp yêu cầu/đơn hoặc chưa có người phụ trách/Admin xác minh.'; end if;
 return new;
end $$;
create or replace function public.order_payment_action(actor_id uuid,oid uuid,operation text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public as $$
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
 if operation in ('confirm','reject') and not operator then raise exception 'Chỉ người phụ trách/Admin được đối soát khoản thu.'; end if;
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
  event_name:='PAYMENT_REPORTED'; event_text:='Khách hàng báo đã chuyển khoản '||p.reference||'; Người phụ trách cần đối soát khoản nhận. Chưa ghi nhận khoản thu.';
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
  event_name:='PAYMENT_VERIFIED'; event_text:='Người phụ trách đã xác minh khoản nhận '||p.amount||' VND cho '||p.reference||'.';
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
revoke all on function order_payment_action(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function order_payment_action(uuid,uuid,text,jsonb) to service_role;

-- New orders retain the Staff who closed the consultation, independently of
-- later operational transfers. Existing orders stay unattributed, not guessed.
alter table orders add column closed_by uuid references profiles(id);
create index orders_closed_by_period on orders(closed_by,accepted_at);
create index order_receipts_received_period on order_payment_receipts(received_at,order_id);
create function public.guard_order_attribution() returns trigger language plpgsql set search_path=public as $$
begin
 if TG_OP='INSERT' then new.closed_by:=new.assigned_to;
 elsif new.closed_by is distinct from old.closed_by then raise exception 'Người chốt đơn được lưu bất biến; chuyển người phụ trách không chuyển ghi nhận.';
 end if;
 return new;
end $$;
create trigger order_attribution_guard before insert or update on orders for each row execute function guard_order_attribution();

create table public.order_final_funds_confirmations (
 order_id uuid primary key references orders(id), confirmed_by uuid not null references profiles(id),
 amount numeric(16,2) not null check(amount>0), receipt_snapshot jsonb not null,
 note text not null check(length(btrim(note)) between 1 and 2000), confirmed_at timestamptz not null default now()
);
alter table order_final_funds_confirmations enable row level security;
revoke all on order_final_funds_confirmations from anon,authenticated;
grant select on order_final_funds_confirmations to authenticated;
grant all on order_final_funds_confirmations to service_role;
create policy final_funds_reader on order_final_funds_confirmations for select to authenticated using(can_access_order(order_id));
create function public.guard_final_funds_confirmation() returns trigger language plpgsql set search_path=public as $$
declare o orders; collected numeric; evidence jsonb;
begin
 if TG_OP<>'INSERT' then raise exception 'Bằng chứng xác nhận thu đủ được giữ bất biến.'; end if;
 select * into o from orders where id=new.order_id;
 select coalesce(sum(amount),0),coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]') into collected,evidence from order_payment_receipts r where order_id=o.id;
 if current_user not in ('postgres','supabase_admin','service_role') or nullif(current_setting('app.final_funds_order',true),'')::uuid is distinct from o.id
  or o.id is null or o.total<=0 or collected<>o.total or new.amount<>collected or new.receipt_snapshot is distinct from evidence
  or new.confirmed_by is distinct from nullif(current_setting('app.actor',true),'')::uuid or new.confirmed_by<>o.assigned_to
  or not exists(select 1 from profiles p join requests q on q.id=o.request_id where p.id=new.confirmed_by and p.active and p.role in ('STAFF','ADMIN') and q.assigned_to=p.id)
 then raise exception 'Cần người phụ trách xác nhận đủ khoản thu thực tế đã đối soát.'; end if;
 return new;
end $$;
create trigger final_funds_guard before insert or update or delete on order_final_funds_confirmations for each row execute function guard_final_funds_confirmation();
create function public.confirm_order_final_funds(actor_id uuid,oid uuid,payload jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare u profiles; o orders; r requests; c order_final_funds_confirmations; collected numeric; evidence jsonb; note text:=btrim(coalesce(payload->>'note',''));
begin
 select * into u from profiles where id=actor_id and active and role in ('STAFF','ADMIN');
 select request_id into r.id from orders where id=oid;
 select * into r from requests where id=r.id for update;
 select * into o from orders where id=oid for update;
 if u.id is null or o.id is null or o.assigned_to<>u.id or r.assigned_to<>u.id then raise exception 'Chỉ người đang phụ trách đơn xác nhận thu đủ.'; end if;
 if payload->'verified' is distinct from 'true'::jsonb or length(note) not between 1 and 2000 then raise exception 'Cần xác nhận đối chiếu đủ tiền và ghi chú lưu hồ sơ.'; end if;
 select * into c from order_final_funds_confirmations where order_id=o.id;
 if c.order_id is not null then return jsonb_build_object('order_id',o.id,'reused',true); end if;
 if o.status not in ('CONFIRMED','IN_PROGRESS','WAITING_ACCEPTANCE') or r.status<>'CONVERTED' or not exists(select 1 from contract_acknowledgments where order_id=o.id) then raise exception 'Đơn chưa đủ điều kiện xác nhận thu đủ.'; end if;
 select coalesce(sum(amount),0),coalesce(jsonb_agg(to_jsonb(receipt) order by receipt.id),'[]') into collected,evidence from order_payment_receipts receipt where order_id=o.id;
 if o.total<=0 or collected<>o.total then raise exception 'Báo chuyển khoản chưa đủ; cần khoản thực nhận đã xác minh bằng toàn bộ giá trị đơn.'; end if;
 perform set_config('app.actor',u.id::text,true); perform set_config('app.final_funds_order',o.id::text,true);
 insert into order_final_funds_confirmations(order_id,confirmed_by,amount,receipt_snapshot,note) values(o.id,u.id,collected,evidence,note);
 perform record_request_event(u.id,r.id,'PAYMENT_FULL_CONFIRMED','Người phụ trách đã xác nhận thu đủ toàn bộ giá trị đơn.',jsonb_build_object('order_id',o.id),null,jsonb_build_object('collected',collected),note);
 return jsonb_build_object('order_id',o.id);
end $$;
revoke all on function confirm_order_final_funds(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function confirm_order_final_funds(uuid,uuid,jsonb) to service_role;

create function public.commerce_finance_report(actor_id uuid,report_year integer,report_month integer,staff_filter uuid default null,report_page integer default 1)
 returns jsonb language plpgsql security definer set search_path=public as $$
declare u profiles; filter_id uuid; start_at timestamptz; end_at timestamptz; summary jsonb; breakdown jsonb; items jsonb; row_count bigint;
begin
 select * into u from profiles where id=actor_id and active and role in ('STAFF','ADMIN');
 if u.id is null then raise exception 'Chỉ Staff/Admin xem thống kê tài chính.'; end if;
 if report_year not between 2020 and 2100 or report_month not between 0 and 12 or report_page not between 1 and 100000 then raise exception 'Kỳ thống kê chưa hợp lệ.'; end if;
 if u.role='STAFF' and staff_filter is not null and staff_filter<>u.id then raise exception 'Staff chỉ xem thống kê của mình.'; end if;
 filter_id:=case when u.role='STAFF' then u.id else staff_filter end;
 if filter_id is not null and not exists(select 1 from profiles where id=filter_id) then raise exception 'Không tìm thấy nhân viên.'; end if;
 start_at:=make_date(report_year,case when report_month=0 then 1 else report_month end,1)::timestamp at time zone 'Asia/Ho_Chi_Minh';
 end_at:=((start_at at time zone 'Asia/Ho_Chi_Minh')+case when report_month=0 then interval '1 year' else interval '1 month' end) at time zone 'Asia/Ho_Chi_Minh';
 select jsonb_build_object(
  'consultations',(select count(distinct request_id) from request_assignments where assigned_at>=start_at and assigned_at<end_at and (filter_id is null or staff_id=filter_id)),
  'closed_orders',(select count(*) from orders where accepted_at>=start_at and accepted_at<end_at and (filter_id is null or closed_by=filter_id)),
  'booked',(select coalesce(sum(total),0) from orders where accepted_at>=start_at and accepted_at<end_at and status not in ('CANCELLED','REFUNDED') and (filter_id is null or closed_by=filter_id)),
  'received',(select coalesce(sum(p.amount),0) from order_payment_receipts p join orders o on o.id=p.order_id where p.received_at>=start_at and p.received_at<end_at and (filter_id is null or o.closed_by=filter_id)),
  'receivable',(select coalesce(sum(greatest(o.total-coalesce((select sum(amount) from order_payment_receipts where order_id=o.id and received_at<end_at),0),0)),0) from orders o where o.accepted_at<end_at and o.status not in ('CANCELLED','REFUNDED') and (filter_id is null or o.closed_by=filter_id)),
  'managed_receivable',(select coalesce(sum(greatest(o.total-coalesce((select sum(amount) from order_payment_receipts where order_id=o.id and received_at<end_at),0),0)),0) from orders o where o.accepted_at<end_at and o.status not in ('CANCELLED','REFUNDED') and (filter_id is null or o.assigned_to=filter_id)),
  'unattributed_orders',(select count(*) from orders where accepted_at>=start_at and accepted_at<end_at and closed_by is null and filter_id is null)
 ) into summary;
 if u.role='ADMIN' then
  with people as (
   select id,full_name from profiles where role in ('STAFF','ADMIN') or id in (select closed_by from orders)
   union all select null::uuid,'Chưa lưu nhân viên chốt'
  ) select coalesce(jsonb_agg(row_value order by name),'[]') into breakdown from (
   select p.full_name name,jsonb_build_object('staff_id',p.id,'full_name',p.full_name,
    'consultations',(select count(distinct request_id) from request_assignments where staff_id=p.id and assigned_at>=start_at and assigned_at<end_at),
    'closed_orders',(select count(*) from orders where closed_by is not distinct from p.id and accepted_at>=start_at and accepted_at<end_at),
    'booked',(select coalesce(sum(total),0) from orders where closed_by is not distinct from p.id and accepted_at>=start_at and accepted_at<end_at and status not in ('CANCELLED','REFUNDED')),
    'received',(select coalesce(sum(r.amount),0) from order_payment_receipts r join orders o on o.id=r.order_id where o.closed_by is not distinct from p.id and r.received_at>=start_at and r.received_at<end_at),
    'receivable',(select coalesce(sum(greatest(o.total-coalesce((select sum(amount) from order_payment_receipts where order_id=o.id and received_at<end_at),0),0)),0) from orders o where o.closed_by is not distinct from p.id and o.accepted_at<end_at and o.status not in ('CANCELLED','REFUNDED'))
   ) row_value from people p where filter_id is null or p.id=filter_id
  ) b;
 else breakdown:='[]'; end if;
 -- Drill-down is limited to current operational access. Historical Staff
 -- attribution is aggregated above without restoring transferred-order access.
 select count(*) into row_count from orders o where o.accepted_at<end_at and (u.role='ADMIN' or o.assigned_to=u.id) and (filter_id is null or o.closed_by=filter_id or o.assigned_to=filter_id);
 select coalesce(jsonb_agg(to_jsonb(rows)),'[]') into items from (
  select o.id,o.order_number,o.request_id,o.status,o.total,o.closed_by,o.assigned_to,o.accepted_at,
   p.full_name assigned_name,c.full_name closed_name,
   coalesce((select sum(amount) from order_payment_receipts where order_id=o.id and received_at<end_at),0) collected,
   greatest(o.total-coalesce((select sum(amount) from order_payment_receipts where order_id=o.id and received_at<end_at),0),0) remaining,
   coalesce((select sum(amount) from order_payment_receipts where order_id=o.id and received_at>=start_at and received_at<end_at),0) received_in_period
  from orders o join profiles p on p.id=o.assigned_to left join profiles c on c.id=o.closed_by
  where o.accepted_at<end_at and (u.role='ADMIN' or o.assigned_to=u.id) and (filter_id is null or o.closed_by=filter_id or o.assigned_to=filter_id)
  order by o.accepted_at desc,o.id desc limit 20 offset (report_page-1)*20
 ) rows;
 return jsonb_build_object('year',report_year,'month',report_month,'staff_id',filter_id,'start_at',start_at,'end_at',end_at,'summary',summary,'staff',breakdown,'items',items,'page',report_page,'limit',20,'total',row_count);
end $$;
revoke all on function commerce_finance_report(uuid,integer,integer,uuid,integer) from public,anon,authenticated;
grant execute on function commerce_finance_report(uuid,integer,integer,uuid,integer) to service_role;
commit;
