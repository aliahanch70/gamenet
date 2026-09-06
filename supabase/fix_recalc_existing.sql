-- ترمیم مسابقه‌هایی که سیستمی شده‌اند ولی هنوز ضریب دستی دارند
-- در Supabase → SQL Editor فقط برای مسابقه‌ی مورد نظر اجرا کن
-- همه‌ی مسابقه‌های auto با شرط موجود را یک‌جا ترمیم می‌کند:

-- پیش‌نمایش: قبل از اجرا ببین چه می‌شود
select m.id, m.title, m.odds_mode, m.odds_a, m.odds_b, count(b.id) as bet_count
from public.matches m left join public.bets b on b.match_id=m.id
where m.odds_mode='auto' group by m.id;

-- اجرا:
select public.recalc_odds(id) from public.matches where odds_mode='auto';

-- تایید:
select id, title, odds_mode, odds_a, odds_b, odds_draw from public.matches where odds_mode='auto';

-- اگر فقط یک مسابقه را می‌خواهی:
-- select public.recalc_odds('MATCH_UUID_HERE');
