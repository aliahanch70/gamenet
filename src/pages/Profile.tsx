import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function ProfilePage(){
  const nav = useNavigate()
  const { profile, email, refresh, signOut } = useAuth() as any
  const [displayName,setDisplayName]=useState('')
  const [username,setUsername]=useState('')
  const [phone,setPhone]=useState('')
  const [newPass,setNewPass]=useState('')
  const [confirmPass,setConfirmPass]=useState('')
  const [msg,setMsg]=useState<string|null>(null)
  const [uStatus,setUStatus]=useState<'idle'|'checking'|'ok'|'taken'>('idle')
  const [busy,setBusy]=useState(false)
  const [confirmLogout,setConfirmLogout]=useState(false)

  useEffect(()=>{
    if(profile){
      setDisplayName(profile.display_name || '')
      setUsername(profile.username || '')
      setPhone(profile.phone || '')
    }
  },[profile])

  // live username check (if changed)
  useEffect(()=>{
    const name = username.trim()
    if(!name || name===profile?.username){ setUStatus('idle'); return }
    setUStatus('checking')
    const t = window.setTimeout(async()=>{
      const { data, error } = await supabase.rpc('is_username_available',{ p_username: name } as any)
      if(error){
        const { data: row } = await supabase.from('profiles').select('id').eq('username',name).maybeSingle()
        setUStatus(row ? 'taken' : 'ok')
      } else setUStatus(data ? 'ok' : 'taken')
    },450)
    return ()=> window.clearTimeout(t)
  },[username, profile?.username])

  const saveProfile = async(e:React.FormEvent)=>{
    e.preventDefault(); setMsg(null)
    if(uStatus==='taken'){ setMsg('این نام کاربری قبلاً گرفته شده'); return }
    const ph = phone.trim()
    if(ph && !/^[0-9 +()-]{7,20}$/.test(ph)){ setMsg('شماره موبایل معتبر نیست'); return }
    const dn = displayName.trim()
    const un = username.trim()
    if(un && un.length<3){ setMsg('نام کاربری حداقل ۳ کاراکتر'); return }
    if(un && !/^[a-zA-Z0-9._-]+$/.test(un)){ setMsg('نام کاربری فقط حروف/عدد/._-'); return }
    setBusy(true)
    const payload:any = {}
    if(dn !== (profile?.display_name||'')) payload.display_name = dn || null
    if(un !== (profile?.username||'')) payload.username = un || null
    // phone even if empty -> null
    const curPhone = profile?.phone || ''
    if(ph !== curPhone) payload.phone = ph || null
    if(Object.keys(payload).length===0){ setMsg('تغییری اعمال نشد'); setBusy(false); return }
    const { error } = await supabase.from('profiles').update(payload).eq('id', profile.id)
    if(error) setMsg(error.message.includes('duplicate') || error.message.includes('unique') ? 'این نام کاربری قبلاً گرفته شده' : error.message)
    else { setMsg('✅ پروفایل ذخیره شد'); await refresh() }
    setBusy(false)
  }

  const changePass = async(e:React.FormEvent)=>{
    e.preventDefault(); setMsg(null)
    if(newPass.length<6){ setMsg('رمز جدید حداقل ۶ کاراکتر'); return }
    if(newPass!==confirmPass){ setMsg('تکرار رمز همخوانی ندارد'); return }
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: newPass })
    if(error) setMsg(error.message)
    else { setMsg('✅ رمز عبور تغییر کرد'); setNewPass(''); setConfirmPass('') }
    setBusy(false)
  }

  const askLogout = () => setConfirmLogout(true)
  const doLogout = async () => {
    setConfirmLogout(false)
    await signOut()
    nav('/')
    // redirect handled by AuthContext/router
  }

  const uBorder = uStatus==='taken' ? 'rgba(255,60,90,.6)' : uStatus==='ok' ? 'rgba(0,229,160,.5)' : undefined
  const uHint = uStatus==='taken' ? '❌ گرفته شده' : uStatus==='ok' ? '✅ آزاد است' : uStatus==='checking' ? 'در حال بررسی…' : null

  return (
    <div className="container" style={{maxWidth:560, padding:'24px 14px 28px'}}>
      <h2 style={{fontWeight:900,fontSize:22}}>حساب کاربری</h2>
      <p style={{color:'var(--muted)',fontSize:12,marginTop:4}}>نام و موبایل اختیاری — هر زمان قابل تغییر.</p>
      {email && <div style={{marginTop:10,padding:'10px 12px',borderRadius:12,background:'var(--surface)',border:'1px solid var(--line)',fontSize:12}}>ایمیل: <b dir="ltr">{email}</b></div>}
      {msg && <div style={{marginTop:10,padding:'10px 12px',borderRadius:12,fontSize:13,wordBreak:'break-word',background: msg.startsWith('✅')?'rgba(0,229,160,.12)':'rgba(255,60,90,.12)',border:`1px solid ${msg.startsWith('✅')?'rgba(0,229,160,.3)':'rgba(255,60,90,.3)'}`}}>{msg}</div>}

      <form onSubmit={saveProfile} className="card" style={{marginTop:14,padding:16,display:'grid',gap:10}}>
        <h3 style={{fontWeight:800,fontSize:14}}>پروفایل</h3>
        <label style={{display:'grid',gap:6}}>
          <span style={{fontSize:11,color:'var(--muted)',fontWeight:700}}>نام نمایشی (اختیاری)</span>
          <input className="input" placeholder="مثلاً علی حسینی" value={displayName} onChange={e=>setDisplayName(e.target.value)} />
        </label>
        <label style={{display:'grid',gap:6}}>
          <span style={{fontSize:11,color:'var(--muted)',fontWeight:700}}>نام کاربری</span>
          <input className="input" placeholder="username" value={username} onChange={e=>setUsername(e.target.value)} dir="ltr" style={uBorder?{borderColor:uBorder}:undefined} />
          {uHint && <span style={{fontSize:11,color: uStatus==='taken'?'#ff6b7a': uStatus==='ok'?'var(--accent)':'var(--muted)'}}>{uHint}</span>}
        </label>
        <label style={{display:'grid',gap:6}}>
          <span style={{fontSize:11,color:'var(--muted)',fontWeight:700}}>شماره موبایل (اختیاری)</span>
          <input className="input" placeholder="0912 345 6789" value={phone} onChange={e=>setPhone(e.target.value)} dir="ltr" inputMode="tel" autoComplete="tel" />
        </label>
        <button className="btn btn-primary" disabled={busy || uStatus==='taken'} style={{minHeight:42}}>ذخیره پروفایل</button>
      </form>

      <form onSubmit={changePass} className="card" style={{marginTop:14,padding:16,display:'grid',gap:10}}>
        <h3 style={{fontWeight:800,fontSize:14}}>تغییر رمز عبور</h3>
        <input className="input" type="password" placeholder="رمز جدید (≥۶)" value={newPass} onChange={e=>setNewPass(e.target.value)} dir="ltr" autoComplete="new-password" />
        <input className="input" type="password" placeholder="تکرار رمز جدید" value={confirmPass} onChange={e=>setConfirmPass(e.target.value)} dir="ltr" autoComplete="new-password" />
        <button className="btn btn-ghost" disabled={busy} style={{minHeight:42}}>تغییر رمز</button>
      </form>

      <div className="card" style={{marginTop:14,padding:16,display:'grid',gap:10}}>
        <h3 style={{fontWeight:800,fontSize:14}}>امنیت</h3>
        <button onClick={askLogout} className="btn btn-ghost" style={{minHeight:42,justifyContent:'center'}}>
          خروج از حساب ↪
        </button>
      </div>

      {confirmLogout && (
        <div className="modal-overlay" onClick={()=>setConfirmLogout(false)} style={{position:'fixed',inset:0,zIndex:210,background:'rgba(5,8,18,.72)',backdropFilter:'blur(8px)',WebkitBackdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div className="modal-card" onClick={e=>e.stopPropagation()} style={{width:'min(380px,90vw)',maxHeight:'none',overflow:'visible',background:'var(--surface)',border:'1px solid var(--line)',borderRadius:20,padding:22,boxShadow:'0 24px 60px rgba(0,0,0,.65)',textAlign:'center'}}>
            <div style={{width:52,height:52,borderRadius:14,display:'grid',placeItems:'center',margin:'0 auto 14px',background:'rgba(244,63,94,.12)',border:'1px solid rgba(244,63,94,.25)',fontSize:22}}>↪</div>
            <h3 style={{fontWeight:900,fontSize:16,margin:0}}>خروج از حساب</h3>
            <p style={{color:'var(--muted)',fontSize:13,marginTop:6,marginBottom:18,lineHeight:1.7}}>آیا مطمئنید که می‌خواهید از حساب خارج شوید؟</p>
            <div style={{display:'flex',gap:10,justifyContent:'center'}}>
              <button onClick={()=>setConfirmLogout(false)} className="btn btn-ghost btn-sm" style={{borderRadius:999,padding:'10px 20px',fontWeight:800}}>لغو</button>
              <button onClick={doLogout} className="btn btn-primary btn-sm" style={{borderRadius:999,padding:'10px 20px',fontWeight:800,background:'#f43f5e',borderColor:'#f43f5e'}}>بله، خارج شوم</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
