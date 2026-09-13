import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const NAV: { to:string; label:string; icon:string; end?:boolean }[] = [
  { to:'/admin', label:'داشبورد', icon:'📊', end:true },
  { to:'/admin/withdrawals', label:'برداشت‌ها', icon:'💸' },
  { to:'/admin/house', label:'سود خانه', icon:'🏦' },
  { to:'/admin/settings', label:'تنظیمات سایت', icon:'⚙️' },
  { to:'/admin/design', label:'طراحی سایت', icon:'🎨' },
]

export default function AdminLayout(){
  const { profile } = useAuth() as any
  const loc = useLocation()
  const [open,setOpen]=useState(false)
  const [pend,setPend]=useState<number| null>(null)
  useEffect(()=>{ setOpen(false) },[loc.pathname])
  useEffect(()=>{
    let alive=true
    supabase.from('withdrawals').select('*',{count:'exact',head:true}).eq('status','pending').then(r=>{
      if(alive) setPend(typeof r.count==='number'? r.count : null)
    })
    return ()=>{ alive=false }
  },[loc.pathname])
  return (
    <div className="admin-shell">
      <aside className={`admin-side ${open?'open':''}`}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:12}}>
          <div style={{fontWeight:900,fontSize:13,display:'flex',gap:8,alignItems:'center'}}>
            <span style={{width:28,height:28,borderRadius:8,display:'grid',placeItems:'center',background:'var(--accent)',color:'#052e16',fontSize:12}}>◆</span>
            پنل ادمین
          </div>
          <button className="btn btn-ghost btn-sm" onClick={()=>setOpen(false)} style={{display:'none'}}>✕</button>
        </div>
        <div style={{fontSize:11,color:'var(--muted)',marginBottom:10,lineHeight:1.6}}>
          {profile?.username || profile?.email || 'ادمین'}<br/>
          <span style={{fontSize:10,background:'rgba(34,197,94,.12)',border:'1px solid rgba(34,197,94,.22)',color:'var(--accent)',padding:'2px 6px',borderRadius:999}}>دسترسی ادمین</span>
        </div>
        <nav style={{display:'flex',flexDirection:'column',gap:4}}>
          {NAV.map(n=>{
            const isWith = n.to==='/admin/withdrawals'
            return (
              <NavLink key={n.to} to={n.to} end={n.end} className={({isActive})=> 'admin-side-link'+(isActive?' active':'')}>
                <span style={{fontSize:14}}>{n.icon}</span>
                <span style={{flex:1}}>{n.label}</span>
                {isWith && pend!==null && pend>0 && <span style={{fontSize:11,fontWeight:800,background:'var(--accent)',color:'#052e16',padding:'2px 7px',borderRadius:999}}>{pend.toLocaleString('fa-IR')}</span>}
              </NavLink>
            )
          })}
        </nav>
        <div style={{marginTop:14,paddingTop:12,borderTop:'1px solid var(--line)',display:'flex',flexDirection:'column',gap:6}}>
          <a href="/" className="admin-side-link">🏠 بازگشت به سایت</a>
          <a href="/betting" className="admin-side-link">🎮 پیش‌بینی‌ها</a>
        </div>
      </aside>
      <div className={`admin-side-backdrop ${open?'open':''}`} onClick={()=>setOpen(false)} />
      <div className="admin-main">
        <div className="admin-topbar">
          <button className="btn btn-ghost btn-sm" onClick={()=>setOpen(o=>!o)} aria-label="منو">☰ منو</button>
          <span style={{fontSize:12,color:'var(--muted)',fontWeight:700}}>{NAV.find(n=> loc.pathname===n.to || (n.to!=='/admin' && loc.pathname.startsWith(n.to)))?.label || 'داشبورد'}</span>
          <span style={{marginInlineStart:'auto',fontSize:11,color:'var(--muted)'}} className="hide-mobile">{loc.pathname}</span>
        </div>
        <Outlet/>
      </div>
    </div>
  )
}
