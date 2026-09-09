-- CRITICAL FIX — بستن حفره تغییر موجودی
-- هر کاربر می‌توانست با .from('profiles').update({balance: 999999}) موجودی را جعل کند
-- اجرا: Supabase Dashboard → SQL Editor → Paste & Run
-- ponytail: trigger per-row — جلوی تغییر balance/is_admin/id برای غیرادمین

-- 1) سخت کردن RLS: فقط username/display_name قابل تغییر برای خود کاربر
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own"
  on public.profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and balance = (select p.balance from public.profiles p where p.id = auth.uid())
    and is_admin = (select p.is_admin from public.profiles p where p.id = auth.uid())
  );

-- 2) لایه دوم: trigger — حتی اگر policy دور زده شود
create or replace function public.prevent_profile_hack()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id is distinct from old.id
     or new.balance is distinct from old.balance
     or new.is_admin is distinct from old.is_admin then
    if not public.is_admin() then
      raise exception 'تغییر موجودی یا دسترسی مجاز نیست';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_profile_hack on public.profiles;
create trigger trg_prevent_profile_hack
  before update on public.profiles
  for each row execute function public.prevent_profile_hack();
