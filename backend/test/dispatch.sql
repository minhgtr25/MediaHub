-- Rollback-only fixture. Disable unrelated real Staff only within this transaction.
do $$
declare a_auth uuid:=gen_random_uuid(); c_auth uuid:=gen_random_uuid(); s1_auth uuid:=gen_random_uuid(); s2_auth uuid:=gen_random_uuid();
 a uuid; c uuid; s1 uuid; s2 uuid; svc uuid; r1 uuid; r2 uuid; r3 uuid; r4 uuid; conv uuid; denied boolean; cr uuid; prop uuid; q uuid; oid uuid;
begin
 update profiles set active=false where role='STAFF';
 update requests set status='CANCELLED' where assigned_to is null and status='UNASSIGNED';
 update staff_dispatch_settings set enabled=true where id;
 insert into auth.users(id,email,raw_user_meta_data) values
  (a_auth,a_auth||'@example.invalid','{"full_name":"Dispatch admin"}'),
  (c_auth,c_auth||'@example.invalid','{"full_name":"Dispatch customer"}'),
  (s1_auth,s1_auth||'@example.invalid','{"full_name":"Idle longest"}'),
  (s2_auth,s2_auth||'@example.invalid','{"full_name":"Idle second"}');
 select id into a from profiles where auth_user_id=a_auth;
 select id into c from profiles where auth_user_id=c_auth;
 select id into s1 from profiles where auth_user_id=s1_auth;
 select id into s2 from profiles where auth_user_id=s2_auth;
 update profiles set role='ADMIN' where id=a;
 update profiles set role='STAFF',consultation_idle_since=now()-interval '2 hour' where id=s1;
 update profiles set role='STAFF',consultation_idle_since=now()-interval '1 hour' where id=s2;
 insert into services(name,slug,active) values('Dispatch service',gen_random_uuid()::text,true) returning id into svc;
 r1:=(request_action(c,null,'create',jsonb_build_object('idempotency_key',gen_random_uuid(),'service_id',svc,'title','First','brief','Automatic allocation','creator_preference','ADVICE'))->>'id')::uuid;
 select id into conv from conversations where request_id=r1;
 if (select assigned_to from requests where id=r1)<>s1 then raise exception 'Longest idle Staff was not selected'; end if;
 if not exists(select 1 from conversation_members where conversation_id=conv and profile_id=s1) then raise exception 'Staff not in original conversation'; end if;
 r2:=(request_action(c,null,'create',jsonb_build_object('idempotency_key',gen_random_uuid(),'service_id',svc,'title','Second','brief','Second consultation','creator_preference','ADVICE'))->>'id')::uuid;
 if (select assigned_to from requests where id=r2)<>s2 then raise exception 'Busy Staff received another consultation'; end if;
 r3:=(request_action(c,null,'create',jsonb_build_object('idempotency_key',gen_random_uuid(),'service_id',svc,'title','Queue','brief','No idle Staff','creator_preference','ADVICE'))->>'id')::uuid;
 if (select status from requests where id=r3)<>'UNASSIGNED' then raise exception 'Request did not remain queued'; end if;
 denied:=false; begin perform request_action(a,r3,'assign',jsonb_build_object('assigned_to',s1)); exception when others then denied:=true; end;
 if not denied then raise exception 'Manual assignment bypassed consultation capacity'; end if;
 perform request_action(c,r1,'cancel','{"reason":"Rollback fixture"}');
 if (select assigned_to from requests where id=r3)<>s1 then raise exception 'Free slot did not serve queued request'; end if;
 if (select count(*) from conversations where request_id in (r1,r2,r3))<>3 then raise exception 'Dispatcher duplicated conversations'; end if;
 if (select count(*) from request_assignments where request_id=r3 and ended_at is null)<>1 then raise exception 'Duplicated assignment'; end if;
 denied:=false; begin perform manage_user(a,c,'BUSINESS',true); exception when others then denied:=true; end;
 if not denied then raise exception 'New BUSINESS access role was granted'; end if;
 denied:=false; begin perform request_commerce_action(s1,r3,'quote_save','{"deposit_percent":29}'); exception when others then denied:=true; end;
 if not denied then raise exception 'Under-minimum deposit was allowed'; end if;
 r4:=(request_action(c,null,'create',jsonb_build_object('idempotency_key',gen_random_uuid(),'service_id',svc,'title','Waiting for close','brief','Release on accepted quote','creator_preference','ADVICE'))->>'id')::uuid;
 insert into creator_profiles(display_name,slug,title) values('Dispatch creator',gen_random_uuid()::text,'Video') returning id into cr;
 perform request_action(s1,r3,'status','{"status":"CONSULTING"}');
 prop:=(request_commerce_action(s1,r3,'propose',jsonb_build_object('creator_id',cr,'reason','Suitable skills'))->>'id')::uuid;
 perform request_commerce_action(c,r3,'proposal_select',jsonb_build_object('proposal_id',prop));
 q:=(request_commerce_action(s1,r3,'quote_save',jsonb_build_object('items',jsonb_build_array(jsonb_build_object('service_id',svc,'description','Final file','quantity',1,'unit_price',1000)),'valid_until',current_date+14,'deposit_percent',30,'revision_policy','Agreed scope'))->>'id')::uuid;
 perform request_commerce_action(s1,r3,'quote_send',jsonb_build_object('quote_id',q));
 oid:=(request_commerce_action(c,r3,'quote_accept',jsonb_build_object('quote_id',q))->>'order_id')::uuid;
 if (select assigned_to from requests where id=r4)<>s1 then raise exception 'Closing quote did not release consultation slot'; end if;
 if (select assigned_to from orders where id=oid)<>s1 or (select assigned_to from requests where id=r3)<>s1 then raise exception 'Closing quote lost project Staff ownership'; end if;
 if has_function_privilege('authenticated','public.dispatch_service_requests()','EXECUTE')
  or has_function_privilege('service_role','public.legacy_request_action_025(uuid,uuid,text,jsonb)','EXECUTE')
  or has_function_privilege('service_role','public.legacy_request_commerce_action_025(uuid,uuid,text,jsonb)','EXECUTE') then raise exception 'Dispatch workflow can be bypassed'; end if;
end $$;
