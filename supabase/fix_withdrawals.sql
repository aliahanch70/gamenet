-- ========== FIX: withdrawals + notifications ==========
-- در Supabase → SQL Editor یک‌بار Run کن. نصب تازه نیازی ندارد (schema.sql جدید درست است).

do $$ begin create type withdrawal_status as enum ('pending','approved','rejected'); exception when duplicate_object then null; end $$;
DO $$ BEGIN ALTER TYPE tx_type ADD VALUE IF NOT EXISTS 'withdrawal'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

create table if not exists public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount bigint not null check (amount > 0),
  account text not null check (char_length(btrim(account)) >= 6),
  status withdrawal_status not null default 'pending',
  note text, created_at timestamptz not null default now(),
  decided_at timestamptz, decided_by uuid references auth.users(id)
);
create index if not exists wd_user_idx on public.withdrawals(user_id);
create index if not exists wd_status_idx on public.withdrawals(status);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null, body text, link text,
  is_read boolean not null default false, created_at timestamptz not null default now()
);
create index if not exists notif_user_idx on public.notifications(user_id, is_read);

create or replace function public.request_withdrawal(p_amount bigint, p_account text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_bal bigint; v_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'مبلغ نامعتبر است'; end if;
  if char_length(btrim(coalesce(p_account,''))) < 6 then raise exception 'شماره حساب/کارت را کامل وارد کنید'; end if;
  select balance into v_bal from public.profiles where id=auth.uid() for update;
  if v_bal < p_amount then raise exception 'موجودی کافی نیست'; end if;
  update public.profiles set balance = balance - p_amount where id=auth.uid();
  insert into public.withdrawals (user_id, amount, account, status) values (auth.uid(), p_amount, btrim(p_account), 'pending') returning id into v_id;
  insert into public.transactions (user_id, amount, type, note) values (auth.uid(), -p_amount, 'withdrawal', 'درخواست برداشت '||v_id::text);
  insert into public.notifications (user_id, title, body, link) select id, 'درخواست برداشت جدید', coalesce(username, id::text) || ' — ' || p_amount::text || ' تومان', '/admin/withdrawals' from public.profiles where is_admin=true;
  return v_id;
end; $$;
create or replace function public.approve_withdrawal(p_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare v record; begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  select * into v from public.withdrawals where id=p_id for update;
  if not found then raise exception 'not found'; end if;
  if v.status <> 'pending' then raise exception 'already decided'; end if;
  update public.withdrawals set status='approved', decided_at=now(), decided_by=auth.uid() where id=p_id;
  insert into public.notifications (user_id, title, body, link) values (v.user_id, 'برداشت تایید شد', v.amount::text || ' تومان واریز شد', '/wallet');
end; $$;
create or replace function public.reject_withdrawal(p_id uuid, p_reason text) returns void language plpgsql security definer set search_path=public as $$
declare v record; begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  select * into v from public.withdrawals where id=p_id for update;
  if not found then raise exception 'not found'; end if;
  if v.status <> 'pending' then raise exception 'already decided'; end if;
  update public.profiles set balance = balance + v.amount where id=v.user_id;
  update public.withdrawals set status='rejected', decided_at=now(), decided_by=auth.uid(), note=coalesce(p_reason,'') where id=p_id;
  insert into public.transactions (user_id, amount, type, note, created_by) values (v.user_id, v.amount, 'refund', 'برگشت برداشت ردشده '||p_id::text, auth.uid());
  insert into public.notifications (user_id, title, body, link) values (v.user_id, 'برداشت رد شد', coalesce(p_reason,'مبلغ به کیف پول برگشت'), '/wallet');
end; $$;

alter table public.withdrawals enable row level security;
alter table public.notifications enable row level security;
drop policy if exists "wd read own" on public.withdrawals; create policy "wd read own" on public.withdrawals for select using (user_id = auth.uid());
drop policy if exists "wd admin all" on public.withdrawals; create policy "wd admin all" on public.withdrawals for select using (public.is_admin());
drop policy if exists "wd insert own" on public.withdrawals; create policy "wd insert own" on public.withdrawals for insert with check (user_id = auth.uid());
drop policy if exists "wd admin update" on public.withdrawals; create policy "wd admin update" on public.withdrawals for update using (public.is_admin());
drop policy if exists "notif own read" on public.notifications; create policy "notif own read" on public.notifications for select using (user_id = auth.uid());
drop policy if exists "notif admin read" on public.notifications; create policy "notif admin read" on public.notifications for select using (public.is_admin());
drop policy if exists "notif own update" on public.notifications; create policy "notif own update" on public.notifications for update using (user_id = auth.uid() or public.is_admin());
drop policy if exists "notif insert" on public.notifications; create policy "notif insert" on public.notifications for insert with check (true);

grant select, insert, update, delete on public.withdrawals to anon, authenticated;
grant select, insert, update, delete on public.notifications to anon, authenticated;
grant execute on function public.request_withdrawal(bigint, text) to authenticated;
grant execute on function public.approve_withdrawal(uuid) to authenticated;
grant execute on function public.reject_withdrawal(uuid, text) to authenticated;
