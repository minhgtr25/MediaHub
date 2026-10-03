begin;
-- A variation never rewrites the accepted quotation or original contract.
alter table orders add column base_total numeric(16,2);
update orders set base_total=total;
alter table orders alter column base_total set not null;
create table order_variations (
 id uuid primary key default gen_random_uuid(),order_id uuid not null references orders(id),
 requested_by uuid not null references profiles(id),title text not null check(length(btrim(title)) between 1 and 200),
 description text not null check(length(btrim(description)) between 1 and 5000),
 status text not null default 'REQUESTED' check(status in ('REQUESTED','QUOTED','ACCEPTED','REJECTED','WITHDRAWN')),
 idempotency_key uuid not null,created_at timestamptz not null default clock_timestamp(),
 responded_by uuid references profiles(id),responded_at timestamptz,response_note text,
 unique(order_id,requested_by,idempotency_key)
);
create index variations_order_page on order_variations(order_id,created_at desc,id desc);
create table order_variation_quotes (
 id uuid primary key default gen_random_uuid(),variation_id uuid not null references order_variations(id),
 version integer not null check(version>0),created_by uuid not null references profiles(id),
 scope text not null check(length(btrim(scope)) between 1 and 5000),
 revision_policy text not null check(length(btrim(revision_policy)) between 1 and 2000),
 amount numeric(16,2) not null check(amount between 0 and 1000000000000),
 deadline date not null,valid_until date not null,base_contract_hash text not null check(base_contract_hash ~ '^[a-f0-9]{64}$'),
 content_hash text not null check(content_hash ~ '^[a-f0-9]{64}$'),
 idempotency_key uuid not null,created_at timestamptz not null default clock_timestamp(),
 unique(variation_id,version),unique(variation_id,idempotency_key)
);
create table order_variation_acknowledgments (
 variation_id uuid primary key references order_variations(id),quote_id uuid not null unique references order_variation_quotes(id),
 acknowledged_by uuid not null references profiles(id),acknowledged_at timestamptz not null default clock_timestamp(),
 content_hash text not null,quote_snapshot jsonb not null,method text not null default 'APPLICATION' check(method='APPLICATION')
);
create index variation_ack_period on order_variation_acknowledgments(acknowledged_at,variation_id);
-- Private commerce, including direct Supabase access. Creator uses a safe scope RPC below.
alter table order_variations enable row level security;
revoke all on order_variations from public,anon,authenticated;
grant all on order_variations to service_role;
alter table order_variation_quotes enable row level security;
revoke all on order_variation_quotes from public,anon,authenticated;
grant all on order_variation_quotes to service_role;
alter table order_variation_acknowledgments enable row level security;
revoke all on order_variation_acknowledgments from public,anon,authenticated;
grant all on order_variation_acknowledgments to service_role;
create function guard_variation_record() returns trigger language plpgsql set search_path=public as $$
declare oid uuid;
begin
 if tg_op='DELETE' then raise exception 'Giữ nguyên bằng chứng phụ lục.';end if;
 if tg_table_name='order_variations' then oid:=new.order_id;
 elsif tg_table_name='order_variation_quotes' then select order_id into oid from order_variations where id=new.variation_id;
 else select order_id into oid from order_variations where id=new.variation_id; end if;
 if tg_op='DELETE' or current_user not in ('postgres','supabase_admin','service_role') or nullif(current_setting('app.variation_order',true),'')::uuid is distinct from oid then raise exception 'Phụ lục chỉ thay đổi qua workflow; giữ nguyên bằng chứng.';end if;
 if tg_op='UPDATE' then
  if tg_table_name<>'order_variations' then raise exception 'Báo giá và bằng chứng xác nhận được giữ bất biến.';end if;
  if old.status not in ('REQUESTED','QUOTED') or new.status not in ('QUOTED','ACCEPTED','REJECTED','WITHDRAWN')
   or (to_jsonb(new)-array['status','responded_by','responded_at','response_note']) is distinct from (to_jsonb(old)-array['status','responded_by','responded_at','response_note']) then raise exception 'Không sửa yêu cầu, báo giá đã gửi hoặc phụ lục đã chốt.';end if;
 end if;
 return new;
end $$;
create trigger variation_guard before insert or update or delete on order_variations for each row execute function guard_variation_record();
create trigger variation_quote_guard before insert or update or delete on order_variation_quotes for each row execute function guard_variation_record();
create trigger variation_ack_guard before insert or update or delete on order_variation_acknowledgments for each row execute function guard_variation_record();
create function guard_order_variation_total() returns trigger language plpgsql set search_path=public as $$
declare extra numeric;
begin
 if tg_op='INSERT' then new.base_total:=new.total; return new;end if;
 if new.base_total is distinct from old.base_total then raise exception 'Giá trị đơn gốc được giữ bất biến.';end if;
 if new.total is distinct from old.total then
  select coalesce(sum(q.amount),0) into extra from order_variation_acknowledgments a join order_variation_quotes q on q.id=a.quote_id where q.variation_id in(select id from order_variations where order_id=old.id);
  if current_user not in ('postgres','supabase_admin','service_role') or nullif(current_setting('app.variation_order',true),'')::uuid is distinct from old.id or new.total<>old.base_total+extra or new.deposit_amount<>old.deposit_amount then raise exception 'Giá trị đơn chỉ cộng phụ lục đã được Customer xác nhận.';end if;
 end if;
 return new;
end $$;
create trigger order_variation_total_guard before insert or update on orders for each row execute function guard_order_variation_total();

create function variation_commerce_reader(actor_id uuid,oid uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from profiles u join orders o on o.id=oid join requests r on r.id=o.request_id where u.id=actor_id and u.active and
 (u.role='ADMIN' or (u.role='STAFF' and o.assigned_to=u.id and r.assigned_to=u.id) or (u.role in ('CUSTOMER','BUSINESS') and exists(select 1 from customers where id=o.customer_id and profile_id=u.id))))
$$;
create function variation_order_open(oid uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from orders o join requests r on r.id=o.request_id where o.id=oid and o.status in ('CONFIRMED','IN_PROGRESS') and r.status='CONVERTED'
 and exists(select 1 from profiles where id=o.assigned_to and active and role in ('STAFF','ADMIN'))
 and r.assigned_to=o.assigned_to
 and exists(select 1 from contract_acknowledgments where order_id=o.id)
 and not exists(select 1 from order_final_funds_confirmations where order_id=o.id)
 and not exists(select 1 from order_review_rounds where order_id=o.id and status in ('PENDING','ACCEPTED')))
$$;
create function order_variation_list(actor_id uuid,oid uuid,report_page integer default 1,focus_id uuid default null) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare items jsonb;total_rows bigint;o orders;target order_variations;
begin
 if not variation_commerce_reader(actor_id,oid) then return null;end if;
 if report_page is null or report_page not between 1 and 100000 then raise exception 'Trang chưa hợp lệ.';end if;
 select * into o from orders where id=oid;
 if focus_id is not null then
  select * into target from order_variations where id=focus_id and order_id=oid;
  if target.id is not null then select 1+count(*)/10 into report_page from order_variations where order_id=oid and (created_at,id)>(target.created_at,target.id);end if;
 end if;
 select count(*) into total_rows from order_variations where order_id=oid;
 select coalesce(jsonb_agg(row_value order by created_at desc,id desc),'[]') into items from (
 select v.id,v.created_at,(to_jsonb(v)-'idempotency_key')||jsonb_build_object(
  'quotes',coalesce((select jsonb_agg(to_jsonb(q)-'idempotency_key' order by q.version desc) from (select * from order_variation_quotes where variation_id=v.id order by version desc limit 20) q),'[]'),
  'quote_count',(select count(*) from order_variation_quotes where variation_id=v.id),
  'acknowledgment',(select to_jsonb(a) from order_variation_acknowledgments a where a.variation_id=v.id)) row_value
 from order_variations v where v.order_id=oid order by v.created_at desc,v.id desc limit 10 offset (report_page-1)*10) rows;
 return jsonb_build_object('items',items,'total',total_rows,'page',report_page,'limit',10,'base_total',o.base_total,'total_amount',o.total,'can_request',variation_order_open(o.id));
end $$;
create function order_variation_scopes(actor_id uuid,oid uuid,report_page integer default 1) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare items jsonb;total_rows bigint;
begin
 if not is_delivery_reader(actor_id,oid) then return null;end if;
 if report_page is null or report_page not between 1 and 100000 then raise exception 'Trang chưa hợp lệ.';end if;
 select count(*) into total_rows from order_variations where order_id=oid and status='ACCEPTED';
 select coalesce(jsonb_agg(to_jsonb(rows) order by acknowledged_at desc,id desc),'[]') into items from (
 select v.id,v.title,q.scope,q.revision_policy,q.deadline,a.acknowledged_at from order_variations v join order_variation_acknowledgments a on a.variation_id=v.id join order_variation_quotes q on q.id=a.quote_id
 where v.order_id=oid and v.status='ACCEPTED' order by a.acknowledged_at desc,v.id desc limit 10 offset (report_page-1)*10) rows;
 return jsonb_build_object('items',items,'page',report_page,'limit',10,'total',total_rows);
end $$;

create function order_variation_action(actor_id uuid,oid uuid,operation text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public as $$
declare u profiles;o orders;r requests;p projects;v order_variations;q order_variation_quotes;ack contract_acknowledgments;
 owner boolean;operator boolean;note text:=btrim(coalesce(payload->>'reason',''));terms jsonb;input jsonb;hash text;event_name text;event_text text;new_id uuid;
begin
 select * into u from profiles where id=actor_id and active;
 if u.id is null or not variation_commerce_reader(u.id,oid) then raise exception 'Không có quyền truy cập phụ lục.';end if;
 perform pg_advisory_xact_lock(736231934);
 select request_id into r.id from orders where id=oid;
 select * into r from requests where id=r.id for update;
 select * into o from orders where id=oid for update;
 select * into p from projects where order_id=o.id for update;
 -- Recheck after locks: a Staff transfer may have committed meanwhile.
 if not variation_commerce_reader(u.id,o.id) then raise exception 'Không có quyền truy cập phụ lục.';end if;
 owner:=u.role in ('CUSTOMER','BUSINESS');operator:=u.role in ('STAFF','ADMIN');
 if operation='request' and not owner or operation='quote' and not operator or operation in ('accept','withdraw') and not owner then raise exception 'Thao tác không đúng vai trò.';end if;
 if operation not in ('request','quote','accept','reject','withdraw') then raise exception 'Thao tác phụ lục chưa được hỗ trợ.';end if;
 perform set_config('app.actor',u.id::text,true);perform set_config('app.variation_order',o.id::text,true);perform set_config('app.production_order',o.id::text,true);
 if operation='request' then
  if payload->>'idempotency_key' is null or length(btrim(coalesce(payload->>'title',''))) not between 1 and 200 or length(btrim(coalesce(payload->>'description',''))) not between 1 and 5000 then raise exception 'Cần tiêu đề, nội dung và khóa chống gửi lặp.';end if;
  select * into v from order_variations where order_id=o.id and requested_by=u.id and idempotency_key=(payload->>'idempotency_key')::uuid;
  if v.id is not null then
   if v.title is distinct from btrim(payload->>'title') or v.description is distinct from btrim(payload->>'description') then raise exception 'Khóa gửi lặp đã dùng với nội dung khác.';end if;
   return jsonb_build_object('id',v.id,'reused',true);
  end if;
 else
  select * into v from order_variations where id=(payload->>'variation_id')::uuid and order_id=o.id for update;
  if v.id is null then raise exception 'Không tìm thấy phụ lục của đơn.';end if;
  if operation='quote' then
   input:=jsonb_build_object('scope',btrim(payload->>'scope'),'revision_policy',btrim(payload->>'revision_policy'),'amount',(payload->>'amount')::numeric,'deadline',(payload->>'deadline')::date,'valid_until',(payload->>'valid_until')::date);
   select * into q from order_variation_quotes where variation_id=v.id and idempotency_key=(payload->>'idempotency_key')::uuid;
   if q.id is not null then
    if input is distinct from jsonb_build_object('scope',q.scope,'revision_policy',q.revision_policy,'amount',q.amount,'deadline',q.deadline,'valid_until',q.valid_until) then raise exception 'Khóa gửi lặp đã dùng với báo giá khác.';end if;
    return jsonb_build_object('id',v.id,'quote_id',q.id,'reused',true);
   end if;
  elsif operation='accept' and v.status='ACCEPTED' then
   if payload->'acknowledge' is distinct from 'true'::jsonb or not exists(select 1 from order_variation_acknowledgments where variation_id=v.id and quote_id=(payload->>'quote_id')::uuid and content_hash=payload->>'content_hash' and acknowledged_by=u.id) then raise exception 'Phụ lục đã chốt; xác nhận gửi lại không khớp.';end if;
   return jsonb_build_object('id',v.id,'reused',true);
  elsif v.status=(case operation when 'reject' then 'REJECTED' when 'withdraw' then 'WITHDRAWN' else '' end) and v.responded_by=u.id and v.response_note=note then
   return jsonb_build_object('id',v.id,'reused',true);
  end if;
 end if;
 -- Resolution remains available while locked, so an open request cannot trap handover.
 if operation not in ('reject','withdraw') and not variation_order_open(o.id) then raise exception 'Chỉ bổ sung trước nghiệm thu và xác nhận thu đủ, từ đơn đã xác nhận cọc.';end if;
 if operation='request' then
  insert into order_variations(order_id,requested_by,title,description,idempotency_key) values(o.id,u.id,btrim(payload->>'title'),btrim(payload->>'description'),(payload->>'idempotency_key')::uuid) returning * into v;
  event_name:='ORDER_VARIATION_REQUESTED';event_text:='Khách hàng đề nghị phát sinh: '||v.title||'. Chưa thay đổi phạm vi hoặc giá trị đơn.';
 elsif operation='quote' then
  if v.status not in ('REQUESTED','QUOTED') then raise exception 'Yêu cầu đã được chốt hoặc đóng.';end if;
  if payload->>'idempotency_key' is null or length(btrim(coalesce(payload->>'scope',''))) not between 1 and 5000 or length(btrim(coalesce(payload->>'revision_policy',''))) not between 1 and 2000
   or (payload->>'amount')::numeric is null or (payload->>'amount')::numeric not between 0 and 1000000000000 or (payload->>'amount')::numeric<>round((payload->>'amount')::numeric,2)
   or (payload->>'deadline')::date is null or (payload->>'valid_until')::date is null
   or (payload->>'deadline')::date<(now() at time zone 'Asia/Ho_Chi_Minh')::date or (payload->>'valid_until')::date<(now() at time zone 'Asia/Ho_Chi_Minh')::date or (payload->>'valid_until')::date>(payload->>'deadline')::date
   or o.total+(payload->>'amount')::numeric>1000000000000 then raise exception 'Phạm vi, mức sửa, giá trọn gói hoặc hạn phụ lục chưa hợp lệ.';end if;
  select * into ack from contract_acknowledgments where order_id=o.id;
  new_id:=gen_random_uuid();
  terms:=input||jsonb_build_object('id',new_id,'variation_id',v.id,'title',v.title,'description',v.description,'version',(select coalesce(max(version),0)+1 from order_variation_quotes where variation_id=v.id),'base_contract_hash',ack.content_hash);
  hash:=encode(sha256(convert_to(terms::text,'UTF8')),'hex');
  insert into order_variation_quotes(id,variation_id,version,created_by,scope,revision_policy,amount,deadline,valid_until,base_contract_hash,content_hash,idempotency_key)
  values(new_id,v.id,(terms->>'version')::integer,u.id,btrim(payload->>'scope'),btrim(payload->>'revision_policy'),(payload->>'amount')::numeric,(payload->>'deadline')::date,(payload->>'valid_until')::date,ack.content_hash,hash,(payload->>'idempotency_key')::uuid) returning * into q;
  update order_variations set status='QUOTED' where id=v.id;
  event_name:='ORDER_VARIATION_QUOTED';event_text:='Staff gửi phụ lục '||v.title||', phiên bản '||q.version||', giá trọn gói '||q.amount||' VND; chờ Customer xác nhận.';
 elsif operation='accept' then
  select * into q from order_variation_quotes where id=(payload->>'quote_id')::uuid and variation_id=v.id;
  if v.status<>'QUOTED' or q.id is null or q.version<>(select max(version) from order_variation_quotes where variation_id=v.id)
   or q.valid_until<(now() at time zone 'Asia/Ho_Chi_Minh')::date or q.deadline<(now() at time zone 'Asia/Ho_Chi_Minh')::date or payload->'acknowledge' is distinct from 'true'::jsonb or payload->>'content_hash' is distinct from q.content_hash then raise exception 'Cần xác nhận đúng bản phụ lục mới nhất, còn hiệu lực.';end if;
  if o.total+q.amount>1000000000000 then raise exception 'Tổng giá trị vượt giới hạn.';end if;
  if q.deadline<greatest(p.deadline,r.deadline,(select max(old_quote.deadline) from order_variation_acknowledgments old_ack join order_variation_quotes old_quote on old_quote.id=old_ack.quote_id join order_variations old_v on old_v.id=old_ack.variation_id where old_v.order_id=o.id)) then raise exception 'Hạn mới không được rút ngắn lịch dự án; Staff cần thống nhất lại phụ lục.';end if;
  insert into order_variation_acknowledgments(variation_id,quote_id,acknowledged_by,content_hash,quote_snapshot) values(v.id,q.id,u.id,q.content_hash,to_jsonb(q)-'idempotency_key');
  update order_variations set status='ACCEPTED',responded_by=u.id,responded_at=clock_timestamp() where id=v.id;
  update orders set total=total+q.amount,remaining_amount=remaining_amount+q.amount where id=o.id;
  if p.id is not null then
   update projects set scope=coalesce(scope,'')||E'\n\nPhụ lục: '||v.title||E'\n'||q.scope||E'\nMức chỉnh sửa: '||q.revision_policy,deadline=q.deadline where id=p.id;
   insert into project_milestones(project_id,title,description,due_date,idempotency_key) values(p.id,left('Phụ lục: '||v.title,200),q.scope,q.deadline,v.id);
   insert into project_status_history(project_id,status,note,created_by) values(p.id,p.production_status,'Bổ sung phạm vi đã được Customer xác nhận: '||v.title,u.id);
  end if;
  event_name:='ORDER_VARIATION_ACCEPTED';event_text:='Khách hàng xác nhận phụ lục '||v.title||'. Giá trị đơn tăng '||q.amount||' VND; khoản thu thực tế giữ nguyên.';
  perform record_request_event(u.id,r.id,'PRODUCTION_SCOPE_CHANGED','Phạm vi bổ sung đã được xác nhận: '||v.title||E'\n'||q.scope||E'\nMức chỉnh sửa: '||q.revision_policy||E'\nHạn dự án: '||q.deadline,jsonb_build_object('order_id',o.id,'variation_id',v.id),'{}','{}');
 else
  if v.status not in ('REQUESTED','QUOTED') or length(note) not between 1 and 2000 then raise exception 'Chỉ đóng yêu cầu đang mở, kèm lý do.';end if;
  update order_variations set status=case operation when 'withdraw' then 'WITHDRAWN' else 'REJECTED' end,responded_by=u.id,responded_at=clock_timestamp(),response_note=note where id=v.id;
  event_name:='ORDER_VARIATION_CLOSED';event_text:='Yêu cầu phát sinh '||v.title||' đã đóng. Lý do: '||note;
 end if;
 perform record_request_event(u.id,r.id,event_name,event_text,jsonb_build_object('order_id',o.id,'variation_id',v.id,'quote_id',q.id),jsonb_build_object('total',o.total),jsonb_build_object('total',(select total from orders where id=o.id)),nullif(note,''));
 return jsonb_build_object('id',v.id,'quote_id',q.id,'order_id',o.id);
end $$;

-- No final acceptance while an unresolved variation is being negotiated.
alter function order_delivery_action(uuid,uuid,text,jsonb) rename to legacy_order_delivery_action_034;
revoke all on function legacy_order_delivery_action_034(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
create function order_delivery_action(actor_id uuid,oid uuid,operation text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if operation='send_review' then
  perform pg_advisory_xact_lock(736231934);
  perform 1 from requests where id=(select request_id from orders where id=oid) for update;
  perform 1 from orders where id=oid for update;
  if exists(select 1 from order_variations where order_id=oid and status in ('REQUESTED','QUOTED')) then raise exception 'Cần chốt hoặc đóng các yêu cầu phát sinh trước khi gửi nghiệm thu.';end if;
 end if;
 return legacy_order_delivery_action_034(actor_id,oid,operation,payload);
end $$;
revoke all on function order_variation_action(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function order_variation_action(uuid,uuid,text,jsonb) to service_role;
revoke all on function order_variation_list(uuid,uuid,integer,uuid) from public,anon,authenticated;
grant execute on function order_variation_list(uuid,uuid,integer,uuid) to service_role;
revoke all on function order_variation_scopes(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function order_variation_scopes(uuid,uuid,integer) to service_role;
revoke all on function order_delivery_action(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function order_delivery_action(uuid,uuid,text,jsonb) to service_role;
revoke all on function guard_variation_record(),guard_order_variation_total(),variation_order_open(uuid),variation_commerce_reader(uuid,uuid) from public,anon,authenticated,service_role;

-- Production created after an accepted variation also includes its agreed scope.
alter function order_production_action(uuid,uuid,text,jsonb) rename to legacy_order_production_action_034;
revoke all on function legacy_order_production_action_034(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
create function order_production_action(actor_id uuid,oid uuid,operation text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public as $$
declare response jsonb;extra_scope text;extra_deadline date;
begin
 response:=legacy_order_production_action_034(actor_id,oid,operation,payload);
 if operation='create' and coalesce((response->>'reused')::boolean,false)=false then
  select string_agg(E'\n\nPhụ lục: '||v.title||E'\n'||q.scope||E'\nMức chỉnh sửa: '||q.revision_policy,'' order by a.acknowledged_at,v.id),max(q.deadline) into extra_scope,extra_deadline
  from order_variations v join order_variation_acknowledgments a on a.variation_id=v.id join order_variation_quotes q on q.id=a.quote_id where v.order_id=oid;
  if extra_scope is not null then
   update projects set scope=coalesce(scope,'')||extra_scope,deadline=greatest(deadline,extra_deadline) where order_id=oid;
   insert into project_milestones(project_id,title,description,due_date,idempotency_key)
   select p.id,left('Phụ lục: '||v.title,200),q.scope,q.deadline,v.id from projects p join order_variations v on v.order_id=p.order_id join order_variation_acknowledgments a on a.variation_id=v.id join order_variation_quotes q on q.id=a.quote_id where p.order_id=oid;
  end if;
 end if;
 return response;
end $$;
revoke all on function order_production_action(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function order_production_action(uuid,uuid,text,jsonb) to service_role;
create or replace function public.commerce_finance_report(actor_id uuid,report_year integer,report_month integer,staff_filter uuid default null,report_page integer default 1)
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
  'booked',(select coalesce(sum(base_total),0) from orders where accepted_at>=start_at and accepted_at<end_at and status not in ('CANCELLED','REFUNDED') and (filter_id is null or closed_by=filter_id)),
  'variations',(select coalesce(sum(q.amount),0) from order_variation_acknowledgments a join order_variation_quotes q on q.id=a.quote_id join order_variations v on v.id=a.variation_id join orders o on o.id=v.order_id where a.acknowledged_at>=start_at and a.acknowledged_at<end_at and o.status not in ('CANCELLED','REFUNDED') and (filter_id is null or o.closed_by=filter_id)),
  'received',(select coalesce(sum(p.amount),0) from order_payment_receipts p join orders o on o.id=p.order_id where p.received_at>=start_at and p.received_at<end_at and (filter_id is null or o.closed_by=filter_id)),
  'receivable',(select coalesce(sum(greatest((o.base_total+coalesce((select sum(q.amount) from order_variation_acknowledgments a join order_variation_quotes q on q.id=a.quote_id join order_variations v on v.id=a.variation_id where v.order_id=o.id and a.acknowledged_at<end_at),0))-coalesce((select sum(amount) from order_payment_receipts where order_id=o.id and received_at<end_at),0),0)),0) from orders o where o.accepted_at<end_at and o.status not in ('CANCELLED','REFUNDED') and (filter_id is null or o.closed_by=filter_id)),
  'managed_receivable',(select coalesce(sum(greatest((o.base_total+coalesce((select sum(q.amount) from order_variation_acknowledgments a join order_variation_quotes q on q.id=a.quote_id join order_variations v on v.id=a.variation_id where v.order_id=o.id and a.acknowledged_at<end_at),0))-coalesce((select sum(amount) from order_payment_receipts where order_id=o.id and received_at<end_at),0),0)),0) from orders o where o.accepted_at<end_at and o.status not in ('CANCELLED','REFUNDED') and (filter_id is null or o.assigned_to=filter_id)),
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
    'booked',(select coalesce(sum(base_total),0) from orders where closed_by is not distinct from p.id and accepted_at>=start_at and accepted_at<end_at and status not in ('CANCELLED','REFUNDED')),
    'variations',(select coalesce(sum(q.amount),0) from order_variation_acknowledgments a join order_variation_quotes q on q.id=a.quote_id join order_variations v on v.id=a.variation_id join orders o on o.id=v.order_id where o.closed_by is not distinct from p.id and a.acknowledged_at>=start_at and a.acknowledged_at<end_at and o.status not in ('CANCELLED','REFUNDED')),
    'received',(select coalesce(sum(r.amount),0) from order_payment_receipts r join orders o on o.id=r.order_id where o.closed_by is not distinct from p.id and r.received_at>=start_at and r.received_at<end_at),
    'receivable',(select coalesce(sum(greatest((o.base_total+coalesce((select sum(q.amount) from order_variation_acknowledgments a join order_variation_quotes q on q.id=a.quote_id join order_variations v on v.id=a.variation_id where v.order_id=o.id and a.acknowledged_at<end_at),0))-coalesce((select sum(amount) from order_payment_receipts where order_id=o.id and received_at<end_at),0),0)),0) from orders o where o.closed_by is not distinct from p.id and o.accepted_at<end_at and o.status not in ('CANCELLED','REFUNDED'))
   ) row_value from people p where filter_id is null or p.id=filter_id
  ) b;
 else breakdown:='[]'; end if;
 -- Drill-down is limited to current operational access. Historical Staff
 -- attribution is aggregated above without restoring transferred-order access.
 select count(*) into row_count from orders o where o.accepted_at<end_at and (u.role='ADMIN' or o.assigned_to=u.id) and (filter_id is null or o.closed_by=filter_id or o.assigned_to=filter_id);
 select coalesce(jsonb_agg(to_jsonb(rows)),'[]') into items from (
  select o.id,o.order_number,o.request_id,o.status,(o.base_total+coalesce((select sum(q.amount) from order_variation_acknowledgments a join order_variation_quotes q on q.id=a.quote_id join order_variations v on v.id=a.variation_id where v.order_id=o.id and a.acknowledged_at<end_at),0)) total,o.closed_by,o.assigned_to,o.accepted_at,
   p.full_name assigned_name,c.full_name closed_name,
   coalesce((select sum(amount) from order_payment_receipts where order_id=o.id and received_at<end_at),0) collected,
   greatest((o.base_total+coalesce((select sum(q.amount) from order_variation_acknowledgments a join order_variation_quotes q on q.id=a.quote_id join order_variations v on v.id=a.variation_id where v.order_id=o.id and a.acknowledged_at<end_at),0))-coalesce((select sum(amount) from order_payment_receipts where order_id=o.id and received_at<end_at),0),0) remaining,
   coalesce((select sum(amount) from order_payment_receipts where order_id=o.id and received_at>=start_at and received_at<end_at),0) received_in_period
  from orders o join profiles p on p.id=o.assigned_to left join profiles c on c.id=o.closed_by
  where o.accepted_at<end_at and (u.role='ADMIN' or o.assigned_to=u.id) and (filter_id is null or o.closed_by=filter_id or o.assigned_to=filter_id)
  order by o.accepted_at desc,o.id desc limit 20 offset (report_page-1)*20
 ) rows;
 return jsonb_build_object('year',report_year,'month',report_month,'staff_id',filter_id,'start_at',start_at,'end_at',end_at,'summary',summary,'staff',breakdown,'items',items,'page',report_page,'limit',20,'total',row_count);
end $$;
revoke all on function commerce_finance_report(uuid,integer,integer,uuid,integer) from public,anon,authenticated;
grant execute on function commerce_finance_report(uuid,integer,integer,uuid,integer) to service_role;
notify pgrst, 'reload schema';
commit;
