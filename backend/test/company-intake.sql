-- Run only inside the migration runner's rollback transaction/savepoint.
do $$
declare aid uuid:=gen_random_uuid(); uid uuid:=gen_random_uuid(); sid uuid:=gen_random_uuid(); crid uuid:=gen_random_uuid();
 ap uuid; cp uuid; sp uuid; crp uuid; cid uuid; application uuid:=gen_random_uuid(); contact uuid:=gen_random_uuid();
 profiles_before bigint; projects_before bigint; path text; denied boolean;
begin
 insert into auth.users(id,email,raw_user_meta_data) values
 (aid,aid::text||'@example.invalid','{"full_name":"Intake admin"}'),
 (uid,uid::text||'@example.invalid','{"full_name":"Intake customer"}'),
 (sid,sid::text||'@example.invalid','{"full_name":"Intake staff"}'),
 (crid,crid::text||'@example.invalid','{"full_name":"Intake creator"}');
 select id into ap from profiles where auth_user_id=aid;
 select id into cp from profiles where auth_user_id=uid;
 select id into sp from profiles where auth_user_id=sid;
 select id into crp from profiles where auth_user_id=crid;
 update profiles set role='ADMIN' where id=ap;
 update profiles set role='STAFF' where id=sp;
 update profiles set role='CREATOR' where id=crp;
 select id into cid from customers where profile_id=cp;
 select count(*) into profiles_before from profiles;
 select count(*) into projects_before from projects;
 path:=application::text||'/cv.pdf';
 insert into leads(id,full_name,email,message,source,applicant_type,specialty,portfolio_urls,attachment_path,attachment_name,attachment_size)
 values(application,'Application fixture',(select email from profiles where id=cp),'Private introduction','CREATOR_APPLICATION','STUDENT','Video',array['https://example.invalid/portfolio'],path,'cv.pdf',100);
 insert into leads(id,full_name,email,company,message,source)
 values(contact,'Business fixture','company@example.invalid','Fixture company','Private campaign','BUSINESS_CONTACT');
 if (select count(*) from profiles)<>profiles_before or (select count(*) from projects)<>projects_before then raise exception 'Intake created an account or project';end if;
 if (select role from profiles where id=cp)<>'CUSTOMER' then raise exception 'Application changed existing user role';end if;
 if not exists(select 1 from notifications where user_id=ap and type='NEW_LEAD' and title='Hồ sơ ứng tuyển Creator') then raise exception 'Admin was not notified of application';end if;
 if exists(select 1 from notifications where user_id in(cp,sp,crp) and type='NEW_LEAD') then raise exception 'Applicant or staff received private intake notification';end if;
 if (select public from storage.buckets where id='lead-attachments') then raise exception 'CV storage bucket is public';end if;
 insert into storage.objects(bucket_id,name) values('lead-attachments',path);

 denied:=false;begin
  insert into leads(full_name,email,message,source,applicant_type,specialty,portfolio_urls)
  values('Missing CV','missing@example.invalid','Private','CREATOR_APPLICATION','CREATOR','Video',array['https://example.invalid']);
 exception when check_violation then denied:=true;end;
 if not denied then raise exception 'Application without CV accepted';end if;
 denied:=false;begin update leads set portfolio_urls=array['javascript:alert(1)'] where id=application;exception when check_violation then denied:=true;end;
 if not denied then raise exception 'Unsafe portfolio URL accepted';end if;
 denied:=false;begin update leads set applicant_type='ADMIN' where id=application;exception when check_violation then denied:=true;end;
 if not denied then raise exception 'Applicant classification accepted an account role';end if;
 denied:=false;begin update leads set company='' where id=contact;exception when check_violation then denied:=true;end;
 if not denied then raise exception 'Business contact without company accepted';end if;
 denied:=false;begin perform convert_lead(ap,application,cid);exception when check_violation then denied:=true;end;
 if not denied then raise exception 'Creator application converted to customer';end if;
 if (select status from leads where id=application)<>'NEW' then raise exception 'Failed conversion left partial state';end if;
 if (select count(*) from projects)<>projects_before then raise exception 'Failed conversion created a project';end if;

 perform set_config('request.jwt.claim.sub',uid::text,true);
 execute 'set local role authenticated';
 if exists(select 1 from leads where id in(application,contact)) then raise exception 'Customer can see private application';end if;
 if exists(select 1 from storage.objects where bucket_id='lead-attachments' and name=path) then raise exception 'Customer can read CV object';end if;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',sid::text,true);
 execute 'set local role authenticated';
 if exists(select 1 from leads where id=application) then raise exception 'Staff can see private application';end if;
 if exists(select 1 from storage.objects where bucket_id='lead-attachments' and name=path) then raise exception 'Staff can read CV object';end if;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',crid::text,true);
 execute 'set local role authenticated';
 if exists(select 1 from leads where id=application) then raise exception 'Creator can see another application';end if;
 if exists(select 1 from storage.objects where bucket_id='lead-attachments' and name=path) then raise exception 'Creator can read CV object';end if;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',aid::text,true);
 execute 'set local role authenticated';
 if not exists(select 1 from leads where id=application and specialty='Video') then raise exception 'Admin cannot see application';end if;
 execute 'reset role';
 execute 'set local role anon';
 denied:=false;begin perform 1 from leads;exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Anonymous role has direct intake table access';end if;
 if exists(select 1 from storage.objects where bucket_id='lead-attachments' and name=path) then raise exception 'Guest can read CV object';end if;
 execute 'reset role';
end $$;
