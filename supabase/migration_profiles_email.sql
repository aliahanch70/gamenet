-- add email to profiles (ponytail: mirror auth.users.email for admin search/display)
alter table public.profiles add column if not exists email text;
-- backfill existing rows from auth.users
update public.profiles p set email = u.email from auth.users u where u.id = p.id and p.email is null;
-- keep handle_new_user in sync (also in schema.sql)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
declare v_username text; v_display text; v_suffix text; v_count int;
begin
  v_username := lower(replace(coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)),' ',''));
  v_display  := coalesce(new.raw_user_meta_data->>'display_name', v_username);
  if exists(select 1 from public.profiles where username=v_username) then
    v_suffix:=substr(new.id::text,1,4); v_count:=0;
    while exists(select 1 from public.profiles where username=v_username||v_suffix||case when v_count>0 then v_count::text else '' end) loop v_count:=v_count+1; end loop;
    v_username:=v_username||v_suffix||case when v_count>0 then v_count::text else '' end;
  end if;
  insert into public.profiles(id,username,display_name,email) values(new.id,v_username,v_display,new.email);
  return new;
exception when unique_violation then
  v_username:=v_username||substr(md5(random()::text),1,6);
  insert into public.profiles(id,username,display_name,email) values(new.id,v_username,v_display,new.email);
  return new;
end; $$;
