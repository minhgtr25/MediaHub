do $$ declare auth_id uuid:=gen_random_uuid(); p uuid; c uuid; denied boolean; url text; begin
 insert into auth.users(id,email,raw_user_meta_data) values(auth_id,auth_id||'@example.invalid','{"full_name":"Avatar original"}');
 select id into p from profiles where auth_user_id=auth_id;
 update profiles set role='CREATOR',phone='123456' where id=p;
 insert into creator_profiles(profile_id,slug,display_name,title) values(p,gen_random_uuid()::text,'Avatar creator','Video') returning id into c;
 url:='https://mediahub.example.invalid/storage/v1/object/public/profile-avatars/'||p||'/'||gen_random_uuid()||'.png';
 perform save_profile_avatar(p,url);
 if (select avatar_url from creator_profiles where id=c)<>url then raise exception 'Creator public avatar did not synchronize'; end if;
 if (select full_name from profiles where id=p)<>'Avatar original' or (select phone from profiles where id=p)<>'123456' then raise exception 'Avatar update overwrote concurrent profile fields'; end if;
 denied:=false; begin perform save_profile_avatar(p,replace(url,p::text,gen_random_uuid()::text)); exception when others then denied:=true; end;
 if not denied then raise exception 'Avatar path of another profile was accepted'; end if;
 update profiles set active=false where id=p;
 denied:=false; begin perform save_profile_avatar(p,url); exception when others then denied:=true; end;
 if not denied then raise exception 'Suspended account updated avatar'; end if;
 if has_function_privilege('authenticated','public.save_profile_avatar(uuid,text)','EXECUTE') then raise exception 'Browser can forge avatar owner'; end if;
 if not exists(select 1 from storage.buckets where id='profile-avatars' and public and file_size_limit=5242880) then raise exception 'Avatar storage is not configured'; end if;
end $$;
