-- FIX: باز کردن درخواست برداشت — تریگر فقط id/is_admin را می‌بندد، موجودی آزاد است
create or replace function public.prevent_profile_hack() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.id is distinct from old.id or new.is_admin is distinct from old.is_admin then
    if not public.is_admin() then raise exception 'تغییر موجودی یا دسترسی مجاز نیست'; end if;
  end if;
  return new;
end; $$;
drop trigger if exists trg_prevent_profile_hack on public.profiles;
create trigger trg_prevent_profile_hack before update on public.profiles for each row execute function public.prevent_profile_hack();
