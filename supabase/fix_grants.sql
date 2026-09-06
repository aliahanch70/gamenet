-- ===================== FIX: permission denied for table matches =====================
-- این را در Supabase → SQL Editor یک‌بار Run کن (روی دیتابیس موجود)
-- روی نصب تازه نیازی نیست — schema.sql جدید خودش GRANTها را دارد

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.profiles to anon, authenticated;
grant select, insert, update, delete on public.matches to anon, authenticated;
grant select, insert, update, delete on public.bets to anon, authenticated;
grant select, insert, update, delete on public.transactions to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.my_balance() to anon, authenticated;
grant execute on function public.recalc_odds(uuid) to anon, authenticated;
grant execute on function public.place_bet(uuid, bet_pick, bigint) to authenticated;
grant execute on function public.settle_match(uuid, bet_pick) to authenticated;
grant execute on function public.charge_wallet(uuid, bigint) to authenticated;

-- تست سریع: باید بدون خطا اجرا شود
select * from public.matches limit 1;
select public.is_admin();
