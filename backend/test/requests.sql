-- Run only inside the migration runner's rollback transaction/savepoint.
do $$
declare
 admin_auth uuid:=gen_random_uuid(); owner_auth uuid:=gen_random_uuid(); other_auth uuid:=gen_random_uuid();
 staff_auth uuid:=gen_random_uuid(); next_auth uuid:=gen_random_uuid(); creator_auth uuid:=gen_random_uuid();
 admin_id uuid; owner_id uuid; other_id uuid; staff_id uuid; next_id uuid; creator_id uuid;
 service_id uuid; other_service uuid; pack_id uuid; inactive_pack uuid; rid uuid; conv_id uuid;
 key uuid:=gen_random_uuid(); payload jsonb; response jsonb; denied boolean; original_projects bigint; note_id uuid;
begin
 insert into auth.users(id,email,raw_user_meta_data) values
 (admin_auth,admin_auth||'@example.invalid','{"full_name":"Request admin"}'),
 (owner_auth,owner_auth||'@example.invalid','{"full_name":"Request business"}'),
 (other_auth,other_auth||'@example.invalid','{"full_name":"Request other"}'),
 (staff_auth,staff_auth||'@example.invalid','{"full_name":"Request first staff"}'),
 (next_auth,next_auth||'@example.invalid','{"full_name":"Request next staff"}'),
 (creator_auth,creator_auth||'@example.invalid','{"full_name":"Request creator"}');
 select id into admin_id from profiles where auth_user_id=admin_auth;
 select id into owner_id from profiles where auth_user_id=owner_auth;
 select id into other_id from profiles where auth_user_id=other_auth;
 select id into staff_id from profiles where auth_user_id=staff_auth;
 select id into next_id from profiles where auth_user_id=next_auth;
 select id into creator_id from profiles where auth_user_id=creator_auth;
 update profiles set role='ADMIN' where id=admin_id;
 update profiles set role='BUSINESS' where id=owner_id;
 update profiles set role='STAFF' where id in (staff_id,next_id);
 update profiles set role='CREATOR' where id=creator_id;
 insert into services(name,slug,active) values('Request service',gen_random_uuid()::text,true) returning id into service_id;
 insert into services(name,slug,active) values('Other request service',gen_random_uuid()::text,true) returning id into other_service;
 pack_id:=(save_service_package(admin_id,null,jsonb_build_object('service_id',service_id,'name','Test package','active',true,'starting_price',1234,'deliverables',jsonb_build_array('Final file')))->>'id')::uuid;
 inactive_pack:=(save_service_package(admin_id,null,jsonb_build_object('service_id',service_id,'name','Unpublished package','active',false))->>'id')::uuid;
 denied:=false; begin perform save_service_package(owner_id,null,jsonb_build_object('service_id',service_id,'name','Forged package')); exception when raise_exception then denied:=true; end;
 if not denied then raise exception 'Customer can manage packages'; end if;
 execute 'set local role anon';
 if not exists(select 1 from service_packages where id=pack_id) or exists(select 1 from service_packages where id=inactive_pack) then raise exception 'Published package RLS failed'; end if;
 execute 'reset role';
 select count(*) into original_projects from projects;
 payload:=jsonb_build_object('service_id',service_id,'package_id',pack_id,'title','Separate brief','brief','Private request brief',
  'budget_min',1000,'budget_max',2000,'deadline',current_date+14,'creator_preference','ADVICE','reference_urls',jsonb_build_array('https://example.invalid/reference'),'idempotency_key',key,
  'package_snapshot',jsonb_build_object('starting_price',1));
 response:=request_action(owner_id,null,'create',payload);
 rid:=(response->>'id')::uuid; conv_id:=(response->>'conversation_id')::uuid;
 if (select count(*) from projects)<>original_projects then raise exception 'Request prematurely created a production project'; end if;
 if (select package_snapshot->>'starting_price' from requests where id=rid)<>'1234.00' then
  if (select (package_snapshot->>'starting_price')::numeric from requests where id=rid)<>1234 then raise exception 'Package snapshot trusted submitted price'; end if;
 end if;
 if request_action(owner_id,null,'create',payload)->>'id'<>rid::text or (select count(*) from requests where idempotency_key=key)<>1 then raise exception 'Repeated submit creates another request'; end if;
 if (select count(*) from conversations where request_id=rid)<>1 or not exists(select 1 from conversation_members where conversation_id=conv_id and profile_id=owner_id) then raise exception 'Atomic workspace creation failed'; end if;
 denied:=false; begin perform request_action(owner_id,null,'create',payload||jsonb_build_object('idempotency_key',gen_random_uuid(),'package_id',inactive_pack)); exception when raise_exception then denied:=true; end;
 if not denied then raise exception 'Inactive package accepted'; end if;
 denied:=false; begin perform request_action(owner_id,null,'create',payload||jsonb_build_object('idempotency_key',gen_random_uuid(),'service_id',other_service)); exception when raise_exception then denied:=true; end;
 if not denied then raise exception 'Cross-service package accepted'; end if;
 denied:=false; begin perform request_action(creator_id,null,'create',payload); exception when raise_exception then denied:=true; end;
 if not denied then raise exception 'Creator can submit customer requests'; end if;
 perform save_service_package(admin_id,pack_id,jsonb_build_object('service_id',service_id,'name','Renamed package','active',false,'starting_price',9999));
 if (select (package_snapshot->>'starting_price')::numeric from requests where id=rid)<>1234 then raise exception 'Package edit rewrote existing brief snapshot'; end if;
 perform set_config('request.jwt.claim.sub',staff_auth::text,true);
 execute 'set local role authenticated';
 if exists(select 1 from requests where id=rid) or exists(select 1 from conversation_messages where conversation_messages.conversation_id=conv_id) then raise exception 'Unassigned staff can read private request'; end if;
 execute 'reset role';
 denied:=false; begin perform request_action(other_id,rid,'message','{"content":"Intrusion"}'); exception when raise_exception then denied:=true; end;
 if not denied then raise exception 'Other customer can message request'; end if;
 perform request_action(staff_id,rid,'claim','{}');
 denied:=false; begin perform request_action(next_id,rid,'claim','{}'); exception when raise_exception then denied:=true; end;
 if not denied or (select assigned_to from requests where id=rid)<>staff_id or (select count(*) from request_assignments where request_assignments.request_id=rid and ended_at is null)<>1 then raise exception 'Stale claim overrides existing assignment'; end if;
 perform request_action(staff_id,rid,'status','{"status":"CONSULTING"}');
 perform request_action(staff_id,rid,'note','{"content":"Private internal note"}');
 perform request_action(owner_id,rid,'message','{"content":"Customer reply"}');
 perform request_action(staff_id,rid,'attachment',jsonb_build_object('name','Reference.pdf','path','requests/'||rid||'/'||gen_random_uuid()||'.pdf','type','application/pdf','size',50));
 perform set_config('request.jwt.claim.sub',owner_auth::text,true);
 execute 'set local role authenticated';
 if not exists(select 1 from requests where id=rid) or not exists(select 1 from request_attachments where request_attachments.request_id=rid) then raise exception 'Owner cannot read brief/reference'; end if;
 if exists(select 1 from request_notes where request_notes.request_id=rid) or exists(select 1 from request_assignments where request_assignments.request_id=rid) then raise exception 'Owner reads internal notes/reasons under RLS'; end if;
 if not exists(select 1 from conversation_messages where conversation_messages.conversation_id=conv_id and content='Customer reply') then raise exception 'Owner cannot read commercial conversation'; end if;
 execute 'reset role';
 denied:=false; begin perform request_action(owner_id,rid,'note','{"content":"Forged note"}'); exception when raise_exception then denied:=true; end;
 if not denied then raise exception 'Customer can add internal note'; end if;
 denied:=false; begin perform request_action(staff_id,rid,'status','{"status":"CONVERTED"}'); exception when raise_exception then denied:=true; end;
 if not denied then raise exception 'Request can bypass future order gates'; end if;
 perform request_action(staff_id,rid,'assign',jsonb_build_object('assigned_to',next_id,'reason','Coverage transfer - internal'));
 perform set_config('request.jwt.claim.sub',staff_auth::text,true);
 if can_access_request(rid) or is_conversation_member(conv_id) then raise exception 'Transferred staff retains private scope'; end if;
 execute 'set local role authenticated';
 if exists(select 1 from conversation_messages where conversation_messages.conversation_id=conv_id) or exists(select 1 from request_notes where request_notes.request_id=rid) then raise exception 'Transferred staff retains realtime/note data'; end if;
 execute 'reset role';
 denied:=false; begin perform request_action(staff_id,rid,'message','{"content":"After transfer"}'); exception when raise_exception then denied:=true; end;
 if not denied then raise exception 'Transferred staff can still send'; end if;
 perform set_config('request.jwt.claim.sub',next_auth::text,true);
 if not can_access_request(rid) or not is_conversation_member(conv_id) then raise exception 'New assignment has no scope'; end if;
 execute 'set local role authenticated';
 if not exists(select 1 from request_notes where request_notes.request_id=rid) then raise exception 'Assigned staff cannot read internal notes'; end if;
 execute 'reset role';
 if exists(select 1 from conversation_messages where conversation_messages.conversation_id=conv_id and content like '%Coverage transfer%') then raise exception 'Private transfer reason leaked to shared messages'; end if;
 if not exists(select 1 from audit_logs where entity_id=rid and action='REQUEST_TRANSFERRED' and reason='Coverage transfer - internal' and old_value->>'assigned_to'=staff_id::text and new_value->>'assigned_to'=next_id::text) then raise exception 'Transfer audit missing'; end if;
 update profiles set active=false where id=next_id;
 if can_access_request(rid) or is_conversation_member(conv_id) then raise exception 'Inactive assignee retains access'; end if;
 update profiles set active=true,role='CREATOR' where id=next_id;
 if can_access_request(rid) or is_conversation_member(conv_id) then raise exception 'Changed assignee role retains access'; end if;
 update profiles set role='STAFF' where id=next_id;
 perform request_action(next_id,rid,'release','{"reason":"Cannot meet timeline"}');
 if (select status from requests where id=rid)<>'UNASSIGNED' or (select assigned_to from requests where id=rid) is not null or (select count(*) from request_assignments where request_assignments.request_id=rid and ended_at is null)<>0 then raise exception 'Release did not revoke assignment'; end if;
 perform request_action(admin_id,rid,'assign',jsonb_build_object('assigned_to',staff_id));
 perform request_action(owner_id,rid,'cancel','{"reason":"Requirements changed"}');
 denied:=false; begin perform request_action(staff_id,rid,'message','{"content":"After cancellation"}'); exception when raise_exception then denied:=true; end;
 if not denied then raise exception 'Closed request accepts new messages'; end if;
 perform request_action(owner_id,rid,'read','{}');
 if has_function_privilege('authenticated','public.request_action(uuid,uuid,text,jsonb)','EXECUTE') or has_function_privilege('anon','public.save_service_package(uuid,uuid,jsonb)','EXECUTE') then raise exception 'Browser can forge request/package actor'; end if;
 if has_table_privilege('authenticated','public.requests','INSERT') or has_table_privilege('authenticated','public.request_notes','INSERT') then raise exception 'Browser can bypass transactional actions'; end if;
end $$;
