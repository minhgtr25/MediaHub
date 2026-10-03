-- Execute only inside the migration runner's rollback transaction/savepoint.
do $$
declare a_auth uuid:=gen_random_uuid(); b_auth uuid:=gen_random_uuid(); o_auth uuid:=gen_random_uuid();
 creator_auth uuid:=gen_random_uuid(); staff_auth uuid:=gen_random_uuid();
 a uuid; b uuid; o uuid; creator uuid; staff uuid; cid uuid; sid uuid; pid uuid; qid uuid;
 ticket uuid; plan uuid; installment uuid; conversation uuid:=gen_random_uuid(); denied boolean;
begin
 insert into auth.users(id,email,raw_user_meta_data) values
 (a_auth,a_auth::text||'@example.invalid','{"full_name":"Authorization admin"}'),
 (b_auth,b_auth::text||'@example.invalid','{"full_name":"Authorization business"}'),
 (o_auth,o_auth::text||'@example.invalid','{"full_name":"Authorization other"}'),
 (creator_auth,creator_auth::text||'@example.invalid','{"full_name":"Authorization creator"}'),
 (staff_auth,staff_auth::text||'@example.invalid','{"full_name":"Authorization staff"}');
 select id into a from profiles where auth_user_id=a_auth;
 select id into b from profiles where auth_user_id=b_auth;
 select id into o from profiles where auth_user_id=o_auth;
 select id into creator from profiles where auth_user_id=creator_auth;
 select id into staff from profiles where auth_user_id=staff_auth;
 update profiles set role='ADMIN' where id=a;
 update profiles set role='BUSINESS' where id=b;
 update profiles set role='CREATOR' where id=creator;
 update profiles set role='STAFF' where id=staff;
 select id into cid from customers where profile_id=b;
 insert into services(name,slug,description,active) values('Authorization test',gen_random_uuid()::text,'Test',true) returning id into sid;
 pid:=(project_action(b,null,'create',jsonb_build_object('title','Business brief','description','Test','category','Video','budget',1000,'deadline',current_date+30,'service_ids',jsonb_build_array(sid)))->>'id')::uuid;
 if (dashboard_report(b)->>'total_projects')::integer<>1 then raise exception 'Business report failed or leaked projects'; end if;
 ticket:=(support_action(b,'create',null,'{"subject":"Business support","category":"PROJECT","message":"Help"}')->>'id')::uuid;
 denied:=false;begin perform support_action(o,'message',ticket,'{"message":"Unauthorized"}'); exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Other customer can write business support';end if;
 denied:=false;begin perform support_action(creator,'message',ticket,'{"message":"Unauthorized"}'); exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Creator can write private support';end if;
 perform support_action(staff,'claim',ticket,'{}');
 perform support_action(staff,'message',ticket,'{"message":"Assigned reply"}');
 denied:=false;begin perform project_action(creator,pid,'file','{}'); exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Creator can write legacy project';end if;
 perform project_action(a,pid,'status','{"status":"REVIEWING"}');
 qid:=(save_quotation(a,pid,jsonb_build_object('items',jsonb_build_array(jsonb_build_object('service_id',sid,'description','Work','quantity',2,'unit_price',500)),'valid_until',current_date+10,'notes','Test'),false)->>'id')::uuid;
 perform set_config('request.jwt.claim.sub',b_auth::text,true);
 execute 'set local role authenticated';
 if not exists(select 1 from projects where id=pid) then raise exception 'Business cannot read own project under RLS';end if;
 if exists(select 1 from quotations where id=qid) then raise exception 'Business can read draft quote under RLS';end if;
 execute 'reset role';
 perform manage_quotation(a,qid,'send');
 perform project_action(b,pid,'accept','{}');
 plan:=(payment_action(a,'create-plan',pid,'{"deposit_percent":30}')->>'id')::uuid;
 if (select total from payment_plans where id=plan)<>1000 or (select sum(amount) from payment_installments where plan_id=plan)<>1000 then raise exception 'Plan total does not match accepted quote';end if;
 update payment_settings set enabled=true where id='default';
 select id into installment from payment_installments where plan_id=plan and stage='DEPOSIT';
 denied:=false;begin perform payment_action(o,'report',installment,'{"transfer_note":"Unauthorized"}'); exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Other customer can report business payment';end if;
 perform payment_action(b,'report',installment,'{"transfer_note":"Test receipt"}');
 perform payment_action(a,'confirm',installment,'{}');
 perform project_action(a,pid,'status','{"status":"IN_PROGRESS"}');
 perform project_action(a,pid,'deliverable','{"name":"Final","path":"authorization/final.pdf"}');
 perform project_action(a,pid,'status','{"status":"WAITING_REVIEW"}');
 perform project_action(b,pid,'complete','{}');
 perform project_action(a,pid,'issue-invoice',jsonb_build_object('due_date',current_date+10));
 select id into installment from payment_installments where plan_id=plan and stage='BALANCE';
 perform payment_action(b,'report',installment,'{"transfer_note":"Final receipt"}');
 perform payment_action(a,'confirm',installment,'{}');
 if (select status from invoices where project_id=pid)<>'PAID' then raise exception 'Business payment did not settle invoice';end if;
 perform manage_user(a,b,'BUSINESS',true);
 if (select role from profiles where id=b)<>'BUSINESS' then raise exception 'Role preservation failed';end if;
 insert into conversations(id,subject) values(conversation,'Authorization test');
 insert into conversation_members(conversation_id,profile_id) values(conversation,b),(conversation,a);
 insert into conversation_messages(conversation_id,sender_id,content) values(conversation,a,'Private');
 perform set_config('request.jwt.claim.sub',b_auth::text,true);
 if not owns_project(pid) or not is_conversation_member(conversation) then raise exception 'Active business RLS helper failed';end if;
 execute 'set local role authenticated';
 if not exists(select 1 from conversation_messages where conversation_id=conversation) then raise exception 'Member cannot read messages';end if;
 execute 'reset role';
 update profiles set active=false where id=b;
 if owns_project(pid) or is_conversation_member(conversation) then raise exception 'Inactive business retains RLS helper access';end if;
 execute 'set local role authenticated';
 if exists(select 1 from projects where id=pid) or exists(select 1 from conversation_messages where conversation_id=conversation) then raise exception 'Inactive user reads private data under RLS';end if;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',o_auth::text,true);
 if is_conversation_member(conversation) then raise exception 'Non-member RLS helper leaks membership';end if;
 if has_function_privilege('authenticated','public.support_action(uuid,text,uuid,jsonb)','EXECUTE') or has_function_privilege('authenticated','public.payment_action(uuid,text,uuid,jsonb)','EXECUTE') then raise exception 'Browser can forge workflow actor';end if;
end $$;
