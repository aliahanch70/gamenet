-- ========== FIX: Database error saving new user (duplicate username) ==========
-- در Supabase → SQL Editor یک‌بار Run کن. نصب تازه نیازی ندارد (schema.sql جدید درست است).

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_username text; v_display text; v_taken boolean;
begin
  v_username := coalesce(nullif(btrim(coalesce(new.raw_user_meta_data->>'username','')), ''), split_part(new.email,'@',1));
  v_display  := coalesce(nullif(btrim(coalesce(new.raw_user_meta_data->>'display_name','')), ''), v_username);
  select exists(select 1 from public.profiles where username = v_username) into v_taken;
  if v_taken then v_username := v_username || '_' || substr(new.id::text,1,4); end if;
  begin
    insert into public.profiles (id, username, display_name) values (new.id, v_username, v_display);
  exception when unique_violation then
    insert into public.profiles (id, username, display_name) values (new.id, v_username || substr(new.id::text,5,4), v_display) on conflict (id) do nothing;
  end;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_username_available(p_username text) returns boolean
language sql security definer set search_path=public as $$
  select not exists(select 1 from public.profiles where username = btrim(p_username))
$$;
grant execute on function public.is_username_available(text) to anon, authenticated;
