begin;

-- Remove only deterministic, unchanged rows written by the local demo seed.
-- Test accounts and modern order/request history are outside this cleanup.
lock table public.projects,
  public.project_status_history,
  public.conversations,
  public.conversation_members,
  public.conversation_messages,
  public.reviews,
  public.testimonials,
  public.notifications,
  public.deliverables,
  public.invoices,
  public.leads,
  public.payment_plans,
  public.project_files,
  public.project_messages,
  public.project_milestones,
  public.project_services,
  public.project_team_members,
  public.quotations,
  public.revision_requests
in share row exclusive mode;

create temporary table mediahub_cleanup_demo_projects (
  seed_index integer primary key,
  id uuid not null unique,
  title text not null,
  description text not null,
  category text not null,
  budget numeric not null,
  status text not null,
  progress integer not null,
  scope text not null
) on commit drop;

insert into mediahub_cleanup_demo_projects
select i,
  (lpad(to_hex(5000 + i), 8, '0') || '-1000-4000-8000-000000000001')::uuid,
  (array[
    'TVC ra mắt sản phẩm',
    'Chiến dịch TikTok',
    'Bộ ảnh thương hiệu',
    'Landing page sự kiện'
  ])[i % 4 + 1] || ' ' || (i + 1)::text,
  case when i % 6 = 0 then
    'Dự án có phần mô tả dài để kiểm thử hiển thị thực tế, quy trình phê duyệt, trao đổi giữa doanh nghiệp và creator cũng như nhiều mốc bàn giao liên tiếp.'
  else
    'Dự án truyền thông thực tế dành cho thương hiệu Việt.'
  end,
  (array[
    'Thiết kế sáng tạo', 'Video & TVC', 'Marketing & Truyền thông số',
    'Content & PR', 'Web & Landing Page', 'Livestream & Sự kiện',
    'Photography', 'Social Content', 'Motion Graphics', 'Branding'
  ])[i % 10 + 1],
  8000000 + i * 1750000,
  (array[
    'DRAFT', 'SUBMITTED', 'REVIEWING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'
  ])[i % 6 + 1],
  (array[0, 10, 25, 65, 100, 0])[i % 6 + 1],
  'Concept, tiền kỳ, sản xuất, hậu kỳ và nghiệm thu.'
from generate_series(0, 23) as series(i);

create temporary table mediahub_cleanup_demo_conversations (
  seed_index integer primary key,
  id uuid not null unique,
  project_id uuid not null,
  subject text not null
) on commit drop;

insert into mediahub_cleanup_demo_conversations
select i,
  (lpad(to_hex(9000 + i), 8, '0') || '-1000-4000-8000-000000000001')::uuid,
  (lpad(to_hex(5000 + i), 8, '0') || '-1000-4000-8000-000000000001')::uuid,
  'Trao đổi dự án ' || (i + 1)::text
from generate_series(0, 11) as series(i);

create temporary table mediahub_cleanup_demo_reviews (
  id uuid primary key,
  project_id uuid not null
) on commit drop;

insert into mediahub_cleanup_demo_reviews
select
  (lpad(to_hex(6500 + i), 8, '0') || '-1000-4000-8000-000000000001')::uuid,
  (lpad(to_hex(5004 + i), 8, '0') || '-1000-4000-8000-000000000001')::uuid
from generate_series(0, 18, 6) as series(i);

create temporary table mediahub_cleanup_demo_messages (
  id uuid primary key,
  conversation_id uuid not null,
  content text not null
) on commit drop;

insert into mediahub_cleanup_demo_messages
select
  (lpad(to_hex(10000 + i), 8, '0') || '-1000-4000-8000-000000000001')::uuid,
  (lpad(to_hex(9000 + i / 4), 8, '0') || '-1000-4000-8000-000000000001')::uuid,
  (array[
    'MediaHub đã nhận brief và đang rà soát yêu cầu.',
    'Mình gửi thêm tài liệu tham khảo cho đội ngũ.',
    'Bản preview mới đã sẵn sàng để nhận phản hồi.',
    'Đã xác nhận, vui lòng tiếp tục mốc tiếp theo.'
  ])[i % 4 + 1]
from generate_series(0, 47) as series(i);

create temporary table mediahub_cleanup_demo_notifications (
  id uuid primary key,
  seed_index integer not null,
  title text not null,
  message text not null,
  type text not null
) on commit drop;

insert into mediahub_cleanup_demo_notifications
select
  (lpad(to_hex(8000 + i), 8, '0') || '-1000-4000-8000-000000000001')::uuid,
  i,
  (array[
    'Có ứng tuyển mới', 'Dự án được duyệt', 'Tin nhắn mới',
    'Thanh toán thành công', 'Đánh giá mới'
  ])[i % 5 + 1],
  'Thông báo demo số ' || (i + 1)::text ||
    ' với nội dung thực tế để kiểm tra trạng thái đã đọc và chưa đọc.',
  (array[
    'PROJECT_APPLICATION', 'PROJECT_APPROVED', 'MESSAGE', 'PAYMENT', 'REVIEW'
  ])[i % 5 + 1]
from generate_series(0, 29) as series(i);

do $$
declare
  project_ids uuid[];
  conversation_ids uuid[];
  review_ids uuid[];
  project_count integer;
  exact_projects integer;
  history_count integer;
  review_count integer;
  exact_reviews integer;
  testimonial_count integer;
  exact_testimonials integer;
  conversation_count integer;
  exact_conversations integer;
  conversation_message_count integer;
  seeded_message_count integer;
  exact_messages integer;
  notification_count integer;
  exact_notifications integer;
  child record;
  child_count integer;
begin
  select coalesce(array_agg(id), '{}'::uuid[])
  into project_ids from mediahub_cleanup_demo_projects;
  select coalesce(array_agg(id), '{}'::uuid[])
  into conversation_ids from mediahub_cleanup_demo_conversations;
  select coalesce(array_agg(id), '{}'::uuid[])
  into review_ids from mediahub_cleanup_demo_reviews;

  select count(*) into project_count
  from public.projects project
  join mediahub_cleanup_demo_projects seed on seed.id = project.id;

  select count(*) into exact_projects
  from public.projects project
  join mediahub_cleanup_demo_projects seed on seed.id = project.id
  where project.title = seed.title
    and project.description = seed.description
    and project.category = seed.category
    and project.budget = seed.budget
    and project.status = seed.status
    and project.progress = seed.progress
    and project.scope = seed.scope;

  if project_count <> exact_projects then
    raise exception 'Refusing to remove seeded project IDs whose content or workflow state changed';
  end if;

  select count(*) into history_count
  from public.project_status_history
  where project_id = any(project_ids);
  if history_count <> project_count then
    raise exception 'Refusing to remove demo projects with additional or missing status history';
  end if;

  -- Do not remove any legacy project that acquired another workflow child.
  for child in
    select kcu.table_name, kcu.column_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_catalog = kcu.constraint_catalog
      and tc.constraint_schema = kcu.constraint_schema
      and tc.constraint_name = kcu.constraint_name
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_catalog = tc.constraint_catalog
      and ccu.constraint_schema = tc.constraint_schema
      and ccu.constraint_name = tc.constraint_name
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.constraint_schema = 'public'
      and ccu.table_name = 'projects'
      and kcu.table_name not in (
        'project_status_history', 'conversations', 'reviews'
      )
  loop
    execute format(
      'select count(*) from public.%I where %I = any($1)',
      child.table_name, child.column_name
    ) into child_count using project_ids;
    if child_count > 0 then
      raise exception 'Refusing to remove demo projects with rows in %.%',
        child.table_name, child.column_name;
    end if;
  end loop;

  select count(*) into conversation_count
  from public.conversations conversation
  join mediahub_cleanup_demo_conversations seed on seed.id = conversation.id;
  select count(*) into exact_conversations
  from public.conversations conversation
  join mediahub_cleanup_demo_conversations seed on seed.id = conversation.id
  where conversation.project_id = seed.project_id
    and conversation.subject = seed.subject;
  if conversation_count <> exact_conversations then
    raise exception 'Refusing to remove changed or repurposed demo conversations';
  end if;

  select count(*) into conversation_message_count
  from public.conversation_messages message
  join mediahub_cleanup_demo_conversations seed
    on seed.id = message.conversation_id;
  select count(*) into seeded_message_count
  from public.conversation_messages message
  join mediahub_cleanup_demo_messages seed on seed.id = message.id;
  select count(*) into exact_messages
  from public.conversation_messages message
  join mediahub_cleanup_demo_messages seed on seed.id = message.id
  where message.conversation_id = seed.conversation_id
    and message.content = seed.content;
  if conversation_message_count <> seeded_message_count
    or seeded_message_count <> exact_messages then
    raise exception 'Refusing to remove demo conversations with changed or additional messages';
  end if;

  for child in
    select kcu.table_name, kcu.column_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_catalog = kcu.constraint_catalog
      and tc.constraint_schema = kcu.constraint_schema
      and tc.constraint_name = kcu.constraint_name
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_catalog = tc.constraint_catalog
      and ccu.constraint_schema = tc.constraint_schema
      and ccu.constraint_name = tc.constraint_name
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.constraint_schema = 'public'
      and ccu.table_name = 'conversations'
      and kcu.table_name not in ('conversation_members', 'conversation_messages')
  loop
    execute format(
      'select count(*) from public.%I where %I = any($1)',
      child.table_name, child.column_name
    ) into child_count using conversation_ids;
    if child_count > 0 then
      raise exception 'Refusing to remove demo conversations with rows in %.%',
        child.table_name, child.column_name;
    end if;
  end loop;

  select count(*) into review_count
  from public.reviews review
  join mediahub_cleanup_demo_reviews seed on seed.id = review.id;
  select count(*) into exact_reviews
  from public.reviews review
  join mediahub_cleanup_demo_reviews seed on seed.id = review.id
  where review.project_id = seed.project_id
    and review.rating = 5
    and review.quality_rating = 5
    and review.communication_rating = 5
    and review.value_rating = 5
    and review.comment =
      'MediaHub làm việc chuyên nghiệp, quy trình rõ ràng và chất lượng đầu ra vượt mong đợi.';
  if review_count <> exact_reviews then
    raise exception 'Refusing to remove changed or repurposed demo reviews';
  end if;

  select count(*) into testimonial_count
  from public.testimonials testimonial
  join mediahub_cleanup_demo_reviews seed
    on seed.id = testimonial.review_id;
  select count(*) into exact_testimonials
  from public.testimonials testimonial
  join mediahub_cleanup_demo_reviews seed
    on seed.id = testimonial.review_id
  where testimonial.status = 'APPROVED'
    and testimonial.content =
      'MediaHub giúp chúng tôi biến brief thành chiến dịch hoàn chỉnh rất nhanh. Đội ngũ trẻ, sáng tạo nhưng quy trình làm việc chặt chẽ, minh bạch và luôn đảm bảo chất lượng.';
  if testimonial_count <> exact_testimonials then
    raise exception 'Refusing to remove changed or repurposed demo testimonials';
  end if;

  for child in
    select kcu.table_name, kcu.column_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_catalog = kcu.constraint_catalog
      and tc.constraint_schema = kcu.constraint_schema
      and tc.constraint_name = kcu.constraint_name
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_catalog = tc.constraint_catalog
      and ccu.constraint_schema = tc.constraint_schema
      and ccu.constraint_name = tc.constraint_name
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.constraint_schema = 'public'
      and ccu.table_name = 'reviews'
      and kcu.table_name <> 'testimonials'
  loop
    execute format(
      'select count(*) from public.%I where %I = any($1)',
      child.table_name, child.column_name
    ) into child_count using review_ids;
    if child_count > 0 then
      raise exception 'Refusing to remove demo reviews with rows in %.%',
        child.table_name, child.column_name;
    end if;
  end loop;

  select count(*) into notification_count
  from public.notifications notification
  join mediahub_cleanup_demo_notifications seed on seed.id = notification.id;
  select count(*) into exact_notifications
  from public.notifications notification
  join mediahub_cleanup_demo_notifications seed on seed.id = notification.id
  where notification.title = seed.title
    and notification.message = seed.message
    and notification.type = seed.type;
  if notification_count <> exact_notifications then
    raise exception 'Refusing to remove changed or repurposed demo notifications';
  end if;
end;
$$;

delete from public.notifications notification
using mediahub_cleanup_demo_notifications seed
where notification.id = seed.id;

delete from public.testimonials testimonial
using mediahub_cleanup_demo_reviews seed
where testimonial.review_id = seed.id;

delete from public.reviews review
using mediahub_cleanup_demo_reviews seed
where review.id = seed.id;

delete from public.conversation_messages message
using mediahub_cleanup_demo_conversations seed
where message.conversation_id = seed.id;

delete from public.conversation_members member
using mediahub_cleanup_demo_conversations seed
where member.conversation_id = seed.id;

delete from public.conversations conversation
using mediahub_cleanup_demo_conversations seed
where conversation.id = seed.id;

delete from public.project_status_history history
using mediahub_cleanup_demo_projects seed
where history.project_id = seed.id;

delete from public.projects project
using mediahub_cleanup_demo_projects seed
where project.id = seed.id;

commit;
