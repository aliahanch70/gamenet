import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, type Match, type Profile } from '../lib/supabase'

type Exposure = Record<string,{ total:number; a:{amt:number;pay:number}; b:{amt:number;pay:number}; d:{amt:number;pay:number} }>

const FONT_OPTS = [
  { value: 'vazir', label: 'وزیرمتن (پیش‌فرض)' },
  { value: 'samim', label: 'صمیم' },
  { value: 'iransans', label: 'ایران‌سنس' },
]
const J_MONTHS=['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند']
function div(a:number,b:number){return Math.floor(a/b)}
function jalCal(jy:number){
  const breaks=[-61,9,38,199,426,686,756,818,1111,1181,1210,1635,2060,2097,2192,2262,2324,2394,2456,3178]
  let bl=breaks.length, gy=jy+621, leapJ=-14, jp=breaks[0]
  for(let i=1;i<bl;i++){ const jm=breaks[i], jump=jm-jp
    if(jy<jm){ const n=jy-jp; leapJ+=div(n,33)*8+div(n%33+3,4); if(jump%33===4 && jump-n===4) leapJ++
      const leapG=div(gy,4)-div(div(gy,100)+1,4)-150, march=20+leapJ-leapG
      let leap=(leapJ+1)%33-1; if(leap===-1) leap=4
      return {leap, gy, march}
    }
    leapJ+=div(jump,33)*8+div(jump%33,4); jp=jm
  }
  return {leap:0, gy, march:0}
}
function toJalaali(gy:number,gm:number,gd:number){
  const d=new Date(gy,gm-1,gd)
  const f=new Intl.DateTimeFormat('en-u-ca-persian',{year:'numeric',month:'numeric',day:'numeric'}).format(d)
  const nums=(f.match(/\d+/g)||[]).map(Number)
  // en-u-ca-persian => M/D/Y (6/17/1405), fa variant => Y/M/D (1405/6/17)
  let jy:number, jm:number, jd:number
  if(nums.length===3 && nums[0]>1000){ jy=nums[0]; jm=nums[1]; jd=nums[2] }
  else { jm=nums[0]||0; jd=nums[1]||0; jy=nums[2]||0 }
  return {jy,jm,jd}
}
function toGregorian(jy:number,jm:number,jd:number){
  // ponytail: Intl binary search — no extra dep, O(log n)
  let lo=new Date(2020,0,1).getTime(), hi=new Date(2035,11,31).getTime()
  for(let i=0;i<40;i++){
    const mid=new Date((lo+hi)/2)
    const f=new Intl.DateTimeFormat('en-u-ca-persian',{year:'numeric',month:'numeric',day:'numeric'}).format(mid)
    const nums2=(f.match(/\d+/g)||[]).map(Number)
    let my:number, mm:number, md:number
    if(nums2.length===3 && nums2[0]>1000){ my=nums2[0]; mm=nums2[1]; md=nums2[2] }
    else { mm=nums2[0]||0; md=nums2[1]||0; my=nums2[2]||0 }
    if(my===jy && mm===jm && md===jd) return [mid.getFullYear(),mid.getMonth()+1,mid.getDate()] as [number,number,number]
    if(my<jy || (my===jy && (mm<jm || (mm===jm && md<jd)))) lo=mid.getTime()+86400000
    else hi=mid.getTime()-86400000
  }
  const d=new Date(lo); return [d.getFullYear(),d.getMonth()+1,d.getDate()] as [number,number,number]
}
function jDaysInMonth(jy:number,jm:number){ if(jm<=6) return 31; if(jm<=11) return 30; return jalCal(jy).leap===0?30:29 }
function JalaliPicker({value, onChange}:{value:string; onChange:(iso:string)=>void}){
  const init=(()=>{
    const d=value?new Date(value):new Date()
    const j=toJalaali(d.getFullYear(),d.getMonth()+1,d.getDate())
    return {jy:j.jy, jm:j.jm, jd:j.jd, hh:d.getHours(), mi:d.getMinutes()}
  })()
  const [jy,setJy]=useState(init.jy); const [jm,setJm]=useState(init.jm); const [jd,setJd]=useState(init.jd)
  const [hh,setHh]=useState(init.hh); const [mi,setMi]=useState(init.mi)
  const maxD=jDaysInMonth(jy,jm)
  useEffect(()=>{ if(jd>maxD) setJd(maxD) },[jy,jm])
  useEffect(()=>{
    const d=value?new Date(value):new Date()
    const j=toJalaali(d.getFullYear(),d.getMonth()+1,d.getDate())
    setJy(j.jy); setJm(j.jm); setJd(j.jd); setHh(d.getHours()); setMi(d.getMinutes())
  },[value])
  useEffect(()=>{
    const [gy,gm,gd]=toGregorian(jy,jm,jd)
    const d=new Date(gy,gm-1,gd,hh,mi,0,0)
    onChange(d.toISOString())
  },[jy,jm,jd,hh,mi])
  // jalali display for selected
  const jLabel=`${jd.toLocaleString('fa-IR')} ${J_MONTHS[jm-1]} ${jy.toLocaleString('fa-IR')} — ${String(hh).padStart(2,'0')}:${String(mi).padStart(2,'0')}`
  return (
    <div style={{background:'#0d1730',border:'1px solid rgba(255,255,255,.08)',borderRadius:12,padding:12}}>
      <div style={{fontSize:12,fontWeight:800,color:'#cbd5e1',marginBottom:8}}>تاریخ شروع — شمسی</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
        <select className="input" value={jd} onChange={e=>setJd(Number(e.target.value))}>{Array.from({length:maxD},(_,i)=>i+1).map(d=><option key={d} value={d}>{d.toLocaleString('fa-IR')}</option>)}</select>
        <select className="input" value={jm} onChange={e=>setJm(Number(e.target.value))}>{J_MONTHS.map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}</select>
        <select className="input" value={jy} onChange={e=>setJy(Number(e.target.value))}>{[1403,1404,1405,1406,1407].map(y=><option key={y} value={y}>{y.toLocaleString('fa-IR')}</option>)}</select>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:8}}>
        <select className="input" value={mi} onChange={e=>setMi(Number(e.target.value))}>{Array.from({length:60},(_,i)=>i).map(m=><option key={m} value={m}>{String(m).padStart(2,'0')}</option>)}</select>
        <select className="input" value={hh} onChange={e=>setHh(Number(e.target.value))}>{Array.from({length:24},(_,i)=>i).map(h=><option key={h} value={h}>{String(h).padStart(2,'0')} ساعت</option>)}</select>
      </div>
      <div style={{fontSize:11,color:'#94a3b8',marginTop:8,textAlign:'center'}}>{jLabel}</div>
    </div>
  )
}

export default function Admin(){
  const [users,setUsers]=useState<Profile[]>([])
  const [matches,setMatches]=useState<Match[]>([])
  const [exposure,setExposure]=useState<Exposure>({})
  const [house,setHouse]=useState<{byMatch:Record<string,{total:number,paid:number,profit:number,count:number}>, totalProfit:number, totalStakes:number, totalPaid:number}>({byMatch:{},totalProfit:0,totalStakes:0,totalPaid:0})
  const [userStats,setUserStats]=useState<Record<string,{count:number,total:number}>>({})
  const [games,setGames]=useState<{name:string,icon:string}[]>([])
  const [siteFont,setSiteFont]=useState(()=> localStorage.getItem('site_font') || 'vazir')
  const [msg,setMsg]=useState<string|null>(null)
  const [chargeUser,setChargeUser]=useState('')
  const [chargeAmount,setChargeAmount]=useState('100000')
  const [form,setForm]=useState({ title:'', game:'FC 25', team_a:'', team_b:'', odds_a:'1.90', odds_b:'1.90', odds_draw:'', starts_at:new Date().toISOString(), odds_mode:'auto' as 'manual'|'auto', margin:'5' })
  const [matchTab,setMatchTab]=useState<'upcoming'|'history'>('upcoming')
  const [tab,setTab]=useState<'dash'|'matches'|'users'|'charge'>('dash')
  // two-way odds ↔ margin (auto mode, no dep)
  const calcMarginPct = (aStr:string,bStr:string,dStr:string)=>{
    const a=parseFloat(aStr), b=parseFloat(bStr), d=dStr?parseFloat(dStr):NaN
    let s=0; if(a>1) s+=1/a; if(b>1) s+=1/b; if(!isNaN(d) && d>1) s+=1/d
    return s>0 ? (s-1)*100 : 0
  }
  const handleOddsChange = (field:'odds_a'|'odds_b'|'odds_draw', val:string)=>{
    const next:any={...form, [field]:val}
    if(form.odds_mode==='auto'){
      const m=calcMarginPct(field==='odds_a'?val:next.odds_a, field==='odds_b'?val:next.odds_b, field==='odds_draw'?val:next.odds_draw)
      // only overwrite margin when odds are parseable
      const hasA=parseFloat(field==='odds_a'?val:next.odds_a)>1, hasB=parseFloat(field==='odds_b'?val:next.odds_b)>1
      if(hasA && hasB) next.margin = m.toFixed(2).replace(/\.00$/,'')
    }
    setForm(next)
  }
  const handleMarginChange = (val:string)=>{
    const num=parseFloat(val)
    if(val==='' || isNaN(num)){ setForm({...form, margin:val}); return }
    const clamped=Math.max(0,Math.min(30,num))
    if(form.odds_mode==='auto'){
      const a=parseFloat(form.odds_a), b=parseFloat(form.odds_b), d=parseFloat(form.odds_draw)
      if(a>1 && b>1){
        const oldM=calcMarginPct(form.odds_a, form.odds_b, form.odds_draw)
        const sumOld=1+oldM/100, sumNew=1+clamped/100
        if(sumOld>0){
          const f=sumNew/sumOld
          const na=(a/f).toFixed(2), nb=(b/f).toFixed(2)
          let nd=form.odds_draw
          if(!isNaN(d) && d>1) nd=(d/f).toFixed(2)
          setForm({...form, margin:val, odds_a:na, odds_b:nb, odds_draw:nd})
          return
        }
      }
    }
    setForm({...form, margin:val})
  }

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
    // userStats aggregated
    const { data: allBets } = await supabase.from('bets').select('user_id,amount')
    const stats: Record<string,{count:number,total:number}>={}
    for(const b of (allBets as any[]||[])){
      if(!stats[b.user_id]) stats[b.user_id]={count:0,total:0}
      stats[b.user_id].count+=1
      stats[b.user_id].total+=Number(b.amount)
    }
    setUserStats(stats)
    // games from site_settings
    try{
      const { data: st } = await supabase.from('site_settings').select('games').eq('id',1).single() as any
      if(st?.games && Array.isArray(st.games)) setGames(st.games)
      const f = localStorage.getItem('site_font')
      if(f) setSiteFont(f)
    }catch{}
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
  const charge = doCharge

  const createMatch = async(e:React.FormEvent)=>{
    e.preventDefault(); setMsg(null)
    const mgn = Math.max(0, Math.min(30, Number(form.margin)||5))/100
    const payload:any = {
      title: form.title, game: form.game, team_a: form.team_a, team_b: form.team_b,
      odds_a: Number(form.odds_a), odds_b: Number(form.odds_b),
      odds_draw: form.odds_draw ? Number(form.odds_draw) : null,
      odds_mode: form.odds_mode, margin: mgn,
      status: 'upcoming', starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : new Date().toISOString()
    }
    const { error } = await supabase.from('matches').insert(payload)
    if(error) setMsg(error.message); else { setMsg('✅ مسابقه ساخته شد ('+(form.odds_mode==='auto'?'سیستمی':'دستی')+')'); setForm({ title:'', game:'FC 25', team_a:'', team_b:'', odds_a:'1.90', odds_b:'1.90', odds_draw:'', starts_at:new Date().toISOString(), odds_mode:'auto', margin:'5' }); load() }
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

  const applySiteFont = (v:string)=>{
    setSiteFont(v)
    localStorage.setItem('site_font', v)
    window.dispatchEvent(new CustomEvent('site-font', { detail: v }))
  }
  const handleFontChange = async(e: React.ChangeEvent<HTMLSelectElement>)=>{
    applySiteFont(e.target.value)
    setMsg('✅ فونت به '+e.target.value+' تغییر کرد')
  }

  const filteredMatches = matches.filter(m=> matchTab==='upcoming' ? m.status==='upcoming' : m.status!=='upcoming')

  return (
    <div className="container" style={{padding:'20px 14px 28px'}}>
      <h2 style={{fontWeight:900,fontSize:22}}>پنل ادمین</h2>
      <div style={{display:'flex',gap:8,marginTop:10,flexWrap:'wrap',alignItems:'center'}}>
        <Link to="/admin/withdrawals" className="btn btn-primary btn-sm">💸 مدیریت برداشت‌ها</Link>
        <Link to="/admin/house" className="btn btn-ghost btn-sm">🏦 سود خانه</Link>
        <Link to="/admin/settings" className="btn btn-ghost btn-sm">⚙️ تنظیمات سایت</Link>
        <Link to="/admin/design" className="btn btn-ghost btn-sm" style={{borderColor:"#8b5cf6", color:"#a78bfa"}}>🎨 طراحی سایت</Link>
        <select value={siteFont} onChange={handleFontChange} className="input" style={{width:'auto',padding:'6px 10px',fontSize:12}}>
          {FONT_OPTS.map(o=> <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      {msg && <div style={{marginTop:10,background:'rgba(0,229,160,.12)',border:'1px solid rgba(0,229,160,.3)',padding:'10px 12px',borderRadius:12,fontSize:13,wordBreak:'break-word'}}>{msg}</div>}

      {/* tabs */}
      <div style={{display:'flex',gap:6,marginTop:14,borderBottom:'1px solid var(--line)',paddingBottom:8}}>
        {(['dash','matches','users','charge'] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)} className={tab===t ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}>
            {t==='dash' ? '📊 داشبورد' : t==='matches' ? '🎮 مسابقات' : t==='users' ? '👥 کاربران' : '💳 شارژ'}
          </button>
        ))}
      </div>

      {tab==='dash' && (
        <>
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
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginTop:12}}>
            <div className="card" style={{padding:14,textAlign:'center'}}><div style={{fontSize:12,color:'var(--muted)'}}>کاربران</div><div style={{fontWeight:900,fontSize:20}}>{users.length}</div></div>
            <div className="card" style={{padding:14,textAlign:'center'}}><div style={{fontSize:12,color:'var(--muted)'}}>مسابقات</div><div style={{fontWeight:900,fontSize:20}}>{matches.length}</div></div>
            <div className="card" style={{padding:14,textAlign:'center'}}><div style={{fontSize:12,color:'var(--muted)'}}>در انتظار تسویه</div><div style={{fontWeight:900,fontSize:20}}>{matches.filter(m=>m.status==='upcoming').length}</div></div>
          </div>
          <div className="card" style={{marginTop:12,padding:14}}>
            <h3 style={{fontWeight:800,marginBottom:8}}>آخرین مسابقات</h3>
            <div style={{display:'grid',gap:8}}>
              {matches.slice(0,5).map(m=>(
                <div key={m.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'rgba(255,255,255,.04)',padding:'8px 10px',borderRadius:10,fontSize:13}}>
                  <span>{m.title} — {m.team_a} vs {m.team_b}</span><span className={'status status-'+m.status}>{m.status}</span>
                </div>
              ))}
              {matches.length===0 && <div style={{color:'var(--muted)',fontSize:12}}>مسابقه‌ای نیست</div>}
            </div>
          </div>
        </>
      )}

      {tab==='matches' && (
        <>
          <div style={{display:'flex',gap:8,marginTop:14}}>
            <button onClick={()=>setMatchTab('upcoming')} className={matchTab==='upcoming'?'btn btn-primary btn-sm':'btn btn-ghost btn-sm'}>پیش‌رو</button>
            <button onClick={()=>setMatchTab('history')} className={matchTab==='history'?'btn btn-primary btn-sm':'btn btn-ghost btn-sm'}>تاریخچه</button>
          </div>
          <datalist id="admin-games">
            {games.map((g,i)=> <option key={i} value={g.name} />)}
            <option value="FC 25" /><option value="Valorant" /><option value="CS2" />
          </datalist>
          <div className="card" style={{marginTop:12,padding:14}}>
            <h3 style={{fontWeight:800,marginBottom:10,fontSize:15}}>ساخت مسابقه جدید</h3>
            <form onSubmit={createMatch} style={{display:'grid',gap:10}}>
              <input className="input" placeholder="عنوان — مثلا فینال جمعه" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} required/>
              <input className="input" list="admin-games" placeholder="بازی" value={form.game} onChange={e=>setForm({...form,game:e.target.value})} required/>
              <JalaliPicker value={form.starts_at} onChange={v=>setForm({...form,starts_at:v})} />
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                <input className="input" placeholder="تیم A" value={form.team_a} onChange={e=>setForm({...form,team_a:e.target.value})} required/>
                <input className="input" placeholder="تیم B" value={form.team_b} onChange={e=>setForm({...form,team_b:e.target.value})} required/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
                <input className="input" placeholder="ضریب A" value={form.odds_a} onChange={e=>handleOddsChange('odds_a',e.target.value)} dir="ltr"/>
                <input className="input" placeholder="ضریب B" value={form.odds_b} onChange={e=>handleOddsChange('odds_b',e.target.value)} dir="ltr"/>
                <input className="input" placeholder="مساوی (اختیاری)" value={form.odds_draw} onChange={e=>handleOddsChange('odds_draw',e.target.value)} dir="ltr"/>
              </div>
              <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                <select value={form.odds_mode} onChange={e=>{
                  const v=e.target.value as any
                  if(v==='manual'){ setForm({...form, odds_mode:v}); return }
                  // switching to auto: recompute margin from current odds
                  const m=calcMarginPct(form.odds_a, form.odds_b, form.odds_draw)
                  setForm({...form, odds_mode:v, margin: m ? m.toFixed(2).replace(/\.00$/,'') : form.margin})
                }} className="input" style={{width:'auto'}}>
                  <option value="auto">⚙️ سیستمی</option><option value="manual">✋ دستی</option>
                </select>
                <input className="input" style={{width:92}} placeholder="مارجین %" value={form.margin} onChange={e=>handleMarginChange(e.target.value)} dir="ltr"/>
                {form.odds_mode==='auto' && <span style={{fontSize:11,color:'#94a3b8',fontWeight:600}}>سود خانه {calcMarginPct(form.odds_a,form.odds_b,form.odds_draw).toFixed(2).replace(/\.00$/,'')}%</span>}
                <button type="submit" className="btn btn-primary btn-sm" style={{marginRight:'auto'}}>ساخت مسابقه</button>
              </div>
            </form>
          </div>
          <div style={{display:'grid',gap:12,marginTop:12}}>
            {filteredMatches.length===0 ? <div style={{color:'var(--muted)',fontSize:13}}>مسابقه‌ای نیست</div> : filteredMatches.map(m=>{
              const exp = exposure[m.id]
              const hasBets = !!(exp && exp.total>0)
              const pA = hasBets ? exp.total - exp.a.pay : 0
              const pB = hasBets ? exp.total - exp.b.pay : 0
              const pD = hasBets ? exp.total - exp.d.pay : 0
              const worst = hasBets ? Math.min(pA, pB, m.odds_draw!=null ? pD : Infinity) : 0
              const fmt = (n:number)=> (n>=0?'+':'')+n.toLocaleString('fa-IR')+' ت'
              const pnlColor = (n:number)=> n>=0 ? '#22c55e' : '#ff6b7a'
              const pnlBg = (n:number)=> n>=0 ? 'rgba(34,197,94,.10)' : 'rgba(255,60,90,.10)'
              const pnlBd = (n:number)=> n>=0 ? 'rgba(34,197,94,.28)' : 'rgba(255,60,90,.28)'
              return (
                <div key={m.id} className="card" style={{padding:16, display:'flex', flexDirection:'column', gap:12, borderColor: hasBets && worst<0 ? 'rgba(255,60,90,.22)' : 'var(--line)'}}>
                  {/* header — title + meta */}
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10, flexWrap:'wrap'}}>
                    <div style={{minWidth:0, flex:1}}>
                      <div style={{fontWeight:900, fontSize:15, color:'#f1f5f9', lineHeight:1.3}}>{m.title}</div>
                      <div style={{fontSize:13, color:'#cbd5e1', marginTop:4, fontWeight:600}}>{m.game} · {m.team_a} <span style={{color:'#94a3b8'}}>vs</span> {m.team_b}</div>
                      <div style={{fontSize:12, color:'#94a3b8', marginTop:2}}>{new Date(m.starts_at).toLocaleString('fa-IR')} · ضرایب <b style={{color:'#e2e8f0'}}>{Number(m.odds_a).toFixed(2)}</b> / <b style={{color:'#e2e8f0'}}>{Number(m.odds_b).toFixed(2)}</b>{m.odds_draw!=null ? <> / <b style={{color:'#e2e8f0'}}>{Number(m.odds_draw).toFixed(2)}</b></> : null} · <span className="badge" style={{fontSize:10, padding:'2px 8px', verticalAlign:'middle'}}>{m.odds_mode==='auto' ? '⚙️ سیستمی' : '✋ دستی'}</span></div>
                    </div>
                    <span className={'status status-'+m.status} style={{fontSize:12, padding:'4px 10px', flexShrink:0}}>{m.status==='upcoming'?'پیش‌رو':m.status==='live'?'زنده':'پایان‌یافته'}</span>
                  </div>

                  {/* exposure summary */}
                  <div style={{display:'flex', gap:8, flexWrap:'wrap', fontSize:12, color:'#94a3b8', background:'#0d1730', border:'1px solid rgba(255,255,255,.06)', borderRadius:10, padding:'8px 10px'}}>
                    {hasBets ? <>
                      <span>کل شرط: <b style={{color:'#e2e8f0'}}>{exp.total.toLocaleString('fa-IR')} ت</b></span>
                      <span style={{opacity:.35}}>•</span>
                      <span>روی {m.team_a}: <b style={{color:'#e2e8f0'}}>{exp.a.amt.toLocaleString('fa-IR')} ت</b> <span style={{fontSize:10}}>→ پرداخت {(exp.a.pay).toLocaleString('fa-IR')} ت</span></span>
                      <span style={{opacity:.35}}>•</span>
                      <span>روی {m.team_b}: <b style={{color:'#e2e8f0'}}>{exp.b.amt.toLocaleString('fa-IR')} ت</b> <span style={{fontSize:10}}>→ پرداخت {(exp.b.pay).toLocaleString('fa-IR')} ت</span></span>
                      {m.odds_draw!=null && exp.d.amt>0 && <><span style={{opacity:.35}}>•</span><span>مساوی: <b style={{color:'#e2e8f0'}}>{exp.d.amt.toLocaleString('fa-IR')} ت</b></span></>}
                    </> : <span style={{color:'#64748b'}}>هنوز شرطی ثبت نشده — سود/ضرر پس از اولین شرط محاسبه می‌شود</span>}
                  </div>

                  {/* smart P&L — what house makes if each outcome wins */}
                  {hasBets ? (
                    <div style={{display:'grid', gridTemplateColumns: m.odds_draw!=null ? '1fr 1fr 1fr' : '1fr 1fr', gap:8}}>
                      <div style={{background: pnlBg(pA), border:`1px solid ${pnlBd(pA)}`, borderRadius:12, padding:'10px 10px', textAlign:'center'}}>
                        <div style={{fontSize:11, color:'#94a3b8', fontWeight:700}}>اگر {m.team_a} ببرد</div>
                        <div style={{fontWeight:900, fontSize:14, marginTop:4, color: pnlColor(pA), letterSpacing:'-.02em'}}>{fmt(pA)}</div>
                        <div style={{fontSize:10, color: pA>=0 ? '#86efac' : '#fda4af', marginTop:2, fontWeight:600}}>{pA>=0 ? 'سود خانه' : 'ضرر خانه'} · پرداخت {exp.a.pay.toLocaleString('fa-IR')} ت</div>
                      </div>
                      <div style={{background: pnlBg(pB), border:`1px solid ${pnlBd(pB)}`, borderRadius:12, padding:'10px 10px', textAlign:'center'}}>
                        <div style={{fontSize:11, color:'#94a3b8', fontWeight:700}}>اگر {m.team_b} ببرد</div>
                        <div style={{fontWeight:900, fontSize:14, marginTop:4, color: pnlColor(pB), letterSpacing:'-.02em'}}>{fmt(pB)}</div>
                        <div style={{fontSize:10, color: pB>=0 ? '#86efac' : '#fda4af', marginTop:2, fontWeight:600}}>{pB>=0 ? 'سود خانه' : 'ضرر خانه'} · پرداخت {exp.b.pay.toLocaleString('fa-IR')} ت</div>
                      </div>
                      {m.odds_draw!=null && (
                        <div style={{background: pnlBg(pD), border:`1px solid ${pnlBd(pD)}`, borderRadius:12, padding:'10px 10px', textAlign:'center'}}>
                          <div style={{fontSize:11, color:'#94a3b8', fontWeight:700}}>اگر مساوی شود</div>
                          <div style={{fontWeight:900, fontSize:14, marginTop:4, color: pnlColor(pD), letterSpacing:'-.02em'}}>{fmt(pD)}</div>
                          <div style={{fontSize:10, color: pD>=0 ? '#86efac' : '#fda4af', marginTop:2, fontWeight:600}}>{pD>=0 ? 'سود خانه' : 'ضرر خانه'} · پرداخت {exp.d.pay.toLocaleString('fa-IR')} ت</div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{fontSize:11, color:'#64748b', textAlign:'center', background:'rgba(255,255,255,.03)', border:'1px dashed var(--line)', borderRadius:10, padding:'10px'}}>بدون شرط — هر نتیجه‌ای سود ۰ است</div>
                  )}
                  {hasBets && worst<0 && <div style={{fontSize:11, color:'#fda4af', background:'rgba(255,60,90,.08)', border:'1px solid rgba(255,60,90,.18)', borderRadius:8, padding:'6px 10px', textAlign:'center'}}>⚠️ ریسک: بدترین حالت <b>{fmt(worst)}</b> — ضرایب را بازبینی کن یا زودتر تسویه کن</div>}

                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    <button className="btn btn-ghost btn-sm" onClick={()=>setLive(m.id)}>زنده کن</button>
                    <button className="btn btn-ghost btn-sm" onClick={()=>toggleMode(m)}>{m.odds_mode==='auto'?'دستی کن':'سیستمی کن'}</button>
                    <button className="btn btn-ghost btn-sm" onClick={()=>recalc(m.id)}>بازمحاسبه</button>
                    <button className="btn btn-ghost btn-sm" style={{borderColor: pA>=0?'rgba(34,197,94,.3)':undefined, color: pA>=0 ? '#22c55e' : undefined}} onClick={()=>settle(m.id,'team_a')}>برد {m.team_a.slice(0,12)} {hasBets ? `(${fmt(pA)})` : ''}</button>
                    <button className="btn btn-ghost btn-sm" style={{borderColor: pB>=0?'rgba(34,197,94,.3)':undefined, color: pB>=0 ? '#22c55e' : undefined}} onClick={()=>settle(m.id,'team_b')}>برد {m.team_b.slice(0,12)} {hasBets ? `(${fmt(pB)})` : ''}</button>
                    {m.odds_draw!=null && <button className="btn btn-ghost btn-sm" onClick={()=>settle(m.id,'draw')}>مساوی {hasBets ? `(${fmt(pD)})` : ''}</button>}
                    <button className="btn btn-ghost btn-sm" style={{color:'#ff6b7a', marginRight:'auto'}} onClick={()=>removeMatch(m.id)}>حذف</button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {tab==='users' && (
        <div className="card" style={{marginTop:14,padding:14}}>
          <h3 style={{fontWeight:800,marginBottom:10}}>کاربران ({users.length})</h3>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>نام کاربری</th><th>موجودی</th><th>شرط‌ها</th><th>شناسه</th><th></th></tr></thead>
              <tbody>
                {users.map(u=>{
                  const st = userStats[u.id]
                  return (
                    <tr key={u.id}>
                      <td>{u.username || '—'} {u.is_admin ? '👑' : ''}</td>
                      <td>{Number(u.balance).toLocaleString('fa-IR')} ت</td>
                      <td>{st ? st.count+' / '+st.total.toLocaleString('fa-IR')+' ت' : '—'}</td>
                      <td dir="ltr" style={{fontSize:11,fontFamily:'monospace'}}>{u.id.slice(0,8)}…</td>
                      <td><button className="btn btn-ghost btn-sm" onClick={()=>{navigator.clipboard.writeText(u.id); setMsg('✅ کپی شد: '+u.id)}}>کپی ID</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {users.length===0 && <div style={{color:'var(--muted)',fontSize:12,marginTop:8}}>کاربری یافت نشد</div>}
        </div>
      )}

      {tab==='charge' && (
        <div className="card" style={{marginTop:14,padding:14}}>
          <h3 style={{fontWeight:800,marginBottom:10,fontSize:15}}>شارژ کیف پول (تومان)</h3>
          <div style={{display:'grid',gap:10}}>
            <input className="input" placeholder="UUID یا username کاربر" value={chargeUser} onChange={e=>setChargeUser(e.target.value)} dir="ltr"/>
            <input className="input" placeholder="مبلغ تومان — مثلا 100000" value={chargeAmount} onChange={e=>setChargeAmount(e.target.value)} dir="ltr" inputMode="numeric"/>
            <button className="btn btn-primary" onClick={charge}>شارژ دستی</button>
            <div style={{fontSize:11,color:'var(--muted)'}}>از جدول کاربران یک username را کپی کنید یا UUID کامل را وارد کنید.</div>
          </div>
          <div style={{marginTop:12,display:'flex',gap:8,flexWrap:'wrap'}}>
            <Link to="/admin/settings" className="btn btn-ghost btn-sm">رفتن به تنظیمات سایت →</Link>
            <Link to="/admin/design" className="btn btn-ghost btn-sm">🎨 مدیریت طراحی سایت →</Link>
          </div>
        </div>
      )}
    </div>
  )
}
