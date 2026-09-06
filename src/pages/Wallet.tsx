import { useEffect, useState } from 'react'
import { supabase, type Withdrawal } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

type Tx = { id:string; amount:number; type:string; note:string|null; created_at:string }

export default function Wallet(){
  const { profile, refresh, userId } = useAuth() as any
  const [txs,setTxs]=useState<Tx[]>([])
  const [wds,setWds]=useState<Withdrawal[]>([])
  const [wdAmount,setWdAmount]=useState('')
  const [wdAccount,setWdAccount]=useState('')
  const [wdBusy,setWdBusy]=useState(false)
  const [msg,setMsg]=useState<string|null>(null)

  const load = async()=>{
    if(!userId) return
    const { data: t } = await supabase.from('transactions').select('*').eq('user_id', userId).order('created_at',{ascending:false}).limit(50)
    setTxs((t as Tx[])||[])
    const { data: w } = await supabase.from('withdrawals').select('*').eq('user_id', userId).order('created_at',{ascending:false}).limit(20)
    setWds((w as Withdrawal[])||[])
  }
  useEffect(()=>{ if(userId) load() },[userId])

  const submitWd = async(e:React.FormEvent)=>{
    e.preventDefault(); setMsg(null)
    const amt = Number(String(wdAmount).replace(/[^0-9]/g,''))
    if(!amt || amt<10000){ setMsg('حداقل برداشت ۱۰٬۰۰۰ تومان'); return }
    if(!wdAccount.trim() || wdAccount.trim().length<6){ setMsg('شماره کارت/حساب را کامل وارد کنید'); return }
    setWdBusy(true)
    const { error } = await supabase.rpc('request_withdrawal',{ p_amount: amt, p_account: wdAccount.trim() })
    if(error) setMsg(error.message)
    else { setMsg('✅ درخواست ثبت شد — پس از تایید ادمین واریز می‌شود'); setWdAmount(''); setWdAccount(''); await load(); await refresh() }
    setWdBusy(false)
  }

  return (
    <div className="container" style={{maxWidth:760,padding:'20px 14px 28px'}}>
      <h2 style={{fontWeight:900,fontSize:22}}>کیف پول</h2>
      <div className="card" style={{padding:18,marginTop:14,background:'linear-gradient(135deg,#0f2a22,#162040)'}}>
        <div style={{color:'var(--muted)',fontSize:12}}>موجودی فعلی</div>
        <div style={{fontSize:'clamp(28px, 7vw, 36px)',fontWeight:900,marginTop:4,wordBreak:'break-all'}}>{profile ? profile.balance.toLocaleString('fa-IR') : '—'} <span style={{fontSize:14,fontWeight:600}}>تومان</span></div>
        <div style={{marginTop:12,display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
          <button className="btn btn-ghost btn-sm" onClick={async()=>{ await refresh(); await load() }}>بروزرسانی</button>
          <span style={{fontSize:12,color:'var(--muted)'}}>شارژ توسط پشتیبانی انجام می‌شود.</span>
        </div>
      </div>

      <div className="card" style={{padding:14,marginTop:14}}>
        <h3 style={{fontWeight:800,fontSize:15}}>درخواست برداشت</h3>
        <p style={{fontSize:11,color:'var(--muted)',marginTop:4}}>مبلغ از کیف پول کسر و پس از تایید ادمین واریز می‌شود. در صورت رد، مبلغ برگشت می‌خورد.</p>
        {msg && <div style={{marginTop:10,padding:'10px 12px',borderRadius:10,fontSize:13,wordBreak:'break-word',background: msg.startsWith('✅')?'rgba(0,229,160,.12)':'rgba(255,60,90,.12)',border:`1px solid ${msg.startsWith('✅')?'rgba(0,229,160,.3)':'rgba(255,60,90,.3)'}`}}>{msg}</div>}
        <form onSubmit={submitWd} style={{display:'grid',gap:10,marginTop:12}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:8}}>
            <input className="input" placeholder="مبلغ (تومان) — حداقل ۱۰٬۰۰۰" value={wdAmount} onChange={e=>setWdAmount(e.target.value)} inputMode="numeric" dir="ltr"/>
            <button type="button" className="btn btn-ghost btn-sm" style={{minHeight:42,whiteSpace:'nowrap'}} onClick={()=>{ if(profile) setWdAmount(String(profile.balance)) }} disabled={!profile || profile.balance<=0}>برداشت همه</button>
          </div>
          <input className="input" placeholder="شماره کارت/شبای مقصد" value={wdAccount} onChange={e=>setWdAccount(e.target.value)} dir="ltr"/>
          <button className="btn btn-primary" disabled={wdBusy} style={{minHeight:42}}>{wdBusy?'…':'ثبت درخواست برداشت'}</button>
        </form>
      </div>

      {wds.length>0 && (
        <div style={{marginTop:14}}>
          <h3 style={{fontWeight:800,fontSize:15,marginBottom:8}}>درخواست‌های من</h3>
          <div style={{display:'grid',gap:8}}>
            {wds.map(w=>{
              const st = w.status==='pending' ? {label:'در انتظار',bg:'rgba(245,166,35,.14)',color:'#ffb84d'} : w.status==='approved' ? {label:'تایید شد ✅',bg:'rgba(0,229,160,.14)',color:'var(--accent)'} : {label:'رد شد',bg:'rgba(255,60,90,.12)',color:'#ff6b7a'}
              return (
                <div key={w.id} className="card" style={{padding:12,display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                  <div><div style={{fontWeight:800,fontSize:13}}>{Number(w.amount).toLocaleString('fa-IR')} ت <span style={{fontSize:11,color:'var(--muted)'}}>· {w.account}</span></div><div style={{fontSize:11,color:'var(--muted)',marginTop:2}}>{new Date(w.created_at).toLocaleString('fa-IR')}</div>{w.note && <div style={{fontSize:11,color:'var(--muted)',marginTop:2}}>{w.note}</div>}</div>
                  <span style={{fontSize:11,fontWeight:800,padding:'4px 10px',borderRadius:999,background:st.bg,color:st.color,whiteSpace:'nowrap'}}>{st.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <h3 style={{fontWeight:800,marginTop:20,marginBottom:10,fontSize:15}}>تراکنش‌ها</h3>
      {txs.length===0 ? <div style={{color:'var(--muted)',fontSize:13}}>تراکنشی نیست.</div> :
        <div className="card" style={{overflow:'hidden'}}>
          <div className="table-wrap" style={{margin:0,padding:0}}>
          <table className="table">
            <thead><tr><th>نوع</th><th>مبلغ</th><th>توضیح</th><th>تاریخ</th></tr></thead>
            <tbody>{txs.map(t=>(
              <tr key={t.id}>
                <td><span className="badge" style={{fontSize:11}}>{t.type==='charge'?'شارژ':t.type==='bet'?'شرط':t.type==='win'?'برد':t.type==='withdrawal'?'برداشت':t.type==='refund'?'برگشت':'—'}</span></td>
                <td style={{color: t.amount>=0 ? 'var(--accent)' : '#ff6b7a',fontWeight:700, direction:'ltr',textAlign:'right',whiteSpace:'nowrap'}}>
                  {t.amount>0?'+':''}{Number(t.amount).toLocaleString('fa-IR')}
                </td>
                <td style={{fontSize:12,color:'var(--muted)',maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.note||'—'}</td>
                <td style={{fontSize:11,color:'var(--muted)',whiteSpace:'nowrap'}}>{new Date(t.created_at).toLocaleString('fa-IR')}</td>
              </tr>
            ))}</tbody>
          </table>
          </div>
        </div>
      }
    </div>
  )
}
