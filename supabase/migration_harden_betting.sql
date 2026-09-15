-- ============================================================
-- GAMENET — Hardening: policies + search_path (non-betting)
-- Run after migration_audit_fixes.sql — or standalone if audit already ran
-- Idempotent — safe to run multiple times
-- ============================================================

-- 1) Remove direct withdrawals INSERT (must use request_withdrawal)
drop policy if exists "withdrawals insert own" on public.withdrawals;

-- 2) Revoke direct table writes — only RPCs may write
revoke insert, update, delete on public.withdrawals from anon, authenticated;
revoke insert, update, delete on public.bets from anon, authenticated;
revoke insert, update, delete on public.transactions from anon, authenticated;
revoke insert, update, delete on public.notifications from anon, authenticated;

-- 3) Lock recalc_odds to internal only (SECURITY DEFINER callers)
revoke execute on function public.recalc_odds(uuid) from anon, authenticated, public;

-- 4) Fix search_path on helper SECURITY DEFINER functions (prevent search_path hijack)
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public, pg_temp
as $$ select coalesce((select is_admin from public.profiles where id = auth.uid()), false) $$;

create or replace function public.my_balance()
returns bigint language sql security definer stable set search_path = public, pg_temp
as $$ select coalesce((select balance from public.profiles where id = auth.uid()), 0) $$;

create or replace function public.is_username_available(p_username text)
returns boolean language sql security definer stable set search_path = public, pg_temp
as $$ select not exists(select 1 from public.profiles where username = lower(p_username)) $$;

create or replace function public.get_leaderboard()
returns table(username text, balance bigint)
language sql security definer stable set search_path = public, pg_temp
as $$ select username, balance from public.profiles order by balance desc limit 3 $$;

create or replace function public.get_withdrawal_counts()
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$ declare cP int; cA int; cR int; begin
  if not public.is_admin() then raise exception 'دسترسی غیرمجاز'; end if;
  select count(*) into cP from public.withdrawals where status='pending';
  select count(*) into cA from public.withdrawals where status='approved';
  select count(*) into cR from public.withdrawals where status='rejected';
  return jsonb_build_object('pending',cP,'approved',cA,'rejected',cR,'all',cP+cA+cR);
end $$;

grant execute on function public.get_withdrawal_counts() to authenticated;
grant execute on function public.get_leaderboard() to anon, authenticated;
