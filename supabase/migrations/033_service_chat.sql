begin;
alter table conversation_messages add column reply_to_id uuid references conversation_messages(id);
alter table conversation_messages add column client_message_id uuid;
create unique index service_chat_retry_key on conversation_messages(conversation_id,sender_id,client_message_id) where client_message_id is not null;
create table service_chat_files(
 message_id uuid primary key references conversation_messages(id),request_id uuid not null references requests(id),
 uploaded_by uuid not null references profiles(id),file_name text not null check(length(file_name) between 1 and 255),
 file_type text not null check(file_type in ('image/jpeg','image/png','image/webp','application/pdf','video/mp4','video/quicktime')),
 file_size bigint not null check(file_size between 1 and 52428800),storage_path text not null unique,
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$')
);
alter table service_chat_files enable row level security;
revoke all on service_chat_files from public,anon,authenticated;
grant all on service_chat_files to service_role;

create function service_chat_scope(actor_id uuid,rid uuid) returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('id',r.id,'conversation_id',conv.id,'title',r.title,'status',r.status,
  'creator',u.role in ('CREATOR','STUDENT_CREATOR'),'closed',r.status='CANCELLED' or (r.status='CONVERTED' and not exists(select 1 from orders where request_id=r.id and status not in ('COMPLETED','CANCELLED','REFUNDED'))))
 from requests r join conversations conv on conv.request_id=r.id join profiles u on u.id=actor_id and u.active
 where r.id=rid and (u.role='ADMIN' or (u.role='STAFF' and r.assigned_to=u.id)
  or (u.role in ('CUSTOMER','BUSINESS') and exists(select 1 from customers where id=r.customer_id and profile_id=u.id))
  or (u.role in ('CREATOR','STUDENT_CREATOR') and is_creator_participant(r.id,u.id)))
$$;

create function service_chat_participants(actor_id uuid,rid uuid) returns jsonb language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'last_read_at',cm.last_read_at)),'[]'::jsonb)
 from requests r join conversations c on c.request_id=r.id join conversation_members cm on cm.conversation_id=c.id
 join profiles p on p.id=cm.profile_id and p.active
 where r.id=rid and service_chat_scope(actor_id,rid) is not null
  and (p.role='ADMIN' or (p.role='STAFF' and p.id=r.assigned_to)
   or (p.role in ('CUSTOMER','BUSINESS') and exists(select 1 from customers where id=r.customer_id and profile_id=p.id))
   or (p.role in ('CREATOR','STUDENT_CREATOR') and is_creator_participant(r.id,p.id)))
$$;

create function service_chat_conversations(actor_id uuid,chat_page integer default 1,chat_search text default '') returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare output jsonb;
begin
 if chat_page is null or chat_page not between 1 and 100000 or chat_search is null or length(chat_search)>150 then raise exception 'Bộ lọc hội thoại chưa hợp lệ.';end if;
 with accessible as materialized (
  select r.id,r.title,r.status,r.assigned_to,conv.id as conversation_id,u.role,
   coalesce(cm.last_read_at,'-infinity'::timestamptz) as last_read_at
  from requests r join conversations conv on conv.request_id=r.id join profiles u on u.id=actor_id and u.active
  left join conversation_members cm on cm.conversation_id=conv.id and cm.profile_id=u.id
  where (u.role='ADMIN' or (u.role='STAFF' and r.assigned_to=u.id)
   or (u.role in ('CUSTOMER','BUSINESS') and exists(select 1 from customers where id=r.customer_id and profile_id=u.id))
   or (u.role in ('CREATOR','STUDENT_CREATOR') and is_creator_participant(r.id,u.id)))
   and (btrim(chat_search)='' or strpos(lower(concat_ws(' ',r.title,(select full_name from profiles where id=r.assigned_to))),lower(btrim(chat_search)))>0)
 ), summaries as (
  select a.id,a.title,a.status,jsonb_build_object('full_name',staff.full_name,'avatar_url',staff.avatar_url) as assigned_staff,
   latest.preview,latest.created_at as last_message_at,
   (select count(*) from conversation_messages m where m.conversation_id=a.conversation_id and m.sender_id<>actor_id
    and m.created_at>a.last_read_at and (a.role not in ('CREATOR','STUDENT_CREATOR') or m.audience='TEAM')) as unread_count
  from accessible a left join profiles staff on staff.id=a.assigned_to
  left join lateral (select left(m.content,120) as preview,m.created_at from conversation_messages m where m.conversation_id=a.conversation_id
   and (a.role not in ('CREATOR','STUDENT_CREATOR') or m.audience='TEAM') order by m.created_at desc,m.id desc limit 1) latest on true
 ), paged as (
  select * from summaries order by last_message_at desc nulls last,id offset ((chat_page::bigint-1)*20) limit 20
 ) select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(p) order by last_message_at desc nulls last,id) from paged p),'[]'::jsonb),
  'total',(select count(*) from accessible),'page',chat_page,'limit',20) into output;
 return output;
end $$;

create function service_chat_resources(actor_id uuid,rid uuid,resource_page integer default 1) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare scope jsonb;output jsonb;
begin
 scope:=service_chat_scope(actor_id,rid);if scope is null then return null;end if;
 if resource_page is null or resource_page not between 1 and 100000 then raise exception 'Trang tệp chưa hợp lệ.';end if;
 with visible as materialized (
  select f.message_id,f.file_name,f.file_type,f.file_size,m.created_at from service_chat_files f join conversation_messages m on m.id=f.message_id
  where f.request_id=rid and m.conversation_id=(scope->>'conversation_id')::uuid
   and (not (scope->>'creator')::boolean or m.audience='TEAM')
 ), paged as (select * from visible order by created_at desc,message_id offset ((resource_page::bigint-1)*10) limit 10)
 select jsonb_build_object('files',coalesce((select jsonb_agg(to_jsonb(p) order by created_at desc,message_id) from paged p),'[]'::jsonb),
  'total',(select count(*) from visible),'page',resource_page,'limit',10,
  'members',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'full_name',p.full_name,'role',p.role,'avatar_url',p.avatar_url)),'[]'::jsonb)
   from profiles p where p.id in (select (item->>'id')::uuid from jsonb_array_elements(service_chat_participants(actor_id,rid)) item))) into output;
 return output;
end $$;

alter function request_action(uuid,uuid,text,jsonb) rename to legacy_request_action_033;
revoke all on function legacy_request_action_033(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
create function request_action(actor_id uuid,rid uuid,operation text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public as $$
declare scope jsonb;conv uuid;mid uuid;target conversation_messages;aud text:=coalesce(payload->>'audience','TEAM');
 reply uuid:=(payload->>'reply_to_id')::uuid;retry uuid:=(payload->>'client_message_id')::uuid;prior conversation_messages;
begin
 if operation not in ('message','chat_file','read') then return legacy_request_action_033(actor_id,rid,operation,payload);end if;
 perform 1 from requests where id=rid for update;
 scope:=service_chat_scope(actor_id,rid);
 if scope is null then raise exception 'Không có quyền hội thoại dịch vụ.';end if;
 conv:=(scope->>'conversation_id')::uuid;
 if operation='read' then
  insert into conversation_members(conversation_id,profile_id,last_read_at) values(conv,actor_id,clock_timestamp())
   on conflict(conversation_id,profile_id) do update set last_read_at=excluded.last_read_at;
  return jsonb_build_object('id',rid);
 end if;
 if (scope->>'closed')::boolean or aud not in ('TEAM','CUSTOMER_STAFF') or ((scope->>'creator')::boolean and aud<>'TEAM') then raise exception 'Hội thoại đã đóng hoặc người nhận chưa hợp lệ.';end if;
 if not exists(select 1 from orders o join contract_acknowledgments ack on ack.order_id=o.id where o.request_id=rid) then aud:='CUSTOMER_STAFF';end if;
 if retry is not null then
  select * into prior from conversation_messages where conversation_id=conv and sender_id=actor_id and client_message_id=retry;
  if prior.id is not null then
   if prior.content is distinct from btrim(payload->>'content') or prior.audience<>aud or prior.reply_to_id is distinct from reply
    or exists(select 1 from service_chat_files where message_id=prior.id) is distinct from (operation='chat_file')
    or (operation='chat_file' and not exists(select 1 from service_chat_files where message_id=prior.id and sha256=payload->>'sha256'
     and file_name=payload->>'name' and file_type=payload->>'type' and file_size=(payload->>'size')::bigint)) then raise exception 'Mã gửi lại không khớp nội dung tin nhắn.';end if;
   return jsonb_build_object('id',rid,'message_id',prior.id,'created',false);
  end if;
 end if;
 if coalesce(length(btrim(payload->>'content')),0) not between 1 and 5000 then raise exception 'Tin nhắn chưa hợp lệ.';end if;
 if reply is not null then
  select * into target from conversation_messages where id=reply and conversation_id=conv;
  if target.id is null or (target.audience='CUSTOMER_STAFF' and (aud='TEAM' or (scope->>'creator')::boolean)) then raise exception 'Không thể trả lời tin nhắn ngoài hội thoại hoặc ngoài quyền người nhận.';end if;
 end if;
 if operation='chat_file' and (coalesce(payload->>'path','')!~('^requests/'||rid::text||'/chat/[a-f0-9-]{36}\.(jpg|jpeg|png|webp|pdf|mp4|mov)$')
  or not exists(select 1 from storage.objects where bucket_id='project-files' and name=payload->>'path')
  or coalesce(length(payload->>'name'),0) not between 1 and 255 or (payload->>'size')::bigint not between 1 and 52428800
  or coalesce(payload->>'type','') not in ('image/jpeg','image/png','image/webp','application/pdf','video/mp4','video/quicktime')
  or coalesce(payload->>'sha256','')!~'^[a-f0-9]{64}$') then raise exception 'Tệp trao đổi chưa hợp lệ.';end if;
 insert into conversation_messages(conversation_id,sender_id,content,audience,reply_to_id,client_message_id,created_at)
  values(conv,actor_id,btrim(payload->>'content'),aud,reply,retry,clock_timestamp()) returning id into mid;
 if operation='chat_file' then
  insert into service_chat_files(message_id,request_id,uploaded_by,file_name,file_type,file_size,storage_path,sha256)
   values(mid,rid,actor_id,payload->>'name',payload->>'type',(payload->>'size')::bigint,payload->>'path',payload->>'sha256');
 end if;
 insert into conversation_members(conversation_id,profile_id,last_read_at) values(conv,actor_id,clock_timestamp())
  on conflict(conversation_id,profile_id) do update set last_read_at=excluded.last_read_at;
 return jsonb_build_object('id',rid,'message_id',mid,'created',true);
end $$;
revoke all on function service_chat_scope(uuid,uuid),service_chat_participants(uuid,uuid),service_chat_conversations(uuid,integer,text),service_chat_resources(uuid,uuid,integer),request_action(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function service_chat_scope(uuid,uuid),service_chat_participants(uuid,uuid),service_chat_conversations(uuid,integer,text),service_chat_resources(uuid,uuid,integer),request_action(uuid,uuid,text,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
