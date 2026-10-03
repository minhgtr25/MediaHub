begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('order-deliverables','order-deliverables',false,52428800,array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime','application/pdf']);
-- No authenticated/anonymous storage policy: all downloads are scoped,
-- expiring server-signed URLs. No public final-file link before funds clear.
create table public.production_submissions (
 id uuid primary key default gen_random_uuid(),order_id uuid not null references orders(id),assignment_id uuid not null references creator_assignments(id),
 author_id uuid not null references profiles(id),kind text not null check(kind in ('REVIEW','FINAL')),
 title text not null check(length(btrim(title)) between 1 and 200),note text not null default '' check(length(note)<=3000),
 file_name text not null,storage_path text not null unique,file_type text not null,file_size bigint not null check(file_size between 1 and 52428800),
 final_of uuid unique references production_submissions(id),created_at timestamptz not null default now(),
 constraint submission_origin check((kind='REVIEW' and final_of is null) or (kind='FINAL' and final_of is not null))
);
create index production_submissions_order on production_submissions(order_id,created_at,id);
create table public.order_review_rounds (
 id uuid primary key default gen_random_uuid(),order_id uuid not null references orders(id),version integer not null check(version>0),
 submitted_by uuid not null references profiles(id),submission_ids uuid[] not null check(cardinality(submission_ids) between 1 and 100),
 note text not null check(length(btrim(note)) between 1 and 3000),status text not null default 'PENDING' check(status in ('PENDING','ACCEPTED','REVISION_REQUESTED')),
 submitted_at timestamptz not null default now(),responded_by uuid references profiles(id),responded_at timestamptz,response_note text,
 unique(order_id,version)
);
create unique index one_pending_review on order_review_rounds(order_id) where status='PENDING';
create unique index one_accepted_review on order_review_rounds(order_id) where status='ACCEPTED';
create function public.is_delivery_reader(actor_id uuid,oid uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from orders o join profiles p on p.id=actor_id and p.active where o.id=oid and
  (p.role='ADMIN' or (p.role='STAFF' and o.assigned_to=p.id and exists(select 1 from requests where id=o.request_id and assigned_to=p.id))
   or (p.role in ('CUSTOMER','BUSINESS') and exists(select 1 from customers where id=o.customer_id and profile_id=p.id))
   or (p.role in ('CREATOR','STUDENT_CREATOR') and is_creator_participant(o.request_id,p.id))))
$$;
revoke all on function is_delivery_reader(uuid,uuid) from public,anon,authenticated;
create function public.delivery_read_access(oid uuid) returns boolean language sql stable security definer set search_path=public as $$
 select is_delivery_reader(id,oid) from profiles where auth_user_id=auth.uid() and active
$$;
revoke all on function delivery_read_access(uuid) from public,anon;
grant execute on function delivery_read_access(uuid) to authenticated,service_role;
alter table production_submissions enable row level security;
alter table order_review_rounds enable row level security;
revoke all on production_submissions,order_review_rounds from anon,authenticated;
grant select on production_submissions,order_review_rounds to authenticated;
grant all on production_submissions,order_review_rounds to service_role;
create policy submission_reader on production_submissions for select to authenticated using(delivery_read_access(order_id));
create policy review_round_reader on order_review_rounds for select to authenticated using(delivery_read_access(order_id));
create function public.guard_delivery_record() returns trigger language plpgsql set search_path=public as $$
declare oid uuid;
begin
 oid:=case when TG_OP='INSERT' then new.order_id else old.order_id end;
 if current_user not in ('postgres','supabase_admin','service_role') or nullif(current_setting('app.delivery_order',true),'')::uuid is distinct from oid then raise exception 'Hồ sơ bàn giao chỉ thay đổi qua workflow.';end if;
 if TG_OP='DELETE' or (TG_TABLE_NAME='production_submissions' and TG_OP='UPDATE') then raise exception 'Giữ nguyên phiên bản sản phẩm/bằng chứng nghiệm thu.';end if;
 if TG_OP='UPDATE' then
  if old.status<>'PENDING' or new.status not in ('ACCEPTED','REVISION_REQUESTED') or
   (to_jsonb(new)-array['status','responded_by','responded_at','response_note']) is distinct from (to_jsonb(old)-array['status','responded_by','responded_at','response_note']) then raise exception 'Không sửa phiên bản nghiệm thu đã gửi hoặc đã phản hồi.';end if;
 end if;
 return new;
end $$;
create trigger submission_guard before insert or update or delete on production_submissions for each row execute function guard_delivery_record();
create trigger review_round_guard before insert or update or delete on order_review_rounds for each row execute function guard_delivery_record();

create function public.order_delivery_action(actor_id uuid,oid uuid,operation text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public as $$
declare u profiles;o orders;r requests;p projects;a creator_assignments;f production_submissions;round order_review_rounds;ids uuid[];
 owner boolean;operator boolean;delivery_note text:=btrim(coalesce(payload->>'note',''));event_name text;event_text text;previous jsonb;receipt_total numeric;
begin
 select * into u from profiles where id=actor_id and active;
 perform pg_advisory_xact_lock(736231934);
 select request_id into r.id from orders where id=oid;
 select * into r from requests where id=r.id for update;
 select * into o from orders where id=oid for update;
 select * into p from projects where order_id=o.id for update;
 if u.id is null or o.id is null or not is_delivery_reader(u.id,o.id) then raise exception 'Không có quyền truy cập hồ sơ bàn giao.';end if;
 owner:=u.role in ('CUSTOMER','BUSINESS') and exists(select 1 from customers where id=o.customer_id and profile_id=u.id);
 operator:=u.role='ADMIN' or (u.role='STAFF' and o.assigned_to=u.id and r.assigned_to=u.id);
 perform set_config('app.actor',u.id::text,true);perform set_config('app.production_order',o.id::text,true);perform set_config('app.delivery_order',o.id::text,true);
 if p.id is null or r.status<>'CONVERTED' or not exists(select 1 from contract_acknowledgments where order_id=o.id) then raise exception 'Chưa có dự án đủ điều kiện bàn giao.';end if;
 previous:=jsonb_build_object('order_status',o.status,'production_status',p.production_status);
 if operation='upload' then
  select * into a from creator_assignments where id=(payload->>'assignment_id')::uuid and request_id=r.id for update;
  if a.id is null or a.status<>'ACCEPTED' or u.role not in ('CREATOR','STUDENT_CREATOR') or not exists(select 1 from creator_profiles where id=a.creator_id and profile_id=u.id) then raise exception 'Creator chỉ gửi sản phẩm của phần việc đã nhận.';end if;
  if payload->'confirmed' is distinct from 'true'::jsonb or length(btrim(coalesce(payload->>'title',''))) not between 1 and 200 or length(delivery_note)>3000
   or (payload->>'size')::bigint not between 1 and 52428800 or length(coalesce(payload->>'file_name','')) not between 1 and 255
   or payload->>'path' !~ ('^'||o.id::text||'/[a-f0-9-]{36}\.(jpg|jpeg|png|webp|pdf|mp4|mov)$')
   or not exists(select 1 from storage.objects where bucket_id='order-deliverables' and name=payload->>'path') then raise exception 'Tệp hoặc xác nhận phiên bản sản phẩm chưa hợp lệ.';end if;
  if payload->>'kind'='REVIEW' then
   if o.status<>'IN_PROGRESS' or p.production_status not in ('IN_PROGRESS','REVISION') or exists(select 1 from order_review_rounds where order_id=o.id and status in ('PENDING','ACCEPTED')) or payload->>'final_of' is not null then raise exception 'Bản nghiệm thu chỉ gửi khi đang sản xuất/chỉnh sửa và chưa có vòng nghiệm thu đang mở.';end if;
   event_name:='PRODUCTION_REVIEW_UPLOADED';event_text:='Creator đã gửi bản nghiệm thu có watermark: '||btrim(payload->>'title')||'.';
  elsif payload->>'kind'='FINAL' then
   select * into round from order_review_rounds where order_id=o.id and status='ACCEPTED';
   select * into f from production_submissions where id=(payload->>'final_of')::uuid and order_id=o.id and assignment_id=a.id and kind='REVIEW';
   select coalesce(sum(amount),0) into receipt_total from order_payment_receipts where order_id=o.id;
   if o.status<>'WAITING_ACCEPTANCE' or p.production_status<>'READY_TO_DELIVER' or round.id is null or f.id is null or not(f.id=any(round.submission_ids)) or receipt_total<>o.total
    or not exists(select 1 from order_final_funds_confirmations where order_id=o.id and amount=o.total) then raise exception 'Cần khách nghiệm thu và người phụ trách xác nhận thu đủ trước khi gửi bản không watermark.';end if;
   if exists(select 1 from production_submissions where final_of=f.id) then raise exception 'Bản hoàn thiện cho phiên bản này đã bàn giao; giữ nguyên lịch sử.';end if;
   event_name:='PRODUCTION_FINAL_UPLOADED';event_text:='Creator đã bàn giao bản hoàn thiện không watermark: '||btrim(payload->>'title')||'.';
  else raise exception 'Loại bản bàn giao chưa hợp lệ.';end if;
  insert into production_submissions(order_id,assignment_id,author_id,kind,title,note,file_name,storage_path,file_type,file_size,final_of)
  values(o.id,a.id,u.id,payload->>'kind',btrim(payload->>'title'),delivery_note,payload->>'file_name',payload->>'path',payload->>'type',(payload->>'size')::bigint,(payload->>'final_of')::uuid) returning * into f;
 elsif operation='send_review' then
  if not operator or o.status<>'IN_PROGRESS' or p.production_status not in ('IN_PROGRESS','REVISION') or length(delivery_note) not between 1 and 3000 then raise exception 'Người phụ trách gửi nghiệm thu từ dự án đang thực hiện, kèm nội dung bàn giao.';end if;
  if exists(select 1 from order_review_rounds where order_id=o.id and status in ('PENDING','ACCEPTED')) then raise exception 'Đã có vòng nghiệm thu đang mở/được chấp nhận.';end if;
  select array_agg(value::uuid order by value) into ids from jsonb_array_elements_text(payload->'submission_ids');
  if coalesce(cardinality(ids),0) not between 1 and 100 or cardinality(ids)<>(select count(distinct v) from unnest(ids) v) or
   (select count(*) from production_submissions where order_id=o.id and kind='REVIEW' and id=any(ids))<>cardinality(ids) then raise exception 'Chọn đúng phiên bản nghiệm thu của dự án, không lặp tệp.';end if;
  if not exists(select 1 from creator_assignments where request_id=r.id and status='ACCEPTED') or
   exists(select 1 from creator_assignments booking where booking.request_id=r.id and booking.status='ACCEPTED' and not exists(select 1 from production_submissions submitted where submitted.assignment_id=booking.id and submitted.id=any(ids)))
   or exists(select 1 from production_submissions submitted join creator_assignments booking on booking.id=submitted.assignment_id where submitted.id=any(ids) and booking.status<>'ACCEPTED') then raise exception 'Cần sản phẩm nghiệm thu của toàn bộ đội Creator đã chốt.';end if;
  if not exists(select 1 from project_milestones where project_id=p.id) or exists(select 1 from project_milestones where project_id=p.id and status<>'COMPLETED') then raise exception 'Hoàn thành các mốc sản xuất trước khi gửi nghiệm thu.';end if;
  insert into order_review_rounds(order_id,version,submitted_by,submission_ids,note) select o.id,coalesce(max(version),0)+1,u.id,ids,delivery_note from order_review_rounds where order_id=o.id returning * into round;
  update projects set production_status='WAITING_REVIEW' where id=p.id returning * into p;
  event_name:='PRODUCTION_REVIEW_SENT';event_text:='MediaHub đã gửi vòng nghiệm thu '||round.version||'. Nội dung: '||delivery_note;
 elsif operation in ('accept_review','request_revision') then
  if not owner then raise exception 'Chỉ khách hàng của đơn phản hồi nghiệm thu.';end if;
  select * into round from order_review_rounds where id=(payload->>'round_id')::uuid and order_id=o.id for update;
  if round.id is null then raise exception 'Không tìm thấy vòng nghiệm thu của đơn.';end if;
  if round.status=(case operation when 'accept_review' then 'ACCEPTED' else 'REVISION_REQUESTED' end) and round.responded_by=u.id then return jsonb_build_object('order_id',o.id,'round_id',round.id,'reused',true);end if;
  if o.status<>'IN_PROGRESS' or p.production_status<>'WAITING_REVIEW' or round.status<>'PENDING' then raise exception 'Vòng nghiệm thu không còn chờ phản hồi.';end if;
  if operation='accept_review' and payload->'confirmed' is distinct from 'true'::jsonb or operation='request_revision' and length(delivery_note) not between 1 and 3000 then raise exception 'Cần xác nhận kết quả hoặc ghi rõ nội dung chỉnh sửa.';end if;
  update order_review_rounds set status=case operation when 'accept_review' then 'ACCEPTED' else 'REVISION_REQUESTED' end,responded_by=u.id,responded_at=now(),response_note=delivery_note where id=round.id returning * into round;
  update projects set production_status=case operation when 'accept_review' then 'READY_TO_DELIVER' else 'REVISION' end where id=p.id returning * into p;
  if operation='accept_review' then update orders set status='WAITING_ACCEPTANCE' where id=o.id returning * into o;end if;
  event_name:=case operation when 'accept_review' then 'PRODUCTION_REVIEW_ACCEPTED' else 'PRODUCTION_REVISION_REQUESTED' end;
  event_text:=case operation when 'accept_review' then 'Khách hàng đã nghiệm thu kết quả. Bản không watermark được bàn giao sau khi người phụ trách xác nhận thu đủ.' else 'Khách hàng yêu cầu chỉnh sửa: '||delivery_note end;
 else raise exception 'Thao tác bàn giao chưa được hỗ trợ.';end if;
 perform record_request_event(u.id,r.id,event_name,event_text,jsonb_build_object('order_id',o.id,'project_id',p.id,'submission_id',f.id,'round_id',round.id),previous,jsonb_build_object('order_status',o.status,'production_status',p.production_status),nullif(delivery_note,''));
 if operation='upload' and f.kind='FINAL' and not exists(select 1 from unnest(round.submission_ids) review_id where not exists(select 1 from production_submissions where final_of=review_id and kind='FINAL')) then
  update projects set production_status='COMPLETED' where id=p.id;
  update orders set status='COMPLETED' where id=o.id;
  update creator_assignments set status='COMPLETED' where request_id=r.id and status='ACCEPTED';
  insert into project_status_history(project_id,status,note,created_by) values(p.id,'COMPLETED','Đã nghiệm thu, người phụ trách xác nhận thu đủ và toàn bộ bản không watermark đã bàn giao.',u.id);
  perform record_request_event(u.id,r.id,'PRODUCTION_COMPLETED','Dự án đã hoàn thành: nghiệm thu, thu đủ và bàn giao toàn bộ bản không watermark. Đội Creator đã kết thúc phân công.',jsonb_build_object('order_id',o.id,'project_id',p.id),previous,jsonb_build_object('order_status','COMPLETED','production_status','COMPLETED'));
 else
  if operation<>'upload' then insert into project_status_history(project_id,status,note,created_by) values(p.id,p.production_status,event_text,u.id);end if;
 end if;
 return jsonb_build_object('order_id',o.id,'submission_id',f.id,'round_id',round.id);
end $$;
revoke all on function order_delivery_action(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function order_delivery_action(uuid,uuid,text,jsonb) to service_role;
commit;
