-- migration_audit_fixes.sql — idempotent fixes for betting race conditions
-- Applies same fixes as schema.sql to existing DB
-- Safe to run multiple times; uses DROP before CREATE to allow return-type changes

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

drop function if exists public.place_bet(uuid, public.bet_pick, bigint) cascade;
create or replace function public.place_bet(
  p_match_id uuid,
  p_pick     public.bet_pick,
  p_amount   bigint
)
returns public.bets
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user    uuid := auth.uid();
  v_match   public.matches%rowtype;
  v_odds    numeric;
  v_payout  numeric;
  v_bet     public.bets;
  v_total   numeric;
  v_bal     bigint;
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

  -- Check balance (FOR UPDATE prevents race)
  select balance into v_bal from public.profiles where id = v_user for update;
  if coalesce(v_bal, 0) < p_amount then
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

drop function if exists public.settle_match(uuid, public.bet_pick) cascade;
create or replace function public.settle_match(
  p_match_id uuid,
  p_winner   public.bet_pick
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bet record;
  v_st  public.match_status;
begin
  if not public.is_admin() then
    raise exception 'دسترسی غیرمجاز';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_match_id::text));

  -- Lock match row to prevent double settle
  select status into v_st from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'مسابقه یافت نشد یا قبلاً تسویه شده';
  end if;
  if v_st = 'finished' then
    raise exception 'مسابقه یافت نشد یا قبلاً تسویه شده';
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

drop function if exists public.delete_match(uuid) cascade;
create or replace function public.delete_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ids uuid[];
begin
  if not public.is_admin() then
    raise exception 'دسترسی غیرمجاز';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_match_id::text));

  if exists(select 1 from public.bets where match_id = p_match_id and status in ('won','lost')) then
    raise exception 'cannot delete finished match';
  end if;
  if exists(select 1 from public.bets where match_id = p_match_id and status = 'refunded') then
    raise exception 'already refunded — cannot delete twice';
  end if;

  -- Collect pending bets atomically, mark refunded, and refund exactly those
  select array_agg(id) into v_ids from public.bets where match_id = p_match_id and status = 'pending';
  if v_ids is not null then
    update public.bets set status = 'refunded' where id = any(v_ids);

    insert into public.transactions (user_id, amount, type, note)
    select user_id, amount, 'refund', 'حذف مسابقه' from public.bets where id = any(v_ids);

    update public.profiles p set balance = balance + b.amount
    from public.bets b where b.id = any(v_ids) and p.id = b.user_id;

    delete from public.bets where id = any(v_ids);
  end if;
  delete from public.matches where id = p_match_id;
end;
$$;

drop function if exists public.request_withdrawal(bigint, text) cascade;
create or replace function public.request_withdrawal(
  p_amount  bigint,
  p_account text
)
returns public.withdrawals
language plpgsql
security definer
set search_path = public, pg_temp
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

  perform pg_advisory_xact_lock(hashtext(v_user::text));
  select balance into v_balance from public.profiles where id = v_user for update;
  if coalesce(v_balance, 0) < p_amount then
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

drop function if exists public.approve_withdrawal(uuid) cascade;
create or replace function public.approve_withdrawal(p_withdrawal_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_wd record;
begin
  if not public.is_admin() then
    raise exception 'دسترسی غیرمجاز';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_withdrawal_id::text));
  select * into v_wd from public.withdrawals where id = p_withdrawal_id for update;
  if not found or v_wd.status != 'pending' then
    raise exception 'درخواست یافت نشد یا قبلاً پردازش شده';
  end if;

  update public.withdrawals set status = 'approved', decided_at = now(), decided_by = auth.uid() where id = p_withdrawal_id and status = 'pending';
  if not found then raise exception 'درخواست یافت نشد یا قبلاً پردازش شده'; end if;

  insert into public.notifications (user_id, title, body)
  values (v_wd.user_id, '✅ برداشت تأیید شد', 'درخواست برداشت شما به مبلغ ' || to_char(v_wd.amount, 'FM999,999,999') || ' تومان تأیید و پرداخت شد.');
end;
$$;

drop function if exists public.reject_withdrawal(uuid, text) cascade;
create or replace function public.reject_withdrawal(p_withdrawal_id uuid, p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_wd record;
begin
  if not public.is_admin() then
    raise exception 'دسترسی غیرمجاز';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_withdrawal_id::text));
  select * into v_wd from public.withdrawals where id = p_withdrawal_id for update;
  if not found or v_wd.status != 'pending' then
    raise exception 'درخواست یافت نشد یا قبلاً پردازش شده';
  end if;

  update public.withdrawals set status = 'rejected', note = p_reason, decided_at = now(), decided_by = auth.uid() where id = p_withdrawal_id and status = 'pending';
  if not found then raise exception 'درخواست یافت نشد یا قبلاً پردازش شده'; end if;

  -- Refund
  update public.profiles set balance = balance + v_wd.amount where id = v_wd.user_id;
  insert into public.transactions (user_id, amount, type, note)
  values (v_wd.user_id, v_wd.amount, 'refund', 'برگشت وجه - برداشت رد شده');

  insert into public.notifications (user_id, title, body)
  values (v_wd.user_id, '❌ برداشت رد شد', 'درخواست برداشت شما رد شد. دلیل: ' || coalesce(p_reason, 'نامشخص') || '. مبلغ به کیف پول شما بازگشت.');
end;
$$;

drop function if exists public.cancel_bet(uuid) cascade;
create or replace function public.cancel_bet(p_bet_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bet record;
begin
  perform pg_advisory_xact_lock(hashtext(p_bet_id::text));
  select b.*, m.status as match_status into v_bet
  from public.bets b
  join public.matches m on m.id = b.match_id
  where b.id = p_bet_id for update;

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

  update public.bets set status = 'refunded' where id = p_bet_id and status = 'pending';
  if not found then raise exception 'فقط شرط‌های در انتظار قابل لغو هستند'; end if;
  update public.profiles set balance = balance + v_bet.amount where id = v_bet.user_id;
  insert into public.transactions (user_id, amount, type, note)
  values (v_bet.user_id, v_bet.amount, 'refund', 'لغو شرط');

  insert into public.notifications (user_id, title, body)
  values (v_bet.user_id, '↩️ شرط لغو شد', 'مبلغ ' || to_char(v_bet.amount, 'FM999,999,999') || ' تومان به کیف پول شما بازگشت.');

  -- Recalc odds
  perform public.recalc_odds(v_bet.match_id);
end;
$$;

-- Re-grant execute after CASCADE drops
grant execute on function public.recalc_odds(uuid) to authenticated;
revoke execute on function public.recalc_odds(uuid) from anon, authenticated, public; -- internal only, called via SECURITY DEFINER
grant execute on function public.place_bet(uuid, public.bet_pick, bigint) to authenticated;
grant execute on function public.settle_match(uuid, public.bet_pick) to authenticated;
grant execute on function public.cancel_bet(uuid) to authenticated;
grant execute on function public.delete_match(uuid) to authenticated;
grant execute on function public.request_withdrawal(bigint, text) to authenticated;
grant execute on function public.approve_withdrawal(uuid) to authenticated;
grant execute on function public.reject_withdrawal(uuid, text) to authenticated;
