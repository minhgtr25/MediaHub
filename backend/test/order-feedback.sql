-- Called by the full, two-Creator delivery journey; all data rolls back.
create function pg_temp.verify_completed_feedback(admin_id uuid,customer_id uuid,staff_id uuid,creator_profile uuid,oid uuid,cx uuid,cy uuid) returns void language plpgsql as $$
declare denied boolean;input jsonb;first_time timestamptz;public_data jsonb;case_public_id uuid;legacy_id uuid:=gen_random_uuid();combined jsonb;legacy_total bigint;case_total bigint;path text:=oid::text||'/'||gen_random_uuid()::text||'.png';
begin
 input:=jsonb_build_object('show_name',false,'notice_version','EXCERPT_V1','rating',4,'content','Satisfied with result','creators',jsonb_build_array(jsonb_build_object('creator_id',cx,'rating',5,'content','Good video'),jsonb_build_object('creator_id',cy,'rating',4,'content','Good photo')));
 denied:=false;begin perform order_feedback_action(staff_id,oid,'review',input);exception when raise_exception then denied:=true;end;if not denied then raise exception 'Staff impersonates Customer rating';end if;
 denied:=false;begin perform order_feedback_action(admin_id,oid,'review',input);exception when raise_exception then denied:=true;end;if not denied then raise exception 'Admin impersonates Customer rating';end if;
 denied:=false;begin perform order_feedback_action(creator_profile,oid,'preference',input);exception when raise_exception then denied:=true;end;if not denied then raise exception 'Creator changes Customer privacy';end if;
 denied:=false;begin perform order_feedback_action(customer_id,oid,'review',input||jsonb_build_object('creators',jsonb_build_array(jsonb_build_object('creator_id',cx,'rating',5,'content','Only one'))));exception when raise_exception then denied:=true;end;if not denied then raise exception 'Review omits second Creator';end if;
 denied:=false;begin perform order_feedback_action(customer_id,oid,'review',input||jsonb_build_object('creators',jsonb_build_array(jsonb_build_object('creator_id',cx,'rating',5,'content','Repeat'),jsonb_build_object('creator_id',cx,'rating',5,'content','Repeat'))));exception when raise_exception then denied:=true;end;if not denied then raise exception 'Review duplicates Creator';end if;
 denied:=false;begin perform order_feedback_action(customer_id,oid,'review',input||'{"rating":6}');exception when raise_exception then denied:=true;end;if not denied then raise exception 'Invalid score accepted';end if;
 perform order_feedback_action(customer_id,oid,'review',input);
 public_data:=public_completed_creator_reviews((select slug from creator_profiles where id=cx),1);
 if public_data->>'total'<>'1' or public_data->>'rating'<>'5.0' or public_data->'items'->0->>'customer_name'<>'Khách hàng ẩn danh' or (public_data->'items'->0) ?| array['order_id','customer_profile_id','creator_id','order_sort_id'] then raise exception 'Anonymous review projection leaks identity or aggregates incorrectly';end if;
 select submitted_at into first_time from order_result_reviews where order_id=oid;
 perform order_feedback_action(customer_id,oid,'review',input||'{"rating":5,"content":"Edited result"}');
 if (select submitted_at from order_result_reviews where order_id=oid)<>first_time or (select rating from order_result_reviews where order_id=oid)<>5 or (select count(*) from order_creator_reviews where order_id=oid)<>2 then raise exception 'Edit resets 7-day clock/creates duplicate reviews';end if;
 if exists(select 1 from creator_reviews where reviewer_id=customer_id) then raise exception 'Private review identity copied to public legacy table';end if;
 insert into storage.objects(bucket_id,name,metadata) values('case-study-excerpts',path,'{"size":100,"mimetype":"image/png"}');
 perform order_feedback_action(admin_id,oid,'asset',jsonb_build_object('path',path));
 denied:=false;begin perform order_feedback_action(staff_id,oid,'publish',jsonb_build_object('title','Small excerpt','excerpt','Only a small part','image_path',path,'excerpt_checked',true,'identity_checked',true));exception when raise_exception then denied:=true;end;if not denied then raise exception 'Staff publishes case study';end if;
 denied:=false;begin perform order_feedback_action(admin_id,oid,'publish',jsonb_build_object('title','Small excerpt','excerpt','Only a small part','image_path',path,'excerpt_checked',true,'identity_checked',false));exception when raise_exception then denied:=true;end;if not denied then raise exception 'Publication skips anonymous identity check';end if;
 perform order_feedback_action(admin_id,oid,'publish',jsonb_build_object('title','Small excerpt','excerpt','Only a small part','image_path',path,'excerpt_checked',true,'identity_checked',true));
 if not (select published from order_case_studies where order_id=oid) then raise exception 'Admin approval not published';end if;
 public_data:=public_completed_case_studies(1);
 if not exists(select 1 from jsonb_array_elements(public_data->'items') item where item->>'title'='Small excerpt' and item->>'customer_name'='Khách hàng ẩn danh') or exists(select 1 from jsonb_array_elements(public_data->'items') item where item ?| array['order_id','order_sort_id','customer_profile_id','approved_by','total']) then raise exception 'Public case projection leaks private data';end if;

 -- Unified catalog assertions reuse this fully completed, two-Creator fixture.
 select public_id into case_public_id from order_case_studies where order_id=oid;
 if case_public_id=oid or public_company_excerpt(oid) is not null then raise exception 'Excerpt public route accepts a private order ID';end if;
 public_data:=public_company_excerpt(case_public_id);
 if public_data->>'customer_name'<>'Khách hàng ẩn danh' or public_data->>'title'<>'Small excerpt' or public_data ?| array['order_id','customer_profile_id','approved_by','total','request_id'] then raise exception 'Excerpt detail leaks private data';end if;
 insert into portfolio(id,slug,title,client,description,category,published,image_url) values
  (legacy_id,legacy_id::text,'Small excerpt / rollback portfolio marker','Public client','Literal % underscore _','Rollback video',true,'https://example.invalid/published.png'),
  (gen_random_uuid(),gen_random_uuid()::text,'Small excerpt / hidden rollback marker','Private client','','Rollback video',false,null);
 combined:=public_company_portfolio(1,1,'Small excerpt','','ALL');
 select (public_company_portfolio(1,12,'Small excerpt','','PORTFOLIO')->>'total')::bigint into legacy_total;
 select (public_company_portfolio(1,12,'Small excerpt','','EXCERPT')->>'total')::bigint into case_total;
 if (combined->>'total')::bigint<>legacy_total+case_total or jsonb_array_length(combined->'items')<>1
  or jsonb_array_length(public_company_portfolio(2,1,'Small excerpt','','ALL')->'items')<>1
  or combined->'items'->0->>'public_id'=public_company_portfolio(2,1,'Small excerpt','','ALL')->'items'->0->>'public_id' then raise exception 'Unified pagination total/order is inconsistent';end if;
 combined:=public_company_portfolio(1,6,'rollback portfolio marker','Rollback video','ALL');
 if combined->>'total'<>'1' or combined->'items'->0->>'public_id'<>legacy_id::text then raise exception 'Unified filters lose published legacy portfolio';end if;
 if public_company_portfolio(1,6,'hidden rollback marker','','ALL')->>'total'<>'0' then raise exception 'Unpublished legacy item leaks';end if;
 if public_company_portfolio(1,6,'Literal % underscore _','','ALL')->>'total'<>'1' then raise exception 'Search treats literal wildcard characters as patterns';end if;
 denied:=false;begin perform public_company_portfolio(0,6,'','','ALL');exception when raise_exception then denied:=true;end;if not denied then raise exception 'Invalid page accepted';end if;
 denied:=false;begin update order_case_studies set public_id=gen_random_uuid() where order_id=oid;exception when raise_exception then denied:=true;end;if not denied then raise exception 'Public identity changes after publication';end if;
 if has_function_privilege('anon','company_portfolio_projection()','execute') or has_function_privilege('authenticated','public_company_portfolio(integer,integer,text,text,text)','execute') or has_function_privilege('anon','public_company_excerpt(uuid)','execute') then raise exception 'Browser bypasses server-only portfolio projection';end if;
 perform order_feedback_action(customer_id,oid,'preference','{"show_name":true,"notice_version":"EXCERPT_V1"}');
 public_data:=public_completed_creator_reviews((select slug from creator_profiles where id=cx),1);
 if public_data->'items'->0->>'customer_name' is distinct from (select full_name from profiles where id=customer_id) then raise exception 'Named review ignores explicit preference';end if;
 if (select published from order_case_studies where order_id=oid) then raise exception 'Privacy change leaves previous image/text public';end if;
 if public_company_excerpt(case_public_id) is not null or exists(select 1 from jsonb_array_elements(public_company_portfolio(1,12,'Small excerpt','','EXCERPT')->'items') item where item->>'public_id'=case_public_id::text) then raise exception 'Privacy change leaves public detail/list accessible';end if;
 perform order_feedback_action(admin_id,oid,'publish',jsonb_build_object('title','Small excerpt','excerpt','Only a small part','image_path',path,'excerpt_checked',true,'identity_checked',true));
 perform order_feedback_action(admin_id,oid,'withdraw','{}');
 if (select published from order_case_studies where order_id=oid) then raise exception 'Withdrawal failed';end if;
 if (select public_id from order_case_studies where order_id=oid)<>case_public_id or public_company_excerpt(case_public_id) is not null then raise exception 'Republishing resets identity or withdrawn detail remains public';end if;
 -- Simulate passage of time inside the rollback-only test fixture.
 alter table order_result_reviews disable trigger result_feedback_guard;
 update order_result_reviews set submitted_at=clock_timestamp()-interval '8 days' where order_id=oid;
 alter table order_result_reviews enable trigger result_feedback_guard;
 denied:=false;begin perform order_feedback_action(customer_id,oid,'review',input);exception when raise_exception then denied:=true;end;if not denied then raise exception 'Review edited after 7-day window';end if;
 perform order_feedback_action(customer_id,oid,'preference','{"show_name":false,"notice_version":"EXCERPT_V1"}');
 denied:=false;begin update order_result_reviews set submitted_at=clock_timestamp() where order_id=oid;exception when raise_exception then denied:=true;end;if not denied then raise exception 'Review clock is mutable';end if;
 if has_function_privilege('anon','public_completed_creator_reviews(text,integer)','execute') or has_function_privilege('authenticated','public_completed_case_studies(integer)','execute') or has_table_privilege('anon','order_result_reviews','select') or has_table_privilege('authenticated','order_creator_reviews','select') or has_function_privilege('authenticated','order_feedback_action(uuid,uuid,text,jsonb)','execute') then raise exception 'Anonymous/private review identity bypass exposed';end if;
 if (select count(*) from audit_logs where entity='order_feedback' and entity_id=oid and action='ORDER_CUSTOMER_REVIEW')<>2 then raise exception 'Review revision audit missing';end if;
end $$;
