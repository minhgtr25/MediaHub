-- Rollback-only variation scope, immutable acceptance and finance assertions.
do $$
declare aa uuid:=gen_random_uuid(); ca uuid:=gen_random_uuid(); sa uuid:=gen_random_uuid(); na uuid:=gen_random_uuid(); xa uuid:=gen_random_uuid();
 admin_id uuid; owner_id uuid; staff_id uuid; next_id uuid; other_id uuid; service_id uuid; creator_id uuid;
 rid uuid; oid uuid; proposal_id uuid; qid uuid; cid uuid; payid uuid; pid uuid; mid uuid; denied boolean; input jsonb; invoice_count bigint;
 teams_enabled boolean:=(select enabled from creator_team_settings where id);dispatch_enabled boolean:=(select enabled from staff_dispatch_settings where id);v1 uuid;v2 uuid;vq1 uuid;vq2 uuid;key1 uuid:=gen_random_uuid();qkey uuid:=gen_random_uuid();data jsonb;before_report jsonb;last_month date:=date_trunc('month',now() at time zone 'Asia/Ho_Chi_Minh')::date-1;creator_auth uuid:=gen_random_uuid();creator_actor uuid;ack_input jsonb;
begin
 update creator_team_settings set enabled=false where id;update staff_dispatch_settings set enabled=false where id;
 insert into auth.users(id,email,raw_user_meta_data) values
 (aa,aa||'@example.invalid','{"full_name":"Production admin"}'),(ca,ca||'@example.invalid','{"full_name":"Production business"}'),
 (sa,sa||'@example.invalid','{"full_name":"Production staff"}'),(na,na||'@example.invalid','{"full_name":"Production transfer"}'),(xa,xa||'@example.invalid','{"full_name":"Production other"}');
 select id into admin_id from profiles where auth_user_id=aa; select id into owner_id from profiles where auth_user_id=ca;
 select id into staff_id from profiles where auth_user_id=sa; select id into next_id from profiles where auth_user_id=na; select id into other_id from profiles where auth_user_id=xa;
 update profiles set role='ADMIN' where id=admin_id; update profiles set role='BUSINESS' where id=owner_id; update profiles set role='STAFF' where id in (staff_id,next_id);
 insert into services(name,slug,active) values('Production service',gen_random_uuid()::text,true) returning id into service_id;
 insert into creator_profiles(slug,display_name,title,availability) values(gen_random_uuid()::text,'Production creator','Video','AVAILABLE') returning id into creator_id;
 select count(*) into invoice_count from invoices;
 update payment_settings set enabled=true,bank_name='ROLLBACK BANK',account_number=gen_random_uuid()::text,account_name='QA ONLY' where id='default';
 rid:=(request_action(owner_id,null,'create',jsonb_build_object('service_id',service_id,'title','Production brief','brief','Rollback only','idempotency_key',gen_random_uuid()))->>'id')::uuid;
 perform request_action(staff_id,rid,'claim','{}'); perform request_action(staff_id,rid,'status','{"status":"CONSULTING"}');
 proposal_id:=(request_commerce_action(staff_id,rid,'propose',jsonb_build_object('creator_id',creator_id,'reason','Test only'))->>'id')::uuid;
 perform request_commerce_action(owner_id,rid,'proposal_select',jsonb_build_object('proposal_id',proposal_id));
 qid:=(request_commerce_action(staff_id,rid,'quote_save',jsonb_build_object('items',jsonb_build_array(jsonb_build_object('service_id',service_id,'description','Video','quantity',1,'unit_price',1000)),'valid_until',(now() at time zone 'Asia/Ho_Chi_Minh')::date+14,'revision_policy','Two rounds','deposit_percent',30))->>'id')::uuid;
 perform request_commerce_action(staff_id,rid,'quote_send',jsonb_build_object('quote_id',qid));
 oid:=(request_commerce_action(owner_id,rid,'quote_accept',jsonb_build_object('quote_id',qid))->>'order_id')::uuid;
 denied:=false; begin perform order_production_action(staff_id,oid,'create','{}'); exception when raise_exception then denied:=true; end;
 if not denied then raise exception 'Production created from quote alone'; end if;
 cid:=(order_action(staff_id,oid,'contract_save',jsonb_build_object('title','Terms','content','Rollback only','valid_until',(now() at time zone 'Asia/Ho_Chi_Minh')::date+14))->>'id')::uuid;
 perform order_action(staff_id,oid,'contract_send',jsonb_build_object('contract_id',cid));
 perform order_action(owner_id,oid,'contract_acknowledge',jsonb_build_object('contract_id',cid,'content_hash',(select content_hash from order_contracts where id=cid),'acknowledge',true));
 payid:=(order_payment_action(staff_id,oid,'create',jsonb_build_object('kind','DEPOSIT','due_date',(now() at time zone 'Asia/Ho_Chi_Minh')::date+14,'idempotency_key',gen_random_uuid()))->>'id')::uuid;
 perform order_payment_action(owner_id,oid,'report',jsonb_build_object('payment_id',payid,'transfer_note','Rollback only'));
 denied:=false; begin perform order_production_action(staff_id,oid,'create','{}'); exception when raise_exception then denied:=true; end;
 if not denied then raise exception 'Production created from unverified transfer'; end if;
 perform order_payment_action(admin_id,oid,'confirm',jsonb_build_object('payment_id',payid,'verified',true,'received_amount',300,'bank_transaction_reference',gen_random_uuid(),'received_at',now(),'reason','Rollback only'));

 update orders set accepted_at=date_trunc('month',last_month)::timestamp at time zone 'Asia/Ho_Chi_Minh' where id=oid;
 before_report:=commerce_finance_report(staff_id,extract(year from last_month)::int,extract(month from last_month)::int);
 denied:=false;begin perform order_variation_action(staff_id,oid,'request',jsonb_build_object('title','Wrong actor','description','Wrong','idempotency_key',gen_random_uuid()));exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Staff initiated Customer variation';end if;
 if order_variation_list(other_id,oid) is not null then raise exception 'Another owner reads commerce';end if;
 v1:=(order_variation_action(owner_id,oid,'request',jsonb_build_object('title','Extra video','description','One extra cut','idempotency_key',key1))->>'id')::uuid;
 if order_variation_action(owner_id,oid,'request',jsonb_build_object('title','Extra video','description','One extra cut','idempotency_key',key1))->>'reused'<>'true' or (select count(*) from order_variations where order_id=oid)<>1 then raise exception 'Request retry duplicates';end if;
 denied:=false;begin perform order_variation_action(owner_id,oid,'request',jsonb_build_object('title','Changed','description','One extra cut','idempotency_key',key1));exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Retry key accepts changed input';end if;
 input:=jsonb_build_object('variation_id',v1,'scope','Additional cut only','revision_policy','Two minor changes; new concept requires another appendix','amount',200,'deadline',(now() at time zone 'Asia/Ho_Chi_Minh')::date+20,'valid_until',(now() at time zone 'Asia/Ho_Chi_Minh')::date+5,'idempotency_key',qkey);
 vq1:=(order_variation_action(staff_id,oid,'quote',input)->>'quote_id')::uuid;
 if order_variation_action(staff_id,oid,'quote',input)->>'reused'<>'true' or (select total from orders where id=oid)<>1000 then raise exception 'Quote retry or premature total invalid';end if;
 denied:=false;begin perform order_variation_action(staff_id,oid,'quote',input||jsonb_build_object('amount',1.111,'idempotency_key',gen_random_uuid()));exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Fractional cents accepted';end if;
 vq2:=(order_variation_action(staff_id,oid,'quote',input||jsonb_build_object('amount',250,'scope','Final additional cut','idempotency_key',gen_random_uuid()))->>'quote_id')::uuid;
 denied:=false;begin perform order_variation_action(owner_id,oid,'accept',jsonb_build_object('variation_id',v1,'quote_id',vq1,'content_hash',(select content_hash from order_variation_quotes where id=vq1),'acknowledge',true));exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Obsolete quote accepted';end if;
 ack_input:=jsonb_build_object('variation_id',v1,'quote_id',vq2,'content_hash',(select content_hash from order_variation_quotes where id=vq2),'acknowledge',true);
 denied:=false;begin perform order_variation_action(owner_id,oid,'accept',ack_input||jsonb_build_object('content_hash',repeat('0',64)));exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Forged hash accepted';end if;
 perform order_variation_action(owner_id,oid,'accept',ack_input);
 if order_variation_action(owner_id,oid,'accept',ack_input)->>'reused'<>'true' then raise exception 'Acceptance retry not stable';end if;
 if (select total from orders where id=oid)<>1250 or (select deposit_amount from orders where id=oid)<>300 or (select remaining_amount from orders where id=oid)<>950 or (select base_total from orders where id=oid)<>1000 or (select count(*) from order_variation_acknowledgments where variation_id=v1)<>1 or (select count(*) from order_payment_receipts where order_id=oid)<>1 then raise exception 'Acceptance accounting/evidence invalid';end if;
 if (select content from order_contracts where id=cid)<>'Rollback only' or (select total from quotations where id=qid)<>1000 then raise exception 'Variation rewrites original agreement';end if;
 if commerce_finance_report(staff_id,extract(year from last_month)::int,extract(month from last_month)::int)->'summary'->>'receivable' is distinct from before_report->'summary'->>'receivable' then raise exception 'New variation changed previous balance';end if;
 data:=commerce_finance_report(staff_id,extract(year from now() at time zone 'Asia/Ho_Chi_Minh')::int,extract(month from now() at time zone 'Asia/Ho_Chi_Minh')::int);
 if (data->'summary'->>'variations')::numeric<>250 or (data->'summary'->>'booked')::numeric<>0 then raise exception 'Variation not in its own period';end if;
 pid:=(order_production_action(staff_id,oid,'create','{}')->>'id')::uuid;
 if not exists(select 1 from projects where id=pid and scope like '%Final additional cut%') or not exists(select 1 from project_milestones where project_id=pid and idempotency_key=v1 and status='PENDING') then raise exception 'Pre-production scope lost';end if;
 v2:=(order_variation_action(owner_id,oid,'request',jsonb_build_object('title','No extra fees','description','Add thumbnail','idempotency_key',gen_random_uuid()))->>'id')::uuid;
 vq1:=(order_variation_action(staff_id,oid,'quote',input||jsonb_build_object('variation_id',v2,'amount',0,'scope','Thumbnail scope','deadline',(now() at time zone 'Asia/Ho_Chi_Minh')::date+21,'idempotency_key',gen_random_uuid()))->>'quote_id')::uuid;
 denied:=false;begin perform order_delivery_action(staff_id,oid,'send_review','{}');exception when raise_exception then if sqlerrm not like '%phát sinh%' then raise;end if;denied:=true;end;
 if not denied then raise exception 'Open variation does not block review';end if;
 perform order_variation_action(owner_id,oid,'accept',jsonb_build_object('variation_id',v2,'quote_id',vq1,'content_hash',(select content_hash from order_variation_quotes where id=vq1),'acknowledge',true));
 if (select total from orders where id=oid)<>1250 or (select deadline from projects where id=pid)<>(now() at time zone 'Asia/Ho_Chi_Minh')::date+21 or not exists(select 1 from project_milestones where project_id=pid and idempotency_key=v2 and status='PENDING') then raise exception 'Scope milestone missing';end if;

 -- Closed requests preserve history and cannot be accepted; zero-priced quotes
 -- and rejected/withdrawn requests leave money unchanged.
 v2:=(order_variation_action(owner_id,oid,'request',jsonb_build_object('title','Withdraw','description','No longer needed','idempotency_key',gen_random_uuid()))->>'id')::uuid;
 perform order_variation_action(owner_id,oid,'withdraw',jsonb_build_object('variation_id',v2,'reason','Not needed'));
 if order_variation_action(owner_id,oid,'withdraw',jsonb_build_object('variation_id',v2,'reason','Not needed'))->>'reused'<>'true' then raise exception 'Withdrawal retry duplicates';end if;
 denied:=false;begin perform order_variation_action(staff_id,oid,'quote',input||jsonb_build_object('variation_id',v2,'idempotency_key',gen_random_uuid()));exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Withdrawn request quoted';end if;
 v2:=(order_variation_action(owner_id,oid,'request',jsonb_build_object('title','Reject','description','Out of scope','idempotency_key',gen_random_uuid()))->>'id')::uuid;
 perform order_variation_action(staff_id,oid,'reject',jsonb_build_object('variation_id',v2,'reason','Service unavailable'));
 if (select total from orders where id=oid)<>1250 then raise exception 'Resolution changed money';end if;
 -- Inactive assignee and review-in-progress lock new commercial scope.
 update profiles set active=false where id=staff_id;
 denied:=false;begin perform order_variation_action(owner_id,oid,'request',jsonb_build_object('title','Inactive staff','description','Needs active responsible staff','idempotency_key',gen_random_uuid()));exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Variation with inactive assignee';end if;
 update profiles set active=true where id=staff_id;
 update orders set status='WAITING_ACCEPTANCE' where id=oid;
 denied:=false;begin perform order_variation_action(owner_id,oid,'request',jsonb_build_object('title','After review','description','Too late','idempotency_key',gen_random_uuid()));exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Variation during final acceptance';end if;
 update orders set status='CONFIRMED' where id=oid;
 insert into auth.users(id,email,raw_user_meta_data) values(creator_auth,creator_auth||'@example.invalid','{"full_name":"Variation Creator"}');
 select id into creator_actor from profiles where auth_user_id=creator_auth;update profiles set role='CREATOR' where id=creator_actor;update creator_profiles set profile_id=creator_actor where id=creator_id;
 insert into creator_assignments(request_id,creator_id,proposal_id,work_scope,status,invited_by,expires_at) values(rid,creator_id,proposal_id,'Original','ACCEPTED',staff_id,clock_timestamp()+interval '15 minutes');
 if order_variation_list(creator_actor,oid) is not null then raise exception 'Creator reads commerce';end if;
 data:=order_variation_scopes(creator_actor,oid);
 if jsonb_array_length(data->'items')<>2 or data::text like '%amount%' or data::text like '%hash%' or data::text like '%One extra cut%' then raise exception 'Creator scope projection leaks';end if;
 if exists(select 1 from conversation_messages where conversation_id=(select id from conversations where request_id=rid) and event_data->>'event' like 'ORDER_VARIATION_%' and audience<>'CUSTOMER_STAFF') then raise exception 'Commercial events leak';end if;
 if not exists(select 1 from conversation_messages where conversation_id=(select id from conversations where request_id=rid) and event_data->>'event'='PRODUCTION_SCOPE_CHANGED' and audience='TEAM') then raise exception 'Safe scope event missing';end if;
 denied:=false;begin update order_variation_quotes set amount=0 where id=vq2;exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Quote mutable';end if;
 denied:=false;begin update order_variation_acknowledgments set content_hash='forged' where variation_id=v1;exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Evidence mutable';end if;
 denied:=false;begin update orders set total=2000,remaining_amount=1700 where id=oid;exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Direct total bypass';end if;
 perform set_config('request.jwt.claim.sub',creator_auth::text,true);execute 'set local role authenticated';
 denied:=false;begin perform 1 from order_variation_quotes;exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Direct SELECT permitted';end if;
 denied:=false;begin perform order_variation_scopes(creator_actor,oid);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Direct actor-impersonation RPC permitted';end if;
 execute 'reset role';

 -- Deep links resolve the matching page without exposing foreign IDs.
 for i in 1..9 loop
  v2:=(order_variation_action(owner_id,oid,'request',jsonb_build_object('title','Paging '||i,'description','Rollback paging','idempotency_key',gen_random_uuid()))->>'id')::uuid;
  perform order_variation_action(owner_id,oid,'withdraw',jsonb_build_object('variation_id',v2,'reason','Paging fixture only'));
 end loop;
 data:=order_variation_list(owner_id,oid,1,v1);
 if (data->>'page')::int<>2 or not exists(select 1 from jsonb_array_elements(data->'items') item where item->>'id'=v1::text) then raise exception 'Focused appendix page lost target';end if;
 payid:=(order_payment_action(staff_id,oid,'create',jsonb_build_object('kind','REMAINING','due_date',(now() at time zone 'Asia/Ho_Chi_Minh')::date+10,'idempotency_key',gen_random_uuid()))->>'id')::uuid;
 if (select amount from order_payment_requests where id=payid)<>950 then raise exception 'Payment omits extra';end if;
 perform order_payment_action(owner_id,oid,'report',jsonb_build_object('payment_id',payid,'transfer_note','ROLLBACK ONLY'));
 perform order_payment_action(staff_id,oid,'confirm',jsonb_build_object('payment_id',payid,'verified',true,'received_amount',950,'bank_transaction_reference',gen_random_uuid(),'received_at',now(),'reason','ROLLBACK ONLY'));
 perform confirm_order_final_funds(staff_id,oid,'{"verified":true,"note":"ROLLBACK ONLY"}');
 denied:=false;begin perform order_variation_action(owner_id,oid,'request',jsonb_build_object('title','Too late','description','Closed financial agreement','idempotency_key',gen_random_uuid()));exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Variation after funds locked';end if;
update creator_team_settings set enabled=teams_enabled where id;update staff_dispatch_settings set enabled=dispatch_enabled where id;
end $$;
