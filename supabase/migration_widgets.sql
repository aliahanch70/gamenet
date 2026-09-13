-- ponytail: idempotent — safe to run multiple times
alter table public.site_settings add column if not exists widgets jsonb default '[]'::jsonb;
update public.site_settings set widgets='[]'::jsonb where widgets is null;

-- ── leaderboard public (top 3 by balance) ───────────────────
create or replace function public.get_leaderboard()
returns table(username text, balance bigint)
language sql security definer stable
as $$ select username, balance from public.profiles order by balance desc limit 3 $$;
grant execute on function public.get_leaderboard() to anon, authenticated;
