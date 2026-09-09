import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('C:/Users/ali/gamenet/.env','utf-8')
const m={}
for(const l of env.split('\n')){ const t=l.trim(); if(!t||t.startsWith('#')) continue; const i=t.indexOf('='); if(i>0) m[t.slice(0,i).trim()]=t.slice(i+1).trim()}
const url=m.VITE_SUPABASE_URL, anon=m.VITE_SUPABASE_ANON_KEY

let pass=0, fail=0
function ok(s){ pass++; console.log(' ✅',s)}
function bad(s){ fail++; console.log(' ❌',s)}
function warn(s){ console.log(' ⚠️',s)}

async function makeUser(prefix){
  const email=`${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,4)}@test.local`
  const sb0 = createClient(url, anon, {auth:{persistSession:false}})
  const {data} = await sb0.auth.signUp({email, password:'Test123!@#123', options:{data:{username: prefix}}})
  let session=data?.session
  if(!session){
    const {data:si}= await sb0.auth.signInWithPassword({email, password:'Test123!@#123'})
    session=si?.session
  }
  if(!session){ console.log(' no session',prefix); return null}
  const c = createClient(url, anon)
  await c.auth.setSession({access_token:session.access_token, refresh_token:session.refresh_token})
  const uid=(await c.auth.getUser()).data.user.id
  return {c, uid, email}
}

// Apply fix via service? we can't without service_role — apply via anon? Trigger needs admin.
// Instead we verify current state and also apply fix via direct SQL if we have service_role in env
// Try to apply fix_profiles_rls.sql via anon with RPC if available; otherwise warn and continue.
console.log('Applying fix_profiles_rls.sql ...')
const sql = fs.readFileSync('C:/Users/ali/gamenet/supabase/fix_profiles_rls.sql','utf-8')
// Try Supabase SQL via pg — not available without service_role. So we test current vulnerability and report.
console.log(' sql loaded', sql.length, 'chars')
console.log(' NOTE: fix must be run in Supabase SQL Editor (needs owner). Testing current DB state first.\n')

const checkUser = await makeUser('checkBal')
if(checkUser){
  const {data: before} = await checkUser.c.from('profiles').select('balance').eq('id', checkUser.uid).single()
  console.log(' checkUser balance before', before?.balance)
  const {error, data} = await checkUser.c.from('profiles').update({balance: 999999}).eq('id', checkUser.uid).select('balance')
  console.log(' update attempt err:', error?.message, 'data:', JSON.stringify(data)?.slice(0,200))
  const {data: after} = await checkUser.c.from('profiles').select('balance').eq('id', checkUser.uid).single()
  console.log(' balance after', after?.balance)
  if(after?.balance===999999){
    bad('حفره باز است — موجودی جعل شد (باید fix_profiles_rls.sql را در Dashboard اجرا کنی)')
    // revert
    await checkUser.c.from('profiles').update({balance: before?.balance||0}).eq('id', checkUser.uid)
  } else if(error){
    ok(`حفره بسته است: ${error.message.slice(0,80)}`)
  } else {
    warn(`update بی‌اثر ولی بدون خطا — after=${after?.balance}`)
  }
  await checkUser.c.auth.signOut()
} else warn('checkUser failed')

console.log(`\n=== check done pass=${pass} fail=${fail} ===`)
console.log(' برای بستن حفره: Dashboard → SQL Editor → Paste fix_profiles_rls.sql → Run')
if(fail>0) process.exit(1)
