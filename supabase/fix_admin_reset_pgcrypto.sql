-- fix gen_salt(unknown) does not exist — ponytail: pgcrypto lives in extensions on Supabase
create extension if not exists "pgcrypto";
create or replace function public.admin_reset_password(p_user_id uuid, p_new_password text)
returns void language plpgsql security definer set search_path = public, auth, extensions, pgcrypto as $$
begin
  if not public.is_admin() then raise exception 'دسترسی غیرمجاز'; end if;
  if char_length(p_new_password) < 6 then raise exception 'رمز باید حداقل ۶ کاراکتر باشد'; end if;
  if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'کاربر یافت نشد'; end if;
  update auth.users set encrypted_password=crypt(p_new_password, gen_salt('bf')), updated_at=now() where id=p_user_id;
  insert into public.notifications(user_id,title,body) values(p_user_id,'🔑 رمز شما بازنشانی شد','رمز عبور توسط مدیر بازنشانی شد. با رمز جدید وارد شوید.');
end; $$;
grant execute on function public.admin_reset_password(uuid,text) to authenticated;
