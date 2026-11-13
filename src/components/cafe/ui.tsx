import type { ReactNode } from 'react'

/** کارت آمار داشبورد */
export function Stat({ label, value, sub, color, bg, border }:{ label:string; value:string; sub?:string; color?:string; bg?:string; border?:string }){
  return (
    <div className="card" style={{padding:'12px 14px',background:bg,border:border}}>
      <div style={{fontSize:11,color:'var(--muted)'}}>{label}</div>
      <div style={{fontWeight:900,fontSize:'clamp(15px,4vw,19px)',marginTop:4,color:color||'var(--text)'}}>{value}</div>
      {sub && <div style={{fontSize:10,color:'var(--muted)',marginTop:2}}>{sub}</div>}
    </div>
  )
}

/** مودال مشترک */
export function Modal({ open, onClose, title, children, wide }:{ open:boolean; onClose:()=>void; title:string; children:ReactNode; wide?:boolean }){
  if(!open) return null
  return (
    <div style={{position:'fixed',inset:0,zIndex:60,display:'grid',placeItems:'center',padding:14,background:'rgba(3,6,18,.6)',backdropFilter:'blur(4px)'}} onClick={onClose}>
      <div className="card" style={{width:wide?680:430,maxWidth:'100%',maxHeight:'86vh',overflow:'auto',padding:16}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <h3 style={{fontWeight:900,fontSize:15}}>{title}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** فیلد فرم */
export function Field({ label, children }:{ label:string; children:ReactNode }){
  return (
    <label style={{display:'block',marginBottom:10}}>
      <div style={{fontSize:11,color:'var(--muted)',marginBottom:4}}>{label}</div>
      {children}
    </label>
  )
}

/** پیام موفقیت/خطا */
export function Msg({ text, tone }:{ text:string; tone?:'ok'|'err' }){
  const ok = tone !== 'err'
  return (
    <div style={{marginTop:10,padding:'10px 12px',borderRadius:12,fontSize:13,background: ok?'rgba(34,197,94,.12)':'rgba(255,60,90,.12)',border:`1px solid ${ok?'rgba(34,197,94,.3)':'rgba(255,60,90,.3)'}`}}>
      {text}
    </div>
  )
}

/** حالت خالی */
export function Empty({ text }:{ text:string }){
  return <div className="card" style={{padding:'18px 14px',textAlign:'center',color:'var(--muted)',fontSize:13}}>{text}</div>
}
