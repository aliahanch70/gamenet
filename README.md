# GAMEVERSE — گیم‌نت + شرط‌بندی (Supabase)

## راه‌اندازی (۲ دقیقه)

1) **Supabase پروژه بساز** → Project URL و anon key را کپی کن.

2) **`.env` بساز** (از روی `.env.example`):
```
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...
```

3) **دیتابیس را بساز**: در Supabase Dashboard → SQL Editor → محتوای `supabase/schema.sql` را paste و Run کن.
   - جدول‌های `profiles / matches / bets / transactions` + تابع‌ها + RLS + تریگر ساخته می‌شود.
   - ۳ مسابقه نمونه seed می‌شود.

4) **ادمین کن**: بعد از اولین ثبت‌نام، در SQL Editor بزن:
```sql
update profiles set is_admin=true where username='YOUR_USERNAME';
-- یا
update profiles set is_admin=true where id='YOUR_UUID';
```

5) **اجرا**:
```
npm install
npm run dev   # http://localhost:3000
npm run build # production
```

## اتصال Supabase (کد)
```ts
import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
// ثبت‌نام
await supabase.auth.signUp({ email, password, options:{ data:{ username } } })
// ورود
await supabase.auth.signInWithPassword({ email, password })
// شرط (اتمیک، از کیف پول کسر می‌کند)
await supabase.rpc('place_bet', { p_match_id, p_pick:'team_a', p_amount:50000 })
// شارژ (ادمین)
await supabase.rpc('charge_wallet', { p_user_id, p_amount:100000 })
// تسویه (ادمین — بردها را واریز می‌کند)
await supabase.rpc('settle_match', { p_match_id, p_winner:'team_a' })
```

## امنیت
- شرط‌بندی پشت `Guard` احراز هویت است؛ مهمان redirect به `/auth`.
- RLS: `profiles` (همه می‌خوانند، خودشان/ادمین ویرایش)، `matches` (همه خواندن، ادمین نوشتن)، `bets/transactions` (صاحب + ادمین).
- تمام پول با `SECURITY DEFINER` RPC جابجا می‌شود — هیچ کلاینتی مستقیم balance را تغییر نمی‌دهد.

## ضرایب هوشمند
فعلاً ثابت (ادمین هنگام ساخت مسابقه وارد می‌کند). ارتقاء: تابع `recalc_odds(match_id)` که بر اساس `sum(amount) group by pick` ضرایب را `total_pool / pool_pick` محاسبه کند — یک RPC اضافه است.
