-- ============================================================
-- migration_cafe.sql — مدیریت حساب‌ها و بوفه (Buffet + Accounting)
-- Tables: 9 | Enums: 4 | RPCs: 11 | RLS admin-only + Audit trigger
-- Run in Supabase SQL Editor. Idempotent.
-- ============================================================

-- ── Enums ──
do $$ begin create type public.cafe_pay_method  as enum ('cash','card','credit'); exception when duplicate_object then null; end $$;
do $$ begin create type public.cafe_stock_type  as enum ('in','out');             exception when duplicate_object then null; end $$;
do $$ begin create type public.cafe_cash_type   as enum ('sale','stock','expense','income','receive','pay','close'); exception when duplicate_object then null; end $$;
do $$ begin create type public.cafe_ledger_type as enum ('debt','settle','reversal'); exception when duplicate_object then null; end $$;

-- ── 1. cafe_products (انبار) ──
create table if not exists public.cafe_products (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  category   text not null default 'عمومی',
  buy_price  bigint not null default 0 check (buy_price >= 0),
  sell_price bigint not null default 0 check (sell_price >= 0),
  stock      integer not null default 0 check (stock >= 0),
  low_stock  integer not null default 5 check (low_stock >= 0),
  is_active  boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_cafe_products_cat on public.cafe_products(category);

-- ── 2. cafe_people (اشخاص / بدهکاران) ──
create table if not exists public.cafe_people (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text,
  note       text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── 3. cafe_sales (فروش‌ها) ──
create table if not exists public.cafe_sales (
  id         uuid primary key default gen_random_uuid(),
  total      bigint not null default 0 check (total >= 0),
  cost_total bigint not null default 0 check (cost_total >= 0),
  method     public.cafe_pay_method not null default 'cash',
  person_id  uuid references public.cafe_people(id) on delete set null,
  note       text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_cafe_sales_created on public.cafe_sales(created_at desc);

-- ── 4. cafe_sale_items (اقلام فروش) ──
create table if not exists public.cafe_sale_items (
  id           uuid primary key default gen_random_uuid(),
  sale_id      uuid not null references public.cafe_sales(id) on delete cascade,
  product_id   uuid references public.cafe_products(id) on delete set null,
  product_name text not null,
  qty          integer not null check (qty > 0),
  unit_price   bigint not null check (unit_price >= 0),
  unit_cost    bigint not null default 0 check (unit_cost >= 0)
);
create index if not exists idx_cafe_sale_items_sale on public.cafe_sale_items(sale_id);

-- ── 5. cafe_stock_moves (ورود/خروج کالا) ──
create table if not exists public.cafe_stock_moves (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.cafe_products(id) on delete cascade,
  qty        integer not null, -- + ورود، - خروج
  type       public.cafe_stock_type not null,
  reason     text,
  ref_sale_id uuid,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_cafe_moves_prod on public.cafe_stock_moves(product_id, created_at desc);

-- ── 6. cafe_cash_moves (صندوق) ──
create table if not exists public.cafe_cash_moves (
  id         uuid primary key default gen_random_uuid(),
  amount     bigint not null, -- + دریافت، - پرداخت
  type       public.cafe_cash_type not null,
  method     public.cafe_pay_method,
  note       text,
  ref_sale_id uuid references public.cafe_sales(id) on delete cascade,
  person_id  uuid references public.cafe_people(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_cafe_cash_created on public.cafe_cash_moves(created_at desc);

-- ── 7. cafe_ledger (گردش حساب اشخاص) ──
create table if not exists public.cafe_ledger (
  id         uuid primary key default gen_random_uuid(),
  person_id  uuid not null references public.cafe_people(id) on delete cascade,
  amount     bigint not null, -- + بدهی شخص، - تسویه/برگشت
  type       public.cafe_ledger_type not null,
  note       text,
  ref_sale_id uuid,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_cafe_ledger_person on public.cafe_ledger(person_id, created_at desc);

-- ── 8. cafe_day_close (بستن حساب روزانه) ──
create table if not exists public.cafe_day_close (
  id          uuid primary key default gen_random_uuid(),
  close_date  date not null unique,
  system_cash bigint not null default 0,
  counted_cash bigint not null default 0,
  diff        bigint not null default 0,
  sales_total bigint not null default 0,
  sales_cash  bigint not null default 0,
  sales_card  bigint not null default 0,
  sales_credit bigint not null default 0,
  expenses    bigint not null default 0,
  profit      bigint not null default 0,
  note        text,
  closed_by   uuid references public.profiles(id) on delete set null,
  closed_at   timestamptz not null default now()
);

-- ── 9. cafe_audit (تاریخچه تغییرات) ──
create table if not exists public.cafe_audit (
  id         uuid primary key default gen_random_uuid(),
  table_name text not null,
  row_id     uuid,
  action     text not null,
  old_data   jsonb,
  new_data   jsonb,
  admin_id   uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_cafe_audit_created on public.cafe_audit(created_at desc);

-- ── Audit trigger (تاریخچه خودکار همه تغییرات) ──
create or replace function public.cafe_audit_trg()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old jsonb;
  v_new jsonb;
begin
  if tg_op = 'DELETE' then v_old := to_jsonb(old);
  elsif tg_op = 'INSERT' then v_new := to_jsonb(new);
  else v_old := to_jsonb(old); v_new := to_jsonb(new);
  end if;
  insert into public.cafe_audit(table_name, row_id, action, old_data, new_data, admin_id)
  values (tg_table_name, coalesce(v_new->>'id', v_old->>'id')::uuid, lower(tg_op), v_old, v_new, auth.uid());
  return coalesce(new, old);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['cafe_products','cafe_people','cafe_sales','cafe_stock_moves','cafe_cash_moves','cafe_ledger','cafe_day_close'] loop
    execute format('drop trigger if exists trg_cafe_audit_%I on public.%I', t, t);
    execute format('create trigger trg_cafe_audit_%I after insert or update or delete on public.%I for each row execute function public.cafe_audit_trg()', t, t);
  end loop;
end $$;

-- ── RLS (فقط ادمین) ──
do $$
declare t text;
begin
  foreach t in array array['cafe_products','cafe_people','cafe_sales','cafe_sale_items','cafe_stock_moves','cafe_cash_moves','cafe_ledger','cafe_day_close','cafe_audit'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "cafe admin all" on public.%I', t);
    execute format('create policy "cafe admin all" on public.%I for all using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- ============================================================
-- RPCs — security definer, همه با چک ادمین
-- ============================================================

-- ── ثبت فروش (کاهش انبار + صندوق/بدهی به‌صورت خودکار) ──
create or replace function public.cafe_record_sale(
  p_items     jsonb,           -- [{product_id, qty, unit_price?}]
  p_method    public.cafe_pay_method,
  p_person_id uuid default null,
  p_note      text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user  uuid := auth.uid();
  v_sale  uuid;
  v_item  jsonb;
  v_prod  public.cafe_products%rowtype;
  v_qty   int;
  v_price bigint;
  v_total bigint := 0;
  v_cost_total bigint := 0;
begin
  if not public.is_admin() then raise exception 'دسترسی غیرمجاز'; end if;
  if p_method = 'credit' and p_person_id is null then raise exception 'برای فروش نسیه انتخاب مشتری الزامی است'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'سبد فروش خالی است'; end if;

  insert into public.cafe_sales (total, cost_total, method, person_id, note, created_by)
  values (0, 0, p_method, p_person_id, p_note, v_user)
  returning id into v_sale;

  for v_item in select je from jsonb_array_elements(p_items) je loop
    select * into v_prod from public.cafe_products where id = (v_item->>'product_id')::uuid for update;
    if not found then raise exception 'محصول یافت نشد'; end if;
    if not v_prod.is_active then raise exception 'محصول «%» غیرفعال است', v_prod.name; end if;

    v_qty := (v_item->>'qty')::int;
    if v_qty is null or v_qty < 1 then raise exception 'تعداد نامعتبر'; end if;
    if v_prod.stock < v_qty then raise exception 'موجودی «%» کافی نیست (موجودی: %)', v_prod.name, v_prod.stock; end if;

    v_price := coalesce((v_item->>'unit_price')::bigint, v_prod.sell_price);
    if v_price < 0 then raise exception 'قیمت نامعتبر'; end if;

    update public.cafe_products set stock = stock - v_qty where id = v_prod.id;
    insert into public.cafe_stock_moves (product_id, qty, type, reason, ref_sale_id, created_by)
    values (v_prod.id, -v_qty, 'out', 'فروش بوفه', v_sale, v_user);
    insert into public.cafe_sale_items (sale_id, product_id, product_name, qty, unit_price, unit_cost)
    values (v_sale, v_prod.id, v_prod.name, v_qty, v_price, v_prod.buy_price);

    v_total := v_total + v_price * v_qty;
    v_cost_total := v_cost_total + v_prod.buy_price * v_qty;
  end loop;

  update public.cafe_sales set total = v_total, cost_total = v_cost_total where id = v_sale;

  if p_method in ('cash','card') then
    insert into public.cafe_cash_moves (amount, type, method, note, ref_sale_id, created_by)
    values (v_total, 'sale', p_method, 'فروش بوفه — ' || case when p_method = 'cash' then 'نقدی' else 'کارت‌خوان' end, v_sale, v_user);
  else
    insert into public.cafe_ledger (person_id, amount, type, note, ref_sale_id, created_by)
    values (p_person_id, v_total, 'debt', 'خرید نسیه بوفه', v_sale, v_user);
  end if;

  return v_sale;
end;
$$;

-- ── حذف فروش (برگشت انبار + اصلاح صندوق/بدهی) ──
create or replace function public.cafe_delete_sale(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sale public.cafe_sales%rowtype;
  v_it   public.cafe_sale_items%rowtype;
begin
  if not public.is_admin() then raise exception 'دسترسی غیرمجاز'; end if;

  select * into v_sale from public.cafe_sales where id = p_sale_id for update;
  if not found then raise exception 'فروش یافت نشد'; end if;

  -- برگشت موجودی انبار
  for v_it in select * from public.cafe_sale_items where sale_id = p_sale_id loop
    if v_it.product_id is not null then
      update public.cafe_products set stock = stock + v_it.qty where id = v_it.product_id;
      insert into public.cafe_stock_moves (product_id, qty, type, reason, ref_sale_id, created_by)
      values (v_it.product_id, v_it.qty, 'in', 'حذف فروش — برگشت به انبار', p_sale_id, auth.uid());
    end if;
  end loop;

  -- حذف خودکار قلم صندوقِ فروش
  delete from public.cafe_cash_moves where ref_sale_id = p_sale_id and type = 'sale';

  -- اگر نسیه بود، بدهی با یک قلم reversal اصلاح می‌شود (تاریخچه حفظ می‌شود)
  if v_sale.method = 'credit' and v_sale.person_id is not null then
    insert into public.cafe_ledger (person_id, amount, type, note, ref_sale_id, created_by)
    values (v_sale.person_id, -v_sale.total, 'reversal', 'حذف فروش نسیه — برگشت بدهی', p_sale_id, auth.uid());
  end if;

  delete from public.cafe_sales where id = p_sale_id;
end;
$$;

-- ── ثبت/ویرایش محصول ──
create or replace function public.cafe_save_product(
  p_id        uuid,
  p_name      text,
  p_category  text default 'عمومی',
  p_buy_price bigint default 0,
  p_sell_price bigint default 0,
  p_stock     int default 0,
  p_low_stock int default 5,
  p_is_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_old_stock int;
begin
  if not public.is_admin() then raise exception 'دسترسی غیرمجاز'; end if;
  if p_name is null or length(trim(p_name)) < 2 then raise exception 'نام محصول حداقل ۲ حرف باشد'; end if;
  if p_buy_price < 0 or p_sell_price < 0 then raise exception 'قیمت نامعتبر'; end if;

  if p_id is null then
    insert into public.cafe_products (name, category, buy_price, sell_price, stock, low_stock, is_active, created_by)
    values (trim(p_name), coalesce(p_category,'عمومی'), p_buy_price, p_sell_price, greatest(p_stock,0), greatest(p_low_stock,0), p_is_active, auth.uid())
    returning id into v_id;
    if p_stock > 0 then
      insert into public.cafe_stock_moves (product_id, qty, type, reason, created_by)
      values (v_id, p_stock, 'in', 'موجودی اولیه', auth.uid());
    end if;
  else
    select stock into v_old_stock from public.cafe_products where id = p_id for update;
    if not found then raise exception 'محصول یافت نشد'; end if;
    -- موجودی فقط از طریق ورود/خروج کالا تغییر می‌کند
    update public.cafe_products
    set name = trim(p_name), category = coalesce(p_category,'عمومی'), buy_price = p_buy_price,
        sell_price = p_sell_price, low_stock = greatest(p_low_stock,0), is_active = p_is_active
    where id = p_id;
    v_id := p_id;
  end if;
  return v_id;
end;
$$;

-- ── حذف محصول ──
create or replace function public.cafe_delete_product(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then raise exception 'دسترسی غیرمجاز'; end if;
  if exists(select 1 from public.cafe_sale_items where product_id = p_product_id) then
    raise exception 'این محصول در فروش‌ها ثبت شده و حذف آن ممکن نیست — آن را غیرفعال کنید';
  end if;
  delete from public.cafe_products where id = p_product_id;
  if not found then raise exception 'محصول یافت نشد'; end if;
end;
$$;

-- ── ورود کالا به انبار (+ کاهش صندوق در صورت خرید نقدی) ──
create or replace function public.cafe_stock_in(
  p_product_id uuid,
  p_qty        int,
  p_buy_price  bigint default null,
  p_note       text default null,
  p_pay_cash   boolean default true
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prod public.cafe_products%rowtype;
  v_cost bigint;
begin
  if not public.is_admin() then raise exception 'دسترسی غیرمجاز'; end if;
  if p_qty is null or p_qty < 1 then raise exception 'تعداد نامعتبر'; end if;

  select * into v_prod from public.cafe_products where id = p_product_id for update;
  if not found then raise exception 'محصول یافت نشد'; end if;

  v_cost := coalesce(p_buy_price, v_prod.buy_price);
  if v_cost < 0 then raise exception 'قیمت نامعتبر'; end if;

  update public.cafe_products
  set stock = stock + p_qty, buy_price = coalesce(p_buy_price, buy_price)
  where id = p_product_id;

  insert into public.cafe_stock_moves (product_id, qty, type, reason, created_by)
  values (p_product_id, p_qty, 'in', coalesce(p_note, 'ورود کالا'), auth.uid());

  if p_pay_cash and v_cost > 0 then
    insert into public.cafe_cash_moves (amount, type, method, note, created_by)
    values (-(v_cost * p_qty), 'stock', 'cash', 'خرید کالا: ' || v_prod.name || ' × ' || p_qty, auth.uid());
  end if;
end;
$$;

-- ── ثبت/ویرایش شخص ──
create or replace function public.cafe_person_save(
  p_id       uuid,
  p_name     text,
  p_phone    text default null,
  p_note     text default null,
  p_is_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'دسترسی غیرمجاز'; end if;
  if p_name is null or length(trim(p_name)) < 2 then raise exception 'نام حداقل ۲ حرف باشد'; end if;
  if p_id is null then
    insert into public.cafe_people (name, phone, note, is_active)
    values (trim(p_name), p_phone, p_note, p_is_active) returning id into v_id;
  else
    update public.cafe_people set name = trim(p_name), phone = p_phone, note = p_note, is_active = p_is_active where id = p_id;
    if not found then raise exception 'شخص یافت نشد'; end if;
    v_id := p_id;
  end if;
  return v_id;
end;
$$;

-- ── حذف شخص ──
create or replace function public.cafe_person_delete(p_person_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then raise exception 'دسترسی غیرمجاز'; end if;
  if exists(select 1 from public.cafe_ledger where person_id = p_person_id) then
    raise exception 'این شخص گردش حساب دارد و قابل حذف نیست';
  end if;
  delete from public.cafe_people where id = p_person_id;
  if not found then raise exception 'شخص یافت نشد'; end if;
end;
$$;

-- ── ثبت بدهی / تسویه ──
create or replace function public.cafe_ledger_entry(
  p_person_id uuid,
  p_type      public.cafe_ledger_type, -- debt | settle
  p_amount    bigint,
  p_note      text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then raise exception 'دسترسی غیرمجاز'; end if;
  if p_amount is null or p_amount < 1 then raise exception 'مبلغ نامعتبر'; end if;
  if not exists(select 1 from public.cafe_people where id = p_person_id) then raise exception 'شخص یافت نشد'; end if;

  if p_type = 'debt' then
    insert into public.cafe_ledger (person_id, amount, type, note, created_by)
    values (p_person_id, p_amount, 'debt', coalesce(p_note, 'ثبت بدهی'), auth.uid());
  elsif p_type = 'settle' then
    insert into public.cafe_ledger (person_id, amount, type, note, created_by)
    values (p_person_id, -p_amount, 'settle', coalesce(p_note, 'تسویه حساب'), auth.uid());
    -- تسویه = دریافت وجه در صندوق
    insert into public.cafe_cash_moves (amount, type, method, note, person_id, created_by)
    values (p_amount, 'receive', 'cash', 'تسویه حساب: ' || (select name from public.cafe_people where id = p_person_id), p_person_id, auth.uid());
  else
    raise exception 'نوع نامعتبر';
  end if;
end;
$$;

-- ── دریافت/پرداخت وجه صندوق ──
create or replace function public.cafe_cash_move(
  p_type      public.cafe_cash_type, -- income | expense | receive | pay
  p_amount    bigint,
  p_note      text default null,
  p_person_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_amt bigint;
begin
  if not public.is_admin() then raise exception 'دسترسی غیرمجاز'; end if;
  if p_type not in ('income','expense','receive','pay') then raise exception 'نوع نامعتبر'; end if;
  if p_amount is null or p_amount < 1 then raise exception 'مبلغ نامعتبر'; end if;

  v_amt := case when p_type in ('expense','pay') then -p_amount else p_amount end;

  insert into public.cafe_cash_moves (amount, type, method, note, person_id, created_by)
  values (v_amt, p_type, 'cash', p_note, p_person_id, auth.uid());

  -- دریافت از شخص به‌عنوان تسویه بدهی ثبت می‌شود
  if p_type = 'receive' and p_person_id is not null then
    insert into public.cafe_ledger (person_id, amount, type, note, created_by)
    values (p_person_id, -p_amount, 'settle', coalesce(p_note, 'دریافت وجه'), auth.uid());
  end if;
end;
$$;

-- ── بستن حساب روزانه ──
create or replace function public.cafe_close_day(
  p_counted_cash bigint,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_today date := (now() at time zone 'Asia/Tehran')::date;
  v_sys   bigint;
  v_sales_total bigint; v_sales_cash bigint; v_sales_card bigint; v_sales_credit bigint;
  v_expenses bigint; v_profit bigint; v_diff bigint;
begin
  if not public.is_admin() then raise exception 'دسترسی غیرمجاز'; end if;
  if exists(select 1 from public.cafe_day_close where close_date = v_today) then
    raise exception 'حساب امروز قبلاً بسته شده است';
  end if;

  select coalesce(sum(amount),0) into v_sys from public.cafe_cash_moves;
  v_diff := p_counted_cash - v_sys;

  select coalesce(sum(total),0) into v_sales_total
  from public.cafe_sales where (created_at at time zone 'Asia/Tehran')::date = v_today;
  select coalesce(sum(total),0) into v_sales_cash
  from public.cafe_sales where (created_at at time zone 'Asia/Tehran')::date = v_today and method = 'cash';
  select coalesce(sum(total),0) into v_sales_card
  from public.cafe_sales where (created_at at time zone 'Asia/Tehran')::date = v_today and method = 'card';
  select coalesce(sum(total),0) into v_sales_credit
  from public.cafe_sales where (created_at at time zone 'Asia/Tehran')::date = v_today and method = 'credit';
  select coalesce(sum(abs(amount)),0) into v_expenses
  from public.cafe_cash_moves
  where amount < 0 and (created_at at time zone 'Asia/Tehran')::date = v_today;
  select coalesce(sum(total - cost_total),0) into v_profit
  from public.cafe_sales where (created_at at time zone 'Asia/Tehran')::date = v_today;

  -- تعدیل صندوق در صورت اختلاف شمارش
  if v_diff <> 0 then
    insert into public.cafe_cash_moves (amount, type, method, note, created_by)
    values (v_diff, 'close', 'cash', 'اختلاف شمارش صندوق در بستن روز', auth.uid());
    v_sys := p_counted_cash;
  end if;

  insert into public.cafe_day_close
    (close_date, system_cash, counted_cash, diff, sales_total, sales_cash, sales_card, sales_credit, expenses, profit, note, closed_by)
  values
    (v_today, v_sys, p_counted_cash, v_diff, v_sales_total, v_sales_cash, v_sales_card, v_sales_credit, v_expenses, v_profit, p_note, auth.uid());

  return jsonb_build_object(
    'close_date', v_today, 'system_cash', v_sys, 'counted_cash', p_counted_cash,
    'sales_total', v_sales_total, 'sales_cash', v_sales_cash, 'sales_card', v_sales_card,
    'sales_credit', v_sales_credit, 'expenses', v_expenses, 'profit', v_profit
  );
end;
$$;

-- ── داشبورد مالی ──
create or replace function public.cafe_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_today date := (now() at time zone 'Asia/Tehran')::date;
  v_month timestamptz := date_trunc('month', now() at time zone 'Asia/Tehran') at time zone 'Asia/Tehran';
  r jsonb;
begin
  if not public.is_admin() then raise exception 'دسترسی غیرمجاز'; end if;

  select jsonb_build_object(
    'todayIncome',   (select coalesce(sum(total),0) from public.cafe_sales where (created_at at time zone 'Asia/Tehran')::date = v_today),
    'todayProfit',   (select coalesce(sum(total - cost_total),0) from public.cafe_sales where (created_at at time zone 'Asia/Tehran')::date = v_today),
    'todayExpenses', (select coalesce(sum(abs(amount)),0) from public.cafe_cash_moves where amount < 0 and (created_at at time zone 'Asia/Tehran')::date = v_today),
    'todaySalesCount', (select count(*) from public.cafe_sales where (created_at at time zone 'Asia/Tehran')::date = v_today),
    'monthIncome',   (select coalesce(sum(total),0) from public.cafe_sales where created_at >= v_month),
    'monthProfit',   (select coalesce(sum(total - cost_total),0) from public.cafe_sales where created_at >= v_month),
    'monthExpenses', (select coalesce(sum(abs(amount)),0) from public.cafe_cash_moves where amount < 0 and created_at >= v_month),
    'monthSalesCount', (select count(*) from public.cafe_sales where created_at >= v_month),
    'cashbox',       (select coalesce(sum(amount),0) from public.cafe_cash_moves),
    'debts',         (select coalesce(sum(amount),0) from public.cafe_ledger),
    'lowStockCount', (select count(*) from public.cafe_products where is_active and stock <= low_stock)
  ) into r;
  return r;
end;
$$;

-- ── Grants ──
do $$
declare t text;
begin
  foreach t in array array['cafe_products','cafe_people','cafe_sales','cafe_sale_items','cafe_stock_moves','cafe_cash_moves','cafe_ledger','cafe_day_close','cafe_audit'] loop
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

grant execute on function public.cafe_record_sale(jsonb, public.cafe_pay_method, uuid, text) to authenticated;
grant execute on function public.cafe_delete_sale(uuid) to authenticated;
grant execute on function public.cafe_save_product(uuid, text, text, bigint, bigint, int, int, boolean) to authenticated;
grant execute on function public.cafe_delete_product(uuid) to authenticated;
grant execute on function public.cafe_stock_in(uuid, int, bigint, text, boolean) to authenticated;
grant execute on function public.cafe_person_save(uuid, text, text, text, boolean) to authenticated;
grant execute on function public.cafe_person_delete(uuid) to authenticated;
grant execute on function public.cafe_ledger_entry(uuid, public.cafe_ledger_type, bigint, text) to authenticated;
grant execute on function public.cafe_cash_move(public.cafe_cash_type, bigint, text, uuid) to authenticated;
grant execute on function public.cafe_close_day(bigint, text) to authenticated;
grant execute on function public.cafe_dashboard() to authenticated;
