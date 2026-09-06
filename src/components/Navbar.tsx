import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import AdminBell from './AdminBell'

export default function Navbar(){
  const { userId, email, profile, isAdmin, signOut } = useAuth()
  const nav = useNavigate()
  const [open,setOpen]=useState(false)
  const close=()=>setOpen(false)
  return (
    <>
      <nav className="nav">
        <div className="container nav-inner">
          <Link to="/" onClick={close} style={{display:'flex',alignItems:'center',gap:10,fontWeight:900,letterSpacing:.5}}>
            <span style={{width:32,height:32,borderRadius:9,background:'linear-gradient(135deg,var(--accent),var(--accent2))',display:'grid',placeItems:'center',color:'#06131a',flexShrink:0}}>◉</span>
            GAMEVERSE
          </Link>
          <div className="nav-links">
            <Link className="btn btn-ghost btn-sm" to="/betting">شرط‌بندی</Link>
            {userId && <Link className="btn btn-ghost btn-sm" to="/wallet">کیف پول {profile ? `· ${profile.balance.toLocaleString('fa-IR')} ت` : ''}</Link>}
            {isAdmin && <Link className="btn btn-ghost btn-sm" to="/admin">پنل ادمین</Link>}
            {isAdmin && <Link className="btn btn-ghost btn-sm" to="/admin/withdrawals" style={{gap:6}}>برداشت‌ها <AdminBell/></Link>}
            {!userId ? <Link className="btn btn-primary btn-sm" to="/auth">ورود / ثبت‌نام</Link> : (
              <>
                <span style={{fontSize:12,color:'var(--muted)',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{profile?.username || email}</span>
                <button className="btn btn-ghost btn-sm" onClick={async()=>{ await signOut(); nav('/') }}>خروج</button>
              </>
            )}
          </div>
          <button className="hamburger" aria-label="منو" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>
            <span style={{fontSize:18,lineHeight:1}}>{open?'✕':'☰'}</span>
          </button>
        </div>
      </nav>
      <div className={'drawer'+(open?' open':'')} aria-hidden={!open}>
        <div className="drawer-backdrop" onClick={close} />
        <div className="drawer-panel">
          <Link className="btn btn-ghost" to="/betting" onClick={close}>🎲 شرط‌بندی</Link>
          {userId && <Link className="btn btn-ghost" to="/wallet" onClick={close}>👛 کیف پول {profile ? `· ${profile.balance.toLocaleString('fa-IR')} ت` : ''}</Link>}
          {isAdmin && <Link className="btn btn-ghost" to="/admin" onClick={close}>🛡️ پنل ادمین</Link>}
          {isAdmin && <Link className="btn btn-ghost" to="/admin/withdrawals" onClick={close} style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>💸 برداشت‌ها <AdminBell/></Link>}
          <div style={{height:1,background:'var(--line)',margin:'4px 0'}} />
          {!userId ? <Link className="btn btn-primary" to="/auth" onClick={close}>ورود / ثبت‌نام</Link> : (
            <>
              <div style={{fontSize:12,color:'var(--muted)',padding:'6px 2px'}}>{profile?.username || email}</div>
              <button className="btn btn-ghost" onClick={async()=>{ await signOut(); close(); nav('/') }}>خروج</button>
            </>
          )}
          <div style={{flex:1}} />
          <div style={{fontSize:11,color:'var(--muted)',textAlign:'center'}}>GAMEVERSE · گیم‌نت حرفه‌ای</div>
        </div>
      </div>
    </>
  )
}
