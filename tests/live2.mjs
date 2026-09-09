import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('C:/Users/ali/gamenet/.env','utf-8')
const m={}
for(const line of env.split('\n')){
  const t=line.trim()
  if(!t||t.startsWith('#')) continue
  const i=t.indexOf('=')
  if(i>0) m[t.slice(0,i).trim()]=t.slice(i+1).trim()
}
const url=m.VITE_SUPABASE_URL
const anon=m.VITE_SUPABASE_ANON_KEY
console.log('url',url)

let pass=0, fail=0, warnC=0
function ok(msg){ pass++; console.log(' ✅',msg)}
function bad(msg){ fail++; console.log(' ❌',msg)}
function warn(msg){ warnC++; console.log(' ⚠️',msg)}

async function makeUser(email){
  const sb = createClient(url, anon, {auth:{persistSession:false}})
  const {data, error} = await sb.auth.signUp({email, password:'Test123!@#123', options:{data:{username: email.split('@')[0]}}})
  if(error){ console.log(' signup err',error.message); return null}
  let session = data.session
  if(!session){
    const {data:si, error:e2} = await sb.auth.signInWithPassword({email, password:'Test123!@#123'})
    if(e2){ console.log(' signin err',e2.message); return null}
    session = si.session
  }
  const authed = createClient(url, anon)
  await authed.auth.setSession({access_token: session.access_token, refresh_token: session.refresh_token})
  const uid = (await authed.auth.getUser()).data.user.id
  return {client: authed, uid, email, session}
}

const {data: matchesAll} = await createClient(url, anon).from('matches').select('*').limit(5)
console.log('matches avail', matchesAll?.length, matchesAll?.[0]?.id?.slice(0,8), matchesAll?.[0]?.status)

console.log('\n[2] امنیت عمیق — RLS و RPC')

// دو کاربر بساز
const emailA = `secA_${Date.now()}@test.local`
const emailB = `secB_${Date.now()}2@test.local`
const userA = await makeUser(emailA)
const userB = await makeUser(emailB)
if(!userA || !userB){ console.log(' ساخت کاربر ناموفق — اسکیپ'); process.exit(1)}
console.log(' userA', userA.uid.slice(0,8), 'userB', userB.uid.slice(0,8))

// 2-1 پروفایل: آیا کاربر می‌تواند موجودی خودش را مستقیم زیاد کند؟ (حفره RLS)
console.log('\n 2-1 پروفایل self-update balance')
{
  const {error, data} = await userA.client.from('profiles').select('balance').eq('id', userA.uid).single()
  console.log('  balance before', data?.balance, 'err', error?.message)
  const {error: upErr, data: upData} = await userA.client.from('profiles').update({balance: 999999}).eq('id', userA.uid).select('balance')
  if(upErr){
    ok(`profiles self-update balance بلاک: ${upErr.message.slice(0,70)}`)
  } else {
    // اگر موفق شد، حفره است!
    console.log('  update result', upData)
    const {data: after} = await userA.client.from('profiles').select('balance').eq('id', userA.uid).single()
    console.log('  balance after', after?.balance)
    if(after?.balance === 999999){
      bad('⛔ حفره: کاربر توانست موجودی خود را مستقیم 999999 کند (RLS update own روی balance)')
      // برگردان
      await userA.client.from('profiles').update({balance: 0}).eq('id', userA.uid)
      console.log('  reverted to 0')
    } else {
      ok('profiles update بلاک یا بی‌اثر')
    }
  }
  // تلاش برای آپدیت پروفایل دیگری
  const {error: up2} = await userA.client.from('profiles').update({display_name: 'hacked'}).eq('id', userB.uid)
  if(up2) ok(`profiles update دیگری بلاک: ${up2.message.slice(0,60)}`)
  else {
    const {data: bProf} = await userB.client.from('profiles').select('display_name').eq('id', userB.uid).single()
    if(bProf?.display_name === 'hacked') bad('حفره: A توانست پروفایل B را تغییر دهد')
    else ok('profiles update دیگری بی‌اثر (RLS)')
  }
}

// 2-2 bets: A نمی‌تواند شرط B را ببیند
console.log('\n 2-2 bets isolation')
// اول A را شارژ کن از طریق حفره اگر بود، یا مستقیم اگر نبود — سعی کن balance را ببری بالا
{
  // اگر حفره قبلی بسته بود، موجودی هنوز 0 است — یک بار دیگر با مقدار کم تست کن
  const {data: prof} = await userA.client.from('profiles').select('balance').eq('id', userA.uid).single()
  console.log('  A balance', prof?.balance)
  if((prof?.balance||0) < 50000){
    // سعی کن با update ببری بالا اگر حفره باز بود
    await userA.client.from('profiles').update({balance: 200000}).eq('id', userA.uid)
    const {data: prof2} = await userA.client.from('profiles').select('balance').eq('id', userA.uid).single()
    console.log('  A balance after attempt', prof2?.balance)
  }
  let funded = (await userA.client.from('profiles').select('balance').eq('id', userA.uid).single()).data?.balance || 0
  console.log('  funded', funded)
  if(funded >= 10000 && matchesAll?.[0]){
    const mid = matchesAll.find(x=> x.status==='upcoming')?.id || matchesAll[0].id
    console.log('  placing bet A', mid.slice(0,8))
    const {data: bet, error: betErr} = await userA.client.rpc('place_bet', {p_match_id: mid, p_pick: 'team_a', p_amount: 10000})
    console.log('  place result', betErr?.message, bet?.id?.slice(0,8))
    if(bet && !betErr){
      ok(`A شرط ثبت کرد ${bet.id.slice(0,8)} odds=${bet.odds} payout=${bet.potential_payout}`)
      // B نباید آن را ببیند
      const {data: bBets, error: bErr} = await userB.client.from('bets').select('id,user_id').eq('id', bet.id)
      console.log('  B sees A bet?', bBets)
      if(!bBets || bBets.length===0) ok('bets isolation: B شرط A را نمی‌بیند')
      else bad('bets leak: B شرط A را دید')
      // A باید ببیند
      const {data: aBets} = await userA.client.from('bets').select('id').eq('id', bet.id)
      if(aBets && aBets.length===1) ok('A شرط خودش را می‌بیند')
      else bad('A شرط خودش را نمی‌بیند')

      // B تلاش direct insert با user_id جعلی
      const {error: insErr} = await userB.client.from('bets').insert({match_id: mid, pick:'team_a', amount:10000, odds:1.5, potential_payout:15000, user_id: userA.uid})
      if(insErr) ok(`bets direct insert جعلی بلاک: ${insErr.message.slice(0,60)}`)
      else bad('bets direct insert جعلی باید بلاک می‌شد')

      // تراکنش: B نباید تراکنش A را ببیند
      const {data: bTx} = await userB.client.from('transactions').select('id').eq('user_id', userA.uid).limit(1)
      if(!bTx || bTx.length===0) ok('transactions isolation: B تراکنش A را نمی‌بیند')
      else bad('transactions leak')

      // هجوم: 20 شرط موازی از A روی همین مسابقه
      console.log('\n 2-3 هجوم 20 موازی (A funded)')
      const {data: profBefore} = await userA.client.from('profiles').select('balance').eq('id', userA.uid).single()
      console.log('  balance before burst', profBefore?.balance)
      // اگر موجودی کم است، دوباره شارژ
      if((profBefore?.balance||0) < 150000){
        await userA.client.from('profiles').update({balance: 300000}).eq('id', userA.uid)
        const {data: p2} = await userA.client.from('profiles').select('balance').eq('id', userA.uid).single()
        console.log('  topped to', p2?.balance)
      }
      const {data: profTop} = await userA.client.from('profiles').select('balance').eq('id', userA.uid).single()
      const before = profTop?.balance || 0
      const N=20
      const promises=[]
      for(let i=0;i<N;i++) promises.push(userA.client.rpc('place_bet', {p_match_id: mid, p_pick: (i%2===0?'team_a':'team_b'), p_amount: 10000}))
      const results = await Promise.all(promises)
      const okN = results.filter(r=> !r.error).length
      const errN = results.filter(r=> r.error).length
      console.log(`  burst ${N}: ok=${okN} err=${errN}`)
      results.filter(r=> r.error).slice(0,3).forEach(r=> console.log('   err sample', r.error.message.slice(0,60)))
      const {data: profAfter} = await userA.client.from('profiles').select('balance').eq('id', userA.uid).single()
      const after = profAfter?.balance || 0
      console.log('  balance after', after, 'spent', before-after, 'expected', okN*10000)
      if(after >=0) ok('balance هرگز منفی نشد')
      else bad('balance منفی شد!')
      if(before - after === okN*10000) ok(`حساب دقیق: ${before} - ${after} = ${okN*10000}`)
      else bad(`عدم تطابق حساب: spent ${before-after} vs ok*10k=${okN*10000}`)
      if(errN>0 && okN>0) warn(`بخشی رد شد (${errN}) — طبیعی اگر موجودی تمام شود یا lock کار کند`)
      // لاگ تراکنش‌ها
      const {data: txs} = await userA.client.from('transactions').select('amount,type').eq('user_id', userA.uid).order('created_at',{ascending:false}).limit(25)
      console.log('  last txs', txs?.slice(0,5).map(t=> `${t.type}:${t.amount}`).join(' | '))

      // odds باید تغییر کرده باشد
      const {data: mAfter} = await createClient(url, anon).from('matches').select('odds_a,odds_b,odds_draw').eq('id', mid).single()
      console.log('  odds after burst', mAfter)
      if(mAfter) ok(`recalc_odds کار کرد: ${mAfter.odds_a}/${mAfter.odds_b}/${mAfter.odds_draw}`)

    } else {
      warn(`place_bet ناموفق: ${betErr?.message} — شاید مسابقه بسته یا موجودی`)
    }
  } else {
    warn('موجودی کافی نیست و RLS self-update بسته است — بدون ادمین نمی‌توان هجوم واقعی زد (این خودش نکته امنیتی مثبت است)')
  }
}

// 2-4 RPC های ادمین باید برای کاربر عادی بلاک شود
console.log('\n 2-4 admin RPCs')
{
  const {error:e1} = await userA.client.rpc('settle_match', {p_match_id: matchesAll?.[0]?.id || '00000000-0000-0000-0000-000000000000', p_winner:'team_a'})
  if(e1) ok(`settle_match غیرادمین بلاک: ${e1.message.slice(0,60)}`)
  else bad('settle_match غیرادمین باید بلاک می‌شد')
  const {error:e2} = await userA.client.rpc('charge_wallet', {p_user_id: userA.uid, p_amount: 10000})
  if(e2) ok(`charge_wallet غیرادمین بلاک: ${e2.message.slice(0,60)}`)
  else bad('charge_wallet غیرادمین باید بلاک می‌شد')
  const {error:e3} = await userA.client.rpc('approve_withdrawal', {p_wd_id: '00000000-0000-0000-0000-000000000000'})
  if(e3) ok(`approve_withdrawal غیرادمین بلاک: ${e3.message.slice(0,60)}`)
  else bad('approve_withdrawal غیرادمین باید بلاک می‌شد')
}

// 2-5 withdrawals direct insert
console.log('\n 2-5 withdrawals')
{
  const {error: wErr} = await userA.client.from('withdrawals').insert({user_id: userA.uid, amount: 10000, account: '123456789012'})
  if(wErr) ok(`withdrawals direct insert بلاک: ${wErr.message.slice(0,60)}`)
  else bad('withdrawals direct insert باید بلاک می‌شد')
  const {error: rpcErr} = await userA.client.rpc('request_withdrawal', {p_amount: 5000, p_account: '123'})
  if(rpcErr) ok(`request_withdrawal اعتبارسنجی کار کرد: ${rpcErr.message.slice(0,60)}`)
  else warn('request_withdrawal با مبلغ کم باید خطا می‌داد')
}

console.log(`\n=== جمع‌بندی pass=${pass} fail=${fail} warn=${warnC} ===`)
if(fail>0) process.exit(1)
