import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, type Match, type Profile } from '../lib/supabase'

type Exposure = Record<string,{ total:number; a:{amt:number;pay:number}; b:{amt:number;pay:number}; d:{amt:number;pay:number} }>

export default function Admin(){
  const [users,setUsers]=useState<Profile[]>([])
  const [matches,setMatches]=useState<Match[]>([])
  const [exposure,setExposure]=useState<Exposure>({})
  const [house,setHouse]=useState<{byMatch:Record<string,{total:number,paid:number,profit:number,count:number}>, totalProfit:number, totalStakes:number, totalPaid:number}>({byMatch:{},totalProfit:0,totalStakes:0,totalPaid:0})
  const [msg,setMsg]=useState<string|null>(null)
  const [chargeUser,setChargeUser]=useState('')
  const [chargeAmount,setChargeAmount]=useState('100000')
  const [form,setForm]=useState({ title:'', game:'FC 25', team_a:'', team_b:'', odds_a:'1.90', odds_b:'1.90', odds_draw:'', starts_at:'', odds_mode:'auto' as 'manual'|'auto', margin:'5' })
  const [matchTab,setMatchTab]=useState<'upcoming'|'history'>('upcoming')

  const load = async()=>{
    const { data:us } = await supabase.from('profiles').select('*').order('created_at',{ascending:false}).limit(100)
    setUsers((us as Profile[])||[])
    const { data:ms } = await supabase.from('matches').select('*').order('starts_at',{ascending:true})
    setMatches((ms as Match[])||[])
    const { data:bets } = await supabase.from('bets').select('match_id,pick,amount,potential_payout,status').eq('status','pending')
    const exp:Exposure={}
    for(const m of (ms as Match[]||[])) exp[m.id]={ total:0, a:{amt:0,pay:0}, b:{amt:0,pay:0}, d:{amt:0,pay:0} }
    for(const b of (bets as any[]||[])){
      const e=exp[b.match_id]; if(!e) continue
      e.total+=Number(b.amount)
      if(b.pick==='team_a'){ e.a.amt+=Number(b.amount); e.a.pay+=Number(b.potential_payout) }
      else if(b.pick==='team_b'){ e.b.amt+=Number(b.amount); e.b.pay+=Number(b.potential_payout) }
      else { e.d.amt+=Number(b.amount); e.d.pay+=Number(b.potential_payout) }
    }
    setExposure(exp)
    // house profit — settled matches only (won/lost), pending/refunded are not house profit yet
    const { data: settled } = await supabase.from('bets').select('match_id,amount,potential_payout,status').in('status',['won','lost'])
    const by: Record<string,{total:number,paid:number,profit:number,count:number}> = {}
    let tp=0, ts=0, td=0
    for(const b of (settled as any[]||[])){
      const mid=b.match_id as string
      if(!by[mid]) by[mid]={total:0,paid:0,profit:0,count:0}
      by[mid].total += Number(b.amount)
      by[mid].count += 1
      if(b.status==='won') by[mid].paid += Number(b.potential_payout)
      ts += Number(b.amount)
      if(b.status==='won') td += Number(b.potential_payout)
    }
    for(const k of Object.keys(by)){ by[k].profit = by[k].total - by[k].paid; tp += by[k].profit }
    tp = ts - td
    setHouse({byMatch:by,totalProfit:tp,totalStakes:ts,totalPaid:td})
  }
  useEffect(()=>{ load() },[])

  const doCharge = async()=>{
    setMsg(null)
    const amt = Number(chargeAmount.replace(/[^0-9]/g,''))
    if(!chargeUser || !amt){ setMsg('کاربر و مبلغ را وارد کنید'); return }
    let uid = chargeUser.trim()
    if(!uid.includes('-')){
      const found = users.find(u=> (u.username===uid || u.id===uid))
      if(found) uid = found.id
      else {
        const { data } = await supabase.from('profiles').select('id').eq('username',uid).single()
        if(data) uid = (data as any).id
        else { setMsg('کاربر یافت نشد — UUID یا username دقیق وارد کنید'); return }
      }
    }
    const { error, data } = await supabase.rpc('charge_wallet',{ p_user_id:uid, p_amount:amt })
    if(error) setMsg('خطا: '+error.message)
    else { setMsg('✅ شارژ شد — موجودی جدید: '+Number(data).toLocaleString('fa-IR')+' ت'); load() }
  }

  const createMatch = async(e:React.FormEvent)=>{
    e.preventDefault(); setMsg(null)
    const mgn = Math.max(0, Math.min(30, Number(form.margin)||5))/100
    const payload:any = {
      title: form.title, game: form.game, team_a: form.team_a, team_b: form.team_b,
      odds_a: Number(form.odds_a), odds_b: Number(form.odds_b),
      odds_draw: form.odds_draw ? Number(form.odds_draw) : null,
      odds_mode: form.odds_mode, margin: mgn,
      status: 'upcoming', starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : new Date(Date.now()+3600000).toISOString()
    }
    const { error } = await supabase.from('matches').insert(payload)
    if(error) setMsg(error.message); else { setMsg('✅ مسابقه ساخته شد ('+(form.odds_mode==='auto'?'سیستمی':'دستی')+')'); setForm({ title:'', game:'FC 25', team_a:'', team_b:'', odds_a:'1.90', odds_b:'1.90', odds_draw:'', starts_at:'', odds_mode:'auto', margin:'5' }); load() }
  }

  const settle = async(id:string, winner:'team_a'|'team_b'|'draw')=>{
    setMsg(null)
    const { error, data } = await supabase.rpc('settle_match',{ p_match_id:id, p_winner:winner })
    if(error) setMsg(error.message); else { setMsg('✅ تسویه شد — '+String(data)+' شرط'); load() }
  }
  const setLive = async(id:string)=>{
    const { error } = await supabase.from('matches').update({ status:'live' }).eq('id',id)
    if(error) setMsg(error.message); else load()
  }
  const toggleMode = async(m:Match)=>{
    const next = m.odds_mode==='auto' ? 'manual' : 'auto'
    const { error } = await supabase.from('matches').update({ odds_mode: next }).eq('id',m.id)
    if(error){ setMsg(error.message); return }
    if(next==='auto'){
      const { error: e2 } = await supabase.rpc('recalc_odds',{ p_match_id:m.id })
      if(e2) setMsg('حالت سیستمی شد ولی بازمحاسبه خطا: '+e2.message)
      else setMsg('⚙️ سیستمی شد — ضرایب بر اساس حجم فعلی بازمحاسبه شد')
    } else setMsg('✋ دستی شد — ضرایب ثابت ماند')
    load()
  }
  const recalc = async(id:string)=>{
    const { error } = await supabase.rpc('recalc_odds',{ p_match_id:id })
    if(error) setMsg(error.message); else { setMsg('ضرایب بازمحاسبه شد'); load() }
  }
  const removeMatch = async(id:string)=>{
    if(!confirm('حذف مسابقه؟ شرط‌های باز به کیف پول برمی‌گردد.')) return
    setMsg(null)
    const { error } = await supabase.rpc('delete_match',{ p_match_id:id })
    if(error) setMsg('خطا: '+error.message); else { setMsg('🗑️ مسابقه حذف شد (شرط‌ها برگشت خورد)'); load() }
  }

  return (
    <div className="container" style={{padding:'20px 14px 28px'}}>
      <h2 style={{fontWeight:900,fontSize:22}}>پنل ادمین</h2>
      <div style={{display:'flex',gap:8,marginTop:10,flexWrap:'wrap'}}>
        <Link to="/admin/withdrawals" className="btn btn-primary btn-sm">💸 مدیریت برداشت‌ها</Link>
      </div>
      {msg && <div style={{marginTop:10,background:'rgba(0,229,160,.12)',border:'1px solid rgba(0,229,160,.3)',padding:'10px 12px',borderRadius:12,fontSize:13,wordBreak:'break-word'}}>{msg}</div>}

      {/* house profit — settled matches only */}
      <div className="card" style={{marginTop:14,padding:14,background: house.totalProfit>=0 ? 'linear-gradient(135deg,#0f2a22,#162040)' : 'linear-gradient(135deg,#2a0f1a,#1e1430)',borderColor: house.totalProfit>=0?'rgba(0,229,160,.25)':'rgba(255,60,90,.25)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10,flexWrap:'wrap'}}>
          <div>
            <div style={{fontWeight:900,fontSize:15}}>💰 سود خانه — مسابقات تمام‌شده</div>
            <div style={{fontSize:11,color:'var(--muted)',marginTop:4}}>فقط مسابقاتی که تسویه شدند حساب می‌شوند (در انتظار/لغوشده حساب نیست).</div>
          </div>
          <span className="badge" style={{fontSize:11,background: house.totalProfit>=0?'rgba(0,229,160,.15)':'rgba(255,60,90,.15)',color: house.totalProfit>=0?'var(--accent)':'#ff6b7a',borderColor: house.totalProfit>=0?'rgba(0,229,160,.3)':'rgba(255,60,90,.3)'}}>{house.totalProfit>=0?'سود':'ضرر'}</span>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginTop:12}}>
          <div style={{background:'rgba(255,255,255,.06)',border:'1px solid var(--line)',borderRadius:12,padding:'12px 10px',textAlign:'center'}}>
            <div style={{fontSize:10,color:'var(--muted)'}}>کل شرط‌ها (تسویه‌شده)</div><div style={{fontWeight:900,fontSize:13,marginTop:4}}>{house.totalStakes.toLocaleString('fa-IR')} <span style={{fontSize:10,color:'var(--muted)'}}>ت</span></div><div style={{fontSize:10,color:'var(--muted)',marginTop:2}}>{Object.values(house.byMatch).reduce((s,v)=>s+v.count,0).toLocaleString('fa-IR')} شرط</div>
          </div>
          <div style={{background:'rgba(255,255,255,.06)',border:'1px solid var(--line)',borderRadius:12,padding:'12px 10px',textAlign:'center'}}>
            <div style={{fontSize:10,color:'var(--muted)'}}>پرداختی به برندگان</div><div style={{fontWeight:900,fontSize:13,marginTop:4}}>{house.totalPaid.toLocaleString('fa-IR')} <span style={{fontSize:10,color:'var(--muted)'}}>ت</span></div>
          </div>
          <div style={{background: house.totalProfit>=0?'rgba(0,229,160,.10)':'rgba(255,60,90,.10)',border:`1px solid ${house.totalProfit>=0?'rgba(0,229,160,.3)':'rgba(255,60,90,.3)'}`,borderRadius:12,padding:'12px 10px',textAlign:'center'}}>
            <div style={{fontSize:10,color: house.totalProfit>=0?'var(--accent)':'#ff6b7a',fontWeight:700}}>سود خالص</div><div style={{fontWeight:900,fontSize:16,marginTop:4,color: house.totalProfit>=0?'var(--accent)':'#ff6b7a'}}>{house.totalProfit>=0?'+':''}{house.totalProfit.toLocaleString('fa-IR')} <span style={{fontSize:11}}>ت</span></div>
          </div>
        </div>
        {Object.keys(house.byMatch).length>0 && (()=>{
          const finished = [...matches].filter(m=> m.status==='finished' && house.byMatch[m.id]).sort((a,b)=> new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())
          const show = finished.slice(0,3)
          const rest = finished.length - show.length
          return (
          <div style={{marginTop:12,display:'grid',gap:8}}>
            {show.map(m=>{
              const h = house.byMatch[m.id]
              return (
                <div key={m.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,background:'rgba(255,255,255,.05)',border:'1px solid var(--line)',borderRadius:10,padding:'10px 12px',flexWrap:'wrap'}}>
                  <div style={{minWidth:0}}><div style={{fontWeight:800,fontSize:12,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{m.title}</div><div style={{fontSize:11,color:'var(--muted)'}}>{m.team_a} vs {m.team_b} · 🏆 {m.winner==='team_a'?m.team_a:m.winner==='team_b'?m.team_b:'مساوی'} · {h.count} شرط</div></div>
                  <div style={{textAlign:'left',flexShrink:0}}><div style={{fontSize:10,color:'var(--muted)'}}>سود این مسابقه</div><div style={{fontWeight:900,fontSize:13,color: h.profit>=0?'var(--accent)':'#ff6b7a'}}>{h.profit>=0?'+':''}{h.profit.toLocaleString('fa-IR')} ت</div><div style={{fontSize:10,color:'var(--muted)'}}>{h.total.toLocaleString('fa-IR')} دریافت · {h.paid.toLocaleString('fa-IR')} پرداخت</div></div>
                </div>
              )
            })}
            {finished.length===0 && house.totalProfit!==0 && (
              <div style={{fontSize:11,color:'var(--muted)',textAlign:'center',padding:6}}>مسابقه‌ی تمام‌شده در لیست فعلی نیست — ولی سرجمع بالا محاسبه شده.</div>
            )}
            {rest>0 && <Link to="/admin/house" className="btn btn-ghost btn-sm" style={{justifyContent:'center'}}>نمایش بیشتر · {rest} مسابقه دیگر →</Link>}
          </div>
          )
        })()}
      </div>

      <div className="admin-grid" style={{marginTop:14}}>
        <div className="card" style={{padding:14}}>
          <h3 style={{fontWeight:800,marginBottom:10,fontSize:15}}>شارژ کیف پول (تومان)</h3>
          <div style={{display:'grid',gap:10}}>
            <input className="input" placeholder="UUID یا username کاربر" value={chargeUser} onChange={e=>setChargeUser(e.target.value)} dir="ltr"/>
            <input className="input" placeholder="مبلغ تومان — مثلا 100000" value={chargeAmount} onChange={e=>setChargeAmount(e.target.value)} dir="ltr" inputMode="numeric"/>
            <button className="btn btn-primary" onClick={doCharge}>شارژ دستی</button>
            <div style={{fontSize:11,color:'var(--muted)'}}>از جدول کاربران یک username را کپی کنید یا UUID کامل را وارد کنید.</div>
          </div>
        </div>

        <div className="card" style={{padding:14}}>
          <h3 style={{fontWeight:800,marginBottom:10,fontSize:15}}>ساخت مسابقه جدید</h3>
          <form onSubmit={createMatch} style={{display:'grid',gap:10}}>
            <input className="input" placeholder="عنوان — مثلا فینال جمعه" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} required/>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <input className="input" placeholder="تیم A" value={form.team_a} onChange={e=>setForm({...form,team_a:e.target.value})} required/>
              <input className="input" placeholder="تیم B" value={form.team_b} onChange={e=>setForm({...form,team_b:e.target.value})} required/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
              <input className="input" placeholder="ضریب A" value={form.odds_a} onChange={e=>{
                const v=e.target.value
                if(form.odds_mode==='auto'){
                  const a=Number(v), b=Number(form.odds_b), d=Number(form.odds_draw)
                  let sum=0; if(a>=1.01) sum+=1/a; if(b>=1.01) sum+=1/b; if(form.odds_draw.trim()!=='' && d>=1.01) sum+=1/d
                  let m=form.margin; if(sum>1){ const mm=1-1/sum; m=String(Math.round(Math.max(0,Math.min(0.30,mm))*100)) }
                  setForm({...form, odds_a:v, margin:m})
                } else setForm({...form,odds_a:v})
              }} dir="ltr"/>
              <input className="input" placeholder="ضریب B" value={form.odds_b} onChange={e=>{
                const v=e.target.value
                if(form.odds_mode==='auto'){
                  const a=Number(form.odds_a), b=Number(v), d=Number(form.odds_draw)
                  let sum=0; if(a>=1.01) sum+=1/a; if(b>=1.01) sum+=1/b; if(form.odds_draw.trim()!=='' && d>=1.01) sum+=1/d
                  let m=form.margin; if(sum>1){ const mm=1-1/sum; m=String(Math.round(Math.max(0,Math.min(0.30,mm))*100)) }
                  setForm({...form, odds_b:v, margin:m})
                } else setForm({...form,odds_b:v})
              }} dir="ltr"/>
              <input className="input" placeholder="مساوی (اختیاری)" value={form.odds_draw} onChange={e=>{
                const v=e.target.value
                if(form.odds_mode==='auto'){
                  const a=Number(form.odds_a), b=Number(form.odds_b), d=Number(v)
                  let sum=0; if(a>=1.01) sum+=1/a; if(b>=1.01) sum+=1/b; if(v.trim()!=='' && d>=1.01) sum+=1/d
                  let m=form.margin; if(sum>1){ const mm=1-1/sum; m=String(Math.round(Math.max(0,Math.min(0.30,mm))*100)) } else if(v.trim()===''){ let s2=0; if(a>=1.01) s2+=1/a; if(b>=1.01) s2+=1/b; if(s2>1) m=String(Math.round(Math.max(0,Math.min(0.30,1-1/s2))*100)) }
                  setForm({...form, odds_draw:v, margin:m})
                } else setForm({...form,odds_draw:v})
              }} dir="ltr"/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <input className="input" placeholder="بازی — FC 25" value={form.game} onChange={e=>setForm({...form,game:e.target.value})}/>
              <input className="input" type="datetime-local" value={form.starts_at} onChange={e=>setForm({...form,starts_at:e.target.value})} dir="ltr"/>
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',background:'rgba(255,255,255,.05)',border:'1px solid var(--line)',borderRadius:12,padding:'10px 12px'}}>
              <label style={{fontSize:12,fontWeight:700}}>حالت ضریب:</label>
              <label style={{display:'flex',gap:4,alignItems:'center',fontSize:13,cursor:'pointer'}}><input type="radio" name="om" checked={form.odds_mode==='manual'} onChange={()=>setForm({...form,odds_mode:'manual'})}/> دستی</label>
              <label style={{display:'flex',gap:4,alignItems:'center',fontSize:13,cursor:'pointer'}}><input type="radio" name="om" checked={form.odds_mode==='auto'} onChange={()=>setForm({...form,odds_mode:'auto'})}/> سیستمی</label>
              {form.odds_mode==='auto' && <><span style={{fontSize:11,color:'var(--muted)'}}>سود %</span><input className="input" style={{width:80}} value={form.margin} onChange={e=>setForm({...form, margin:e.target.value})} dir="ltr"/><span style={{fontSize:10,color:'var(--muted)'}}>{form.odds_a}× / {form.odds_b}×{form.odds_draw!==''?` / ${form.odds_draw}×`:''}</span></>}
            </div>
            <div style={{fontSize:11,color:'var(--muted)',lineHeight:1.6}}>{form.odds_mode==='manual' ? 'حالت دستی — ضریب ثابت است.' : 'حالت سیستمی — ضریب به‌صورت خودکار به‌روزرسانی می‌شود.'}</div>
            <button className="btn btn-primary">ایجاد مسابقه</button>
          </form>
        </div>
      </div>

      <div style={{marginTop:14}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap'}}>
          <h3 style={{fontWeight:800,fontSize:15}}>مسابقات</h3>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {(()=>{ const u=matches.filter(m=>m.status==='upcoming').length; const h=matches.filter(m=>m.status!=='upcoming').length; const Btn=(k:'upcoming'|'history',label:string,n:number)=><button key={k} className={matchTab===k?'btn btn-primary btn-sm':'btn btn-ghost btn-sm'} onClick={()=>setMatchTab(k)} style={{gap:6}}>{label} {n>0&&<span style={{background:matchTab===k?'rgba(255,255,255,.22)':'rgba(255,255,255,.10)',padding:'1px 6px',borderRadius:999,fontSize:11}}>{n}</span>}</button>; return <>{Btn('upcoming','قابل پیش‌بینی',u)}{Btn('history','سابقه',h)}</> })()}
          </div>
        </div>
        {(()=>{ const list = matchTab==='upcoming' ? matches.filter(m=>m.status==='upcoming') : matches.filter(m=>m.status!=='upcoming'); if(list.length===0) return <div className="card" style={{marginTop:10,padding:'20px 14px',textAlign:'center',color:'var(--muted)',fontSize:13}}>{matchTab==='upcoming'?'مسابقه‌ی قابل پیش‌بینی نیست.':'سابقه‌ای نیست.'}</div>; return (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))',gap:12,marginTop:10}}>
          {list.map(m=>{
            const e = exposure[m.id] || { total:0, a:{amt:0,pay:0}, b:{amt:0,pay:0}, d:{amt:0,pay:0} }
            const pA = e.total - e.a.pay, pB = e.total - e.b.pay, pD = e.total - e.d.pay
            const hasDraw = m.odds_draw!=null
            const allNonNeg = pA>=0 && pB>=0 && (!hasDraw || pD>=0)
            const stLabel = m.status==='upcoming'?'پیش‌رو':m.status==='live'?'زنده':'پایان‌یافته'
            return (
            <div key={m.id} className="card" style={{padding:14,display:'flex',flexDirection:'column',gap:10,borderTop:`3px solid ${m.status==='live'?'#ff4d6a':m.status==='finished'?'var(--line)':'var(--accent)'}`}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
                <div style={{minWidth:0,flex:1}}>
                  <div style={{fontWeight:800,fontSize:13,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{m.title}</div>
                  <div style={{fontSize:11,color:'var(--muted)',marginTop:2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{m.team_a} vs {m.team_b} · {m.game} · {new Date(m.starts_at).toLocaleString('fa-IR')}</div>
                </div>
                <span className={'status status-'+m.status} style={{flexShrink:0}}>{stLabel}</span>
              </div>

              <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
                <span className="badge" style={{fontSize:11}}>{(m as any).odds_mode==='auto'?`⚙️ سیستمی ${(Number((m as any).margin)*100).toFixed(0)}%`:'✋ دستی'}</span>
                <span style={{fontSize:11,color:'var(--muted)'}}>استخر {e.total.toLocaleString('fa-IR')} ت</span>
                <span className="badge" style={{fontSize:10,marginRight:'auto',background: allNonNeg?'rgba(0,229,160,.12)':'rgba(255,60,90,.12)',color: allNonNeg?'var(--accent)':'#ff6b7a',borderColor: allNonNeg?'rgba(0,229,160,.3)':'rgba(255,60,90,.3)'}}>{allNonNeg?'✅ متوازن':'⚠️ ریسک ضرر'}</span>
              </div>

              <div style={{display:'grid',gridTemplateColumns: hasDraw?'1fr 1fr 1fr':'1fr 1fr',gap:8}}>
                <div style={{background:'rgba(255,255,255,.06)',border:'1px solid var(--line)',borderRadius:12,padding:'10px 6px',textAlign:'center'}}>
                  <div style={{fontSize:11,fontWeight:700,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{m.team_a}</div>
                  <div className="odds" style={{color:'var(--accent)',marginTop:4,fontSize:15,fontWeight:900}}>{Number(m.odds_a).toFixed(2)}×</div>
                  <div style={{fontSize:10,color:'var(--muted)',marginTop:4}}>{e.a.amt.toLocaleString('fa-IR')} ت</div>
                </div>
                {hasDraw && <div style={{background:'rgba(255,255,255,.06)',border:'1px solid var(--line)',borderRadius:12,padding:'10px 6px',textAlign:'center'}}>
                  <div style={{fontSize:11,fontWeight:700}}>مساوی</div>
                  <div className="odds" style={{color:'var(--accent)',marginTop:4,fontSize:15,fontWeight:900}}>{Number(m.odds_draw).toFixed(2)}×</div>
                  <div style={{fontSize:10,color:'var(--muted)',marginTop:4}}>{e.d.amt.toLocaleString('fa-IR')} ت</div>
                </div>}
                <div style={{background:'rgba(255,255,255,.06)',border:'1px solid var(--line)',borderRadius:12,padding:'10px 6px',textAlign:'center'}}>
                  <div style={{fontSize:11,fontWeight:700,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{m.team_b}</div>
                  <div className="odds" style={{color:'var(--accent)',marginTop:4,fontSize:15,fontWeight:900}}>{Number(m.odds_b).toFixed(2)}×</div>
                  <div style={{fontSize:10,color:'var(--muted)',marginTop:4}}>{e.b.amt.toLocaleString('fa-IR')} ت</div>
                </div>
              </div>

              <div style={{background: allNonNeg?'rgba(0,229,160,.07)':'rgba(255,60,90,.07)',border:`1px solid ${allNonNeg?'rgba(0,229,160,.2)':'rgba(255,60,90,.2)'}`,borderRadius:12,padding:'10px 10px',display:'grid',gridTemplateColumns: hasDraw?'1fr 1fr 1fr':'1fr 1fr',gap:8,textAlign:'center'}}>
                <div><div style={{fontSize:10,color:'var(--muted)'}}>اگر A ببرد</div><div style={{fontWeight:800,fontSize:11,marginTop:2,color: pA>=0?'var(--accent)':'#ff6b7a'}}>{pA>=0?'+':''}{pA.toLocaleString('fa-IR')} ت</div></div>
                {hasDraw && <div><div style={{fontSize:10,color:'var(--muted)'}}>مساوی</div><div style={{fontWeight:800,fontSize:11,marginTop:2,color: pD>=0?'var(--accent)':'#ff6b7a'}}>{pD>=0?'+':''}{pD.toLocaleString('fa-IR')} ت</div></div>}
                <div><div style={{fontSize:10,color:'var(--muted)'}}>اگر B ببرد</div><div style={{fontWeight:800,fontSize:11,marginTop:2,color: pB>=0?'var(--accent)':'#ff6b7a'}}>{pB>=0?'+':''}{pB.toLocaleString('fa-IR')} ت</div></div>
              </div>

              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                <button className="btn btn-ghost btn-sm" style={{flex:'1 1 auto',minHeight:34}} onClick={()=>toggleMode(m)}>{(m as any).odds_mode==='auto'?'✋ دستی کن':'⚙️ سیستمی کن'}</button>
                {(m as any).odds_mode==='auto' && <button className="btn btn-ghost btn-sm" style={{flex:'1 1 auto',minHeight:34}} onClick={()=>recalc(m.id)}>بازمحاسبه</button>}
                {m.status==='upcoming' && <button className="btn btn-ghost btn-sm" style={{flex:'1 1 auto',minHeight:34}} onClick={()=>setLive(m.id)}>🔴 زنده کن</button>}
              </div>

              <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
                {m.status!=='finished' ? <>
                  <button className="btn btn-primary btn-sm" style={{flex:'1 1 auto',minHeight:34}} onClick={()=>settle(m.id,'team_a')}>🏆 برد {m.team_a}</button>
                  {m.odds_draw!=null && <button className="btn btn-ghost btn-sm" style={{flex:'1 1 auto',minHeight:34}} onClick={()=>settle(m.id,'draw')}>مساوی</button>}
                  <button className="btn btn-primary btn-sm" style={{flex:'1 1 auto',minHeight:34}} onClick={()=>settle(m.id,'team_b')}>🏆 برد {m.team_b}</button>
                </> : <span style={{flex:1,fontSize:12,color:'var(--muted)'}}>برنده: <b style={{color:'#fff'}}>{m.winner==='team_a'?m.team_a:m.winner==='team_b'?m.team_b:'مساوی'}</b></span>}
                <button className="btn btn-ghost btn-sm" style={{color:'#ff6b7a',borderColor:'rgba(255,90,110,.3)',minHeight:34}} onClick={()=>removeMatch(m.id)}>حذف</button>
              </div>
            </div>
          )})}
        </div>)})()}
      </div>

      <div className="card" style={{padding:14,marginTop:12}}>
        <h3 style={{fontWeight:800,marginBottom:8,fontSize:15}}>کاربران</h3>
        <div className="table-wrap">
        <table className="table">
          <thead><tr><th>username</th><th>نمایش</th><th>موجودی</th><th>ادمین</th><th>شناسه</th></tr></thead>
          <tbody>{users.map(u=>(
            <tr key={u.id}>
              <td dir="ltr" style={{fontSize:12}}>{u.username||'—'}</td>
              <td style={{fontSize:12}}>{u.display_name||'—'}</td>
              <td style={{fontWeight:700,whiteSpace:'nowrap'}}>{Number(u.balance).toLocaleString('fa-IR')} ت</td>
              <td>{u.is_admin ? '✅' : '—'}</td>
              <td dir="ltr" style={{fontSize:10,color:'var(--muted)',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{u.id}</td>
            </tr>
          ))}</tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
