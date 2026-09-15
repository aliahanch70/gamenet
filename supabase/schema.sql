-- ============================================================
-- GAMENET — Complete Supabase Schema
-- Tables: 7 | Enums: 6 | Functions: 14+ | RLS + Triggers
-- ============================================================

-- ── Enums ──────────────────────────────────────────────────
create type public.match_status as enum ('upcoming', 'live', 'finished');
create type public.bet_pick as enum ('team_a', 'team_b', 'draw');
create type public.bet_status as enum ('pending', 'won', 'lost', 'refunded');
create type public.tx_type as enum ('charge', 'bet', 'win', 'refund', 'withdrawal');
create type public.withdrawal_status as enum ('pending', 'approved', 'rejected');
create type public.odds_mode as enum ('manual', 'auto');

-- ── 1. profiles ───────────────────────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique not null,
  display_name text,
  email       text,
  phone       text,
  is_admin    boolean default false,
  balance     bigint default 0 check (balance >= 0),
  created_at  timestamptz default now()
);
alter table public.profiles enable row level security;

-- ── 2. matches ────────────────────────────────────────────
create table public.matches (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  game           text not null,
  team_a         text not null,
  team_b         text not null,
  status         public.match_status default 'upcoming',
  odds_a         numeric(5,2) default 1.50,
  odds_b         numeric(5,2) default 2.50,
  odds_draw      numeric(5,2) default 3.00,
  odds_mode      public.odds_mode default 'auto',
  margin         numeric(4,3) default 0.05,
  winner         public.bet_pick,
  starts_at      timestamptz not null,
  init_odds_a    numeric,
  init_odds_b    numeric,
  init_odds_draw numeric,
  created_at     timestamptz default now()
);
alter table public.matches enable row level security;

-- ── 3. bets ───────────────────────────────────────────────
create table public.bets (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id),
  match_id         uuid not null references public.matches(id),
  pick             public.bet_pick not null,
  amount           bigint not null check (amount > 0),
  odds             numeric(5,2) not null,
  potential_payout numeric(12,2) not null,
  status           public.bet_status default 'pending',
  created_at       timestamptz default now()
);
create index idx_bets_user on public.bets(user_id);
create index idx_bets_match on public.bets(match_id);
alter table public.bets enable row level security;

-- ── 4. transactions ───────────────────────────────────────
create table public.transactions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id),
  amount     bigint not null,
  type       public.tx_type not null,
  note       text,
  created_by uuid,
  created_at timestamptz default now()
);
alter table public.transactions enable row level security;

-- ── 5. withdrawals ────────────────────────────────────────
create table public.withdrawals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id),
  amount      bigint not null check (amount > 0),
  account     text not null check (char_length(account) >= 6),
  status      public.withdrawal_status default 'pending',
  note        text,
  created_at  timestamptz default now(),
  decided_at  timestamptz,
  decided_by  uuid
);
alter table public.withdrawals enable row level security;

-- ── 6. notifications ──────────────────────────────────────
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id),
  title      text not null,
  body       text,
  link       text,
  is_read    boolean default false,
  created_at timestamptz default now()
);
alter table public.notifications enable row level security;

-- ── 7. site_settings ──────────────────────────────────────
create table public.site_settings (
  id         integer primary key default 1,
  hero       jsonb default '{"badge":"گیم‌نت حرفه‌ای","title1":"بهترین تجربه گیمینگ","title2":"مسابقات آنلاین با جوایز ویژه","desc":"محیط حرفه‌ای برای گیمرها با سیستم پیش‌بینی مسابقات","stats":[{"label":"مسابقه فعال","value":"۱۲"},{"label":"گیمر آنلاین","value":"۳۴۰"},{"label":"جوایز توزیع شده","value":"۵۰M"}]}'::jsonb,
  features   jsonb default '[]'::jsonb,
  gallery    jsonb default '[]'::jsonb,
  games      jsonb default '[{"name":"FC 25","icon":"⚽"},{"name":"FC 26","icon":"⚽"},{"name":"Valorant","icon":"🎯"},{"name":"DOTA 2","icon":"⚔️"},{"name":"LoL","icon":"🏰"},{"name":"CoD","icon":"🔫"},{"name":"FIFA","icon":"⚽"}]'::jsonb,
  contact    jsonb default '{"address":"","phone1":"","phone2":"","hours":"","email":""}'::jsonb,
  widgets    jsonb default '[]'::jsonb,
  design     text default 'minimal',
  updated_at timestamptz default now(),
  updated_by uuid
);
alter table public.site_settings enable row level security;

-- ── RLS Policies ──────────────────────────────────────────

-- profiles
create policy "profiles read own" on public.profiles for select using (id = auth.uid());
create policy "profiles update own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid() and balance = (select p.balance from public.profiles p where p.id = auth.uid()) and is_admin = (select p.is_admin from public.profiles p where p.id = auth.uid()));
create or replace function public.prevent_profile_hack() returns trigger language plpgsql security definer set search_path = public as $$ begin if new.id is distinct from old.id or new.is_admin is distinct from old.is_admin then if not public.is_admin() then raise exception 'تغییر موجودی یا دسترسی مجاز نیست'; end if; end if; return new; end; $$; -- ponytail: balance via RLS WITH CHECK only; trigger keeps is_admin/id — per-row RPC balance updates must not be blocked
drop trigger if exists trg_prevent_profile_hack on public.profiles; create trigger trg_prevent_profile_hack before update on public.profiles for each row execute function public.prevent_profile_hack();
create policy "profiles admin read all" on public.profiles for select using (public.is_admin());
create policy "profiles admin update all" on public.profiles for update using (public.is_admin());

-- matches
create policy "matches public read" on public.matches for select using (true);
create policy "matches admin insert" on public.matches for insert with check (public.is_admin());
create policy "matches admin update" on public.matches for update using (public.is_admin());
create policy "matches admin delete" on public.matches for delete using (public.is_admin());

-- bets
create policy "bets read own" on public.bets for select using (user_id = auth.uid());
create policy "bets admin read all" on public.bets for select using (public.is_admin());

-- transactions
create policy "tx read own" on public.transactions for select using (user_id = auth.uid());
create policy "tx admin read all" on public.transactions for select using (public.is_admin());

-- withdrawals
create policy "withdrawals read own" on public.withdrawals for select using (user_id = auth.uid());
create policy "withdrawals admin read all" on public.withdrawals for select using (public.is_admin());
create policy "withdrawals admin update" on public.withdrawals for update using (public.is_admin());

-- notifications
create policy "notif read own" on public.notifications for select using (user_id = auth.uid());
create policy "notif admin read all" on public.notifications for select using (public.is_admin());
create policy "notif admin insert" on public.notifications for insert with check (public.is_admin());
create policy "notif admin update" on public.notifications for update using (public.is_admin());
create policy "notif admin delete" on public.notifications for delete using (public.is_admin());

-- site_settings
create policy "settings public read" on public.site_settings for select using (true);
create policy "settings admin all" on public.site_settings for all using (public.is_admin());

-- ── Utility Functions ──────────────────────────────────────

-- Check if user is admin
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- Get my balance
create or replace function public.my_balance()
returns bigint
language sql
security definer
stable
as $$
  select coalesce((select balance from public.profiles where id = auth.uid()), 0);
$$;

-- Check username availability
create or replace function public.is_username_available(p_username text)
returns boolean
language sql
security definer
stable
as $$
  select not exists(select 1 from public.profiles where username = lower(p_username));
$$;

-- ── Trigger: Auto-create profile on signup ─────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
declare
  v_username text;
  v_display  text;
  v_suffix   text;
  v_count    int;
begin
  v_username := lower(replace(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)), ' ', ''));
  v_display  := coalesce(new.raw_user_meta_data->>'display_name', v_username);

  -- Ensure unique username
  if exists(select 1 from public.profiles where username = v_username) then
    v_suffix := substr(new.id::text, 1, 4);
    v_count := 0;
    while exists(select 1 from public.profiles where username = v_username || v_suffix || case when v_count > 0 then v_count::text else '' end) loop
      v_count := v_count + 1;
    end loop;
    v_username := v_username || v_suffix || case when v_count > 0 then v_count::text else '' end;
  end if;

  insert into public.profiles (id, username, display_name, email)
  values (new.id, v_username, v_display, new.email);

  return new;
exception
  when unique_violation then
    -- Fallback: append random suffix
    v_username := v_username || substr(md5(random()::text), 1, 6);
    insert into public.profiles (id, username, display_name, email)
    values (new.id, v_username, v_display, new.email);
    return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Trigger: Set init odds ────────────────────────────────

create or replace function public.set_init_odds()
returns trigger
language plpgsql
security definer
as $$
begin
  new.init_odds_a    := coalesce(new.init_odds_a, new.odds_a);
  new.init_odds_b    := coalesce(new.init_odds_b, new.odds_b);
  new.init_odds_draw := coalesce(new.init_odds_draw, new.odds_draw);
  return new;
end;
$$;

create trigger trg_set_init_odds
  before insert or update on public.matches
  for each row execute function public.set_init_odds();

-- ── Betting Engine: recalc_odds ────────────────────────────

create or replace function public.recalc_odds(p_match_id uuid)
returns void
language plpgsql
security definer
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
  V           constant numeric := 2000000;
begin
  select margin, init_odds_a, init_odds_b, init_odds_draw
  into v_margin, v_init_a, v_init_b, v_init_d
  from public.matches where id = p_match_id;

  -- Sum pending bets per pick
  select coalesce(sum(amount), 0) into v_sum_a from public.bets where match_id = p_match_id and pick = 'team_a' and status = 'pending';
  select coalesce(sum(amount), 0) into v_sum_b from public.bets where match_id = p_match_id and pick = 'team_b' and status = 'pending';
  select coalesce(sum(amount), 0) into v_sum_d from public.bets where match_id = p_match_id and pick = 'draw' and status = 'pending';

  -- Virtual pool proportional to init odds
  if v_init_a is not null and v_init_a > 0 and v_init_b is not null and v_init_b > 0 then
    declare
      v_va numeric := floor(V * (1 - v_margin) / v_init_a);
      v_vb numeric := floor(V * (1 - v_margin) / v_init_b);
      v_vd numeric := case when v_init_d is not null and v_init_d > 0 then floor(V * (1 - v_margin) / v_init_d) else V / 3 end;
      v_total numeric := v_sum_a + v_sum_b + v_sum_d + V;
    begin
      v_new_a := (v_total) / (v_sum_a + v_va) * (1 - v_margin);
      v_new_b := (v_total) / (v_sum_b + v_vb) * (1 - v_margin);
      if v_init_d is not null and v_init_d > 0 then
        v_new_d := (v_total) / (v_sum_d + v_vd) * (1 - v_margin);
      else
        v_new_d := 3.00;
      end if;
    end;
  else
    -- Fallback: equal split
    declare
      v_total numeric := v_sum_a + v_sum_b + v_sum_d + V;
      v_side  numeric := V / 3;
    begin
      v_new_a := (v_total) / (v_sum_a + v_side) * (1 - v_margin);
      v_new_b := (v_total) / (v_sum_b + v_side) * (1 - v_margin);
      v_new_d := (v_total) / (v_sum_d + v_side) * (1 - v_margin);
    end;
  end if;

  -- Clamp
  v_new_a := GREATEST(1.10, LEAST(20.00, v_new_a));
  v_new_b := GREATEST(1.10, LEAST(20.00, v_new_b));
  v_new_d := GREATEST(1.10, LEAST(20.00, v_new_d));

  update public.matches
  set odds_a = round(v_new_a, 2),
      odds_b = round(v_new_b, 2),
      odds_draw = round(v_new_d, 2)
  where id = p_match_id;
end;
$$;

-- ── place_bet ──────────────────────────────────────────────

create or replace function public.place_bet(
  p_match_id uuid,
  p_pick     public.bet_pick,
  p_amount   bigint
)
returns public.bets
language plpgsql
security definer
as $$
declare
  v_user    uuid := auth.uid();
  v_match   public.matches%rowtype;
  v_odds    numeric;
  v_payout  numeric;
  v_bet     public.bets;
  v_total   numeric;
  Vb        constant numeric := 2000000;
begin
  -- Lock
  perform pg_advisory_xact_lock(hashtext(p_match_id::text));

  -- Validate match
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'مسابقه یافت نشد';
  end if;
  if v_match.status != 'upcoming' then
    raise exception 'مسابقه قابل شرط‌بندی نیست';
  end if;
  if v_match.starts_at <= now() then
    raise exception 'زمان شرط‌بندی تمام شده';
  end if;

  -- Validate amount
  if p_amount < 10000 then
    raise exception 'حداقل مبلغ شرط ۱۰,۰۰۰ تومان است';
  end if;

  -- Check balance
  if (select balance from public.profiles where id = v_user) < p_amount then
    raise exception 'موجودی کافی نیست';
  end if;

  -- Get current odds
  if p_pick = 'team_a' then
    v_odds := v_match.odds_a;
  elsif p_pick = 'team_b' then
    v_odds := v_match.odds_b;
  else
    v_odds := v_match.odds_draw;
  end if;

  -- Clamp odds for auto mode
  if v_match.odds_mode = 'auto' then
    select coalesce(sum(amount), 0) into v_total
    from public.bets where match_id = p_match_id and status = 'pending';
    v_total := v_total + p_amount;
    declare
      v_max_odds numeric;
    begin
      v_max_odds := ((v_total + Vb) * (1 - v_match.margin)) / p_amount;
      v_odds := least(v_odds, v_max_odds);
    end;
  end if;

  v_odds := GREATEST(1.10, LEAST(20.00, v_odds));
  v_payout := floor(p_amount * v_odds);

  -- Deduct balance
  update public.profiles set balance = balance - p_amount where id = v_user;

  -- Create bet
  insert into public.bets (user_id, match_id, pick, amount, odds, potential_payout)
  values (v_user, p_match_id, p_pick, p_amount, v_odds, v_payout)
  returning * into v_bet;

  -- Create transaction
  insert into public.transactions (user_id, amount, type, note)
  values (v_user, -p_amount, 'bet', 'شرط روی ' || v_match.title);

  -- Recalc odds in auto mode
  if v_match.odds_mode = 'auto' then
    perform public.recalc_odds(p_match_id);
  end if;

  return v_bet;
end;
$$;

-- ── settle_match ───────────────────────────────────────────

create or replace function public.settle_match(
  p_match_id uuid,
  p_winner   public.bet_pick
)
returns void
language plpgsql
security definer
as $$
declare
  v_bet record;
begin
  if not public.is_admin() then
    raise exception 'دسترسی غیرمجاز';
  end if;

  -- Update match
  update public.matches
  set status = 'finished', winner = p_winner
  where id = p_match_id and status in ('upcoming', 'live');
  if not found then
    raise exception 'مسابقه یافت نشد یا قبلاً تسویه شده';
  end if;

  -- Settle bets
  for v_bet in select * from public.bets where match_id = p_match_id and status = 'pending' loop
    if v_bet.pick = p_winner then
      -- Won
      update public.bets set status = 'won' where id = v_bet.id;
      update public.profiles set balance = balance + v_bet.potential_payout where id = v_bet.user_id;
      insert into public.transactions (user_id, amount, type, note)
      values (v_bet.user_id, v_bet.potential_payout, 'win', 'برد شرط');
      insert into public.notifications (user_id, title, body)
      values (v_bet.user_id, '🎉 شرط برنده!', 'تبریک! شرط شما برنده شد. مبلغ ' || to_char(v_bet.potential_payout, 'FM999,999,999') || ' تومان به کیف پول شما اضافه شد.');
    else
      -- Lost
      update public.bets set status = 'lost' where id = v_bet.id;
      insert into public.notifications (user_id, title, body)
      values (v_bet.user_id, '😔 شرط بازنده', 'متأسفانه شرط شما بازنده شد.');
    end if;
  end loop;
end;
$$;

-- ── cancel_bet ─────────────────────────────────────────────

create or replace function public.cancel_bet(p_bet_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_bet record;
begin
  select b.*, m.status as match_status into v_bet
  from public.bets b
  join public.matches m on m.id = b.match_id
  where b.id = p_bet_id;

  if not found then
    raise exception 'شرط یافت نشد';
  end if;

  -- Only admin or the user can cancel
  if v_bet.user_id != auth.uid() and not public.is_admin() then
    raise exception 'دسترسی غیرمجاز';
  end if;

  if v_bet.status != 'pending' then
    raise exception 'فقط شرط‌های در انتظار قابل لغو هستند';
  end if;

  if v_bet.match_status != 'upcoming' then
    raise exception 'مسابقه شروع شده و قابل لغو نیست';
  end if;

  update public.bets set status = 'refunded' where id = p_bet_id;
  update public.profiles set balance = balance + v_bet.amount where id = v_bet.user_id;
  insert into public.transactions (user_id, amount, type, note)
  values (v_bet.user_id, v_bet.amount, 'refund', 'لغو شرط');

  insert into public.notifications (user_id, title, body)
  values (v_bet.user_id, '↩️ شرط لغو شد', 'مبلغ ' || to_char(v_bet.amount, 'FM999,999,999') || ' تومان به کیف پول شما بازگشت.');

  -- Recalc odds
  perform public.recalc_odds(v_bet.match_id);
end;
$$;

-- ── delete_match ───────────────────────────────────────────

create or replace function public.delete_match(p_match_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  if not public.is_admin() then
    raise exception 'دسترسی غیرمجاز';
  end if;

  -- Refund all pending bets first
  update public.bets set status = 'refunded'
  where match_id = p_match_id and status = 'pending';

  -- Refund balances
  insert into public.transactions (user_id, amount, type, note)
  select user_id, amount, 'refund', 'حذف مسابقه'
  from public.bets
  where match_id = p_match_id and status = 'refunded';

  update public.profiles p
  set balance = balance + b.amount
  from public.bets b
  where b.match_id = p_match_id and b.status = 'refunded' and p.id = b.user_id;

  delete from public.bets where match_id = p_match_id;
  delete from public.matches where id = p_match_id;
end;
$$;

-- ── Withdrawal functions ───────────────────────────────────

create or replace function public.request_withdrawal(
  p_amount  bigint,
  p_account text
)
returns public.withdrawals
language plpgsql
security definer
as $$
declare
  v_user    uuid := auth.uid();
  v_balance bigint;
  v_wd      public.withdrawals;
begin
  if p_amount < 10000 then
    raise exception 'حداقل مبلغ برداشت ۱۰,۰۰۰ تومان است';
  end if;
  if char_length(p_account) < 6 then
    raise exception 'شماره کارت حداقل ۶ کاراکتر باشد';
  end if;

  select balance into v_balance from public.profiles where id = v_user;
  if v_balance < p_amount then
    raise exception 'موجودی کافی نیست';
  end if;

  -- Deduct immediately
  update public.profiles set balance = balance - p_amount where id = v_user;

  insert into public.withdrawals (user_id, amount, account)
  values (v_user, p_amount, p_account)
  returning * into v_wd;

  insert into public.transactions (user_id, amount, type, note)
  values (v_user, -p_amount, 'withdrawal', 'درخواست برداشت');

  -- Notify admins
  insert into public.notifications (user_id, title, body, link)
  select p.id, '💰 درخواست برداشت جدید', 'کاربر ' || (select username from public.profiles where id = v_user) || ' — مبلغ ' || to_char(p_amount, 'FM999,999,999') || ' تومان', '/admin/withdrawals'
  from public.profiles p where p.is_admin = true;

  return v_wd;
end;
$$;

create or replace function public.approve_withdrawal(p_withdrawal_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_wd record;
begin
  if not public.is_admin() then
    raise exception 'دسترسی غیرمجاز';
  end if;

  select * into v_wd from public.withdrawals where id = p_withdrawal_id and status = 'pending';
  if not found then
    raise exception 'درخواست یافت نشد یا قبلاً پردازش شده';
  end if;

  update public.withdrawals set status = 'approved', decided_at = now(), decided_by = auth.uid() where id = p_withdrawal_id;

  insert into public.notifications (user_id, title, body)
  values (v_wd.user_id, '✅ برداشت تأیید شد', 'درخواست برداشت شما به مبلغ ' || to_char(v_wd.amount, 'FM999,999,999') || ' تومان تأیید و پرداخت شد.');
end;
$$;

create or replace function public.reject_withdrawal(p_withdrawal_id uuid, p_reason text
)
returns void
language plpgsql
security definer
as $$
declare
  v_wd record;
begin
  if not public.is_admin() then
    raise exception 'دسترسی غیرمجاز';
  end if;

  select * into v_wd from public.withdrawals where id = p_withdrawal_id and status = 'pending';
  if not found then
    raise exception 'درخواست یافت نشد یا قبلاً پردازش شده';
  end if;

  update public.withdrawals set status = 'rejected', note = p_reason, decided_at = now(), decided_by = auth.uid() where id = p_withdrawal_id;

  -- Refund
  update public.profiles set balance = balance + v_wd.amount where id = v_wd.user_id;
  insert into public.transactions (user_id, amount, type, note)
  values (v_wd.user_id, v_wd.amount, 'refund', 'برگشت وجه - برداشت رد شده');

  insert into public.notifications (user_id, title, body)
  values (v_wd.user_id, '❌ برداشت رد شد', 'درخواست برداشت شما رد شد. دلیل: ' || coalesce(p_reason, 'نامشخص') || '. مبلغ به کیف پول شما بازگشت.');
end;
$$;

-- ── charge_wallet (admin only) ─────────────────────────────

create or replace function public.charge_wallet(
  p_user_id uuid,
  p_amount  bigint
)
returns void
language plpgsql
security definer
as $$
begin
  if not public.is_admin() then
    raise exception 'دسترسی غیرمجاز';
  end if;
  if p_amount <= 0 then
    raise exception 'مبلغ باید مثبت باشد';
  end if;

  update public.profiles set balance = balance + p_amount where id = p_user_id;
  if not found then
    raise exception 'کاربر یافت نشد';
  end if;

  insert into public.transactions (user_id, amount, type, note, created_by)
  values (p_user_id, p_amount, 'charge', 'شارژ توسط ادمین', auth.uid());

  insert into public.notifications (user_id, title, body)
  values (p_user_id, '💳 کیف پول شارژ شد', 'مبلغ ' || to_char(p_amount, 'FM999,999,999') || ' تومان به کیف پول شما اضافه شد.');
end;
$$;

-- ── Grant permissions ──────────────────────────────────────

grant usage on schema public to anon, authenticated;

grant select on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;

grant select on public.matches to anon, authenticated;
grant insert, update, delete on public.matches to authenticated;

grant select on public.bets to anon, authenticated;

grant select on public.transactions to anon, authenticated;

grant select on public.withdrawals to anon, authenticated;

grant select on public.notifications to anon, authenticated;

grant select on public.site_settings to anon, authenticated;
grant insert, update, delete on public.site_settings to authenticated;

grant select on all sequences in schema public to anon, authenticated;

grant execute on function public.is_username_available(text) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.my_balance() to anon, authenticated;
grant execute on function public.place_bet(uuid, public.bet_pick, bigint) to authenticated;
grant execute on function public.settle_match(uuid, public.bet_pick) to authenticated;
grant execute on function public.cancel_bet(uuid) to authenticated;
grant execute on function public.delete_match(uuid) to authenticated;
grant execute on function public.recalc_odds(uuid) to authenticated;
grant execute on function public.request_withdrawal(bigint, text) to authenticated;
grant execute on function public.approve_withdrawal(uuid) to authenticated;
grant execute on function public.reject_withdrawal(uuid, text) to authenticated;
grant execute on function public.charge_wallet(uuid, bigint) to authenticated;

-- ── Patch: ensure site_settings.games exists on existing DBs ─────────
alter table public.site_settings add column if not exists games jsonb default '[{"name":"FC 25","icon":"⚽"},{"name":"FC 26","icon":"⚽"},{"name":"Valorant","icon":"🎯"},{"name":"DOTA 2","icon":"⚔️"},{"name":"LoL","icon":"🏰"},{"name":"CoD","icon":"🔫"},{"name":"FIFA","icon":"⚽"}]'::jsonb;
update public.site_settings set games='[{"name":"FC 25","icon":"⚽"},{"name":"FC 26","icon":"⚽"},{"name":"Valorant","icon":"🎯"},{"name":"DOTA 2","icon":"⚔️"},{"name":"LoL","icon":"🏰"},{"name":"CoD","icon":"🔫"},{"name":"FIFA","icon":"⚽"}]'::jsonb where games is null;
insert into public.site_settings (id) values (1) on conflict (id) do nothing;
-- ── leaderboard public (top 3 by balance) ───────────────────
create or replace function public.get_leaderboard()
returns table(username text, balance bigint)
language sql security definer stable
as $$ select username, balance from public.profiles order by balance desc limit 3 $$;
grant execute on function public.get_leaderboard() to anon, authenticated;


alter table public.site_settings add column if not exists design text default 'minimal';
do $$ begin
  alter publication supabase_realtime add table public.site_settings;
do $$ begin
  alter publication supabase_realtime add table public.withdrawals;
exception when duplicate_object then null;
end $$;
exception when duplicate_object then null;
end $$;
-- ── admin reset password (D) — ponytail: security definer, checks is_admin(), updates auth.users via pgcrypto ──
create extension if not exists "pgcrypto"; -- ponytail: no schema clause → keep where it is (Supabase = extensions)
create or replace function public.admin_reset_password(p_user_id uuid, p_new_password text)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions, pgcrypto
as $$
begin
  if not public.is_admin() then raise exception 'دسترسی غیرمجاز'; end if;
  if char_length(p_new_password) < 6 then raise exception 'رمز باید حداقل ۶ کاراکتر باشد'; end if;
  if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'کاربر یافت نشد'; end if;
  update auth.users set encrypted_password=crypt(p_new_password, gen_salt('bf')), updated_at=now() where id=p_user_id;
  insert into public.notifications(user_id,title,body) values(p_user_id,'🔑 رمز شما بازنشانی شد','رمز عبور توسط مدیر بازنشانی شد. با رمز جدید وارد شوید.');
end;
$$;
grant execute on function public.admin_reset_password(uuid,text) to authenticated;

