begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('profile-avatars','profile-avatars',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
-- Upload/update is via the authenticated API, not direct browser object writes.
create function public.sync_creator_avatar() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.avatar_url is distinct from old.avatar_url and new.role in ('CREATOR','STUDENT_CREATOR') then
  update creator_profiles set avatar_url=new.avatar_url where profile_id=new.id;
 end if;
 return new;
end $$;
create trigger creator_account_avatar after update of avatar_url on profiles for each row execute function sync_creator_avatar();
revoke all on function sync_creator_avatar() from public,anon,authenticated,service_role;
create function public.save_profile_avatar(actor_id uuid,image_url text) returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from profiles where id=actor_id and active) then raise exception 'Tài khoản không hoạt động.'; end if;
 if image_url !~ ('^https://[^[:space:]]+/storage/v1/object/public/profile-avatars/'||actor_id||'/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$') then raise exception 'Ảnh đại diện không thuộc tài khoản.'; end if;
 perform set_config('app.actor',actor_id::text,true);
 update profiles set avatar_url=image_url where id=actor_id;
 insert into audit_logs(actor_id,action,entity,entity_id) values(actor_id,'PROFILE_AVATAR_UPDATED','profiles',actor_id);
 return jsonb_build_object('avatar_url',image_url);
end $$;
revoke all on function save_profile_avatar(uuid,text) from public,anon,authenticated;
grant execute on function save_profile_avatar(uuid,text) to service_role;
commit;
