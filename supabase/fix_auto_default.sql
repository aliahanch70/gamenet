-- ========== FIX: سیستمی دیفالت + ضریب اولیه حفظ شود ==========
-- در Supabase → SQL Editor یک‌بار Run کن.
alter table public.matches alter column odds_mode set default 'auto';
-- ستون‌های ضریب اولیه (برای نمایش ثابت اگر خواستی)
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
-- موجودها: اگر auto ولی init خالیه، پر کن
update public.matches set init_odds_a=odds_a, init_odds_b=odds_b, init_odds_draw=odds_draw where odds_mode='auto' and init_odds_a is null;
