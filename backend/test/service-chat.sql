-- Reuses a real accepted-team/acknowledged-order fixture. Runner rolls back everything.
create function pg_temp.verify_service_chat(a uuid,c uuid,s uuid,x uuid,rid uuid,conv uuid) returns void language plpgsql as $$
declare private_id uuid;shared_id uuid;reply_id uuid;file_id uuid;retry uuid:=gen_random_uuid();denied boolean;data jsonb;total_before bigint;
 path text:='requests/'||rid::text||'/chat/'||gen_random_uuid()::text||'.png';input jsonb;
begin
 select count(*) into total_before from conversations where request_id=rid;
 private_id:=(request_action(s,rid,'message',jsonb_build_object('content','Hidden commercial marker','audience','CUSTOMER_STAFF'))->>'message_id')::uuid;
 shared_id:=(request_action(c,rid,'message',jsonb_build_object('content','Shared conversation marker','client_message_id',retry))->>'message_id')::uuid;
 data:=request_action(c,rid,'message',jsonb_build_object('content','Shared conversation marker','client_message_id',retry));
 if data->>'message_id'<>shared_id::text or data->>'created'<>'false' then raise exception 'Text retry creates a duplicate message';end if;
 denied:=false;begin perform request_action(c,rid,'message',jsonb_build_object('content','Different text','client_message_id',retry));exception when raise_exception then denied:=true;end;if not denied then raise exception 'Retry key reused for different content';end if;
 denied:=false;begin perform request_action(x,rid,'message',jsonb_build_object('content','Leak','reply_to_id',private_id));exception when raise_exception then denied:=true;end;if not denied then raise exception 'Creator replies to hidden private message';end if;
 denied:=false;begin perform request_action(c,rid,'message',jsonb_build_object('content','Leak to team','reply_to_id',private_id));exception when raise_exception then denied:=true;end;if not denied then raise exception 'Customer quotes private negotiation into team';end if;
 reply_id:=(request_action(c,rid,'message',jsonb_build_object('content','Private reply allowed','audience','CUSTOMER_STAFF','reply_to_id',private_id))->>'message_id')::uuid;
 if (select reply_to_id from conversation_messages where id=reply_id)<>private_id then raise exception 'Private reply not linked';end if;
 denied:=false;begin perform request_action(x,rid,'message',jsonb_build_object('content','Wrong thread','reply_to_id',gen_random_uuid()));exception when raise_exception then denied:=true;end;if not denied then raise exception 'Reply points outside visible thread';end if;
 data:=service_chat_conversations(x,1,(select title from requests where id=rid));
 if not exists(select 1 from jsonb_array_elements(data->'items') item where item->>'id'=rid::text and item->>'preview'='Shared conversation marker' and (item->>'unread_count')::integer>0)
  or data::text like '%Hidden commercial marker%' or data::text like '%Private reply allowed%' then raise exception 'Creator preview/unread exposes private negotiation';end if;
 perform request_action(x,rid,'read','{}');
 if exists(select 1 from jsonb_array_elements(service_chat_conversations(x,1,'')->'items') item where item->>'id'=rid::text and item->>'unread_count'<>'0') then raise exception 'Visible unread does not reset after reading';end if;
 perform request_action(a,rid,'read','{}');
 if not exists(select 1 from conversation_members where conversation_id=conv and profile_id=a and last_read_at is not null) then raise exception 'Admin read receipt not persisted';end if;
 insert into storage.objects(bucket_id,name,metadata) values('project-files',path,'{"size":100,"mimetype":"image/png"}');
 input:=jsonb_build_object('content','Image progress','name','progress.png','type','image/png','size',100,'path',path,'sha256',repeat('a',64),'client_message_id',gen_random_uuid(),'reply_to_id',shared_id);
 file_id:=(request_action(x,rid,'chat_file',input)->>'message_id')::uuid;
 if (select request_id from service_chat_files where message_id=file_id)<>rid or (select reply_to_id from conversation_messages where id=file_id)<>shared_id then raise exception 'Shared attachment missing request/reply association';end if;
 if request_action(x,rid,'chat_file',input)->>'created'<>'false' then raise exception 'File retry creates duplicate attachment';end if;
 denied:=false;begin perform request_action(x,rid,'chat_file',input||jsonb_build_object('sha256',repeat('b',64)));exception when raise_exception then denied:=true;end;if not denied then raise exception 'File retry replaces contents';end if;
 denied:=false;begin perform request_action(x,rid,'chat_file',input||jsonb_build_object('client_message_id',gen_random_uuid(),'path','requests/other/chat/file.png'));exception when raise_exception then denied:=true;end;if not denied then raise exception 'File references another request';end if;
 data:=service_chat_resources(x,rid,1);
 if data->>'total'<>'1' or data->'files'->0->>'file_name'<>'progress.png' or data::text like '%storage_path%' or data::text like '%sha256%' then raise exception 'Resources mismatch total %, name %, private fields %',data->>'total',data->'files'->0->>'file_name',data::text like '%storage_path%' or data::text like '%sha256%';end if;
 path:='requests/'||rid::text||'/chat/'||gen_random_uuid()::text||'.pdf';
 insert into storage.objects(bucket_id,name,metadata) values('project-files',path,'{"size":100,"mimetype":"application/pdf"}');
 perform request_action(s,rid,'chat_file',input||jsonb_build_object('content','Hidden commercial attachment','name','private.pdf','type','application/pdf','path',path,'audience','CUSTOMER_STAFF','client_message_id',gen_random_uuid()));
 if service_chat_resources(x,rid,1)->>'total'<>'1' or service_chat_resources(x,rid,1)::text like '%private.pdf%' or service_chat_resources(c,rid,1)->>'total'<>'2' then raise exception 'Resources ignore file audience';end if;
 if service_chat_scope(x,gen_random_uuid()) is not null or service_chat_resources(x,gen_random_uuid(),1) is not null then raise exception 'Chat accepts unrelated request';end if;
 if (select count(*) from conversations where request_id=rid)<>total_before or total_before<>1 then raise exception 'Chat improvements fork the conversation';end if;
 if has_function_privilege('authenticated','service_chat_scope(uuid,uuid)','execute') or has_function_privilege('anon','service_chat_conversations(uuid,integer,text)','execute') or has_table_privilege('authenticated','service_chat_files','select') then raise exception 'Browser bypasses chat scope or private storage metadata';end if;
end $$;
