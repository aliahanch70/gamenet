-- ========== FIX: لغو شرط قبل شروع مسابقه ==========
-- در Supabase → SQL Editor یک‌بار Run کن.

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
grant execute on function public.cancel_bet(uuid) to authenticated;
