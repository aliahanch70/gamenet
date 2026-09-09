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
console.log('anon len',anon?.length,'prefix',anon?.slice(0,30))
const sb = createClient(url, anon, {auth:{persistSession:false, autoRefreshToken:false}})

let fail=0, pass=0
function ok(msg){ pass++; console.log(' ✅',msg)}
function bad(msg){ fail++; console.log(' ❌',msg)}
function warn(msg){ console.log(' ⚠️',msg)}

async function anonChecks(){
  console.log('\n[1] anon security')
  // matches public read
  const {data:ms, error:e1} = await sb.from('matches').select('id').limit(1)
  if(!e1) ok(`matches public read → ${ms?.length??0} rows`)
  else bad(`matches read: ${e1.message}`)

  // bets anon should be empty/filtered (RLS)
  const {data:bets, error:e2} = await sb.from('bets').select('id').limit(1)
  if(!e2){
    if(!bets || bets.length===0) ok('bets anon → 0 rows (RLS درست)')
    else bad(`bets anon leak: ${bets.length} rows`)
  } else {
    if(e2.code==='401' || e2.code==='42501') ok(`bets anon blocked ${e2.code}`)
    else warn(`bets anon err ${e2.message}`)
  }

  // direct insert should be blocked
  const {error:e3} = await sb.from('bets').insert({match_id:'00000000-0000-0000-0000-000000000000', pick:'team_a', amount:10000, odds:1.5, potential_payout:15000, user_id:'00000000-0000-0000-0000-000000000000'})
  if(e3) ok(`bets direct insert blocked: ${e3.message.slice(0,80)}`)
  else bad('bets direct insert باید بلاک می‌شد')

  // RPC anon
  const {error:e4} = await sb.rpc('place_bet',{p_match_id:'00000000-0000-0000-0000-000000000000', p_pick:'team_a', p_amount:10000})
  if(e4) ok(`place_bet anon blocked: ${e4.message.slice(0,80)}`)
  else bad('place_bet anon باید بلاک می‌شد')

  // site_settings public read
  const {data:ss} = await sb.from('site_settings').select('id,design').limit(1)
  if(ss && ss.length) ok(`site_settings public read → design=${ss[0].design}`)
  else warn('site_settings empty')

  // charge_wallet anon should fail
  const {error:e5} = await sb.rpc('charge_wallet',{p_user_id:'00000000-0000-0000-0000-000000000000', p_amount:10000})
  if(e5) ok(`charge_wallet anon blocked: ${e5.message.slice(0,80)}`)
  else bad('charge_wallet anon باید بلاک می‌شد')
}

async function authChecks(){
  console.log('\n[2] auth logic')
  const email=`test_${Date.now()}_${Math.random().toString(36).slice(2,6)}@test.local`
  const pass='Test123!@#123'
  console.log(' trying signup',email)
  let user=null, session=null
  const {data:su, error:se} = await sb.auth.signUp({email, password:pass, options:{data:{username:'test_'+Math.random().toString(36).slice(2,6)}}})
  if(se) {
    warn(`signup err: ${se.message}`)
  } else {
    user=su.user; session=su.session
    console.log(' signup user',user?.id,'session',!!session)
  }
  if(!session){
    // try signIn (maybe email confirmation disabled, or user exists)
    const {data:si, error:se2} = await sb.auth.signInWithPassword({email, password:pass})
    if(se2) warn(`signin err: ${se2.message} — بدون سشن، تست‌های auth اسکیپ می‌شود`)
    else { user=si.user; session=si.session; console.log(' signin session',!!session) }
  }
  if(!session || !user){
    warn('بدون سشن احراز هویت — تست‌های place_bet اسکیپ (در Supabase email confirmation را خاموش کن تا تست زنده کامل شود)')
    // try to continue with anon for validation of error messages
    // test invalid match id via anon already done, but test amount validation needs auth — skip
    return null
  }
  const authed = createClient(url, anon, {auth:{persistSession:false}, global:{headers:{Authorization:`Bearer ${session.access_token}`}}})
  // supabase-js needs to set auth via setSession
  const sbA = createClient(url, anon)
  await sbA.auth.setSession({access_token: session.access_token, refresh_token: session.refresh_token})
  console.log(' authed client ready', (await sbA.auth.getUser()).data.user?.id)

  // pick a match
  const {data:matches} = await sbA.from('matches').select('*').eq('status','upcoming').limit(1)
  let match = matches?.[0]
  if(!match){
    // try any match
    const {data:ms2} = await sbA.from('matches').select('*').limit(1)
    match=ms2?.[0]
  }
  console.log(' match', match? `${match.id.slice(0,8)} ${match.title} ${match.status}` : 'none')

  // insufficient balance
  const {error:eLow} = await sbA.rpc('place_bet',{p_match_id: match?.id || '00000000-0000-0000-0000-000000000000', p_pick:'team_a', p_amount: 500000})
  if(eLow){
    if(eLow.message.includes('موجودی کافی نیست')||eLow.message.includes('insufficient')) ok(`insufficient blocked: ${eLow.message.slice(0,60)}`)
    else warn(`insufficient other err: ${eLow.message}`)
  } else warn('insufficient باید خطا می‌داد (شاید موجودی زیاد است)')

  // invalid amount <10000
  if(match){
    const {error:eSmall}= await sbA.rpc('place_bet',{p_match_id: match.id, p_pick:'team_a', p_amount: 5000})
    if(eSmall) ok(`small amount blocked: ${eSmall.message.slice(0,60)}`)
    else bad('small amount باید بلاک می‌شد')

    // invalid step
    const {error:eStep}= await sbA.rpc('place_bet',{p_match_id: match.id, p_pick:'team_a', p_amount: 15000})
    // schema فقط <10000 چک می‌کند، گام 10k در فرانت است — در DB ممکن است رد نشود، ولی باید چک کنیم
    if(eStep) ok(`step blocked (DB): ${eStep.message.slice(0,60)}`)
    else warn('step 15000 در DB بلاک نشد — گام فقط فرانتی است (قابل قبول)')

    // invalid pick via bad enum? supabase will coerce
    // try match not found
    const {error:eNot}= await sbA.rpc('place_bet',{p_match_id:'00000000-0000-0000-0000-000000000000', p_pick:'team_a', p_amount:10000})
    if(eNot) ok(`not found blocked: ${eNot.message.slice(0,60)}`)
    else bad('not found باید خطا می‌داد')
  }

  // concurrency — 10 parallel with same user low balance (should not go negative)
  if(match && match.status==='upcoming'){
    console.log('\n [2b] concurrency 10 parallel (same user)')
    // check balance
    const {data:prof}= await sbA.from('profiles').select('balance').eq('id', user.id).single()
    console.log('  balance before', prof?.balance)
    const bal = prof?.balance ?? 0
    if(bal < 100000){
      warn(`balance ${bal} کم است — تست همزمانی با شارژ ادمین لازم است (بدون ادمین اسکیپ)`)
    } else {
      const promises=[]
      for(let i=0;i<10;i++) promises.push(sbA.rpc('place_bet',{p_match_id: match.id, p_pick:'team_a', p_amount:10000}))
      const results= await Promise.all(promises)
      const okCount= results.filter(r=>!r.error).length
      const errCount= results.filter(r=>r.error).length
      console.log(`  parallel 10: ok=${okCount} err=${errCount}`)
      // check balance after
      const {data:prof2}= await sbA.from('profiles').select('balance').eq('id', user.id).single()
      console.log('  balance after', prof2?.balance, 'delta', (prof?.balance??0)-(prof2?.balance??0))
      if((prof2?.balance??0) >=0) ok('balance never negative after parallel')
      else bad('balance negative!')
      // check no double spend beyond balance
      if(okCount*10000 <= (prof?.balance??0) + 5000) ok(`no overdraft: ${okCount*10000} <= ${prof?.balance}`)
      else bad(`overdraft: ${okCount*10000} > ${prof?.balance}`)
    }
  } else warn('no upcoming match — concurrency skip')

  // cleanup signout
  await sbA.auth.signOut()
  return {email}
}

async function main(){
  await anonChecks()
  await authChecks()
  console.log(`\n=== done pass=${pass} fail=${fail} ===`)
  if(fail>0) process.exit(1)
}
main().catch(e=>{ console.error(e); process.exit(1)})
