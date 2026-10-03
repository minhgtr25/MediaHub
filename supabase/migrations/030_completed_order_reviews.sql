begin;
-- Keep customer identities and private order links out of the legacy public reviews table.
create table public.order_publication_preferences (
 order_id uuid primary key references orders(id), customer_profile_id uuid not null references profiles(id),
 show_name boolean not null default false, notice_version text not null default 'EXCERPT_V1' check(notice_version='EXCERPT_V1'),
 recorded_at timestamptz not null default clock_timestamp()
);
create table public.order_result_reviews (
 order_id uuid primary key references orders(id), customer_profile_id uuid not null references profiles(id),
 rating integer not null check(rating between 1 and 5), content text not null check(length(btrim(content)) between 1 and 3000),
 submitted_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp()
);
create table public.order_creator_reviews (
 order_id uuid not null references order_result_reviews(order_id), creator_id uuid not null references creator_profiles(id),
 rating integer not null check(rating between 1 and 5), content text not null check(length(btrim(content)) between 1 and 2000),
 primary key(order_id,creator_id)
);
create index order_creator_reviews_creator on order_creator_reviews(creator_id);
create table public.order_case_studies (
 order_id uuid primary key references orders(id), title text not null check(length(btrim(title)) between 1 and 150),
 excerpt text not null check(length(btrim(excerpt)) between 1 and 1000), image_path text not null,
 published boolean not null default false, approved_by uuid not null references profiles(id), updated_at timestamptz not null default clock_timestamp()
);
create table public.case_study_assets (
 path text primary key, order_id uuid not null references orders(id), uploaded_by uuid not null references profiles(id),
 created_at timestamptz not null default clock_timestamp()
);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('case-study-excerpts','case-study-excerpts',false,5242880,array['image/jpeg','image/png','image/webp']);
-- No browser storage policy. Drafts remain private; only published excerpts receive expiring URLs.
alter table order_publication_preferences enable row level security;
alter table order_result_reviews enable row level security;
alter table order_creator_reviews enable row level security;
alter table order_case_studies enable row level security;
alter table case_study_assets enable row level security;
revoke all on order_publication_preferences,order_result_reviews,order_creator_reviews,order_case_studies,case_study_assets from anon,authenticated;
grant all on order_publication_preferences,order_result_reviews,order_creator_reviews,order_case_studies,case_study_assets to service_role;

create function public.completed_delivery_eligible(oid uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from orders o join projects p on p.order_id=o.id join order_review_rounds rr on rr.order_id=o.id and rr.status='ACCEPTED'
  join order_final_funds_confirmations fc on fc.order_id=o.id and fc.amount=o.total
  where o.id=oid and o.status='COMPLETED' and p.production_status='COMPLETED'
  and (select coalesce(sum(amount),0) from order_payment_receipts where order_id=o.id)=o.total
  and not exists(select 1 from unnest(rr.submission_ids) sid where not exists(select 1 from production_submissions where final_of=sid and order_id=o.id and kind='FINAL')))
$$;
revoke all on function completed_delivery_eligible(uuid) from public,anon,authenticated;
grant execute on function completed_delivery_eligible(uuid) to service_role;

create function public.guard_order_feedback() returns trigger language plpgsql set search_path=public as $$
declare target uuid;
begin
 target:=case when TG_OP='DELETE' then old.order_id else new.order_id end;
 if current_user not in ('postgres','supabase_admin','service_role') or nullif(current_setting('app.feedback_order',true),'')::uuid is distinct from target then raise exception 'Đánh giá và công khai dự án chỉ thay đổi qua workflow.';end if;
 if TG_OP='DELETE' then raise exception 'Giữ lịch sử đánh giá và công khai dự án.';end if;
 if TG_OP='UPDATE' then
  if new.order_id is distinct from old.order_id then raise exception 'Không đổi đơn của hồ sơ đánh giá.';end if;
  if TG_TABLE_NAME='order_result_reviews' then
   if new.submitted_at is distinct from old.submitted_at or new.customer_profile_id is distinct from old.customer_profile_id then raise exception 'Không đổi tác giả hoặc thời điểm đánh giá đầu tiên.';end if;
  end if;
 end if;
 return new;
end $$;
create trigger publication_preference_guard before insert or update or delete on order_publication_preferences for each row execute function guard_order_feedback();
create trigger result_feedback_guard before insert or update or delete on order_result_reviews for each row execute function guard_order_feedback();
create trigger creator_feedback_guard before insert or update or delete on order_creator_reviews for each row execute function guard_order_feedback();
create trigger case_study_guard before insert or update or delete on order_case_studies for each row execute function guard_order_feedback();
create trigger case_asset_guard before insert or update or delete on case_study_assets for each row execute function guard_order_feedback();

create function public.order_feedback_action(actor_id uuid,oid uuid,operation text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public as $$
declare u profiles;o orders;r requests;review order_result_reviews;pref order_publication_preferences;entry jsonb;expected uuid[];actual uuid[];prior jsonb;v_show boolean;event_name text;
begin
 select * into u from profiles where id=actor_id and active;
 -- Same order lock order as delivery: request before order, preventing interleaved completion/review.
 select request_id into r.id from orders where id=oid;
 select * into r from requests where id=r.id for update;
 select * into o from orders where id=oid for update;
 if u.id is null or o.id is null then raise exception 'Không tìm thấy đơn dịch vụ.';end if;
 perform set_config('app.feedback_order',o.id::text,true);perform set_config('app.actor',u.id::text,true);
 if operation in ('preference','review') then
  if u.role not in ('CUSTOMER','BUSINESS') or not exists(select 1 from customers where id=o.customer_id and profile_id=u.id) then raise exception 'Chỉ khách hàng của đơn gửi đánh giá và lựa chọn hiển thị tên.';end if;
  if o.status in ('CANCELLED','REFUNDED') or jsonb_typeof(payload->'show_name') is distinct from 'boolean' or payload->>'notice_version' is distinct from 'EXCERPT_V1' then raise exception 'Cần chọn hiện tên hoặc ẩn danh và ghi nhận quy định trích đoạn.';end if;
  if operation='review' then
   if not completed_delivery_eligible(o.id) then raise exception 'Chỉ đánh giá sau nghiệm thu, thu đủ và bàn giao toàn bộ bản hoàn thiện.';end if;
   select * into review from order_result_reviews where order_id=o.id;
   if review.order_id is not null and clock_timestamp()>review.submitted_at+interval '7 days' then raise exception 'Đã hết 7 ngày sửa đánh giá kể từ lần gửi đầu tiên.';end if;
   if coalesce(payload->>'rating','') !~ '^[1-5]$' or length(btrim(coalesce(payload->>'content',''))) not between 1 and 3000 or jsonb_typeof(payload->'creators') is distinct from 'array' then raise exception 'Cần số sao, nhận xét kết quả và đánh giá đội Creator.';end if;
   select array_agg(distinct ca.creator_id order by ca.creator_id) into expected from creator_assignments ca where ca.request_id=r.id and ca.status='COMPLETED'
    and exists(select 1 from production_submissions ps where ps.assignment_id=ca.id and ps.order_id=o.id and ps.kind='FINAL');
   select array_agg((v->>'creator_id')::uuid order by (v->>'creator_id')::uuid) into actual from jsonb_array_elements(payload->'creators') v;
   if expected is null or actual is distinct from expected then raise exception 'Đánh giá từng Creator đã bàn giao đúng dự án, không thiếu hoặc lặp người.';end if;
   for entry in select value from jsonb_array_elements(payload->'creators') loop
    if coalesce(entry->>'rating','') !~ '^[1-5]$' or length(btrim(coalesce(entry->>'content',''))) not between 1 and 2000 then raise exception 'Mỗi Creator cần số sao từ 1 đến 5 và nhận xét.';end if;
   end loop;
   prior:=to_jsonb(review);
   insert into order_result_reviews(order_id,customer_profile_id,rating,content) values(o.id,u.id,(payload->>'rating')::integer,btrim(payload->>'content'))
    on conflict(order_id) do update set rating=excluded.rating,content=excluded.content,updated_at=clock_timestamp();
   for entry in select value from jsonb_array_elements(payload->'creators') loop
    insert into order_creator_reviews(order_id,creator_id,rating,content) values(o.id,(entry->>'creator_id')::uuid,(entry->>'rating')::integer,btrim(entry->>'content'))
     on conflict(order_id,creator_id) do update set rating=excluded.rating,content=excluded.content;
   end loop;
  end if;
  select * into pref from order_publication_preferences where order_id=o.id;
  v_show:=(payload->>'show_name')::boolean;
  insert into order_publication_preferences(order_id,customer_profile_id,show_name) values(o.id,u.id,v_show)
   on conflict(order_id) do update set show_name=excluded.show_name,recorded_at=clock_timestamp();
  -- Changing privacy withdraws the old presentation for a fresh Admin identity check.
  if pref.order_id is not null and pref.show_name is distinct from v_show then update order_case_studies set published=false,updated_at=clock_timestamp() where order_id=o.id;end if;
  event_name:=case operation when 'review' then 'ORDER_CUSTOMER_REVIEW' else 'ORDER_PUBLICATION_PREFERENCE' end;
 elsif operation='asset' then
  if u.role<>'ADMIN' or not completed_delivery_eligible(o.id) or payload->>'path' !~ ('^'||o.id::text||'/[a-f0-9-]{36}\.(jpg|jpeg|png|webp)$') or not exists(select 1 from storage.objects where bucket_id='case-study-excerpts' and name=payload->>'path') then raise exception 'Admin chỉ chuẩn bị ảnh trích đoạn của dự án đã hoàn thành.';end if;
  insert into case_study_assets(path,order_id,uploaded_by) values(payload->>'path',o.id,u.id);
  event_name:='CASE_STUDY_EXCERPT_PREPARED';
 elsif operation='publish' then
  if u.role<>'ADMIN' or not completed_delivery_eligible(o.id) or not exists(select 1 from order_publication_preferences where order_id=o.id)
   or payload->'excerpt_checked' is distinct from 'true'::jsonb or payload->'identity_checked' is distinct from 'true'::jsonb
   or length(btrim(coalesce(payload->>'title',''))) not between 1 and 150 or length(btrim(coalesce(payload->>'excerpt',''))) not between 1 and 1000
   or not exists(select 1 from case_study_assets where order_id=o.id and path=payload->>'image_path') then raise exception 'Admin duyệt dự án đã hoàn thành, ảnh trích đoạn, giới hạn nội dung và đúng lựa chọn tên/ẩn danh.';end if;
  select to_jsonb(cs) into prior from order_case_studies cs where order_id=o.id;
  insert into order_case_studies(order_id,title,excerpt,image_path,published,approved_by) values(o.id,btrim(payload->>'title'),btrim(payload->>'excerpt'),payload->>'image_path',true,u.id)
   on conflict(order_id) do update set title=excluded.title,excerpt=excluded.excerpt,image_path=excluded.image_path,published=true,approved_by=u.id,updated_at=clock_timestamp();
  event_name:='CASE_STUDY_PUBLISHED';
 elsif operation='withdraw' then
  if u.role<>'ADMIN' then raise exception 'Chỉ Admin gỡ công khai dự án.';end if;
  select to_jsonb(cs) into prior from order_case_studies cs where order_id=o.id;
  update order_case_studies set published=false,approved_by=u.id,updated_at=clock_timestamp() where order_id=o.id;
  event_name:='CASE_STUDY_WITHDRAWN';
 else raise exception 'Thao tác đánh giá chưa được hỗ trợ.';end if;
 -- Preserve full review revisions privately in audit history; chat carries only a generic event.
 insert into audit_logs(actor_id,action,entity,entity_id,old_value,new_value) values(u.id,event_name,'order_feedback',o.id,prior,payload);
 perform record_request_event(u.id,r.id,event_name,case operation when 'review' then 'Khách hàng đã cập nhật đánh giá kết quả và đội Creator.' when 'publish' then 'Admin đã duyệt trích đoạn dự án tiêu biểu.' when 'withdraw' then 'Admin đã gỡ công khai trích đoạn dự án.' else 'Đã cập nhật thông tin hiển thị dự án.' end,jsonb_build_object('order_id',o.id),null,null);
 return jsonb_build_object('order_id',o.id,'operation',operation);
end $$;
revoke all on function order_feedback_action(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function order_feedback_action(uuid,uuid,text,jsonb) to service_role;

-- Aggregate in SQL, with stable top-level paging. Public responses never include
-- customer/order IDs, and ratings are not truncated by the REST row limit.
create function public.public_completed_creator_reviews(creator_slug text,review_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare cid uuid;items jsonb;total integer;score numeric;
begin
 if review_page<1 then raise exception 'Trang chưa hợp lệ.';end if;
 select id into cid from creator_profiles where slug=creator_slug;
 if cid is null then return null;end if;
 select count(*),round(avg(cr.rating),1) into total,score from order_creator_reviews cr where cr.creator_id=cid;
 select coalesce(jsonb_agg(to_jsonb(projected)-'order_sort_id' order by submitted_at desc,order_sort_id),'[]') into items from (
  select cr.rating,cr.content,rr.submitted_at,rr.updated_at,cr.order_id as order_sort_id,
   case when pref.show_name then coalesce(nullif(p.full_name,''),'Khách hàng') else 'Khách hàng ẩn danh' end as customer_name
  from order_creator_reviews cr join order_result_reviews rr on rr.order_id=cr.order_id
   left join order_publication_preferences pref on pref.order_id=cr.order_id left join profiles p on p.id=pref.customer_profile_id
  where cr.creator_id=cid order by rr.submitted_at desc,cr.order_id offset ((review_page::bigint-1)*10) limit 10
 ) projected;
 return jsonb_build_object('items',items,'total',total,'rating',score,'page',review_page,'limit',10);
end $$;
revoke all on function public_completed_creator_reviews(text,integer) from public,anon,authenticated;
grant execute on function public_completed_creator_reviews(text,integer) to service_role;

create function public.public_completed_case_studies(case_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare items jsonb;total integer;
begin
 if case_page<1 then raise exception 'Trang chưa hợp lệ.';end if;
 select count(*) into total from order_case_studies cs where cs.published and completed_delivery_eligible(cs.order_id);
 select coalesce(jsonb_agg(to_jsonb(projected)-'order_sort_id' order by updated_at desc,order_sort_id),'[]') into items from (
  select cs.title,cs.excerpt,cs.image_path,cs.updated_at,cs.order_id as order_sort_id,
   case when pref.show_name then coalesce(nullif(p.full_name,''),'Khách hàng') else 'Khách hàng ẩn danh' end as customer_name
  from order_case_studies cs join order_publication_preferences pref on pref.order_id=cs.order_id left join profiles p on p.id=pref.customer_profile_id
  where cs.published and completed_delivery_eligible(cs.order_id) order by cs.updated_at desc,cs.order_id offset ((case_page::bigint-1)*6) limit 6
 ) projected;
 return jsonb_build_object('items',items,'total',total,'page',case_page,'limit',6);
end $$;
revoke all on function public_completed_case_studies(integer) from public,anon,authenticated;
grant execute on function public_completed_case_studies(integer) to service_role;
commit;
