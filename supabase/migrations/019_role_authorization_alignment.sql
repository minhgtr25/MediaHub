begin;
-- Compatible role alignment. Preserve all identities, tables, statuses and rows.
-- Re-emit reviewed legacy functions; only role predicates change.

-- project_action from 002_workflow.sql: preserve existing workflow, add customer-equivalent BUSINESS.
create or replace function public.project_action_base(actor_id uuid,pid uuid,action text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public as $$
declare u profiles; c uuid; p projects; q quotations; item jsonb; total_amount numeric; qid uuid; newid uuid; next_status text;
begin
 select * into u from profiles where id=actor_id;
 if u.id is null or u.role not in ('CUSTOMER','BUSINESS','ADMIN') then raise exception 'Không có quyền truy cập'; end if;
 perform set_config('app.actor',u.id::text,true);
 select id into c from customers where profile_id=u.id;
 if action='create' then
  if u.role not in ('CUSTOMER','BUSINESS') then raise exception 'Chỉ khách hàng được tạo dự án'; end if;
  insert into projects(customer_id,title,description,category,budget,deadline,status) values(c,payload->>'title',payload->>'description',payload->>'category',(payload->>'budget')::numeric,(payload->>'deadline')::date,coalesce(payload->>'status','SUBMITTED')) returning id into newid;
  for item in select * from jsonb_array_elements(payload->'service_ids') loop
   if not exists(select 1 from services where id=(item#>>'{}')::uuid and active) then raise exception 'Dịch vụ không khả dụng'; end if;
   insert into project_services(project_id,service_id) values(newid,(item#>>'{}')::uuid);
  end loop;
  return jsonb_build_object('id',newid);
 end if;
 select * into p from projects where id=pid for update;
 if p.id is null or (u.role<>'ADMIN' and p.customer_id is distinct from c) then raise exception 'Không tìm thấy dự án'; end if;
 if action in ('quotation','status','deliverable','paid') and u.role<>'ADMIN' then raise exception 'Chỉ quản trị viên được thực hiện'; end if;
 if action in ('accept','reject','revision','complete','review','edit') and u.role not in ('CUSTOMER','BUSINESS') then raise exception 'Chỉ chủ dự án được thực hiện'; end if;
 if action='edit' then
  if p.status<>'DRAFT' then raise exception 'Chỉ có thể sửa bản nháp'; end if;
  update projects set title=payload->>'title',description=payload->>'description',category=payload->>'category',budget=(payload->>'budget')::numeric,deadline=(payload->>'deadline')::date,status=payload->>'status' where id=pid;
  delete from project_services where project_id=pid;
  insert into project_services(project_id,service_id) select pid,value::uuid from jsonb_array_elements_text(payload->'service_ids');
 elsif action='quotation' then
  if p.status<>'REVIEWING' then raise exception 'Dự án phải đang được xem xét'; end if;
  select sum((v->>'quantity')::numeric*(v->>'unit_price')::numeric) into total_amount from jsonb_array_elements(payload->'items') v;
  if (payload->>'discount')::numeric>total_amount or (payload->>'valid_until')::date<current_date then raise exception 'Giảm giá hoặc hạn báo giá không hợp lệ'; end if;
  insert into quotations(project_id,subtotal,discount,total,valid_until,status,notes) values(pid,total_amount,(payload->>'discount')::numeric,total_amount-(payload->>'discount')::numeric,(payload->>'valid_until')::date,'SENT',payload->>'notes') returning id into qid;
  for item in select * from jsonb_array_elements(payload->'items') loop insert into quotation_items(quotation_id,service_id,description,quantity,unit_price,total) values(qid,(item->>'service_id')::uuid,item->>'description',(item->>'quantity')::integer,(item->>'unit_price')::numeric,(item->>'quantity')::numeric*(item->>'unit_price')::numeric); end loop;
  update projects set status='QUOTATION_SENT' where id=pid;
 elsif action in ('accept','reject') then
  select * into q from quotations where project_id=pid and status='SENT' for update;
  if q.id is null or p.status<>'QUOTATION_SENT' or q.valid_until<current_date then raise exception 'Báo giá chưa gửi hoặc đã hết hạn'; end if;
  update quotations set status=case when action='accept' then 'ACCEPTED' else 'REJECTED' end where id=q.id;
  update projects set status=case when action='accept' then 'QUOTATION_ACCEPTED' else 'CANCELLED' end where id=pid;
  if action='accept' then insert into invoices(project_id,customer_id,invoice_number,amount) values(pid,p.customer_id,'MH-'||upper(replace(pid::text,'-','')),q.total); end if;
 elsif action='status' then
  next_status:=payload->>'status';
  if next_status not in ('REVIEWING','IN_PROGRESS','WAITING_REVIEW','COMPLETED','CANCELLED') then raise exception 'Trạng thái không hợp lệ'; end if;
  if next_status='WAITING_REVIEW' and not exists(select 1 from deliverables where project_id=pid and status='PENDING_APPROVAL') then raise exception 'Cần tải sản phẩm bàn giao'; end if;
  if next_status='COMPLETED' and (not exists(select 1 from deliverables where project_id=pid) or exists(select 1 from deliverables where project_id=pid and status<>'APPROVED')) then raise exception 'Khách hàng chưa duyệt sản phẩm'; end if;
  update projects set status=next_status where id=pid;
 elsif action='file' then
  if p.status in ('COMPLETED','CANCELLED') then raise exception 'Dự án đã đóng'; end if;
  insert into project_files(project_id,uploaded_by,file_name,file_url,file_type,file_size) values(pid,u.id,payload->>'name',payload->>'path',payload->>'type',(payload->>'size')::bigint);
 elsif action='deliverable' then
  if p.status not in ('IN_PROGRESS','REVISION') then raise exception 'Dự án chưa sẵn sàng bàn giao'; end if;
  insert into deliverables(project_id,name,file_url,version) values(pid,payload->>'name',payload->>'path',(select coalesce(max(version),0)+1 from deliverables where project_id=pid));
  insert into notifications(user_id,title,message,type) select profile_id,'Sản phẩm bàn giao mới',p.title,'DELIVERABLE' from customers where id=p.customer_id;
 elsif action='revision' then
  if p.status<>'WAITING_REVIEW' then raise exception 'Chỉ yêu cầu chỉnh sửa khi đang chờ duyệt'; end if;
  insert into revision_requests(project_id,customer_id,description,attachment_url) values(pid,c,payload->>'description',payload->>'attachment_url');
  update deliverables set status='REVISION_REQUIRED' where project_id=pid and status='PENDING_APPROVAL';
  update projects set status='REVISION' where id=pid;
 elsif action='complete' then
  if p.status<>'WAITING_REVIEW' or not exists(select 1 from deliverables where project_id=pid and status='PENDING_APPROVAL') then raise exception 'Chưa có sản phẩm để duyệt'; end if;
  update deliverables set status='APPROVED' where project_id=pid;
  update revision_requests set status='RESOLVED' where project_id=pid and status in ('PENDING','IN_PROGRESS');
  update projects set status='COMPLETED' where id=pid;
 elsif action='review' then
  if p.status<>'COMPLETED' or exists(select 1 from reviews where project_id=pid) then raise exception 'Chỉ đánh giá một lần sau khi hoàn thành'; end if;
  insert into reviews(project_id,customer_id,rating,quality_rating,communication_rating,value_rating,comment) values(pid,c,(payload->>'rating')::integer,(payload->>'quality_rating')::integer,(payload->>'communication_rating')::integer,(payload->>'value_rating')::integer,payload->>'comment') returning id into newid;
  insert into testimonials(review_id,content) values(newid,payload->>'comment');
 elsif action='paid' then
  update invoices set status='PAID',paid_at=now() where project_id=pid and status='PENDING';
  if not found then raise exception 'Hóa đơn không ở trạng thái chờ thanh toán'; end if;
 else raise exception 'Thao tác không hợp lệ'; end if;
 return jsonb_build_object('id',pid);
end $$;

-- project_action from 006_workflow_extensions.sql: preserve existing workflow, add customer-equivalent BUSINESS.
create or replace function public.project_action(actor_id uuid,pid uuid,action text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public as $$
declare u profiles; p projects; q quotations; c uuid; did uuid; rid uuid;
begin
 select * into u from profiles where id=actor_id and active;
 if u.id is null or u.role not in ('ADMIN','CUSTOMER','BUSINESS') then raise exception 'Account cannot access this operation'; end if;
 perform set_config('app.actor',actor_id::text,true);
 if action='create' then return project_action_base(actor_id,pid,action,payload); end if;
 select * into p from projects where id=pid for update;
 select id into c from customers where profile_id=actor_id;
 if p.id is null or (u.role<>'ADMIN' and p.customer_id is distinct from c) then raise exception 'Project not found'; end if;
 if action='accept' then
  if u.role not in ('CUSTOMER','BUSINESS') or p.status<>'QUOTATION_SENT' then raise exception 'Quotation cannot be accepted'; end if;
  select * into q from quotations where project_id=pid and status='SENT' for update;
  if q.id is null or q.valid_until<current_date then raise exception 'Quotation is missing or expired'; end if;
  update quotations set status='ACCEPTED' where id=q.id;
  update projects set status='QUOTATION_ACCEPTED' where id=pid;
 elsif action in ('approve-deliverable','complete') then
  if u.role not in ('CUSTOMER','BUSINESS') or p.status<>'WAITING_REVIEW' then raise exception 'Project is not awaiting review'; end if;
  if action='approve-deliverable' then
   did:=(payload->>'deliverable_id')::uuid;
   update deliverables set status='APPROVED' where id=did and project_id=pid and status='PENDING_APPROVAL';
   if not found then raise exception 'Deliverable is not awaiting approval'; end if;
  else
   if not exists(select 1 from deliverables where project_id=pid and status in ('PENDING_APPROVAL','APPROVED')) then raise exception 'No deliverables to accept'; end if;
   update deliverables set status='APPROVED' where project_id=pid and status='PENDING_APPROVAL';
  end if;
  if not exists(select 1 from deliverables where project_id=pid and status='PENDING_APPROVAL') then
   update revision_requests set status='RESOLVED' where project_id=pid and status in ('PENDING','REQUESTED','IN_PROGRESS');
   update projects set status='COMPLETED' where id=pid;
   select * into q from quotations where project_id=pid and status='ACCEPTED';
   if q.id is not null then
    insert into invoices(project_id,customer_id,invoice_number,amount,status,quotation_id)
    values(pid,p.customer_id,'MH-'||upper(replace(pid::text,'-','')),q.total,'DRAFT',q.id) on conflict(project_id) do nothing;
   end if;
  end if;
 elsif action='revision' then
  if u.role not in ('CUSTOMER','BUSINESS') or p.status<>'WAITING_REVIEW' then raise exception 'Project is not awaiting review'; end if;
  did:=nullif(payload->>'deliverable_id','')::uuid;
  if did is not null and not exists(select 1 from deliverables where id=did and project_id=pid and status='PENDING_APPROVAL') then raise exception 'Deliverable cannot be revised'; end if;
  insert into revision_requests(project_id,customer_id,description,attachment_url,deliverable_id,status)
  values(pid,c,payload->>'description',payload->>'attachment_url',did,'REQUESTED');
  update deliverables set status='REVISION_REQUIRED' where project_id=pid and status='PENDING_APPROVAL' and (did is null or id=did);
  update projects set status='REVISION' where id=pid;
 elsif action='revision-status' then
  if u.role<>'ADMIN' then raise exception 'Administrator required'; end if;
  rid:=(payload->>'revision_id')::uuid;
  if payload->>'status' not in ('IN_PROGRESS','RESOLVED','CANCELLED') then raise exception 'Invalid revision status'; end if;
  update revision_requests set status=payload->>'status' where id=rid and project_id=pid and status in ('PENDING','REQUESTED','IN_PROGRESS');
  if not found then raise exception 'Revision is missing or already closed'; end if;
  insert into notifications(user_id,title,message,type) select profile_id,'Revision updated',p.title,'REVISION' from customers where id=p.customer_id;
 elsif action='issue-invoice' then
  if u.role<>'ADMIN' then raise exception 'Administrator required'; end if;
  update invoices set status='PENDING',issued_at=now(),due_date=(payload->>'due_date')::date where project_id=pid and status='DRAFT';
  if not found then raise exception 'No draft invoice to issue'; end if;
  insert into notifications(user_id,title,message,type) select profile_id,'Invoice issued',p.title,'INVOICE' from customers where id=p.customer_id;
 else
  return project_action_base(actor_id,pid,action,payload);
 end if;
 return jsonb_build_object('id',pid);
end $$;

-- dashboard_report from 003_reporting.sql: preserve existing workflow, add customer-equivalent BUSINESS.
create or replace function public.dashboard_report_base(actor_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare u profiles; cid uuid; output jsonb;
begin
 select * into u from profiles where id=actor_id;
 if u.id is null or u.role not in ('ADMIN','CUSTOMER','BUSINESS') then raise exception 'Không có quyền truy cập'; end if;
 select id into cid from customers where profile_id=actor_id;
 with ps as (select * from projects where u.role='ADMIN' or customer_id=cid), ins as (select * from invoices where u.role='ADMIN' or customer_id=cid), paid as (select * from ins where status='PAID')
 select jsonb_build_object(
 'total_projects',(select count(*) from ps),'active_projects',(select count(*) from ps where status not in ('COMPLETED','CANCELLED','DRAFT')),'completed_projects',(select count(*) from ps where status='COMPLETED'),
 'pending_quotations',(select count(*) from ps where status='QUOTATION_SENT'),
 'total_customers',case when u.role='ADMIN' then (select count(*) from customers c join profiles p on p.id=c.profile_id where p.role in ('CUSTOMER','BUSINESS')) else 1 end,
 'total_revenue',(select coalesce(sum(amount),0) from paid),
 'monthly_revenue',(select coalesce(sum(amount),0) from paid where paid_at>=date_trunc('month',now() at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh'),
 'yearly_revenue',(select coalesce(sum(amount),0) from paid where paid_at>=date_trunc('year',now() at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh'),
 'average_project_value',(select coalesce(sum(amount)/nullif(count(distinct project_id),0),0) from paid),
 'pending_payment',(select coalesce(sum(amount),0) from ins where status='PENDING'),'paid_invoices',(select count(*) from paid),
 'by_status',(select coalesce(jsonb_agg(t),'[]') from (select status,count(*) as count from ps group by status) t),
 'by_month',(select coalesce(jsonb_agg(t),'[]') from (select to_char(paid_at at time zone 'Asia/Ho_Chi_Minh','YYYY-MM') as label,sum(amount) as value from paid group by 1 order by 1) t),
 'by_service',(select coalesce(jsonb_agg(t),'[]') from (select s.name as label,sum(case when q.subtotal>0 then i.amount*qi.total/q.subtotal else 0 end) as value from paid i join quotations q on q.project_id=i.project_id and q.status='ACCEPTED' join quotation_items qi on qi.quotation_id=q.id join services s on s.id=qi.service_id group by s.name) t)
 ) into output;
 return output;
end $$;

-- dashboard_report from 011_project_management.sql: preserve existing workflow, add customer-equivalent BUSINESS.
create or replace function public.dashboard_report(actor_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare u profiles; cid uuid; base jsonb;
begin
 select * into u from profiles where id=actor_id and active;
 if u.id is null or u.role not in ('ADMIN','CUSTOMER','BUSINESS') then raise exception 'Account not available'; end if;
 select id into cid from customers where profile_id=actor_id;
 base:=dashboard_report_base(actor_id);
 return base||jsonb_build_object(
 'new_leads',case when u.role='ADMIN' then (select count(*) from leads where status='NEW') else 0 end,
 'pending_reviews',(select count(*) from projects where status='WAITING_REVIEW' and (u.role='ADMIN' or customer_id=cid)),
 'outstanding_invoices',(select count(*) from invoices where status in ('PENDING','ISSUED','OVERDUE') and (u.role='ADMIN' or customer_id=cid)),
 'recent_notifications',(select coalesce(jsonb_agg(t),'[]') from (select id,title,message,created_at,read_at from notifications where user_id=actor_id order by created_at desc limit 5)t)
 );
end $$;

-- convert_lead from 013_lead_project_conversion.sql: preserve existing workflow, add customer-equivalent BUSINESS.
create or replace function public.convert_lead(actor_id uuid,lid uuid,cid uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare l leads; customer_email text; pid uuid;
begin
 if not exists(select 1 from profiles where id=actor_id and role='ADMIN' and active) then raise exception 'Administrator required'; end if;
 perform set_config('app.actor',actor_id::text,true);
 select * into l from leads where id=lid for update;
 if l.id is null then raise exception 'Lead not found'; end if;
 if l.status='CONVERTED' then return jsonb_build_object('customer_id',l.customer_id,'project_id',l.project_id); end if;
 select p.email into customer_email from customers c join profiles p on p.id=c.profile_id where c.id=cid and p.role in ('CUSTOMER','BUSINESS') and p.active;
 if customer_email is null or lower(customer_email)<>lower(l.email) then raise exception 'Customer email must match the enquiry'; end if;
 if l.source='PROJECT_REQUEST' and l.service_id is not null then
  if not exists(select 1 from services where id=l.service_id and active) then raise exception 'Requested service is no longer active'; end if;
  insert into projects(customer_id,title,description,category,deadline,status)
  values(cid,coalesce(nullif(l.project_type,''),'Project request'),l.message||case when l.budget_range<>'' then E'\nBudget range: '||l.budget_range else '' end,(select category from services where id=l.service_id),l.deadline,'SUBMITTED') returning id into pid;
  insert into project_services(project_id,service_id) values(pid,l.service_id);
 end if;
 update leads set status='CONVERTED',customer_id=cid,project_id=pid where id=lid;
 return jsonb_build_object('customer_id',cid,'project_id',pid);
end $$;

-- support_action from 014_support_and_payments.sql: preserve existing workflow, add customer-equivalent BUSINESS.
create or replace function public.support_action(actor_id uuid,operation text,target_id uuid,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public as $$
declare u profiles; t support_tickets; cid uuid; recipient uuid;
begin
 select * into u from profiles where id=actor_id and active;
 if u.id is null or u.role not in ('ADMIN','STAFF','CUSTOMER','BUSINESS') then raise exception 'Active support account required'; end if;
 perform set_config('app.actor',actor_id::text,true);
 if operation='create' then
  if u.role not in ('CUSTOMER','BUSINESS') then raise exception 'Customer required'; end if;
  select id into cid from customers where profile_id=u.id;
  insert into support_tickets(customer_id,subject,category) values(cid,payload->>'subject',payload->>'category') returning * into t;
  insert into support_messages(ticket_id,sender_id,message) values(t.id,u.id,payload->>'message');
  insert into notifications(user_id,title,message,type) select id,'Yêu cầu hỗ trợ mới',t.subject,'SUPPORT' from profiles where role in ('ADMIN','STAFF') and active;
 else
  select * into t from support_tickets where id=target_id for update;
  if t.id is null then raise exception 'Ticket not found'; end if;
  if u.role in ('CUSTOMER','BUSINESS') and not exists(select 1 from customers where id=t.customer_id and profile_id=u.id) then raise exception 'Ticket not found'; end if;
  if u.role='STAFF' and t.assigned_to is distinct from u.id and not(operation='claim' and t.assigned_to is null) then raise exception 'Assignment required'; end if;
  if operation='claim' then
   if u.role not in ('STAFF','ADMIN') or t.assigned_to is not null then raise exception 'Ticket is already assigned'; end if;
   update support_tickets set assigned_to=u.id,status='IN_PROGRESS',updated_at=now() where id=t.id;
  elsif operation='assign' then
   if u.role<>'ADMIN' then raise exception 'Administrator required'; end if;
   if not exists(select 1 from profiles where id=(payload->>'assigned_to')::uuid and role in ('STAFF','ADMIN') and active) then raise exception 'Active support agent required'; end if;
   update support_tickets set assigned_to=(payload->>'assigned_to')::uuid,status='IN_PROGRESS',updated_at=now() where id=t.id;
  elsif operation='message' then
   if t.status='CLOSED' then raise exception 'Ticket is closed'; end if;
   insert into support_messages(ticket_id,sender_id,message) values(t.id,u.id,payload->>'message');
   update support_tickets set updated_at=now(),status=case when status='RESOLVED' then 'IN_PROGRESS' else status end where id=t.id;
   if u.role in ('CUSTOMER','BUSINESS') then recipient:=t.assigned_to; else select profile_id into recipient from customers where id=t.customer_id; end if;
   if recipient is not null then insert into notifications(user_id,title,message,type) values(recipient,'Tin nhắn hỗ trợ mới',t.subject,'SUPPORT'); end if;
  elsif operation='status' then
   if u.role not in ('STAFF','ADMIN') then raise exception 'Support agent required'; end if;
   update support_tickets set status=payload->>'status',updated_at=now() where id=t.id;
  else raise exception 'Unsupported operation'; end if;
 end if;
 insert into audit_logs(actor_id,action,entity,entity_id) values(u.id,operation,'support_tickets',t.id);
 return jsonb_build_object('id',t.id);
end $$;

-- payment_action from 014_support_and_payments.sql: preserve existing workflow, add customer-equivalent BUSINESS.
create or replace function public.payment_action(actor_id uuid,operation text,target_id uuid,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public as $$
declare u profiles; p projects; q quotations; plan payment_plans; item payment_installments; settings payment_settings; deposit numeric;
begin
 select * into u from profiles where id=actor_id and active;
 if u.id is null or u.role not in ('ADMIN','CUSTOMER','BUSINESS') then raise exception 'Account not permitted'; end if;
 perform set_config('app.actor',actor_id::text,true);
 if operation='create-plan' then
  if u.role<>'ADMIN' then raise exception 'Administrator required'; end if;
  select * into p from projects where id=target_id for update;
  select * into q from quotations where project_id=p.id and status='ACCEPTED';
  if q.id is null or q.total<=0 or p.status in ('CANCELLED','COMPLETED') then raise exception 'Active project with accepted quotation required'; end if;
  select * into settings from payment_settings where id='default';
  insert into payment_plans(project_id,quotation_id,total,deposit_percent) values(p.id,q.id,q.total,coalesce((payload->>'deposit_percent')::integer,settings.deposit_percent)) on conflict(project_id) do nothing returning * into plan;
  if plan.id is null then select * into plan from payment_plans where project_id=p.id; end if;
  deposit:=round(plan.total*plan.deposit_percent/100,2);
  insert into payment_installments(plan_id,stage,amount) values(plan.id,'DEPOSIT',deposit),(plan.id,'BALANCE',plan.total-deposit) on conflict(plan_id,stage) do nothing;
 else
  select * into item from payment_installments where id=target_id for update;
  if item.id is null then raise exception 'Payment not found'; end if;
  select * into plan from payment_plans where id=item.plan_id;
  select * into p from projects where id=plan.project_id;
  if u.role in ('CUSTOMER','BUSINESS') and not exists(select 1 from customers where id=p.customer_id and profile_id=u.id) then raise exception 'Payment not found'; end if;
  if operation='report' then
   if u.role not in ('CUSTOMER','BUSINESS') or item.status<>'PENDING' then raise exception 'Payment cannot be reported'; end if;
   if not exists(select 1 from payment_settings where id='default' and enabled) then raise exception 'Bank payment is not configured'; end if;
   if item.stage='BALANCE' and p.status<>'COMPLETED' then raise exception 'Final acceptance required before balance payment'; end if;
   update payment_installments set status='REPORTED',transfer_note=left(payload->>'transfer_note',1000),reported_at=now() where id=item.id;
  elsif operation in ('confirm','reject') then
   if u.role<>'ADMIN' or item.status<>'REPORTED' then raise exception 'Reported payment and administrator required'; end if;
   update payment_installments set status=case when operation='confirm' then 'PAID' else 'PENDING' end,paid_at=case when operation='confirm' then now() else null end,confirmed_by=case when operation='confirm' then u.id else null end where id=item.id;
   if operation='confirm' and not exists(select 1 from payment_installments where plan_id=plan.id and status<>'PAID') then
    update invoices set status='PAID',paid_at=now() where project_id=p.id and status in ('PENDING','ISSUED','OVERDUE');
   end if;
  else raise exception 'Unsupported payment operation'; end if;
 end if;
 insert into audit_logs(actor_id,action,entity,entity_id) values(u.id,operation,'payment_plans',plan.id);
 return jsonb_build_object('id',plan.id);
end $$;

-- manage_user from 015_staff_account_management.sql: preserve existing workflow, add customer-equivalent BUSINESS.
create or replace function public.manage_user(actor_id uuid,target_id uuid,new_role text,new_active boolean) returns jsonb
language plpgsql security definer set search_path=public as $$
begin
 perform pg_advisory_xact_lock(736231928);
 if not exists(select 1 from profiles where id=actor_id and role='ADMIN' and active) then raise exception 'Administrator required'; end if;
 if new_role not in ('ADMIN','CUSTOMER','BUSINESS','STAFF','CREATOR','STUDENT_CREATOR') then raise exception 'Unsupported role'; end if;
 if actor_id=target_id and (new_role<>'ADMIN' or not new_active) then raise exception 'Cannot remove your own administrator access'; end if;
 if not exists(select 1 from profiles where id=target_id) then raise exception 'Account not found'; end if;
 if not exists(select 1 from profiles where role='ADMIN' and active and id<>target_id) and (new_role<>'ADMIN' or not new_active) then raise exception 'At least one active administrator is required'; end if;
 perform set_config('app.actor',actor_id::text,true);
 update profiles set role=new_role,active=new_active where id=target_id;
 if new_role in ('CUSTOMER','BUSINESS') then insert into customers(profile_id) values(target_id) on conflict(profile_id) do nothing; end if;
 insert into audit_logs(actor_id,action,entity,entity_id) values(actor_id,'UPDATE','profiles',target_id);
 return jsonb_build_object('id',target_id);
end $$;

create or replace function public.owns_project(pid uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from projects p join customers c on c.id=p.customer_id
 join profiles u on u.id=c.profile_id where p.id=pid and u.auth_user_id=auth.uid()
 and u.role in ('CUSTOMER','BUSINESS') and u.active)
$$;

create or replace function public.is_conversation_member(cid uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from conversation_members cm join profiles p on p.id=cm.profile_id
 where cm.conversation_id=cid and p.auth_user_id=auth.uid() and p.active)
$$;

-- Caller-supplied actor IDs remain unavailable to browser roles.
revoke all on function public.project_action_base(uuid,uuid,text,jsonb),
 public.dashboard_report_base(uuid) from public,anon,authenticated,service_role;
revoke all on function public.project_action(uuid,uuid,text,jsonb),
 public.dashboard_report(uuid), public.support_action(uuid,text,uuid,jsonb),
 public.payment_action(uuid,text,uuid,jsonb),public.convert_lead(uuid,uuid,uuid),
 public.manage_user(uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.project_action(uuid,uuid,text,jsonb),
 public.dashboard_report(uuid), public.support_action(uuid,text,uuid,jsonb),
 public.payment_action(uuid,text,uuid,jsonb),public.convert_lead(uuid,uuid,uuid),
 public.manage_user(uuid,uuid,text,boolean) to service_role;
commit;
