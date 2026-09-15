import { useEffect, useState } from 'react'
import { supabase, type Withdrawal } from '../lib/supabase'

type Row = Withdrawal & { profiles?: { username:string|null; display_name:string|null; email:string|null } }

export default function AdminWithdrawals(){
  const [rows,setRows]=useState<Row[]>([])
  const [counts,setCounts]=useState({pending:0,approved:0,rejected:0,all:0})
  const [filter,setFilter]=useState<'pending'|'approved'|'rejected'|'all'>('pending')
  const [msg,setMsg]=useState<string|null>(null)
  const [busy,setBusy]=useState<string|null>(null)
  const [q,setQ]=useState('')

  const load = async()=>{
    const p = supabase.from('withdrawals').select('*',{count:'exact',head:true}).eq('status','pending').then(r=>r.count||0)
    const a = supabase.from('withdrawals').select('*',{count:'exact',head:true}).eq('status','approved').then(r=>r.count||0)
    const rj = supabase.from('withdrawals').select('*',{count:'exact',head:true}).eq('status','rejected').then(r=>r.count||0)
    const [cP,cA,cR] = await Promise.all([p,a,rj])
    setCounts({pending:cP, approved:cA, rejected:cR, all: cP+cA+cR})
    let qb = supabase.from('withdrawals').select('*, profiles(username,display_name,email)').order('created_at',{ascending:false}).limit(100)
    if(filter!=='all') qb = qb.eq('status', filter)
    const { data } = await qb
    setRows((data as Row[])||[])
  }
  // ponytail: realtime push for pending withdrawals; fallback poll 15s if channel fails
  const [liveToast,setLiveToast]=useState<string|null>(null)
  useEffect(()=>{ load() },[filter])
  useEffect(()=>{
    let ch:any=null
    let alive=true
    const onChange = (payload:any)=>{
      const ev = payload?.eventType
      const row = payload?.new
      // ponytail: any insert/update/delete triggers reload; INSERT pending shows toast
      if(ev==='INSERT' && row?.status==='pending'){
        setLiveToast('درخواست برداشت جدید: '+Number(row.amount||0).toLocaleString('fa-IR')+' ت')
        setTimeout(()=> alive && setLiveToast(null), 4000)
      }
      load()
    }
    try{ ch = (supabase as any).channel('wd-admin-live').on('postgres_changes',{event:'*',schema:'public',table:'withdrawals'}, onChange).subscribe() }catch{}
    const iv = setInterval(()=>{ if(alive) load() }, 15000)
    const onVis = ()=>{ if(document.visibilityState==='visible' && alive) load() }
    document.addEventListener('visibilitychange', onVis)
    return ()=>{ alive=false; clearInterval(iv); document.removeEventListener('visibilitychange', onVis); try{ if(ch) (supabase as any).removeChannel(ch) }catch{} }
  },[filter])

  const approve = async(id:string)=>{
    if(!confirm('تایید برداشت — واریز انجام شد؟')) return
    setBusy(id)
    const { error } = await supabase.rpc('approve_withdrawal',{ p_withdrawal_id: id })
    if(error) setMsg(error.message); else { setMsg('✅ تایید شد'); await load() }
    setBusy(null)
  }
  const reject = async(id:string)=>{
    const reason = prompt('دلیل رد (اختیاری):') || ''
    setBusy(id)
    const { error } = await supabase.rpc('reject_withdrawal',{ p_withdrawal_id:id, p_reason: reason })
    if(error) setMsg(error.message); else { setMsg('↩️ رد شد — مبلغ برگشت خورد'); await load() }
    setBusy(null)
  }

  const tab = (k:'pending'|'approved'|'rejected'|'all', label:string)=>{
    const n = k==='pending'?counts.pending : k==='approved'?counts.approved : k==='rejected'?counts.rejected : counts.all
    const active = filter===k
    return (
      <button key={k} className={active?'btn btn-primary btn-sm':'btn btn-ghost btn-sm'} onClick={()=>setFilter(k)} style={{gap:6}}>
        {label} {n>0 && <span style={{background: active?'rgba(255,255,255,.22)':'rgba(255,255,255,.10)',padding:'1px 6px',borderRadius:999,fontSize:11,lineHeight:1.4}}>{n}</span>}
      </button>
    )
  }

  return (
    <div className="container" style={{padding:'20px 14px 28px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        <h2 style={{fontWeight:900,fontSize:22}}>درخواست‌های برداشت</h2>
        <input className="input" placeholder="جستجو یوزرنیم / ایمیل…" value={q} onChange={e=>setQ(e.target.value)} style={{maxWidth:220, padding:'7px 12px', fontSize:12, borderRadius:999}} />
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          {tab('pending','در انتظار')}
          {tab('approved','تاییدشده')}
          {tab('rejected','ردشده')}
          {tab('all','همه')}
        </div>
      </div>
      {liveToast && <div style={{marginTop:10,padding:'10px 12px',borderRadius:12,fontSize:13,background:'linear-gradient(135deg, #6d5efc, #b06bff)',color:'#fff',fontWeight:800,textAlign:'center'}}>{liveToast}</div>}
      {msg && <div style={{marginTop:10,padding:'10px 12px',borderRadius:12,fontSize:13,background:'rgba(0,229,160,.12)',border:'1px solid rgba(0,229,160,.3)'}}>{msg}</div>}

      {(() => { const qq=q.trim().toLowerCase(); const fl=qq?rows.filter(r=>{const u=(r.profiles?.username||'').toLowerCase(); const e=(r.profiles?.email||'').toLowerCase(); const d=(r.profiles?.display_name||'').toLowerCase(); return u.includes(qq)||e.includes(qq)||d.includes(qq)}):rows; if(fl.length===0) return <div className="card" style={{marginTop:14,padding:'18px 14px',textAlign:'center',color:'var(--muted)',fontSize:13}}>{rows.length===0?'موردی نیست.':'نتیجه‌ای یافت نشد'}</div>; return (
        <div style={{display:'grid',gap:10,marginTop:14}}>
          {fl.map(r=>{
            const st = r.status==='pending' ? {label:'در انتظار',color:'#ffb84d'} : r.status==='approved' ? {label:'تایید شد',color:'var(--accent)'} : {label:'رد شد',color:'#ff6b7a'}
            return (
              <div key={r.id} className="card" style={{padding:14,display:'flex',flexDirection:'column',gap:10}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10,flexWrap:'wrap'}}>
                  <div style={{minWidth:0,flex:1}}><div style={{fontWeight:800,fontSize:14}}>{Number(r.amount).toLocaleString('fa-IR')} ت</div><div style={{fontSize:12,color:'var(--muted)',marginTop:2}}>کاربر: <b style={{color:'#fff'}}>{r.profiles?.username || r.user_id.slice(0,8)}</b>{r.profiles?.email ? <span style={{fontWeight:400,color:'var(--muted)',fontSize:11}}> · {r.profiles.email}</span> : null}</div><div style={{marginTop:6,background:'rgba(255,255,255,.07)',border:'1px solid var(--line)',borderRadius:10,padding:'10px 12px',display:'flex',justifyContent:'space-between',alignItems:'center',gap:10}}><div style={{minWidth:0}}><div style={{fontSize:10,color:'var(--muted)'}}>شماره کارت/شبا</div><div dir="ltr" style={{fontWeight:900,fontSize:'clamp(16px,4.5vw,20px)',letterSpacing:'.06em',wordBreak:'break-all',marginTop:2}}>{r.account}</div></div><button className="btn btn-ghost btn-sm" style={{flexShrink:0}} onClick={async()=>{ await navigator.clipboard.writeText(r.account); setMsg('کپی شد: '+r.account) }}>کپی</button></div><div style={{fontSize:11,color:'var(--muted)',marginTop:6}}>{new Date(r.created_at).toLocaleString('fa-IR')}</div>{r.note && <div style={{fontSize:11,color:'var(--muted)',marginTop:4}}>یادداشت: {r.note}</div>}</div>
                  <span className="badge" style={{fontSize:11,color: st.color, borderColor:'var(--line)',flexShrink:0}}>{st.label}</span>
                </div>
                {r.status==='pending' && (
                  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                    <button className="btn btn-primary btn-sm" style={{flex:'1 1 120px',minHeight:36}} disabled={busy===r.id} onClick={()=>approve(r.id)}>{busy===r.id?'…':'تایید — واریز شد'}</button>
                    <button className="btn btn-ghost btn-sm" style={{flex:'1 1 120px',minHeight:36,color:'#ff6b7a',borderColor:'rgba(255,90,110,.3)'}} disabled={busy===r.id} onClick={()=>reject(r.id)}>رد — برگشت وجه</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        )})()}
    </div>
  )
}
