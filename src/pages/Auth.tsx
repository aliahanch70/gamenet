import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Auth(){
  const [mode,setMode]=useState<'login'|'signup'>('login')
  const [email,setEmail]=useState('')
  const [pass,setPass]=useState('')
  const [username,setUsername]=useState('')
  const [err,setErr]=useState<string|null>(null)
  const [loading,setLoading]=useState(false)
  const [uStatus,setUStatus]=useState<'idle'|'checking'|'ok'|'taken'>('idle')
  const timer = useRef<number|null>(null)
  const nav = useNavigate()

  // live username check (signup only) — ponytail: 450ms debounce = rate-limit; is_username_available is cheap stable RPC, real guard is DB unique constraint
  useEffect(()=>{
    if(mode!=='signup' || !username.trim()){ setUStatus('idle'); return }
    setUStatus('checking')
    if(timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(async()=>{
      const name = username.trim()
      const { data, error } = await supabase.rpc('is_username_available',{ p_username: name })
      if(error){
        // fallback: direct select (if RPC not yet migrated)
        const { data: row } = await supabase.from('profiles').select('id').eq('username',name).maybeSingle()
        setUStatus(row ? 'taken' : 'ok')
      } else {
        setUStatus(data ? 'ok' : 'taken')
      }
    }, 450) as unknown as number
    return ()=>{ if(timer.current) window.clearTimeout(timer.current) }
  },[username, mode])

  // friendly mapping for Postgres / PostgREST / RPC errors (all RPC messages are Persian except a few English DB errors)
  const friendly = (raw:string)=>{
    const m = raw.toLowerCase()
    if(m.includes('موجودی کافی نیست') || m.includes('insufficient')) return 'موجودی کافی نیست — لطفاً کیف پول را شارژ کنید.'
    if(m.includes('حداقل مبلغ')) return raw // keep original Persian (already friendly)
    if(m.includes('شماره کارت') || m.includes('char_length')) return 'شماره کارت حداقل ۶ کاراکتر باشد.'
    if(m.includes('زمان شرط')) return 'زمان شرط‌بندی تمام شده است.'
    if(m.includes('مسابقه قابل شرط') || m.includes('match not open')) return 'این مسابقه بسته است — شرط جدید پذیرفته نمی‌شود.'
    if(m.includes('مسابقه یافت نشد')) return 'مسابقه یافت نشد.'
    if(m.includes('دسترسی غیرمجاز') || m.includes('not authenticated') || m.includes('unauthorized')) return 'دسترسی غیرمجاز — وارد حساب شوید.'
    if(m.includes('duplicate key') || m.includes('unique') || m.includes('username')) return 'این نام کاربری قبلاً گرفته شده — یکی دیگر انتخاب کنید.'
    if(m.includes('database error saving new user')) return 'این نام کاربری قبلاً گرفته شده — یکی دیگر انتخاب کنید.'
    if(m.includes('already registered') || m.includes('already exists')) return 'این ایمیل قبلاً ثبت شده — وارد شوید.'
    if(m.includes('invalid login') || m.includes('invalid credentials')) return 'ایمیل یا رمز عبور نادرست است.'
    return raw
  }

  const submit = async(e:React.FormEvent)=>{
    e.preventDefault(); setErr(null)

    const uname = username.trim()
    if(mode==='signup'){
      if(uStatus==='taken'){ setErr('این نام کاربری قبلاً گرفته شده — یکی دیگر انتخاب کنید.'); return }
      // pre-check before hitting auth (fast, local)
      if(uname){
        const { data: ok } = await supabase.rpc('is_username_available',{ p_username: uname })
        if(ok===false){ setErr('این نام کاربری قبلاً گرفته شده — یکی دیگر انتخاب کنید.'); setUStatus('taken'); return }
      }
    }

    setLoading(true)
    try{
      if(mode==='signup'){
        const { error } = await supabase.auth.signUp({
          email, password: pass,
          options:{ data:{ username: uname || email.split('@')[0], display_name: uname || email.split('@')[0] } }
        })
        if(error) throw error
        alert('ثبت‌نام موفق — اکنون وارد شوید. (اگر تایید ایمیل فعال است، ایمیل را چک کنید)')
        setMode('login')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pass })
        if(error) throw error
        nav('/betting')
      }
    } catch(e:any){ setErr(friendly(e.message || 'خطا')) }
    finally{ setLoading(false) }
  }

  const uBorder = uStatus==='taken' ? 'rgba(255,60,90,.6)' : uStatus==='ok' ? 'rgba(0,229,160,.5)' : undefined
  const uHint = uStatus==='taken' ? '❌ این نام کاربری قبلاً گرفته شده' : uStatus==='ok' ? '✅ آزاد است' : uStatus==='checking' ? 'در حال بررسی…' : null

  return (
    <div className="container" style={{maxWidth:440,padding:'32px 14px'}}>
      <div className="card" style={{padding:20}}>
        <h2 style={{fontWeight:900,marginBottom:4,fontSize:22}}>{mode==='login' ? 'ورود' : 'ثبت‌نام'}</h2>
        <p style={{color:'var(--muted)',fontSize:13,marginBottom:16,lineHeight:1.7}}>
          پیش‌بینی فقط برای کاربران واردشده فعال است.
          {mode==='login' ? <button onClick={()=>setMode('signup')} style={{background:'none',border:0,color:'var(--accent)',cursor:'pointer',fontWeight:700}}> ثبت‌نام کنید</button>
          : <button onClick={()=>setMode('login')} style={{background:'none',border:0,color:'var(--accent)',cursor:'pointer',fontWeight:700}}> وارد شوید</button>}
        </p>
        <form onSubmit={submit} style={{display:'grid',gap:12}}>
          {mode==='signup' && (
            <div style={{display:'grid',gap:6}}>
              <input className="input" placeholder="نام کاربری (اختیاری)" value={username} onChange={e=>{ setUsername(e.target.value); setErr(null) }} style={uBorder?{borderColor:uBorder}:undefined} aria-invalid={uStatus==='taken'} />
              {uHint && <span style={{fontSize:11,color: uStatus==='taken'?'#ff6b7a': uStatus==='ok'?'var(--accent)':'var(--muted)'}}>{uHint}</span>}
            </div>
          )}
          <input className="input" placeholder="ایمیل" type="email" value={email} onChange={e=>setEmail(e.target.value)} required dir="ltr" inputMode="email" autoComplete="email"/>
          <input className="input" placeholder="رمز عبور (حداقل ۶ کاراکتر)" type="password" value={pass} onChange={e=>setPass(e.target.value)} required dir="ltr" autoComplete={mode==='login'?'current-password':'new-password'}/>
          {err && <div style={{background:'rgba(255,60,90,.12)',border:'1px solid rgba(255,60,90,.3)',padding:'10px 12px',borderRadius:10,fontSize:13,color:'#ff8fa0',wordBreak:'break-word'}}>{err}</div>}
          <button className="btn btn-primary" style={{minHeight:44}} disabled={loading || (mode==='signup' && uStatus==='taken')}>{loading ? '…' : (mode==='login' ? 'ورود' : 'ثبت‌نام')}</button>
        </form>
        <p style={{textAlign:'center',color:'var(--muted)',fontSize:11,marginTop:10}}>فراموشی رمز؟ به مدیر پیام دهید تا رمز شما را بازنشانی کند.</p>
        <div style={{marginTop:8,textAlign:'center'}}><Link to="/" style={{fontSize:13,color:'var(--muted)'}}>← بازگشت به خانه</Link></div>
      </div>
    </div>
  )
}
