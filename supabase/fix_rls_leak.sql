-- ========== FIX: نشتی «شرط‌های من / کیف پول» — هر کاربر فقط مال خودش را ببیند ==========
-- در Supabase → SQL Editor یک‌بار Run کن.

-- bets: هر کاربر فقط شرط‌های خودش؛ ادمین همه را می‌بیند
drop policy if exists "bets read own" on public.bets;
drop policy if exists "bets admin read all" on public.bets;
drop policy if exists "bets admin update" on public.bets;
create policy "bets read own" on public.bets for select using (user_id = auth.uid());
create policy "bets admin read all" on public.bets for select using (public.is_admin());
create policy "bets admin update" on public.bets for update using (public.is_admin());

-- transactions: هر کاربر فقط تراکنش‌های خودش؛ ادمین همه را می‌بیند
drop policy if exists "tx read own" on public.transactions;
drop policy if exists "tx admin read all" on public.transactions;
create policy "tx read own" on public.transactions for select using (user_id = auth.uid());
create policy "tx admin read all" on public.transactions for select using (public.is_admin());
drop policy if exists "tx insert" on public.transactions;
create policy "tx insert" on public.transactions for insert with check (user_id = auth.uid() or public.is_admin());
