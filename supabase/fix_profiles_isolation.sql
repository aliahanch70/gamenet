-- FIX 2 v2 — بستن نشت لیست پروفایل‌ها + فیکس نام پارامتر withdrawal
-- اجرا: Supabase Dashboard → SQL Editor → Paste کل فایل → Run

alter table public.profiles enable row level security;

drop policy if exists "profiles public read" on public.profiles;
drop policy if exists "profiles read all" on public.profiles;
drop policy if exists "profiles read own" on public.profiles;
drop policy if exists "profiles admin read all" on public.profiles;
drop policy if exists "profiles admin update all" on public.profiles;
drop policy if exists "profiles update own" on public.profiles;

create policy "profiles read own" on public.profiles
  for select using (id = auth.uid());
create policy "profiles admin read all" on public.profiles
  for select using (public.is_admin());

create policy "profiles update own" on public.profiles
  for update using (id = auth.uid())
  with check (
    id = auth.uid()
    and balance = (select p.balance from public.profiles p where p.id = auth.uid())
    and is_admin = (select p.is_admin from public.profiles p where p.id = auth.uid())
  );
create policy "profiles admin update all" on public.profiles
  for update using (public.is_admin());

create or replace function public.prevent_profile_hack()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.id is distinct from old.id
     or new.balance is distinct from old.balance
     or new.is_admin is distinct from old.is_admin then
    if not public.is_admin() then
      raise exception 'تغییر موجودی یا دسترسی مجاز نیست';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists trg_prevent_profile_hack on public.profiles;
create trigger trg_prevent_profile_hack before update on public.profiles for each row execute function public.prevent_profile_hack();

-- withdrawals: نام پارامتر باید p_withdrawal_id باشد (همان که فرانت می‌فرستد)
-- نکته: CREATE OR REPLACE با تغییر نام پارامتر خطا می‌دهد → اول DROP
drop function if exists public.approve_withdrawal(uuid) cascade;
drop function if exists public.reject_withdrawal(uuid, text) cascade;

create function public.approve_withdrawal(p_withdrawal_id uuid)
returns void language plpgsql security definer as $$
declare v_wd record; begin
  if not public.is_admin() then raise exception 'دسترسی غیرمجاز'; end if;
  select * into v_wd from public.withdrawals where id=p_withdrawal_id and status='pending';
  if not found then raise exception 'درخواست یافت نشد یا قبلاً پردازش شده'; end if;
  update public.withdrawals set status='approved', decided_at=now(), decided_by=auth.uid() where id=p_withdrawal_id;
  insert into public.notifications(user_id,title,body) values(v_wd.user_id,'✅ برداشت تأیید شد','درخواست برداشت شما به مبلغ '||to_char(v_wd.amount,'FM999,999,999')||' تومان تأیید و پرداخت شد.');
end; $$;

create function public.reject_withdrawal(p_withdrawal_id uuid, p_reason text)
returns void language plpgsql security definer as $$
declare v_wd record; begin
  if not public.is_admin() then raise exception 'دسترسی غیرمجاز'; end if;
  select * into v_wd from public.withdrawals where id=p_withdrawal_id and status='pending';
  if not found then raise exception 'درخواست یافت نشد یا قبلاً پردازش شده'; end if;
  update public.withdrawals set status='rejected', note=p_reason, decided_at=now(), decided_by=auth.uid() where id=p_withdrawal_id;
  update public.profiles set balance=balance+v_wd.amount where id=v_wd.user_id;
  insert into public.transactions(user_id,amount,type,note) values(v_wd.user_id,v_wd.amount,'refund','برگشت وجه - برداشت رد شده');
  insert into public.notifications(user_id,title,body) values(v_wd.user_id,'❌ برداشت رد شد','درخواست برداشت شما رد شد. دلیل: '||coalesce(p_reason,'نامشخص')||'. مبلغ به کیف پول شما بازگشت.');
end; $$;

grant execute on function public.approve_withdrawal(uuid) to authenticated;
grant execute on function public.reject_withdrawal(uuid,text) to authenticated;
