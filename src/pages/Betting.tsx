import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, type Match, type Bet } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

function MatchCard({ m, onPlaced }:{ m:Match; onPlaced:()=>void }){
  const [amount,setAmount]=useState('50000')
  const [busy,setBusy]=useState<string|null>(null)
  const [msg,setMsg]=useState<string|null>(null)
  const disabled = m.status!=='upcoming'
  const pick = async (p:'team_a'|'team_b'|'draw')=>{
    const n = Number(String(amount).replace(/[^0-9]/g,''))
    if(!n || n<1000){ setMsg('مبلغ حداقل ۱٬۰۰۰ تومان'); return }
    setBusy(p); setMsg(null)
    const { error, data } = await supabase.rpc('place_bet',{ p_match_id:m.id, p_pick:p, p_amount:n })
    if(error){ setMsg(error.message) } else { setMsg('✅ شرط ثبت شد — '+String(data).slice(0,8)); onPlaced() }
    setBusy(null)
  }
  return (
    <div className="card" style={{padding:14, opacity: disabled?0.9:1}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,flexWrap:'wrap'}}>
        <div style={{minWidth:0}}><div style={{fontWeight:800,fontSize:14}}>{m.title}</div><div style={{fontSize:12,color:'var(--muted)'}}>{m.game} · {new Date(m.starts_at).toLocaleString('fa-IR')}</div></div>
        <span className={'status status-'+m.status}>{m.status==='upcoming'?'پیش‌رو':m.status==='live'?'زنده':'پایان‌یافته'}</span>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr auto 1fr',gap:8,alignItems:'center',marginTop:14}}>
        <div style={{textAlign:'center',padding:'12px 8px',borderRadius:14,background:'rgba(255,255,255,.06)',border:'1px solid var(--line)'}}>
          <div style={{fontWeight:800,fontSize:13,wordBreak:'break-word'}}>{m.team_a}</div><div className="odds" style={{color:'var(--accent)',marginTop:6,fontSize:16}}>{Number(m.odds_a).toFixed(2)}</div>
        </div>
        <div style={{fontWeight:900,color:'var(--muted)',fontSize:13}}>VS</div>
        <div style={{textAlign:'center',padding:'12px 8px',borderRadius:14,background:'rgba(255,255,255,.06)',border:'1px solid var(--line)'}}>
          <div style={{fontWeight:800,fontSize:13,wordBreak:'break-word'}}>{m.team_b}</div><div className="odds" style={{color:'var(--accent)',marginTop:6,fontSize:16}}>{Number(m.odds_b).toFixed(2)}</div>
        </div>
      </div>
      {m.odds_draw!=null && <div style={{textAlign:'center',marginTop:10,fontSize:13,color:'var(--muted)'}}>مساوی: <b className="odds">{Number(m.odds_draw).toFixed(2)}</b></div>}
      {m.winner && <div style={{textAlign:'center',marginTop:8,fontSize:12}}>برنده: <b>{m.winner==='team_a'?m.team_a:m.winner==='team_b'?m.team_b:'مساوی'}</b></div>}
      <div style={{display:'flex',gap:8,marginTop:14,alignItems:'stretch',flexWrap:'wrap'}}>
        <input className="input" style={{flex:'1 1 120px',minWidth:110}} value={amount} onChange={e=>setAmount(e.target.value)} placeholder="مبلغ (تومان)" inputMode="numeric" dir="ltr"/>
        <button className="btn btn-primary btn-sm" style={{flex:'1 1 auto'}} disabled={!!busy || disabled} onClick={()=>pick('team_a')}>{busy==='team_a'?'…':'شرط '+m.team_a}</button>
        {m.odds_draw!=null && <button className="btn btn-ghost btn-sm" style={{flex:'1 1 auto'}} disabled={!!busy || disabled} onClick={()=>pick('draw')}>{busy==='draw'?'…':'مساوی'}</button>}
        <button className="btn btn-primary btn-sm" style={{flex:'1 1 auto'}} disabled={!!busy || disabled} onClick={()=>pick('team_b')}>{busy==='team_b'?'…':'شرط '+m.team_b}</button>
      </div>
      {disabled && <div style={{fontSize:11,color:'var(--muted)',marginTop:8,textAlign:'center'}}>این مسابقه بسته است — شرط جدید پذیرفته نمی‌شود.</div>}
      {msg && <div style={{fontSize:13,marginTop:10,background:'rgba(255,255,255,.06)',padding:'8px 10px',borderRadius:10,wordBreak:'break-word'}}>{msg}</div>}
    </div>
  )
}

export default function Betting(){
  const { profile, refresh, userId } = useAuth() as any
  const [matches,setMatches]=useState<Match[]>([])
  const [bets,setBets]=useState<Bet[]>([])
  const [cancelId,setCancelId]=useState<string|null>(null)

  const load = async()=>{
    const { data:ms } = await supabase.from('matches').select('*').order('starts_at',{ascending:true})
    setMatches((ms as Match[])||[])
    if(!userId){ setBets([]); return }
    const { data:bs } = await supabase.from('bets').select('*, matches(*)').eq('user_id', userId).order('created_at',{ascending:false}).limit(50)
    setBets((bs as any[])||[])
  }
  useEffect(()=>{ load() },[userId])
  const onPlaced = async()=>{ await load(); await refresh() }
  const cancel = async(b:Bet)=>{
    const st = (b as any).matches?.status
    if(st!=='upcoming'){ alert('این مسابقه دیگر قابل لغو نیست'); return }
    if(!confirm('لغو این شرط؟ مبلغ به کیف پول برمی‌گردد.')) return
    setCancelId(b.id)
    const { error } = await supabase.rpc('cancel_bet',{ p_bet_id: b.id })
    if(error) alert(error.message)
    else await onPlaced()
    setCancelId(null)
  }

  const open = matches.filter(m=> m.status==='upcoming')
  const closed = matches.filter(m=> m.status!=='upcoming')

  return (
    <div className="container" style={{padding:'20px 14px 28px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}>
        <h2 style={{fontWeight:900,fontSize:22}}>شرط‌بندی مسابقات</h2>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <span className="badge">موجودی: {profile ? profile.balance.toLocaleString('fa-IR')+' ت' : '—'}</span>
          <Link className="btn btn-ghost btn-sm" to="/wallet">کیف پول</Link>
        </div>
      </div>
      <p style={{color:'var(--muted)',fontSize:13,marginTop:6}}>فقط مسابقات «قابل پیش‌بینی» باز هستند. بقیه بسته شده‌اند.</p>

      <h3 style={{fontWeight:800,marginTop:18,marginBottom:10,fontSize:15}}>✅ قابل پیش‌بینی ({open.length})</h3>
      {open.length===0 ? <div style={{color:'var(--muted)',fontSize:13,padding:'12px 0'}}>مسابقه‌ی بازی وجود ندارد.</div> :
        <div className="bet-grid">{open.map(m=> <MatchCard key={m.id} m={m} onPlaced={onPlaced}/>)}</div>
      }

      <h3 style={{fontWeight:800,marginTop:20,marginBottom:10,fontSize:15}}>🔒 پیش‌بینی بسته شده ({closed.length})</h3>
      {closed.length===0 ? <div style={{color:'var(--muted)',fontSize:13}}>موردی نیست.</div> :
        <div className="bet-grid">{closed.map(m=> <MatchCard key={m.id} m={m} onPlaced={onPlaced}/>)}</div>
      }

      <div className="divider"/>
      <h3 style={{fontWeight:800,marginBottom:10,fontSize:15}}>شرط‌های من {bets.length>0 && <span style={{fontWeight:600,color:'var(--muted)',fontSize:12}}>· {bets.length} شرط</span>}</h3>
      {bets.length===0 ? <div className="card" style={{padding:'18px 14px',textAlign:'center',color:'var(--muted)',fontSize:13}}>هنوز شرطی ثبت نکرده‌اید — از بالا یک مسابقه را انتخاب کنید.</div> :
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:10}}>
          {bets.map(b=>{
            const canCancel = b.status==='pending' && (b as any).matches?.status==='upcoming'
            const st = b.status
            const stCfg = st==='won' ? {label:'برد ✅',bg:'rgba(0,229,160,.15)',color:'var(--accent)',border:'rgba(0,229,160,.35)'} : st==='lost' ? {label:'باخت',bg:'rgba(255,60,90,.12)',color:'#ff6b7a',border:'rgba(255,90,110,.3)'} : st==='refunded' ? {label:'لغو شد',bg:'rgba(255,255,255,.06)',color:'var(--muted)',border:'var(--line)'} : {label:'در انتظار',bg:'rgba(245,166,35,.14)',color:'#ffb84d',border:'rgba(245,166,35,.35)'}
            const pickLabel = b.pick==='team_a' ? ((b as any).matches?.team_a || 'تیم A') : b.pick==='team_b' ? ((b as any).matches?.team_b || 'تیم B') : 'مساوی'
            return (
              <div key={b.id} className="card" style={{padding:14,borderRight:`3px solid ${stCfg.border}`,display:'flex',flexDirection:'column',gap:10}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
                  <div style={{minWidth:0,flex:1}}>
                    <div style={{fontWeight:800,fontSize:13,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{(b as any).matches?.title || 'مسابقه '+b.match_id.slice(0,8)}</div>
                    <div style={{fontSize:11,color:'var(--muted)',marginTop:2}}>{(b as any).matches?.game || ''} {(b as any).matches ? '·' : ''} {new Date(b.created_at).toLocaleDateString('fa-IR')}</div>
                  </div>
                  <span style={{fontSize:11,fontWeight:800,padding:'4px 10px',borderRadius:999,background:stCfg.bg,color:stCfg.color,border:`1px solid ${stCfg.border}`,whiteSpace:'nowrap',flexShrink:0}}>{stCfg.label}</span>
                </div>

                <div style={{display:'flex',alignItems:'center',gap:6,fontSize:12,background:'rgba(255,255,255,.05)',border:'1px solid var(--line)',borderRadius:10,padding:'7px 10px'}}>
                  <span style={{color:'var(--muted)'}}>انتخاب:</span><b>{pickLabel}</b>
                  <span style={{marginRight:'auto',fontSize:11,color:'var(--muted)'}}>{b.pick==='draw'?'⚖️':b.pick==='team_a'?'🔵':'🔴'}</span>
                </div>

                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
                  <div style={{background:'rgba(255,255,255,.04)',border:'1px solid var(--line)',borderRadius:10,padding:'8px 6px',textAlign:'center'}}>
                    <div style={{fontSize:10,color:'var(--muted)'}}>مبلغ</div><div style={{fontWeight:800,fontSize:12,marginTop:2}}>{Number(b.amount).toLocaleString('fa-IR')} <span style={{fontSize:10,color:'var(--muted)'}}>ت</span></div>
                  </div>
                  <div style={{background:'rgba(255,255,255,.04)',border:'1px solid var(--line)',borderRadius:10,padding:'8px 6px',textAlign:'center'}}>
                    <div style={{fontSize:10,color:'var(--muted)'}}>ضریب</div><div className="odds" style={{fontWeight:900,fontSize:13,marginTop:2,color:'var(--accent)'}}>{Number(b.odds).toFixed(2)}×</div>
                  </div>
                  <div style={{background: st==='won' ? 'rgba(0,229,160,.10)' : 'rgba(255,255,255,.04)',border:`1px solid ${st==='won'?'rgba(0,229,160,.25)':'var(--line)'}`,borderRadius:10,padding:'8px 6px',textAlign:'center'}}>
                    <div style={{fontSize:10,color:'var(--muted)'}}>{st==='won'?'دریافتی':'برد احتمالی'}</div><div style={{fontWeight:800,fontSize:12,marginTop:2}}>{Number(b.potential_payout).toLocaleString('fa-IR')} <span style={{fontSize:10,color:'var(--muted)'}}>ت</span></div>
                  </div>
                </div>

                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginTop:2}}>
                  <span style={{fontSize:11,color:'var(--muted)'}}>{new Date(b.created_at).toLocaleString('fa-IR')}</span>
                  {canCancel
                    ? <button className="btn btn-ghost btn-sm" style={{fontSize:12,color:'#ff6b7a',borderColor:'rgba(255,90,110,.35)',minHeight:32,padding:'6px 14px'}} disabled={cancelId===b.id} onClick={()=>cancel(b)}>{cancelId===b.id?'…':'لغو شرط'}</button>
                    : <span style={{fontSize:11,color:'var(--muted)'}}>{st==='refunded'?'↩️ برگشت خورد':st==='won'?'💰 واریز شد':st==='lost'?'—':''}</span>
                  }
                </div>
              </div>
          )})}
        </div>
      }
    </div>
  )
}
