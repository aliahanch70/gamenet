-- ============================================================
-- GAMENET — Perf indexes + get_admin_stats RPC
-- Run in Supabase SQL Editor after schema.sql
-- ponytail: 8 indexes on hot paths; one RPC replaces 4 admin queries
-- ============================================================

-- 1) matches(status, starts_at) — admin filter + upcoming list
create index if not exists idx_matches_status_starts on public.matches(status, starts_at);

-- 2) bets(user_id, status, created_at) — user history + filter
create index if not exists idx_bets_user_status_created on public.bets(user_id, status, created_at desc);

-- 3) bets(match_id, status) — exposure + settle + recalc
create index if not exists idx_bets_match_status on public.bets(match_id, status);

-- 4) transactions(user_id, created_at) — wallet history
create index if not exists idx_tx_user_created on public.transactions(user_id, created_at desc);

-- 5) withdrawals(status, created_at) — admin pending queue
create index if not exists idx_wd_status_created on public.withdrawals(status, created_at desc);

-- 6) withdrawals(user_id) — user withdrawal history
create index if not exists idx_wd_user on public.withdrawals(user_id);

-- 7) profiles(created_at) — admin user list ordering
create index if not exists idx_profiles_created on public.profiles(created_at desc);

-- 8) site_settings(id) — single-row lookup (primary key already covers, create for explicitness if missing)
create unique index if not exists idx_site_settings_id on public.site_settings(id);

-- ── RPC: get_admin_stats ───────────────────────────────────
-- Replaces 4+ queries in Admin.tsx (users count, pending bets, pending withdrawals, totals)
create or replace function public.get_admin_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_users int;
  v_pending_bets int;
  v_pending_wd int;
  v_total_bets int;
  v_total_matches int;
  v_total_stakes bigint;
  v_total_paid bigint;
begin
  if not public.is_admin() then raise exception 'دسترسی غیرمجاز'; end if;

  select count(*) into v_users from public.profiles;
  select count(*) into v_pending_bets from public.bets where status='pending';
  select count(*) into v_pending_wd from public.withdrawals where status='pending';
  select count(*) into v_total_bets from public.bets;
  select count(*) into v_total_matches from public.matches;
  select coalesce(sum(amount),0) into v_total_stakes from public.bets where status in ('won','lost');
  select coalesce(sum(potential_payout),0) into v_total_paid from public.bets where status='won';

  return jsonb_build_object(
    'total_users', v_users,
    'pending_bets', v_pending_bets,
    'pending_withdrawals', v_pending_wd,
    'total_bets', v_total_bets,
    'total_matches', v_total_matches,
    'total_stakes', v_total_stakes,
    'total_paid', v_total_paid,
    'profit', v_total_stakes - v_total_paid
  );
end;
$$;

grant execute on function public.get_admin_stats() to authenticated;

-- Example usage:
-- select public.get_admin_stats();
-- RPC from client: supabase.rpc('get_admin_stats')
