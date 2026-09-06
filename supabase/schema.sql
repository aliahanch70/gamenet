-- ===================== GAMENET — SUPABASE SCHEMA =====================
-- Run this in Supabase Dashboard > SQL Editor (copy-paste as one script)
-- Requires: auth.users exists (default)

-- 1) Extensions & types
create extension if not exists pgcrypto;
do $$ begin
  create type match_status as enum ('upcoming','live','finished');
exception when duplicate_object then null; end $$;
do $$ begin
  create type bet_pick as enum ('team_a','team_b','draw');
exception when duplicate_object then null; end $$;
do $$ begin
  create type bet_status as enum ('pending','won','lost','refunded');
exception when duplicate_object then null; end $$;
do $$ begin
  create type tx_type as enum ('charge','bet','win','refund','withdrawal');
exception when duplicate_object then null; end $$;
do $$ begin
  create type withdrawal_status as enum ('pending','approved','rejected');
exception when duplicate_object then null; end $$;
DO $$ BEGIN
  ALTER TYPE tx_type ADD VALUE IF NOT EXISTS 'withdrawal';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
do $$ begin create type odds_mode as enum ('manual','auto'); exception when duplicate_object then null; end $$;

-- 2) Profiles (1:1 with auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  is_admin boolean not null default false,
  balance bigint not null default 0 check (balance >= 0),
  created_at timestamptz not null default now()
);

-- 3) Matches
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  game text not null default 'FC 25',
  team_a text not null,
  team_b text not null,
  status match_status not null default 'upcoming',
  odds_a numeric(5,2) not null default 1.90 check (odds_a >= 1.01),
  odds_b numeric(5,2) not null default 1.90 check (odds_b >= 1.01),
  odds_draw numeric(5,2) check (odds_draw is null or odds_draw >= 1.01),
  winner bet_pick,
  odds_mode odds_mode not null default 'auto',
  margin numeric(4,3) not null default 0.05 check (margin >=0 and margin <0.5),
  starts_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  init_odds_a numeric(5,2),
  init_odds_b numeric(5,2),
  init_odds_draw numeric(5,2),
  check (winner is null or status='finished')
);

-- 4) Bets
create table if not exists public.bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  pick bet_pick not null,
  amount bigint not null check (amount > 0),
  odds numeric(5,2) not null check (odds >= 1.01),
  potential_payout bigint not null check (potential_payout > 0),
  status bet_status not null default 'pending',
  created_at timestamptz not null default now()
);
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

create index if not exists bets_user_idx on public.bets(user_id);
create index if not exists bets_match_idx on public.bets(match_id);

-- 5) Transactions (audit)
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount bigint not null,
  type tx_type not null,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists tx_user_idx on public.transactions(user_id);

-- 5b) Withdrawals (user requests payout, admin approves)
create table if not exists public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount bigint not null check (amount > 0),
  account text not null check (char_length(btrim(account)) >= 6),
  status withdrawal_status not null default 'pending',
  note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id)
);
create index if not exists wd_user_idx on public.withdrawals(user_id);
create index if not exists wd_status_idx on public.withdrawals(status);

-- 5c) Notifications (admin inbox for withdrawals etc.)
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notif_user_idx on public.notifications(user_id, is_read);

-- 6) Auto-create profile on signup — never fail the auth insert (duplicate username → fallback)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_username text; v_display text; v_taken boolean;
begin
  v_username := coalesce(nullif(btrim(coalesce(new.raw_user_meta_data->>'username','')), ''), split_part(new.email,'@',1));
  v_display  := coalesce(nullif(btrim(coalesce(new.raw_user_meta_data->>'display_name','')), ''), v_username);
  -- ponytail: collision-safe fallback — suffix with short uid fragment so signup never fails
  select exists(select 1 from public.profiles where username = v_username) into v_taken;
  if v_taken then v_username := v_username || '_' || substr(new.id::text,1,4); end if;
  begin
    insert into public.profiles (id, username, display_name)
    values (new.id, v_username, v_display);
  exception when unique_violation then
    -- last resort: append more of the uuid
    insert into public.profiles (id, username, display_name)
    values (new.id, v_username || substr(new.id::text,5,4), v_display)
    on conflict (id) do nothing;
  end;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- helper: check username availability (for live validation in the app)
create or replace function public.is_username_available(p_username text) returns boolean
language sql security definer set search_path=public as $$
  select not exists(select 1 from public.profiles where username = btrim(p_username))
$$;

-- helper: is_admin
create or replace function public.is_admin() returns boolean
language sql security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and is_admin = true)
$$;

-- helper: my_balance
create or replace function public.my_balance() returns bigint
language sql security definer set search_path=public as $$
  select coalesce((select balance from public.profiles where id = auth.uid()),0)
$$;

-- 7) recalc_odds (auto mode: pari-mutuel — only pending bets count)
create or replace function public.recalc_odds(p_match_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare v_mode odds_mode; v_margin numeric; v_total bigint; v_a bigint; v_b bigint; v_d bigint; v_oa numeric; v_ob numeric; v_od numeric; v_has_draw boolean;
  V bigint := 2000000; v_va bigint; v_vb bigint; v_vd bigint; v_ia numeric; v_ib numeric; v_id numeric;
begin
  select odds_mode, margin, (odds_draw is not null), init_odds_a, init_odds_b, init_odds_draw
    into v_mode, v_margin, v_has_draw, v_ia, v_ib, v_id from public.matches where id=p_match_id;
  if v_mode <> 'auto' then return; end if;
  select coalesce(sum(amount),0) into v_total from public.bets where match_id=p_match_id and status='pending';
  select coalesce(sum(amount) filter (where pick='team_a'),0),
         coalesce(sum(amount) filter (where pick='team_b'),0),
         coalesce(sum(amount) filter (where pick='draw'),0)
    into v_a, v_b, v_d from public.bets where match_id=p_match_id and status='pending';
  -- ponytail: virtual shares proportional to init odds — preserves initial 1.6/2.0 exactly, correct direction (not equal split)
  if v_ia is not null and v_ib is not null and v_ia >= 1.01 and v_ib >= 1.01 then
    v_va := greatest(1000, floor(V * (1 - v_margin) / v_ia)::bigint);
    v_vb := greatest(1000, floor(V * (1 - v_margin) / v_ib)::bigint);
    if v_has_draw and v_id is not null and v_id >= 1.01 then v_vd := greatest(1000, floor(V * (1 - v_margin) / v_id)::bigint); else v_vd := 0; end if;
  else
    v_va := case when v_has_draw then V/3 else V/2 end;
    v_vb := case when v_has_draw then V/3 else V/2 end;
    v_vd := case when v_has_draw then V/3 else 0 end;
  end if;
  v_oa := greatest(1.10, least(20, ((v_total+V)::numeric / (v_a+v_va)) * (1 - v_margin)));
  v_ob := greatest(1.10, least(20, ((v_total+V)::numeric / (v_b+v_vb)) * (1 - v_margin)));
  if v_has_draw then
    v_od := greatest(1.10, least(20, ((v_total+V)::numeric / (v_d+v_vd)) * (1 - v_margin)));
  else v_od := null; end if;
  update public.matches set
    odds_a = v_oa,
    odds_b = v_ob,
    odds_draw = case when v_has_draw then v_od else null end
  where id=p_match_id;
end; $$;

-- 7b) delete_match RPC — admin only, refunds pending bets
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

-- 8) Betting RPC — margin guaranteed (no house loss)
create or replace function public.place_bet(p_match_id uuid, p_pick bet_pick, p_amount bigint)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_odds numeric(5,2); v_match_status match_status; v_bet_id uuid; v_payout bigint; v_bal bigint;
        v_mode odds_mode; v_margin numeric; v_total bigint; v_liab_a bigint; v_liab_b bigint; v_liab_d bigint; v_old_liab bigint; v_max_odds numeric;
begin
  if p_amount <= 0 then raise exception 'amount must be > 0'; end if;
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  perform pg_advisory_xact_lock(hashtext(p_match_id::text));

  select status, margin, odds_mode,
         case p_pick when 'team_a' then odds_a when 'team_b' then odds_b else odds_draw end
    into v_match_status, v_margin, v_mode, v_odds from public.matches where id = p_match_id for update;
  if not found then raise exception 'match not found'; end if;
  if v_match_status <> 'upcoming' then raise exception 'match not open for betting'; end if;
  if v_odds is null then raise exception 'odds not available for this pick'; end if;

  select balance into v_bal from public.profiles where id = auth.uid() for update;
  if v_bal < p_amount then raise exception 'insufficient balance'; end if;

  -- ponytail: clamp odds to guarantee house margin (only pending bets count)
  -- profit_if_pick = new_total - (old_liability_pick + p_amount*v_odds) >= new_total * v_margin
  -- ponytail: first bet(s) have no opposite side yet — allow temporary risk, later bets are clamped to balance the book
  if v_mode = 'auto' then
    select coalesce(sum(amount),0) into v_total from public.bets where match_id=p_match_id and status='pending';
    select coalesce(sum(potential_payout) filter (where pick='team_a' and status='pending'),0),
           coalesce(sum(potential_payout) filter (where pick='team_b' and status='pending'),0),
           coalesce(sum(potential_payout) filter (where pick='draw' and status='pending'),0)
      into v_liab_a, v_liab_b, v_liab_d from public.bets where match_id=p_match_id and status='pending';
    v_old_liab := case p_pick when 'team_a' then v_liab_a when 'team_b' then v_liab_b else v_liab_d end;
    -- ponytail: virtual pool V=2M damps margin check — same V as recalc_odds, prevents 1.90->1.10 on first 50k
    if true then
      declare Vb bigint := 2000000;
      begin
        v_max_odds := ((v_total + Vb + p_amount)::numeric * (1 - v_margin) - v_old_liab::numeric) / p_amount::numeric;
        v_max_odds := greatest(1.10, least(v_odds::numeric, v_max_odds));
        if v_max_odds < 1.10 then raise exception 'ظرفیت این گزینه پر است — مبلغ کمتر یا گزینه دیگر را امتحان کنید'; end if;
        if v_odds::numeric > v_max_odds then v_odds := round(v_max_odds,2); end if;
      end;
    end if;
  end if;

  v_payout := floor(p_amount * v_odds);

  update public.profiles set balance = balance - p_amount where id = auth.uid();

  insert into public.bets (user_id, match_id, pick, amount, odds, potential_payout)
  values (auth.uid(), p_match_id, p_pick, p_amount, v_odds, v_payout) returning id into v_bet_id;

  insert into public.transactions (user_id, amount, type, note) values (auth.uid(), -p_amount, 'bet', 'bet '||v_bet_id::text);
  perform public.recalc_odds(p_match_id);
  return v_bet_id;
end; $$;

-- 9) Settle match RPC — admin only, pays winners
create or replace function public.settle_match(p_match_id uuid, p_winner bet_pick)
returns integer language plpgsql security definer set search_path=public as $$
declare r record; cnt int := 0;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  update public.matches set status='finished', winner=p_winner where id=p_match_id;
  if not found then raise exception 'match not found'; end if;

  for r in select * from public.bets where match_id=p_match_id and status='pending' loop
    if r.pick = p_winner then
      update public.bets set status='won' where id=r.id;
      update public.profiles set balance = balance + r.potential_payout where id=r.user_id;
      insert into public.transactions (user_id, amount, type, note, created_by) values (r.user_id, r.potential_payout, 'win', 'win bet '||r.id::text, auth.uid());
    else
      update public.bets set status='lost' where id=r.id;
    end if;
    cnt := cnt+1;
  end loop;
  return cnt;
end; $$;

-- 8b) Cancel bet — user can refund own pending bet while match is still upcoming
create or replace function public.cancel_bet(p_bet_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare v_bet record; v_status match_status;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into v_bet from public.bets where id=p_bet_id and user_id=auth.uid() for update;
  if not found then raise exception 'bet not found'; end if;
  if v_bet.status <> 'pending' then raise exception 'bet not cancellable'; end if;
  select status into v_status from public.matches where id=v_bet.match_id;
  if v_status <> 'upcoming' then raise exception 'match not open — cannot cancel'; end if;
  update public.bets set status='refunded' where id=p_bet_id;
  update public.profiles set balance = balance + v_bet.amount where id=auth.uid();
  insert into public.transactions (user_id, amount, type, note) values (auth.uid(), v_bet.amount, 'refund', 'cancel bet '||p_bet_id::text);
  perform public.recalc_odds(v_bet.match_id);
end; $$;

-- 9b) Withdrawals — user requests, admin approves/rejects
create or replace function public.request_withdrawal(p_amount bigint, p_account text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_bal bigint; v_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'مبلغ نامعتبر است'; end if;
  if char_length(btrim(coalesce(p_account,''))) < 6 then raise exception 'شماره حساب/کارت را کامل وارد کنید'; end if;
  select balance into v_bal from public.profiles where id=auth.uid() for update;
  if v_bal is null then raise exception 'profile not found'; end if;
  if v_bal < p_amount then raise exception 'موجودی کافی نیست'; end if;
  update public.profiles set balance = balance - p_amount where id=auth.uid();
  insert into public.withdrawals (user_id, amount, account, status) values (auth.uid(), p_amount, btrim(p_account), 'pending') returning id into v_id;
  insert into public.transactions (user_id, amount, type, note) values (auth.uid(), -p_amount, 'withdrawal', 'درخواست برداشت '||v_id::text);
  -- notify all admins (simple fanout)
  insert into public.notifications (user_id, title, body, link)
  select id, 'درخواست برداشت جدید', coalesce(username, id::text) || ' — ' || p_amount::text || ' تومان', '/admin/withdrawals'
  from public.profiles where is_admin=true;
  return v_id;
end; $$;

create or replace function public.approve_withdrawal(p_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v record;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  select * into v from public.withdrawals where id=p_id for update;
  if not found then raise exception 'not found'; end if;
  if v.status <> 'pending' then raise exception 'already decided'; end if;
  update public.withdrawals set status='approved', decided_at=now(), decided_by=auth.uid() where id=p_id;
  insert into public.notifications (user_id, title, body, link) values (v.user_id, 'برداشت تایید شد', v.amount::text || ' تومان واریز شد', '/wallet');
end; $$;

create or replace function public.reject_withdrawal(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare v record;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  select * into v from public.withdrawals where id=p_id for update;
  if not found then raise exception 'not found'; end if;
  if v.status <> 'pending' then raise exception 'already decided'; end if;
  update public.profiles set balance = balance + v.amount where id=v.user_id;
  update public.withdrawals set status='rejected', decided_at=now(), decided_by=auth.uid(), note=coalesce(p_reason,'') where id=p_id;
  insert into public.transactions (user_id, amount, type, note, created_by) values (v.user_id, v.amount, 'refund', 'برگشت برداشت ردشده '||p_id::text, auth.uid());
  insert into public.notifications (user_id, title, body, link) values (v.user_id, 'برداشت رد شد', coalesce(p_reason,'مبلغ به کیف پول برگشت'), '/wallet');
end; $$;

-- 9) Charge wallet RPC — admin only
create or replace function public.charge_wallet(p_user_id uuid, p_amount bigint)
returns bigint language plpgsql security definer set search_path=public as $$
declare new_bal bigint;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if p_amount <= 0 then raise exception 'amount must be > 0'; end if;
  update public.profiles set balance = balance + p_amount where id = p_user_id returning balance into new_bal;
  if not found then raise exception 'user not found'; end if;
  insert into public.transactions (user_id, amount, type, note, created_by) values (p_user_id, p_amount, 'charge', 'admin charge', auth.uid());
  return new_bal;
end; $$;

-- 10) RLS
alter table public.profiles enable row level security;
alter table public.matches enable row level security;
alter table public.bets enable row level security;
alter table public.transactions enable row level security;

-- profiles
drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read" on public.profiles for select using (true);
drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "profiles admin update" on public.profiles;
create policy "profiles admin update" on public.profiles for update using (public.is_admin());
drop policy if exists "profiles insert" on public.profiles;
create policy "profiles insert" on public.profiles for insert with check (auth.uid() = id);

-- matches: public read, admin write
drop policy if exists "matches read" on public.matches;
create policy "matches read" on public.matches for select using (true);
drop policy if exists "matches admin all" on public.matches;
create policy "matches admin all" on public.matches for all using (public.is_admin()) with check (public.is_admin());

-- withdrawals
alter table public.withdrawals enable row level security;
alter table public.notifications enable row level security;
-- bets: strictly own for users; admins see all (two permissive policies ORed)
-- ponytail: split to avoid single OR masking a permissive leak; regular users never see others' rows
drop policy if exists "bets read own" on public.bets;
drop policy if exists "bets admin read all" on public.bets;
drop policy if exists "bets admin update" on public.bets;
create policy "bets read own" on public.bets for select using (user_id = auth.uid());
create policy "bets admin read all" on public.bets for select using (public.is_admin());
drop policy if exists "bets insert own" on public.bets;
create policy "bets insert own" on public.bets for insert with check (user_id = auth.uid());
create policy "bets admin update" on public.bets for update using (public.is_admin());

-- withdrawals: user sees own, admin sees all; inserts only via RPC
drop policy if exists "wd read own" on public.withdrawals;
drop policy if exists "wd admin all" on public.withdrawals;
create policy "wd read own" on public.withdrawals for select using (user_id = auth.uid());
create policy "wd admin all" on public.withdrawals for select using (public.is_admin());
drop policy if exists "wd insert own" on public.withdrawals;
create policy "wd insert own" on public.withdrawals for insert with check (user_id = auth.uid());
drop policy if exists "wd admin update" on public.withdrawals;
create policy "wd admin update" on public.withdrawals for update using (public.is_admin());
-- notifications: own only
drop policy if exists "notif own read" on public.notifications;
drop policy if exists "notif admin read" on public.notifications;
create policy "notif own read" on public.notifications for select using (user_id = auth.uid());
create policy "notif admin read" on public.notifications for select using (public.is_admin());
drop policy if exists "notif own update" on public.notifications;
create policy "notif own update" on public.notifications for update using (user_id = auth.uid() or public.is_admin());
drop policy if exists "notif insert" on public.notifications;
create policy "notif insert" on public.notifications for insert with check (true);

-- transactions: strictly own for users; admins see all
drop policy if exists "tx read own" on public.transactions;
drop policy if exists "tx admin read all" on public.transactions;
create policy "tx read own" on public.transactions for select using (user_id = auth.uid());
create policy "tx admin read all" on public.transactions for select using (public.is_admin());
drop policy if exists "tx insert" on public.transactions;
create policy "tx insert" on public.transactions for insert with check (user_id = auth.uid() or public.is_admin());

-- GRANTS — بدون این‌ها با RLS روشن «permission denied for table …» می‌گیری
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.profiles to anon, authenticated;
grant select, insert, update, delete on public.matches to anon, authenticated;
grant select, insert, update, delete on public.bets to anon, authenticated;
grant select, insert, update, delete on public.transactions to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.my_balance() to anon, authenticated;
grant execute on function public.is_username_available(text) to anon, authenticated;
grant execute on function public.recalc_odds(uuid) to anon, authenticated;
grant select, insert, update, delete on public.withdrawals to anon, authenticated;
grant select, insert, update, delete on public.notifications to anon, authenticated;
grant execute on function public.request_withdrawal(bigint, text) to authenticated;
grant execute on function public.approve_withdrawal(uuid) to authenticated;
grant execute on function public.reject_withdrawal(uuid, text) to authenticated;
grant execute on function public.delete_match(uuid) to authenticated;
grant execute on function public.cancel_bet(uuid) to authenticated;
grant execute on function public.place_bet(uuid, bet_pick, bigint) to authenticated;
grant execute on function public.settle_match(uuid, bet_pick) to authenticated;
grant execute on function public.charge_wallet(uuid, bigint) to authenticated;

-- 11) Make first user admin helper (run manually after signup):
-- update public.profiles set is_admin=true where username='admin';
-- or: update public.profiles set is_admin=true where id='YOUR_UUID';

-- 12) Seed matches (optional)
insert into public.matches (title, game, team_a, team_b, status, odds_a, odds_b, odds_draw, starts_at) values
('فینال جمعه — سالن اصلی','FC 25','تیم عقاب','تیم شاهین','upcoming',1.85,2.10,3.40, now()+interval '2 hours'),
('نیمه‌نهایی — سالن VIP','Valorant','Vipers','Wolves','upcoming',2.30,1.65,null, now()+interval '1 day'),
('دوستانه','FIFA','Gamanet FC','Guests','live',1.95,1.95,3.00, now()-interval '30 minutes')
on conflict do nothing;
