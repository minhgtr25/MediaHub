begin;
create table creator_replacements (
 id uuid primary key default gen_random_uuid(),order_id uuid not null references orders(id),old_assignment_id uuid not null references creator_assignments(id),
 requested_by uuid not null references profiles(id),reason text not null check(length(btrim(reason)) between 1 and 2000),
 old_snapshot jsonb not null,idempotency_key uuid not null,created_at timestamptz not null default clock_timestamp(),
 status text not null default 'REQUESTED' check(status in ('REQUESTED','INVITED','COMPLETED','REJECTED','WITHDRAWN')),
 responded_by uuid references profiles(id),responded_at timestamptz,response_note text,new_assignment_id uuid references creator_assignments(id),
 unique(order_id,requested_by,idempotency_key)
);
create unique index replacement_one_open on creator_replacements(old_assignment_id) where status in ('REQUESTED','INVITED');
create index replacement_order_page on creator_replacements(order_id,created_at desc,id desc);
create table creator_replacement_invites (
 id uuid primary key default gen_random_uuid(),replacement_id uuid not null references creator_replacements(id),creator_id uuid not null references creator_profiles(id),
 invited_by uuid not null references profiles(id),work_scope text not null check(length(btrim(work_scope)) between 1 and 3000),deadline date not null,
 approval_note text not null check(length(btrim(approval_note)) between 1 and 2000),creator_snapshot jsonb not null,
 idempotency_key uuid not null,invited_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null,
 status text not null default 'PENDING' check(status in ('PENDING','ACCEPTED','DECLINED','EXPIRED','CANCELLED')),
 responded_at timestamptz,response_note text,
 unique(replacement_id,idempotency_key),check(expires_at>invited_at)
);
create unique index replacement_creator_reservation on creator_replacement_invites(creator_id) where status='PENDING';
create unique index replacement_one_invite on creator_replacement_invites(replacement_id) where status='PENDING';
create table execution_delays (
 id uuid primary key default gen_random_uuid(),order_id uuid not null references orders(id),reported_by uuid not null references profiles(id),
 milestone_id uuid references project_milestones(id),description text not null check(length(btrim(description)) between 1 and 3000),
 proposed_responsibility text not null check(proposed_responsibility in ('CUSTOMER','CREATOR','STAFF','MEDIAHUB','EXTERNAL','UNDETERMINED')),
 proposed_deadline date,previous_deadline date,idempotency_key uuid not null,created_at timestamptz not null default clock_timestamp(),
 status text not null default 'REPORTED' check(status in ('REPORTED','APPLIED','DISMISSED')),
 responsibility text check(responsibility in ('CUSTOMER','CREATOR','STAFF','MEDIAHUB','EXTERNAL','UNDETERMINED')),
 responsible_creator_id uuid references creator_profiles(id),new_deadline date,decision_note text,
 decided_by uuid references profiles(id),decided_at timestamptz,
 unique(order_id,reported_by,idempotency_key)
);
create index delays_order_page on execution_delays(order_id,created_at desc,id desc);
alter table creator_assignments add column current_since timestamptz;
alter table production_submissions alter column created_at set default clock_timestamp();
alter table creator_replacements enable row level security;
revoke all on creator_replacements from public,anon,authenticated;
grant all on creator_replacements to service_role;
alter table creator_replacement_invites enable row level security;
revoke all on creator_replacement_invites from public,anon,authenticated;
grant all on creator_replacement_invites to service_role;
alter table execution_delays enable row level security;
revoke all on execution_delays from public,anon,authenticated;
grant all on execution_delays to service_role;
create function guard_execution_record() returns trigger language plpgsql set search_path=public as $$
declare oid uuid;
begin
 if tg_op='DELETE' then raise exception 'Giữ nguyên lịch sử điều phối.';end if;
 if tg_table_name='creator_replacement_invites' then select order_id into oid from creator_replacements where id=new.replacement_id;else oid:=new.order_id;end if;
 if current_user not in ('postgres','supabase_admin','service_role') or nullif(current_setting('app.execution_order',true),'')::uuid is distinct from oid then raise exception 'Điều phối chỉ thay đổi qua workflow.';end if;
 if tg_op='UPDATE' then
  if tg_table_name='creator_replacement_invites' then
   if old.status<>'PENDING' or new.status not in ('ACCEPTED','DECLINED','EXPIRED','CANCELLED') or (to_jsonb(new)-array['status','responded_at','response_note']) is distinct from (to_jsonb(old)-array['status','responded_at','response_note']) then raise exception 'Giữ nguyên phiên bản lời mời.';end if;
  elsif tg_table_name='creator_replacements' then
   if old.status not in ('REQUESTED','INVITED') or new.status not in ('REQUESTED','INVITED','COMPLETED','REJECTED','WITHDRAWN') or (to_jsonb(new)-array['status','responded_by','responded_at','response_note','new_assignment_id']) is distinct from (to_jsonb(old)-array['status','responded_by','responded_at','response_note','new_assignment_id']) then raise exception 'Giữ nguyên yêu cầu và đội gốc.';end if;
  else
   if old.status<>'REPORTED' or new.status not in ('APPLIED','DISMISSED') or (to_jsonb(new)-array['status','responsibility','responsible_creator_id','new_deadline','decision_note','decided_by','decided_at']) is distinct from (to_jsonb(old)-array['status','responsibility','responsible_creator_id','new_deadline','decision_note','decided_by','decided_at']) then raise exception 'Quyết định trễ hạn được giữ bất biến.';end if;
  end if;
 end if;
 return new;
end $$;
create trigger replacement_guard before insert or update or delete on creator_replacements for each row execute function guard_execution_record();
create trigger replacement_invite_guard before insert or update or delete on creator_replacement_invites for each row execute function guard_execution_record();
create trigger delay_guard before insert or update or delete on execution_delays for each row execute function guard_execution_record();
create function guard_cross_creator_reservation() returns trigger language plpgsql set search_path=public as $$
begin
 if new.status in ('PENDING','ACCEPTED') and exists(select 1 from creator_replacement_invites where creator_id=new.creator_id and status='PENDING' and expires_at>clock_timestamp()) then raise exception 'Creator đang được giữ chỗ để thay thế ở một dự án.';end if;
 return new;
end $$;
create trigger creator_cross_reservation before insert or update on creator_assignments for each row execute function guard_cross_creator_reservation();
create function execution_open(oid uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from orders o join requests r on r.id=o.request_id join profiles s on s.id=o.assigned_to and s.active where o.id=oid and r.assigned_to=s.id and r.status='CONVERTED' and o.status in ('WAITING_PAYMENT','CONFIRMED','IN_PROGRESS')
 and exists(select 1 from contract_acknowledgments where order_id=o.id) and not exists(select 1 from order_final_funds_confirmations where order_id=o.id)
 and not exists(select 1 from order_review_rounds where order_id=o.id and status in ('PENDING','ACCEPTED')))
$$;
create function expire_replacement_invites(cid uuid) returns void language plpgsql security definer set search_path=public as $$
declare i creator_replacement_invites;v creator_replacements;saved text:=current_setting('app.execution_order',true);
begin
 for i in select * from creator_replacement_invites where creator_id=cid and status='PENDING' and expires_at<=clock_timestamp() for update loop
  select * into v from creator_replacements where id=i.replacement_id;
  perform set_config('app.execution_order',v.order_id::text,true);
  update creator_replacement_invites set status='EXPIRED',responded_at=clock_timestamp(),response_note='Hết thời gian giữ chỗ.' where id=i.id;
  update creator_replacements set status='REQUESTED' where id=v.id and status='INVITED';
 end loop;
 perform set_config('app.execution_order',coalesce(saved,''),true);
end $$;
create function execution_candidates(actor_id uuid,oid uuid,search_text text default '') returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
 if not variation_commerce_reader(actor_id,oid) or not exists(select 1 from profiles where id=actor_id and role in ('STAFF','ADMIN')) then return null;end if;
 if length(coalesce(search_text,''))>100 then raise exception 'Từ khóa quá dài.';end if;
 select coalesce(jsonb_agg(to_jsonb(c)),'[]') into result from (
 select c.id,c.display_name,c.slug,c.title,c.avatar_url from creator_profiles c join profiles p on p.id=c.profile_id and p.active and p.role in ('CREATOR','STUDENT_CREATOR') join creator_company_agreements a on a.creator_id=c.id
 where c.availability in ('AVAILABLE','LIMITED') and (coalesce(search_text,'')='' or position(lower(search_text) in lower(c.display_name||' '||c.title))>0)
 and not exists(select 1 from creator_assignments where creator_id=c.id and (status='ACCEPTED' or status='PENDING' and expires_at>clock_timestamp()))
 and not exists(select 1 from creator_replacement_invites where creator_id=c.id and status='PENDING' and expires_at>clock_timestamp())
 order by c.display_name,c.id limit 24) c;
 return jsonb_build_object('items',result);
end $$;
create function execution_state(actor_id uuid,oid uuid,report_page integer default 1) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare team jsonb;replacements jsonb;delays jsonb;rp_count bigint;dl_count bigint;creator boolean;
begin
 if not is_delivery_reader(actor_id,oid) then return null;end if;
 if report_page is null or report_page not between 1 and 100000 then raise exception 'Trang không hợp lệ.';end if;
 creator:=exists(select 1 from profiles where id=actor_id and role in ('CREATOR','STUDENT_CREATOR'));
 select coalesce(jsonb_agg(jsonb_build_object('assignment_id',a.id,'creator_id',c.id,'display_name',c.display_name,'work_scope',a.work_scope,'deadline',a.deadline,'status',a.status) order by a.invited_at,a.id),'[]') into team
 from orders o join creator_assignments a on a.request_id=o.request_id join creator_profiles c on c.id=a.creator_id where o.id=oid and a.status in ('ACCEPTED','COMPLETED');
 select count(*) into rp_count from creator_replacements where order_id=oid;
 select count(*) into dl_count from execution_delays where order_id=oid;
 select coalesce(jsonb_agg(row_value order by created_at desc,id desc),'[]') into replacements from (
 select v.id,v.created_at,(to_jsonb(v)-'idempotency_key')||jsonb_build_object('invites',coalesce((select jsonb_agg((to_jsonb(i)-'idempotency_key')||jsonb_build_object('effective_status',case when i.status='PENDING' and i.expires_at<=clock_timestamp() then 'EXPIRED' else i.status end) order by i.invited_at desc,i.id desc) from (select * from creator_replacement_invites where replacement_id=v.id order by invited_at desc,id desc limit 10) i),'[]')) row_value
 from creator_replacements v where order_id=oid order by created_at desc,id desc limit 10 offset (report_page-1)*10) rows;
 select coalesce(jsonb_agg((to_jsonb(d)-'idempotency_key')||jsonb_build_object('reported_by_name',(select full_name from profiles where id=d.reported_by),'decided_by_name',(select full_name from profiles where id=d.decided_by),'responsible_creator_name',(select display_name from creator_profiles where id=d.responsible_creator_id)) order by created_at desc,id desc),'[]') into delays from (select * from execution_delays where order_id=oid order by created_at desc,id desc limit 10 offset (report_page-1)*10) d;
 return jsonb_build_object('team',team,'replacements',case when creator then '[]'::jsonb else replacements end,'replacement_count',case when creator then 0 else rp_count end,'delays',delays,'delay_count',dl_count,'page',report_page,'limit',10,'can_change',execution_open(oid),'responsible_creators',case when exists(select 1 from profiles where id=actor_id and role in ('STAFF','ADMIN')) then coalesce((select jsonb_agg(jsonb_build_object('creator_id',cp.id,'display_name',cp.display_name)) from creator_profiles cp where exists(select 1 from creator_assignments ass join orders ord on ord.request_id=ass.request_id where ord.id=oid and ass.creator_id=cp.id)),'[]'::jsonb) else '[]'::jsonb end,'has_project',exists(select 1 from projects where order_id=oid),'deadline',(select deadline from projects where order_id=oid));
end $$;

create function execution_action(actor_id uuid,oid uuid,operation text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public as $$
declare u profiles;o orders;r requests;p projects;a creator_assignments;v creator_replacements;i creator_replacement_invites;c creator_profiles;d execution_delays;m project_milestones;
 owner boolean;operator boolean;note text:=btrim(coalesce(payload->>'reason',''));minutes integer;new_date date;event_name text;event_text text;
begin
 select * into u from profiles where id=actor_id and active;
 if u.id is null or not is_delivery_reader(u.id,oid) then raise exception 'Không có quyền truy cập điều phối.';end if;
 perform pg_advisory_xact_lock(736231934);
 select request_id into r.id from orders where id=oid;select * into r from requests where id=r.id for update;select * into o from orders where id=oid for update;select * into p from projects where order_id=oid for update;
 if not is_delivery_reader(u.id,oid) then raise exception 'Quyền phụ trách đã thay đổi.';end if;
 owner:=u.role in ('CUSTOMER','BUSINESS');operator:=u.role in ('STAFF','ADMIN');
 if operation in ('replacement_request','replacement_withdraw') and not owner or operation in ('replacement_invite','replacement_reject','delay_apply','delay_dismiss') and not operator then raise exception 'Thao tác không đúng vai trò.';end if;
 if operation not in ('replacement_request','replacement_withdraw','replacement_invite','replacement_reject','delay_report','delay_apply','delay_dismiss') then raise exception 'Thao tác điều phối chưa được hỗ trợ.';end if;
 perform set_config('app.actor',u.id::text,true);perform set_config('app.execution_order',o.id::text,true);perform set_config('app.production_order',o.id::text,true);
 if operation='replacement_request' then
  select * into v from creator_replacements where order_id=o.id and requested_by=u.id and idempotency_key=(payload->>'idempotency_key')::uuid;
  if v.id is not null then
   if v.old_assignment_id is distinct from (payload->>'assignment_id')::uuid or v.reason is distinct from note then raise exception 'Khóa gửi lặp đã dùng với yêu cầu khác.';end if;
   return jsonb_build_object('id',v.id,'reused',true);
  end if;
  if not execution_open(o.id) or length(note) not between 1 and 2000 or payload->>'idempotency_key' is null then raise exception 'Chỉ yêu cầu đổi trước nghiệm thu/thu đủ, kèm lý do.';end if;
  select * into a from creator_assignments where id=(payload->>'assignment_id')::uuid and request_id=r.id and status='ACCEPTED' for update;
  if a.id is null then raise exception 'Chọn Creator hiện đang phụ trách.';end if;
  insert into creator_replacements(order_id,old_assignment_id,requested_by,reason,old_snapshot,idempotency_key) values(o.id,a.id,u.id,note,jsonb_build_object('assignment',to_jsonb(a),'creator',(select jsonb_build_object('id',id,'display_name',display_name,'title',title) from creator_profiles where id=a.creator_id)),(payload->>'idempotency_key')::uuid) returning * into v;
  event_name:='ORDER_CREATOR_REPLACEMENT_REQUESTED';event_text:='Khách hàng yêu cầu đổi Creator. Người đang phụ trách tiếp tục cho đến khi người thay thế xác nhận. Lý do: '||note;
 elsif operation in ('replacement_invite','replacement_reject','replacement_withdraw') then
  select * into v from creator_replacements where id=(payload->>'replacement_id')::uuid and order_id=o.id for update;
  if v.id is null then raise exception 'Không tìm thấy yêu cầu đổi Creator.';end if;
  if operation='replacement_invite' then
   select * into i from creator_replacement_invites where replacement_id=v.id and idempotency_key=(payload->>'idempotency_key')::uuid;
   if i.id is not null then
    if i.creator_id is distinct from (payload->>'creator_id')::uuid or i.work_scope is distinct from btrim(payload->>'work_scope') or i.deadline is distinct from (payload->>'deadline')::date or i.approval_note is distinct from note or extract(epoch from i.expires_at-i.invited_at)::integer<>coalesce((payload->>'response_minutes')::integer,15)*60 then raise exception 'Khóa lời mời đã dùng với nội dung khác.';end if;
    return jsonb_build_object('id',v.id,'invite_id',i.id,'reused',true);
   end if;
   if not execution_open(o.id) or v.status not in ('REQUESTED','INVITED') then raise exception 'Yêu cầu đã đóng hoặc đã qua nghiệm thu.';end if;
   select * into a from creator_assignments where id=v.old_assignment_id and status='ACCEPTED';
   if a.id is null then raise exception 'Người cũ không còn phụ trách; Customer cần yêu cầu lại.';end if;
   minutes:=coalesce((payload->>'response_minutes')::integer,15);new_date:=(payload->>'deadline')::date;
   if minutes not between 5 and 15 or new_date is null or new_date<(now() at time zone 'Asia/Ho_Chi_Minh')::date or (coalesce(p.deadline,greatest(r.deadline,(select max(q.deadline) from order_variation_quotes q join order_variation_acknowledgments ack on ack.quote_id=q.id join order_variations variation on variation.id=ack.variation_id where variation.order_id=o.id))) is not null and new_date>coalesce(p.deadline,greatest(r.deadline,(select max(q.deadline) from order_variation_quotes q join order_variation_acknowledgments ack on ack.quote_id=q.id join order_variations variation on variation.id=ack.variation_id where variation.order_id=o.id)))) or length(btrim(coalesce(payload->>'work_scope',''))) not between 1 and 3000 or length(note) not between 1 and 2000 or payload->>'idempotency_key' is null then raise exception 'Cần phạm vi, lý do phê duyệt, hạn trong lịch dự án và giữ chỗ 5–15 phút. Đổi lịch qua báo cáo trễ hạn.';end if;
   select * into c from creator_profiles where id=(payload->>'creator_id')::uuid for update;
   if c.id is null or c.id=a.creator_id or c.availability not in ('AVAILABLE','LIMITED') or not exists(select 1 from profiles where id=c.profile_id and active and role in ('CREATOR','STUDENT_CREATOR')) or not exists(select 1 from creator_company_agreements where creator_id=c.id) then raise exception 'Creator mới cần hợp đồng hợp tác và tài khoản hoạt động.';end if;
   perform expire_replacement_invites(c.id);
   update creator_assignments set status='EXPIRED',responded_at=clock_timestamp(),response_note='Hết thời gian giữ chỗ.' where creator_id=c.id and status='PENDING' and expires_at<=clock_timestamp();
   if exists(select 1 from creator_assignments where creator_id=c.id and status in ('PENDING','ACCEPTED')) or exists(select 1 from creator_replacement_invites where creator_id=c.id and status='PENDING') then raise exception 'Creator đang bận hoặc được giữ chỗ.';end if;
   update creator_replacement_invites set status='CANCELLED',responded_at=clock_timestamp(),response_note='Staff gửi lời mời mới.' where replacement_id=v.id and status='PENDING';
   insert into creator_replacement_invites(replacement_id,creator_id,invited_by,work_scope,deadline,approval_note,creator_snapshot,idempotency_key,invited_at,expires_at)
   values(v.id,c.id,u.id,btrim(payload->>'work_scope'),new_date,note,jsonb_build_object('id',c.id,'display_name',c.display_name,'title',c.title), (payload->>'idempotency_key')::uuid,clock_timestamp(),clock_timestamp()+make_interval(mins=>minutes)) returning * into i;
   update creator_replacements set status='INVITED',responded_by=u.id,responded_at=clock_timestamp(),response_note=note where id=v.id;
   insert into notifications(user_id,title,message,type,target_path) values(c.profile_id,'Lời mời thay thế Creator',r.title||': '||i.work_scope,'REQUEST','/creator/dashboard');
   event_name:='ORDER_CREATOR_REPLACEMENT_INVITED';event_text:='Staff phê duyệt và mời '||c.display_name||' nhận phần việc thay thế. Creator mới cần tự xác nhận trong thời gian giữ chỗ.';
  else
   if v.status=(case operation when 'replacement_reject' then 'REJECTED' else 'WITHDRAWN' end) and v.responded_by=u.id and v.response_note=note then return jsonb_build_object('id',v.id,'reused',true);end if;
   if v.status not in ('REQUESTED','INVITED') or length(note) not between 1 and 2000 then raise exception 'Chỉ đóng yêu cầu đang mở, kèm lý do.';end if;
   update creator_replacement_invites set status='CANCELLED',responded_at=clock_timestamp(),response_note=note where replacement_id=v.id and status='PENDING';
   update creator_replacements set status=case operation when 'replacement_reject' then 'REJECTED' else 'WITHDRAWN' end,responded_by=u.id,responded_at=clock_timestamp(),response_note=note where id=v.id;
   event_name:='ORDER_CREATOR_REPLACEMENT_CLOSED';event_text:='Yêu cầu đổi Creator đã đóng. Người hiện tại tiếp tục phụ trách. Lý do: '||note;
  end if;
 elsif operation='delay_report' then
  select * into d from execution_delays where order_id=o.id and reported_by=u.id and idempotency_key=(payload->>'idempotency_key')::uuid;
  if d.id is not null then
   if d.description is distinct from btrim(payload->>'description') or d.proposed_responsibility is distinct from payload->>'responsibility' or d.proposed_deadline is distinct from (payload->>'proposed_deadline')::date or d.milestone_id is distinct from (payload->>'milestone_id')::uuid then raise exception 'Khóa báo cáo đã dùng với nội dung khác.';end if;
   return jsonb_build_object('id',d.id,'reused',true);
  end if;
  if p.id is null or not execution_open(o.id) or length(btrim(coalesce(payload->>'description',''))) not between 1 and 3000 or payload->>'idempotency_key' is null or coalesce(payload->>'responsibility','') not in ('CUSTOMER','CREATOR','STAFF','MEDIAHUB','EXTERNAL','UNDETERMINED') then raise exception 'Báo cáo cần dự án đang thực hiện, nội dung và bên liên quan.';end if;
  if payload->>'milestone_id' is not null and not exists(select 1 from project_milestones where id=(payload->>'milestone_id')::uuid and project_id=p.id and status<>'COMPLETED') then raise exception 'Mốc không thuộc dự án hoặc đã hoàn thành.';end if;
  if payload->>'proposed_deadline' is not null and (payload->>'proposed_deadline')::date<(now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'Hạn đề nghị phải từ hôm nay.';end if;
  insert into execution_delays(order_id,reported_by,milestone_id,description,proposed_responsibility,proposed_deadline,previous_deadline,idempotency_key)
  values(o.id,u.id,(payload->>'milestone_id')::uuid,btrim(payload->>'description'),payload->>'responsibility',(payload->>'proposed_deadline')::date,p.deadline,(payload->>'idempotency_key')::uuid) returning * into d;
  event_name:='PRODUCTION_DELAY_REPORTED';event_text:='Báo cáo nguy cơ/trễ hạn: '||d.description||'. Bên liên quan được đề nghị: '||(case d.proposed_responsibility when 'CUSTOMER' then 'Customer' when 'CREATOR' then 'Creator' when 'STAFF' then 'Staff' when 'MEDIAHUB' then 'Công ty MediaHub' when 'EXTERNAL' then 'Bên ngoài' else 'Chưa xác định' end)||'; chờ Staff xác minh.';
 else
  select * into d from execution_delays where id=(payload->>'delay_id')::uuid and order_id=o.id for update;
  if d.id is null then raise exception 'Không tìm thấy báo cáo.';end if;
  if length(note) not between 1 and 2000 then raise exception 'Cần căn cứ và ghi chú quyết định.';end if;
  if d.status<>'REPORTED' then
   if d.decided_by=u.id and d.decision_note=note and d.status=(case operation when 'delay_apply' then 'APPLIED' else 'DISMISSED' end) and (operation='delay_dismiss' or d.new_deadline is not distinct from (payload->>'new_deadline')::date and d.responsibility is not distinct from payload->>'responsibility' and d.responsible_creator_id is not distinct from (payload->>'responsible_creator_id')::uuid) then return jsonb_build_object('id',d.id,'reused',true);end if;
   raise exception 'Báo cáo đã có quyết định, không sửa lịch sử.';
  end if;
  if not execution_open(o.id) or p.id is null then raise exception 'Đã qua giai đoạn thay đổi lịch thực hiện.';end if;
  if operation='delay_apply' then
   new_date:=(payload->>'new_deadline')::date;
   if new_date is null or new_date<(now() at time zone 'Asia/Ho_Chi_Minh')::date or p.deadline is not null and new_date<p.deadline or coalesce(payload->>'responsibility','') not in ('CUSTOMER','CREATOR','STAFF','MEDIAHUB','EXTERNAL','UNDETERMINED') then raise exception 'Hạn mới không được rút ngắn lịch và cần xác định bên chịu trách nhiệm.';end if;
   if payload->>'responsibility'='CREATOR' then
    if not exists(select 1 from creator_assignments where request_id=r.id and creator_id=(payload->>'responsible_creator_id')::uuid) then raise exception 'Chọn Creator từng phụ trách đúng dự án.';end if;
   elsif payload->>'responsible_creator_id' is not null then raise exception 'Chỉ chỉ định Creator khi trách nhiệm thuộc Creator.';end if;
   if d.milestone_id is not null then
    select * into m from project_milestones where id=d.milestone_id and project_id=p.id for update;
    if m.id is null or m.status='COMPLETED' then raise exception 'Mốc đã hoàn thành; không sửa hạn cũ.';end if;
    update project_milestones set due_date=new_date,updated_at=clock_timestamp() where id=m.id;
   end if;
   update projects set deadline=new_date where id=p.id;
   update execution_delays set status='APPLIED',responsibility=payload->>'responsibility',responsible_creator_id=(payload->>'responsible_creator_id')::uuid,new_deadline=new_date,decision_note=note,decided_by=u.id,decided_at=clock_timestamp() where id=d.id;
   event_name:='PRODUCTION_DELAY_APPLIED';event_text:='Staff ghi nhận trách nhiệm: '||(case payload->>'responsibility' when 'CUSTOMER' then 'Customer' when 'CREATOR' then 'Creator' when 'STAFF' then 'Staff' when 'MEDIAHUB' then 'Công ty MediaHub' when 'EXTERNAL' then 'Bên ngoài' else 'Chưa xác định' end)||'. Hạn mới: '||new_date||'. Căn cứ: '||note;
  else
   update execution_delays set status='DISMISSED',decision_note=note,decided_by=u.id,decided_at=clock_timestamp() where id=d.id;
   event_name:='PRODUCTION_DELAY_DISMISSED';event_text:='Staff đóng báo cáo trễ hạn, giữ lịch hiện tại. Căn cứ: '||note;
  end if;
  insert into project_status_history(project_id,status,note,created_by) values(p.id,p.production_status,event_text,u.id);
 end if;
 perform record_request_event(u.id,r.id,event_name,event_text,jsonb_build_object('order_id',o.id,'replacement_id',v.id,'delay_id',d.id),'{}','{}',nullif(note,''));
 return jsonb_build_object('id',coalesce(v.id,d.id),'order_id',o.id,'invite_id',i.id);
end $$;

create function replacement_reserved_creators(actor_id uuid,creator_ids uuid[]) returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if not exists(select 1 from profiles where id=actor_id and active and role in ('STAFF','ADMIN')) or coalesce(cardinality(creator_ids),0)>100 then raise exception 'Không có quyền xem lịch Creator.';end if;
 return coalesce((select jsonb_agg(distinct creator_id) from creator_replacement_invites where creator_id=any(creator_ids) and status='PENDING' and expires_at>clock_timestamp()),'[]');
end $$;
create function execution_invitations(actor_id uuid,report_page integer default 1) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare items jsonb;cnt bigint;
begin
 if not exists(select 1 from profiles where id=actor_id and active and role in ('CREATOR','STUDENT_CREATOR')) then return null;end if;
 if report_page is null or report_page not between 1 and 100000 then raise exception 'Trang không hợp lệ.';end if;
 select count(*) into cnt from creator_replacement_invites i join creator_profiles c on c.id=i.creator_id where c.profile_id=actor_id;
 select coalesce(jsonb_agg(to_jsonb(rows) order by active desc,invited_at desc,id desc),'[]') into items from (
 select i.id,i.work_scope,i.deadline,i.expires_at,i.invited_at,i.status,i.response_note,v.new_assignment_id,r.title request_title,staff.full_name staff_name,
 (i.status='PENDING' and i.expires_at>clock_timestamp()) active,
 case when i.status='PENDING' and i.expires_at<=clock_timestamp() then 'EXPIRED' else i.status end effective_status
 from creator_replacement_invites i join creator_profiles c on c.id=i.creator_id join creator_replacements v on v.id=i.replacement_id join orders o on o.id=v.order_id join requests r on r.id=o.request_id left join profiles staff on staff.id=r.assigned_to
 where c.profile_id=actor_id order by (i.status='PENDING' and i.expires_at>clock_timestamp()) desc,i.invited_at desc,i.id desc limit 10 offset (report_page-1)*10) rows;
 return jsonb_build_object('items',items,'total',cnt,'page',report_page,'limit',10);
end $$;
create function execution_invite_scope(actor_id uuid,iid uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from creator_replacement_invites i join creator_profiles c on c.id=i.creator_id join profiles p on p.id=c.profile_id and p.active and p.role in ('CREATOR','STUDENT_CREATOR') where i.id=iid and p.id=actor_id)
$$;
revoke all on function execution_invite_scope(uuid,uuid) from public,anon,authenticated;
grant execute on function execution_invite_scope(uuid,uuid) to service_role;
create function execution_invite_response(actor_id uuid,iid uuid,operation text,reason text default '') returns jsonb language plpgsql security definer set search_path=public as $$
declare u profiles;i creator_replacement_invites;v creator_replacements;o orders;r requests;p projects;old_a creator_assignments;new_a creator_assignments;c creator_profiles;proposal uuid;
begin
 select * into u from profiles where id=actor_id and active and role in ('CREATOR','STUDENT_CREATOR');
 if u.id is null or not exists(select 1 from creator_replacement_invites owned_invite join creator_profiles owned_creator on owned_creator.id=owned_invite.creator_id where owned_invite.id=iid and owned_creator.profile_id=u.id) then raise exception 'Không tìm thấy lời mời của bạn.';end if;
 if operation not in ('accept','decline') then raise exception 'Thao tác lời mời không hợp lệ.';end if;
 perform pg_advisory_xact_lock(736231934);
 select * into i from creator_replacement_invites where id=iid;
 select * into v from creator_replacements where id=i.replacement_id;
 select request_id into r.id from orders where id=v.order_id;select * into r from requests where id=r.id for update;select * into o from orders where id=v.order_id for update;select * into p from projects where order_id=o.id for update;
 select * into v from creator_replacements where id=i.replacement_id for update;select * into i from creator_replacement_invites where id=iid for update;
 perform set_config('app.actor',u.id::text,true);perform set_config('app.execution_order',o.id::text,true);perform set_config('app.production_order',o.id::text,true);
 if operation='accept' and i.status='ACCEPTED' and v.status='COMPLETED' then return jsonb_build_object('id',i.id,'assignment_id',v.new_assignment_id,'reused',true);end if;
 if operation='decline' and i.status='DECLINED' and i.response_note=btrim(reason) then return jsonb_build_object('id',i.id,'reused',true);end if;
 if i.status<>'PENDING' or i.expires_at<=clock_timestamp() or v.status<>'INVITED' or not execution_open(o.id) then raise exception 'Lời mời đã hết hạn, bị thu hồi hoặc dự án không còn cho đổi người.';end if;
 if operation='decline' then
  if length(btrim(reason)) not between 1 and 2000 then raise exception 'Cần lý do từ chối.';end if;
  update creator_replacement_invites set status='DECLINED',responded_at=clock_timestamp(),response_note=btrim(reason) where id=i.id;
  update creator_replacements set status='REQUESTED' where id=v.id;
  perform record_request_event(u.id,r.id,'ORDER_CREATOR_REPLACEMENT_DECLINED','Creator được mời từ chối nhận việc; người cũ tiếp tục phụ trách.',jsonb_build_object('order_id',o.id,'replacement_id',v.id),'{}','{}',btrim(reason));
  return jsonb_build_object('id',i.id);
 end if;
 select * into c from creator_profiles where id=i.creator_id for update;
 if c.profile_id<>u.id or c.availability not in ('AVAILABLE','LIMITED') or not exists(select 1 from creator_company_agreements where creator_id=c.id) then raise exception 'Creator chưa đủ điều kiện nhận việc.';end if;
 select * into old_a from creator_assignments where id=v.old_assignment_id and request_id=r.id and status='ACCEPTED' for update;
 if old_a.id is null or exists(select 1 from creator_assignments where creator_id=c.id and (status='ACCEPTED' or status='PENDING' and expires_at>clock_timestamp())) then raise exception 'Người cũ đã đổi hoặc người mới đang bận.';end if;
 update creator_assignments set status='EXPIRED',responded_at=clock_timestamp(),response_note='Hết thời gian giữ chỗ.' where creator_id=c.id and status='PENDING' and expires_at<=clock_timestamp();
 update creator_replacement_invites set status='ACCEPTED',responded_at=clock_timestamp(),response_note='Creator tự xác nhận phần việc thay thế.' where id=i.id;
 update creator_assignments set status='RELEASED',responded_at=clock_timestamp(),response_note='Đã thay thế theo yêu cầu Customer '||v.id where id=old_a.id;
 select id into proposal from creator_proposals where request_id=r.id and creator_id=c.id order by created_at desc,id desc limit 1;
 if proposal is null then
  insert into creator_proposals(request_id,creator_id,proposed_by,creator_snapshot,reason) values(r.id,c.id,i.invited_by,jsonb_build_object('id',c.id,'display_name',c.display_name,'slug',c.slug,'title',c.title,'avatar_url',c.avatar_url,'availability',c.availability),'Creator thay thế được Staff phê duyệt.') returning id into proposal;
 end if;
 insert into creator_assignments(request_id,creator_id,proposal_id,work_scope,deadline,status,invited_by,invited_at,expires_at,responded_at,response_note,current_since)
 values(r.id,c.id,proposal,i.work_scope,i.deadline,'ACCEPTED',i.invited_by,i.invited_at,i.expires_at,clock_timestamp(),'Xác nhận lời mời thay thế '||i.id,clock_timestamp())
 on conflict(request_id,creator_id) do update set proposal_id=excluded.proposal_id,work_scope=excluded.work_scope,deadline=excluded.deadline,status='ACCEPTED',invited_by=excluded.invited_by,invited_at=excluded.invited_at,expires_at=excluded.expires_at,responded_at=excluded.responded_at,response_note=excluded.response_note,current_since=excluded.current_since returning * into new_a;
 update creator_replacements set status='COMPLETED',responded_at=clock_timestamp(),new_assignment_id=new_a.id where id=v.id;
 delete from conversation_members where conversation_id=(select id from conversations where request_id=r.id) and profile_id=(select profile_id from creator_profiles where id=old_a.creator_id);
 perform sync_creator_conversation(r.id);
 if p.id is not null then
  delete from project_team_members where project_id=p.id and creator_id=old_a.creator_id;
  insert into project_team_members(project_id,creator_id,role) values(p.id,c.id,'CREATOR') on conflict do nothing;
  insert into project_status_history(project_id,status,note,created_by) values(p.id,p.production_status,'Creator mới xác nhận nhận phần việc thay thế: '||c.display_name,u.id);
 end if;
 insert into notifications(user_id,title,message,type,target_path) values(r.assigned_to,'Creator thay thế đã xác nhận',r.title||': '||c.display_name,'REQUEST','/staff/requests/'||r.id);
 perform record_request_event(u.id,r.id,'CREATOR_REPLACEMENT_COMPLETED',c.display_name||' đã xác nhận nhận việc thay thế. Phần việc: '||i.work_scope||'. Hạn: '||i.deadline||'. Đội và hợp đồng gốc được lưu trong lịch sử.',jsonb_build_object('order_id',o.id,'replacement_id',v.id,'assignment_id',new_a.id),'{}','{}');
 return jsonb_build_object('id',i.id,'assignment_id',new_a.id);
end $$;
-- The formal delivery chain keeps its existing receipt/review/final guarantees.
alter function order_delivery_action(uuid,uuid,text,jsonb) rename to legacy_order_delivery_action_035;
revoke all on function legacy_order_delivery_action_035(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
create function order_delivery_action(actor_id uuid,oid uuid,operation text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if operation='send_review' then
  perform pg_advisory_xact_lock(736231934);
  perform 1 from requests where id=(select request_id from orders where id=oid) for update;perform 1 from orders where id=oid for update;
  if exists(select 1 from creator_replacements where order_id=oid and status in ('REQUESTED','INVITED')) then raise exception 'Cần chốt hoặc đóng các yêu cầu đổi Creator trước nghiệm thu.';end if;
  if exists(select 1 from production_submissions f join creator_assignments a on a.id=f.assignment_id where f.id in(select value::uuid from jsonb_array_elements_text(payload->'submission_ids')) and f.order_id=oid and a.current_since is not null and f.created_at<a.current_since) then raise exception 'Chọn bản được gửi sau khi Creator nhận phần việc thay thế, không dùng lại sản phẩm trước đó.';end if;
 end if;
 return legacy_order_delivery_action_035(actor_id,oid,operation,payload);
end $$;
-- Update the old team gate in the wrapper chain: original selections remain evidence,
-- while production requires the same number of active confirmed current assignments.
create or replace function legacy_order_production_action_034(actor_id uuid,oid uuid,operation text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public as $$
declare response jsonb;rid uuid;
begin
 if operation='create' or (operation='status' and payload->>'status' in ('READY','IN_PROGRESS')) then
  perform pg_advisory_xact_lock(736231934);
  select request_id into rid from orders where id=oid;
  if exists(select 1 from creator_team_settings where enabled) and exists(select 1 from requests where id=rid and team_confirmation_required) and (
   (select count(*) from creator_assignments where request_id=rid and status='ACCEPTED')<(select count(*) from request_creator_selections where request_id=rid)
   or exists(select 1 from creator_assignments ass where ass.request_id=rid and ass.status='ACCEPTED' and not exists(select 1 from creator_profiles cp join profiles person on person.id=cp.profile_id where cp.id=ass.creator_id and person.active and person.role in ('CREATOR','STUDENT_CREATOR')))
  ) then raise exception 'Đội Creator hiện tại chưa đủ điều kiện thực hiện; cần người phụ trách xử lý.';end if;
 end if;
 response:=legacy_order_production_action_027(actor_id,oid,operation,payload);
 if operation='create' then
  insert into project_team_members(project_id,creator_id,role) select (response->>'id')::uuid,ass.creator_id,'CREATOR' from creator_assignments ass where ass.request_id=(select request_id from orders where id=oid) and ass.status='ACCEPTED' on conflict do nothing;
 end if;
 return response;
end $$;
revoke all on function legacy_order_production_action_034(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
alter function order_production_action(uuid,uuid,text,jsonb) rename to legacy_order_production_action_035;
revoke all on function legacy_order_production_action_035(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
create function order_production_action(actor_id uuid,oid uuid,operation text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public as $$
declare answer jsonb;
begin
 answer:=legacy_order_production_action_035(actor_id,oid,operation,payload);
 if operation='create' and exists(select 1 from orders o join creator_assignments a on a.request_id=o.request_id where o.id=oid and a.status='ACCEPTED') then
  delete from project_team_members where project_id=(answer->>'id')::uuid and creator_id not in(select creator_id from creator_assignments where request_id=(select request_id from orders where id=oid) and status='ACCEPTED');
  insert into project_team_members(project_id,creator_id,role) select (answer->>'id')::uuid,a.creator_id,'CREATOR' from orders o join creator_assignments a on a.request_id=o.request_id where o.id=oid and a.status='ACCEPTED' on conflict do nothing;
 end if;
 return answer;
end $$;
revoke all on function execution_state(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function execution_state(uuid,uuid,integer) to service_role;
revoke all on function execution_candidates(uuid,uuid,text) from public,anon,authenticated;
grant execute on function execution_candidates(uuid,uuid,text) to service_role;
revoke all on function execution_action(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function execution_action(uuid,uuid,text,jsonb) to service_role;
revoke all on function execution_invitations(uuid,integer) from public,anon,authenticated;
grant execute on function execution_invitations(uuid,integer) to service_role;
revoke all on function execution_invite_response(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function execution_invite_response(uuid,uuid,text,text) to service_role;
revoke all on function replacement_reserved_creators(uuid,uuid[]) from public,anon,authenticated;
grant execute on function replacement_reserved_creators(uuid,uuid[]) to service_role;
revoke all on function order_delivery_action(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function order_delivery_action(uuid,uuid,text,jsonb) to service_role;
revoke all on function order_production_action(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function order_production_action(uuid,uuid,text,jsonb) to service_role;
revoke all on function guard_execution_record(),guard_cross_creator_reservation(),execution_open(uuid),expire_replacement_invites(uuid) from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
