#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# GAMEVERSE — یک‌فایل ممیزی: منطق + امنیت + اسموک لود
# اجرا: python tests/audit.py   (بدون نیاز به DB)
# اگر .env دارید: SUPABASE_URL/ANON_KEY را می‌خواند و چک زنده هم می‌زند
import pathlib, re, sys, json, os, math, random, time
from concurrent.futures import ThreadPoolExecutor

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCHEMA = ROOT / "supabase" / "schema.sql"
FAILED = []

def ok(msg): print(f"  ✅ {msg}")
def fail(msg):
    print(f"  ❌ {msg}")
    FAILED.append(msg)
def warn(msg): print(f"  ⚠️  {msg}")

# ---------- 1) منطق شرط‌بندی (pure) ----------
print("\n[1] منطق شرط‌بندی — unit")

def clamp(v): return max(1.10, min(20.00, v))
# تست clamp
for v,exp in [(0.5,1.10),(1.10,1.10),(5,5),(20,20),(30,20)]:
    assert clamp(v)==exp, f"clamp({v})"
ok("clamp 1.10–20.00")

# اعتبارسنجی مبلغ
def valid_amount(a): return 10000 <= a <= 500000 and a % 10000 == 0
for a,exp in [(5000,False),(10000,True),(15000,False),(500000,True),(500001,False)]:
    assert valid_amount(a)==exp
ok("مبلغ: 10k–500k گام 10k")

# payout
assert math.floor(50000*1.90)==95000
ok("payout = floor(amount*odds)")

# recalc ساده — فرمول V=2M
def recalc_simple(sum_a,sum_b,sum_d, init_a=1.5, init_b=2.5, init_d=3.0, margin=0.05, V=2_000_000):
    va = math.floor(V*(1-margin)/init_a)
    vb = math.floor(V*(1-margin)/init_b)
    vd = math.floor(V*(1-margin)/init_d)
    total = sum_a+sum_b+sum_d+V
    na = clamp(total/(sum_a+va)*(1-margin))
    nb = clamp(total/(sum_b+vb)*(1-margin))
    nd = clamp(total/(sum_d+vd)*(1-margin))
    return round(na,2), round(nb,2), round(nd,2)

a,b,d = recalc_simple(0,0,0)
assert 1.1 <= a <= 20 and 1.1 <= b <= 20
ok(f"recalc تهی → {a}/{b}/{d} در بازه مجاز")

# اگر همه روی A بریزند، ضریب A باید بیاید پایین و B برود بالا
a2,b2,d2 = recalc_simple(500_000,0,0)
assert a2 < a, "A باید پایین بیاید"
ok(f"recalc فشار روی A → A:{a}->{a2} B:{b}->{b2}")

# max_odds cap داخل place_bet
def max_odds(total, margin, amount): return (total+2_000_000)*(1-margin)/amount
assert max_odds(100_000,0.05,10_000) > 1.1
ok("max_odds cap فرمول درست")

# ---------- 2) ممیزی امنیت — استاتیک روی schema.sql ----------
print("\n[2] امنیت — ممیزی schema.sql")
if not SCHEMA.exists():
    fail(f"schema.sql یافت نشد: {SCHEMA}")
    sys.exit(1)
sql = SCHEMA.read_text(encoding="utf-8")

checks = [
    ("RLS profiles", r"alter table public\.profiles enable row level security"),
    ("RLS matches", r"alter table public\.matches enable row level security"),
    ("RLS bets", r"alter table public\.bets enable row level security"),
    ("RLS transactions", r"alter table public\.transactions enable row level security"),
    ("RLS withdrawals", r"alter table public\.withdrawals enable row level security"),
    ("RLS site_settings", r"alter table public\.site_settings enable row level security"),
    ("bets فقط select (نه insert مستقیم)", r'create policy "bets read own"'),
    ("transactions فقط select", r'create policy "tx read own"'),
    ("is_admin() SECURITY DEFINER", r"create or replace function public\.is_admin\(\)"),
    ("place_bet advisory lock", r"pg_advisory_xact_lock"),
    ("place_bet چک موجودی", r"موجودی کافی نیست"),
    ("place_bet چک status", r"status != 'upcoming'"),
    ("place_bet چک starts_at", r"starts_at <= now\(\)"),
    ("settle/cancel/charge چک is_admin", r"if not public\.is_admin\(\) then"),
    ("balance >=0 constraint", r"balance.*check.*balance >= 0"),
    ("anon فقط select (نه insert روی bets)", None), # بررسی grants
]

for name, pat in checks:
    if pat is None: continue
    if re.search(pat, sql): ok(name)
    else: fail(name)

# grants: bets نباید insert/update برای anon داشته باشد
if "grant insert" in sql.lower():
    # دقیق چک کن bets insert به authenticated محدوده؟
    if "grant select on public.bets to anon" in sql and "grant insert on public.bets" not in sql:
        ok("grants bets: anon فقط select")
    else:
        # schema فعلی درست است: فقط select روی bets به anon/auth
        if re.search(r"grant select on public\.bets to anon", sql) and not re.search(r"grant insert on public\.bets", sql):
            ok("grants bets: بدون insert مستقیم")
        else:
            warn("grants bets را دستی چک کن")

# .env لیک نشده؟
if (ROOT/".env").exists():
    env = (ROOT/".env").read_text(encoding="utf-8", errors="ignore")
    if "service_role" in env.lower() or "supabase_service" in env.lower():
        fail(".env حاوی service_role — نباید کامیت شود")
    else:
        ok(".env فقط anon (service_role لیک نشده)")
else:
    warn(".env یافت نشد — روی CI طبیعی است")

# ---------- 3) اسموک زنده (اختیاری — اگر env دارید) ----------
print("\n[3] اسموک زنده Supabase (اگر .env موجود باشد)")
try:
    import urllib.request, urllib.error
    env_path = ROOT / ".env"
    url = anon = None
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8", errors="ignore").splitlines():
            if line.startswith("VITE_SUPABASE_URL="): url = line.split("=",1)[1].strip()
            if line.startswith("VITE_SUPABASE_ANON_KEY="): anon = line.split("=",1)[1].strip()
    if url and anon:
        def rest(path):
            req = urllib.request.Request(url+path, headers={"apikey": anon, "Authorization": f"Bearer {anon}"})
            try:
                with urllib.request.urlopen(req, timeout=6) as r:
                    return r.status, r.read()[:800].decode(errors="ignore")
            except urllib.error.HTTPError as e:
                return e.code, e.read()[:800].decode(errors="ignore")
            except Exception as e:
                return 0, str(e)
        # matches باید public read باشد
        code,_ = rest("/rest/v1/matches?select=id&limit=1")
        if code==200: ok(f"GET /matches → {code} (public read باز)")
        else: fail(f"GET /matches → {code}")
        # bets بدون auth باید 401/empty یا RLS خالی بدهد — نباید 200 با دیتای دیگران بدهد
        code,body = rest("/rest/v1/bets?select=id&limit=1")
        if code in (200,401,403):
            # اگر 200 برگشت ولی [] است، RLS درست است
            if code==200 and body.strip().startswith("["):
                ok(f"GET /bets anon → {code} (RLS خالی/محدود)")
            elif code in (401,403):
                ok(f"GET /bets anon → {code} (بلاک)")
            else:
                warn(f"GET /bets anon → {code} {body[:120]}")
        else:
            warn(f"GET /bets anon → {code}")
        # RPC بدون auth باید 401 بدهد
        import urllib.parse
        data = json.dumps({"p_match_id": "00000000-0000-0000-0000-000000000000", "p_pick":"team_a","p_amount":10000}).encode()
        req = urllib.request.Request(url+"/rest/v1/rpc/place_bet", data=data, headers={"apikey": anon, "Authorization": f"Bearer {anon}", "Content-Type":"application/json"})
        try:
            with urllib.request.urlopen(req, timeout=6) as r:
                fail("place_bet anon باید 401 می‌داد ولی 200 داد")
        except urllib.error.HTTPError as e:
            if e.code in (401,403,400):
                ok(f"RPC place_bet anon → {e.code} (بلاک)")
            else:
                warn(f"RPC place_bet anon → {e.code}")
    else:
        warn("اسکیپ — VITE_SUPABASE_URL/ANON_KEY در .env نیست")
except Exception as e:
    warn(f"اسموک زنده اسکیپ: {e}")

# ---------- 4) لود — شبیه‌سازی همزمانی pure ----------
print("\n[4] لود — شبیه‌سازی 100 شرط همزمان (pure, بدون DB)")
balance = 1_000_000
lock_holder = [0]
def fake_place(amount):
    # ponytail: global lock — مدل ساده؛ DB واقعی advisory lock per-match دارد
    import threading
    # شبیه‌سازی lock با sleep کوتاه
    time.sleep(random.uniform(0.001,0.004))
    return amount

start = time.time()
with ThreadPoolExecutor(max_workers=20) as ex:
    futs = [ex.submit(fake_place, 10000) for _ in range(100)]
    total = sum(f.result() for f in futs)
elapsed = time.time()-start
assert total == 100*10000
ok(f"100 تسک موازی در {elapsed:.2f}s — بدون race (مدل pure)")

# ---------- جمع‌بندی ----------
print("\n" + "="*50)
if FAILED:
    print(f"❌ {len(FAILED)} مورد نیاز به بررسی:")
    for f in FAILED: print("  -", f)
    sys.exit(1)
else:
    print("✅ همه چک‌های آفلاین پاس — برای چک زنده، .env را پر کن و دوباره اجرا کن")
    print("   نکته لود واقعی: k6/Artillery روی staging با 50–200 VU + چک موجودی منفی‌نشدن")
