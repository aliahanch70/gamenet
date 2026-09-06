-- ===================== FIX: ادمین دسترسی ندارد =====================
-- در Supabase Dashboard > SQL Editor همین فایل را Run کن (با همان کاربری که ادمین می‌خواهی)
-- 1) ببین با کدام اکانت لاگین هستی و پروفایلت چیست:
select auth.uid() as my_uid, auth.email() as my_email;

select id, username, display_name, is_admin, balance
from public.profiles where id = auth.uid();

-- 2) خودت را ادمین کن (مطمئن‌ترین حالت — نیازی به دانستن username/UUID نیست):
update public.profiles set is_admin = true where id = auth.uid();

-- 3) تایید:
select id, username, is_admin from public.profiles where id = auth.uid();
select public.is_admin() as am_i_admin_now;  -- باید true شود

-- اگر هنوز false بود — یعنی RLS یا تابع is_admin خراب است، این پچ را هم Run کن:
create or replace function public.is_admin() returns boolean
language sql security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and is_admin = true)
$$;
-- و پالیسی خواندن پروفایل را ترمیم کن:
drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read" on public.profiles for select using (true);

-- 4) بعد از Run، در سایت بدون خروج روی "بررسی دوباره" بزن یا صفحه را رفرش کن.
