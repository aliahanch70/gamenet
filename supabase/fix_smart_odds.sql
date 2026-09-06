-- ========== FIX SMART ODDS v3: ضریب هوشمند — حفظ نسبت اولیه 1.6/2.0، جهت درست ==========
-- در Supabase → SQL Editor یک‌بار Run کن. نصب تازه نیازی ندارد (schema.sql به‌روز شد).
-- مشکل قبلی: V مساوی بین دو تیم تقسیم می‌شد → 1.6/2.0 بعد اولین شرط برعکس می‌شد (1.74/1.82)
-- فیکس: سهم مجازی هر تیم متناسب با init_odds (مثل بوکمیکر واقعی) → جهت درست + پایدار

-- 1) ستون‌ها اگر نیست
alter table public.matches add column if not exists init_odds_a numeric(5,2);
alter table public.matches add column if not exists init_odds_b numeric(5,2);
alter table public.matches add column if not exists init_odds_draw numeric(5,2);
create or replace function public.set_init_odds() returns trigger language plpgsql as $$
begin
  if new.odds_mode='auto' then
    new.init_odds_a := coalesce(new.init_odds_a, new.odds_a);
    new.init_odds_b := coalesce(new.init_odds_b, new.odds_b);
    new.init_odds_draw := coalesce(new.init_odds_draw, new.odds_draw);
  end if;
  return new;
end; $$;
drop trigger if exists trg_set_init_odds on public.matches;
create trigger trg_set_init_odds before insert or update on public.matches for each row execute function public.set_init_odds();
update public.matches set init_odds_a=odds_a, init_odds_b=odds_b, init_odds_draw=odds_draw where odds_mode='auto' and init_odds_a is null;

-- 2) recalc هوشمند
create or replace function public.recalc_odds(p_match_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare v_mode odds_mode; v_margin numeric; v_total bigint; v_a bigint; v_b bigint; v_d bigint; v_oa numeric; v_ob numeric; v_od numeric; v_has_draw boolean;
  V bigint := 2000000; v_va bigint; v_vb bigint; v_vd bigint; v_ia numeric; v_ib numeric; v_id numeric;
begin
  select odds_mode, margin, (odds_draw is not null), init_odds_a, init_odds_b, init_odds_draw into v_mode, v_margin, v_has_draw, v_ia, v_ib, v_id from public.matches where id=p_match_id;
  if v_mode <> 'auto' then return; end if;
  select coalesce(sum(amount),0) into v_total from public.bets where match_id=p_match_id and status='pending';
  select coalesce(sum(amount) filter (where pick='team_a'),0), coalesce(sum(amount) filter (where pick='team_b'),0), coalesce(sum(amount) filter (where pick='draw'),0) into v_a, v_b, v_d from public.bets where match_id=p_match_id and status='pending';
  if v_ia is not null and v_ib is not null and v_ia >= 1.01 and v_ib >= 1.01 then
    v_va := greatest(1000, floor(V * (1 - v_margin) / v_ia)::bigint);
    v_vb := greatest(1000, floor(V * (1 - v_margin) / v_ib)::bigint);
    if v_has_draw and v_id is not null and v_id >= 1.01 then v_vd := greatest(1000, floor(V * (1 - v_margin) / v_id)::bigint); else v_vd := 0; end if;
  else
    v_va := case when v_has_draw then V/3 else V/2 end; v_vb := case when v_has_draw then V/3 else V/2 end; v_vd := case when v_has_draw then V/3 else 0 end;
  end if;
  v_oa := greatest(1.10, least(20, ((v_total+V)::numeric / (v_a+v_va)) * (1 - v_margin)));
  v_ob := greatest(1.10, least(20, ((v_total+V)::numeric / (v_b+v_vb)) * (1 - v_margin)));
  if v_has_draw then v_od := greatest(1.10, least(20, ((v_total+V)::numeric / (v_d+v_vd)) * (1 - v_margin))); else v_od := null; end if;
  update public.matches set odds_a=v_oa, odds_b=v_ob, odds_draw=case when v_has_draw then v_od else null end where id=p_match_id;
end; $$;
