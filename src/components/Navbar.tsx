import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import AdminBell from './AdminBell'

export default function Navbar(){
  const { userId, email, profile, isAdmin, signOut } = useAuth()
  const loc = useLocation()
  const nav = useNavigate()
  const [open,setOpen]=useState(false)
  const close=()=>setOpen(false)
  const isActive=(p:string)=> loc.pathname===p || loc.pathname.startsWith(p+'/')

  useEffect(()=>{
    document.body.style.overflow = open ? 'hidden' : ''
    return ()=>{ document.body.style.overflow='' }
  },[open])
  useEffect(()=>{ close() },[loc.pathname])

  return (
    <>
      <nav className="nav">
        <div className="nav-inner">
          <Link to="/" onClick={close} style={{display:'flex',alignItems:'center',gap:10,minWidth:0}}>
            <span className="logo-mark">◉</span>
            <span className="nav-logo">GAMEVERSE</span>
          </Link>

          <div className="nav-links">
            <Link className={'nav-link'+(isActive('/betting')?' active':'')} to="/betting">🎲 شرط‌بندی</Link>
            {userId && <Link className={'nav-link'+(isActive('/wallet')?' active':'')} to="/wallet">👛 کیف پول</Link>}
            {userId && profile && <span className="balance-chip">{profile.balance.toLocaleString('fa-IR')} ت</span>}
            {isAdmin && <Link className={'nav-link'+(isActive('/admin') && !isActive('/admin/withdrawals') && loc.pathname==='/admin' ?' active-accent':'')} to="/admin">🛡️ ادمین</Link>}
            {isAdmin && <Link className={'nav-link'+(isActive('/admin/withdrawals')?' active':'')} to="/admin/withdrawals" style={{gap:6}}>💸 برداشت‌ها <AdminBell/></Link>}
            {!userId ? <Link className="btn btn-primary btn-sm" to="/auth" style={{marginRight:4}}>ورود / ثبت‌نام</Link> : (
              <>
                <span style={{fontSize:12,color:'#94a3b8',maxWidth:110,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{profile?.username || email}</span>
                <button className="btn btn-ghost btn-sm" onClick={async()=>{ await signOut(); nav('/') }}>خروج</button>
              </>
            )}
          </div>

          <button className={'hamburger'+(open?' open':'')} aria-label="منو" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>
            <span className="hamburger-bars"><span/><span/><span/></span>
          </button>
        </div>
      </nav>

      <div className={'drawer'+(open?' open':'')} aria-hidden={!open}>
        <div className="drawer-backdrop" onClick={close} />
        <div className="drawer-panel">
          <div style={{display:'flex',alignItems:'center',gap:10,padding:'4px 2px 10px',borderBottom:'1px solid rgba(255,255,255,.06)',marginBottom:6}}>
            <span className="logo-mark" style={{width:30,height:30,fontSize:14,borderRadius:9}}>◉</span>
            <div style={{minWidth:0}}>
              <div style={{fontWeight:900,fontSize:14,color:'#f1f5f9'}}>GAMEVERSE</div>
              <div style={{fontSize:11,color:'#64748b'}}>گیم‌نت حرفه‌ای · تهران</div>
            </div>
          </div>

          <Link className={'nav-link'+(isActive('/betting')?' active':'')} to="/betting" onClick={close}>🎲 شرط‌بندی</Link>
          {userId && <Link className={'nav-link'+(isActive('/wallet')?' active':'')} to="/wallet" onClick={close}>👛 کیف پول {profile ? `· ${profile.balance.toLocaleString('fa-IR')} ت` : ''}</Link>}
          {isAdmin && <Link className={'nav-link'+(loc.pathname==='/admin'?' active-accent':'')} to="/admin" onClick={close}>🛡️ پنل ادمین</Link>}
          {isAdmin && <Link className={'nav-link'+(isActive('/admin/withdrawals')?' active':'')} to="/admin/withdrawals" onClick={close} style={{display:'flex',justifyContent:'space-between',alignItems:'center',width:'100%'}}><span>💸 برداشت‌ها</span><AdminBell/></Link>}

          <div style={{flex:1}} />
          <div style={{height:1,background:'rgba(255,255,255,.06)',margin:'8px 0'}} />
          {!userId ? <Link className="btn btn-primary" to="/auth" onClick={close}>ورود / ثبت‌نام</Link> : (
            <>
              <div style={{fontSize:12,color:'#94a3b8',padding:'6px 4px',textAlign:'center',wordBreak:'break-all'}}>{profile?.username || email}</div>
              <button className="btn btn-ghost" style={{width:'100%'}} onClick={async()=>{ await signOut(); close(); nav('/') }}>خروج از حساب</button>
            </>
          )}
          <div style={{fontSize:11,color:'#475569',textAlign:'center',marginTop:8}}>GAMEVERSE · ۲۰ سیستم · ۲۴/۷</div>
        </div>
      </div>
    </>
  )
}
