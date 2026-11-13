-- migration_fix_draw.sql — fix: draw market must stay null when not entered
-- Root cause: matches.odds_draw had DEFAULT 3.00, so empty draw became 3.00 and recalc revived it.

-- 1) Drop default on draw odds (null = no draw market)
alter table public.matches alter column odds_draw drop default;
alter table public.matches alter column init_odds_draw drop default;

-- 2) Define draw as absent wherever it was auto-filled 3.00 without bets
-- Only revert matches that never had a draw pick? Conservative: keep as-is, future inserts fixed.
-- If you want to retro-fix 3.00 rows with zero draw bets to null, uncomment:
-- update public.matches m set odds_draw = null, init_odds_draw = null
-- where m.odds_draw = 3.00 and not exists (select 1 from public.bets b where b.match_id = m.id and b.pick = 'draw');

-- 3) Re-create recalc_odds to preserve null draw (null stays null, never auto-creates 3.00)
drop function if exists public.recalc_odds(uuid) cascade;
create or replace function public.recalc_odds(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_margin    numeric;
  v_init_a    numeric;
  v_init_b    numeric;
  v_init_d    numeric;
  v_sum_a     numeric := 0;
  v_sum_b     numeric := 0;
  v_sum_d     numeric := 0;
  v_new_a     numeric;
  v_new_b     numeric;
  v_new_d     numeric;
  v_mode      public.odds_mode;
  V           constant numeric := 2000000;
begin
  select odds_mode into v_mode from public.matches where id = p_match_id;
  if v_mode != 'auto' then return; end if;

  select margin, init_odds_a, init_odds_b, init_odds_draw
  into v_margin, v_init_a, v_init_b, v_init_d
  from public.matches where id = p_match_id;

  -- Sum pending bets per pick
  select coalesce(sum(amount), 0) into v_sum_a from public.bets where match_id = p_match_id and pick = 'team_a' and status = 'pending';
  select coalesce(sum(amount), 0) into v_sum_b from public.bets where match_id = p_match_id and pick = 'team_b' and status = 'pending';
  select coalesce(sum(amount), 0) into v_sum_d from public.bets where match_id = p_match_id and pick = 'draw' and status = 'pending';

  -- Virtual pool proportional to init odds — draw market only if init draw exists (null = no draw)
  if v_init_a is not null and v_init_a > 0 and v_init_b is not null and v_init_b > 0 then
    declare
      v_va numeric := floor(V * (1 - v_margin) / v_init_a);
      v_vb numeric := floor(V * (1 - v_margin) / v_init_b);
      v_has_draw boolean := (v_init_d is not null and v_init_d > 0);
      v_vd numeric := case when v_has_draw then floor(V * (1 - v_margin) / v_init_d) else 0 end;
      v_total numeric := v_sum_a + v_sum_b + coalesce(case when v_has_draw then v_sum_d else 0 end, 0) + V;
    begin
      v_new_a := (v_total) / (v_sum_a + v_va) * (1 - v_margin);
      v_new_b := (v_total) / (v_sum_b + v_vb) * (1 - v_margin);
      if v_has_draw then
        v_new_d := (v_total) / (v_sum_d + v_vd) * (1 - v_margin);
      else
        v_new_d := null;
      end if;
    end;
  else
    -- Fallback: equal split — no draw if none existed
    declare
      v_total numeric := v_sum_a + v_sum_b + V;
      v_side  numeric := V / 3;
    begin
      v_new_a := (v_total) / (v_sum_a + v_side) * (1 - v_margin);
      v_new_b := (v_total) / (v_sum_b + v_side) * (1 - v_margin);
      v_new_d := null;
    end;
  end if;

  -- Clamp — keep null draw as null
  v_new_a := GREATEST(1.10, LEAST(20.00, v_new_a));
  v_new_b := GREATEST(1.10, LEAST(20.00, v_new_b));
  if v_new_d is not null then v_new_d := GREATEST(1.10, LEAST(20.00, v_new_d)); end if;

  update public.matches
  set odds_a = round(v_new_a, 2),
      odds_b = round(v_new_b, 2),
      odds_draw = case when v_new_d is null then null else round(v_new_d, 2) end
  where id = p_match_id;
end;
$$;

grant execute on function public.recalc_odds(uuid) to authenticated;
revoke execute on function public.recalc_odds(uuid) from anon, authenticated, public; -- internal only
