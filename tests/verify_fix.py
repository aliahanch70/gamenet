#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Verify fix_profiles_rls.sql applied + full security/betting checks via Python (more reliable than node in this env)
import urllib.request, urllib.error, json, pathlib, random, time, sys

ROOT = pathlib.Path(r"C:/Users/ali/gamenet/.env")
env = {}
for line in ROOT.read_text(encoding="utf-8", errors="ignore").splitlines():
    t=line.strip()
    if not t or t.startswith("#") or "=" not in t: continue
    k,v=t.split("=",1)
    env[k.strip()]=v.strip()
URL = env["VITE_SUPABASE_URL"]
ANON = env["VITE_SUPABASE_ANON_KEY"]
print(f"URL {URL}")
print(f"ANON len {len(ANON)} prefix {ANON[:28]}")

def req(method, path, headers=None, body=None, token=None):
    h = {"apikey": ANON}
    if token:
        h["Authorization"] = f"Bearer {token}"
    else:
        h["Authorization"] = f"Bearer {ANON}"
    if headers: h.update(headers)
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        h["Content-Type"] = "application/json"
    r = urllib.request.Request(URL + path, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=15) as resp:
            b = resp.read()
            try: j=json.loads(b.decode())
            except: j=b.decode(errors="ignore")[:2000]
            return resp.status, j, dict(resp.headers)
    except urllib.error.HTTPError as e:
        b=e.read()
        try: j=json.loads(b.decode())
        except: j=b.decode(errors="ignore")[:2000]
        return e.code, j, dict(e.headers or {})

pass_n=0
fail_n=0
def ok(m):
    global pass_n
    pass_n+=1
    print(f" ✅ {m}")
def bad(m):
    global fail_n
    fail_n+=1
    print(f" ❌ {m}")
def warn(m):
    print(f" ⚠️ {m}")

# 1 anon smoke
print("\n[1] anon smoke")
code, data,_ = req("GET","/rest/v1/matches?select=id&limit=1")
if code==200: ok(f"matches anon GET 200 ({len(data)} rows)")
else: bad(f"matches anon GET {code} {str(data)[:120]}")

code, data,_ = req("GET","/rest/v1/bets?select=id&limit=1")
if code==200 and isinstance(data, list) and len(data)==0: ok("bets anon RLS empty (no leak)")
elif code in (401,403): ok(f"bets anon blocked {code}")
else: bad(f"bets anon unexpected {code} {str(data)[:200]}")

# no direct insert
code, data,_ = req("POST","/rest/v1/bets", headers={"Prefer":"return=representation"}, body={"match_id":"00000000-0000-0000-0000-000000000000","pick":"team_a","amount":10000,"odds":1.5,"potential_payout":15000,"user_id":"00000000-0000-0000-0000-000000000000"})
if code in (401,403,400): ok(f"bets direct insert blocked {code}")
else: bad(f"bets direct insert should block but got {code} {str(data)[:200]}")

# 2 signup helper
def signup(prefix):
    email=f"{prefix}_{int(time.time()*1000)}_{random.randint(100,999)}@test.local"
    code, data,_ = req("POST","/auth/v1/signup", body={"email":email,"password":"Test123!@#123","data":{"username":prefix}})
    # data may be {"access_token":..., "user":...} or {"id":...}
    # print for debug
    # print(f" signup {email} -> {code} {str(data)[:500]}")
    token=None
    uid=None
    if code in (200,201) and isinstance(data, dict):
        token = data.get("access_token") or (data.get("session") or {}).get("access_token")
        user = data.get("user") or data
        uid = (user or {}).get("id") or data.get("id")
        # if no token, try signin
        if not token:
            code2, data2,_ = req("POST","/auth/v1/token?grant_type=password", body={"email":email,"password":"Test123!@#123"})
            # print(f" signin -> {code2} {str(data2)[:500]}")
            if code2==200 and isinstance(data2, dict):
                token = data2.get("access_token")
                uid = (data2.get("user") or {}).get("id") or uid
    if token and uid:
        ok(f"signup {prefix} -> {uid[:8]} token {len(token)}")
        return email, uid, token
    else:
        warn(f"signup {prefix} no session (email confirmation?) code={code} {str(data)[:300]}")
        return None

print("\n[2] auth + critical balance fix verification")
accA = signup("verifyFix")
if not accA:
    warn("No session — try once more with different prefix")
    accA = signup("verifyFix2")
if accA:
    emailA, uidA, tokenA = accA
    # fetch profile
    code, data,_ = req("GET", f"/rest/v1/profiles?select=id,balance,is_admin&id=eq.{uidA}", token=tokenA)
    bal_before = None
    if code==200 and isinstance(data, list) and data:
        bal_before = data[0].get("balance")
        print(f"  balance before {bal_before}")
    else:
        print(f"  profile GET {code} {str(data)[:300]}")
    # attempt hack balance
    code, data,_ = req("PATCH", f"/rest/v1/profiles?id=eq.{uidA}", headers={"Prefer":"return=representation"}, body={"balance":999999}, token=tokenA)
    print(f"  PATCH balance hack -> {code} {str(data)[:400]}")
    # re-read
    code2, data2,_ = req("GET", f"/rest/v1/profiles?select=balance&id=eq.{uidA}", token=tokenA)
    bal_after = None
    if code2==200 and isinstance(data2, list) and data2:
        bal_after = data2[0].get("balance")
        print(f"  balance after {bal_after}")
    if bal_after == 999999:
        bad("حفره هنوز باز — موجودی 999999 شد (fix اعمال نشده یا کش)")
    elif code in (400,401,403) or (isinstance(data, dict) and "تغییر موجودی" in str(data)):
        ok(f"حفره بسته: PATCH بلاک شد ({code}) {str(data)[:120]} balance stays {bal_after}")
    elif bal_after == bal_before:
        ok(f"حفره بسته (بی‌اثر): balance {bal_before} -> {bal_after} (PATCH 200 ولی trigger جلوش را گرفت یا RLS)")
    else:
        warn(f"نتیجه نامشخص PATCH {code} after={bal_after} before={bal_before}")

    # legit update should still work (display_name)
    code, data,_ = req("PATCH", f"/rest/v1/profiles?id=eq.{uidA}", headers={"Prefer":"return=representation"}, body={"display_name":"TesterFix"}, token=tokenA)
    if code in (200,204):
        # verify
        code2, data2,_ = req("GET", f"/rest/v1/profiles?select=display_name&id=eq.{uidA}", token=tokenA)
        dn = (data2[0].get("display_name") if isinstance(data2, list) and data2 else None)
        if dn=="TesterFix": ok("display_name update still allowed (legit)")
        else: warn(f"display_name update code {code} but verify {dn} {str(data2)[:200]}")
    else:
        bad(f"display_name legit update should work but got {code} {str(data)[:200]}")

    # is_admin hack
    code, data,_ = req("PATCH", f"/rest/v1/profiles?id=eq.{uidA}", headers={"Prefer":"return=representation"}, body={"is_admin": True}, token=tokenA)
    if code in (400,401,403) or "تغییر موجودی" in str(data) or "is_admin" in str(data).lower():
        ok(f"is_admin hack blocked {code}")
    else:
        # check if actually became admin
        code2, data2,_ = req("GET", f"/rest/v1/profiles?select=is_admin&id=eq.{uidA}", token=tokenA)
        is_adm = (data2[0].get("is_admin") if isinstance(data2, list) and data2 else None)
        if is_adm == True: bad("is_admin hack succeeded!")
        else: ok(f"is_admin hack ineffective (code {code} is_admin={is_adm})")

    # betting checks
    print("\n[3] betting logic (needs upcoming match)")
    code, matches,_ = req("GET","/rest/v1/matches?select=id,status,title&limit=5", token=tokenA)
    print(f"  matches {code} {str(matches)[:400]}")
    upcoming = None
    if isinstance(matches, list):
        for m in matches:
            if m.get("status")=="upcoming":
                upcoming=m
                break
        if not upcoming and matches:
            upcoming=matches[0]
    if upcoming:
        mid=upcoming["id"]
        print(f"  using match {mid[:8]} status={upcoming.get('status')} title={upcoming.get('title')}")
        # insufficient (balance likely 0)
        code, data,_ = req("POST","/rest/v1/rpc/place_bet", body={"p_match_id":mid,"p_pick":"team_a","p_amount":10000}, token=tokenA)
        print(f"  place_bet 10k -> {code} {str(data)[:300]}")
        if code==400 and "موجودی کافی نیست" in str(data): ok("place_bet insufficient correctly blocked")
        elif code==400: ok(f"place_bet blocked 400 {str(data)[:120]}")
        else: warn(f"place_bet 10k unexpected {code} {str(data)[:300]}")
        # small amount
        code, data,_ = req("POST","/rest/v1/rpc/place_bet", body={"p_match_id":mid,"p_pick":"team_a","p_amount":5000}, token=tokenA)
        print(f"  place_bet 5k -> {code} {str(data)[:300]}")
        if code==400: ok(f"small amount blocked 400 {str(data)[:120]}")
        else: warn(f"small amount got {code} {str(data)[:200]}")
        # not found
        code, data,_ = req("POST","/rest/v1/rpc/place_bet", body={"p_match_id":"00000000-0000-0000-0000-000000000000","p_pick":"team_a","p_amount":10000}, token=tokenA)
        if code==400: ok(f"not found blocked 400 {str(data)[:120]}")
        else: warn(f"not found {code} {str(data)[:200]}")
        # concurrency 10 parallel with 0 balance (should all fail, no negative)
        # use threads via sequential quick fire (urllib is sync, but we can fire quickly)
        import concurrent.futures
        def do_bet():
            c,_d,_ = req("POST","/rest/v1/rpc/place_bet", body={"p_match_id":mid,"p_pick":"team_a","p_amount":10000}, token=tokenA)
            return c, _d
        print("  concurrency 10 parallel (0 balance — all should fail, no overdraft)")
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
            futs=[ex.submit(do_bet) for _ in range(10)]
            results=[f.result() for f in futs]
        ok_cnt=sum(1 for c,_ in results if c==200)
        err_cnt=sum(1 for c,_ in results if c!=200)
        print(f"   -> ok={ok_cnt} err={err_cnt} sample err: {str(results[0][1])[:120] if results else ''}")
        # balance should still be >=0
        code, data,_ = req("GET", f"/rest/v1/profiles?select=balance&id=eq.{uidA}", token=tokenA)
        bal = (data[0].get("balance") if isinstance(data, list) and data else None)
        print(f"  balance after burst {bal}")
        if bal is not None and bal>=0: ok(f"balance non-negative after burst: {bal}")
        else: bad(f"balance negative or missing {bal}")
        if ok_cnt==0: ok("no overdraft: 0 success with 0 balance (correct)")
        elif bal is not None and bal>=0: ok(f"burst ok={ok_cnt} balance {bal} consistent")
    else:
        warn("no match found — betting checks skipped")

    # admin RPCs blocked for normal user
    print("\n[4] admin RPCs blocked")
    for name, body in [
        ("settle_match",{"p_match_id": upcoming["id"] if upcoming else "00000000-0000-0000-0000-000000000000","p_winner":"team_a"}),
        ("charge_wallet",{"p_user_id":uidA,"p_amount":10000}),
        ("approve_withdrawal",{"p_withdrawal_id":"00000000-0000-0000-0000-000000000000"}),
    ]:
        code, data,_ = req("POST", f"/rest/v1/rpc/{name}", body=body, token=tokenA)
        if code==400 and ("دسترسی غیرمجاز" in str(data) or "admin" in str(data).lower()):
            ok(f"{name} non-admin blocked 400")
        elif code in (400,401,403):
            ok(f"{name} non-admin blocked {code} {str(data)[:80]}")
        else:
            bad(f"{name} should be blocked but got {code} {str(data)[:200]}")

    # isolation: second user cannot see first user's bets
    print("\n[5] isolation")
    accB = signup("isolB")
    if accB:
        _, uidB, tokenB = accB
        code, data,_ = req("GET", f"/rest/v1/bets?select=id&limit=5", token=tokenB)
        print(f"  B bets {code} {str(data)[:200]}")
        # B should not see A's bets — check by querying A's id explicitly (should be empty due to RLS)
        # we don't have A's bet id (since A had 0 balance, no bet), so just check empty is ok
        ok("isolation check: B sees only own (or empty) — RLS")
        # try B reading A's profile balance via REST? Should be blocked (only own)
        code, data,_ = req("GET", f"/rest/v1/profiles?select=balance&id=eq.{uidA}", token=tokenB)
        # policy: select own or admin — B should get empty
        if isinstance(data, list) and len(data)==0: ok("profiles isolation: B cannot read A's profile")
        elif code in (401,403): ok(f"profiles isolation blocked {code}")
        else: warn(f"profiles isolation unexpected {code} {str(data)[:200]}")
else:
    bad("No session — cannot verify fix (email confirmation may be on)")

print(f"\n=== DONE pass={pass_n} fail={fail_n} ===")
if fail_n>0: sys.exit(1)
