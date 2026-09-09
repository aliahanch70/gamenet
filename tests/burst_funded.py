#!/usr/bin/env python3
# burst_funded — هجوم با موجودی واقعی: charge → 20 موازی place_bet → invariant
import urllib.request, urllib.error, json, pathlib, random, time, sys, concurrent.futures, getpass

ROOT = pathlib.Path(r"C:/Users/ali/gamenet/.env")
env={}
for l in ROOT.read_text(encoding="utf-8", errors="ignore").splitlines():
    t=l.strip()
    if not t or t.startswith("#") or "=" not in t: continue
    k,v=t.split("=",1); env[k.strip()]=v.strip()
URL=env["VITE_SUPABASE_URL"]; ANON=env["VITE_SUPABASE_ANON_KEY"]

def req(method, path, headers=None, body=None, token=None):
    h={"apikey":ANON, "Authorization": f"Bearer {token or ANON}"}
    if headers: h.update(headers)
    data=None
    if body is not None:
        data=json.dumps(body).encode(); h["Content-Type"]="application/json"
    r=urllib.request.Request(URL+path, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=15) as resp:
            b=resp.read()
            try: j=json.loads(b.decode())
            except: j=b.decode(errors="ignore")[:2000]
            return resp.status, j, dict(resp.headers)
    except urllib.error.HTTPError as e:
        b=e.read()
        try: j=json.loads(b.decode())
        except: j=b.decode(errors="ignore")[:2000]
        return e.code, j, dict(e.headers or {})

def login(email, pw):
    code, data,_ = req("POST","/auth/v1/token?grant_type=password", body={"email":email,"password":pw})
    if code==200 and isinstance(data,dict):
        return data.get("access_token"), (data.get("user") or {}).get("id")
    print(f"login {email} -> {code} {str(data)[:400]}"); return None,None

def signup(prefix):
    email=f"{prefix}_{int(time.time()*1000)}_{random.randint(100,999)}@test.local"
    code, data,_ = req("POST","/auth/v1/signup", body={"email":email,"password":"Test123!@#123","data":{"username":prefix}})
    tok=data.get("access_token") if isinstance(data,dict) else None
    uid=(data.get("user") or {}).get("id") if isinstance(data,dict) else None
    if not tok:
        c2,d2,_=req("POST","/auth/v1/token?grant_type=password", body={"email":email,"password":"Test123!@#123"})
        if c2==200: tok=d2.get("access_token"); uid=(d2.get("user") or {}).get("id")
    return email, uid, tok

# --- get admin creds ---
admin_email = env.get("ADMIN_EMAIL") or env.get("VITE_ADMIN_EMAIL")
admin_pw = env.get("ADMIN_PASSWORD") or env.get("VITE_ADMIN_PASSWORD")
if not admin_email:
    print("ADMIN_EMAIL در .env نیست — ایمیل ادمین را وارد کن (همونی که شارژ کردی):")
    try: admin_email=input("admin email: ").strip()
    except: sys.exit(1)
if not admin_pw:
    try: admin_pw=getpass.getpass("admin password: ")
    except: admin_pw=input("admin password: ").strip()
if not admin_email or not admin_pw:
    print("لغو"); sys.exit(1)

atok, aid = login(admin_email, admin_pw)
if not atok:
    print("لاگین ادمین ناموفق — ایمیل/پسورد را چک کن"); sys.exit(1)
print(f"admin {aid[:8]} token {len(atok)}")
# check admin flag
code, data,_ = req("GET", f"/rest/v1/profiles?select=is_admin,balance&id=eq.{aid}", token=atok)
print(f"admin profile {code} {str(data)[:300]}")

# pick upcoming match
code, matches,_ = req("GET","/rest/v1/matches?select=id,status,title&limit=10", token=atok)
up=None
for m in (matches if isinstance(matches,list) else []):
    if m.get("status")=="upcoming": up=m; break
if not up and isinstance(matches,list) and matches: up=matches[0]
if not up: print("هیچ مسابقه‌ای نیست"); sys.exit(1)
mid=up["id"]; print(f"match {mid[:8]} {up.get('title')} {up.get('status')}")

# create victim user
email, uid, tok = signup("burstVictim")
if not tok: print("ساخت کاربر تست ناموفق"); sys.exit(1)
print(f"victim {uid[:8]} {email}")

# charge via admin
amount=200000
code, data,_ = req("POST","/rest/v1/rpc/charge_wallet", body={"p_user_id":uid,"p_amount":amount}, token=atok)
print(f"charge {amount} -> {code} {str(data)[:300]}")
if code!=200: print("شارژ ناموفق — ادمین نیست یا RLS"); sys.exit(1)

code, data,_ = req("GET", f"/rest/v1/profiles?select=balance&id=eq.{uid}", token=tok)
bal_before=(data[0].get("balance") if isinstance(data,list) and data else None)
print(f"balance before {bal_before}")
if bal_before!=amount: print(f"هشدار balance {bal_before} != {amount}")

# burst 20 parallel 10k
N=20; STAKE=10000
def do_bet():
    c,d,_=req("POST","/rest/v1/rpc/place_bet", body={"p_match_id":mid,"p_pick":"team_a","p_amount":STAKE}, token=tok)
    return c,d

print(f"burst {N}x {STAKE} ...")
with concurrent.futures.ThreadPoolExecutor(max_workers=20) as ex:
    futs=[ex.submit(do_bet) for _ in range(N)]
    results=[f.result() for f in futs]
ok=sum(1 for c,_ in results if c==200)
err=N-ok
print(f" -> ok={ok} err={err}")
for c,d in results[:3]: print(f"  sample {c} {str(d)[:200]}")

code, data,_ = req("GET", f"/rest/v1/profiles?select=balance&id=eq.{uid}", token=tok)
bal_after=(data[0].get("balance") if isinstance(data,list) and data else None)
print(f"balance after {bal_after}")
if bal_before is not None and bal_after is not None:
    expected = bal_before - ok*STAKE
    if bal_after==expected and bal_after>=0:
        print(f"✅ PASS invariant: {bal_before} - {ok}*{STAKE} = {bal_after} (non-negative, no overdraft)")
    else:
        print(f"❌ FAIL invariant: before {bal_before} ok {ok} after {bal_after} expected {expected}")
        sys.exit(1)
    if ok>0 and ok<N:
        print(f"ℹ️ partial fill ok — clamp/balance limit worked, no negative")
    elif ok==N:
        print(f"ℹ️ all {N} succeeded — balance sufficient, concurrency safe")
    elif ok==0:
        print(f"ℹ️ all blocked — check match status/amount clamp")
else:
    print("balance read failed"); sys.exit(1)
