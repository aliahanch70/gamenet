-- ========== MIGRATION: سود تضمینی + حذف مسابقه (روی دیتابیس موجود) ==========
-- در Supabase → SQL Editor یک‌بار Run کن. نصب تازه نیازی ندارد (schema.sql دارد)
do $$ begin create type odds_mode as enum ('manual','auto'); exception when duplicate_object then null; end $$;
alter table public.matches add column if not exists odds_mode odds_mode not null default 'manual';
alter table public.matches add column if not exists margin numeric(4,3) not null default 0.05 check (margin >=0 and margin <0.5);

create or replace function public.recalc_odds(p_match_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare v_mode odds_mode; v_margin numeric; v_total bigint; v_a bigint; v_b bigint; v_d bigint; v_oa numeric; v_ob numeric; v_od numeric;
begin
  select odds_mode, margin into v_mode, v_margin from public.matches where id=p_match_id;
  if v_mode <> 'auto' then return; end if;
  select coalesce(sum(amount),0) into v_total from public.bets where match_id=p_match_id;
  if v_total = 0 then return; end if;
  select coalesce(sum(amount) filter (where pick='team_a'),0),
         coalesce(sum(amount) filter (where pick='team_b'),0),
         coalesce(sum(amount) filter (where pick='draw'),0)
    into v_a, v_b, v_d from public.bets where match_id=p_match_id;
  if v_a > 0 then v_oa := greatest(1.10, least(20, (v_total::numeric / v_a) * (1 - v_margin))); else v_oa := null; end if;
  if v_b > 0 then v_ob := greatest(1.10, least(20, (v_total::numeric / v_b) * (1 - v_margin))); else v_ob := null; end if;
  if v_d > 0 then v_od := greatest(1.10, least(20, (v_total::numeric / v_d) * (1 - v_margin))); else v_od := null; end if;
  update public.matches set
    odds_a = coalesce(v_oa, odds_a),
    odds_b = coalesce(v_ob, odds_b),
    odds_draw = case when odds_draw is not null then coalesce(v_od, odds_draw) else null end
  where id=p_match_id;
end; $$;

create or replace function public.delete_match(p_match_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare r record;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  for r in select * from public.bets where match_id=p_match_id and status='pending' loop
    update public.profiles set balance = balance + r.amount where id=r.user_id;
    insert into public.transactions (user_id, amount, type, note, created_by) values (r.user_id, r.amount, 'refund', 'refund match deleted '||p_match_id::text, auth.uid());
  end loop;
  delete from public.matches where id=p_match_id;
  if not found then raise exception 'match not found'; end if;
end; $$;

-- place_bet با تضمین سود خانه
create or replace function public.place_bet(p_match_id uuid, p_pick bet_pick, p_amount bigint)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_odds numeric(5,2); v_match_status match_status; v_bet_id uuid; v_payout bigint; v_bal bigint;
        v_mode odds_mode; v_margin numeric; v_total bigint; v_liab_a bigint; v_liab_b bigint; v_liab_d bigint; v_old_liab bigint; v_max_odds numeric;
begin
  if p_amount <= 0 then raise exception 'amount must be > 0'; end if;
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select status, margin, odds_mode,
         case p_pick when 'team_a' then odds_a when 'team_b' then odds_b else odds_draw end
    into v_match_status, v_margin, v_mode, v_odds from public.matches where id = p_match_id;
  if not found then raise exception 'match not found'; end if;
  if v_match_status <> 'upcoming' then raise exception 'match not open for betting'; end if;
  if v_odds is null then raise exception 'odds not available for this pick'; end if;
  select balance into v_bal from public.profiles where id = auth.uid() for update;
  if v_bal < p_amount then raise exception 'insufficient balance'; end if;
  if v_mode = 'auto' then
    select coalesce(sum(amount),0) into v_total from public.bets where match_id=p_match_id;
    select coalesce(sum(potential_payout) filter (where pick='team_a' and status='pending'),0),
           coalesce(sum(potential_payout) filter (where pick='team_b' and status='pending'),0),
           coalesce(sum(potential_payout) filter (where pick='draw' and status='pending'),0)
      into v_liab_a, v_liab_b, v_liab_d from public.bets where match_id=p_match_id;
    v_old_liab := case p_pick when 'team_a' then v_liab_a when 'team_b' then v_liab_b else v_liab_d end;
    v_max_odds := ((v_total + p_amount)::numeric * (1 - v_margin) - v_old_liab::numeric) / p_amount::numeric;
    v_max_odds := greatest(1.10, least(v_odds::numeric, v_max_odds));
    if v_max_odds < 1.10 then raise exception 'book unbalanced — try smaller amount'; end if;
    if v_odds::numeric > v_max_odds then v_odds := round(v_max_odds,2); end if;
  end if;
  v_payout := floor(p_amount * v_odds);
  update public.profiles set balance = balance - p_amount where id = auth.uid();
  insert into public.bets (user_id, match_id, pick, amount, odds, potential_payout)
  values (auth.uid(), p_match_id, p_pick, p_amount, v_odds, v_payout) returning id into v_bet_id;
  insert into public.transactions (user_id, amount, type, note) values (auth.uid(), -p_amount, 'bet', 'bet '||v_bet_id::text);
  perform public.recalc_odds(p_match_id);
  return v_bet_id;
end; $$;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.profiles to anon, authenticated;
grant select, insert, update, delete on public.matches to anon, authenticated;
grant select, insert, update, delete on public.bets to anon, authenticated;
grant select, insert, update, delete on public.transactions to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.my_balance() to anon, authenticated;
grant execute on function public.recalc_odds(uuid) to anon, authenticated;
grant execute on function public.delete_match(uuid) to authenticated;
grant execute on function public.place_bet(uuid, bet_pick, bigint) to authenticated;
grant execute on function public.settle_match(uuid, bet_pick) to authenticated;
grant execute on function public.charge_wallet(uuid, bigint) to authenticated;

-- مسابقه‌های auto موجود را ترمیم کن
select public.recalc_odds(id) from public.matches where odds_mode='auto';
