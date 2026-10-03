-- Real bank evidence gates exercised only with rolled-back synthetic fixtures.
do $$
declare aa uuid:=gen_random_uuid(); ca uuid:=gen_random_uuid(); sa uuid:=gen_random_uuid(); sb uuid:=gen_random_uuid(); a uuid;c uuid;s uuid;s2 uuid;svc uuid;cr uuid;rid uuid;oid uuid;proposal uuid;q uuid;contract uuid;pay uuid;rest uuid;denied boolean;input jsonb;report jsonb;this_year integer;this_month integer;
begin
 update staff_dispatch_settings set enabled=false where id;
 insert into auth.users(id,email,raw_user_meta_data) values(aa,aa||'@example.invalid','{"full_name":"Finance Admin"}'),(ca,ca||'@example.invalid','{"full_name":"Finance Customer"}'),(sa,sa||'@example.invalid','{"full_name":"Finance Staff"}'),(sb,sb||'@example.invalid','{"full_name":"Finance Next Staff"}');
 select id into a from profiles where auth_user_id=aa;select id into c from profiles where auth_user_id=ca;select id into s from profiles where auth_user_id=sa;select id into s2 from profiles where auth_user_id=sb;
 update profiles set role='ADMIN' where id=a;update profiles set role='STAFF' where id in(s,s2);
 insert into services(name,slug,active) values('Finance rollback',gen_random_uuid()::text,true) returning id into svc;
 insert into creator_profiles(slug,display_name,title,availability) values(gen_random_uuid()::text,'Finance rollback Creator','Video','AVAILABLE') returning id into cr;
 rid:=(request_action(c,null,'create',jsonb_build_object('service_id',svc,'title','Finance test','brief','Rollback only','idempotency_key',gen_random_uuid()))->>'id')::uuid;
 update requests set team_confirmation_required=false where id=rid;
 perform request_action(s,rid,'claim','{}');perform request_action(s,rid,'status','{"status":"CONSULTING"}');
 proposal:=(request_commerce_action(s,rid,'propose',jsonb_build_object('creator_id',cr,'reason','Rollback'))->>'id')::uuid;
 perform request_commerce_action(c,rid,'proposal_select',jsonb_build_object('proposal_id',proposal));
 q:=(request_commerce_action(s,rid,'quote_save',jsonb_build_object('items',jsonb_build_array(jsonb_build_object('service_id',svc,'description','Video','quantity',1,'unit_price',1000)),'valid_until',(now() at time zone 'Asia/Ho_Chi_Minh')::date+14,'revision_policy','Scoped revisions','deposit_percent',30))->>'id')::uuid;
 perform request_commerce_action(s,rid,'quote_send',jsonb_build_object('quote_id',q));
 oid:=(request_commerce_action(c,rid,'quote_accept',jsonb_build_object('quote_id',q))->>'order_id')::uuid;
 if (select closed_by from orders where id=oid)<>s then raise exception 'Missing original closing Staff';end if;
 contract:=(order_action(s,oid,'contract_save',jsonb_build_object('title','Finance rollback terms','content','Rollback only','valid_until',(now() at time zone 'Asia/Ho_Chi_Minh')::date+14))->>'id')::uuid;
 perform order_action(s,oid,'contract_send',jsonb_build_object('contract_id',contract));
 perform order_action(c,oid,'contract_acknowledge',jsonb_build_object('contract_id',contract,'content_hash',(select content_hash from order_contracts where id=contract),'acknowledge',true));
 update payment_settings set enabled=true,bank_name='ROLLBACK FINANCE BANK',account_number=gen_random_uuid()::text,account_name='ROLLBACK',instructions='Synthetic only' where id='default';
 pay:=(order_payment_action(s,oid,'create',jsonb_build_object('kind','DEPOSIT','due_date',(now() at time zone 'Asia/Ho_Chi_Minh')::date+14,'idempotency_key',gen_random_uuid()))->>'id')::uuid;
 perform order_payment_action(c,oid,'report',jsonb_build_object('payment_id',pay,'transfer_note','Rollback report'));
 input:=jsonb_build_object('payment_id',pay,'verified',true,'received_amount',300,'bank_transaction_reference',gen_random_uuid(),'received_at',now(),'reason','Private evidence note');
 denied:=false;begin perform order_payment_action(s2,oid,'confirm',input);exception when raise_exception then denied:=true;end;if not denied then raise exception 'Unassigned Staff verifies receipt';end if;
 perform order_payment_action(s,oid,'confirm',input);perform order_payment_action(s,oid,'confirm',input);
 if (select count(*) from order_payment_receipts where order_id=oid)<>1 or (select verified_by from order_payment_receipts where order_id=oid)<>s then raise exception 'Staff receipt duplicated or identity impersonated';end if;
 denied:=false;begin perform confirm_order_final_funds(s,oid,'{"verified":true,"note":"Too early"}');exception when raise_exception then denied:=true;end;if not denied then raise exception 'Deposit falsely confirms all funds';end if;
 this_year:=extract(year from now() at time zone 'Asia/Ho_Chi_Minh');this_month:=extract(month from now() at time zone 'Asia/Ho_Chi_Minh');
 report:=commerce_finance_report(s,this_year,this_month,null,1);
 if (report->'summary'->>'booked')::numeric<>1000 or (report->'summary'->>'received')::numeric<>300 or (report->'summary'->>'receivable')::numeric<>700 or (report->'summary'->>'closed_orders')::integer<>1 then raise exception 'Staff booked/received/receivable conflated';end if;
 -- A receipt this month on a previous-month order must count as this month's
 -- cash receipt without turning that order into a new sale this month.
 update orders set accepted_at=(date_trunc('month',now() at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh')-interval '1 day' where id=oid;
 report:=commerce_finance_report(s,this_year,this_month,null,1);
 if (report->'summary'->>'booked')::numeric<>0 or (report->'summary'->>'received')::numeric<>300 or (report->'summary'->>'closed_orders')::integer<>0 then raise exception 'Prior period sale credited as current sale';end if;
 denied:=false;begin perform commerce_finance_report(s,this_year,this_month,s2,1);exception when raise_exception then denied:=true;end;if not denied then raise exception 'Staff sees other Staff stats';end if;
 denied:=false;begin perform commerce_finance_report(c,this_year,this_month,null,1);exception when raise_exception then denied:=true;end;if not denied then raise exception 'Customer accesses financial reports';end if;
 perform order_action(s,oid,'assign',jsonb_build_object('assigned_to',s2,'reason','Finance test transfer'));
 if (select closed_by from orders where id=oid)<>s then raise exception 'Operational transfer changes closing attribution';end if;
 report:=commerce_finance_report(s,this_year,this_month,null,1);
 if jsonb_array_length(report->'items')<>0 or (report->'summary'->>'received')::numeric<>300 then raise exception 'Transfer restores private order access or loses historical credit';end if;
 report:=commerce_finance_report(s2,this_year,this_month,null,1);
 if (report->'summary'->>'received')::numeric<>0 or (report->'summary'->>'managed_receivable')::numeric<>700 or jsonb_array_length(report->'items')<>1 then raise exception 'Current operator attribution inconsistent';end if;
 denied:=false;begin update orders set closed_by=s2 where id=oid;exception when raise_exception then denied:=true;end;if not denied then raise exception 'Closing attribution mutable';end if;
 rest:=(order_payment_action(s2,oid,'create',jsonb_build_object('kind','REMAINING','due_date',(now() at time zone 'Asia/Ho_Chi_Minh')::date+14,'idempotency_key',gen_random_uuid()))->>'id')::uuid;
 perform order_payment_action(c,oid,'report',jsonb_build_object('payment_id',rest,'transfer_note','Remainder rollback'));
 denied:=false;begin perform confirm_order_final_funds(s2,oid,'{"verified":true,"note":"Only reported"}');exception when raise_exception then denied:=true;end;if not denied then raise exception 'Reported remainder falsely confirms all funds';end if;
 perform order_payment_action(s2,oid,'confirm',input||jsonb_build_object('payment_id',rest,'received_amount',700,'bank_transaction_reference',gen_random_uuid()));
 denied:=false;begin perform confirm_order_final_funds(a,oid,'{"verified":true,"note":"Unassigned Admin"}');exception when raise_exception then denied:=true;end;if not denied then raise exception 'Unassigned Admin impersonates responsible Staff full-funds confirmation';end if;
 perform confirm_order_final_funds(s2,oid,'{"verified":true,"note":"Private final reconciliation"}');
 perform confirm_order_final_funds(s2,oid,'{"verified":true,"note":"Retry"}');
 if (select confirmed_by from order_final_funds_confirmations where order_id=oid)<>s2 or (select amount from order_final_funds_confirmations where order_id=oid)<>1000 or (select status from orders where id=oid)='COMPLETED' then raise exception 'Full funds confirmation missing or prematurely completes order';end if;
 denied:=false;begin delete from order_final_funds_confirmations where order_id=oid;exception when raise_exception then denied:=true;end;if not denied then raise exception 'Full funds evidence deletable';end if;
 if exists(select 1 from conversation_messages where conversation_id=(select id from conversations where request_id=rid) and content like '%Private final reconciliation%') then raise exception 'Private final-funds note leaked';end if;
 if has_function_privilege('authenticated','commerce_finance_report(uuid,integer,integer,uuid,integer)','execute') or has_function_privilege('service_role','legacy_order_payment_action_028(uuid,uuid,text,jsonb)','execute') or has_table_privilege('authenticated','order_final_funds_confirmations','insert') then raise exception 'Financial bypass ACL exposed';end if;
end $$;
