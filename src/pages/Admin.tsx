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
  let jy:number, jm:number, jd:number
  if(nums.length===3 && nums[0]>1000){ jy=nums[0]; jm=nums[1]; jd=nums[2] }
  else { jm=nums[0]||0; jd=nums[1]||0; jy=nums[2]||0 }
  return {jy,jm,jd}
}
function toGregorian(jy:number,jm:number,jd:number){
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

/* ---------- styles ---------- */
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 800, color: 'var(--muted)', letterSpacing: '.02em'
}
const sectionBoxStyle: React.CSSProperties = {
  display: 'grid', gap: 8
}
const Chip = ({ children, tone }: { children: React.ReactNode; tone?: 'primary' | 'default' }) => (
  <span style={{
    padding: '4px 10px', borderRadius: 999,
    background: tone === 'primary' ? 'rgba(109,94,252,.12)' : 'var(--surface2)',
    border: `1px solid ${tone === 'primary' ? 'rgba(109,94,252,.35)' : 'var(--line)'}`,
    color: tone === 'primary' ? 'var(--primary, #6d5efc)' : 'inherit',
    fontSize: 11, fontWeight: 800, direction: tone === 'primary' ? 'ltr' : 'rtl'
  }}>{children}</span>
)
const MarginBadge = ({ value }: { value: number }) => {
  const v = Number(value) || 0
  const color = v <= 5 ? '#22c55e' : v <= 12 ? '#f59e0b' : '#ef4444'
  return (
    <span style={{
      fontSize: 11, fontWeight: 900, padding: '4px 10px', borderRadius: 999,
      background: `${color}22`, border: `1px solid ${color}66`, color
    }}>
      سود خانه {v.toFixed(2).replace(/\.00$/, '')}%
    </span>
  )
}

/* ---------- JalaliPicker ---------- */
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
  const jLabel=`${jd.toLocaleString('fa-IR')} ${J_MONTHS[jm-1]} ${jy.toLocaleString('fa-IR')} — ${String(hh).padStart(2,'0')}:${String(mi).padStart(2,'0')}`
  const isPast = new Date(toGregorian(jy,jm,jd).join('/')).getTime() < Date.now() - 86400000
  return (
    <div style={{
      padding:14, borderRadius:16,
      background:'linear-gradient(180deg, var(--surface2), transparent)',
      border:'1px solid var(--line)', display:'grid', gap:10
    }}>
      <div style={{display:'flex', alignItems:'center', gap:8}}>
        <span style={{
          width:26, height:26, borderRadius:9, display:'grid', placeItems:'center',
          background:'var(--surface)', border:'1px solid var(--line)', fontSize:12
        }}>📅</span>
        <span style={labelStyle}>زمان شروع — شمسی</span>
        {isPast && <span style={{fontSize:10, color:'#f59e0b', fontWeight:800, marginInlineStart:'auto'}}>گذشته</span>}
      </div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1.4fr 1fr', gap:8}}>
        <select className="input" value={jd} onChange={e=>setJd(Number(e.target.value))}>
          {Array.from({length:maxD},(_,i)=>i+1).map(d=><option key={d} value={d}>{d.toLocaleString('fa-IR')}</option>)}
        </select>
        <select className="input" value={jm} onChange={e=>setJm(Number(e.target.value))}>
          {J_MONTHS.map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <select className="input" value={jy} onChange={e=>setJy(Number(e.target.value))}>
          {[1403,1404,1405,1406,1407].map(y=><option key={y} value={y}>{y.toLocaleString('fa-IR')}</option>)}
        </select>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
        <select className="input" value={hh} onChange={e=>setHh(Number(e.target.value))}>
          {Array.from({length:24},(_,i)=>i).map(h=><option key={h} value={h}>{String(h).padStart(2,'0')} ساعت</option>)}
        </select>
        <select className="input" value={mi} onChange={e=>setMi(Number(e.target.value))}>
          {Array.from({length:60},(_,i)=>i).map(m=><option key={m} value={m}>{String(m).padStart(2,'0')} دقیقه</option>)}
        </select>
      </div>
      <div style={{
        fontSize:11, color:'var(--muted)', textAlign:'center',
        padding:'6px 8px', borderRadius:10, background:'var(--surface)', border:'1px solid var(--line)'
      }}>{jLabel}</div>
    </div>
  )
}

/* ---------- Admin ---------- */
export default function Admin(){
  const [users,setUsers]=useState<Profile[]>([])
  const [userQuery,setUserQuery]=useState('')
  const [matches,setMatches]=useState<Match[]>([])
  const [exposure,setExposure]=useState<Exposure>({})
  const [house,setHouse]=useState<{byMatch:Record<string,{total:number,paid:number,profit:number,count:number}>, totalProfit:number, totalStakes:number, totalPaid:number}>({byMatch:{},totalProfit:0,totalStakes:0,totalPaid:0})
  const [userStats,setUserStats]=useState<Record<string,{count:number,total:number}>>({})
  const [games,setGames]=useState<{name:string,icon:string}[]>([])
  const [siteFont,setSiteFont]=useState(()=> localStorage.getItem('site_font') || 'vazir')
  const [msg,setMsg]=useState<string|null>(null)
  const [chargeUser,setChargeUser]=useState('')
  const [chargeAmount,setChargeAmount]=useState('100000')
  const [resetId,setResetId]=useState<string|null>(null)
  const [resetPw,setResetPw]=useState('')
  const [form,setForm]=useState({
    title:'', game:'FC 25', team_a:'', team_b:'',
    odds_a:'1.90', odds_b:'1.90', odds_draw:'',
    starts_at:new Date().toISOString(),
    odds_mode:'auto' as 'manual'|'auto', margin:'5',
    min_bet:'', max_bet:'', description:''
  })
  const [matchTab,setMatchTab]=useState<'upcoming'|'history'>('upcoming')
  const [tab,setTab]=useState<'dash'|'matches'|'users'|'charge'>('dash')
  const [showAdvanced,setShowAdvanced]=useState(false)
  const [showCreate,setShowCreate]=useState(false)

  const calcMarginPct = (aStr:string,bStr:string,dStr:string)=>{
    const a=parseFloat(aStr), b=parseFloat(bStr), d=dStr?parseFloat(dStr):NaN
    let s=0; if(a>1) s+=1/a; if(b>1) s+=1/b; if(!isNaN(d) && d>1) s+=1/d
    return s>0 ? (s-1)*100 : 0
  }
  const handleOddsChange = (field:'odds_a'|'odds_b'|'odds_draw', val:string)=>{
    const next:any={...form, [field]:val}
    if(form.odds_mode==='auto'){
      const m=calcMarginPct(field==='odds_a'?val:next.odds_a, field==='odds_b'?val:next.odds_b, field==='odds_draw'?val:next.odds_draw)
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
    let ts=0, td=0
    for(const b of (settled as any[]||[])){
      const mid=b.match_id as string
      if(!by[mid]) by[mid]={total:0,paid:0,profit:0,count:0}
      by[mid].total += Number(b.amount)
      by[mid].count += 1
      if(b.status==='won') by[mid].paid += Number(b.potential_payout)
      ts += Number(b.amount)
      if(b.status==='won') td += Number(b.potential_payout)
    }
    for(const k of Object.keys(by)) by[k].profit = by[k].total - by[k].paid
    setHouse({byMatch:by,totalProfit:ts-td,totalStakes:ts,totalPaid:td})
    const { data: allBets } = await supabase.from('bets').select('user_id,amount')
    const stats: Record<string,{count:number,total:number}>={}
    for(const b of (allBets as any[]||[])){
      if(!stats[b.user_id]) stats[b.user_id]={count:0,total:0}
      stats[b.user_id].count+=1
      stats[b.user_id].total+=Number(b.amount)
    }
    setUserStats(stats)
    try{
      const { data: st } = await supabase.from('site_settings').select('games').eq('id',1).single() as any
      if(st?.games && Array.isArray(st.games)) setGames(st.games)
      const f = localStorage.getItem('site_font')
      if(f) setSiteFont(f)
    }catch{}
  }
  useEffect(()=>{ load() },[])

  const doReset = async(u:Profile)=>{
    const pw = resetPw.trim()
    if(pw.length<6){ setMsg('رمز باید حداقل ۶ کاراکتر باشد'); return }
    setMsg(null)
    const { error } = await supabase.rpc('admin_reset_password',{ p_user_id: u.id, p_new_password: pw } as any)
    if(error) setMsg('خطا: '+error.message); else { setMsg('✅ رمز '+u.username+' بازنشانی شد'); setResetId(null); setResetPw('') }
  }
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

    // اعتبارسنجی
    const a = parseFloat(form.odds_a), b = parseFloat(form.odds_b)
    const d = form.odds_draw ? parseFloat(form.odds_draw) : NaN
    if(!(a >= 1.01) || !(b >= 1.01)){ setMsg('ضریب‌ها باید ≥ 1.01 باشند'); return }
    if(form.odds_draw && !(d >= 1.01)){ setMsg('ضریب مساوی نامعتبر'); return }
    const mb = form.min_bet ? Number(form.min_bet.replace(/[^0-9]/g,'')) : 0
    const xb = form.max_bet ? Number(form.max_bet.replace(/[^0-9]/g,'')) : 0
    if(mb && xb && mb > xb){ setMsg('حداقل شرط بزرگ‌تر از حداکثر است'); return }

    const mgn = Math.max(0, Math.min(30, Number(form.margin)||5))/100
    const payload:any = {
      title: form.title, game: form.game, team_a: form.team_a, team_b: form.team_b,
      odds_a: a, odds_b: b,
      odds_draw: form.odds_draw ? d : null,
      odds_mode: form.odds_mode, margin: mgn,
      status: 'upcoming',
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : new Date().toISOString(),
      // ⚠️ فقط اگر در دیتابیس داری — وگرنه حذف کن

    }
    const { error } = await supabase.from('matches').insert(payload)
    if(error) setMsg(error.message)
    else {
      setMsg('✅ مسابقه ساخته شد ('+(form.odds_mode==='auto'?'سیستمی':'دستی')+')')
      setShowCreate(false)
      setForm({
        title:'', game:'FC 25', team_a:'', team_b:'',
        odds_a:'1.90', odds_b:'1.90', odds_draw:'',
        starts_at:new Date().toISOString(), odds_mode:'auto', margin:'5',
        min_bet:'', max_bet:'', description:''
      })
      load()
    }
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

  const FALLBACK_ICONS: Record<string,string> = {'FC 25':'⚽','Valorant':'🎯','CS2':'🔫','DOTA 2':'🐉','LoL':'🏆','CoD':'🔫','FIFA':'⚽', default:'🎮'}
  const gameIconOf = (g:string)=> games.find(x=> x.name===g)?.icon || (FALLBACK_ICONS as any)[g] || FALLBACK_ICONS.default
  const filteredMatches = matches.filter(m=> matchTab==='upcoming' ? (m.status==='upcoming' || m.status==='live') : (m.status==='finished' && !!m.winner))
  const upUpcoming = matches.filter(m=> m.status==='upcoming' || m.status==='live').length
  const upFinished = matches.filter(m=> m.status==='finished' && !!m.winner).length

  const previewMargin = calcMarginPct(form.odds_a, form.odds_b, form.odds_draw)
  const aValid = parseFloat(form.odds_a) >= 1.01
  const bValid = parseFloat(form.odds_b) >= 1.01
  const dValid = !form.odds_draw || parseFloat(form.odds_draw) >= 1.01

  return (
    <div style={{padding:'18px 14px 28px', maxWidth:1100, margin:'0 auto'}}>
      {/* header */}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
        <div style={{minWidth:0}}>
          <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
            <span style={{
              width:38,height:38,borderRadius:12,display:'grid',placeItems:'center',
              background:'linear-gradient(135deg, rgba(109,94,252,.18), rgba(176,107,255,.10))',
              border:'1px solid var(--line)',fontSize:16
            }}>◆</span>
            <h2 style={{fontWeight:900,fontSize:18,letterSpacing:'-.02em'}}>داشبورد</h2>
            <span style={{fontSize:11,padding:'4px 10px',borderRadius:999,background:'var(--surface)',border:'1px solid var(--line)',color:'var(--muted)',fontWeight:700}}>
              {matches.length.toLocaleString('fa-IR')} مسابقه · {users.length.toLocaleString('fa-IR')} کاربر
            </span>
          </div>
          <p style={{color:'var(--muted)',fontSize:12,marginTop:6, lineHeight:1.7}}>مدیریت مسابقات، موجودی و تسویه — همه چیز از اینجا.</p>
        </div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
          <Link to="/admin/withdrawals" className="btn btn-ghost btn-sm" style={{borderRadius:999}}>💸 برداشت‌ها</Link>
          <Link to="/admin/house" className="btn btn-ghost btn-sm" style={{borderRadius:999}}>🏦 سود خانه</Link>
          <Link to="/admin/settings" className="btn btn-ghost btn-sm" style={{borderRadius:999}}>⚙️ تنظیمات</Link>
          <Link to="/admin/design" className="btn btn-ghost btn-sm" style={{borderRadius:999, borderColor:'rgba(139,92,246,.25)', color:'#a78bfa'}}>🎨 طراحی</Link>
          <select value={siteFont} onChange={handleFontChange} className="input" style={{width:'auto',padding:'6px 10px',fontSize:12, borderRadius:999}}>
            {FONT_OPTS.map(o=> <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {msg && (
        <div style={{
          marginTop:12,
          background: /^(✅|⚙️|✋)/.test(msg) ? 'rgba(34,197,94,.08)' : 'rgba(255,60,90,.10)',
          border: `1px solid ${/^(✅|⚙️|✋)/.test(msg) ? 'rgba(34,197,94,.22)' : 'rgba(255,60,90,.2)'}`,
          padding:'10px 12px', borderRadius:12, fontSize:13, wordBreak:'break-word',
          color: /^(✅|⚙️|✋)/.test(msg) ? 'var(--text)' : '#fecdd3'
        }}>{msg}</div>
      )}

      {/* pill tabs */}
      <div style={{display:'inline-flex',gap:4,marginTop:14,padding:4,borderRadius:999,background:'var(--surface)',border:'1px solid var(--line)', maxWidth:'100%',overflow:'auto'}}>
        {(['dash','matches','users','charge'] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{
            padding:'7px 14px', borderRadius:999, fontSize:12, fontWeight:800, border:'1px solid transparent', cursor:'pointer', whiteSpace:'nowrap',
            background: tab===t ? 'var(--text)' : 'transparent',
            color: tab===t ? 'var(--bg)' : 'var(--muted)',
            transition:'all .15s'
          }}>
            {t==='dash' ? '📊 داشبورد' : t==='matches' ? '🎮 مسابقات' : t==='users' ? '👥 کاربران' : '💳 شارژ'}
          </button>
        ))}
      </div>

      {tab==='dash' && (
        <>
          <div className="card" style={{
            marginTop:14, padding:16, position:'relative', overflow:'hidden',
            background: house.totalProfit>=0
              ? 'linear-gradient(180deg, rgba(34,197,94,.10), rgba(34,197,94,.03))'
              : 'linear-gradient(180deg, rgba(244,63,94,.10), rgba(244,63,94,.03))',
            borderColor: house.totalProfit>=0?'rgba(34,197,94,.20)':'rgba(244,63,94,.22)'
          }}>
            <div style={{position:'absolute', inset:0, background:'radial-gradient(600px 300px at 85% 0%, rgba(255,255,255,.06), transparent 60%)', pointerEvents:'none'}}/>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,flexWrap:'wrap', position:'relative'}}>
              <div>
                <div style={{fontSize:11, letterSpacing:'.08em', color:'var(--muted)', fontWeight:800}}>سود خانه — تسویه‌شده</div>
                <div style={{display:'flex',gap:8,alignItems:'baseline',marginTop:6,flexWrap:'wrap'}}>
                  <span style={{fontWeight:900,fontSize:22, color: house.totalProfit>=0?'#22c55e':'#f43f5e', letterSpacing:'-.03em'}}>
                    {house.totalProfit>=0?'+':''}{house.totalProfit.toLocaleString('fa-IR')} <span style={{fontSize:12, color:'var(--muted)', fontWeight:700}}>تومان</span>
                  </span>
                  <span style={{
                    fontSize:11, padding:'3px 8px', borderRadius:999,
                    background: house.totalProfit>=0?'rgba(34,197,94,.12)':'rgba(244,63,94,.12)',
                    color:house.totalProfit>=0?'#22c55e':'#f43f5e',
                    border:`1px solid ${house.totalProfit>=0?'rgba(34,197,94,.25)':'rgba(244,63,94,.25)'}`,
                    fontWeight:800
                  }}>{house.totalProfit>=0?'سود':'ضرر'}</span>
                  <span style={{fontSize:11, color:'var(--muted)'}}>· {Object.values(house.byMatch).reduce((s,v)=>s+v.count,0).toLocaleString('fa-IR')} شرط تسویه‌شده</span>
                </div>
                <div style={{fontSize:11,color:'var(--muted)',marginTop:4, lineHeight:1.7}}>فقط مسابقاتی که تسویه شدند حساب می‌شوند.</div>
              </div>
              <div style={{display:'flex',gap:8, flexWrap:'wrap'}}>
                <div style={{minWidth:110, padding:'10px 12px', borderRadius:12, background:'var(--surface)', border:'1px solid var(--line)', textAlign:'center'}}>
                  <div style={{fontSize:10,color:'var(--muted)'}}>کل دریافتی</div>
                  <div style={{fontWeight:900,fontSize:13,marginTop:2}}>{house.totalStakes.toLocaleString('fa-IR')} <span style={{fontSize:10,color:'var(--muted)'}}>ت</span></div>
                </div>
                <div style={{minWidth:110, padding:'10px 12px', borderRadius:12, background:'var(--surface)', border:'1px solid var(--line)', textAlign:'center'}}>
                  <div style={{fontSize:10,color:'var(--muted)'}}>پرداختی</div>
                  <div style={{fontWeight:900,fontSize:13,marginTop:2}}>{house.totalPaid.toLocaleString('fa-IR')} <span style={{fontSize:10,color:'var(--muted)'}}>ت</span></div>
                </div>
              </div>
            </div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginTop:12}}>
            {[
              {k:'کاربران', v:users.length.toLocaleString('fa-IR'), sub:'ثبت‌نام‌کرده', icon:'👥'},
              {k:'مسابقات', v:matches.length.toLocaleString('fa-IR'), sub:`${matches.filter(m=>m.status==='upcoming').length.toLocaleString('fa-IR')} پیش‌رو`, icon:'🎮'},
              {k:'در انتظار تسویه', v:matches.filter(m=>m.status==='upcoming').length.toLocaleString('fa-IR'), sub:'نیاز به اقدام', icon:'⏳'},
            ].map(s=>(
              <div key={s.k} className="card" style={{padding:12, display:'flex',alignItems:'center',gap:10, minHeight:72}}>
                <span style={{width:36,height:36,borderRadius:10,display:'grid',placeItems:'center',background:'var(--surface2)',border:'1px solid var(--line)',fontSize:14, flexShrink:0}}>{s.icon}</span>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:11,color:'var(--muted)',fontWeight:700}}>{s.k}</div>
                  <div style={{fontWeight:900,fontSize:16, lineHeight:1.1, marginTop:2}}>{s.v}</div>
                  <div style={{fontSize:11,color:'var(--muted)',marginTop:2}}>{s.sub}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="card" style={{marginTop:12,padding:14}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,flexWrap:'wrap'}}>
              <h3 style={{fontWeight:800,fontSize:13}}>آخرین مسابقات</h3>
              <button className="btn btn-ghost btn-sm" style={{borderRadius:999}} onClick={()=> setTab('matches')}>مدیریت →</button>
            </div>
            <div style={{display:'grid',gap:8,marginTop:10}}>
              {matches.slice(0,5).map(m=>(
                <div key={m.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10, padding:'10px 12px',borderRadius:10, background:'var(--surface2)', border:'1px solid var(--line)', fontSize:13}}>
                  <span style={{minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                    {m.title} — {m.team_a} vs {m.team_b} <span style={{color:'var(--muted)', fontSize:11}}>· {m.game}</span>
                  </span>
                  <span className={'status status-'+m.status} style={{flexShrink:0, padding:'3px 8px', fontSize:11}}>
                    {m.status==='upcoming'?'پیش‌رو':m.status==='live'?'زنده':'پایان‌یافته'}
                  </span>
                </div>
              ))}
              {matches.length===0 && <div style={{color:'var(--muted)',fontSize:12, textAlign:'center', padding:10}}>مسابقه‌ای نیست</div>}
            </div>
          </div>
        </>
      )}

      {tab==='matches' && (
        <>
          <div style={{display:'inline-flex',gap:4,marginTop:14,padding:4,borderRadius:999,background:'var(--surface)',border:'1px solid var(--line)'}}>
            <button onClick={()=>setMatchTab('upcoming')} style={{padding:'6px 12px',borderRadius:999,fontSize:12,fontWeight:800,border:'1px solid transparent',cursor:'pointer', background: matchTab==='upcoming' ? 'var(--text)' : 'transparent', color: matchTab==='upcoming' ? 'var(--bg)' : 'var(--muted)'}}>پیش‌رو · {upUpcoming.toLocaleString('fa-IR')}</button>
            <button onClick={()=>setMatchTab('history')} style={{padding:'6px 12px',borderRadius:999,fontSize:12,fontWeight:800,border:'1px solid transparent',cursor:'pointer', background: matchTab==='history' ? 'var(--text)' : 'transparent', color: matchTab==='history' ? 'var(--bg)' : 'var(--muted)'}}>تاریخچه · {upFinished.toLocaleString('fa-IR')}</button>
          </div>

          <datalist id="admin-games">
            {games.map((g,i)=> <option key={i} value={g.name} />)}
            <option value="FC 25" /><option value="Valorant" /><option value="CS2" />
          </datalist>

          {/* ---------- CREATE MATCH ---------- */}

          <div style={{display:'flex',justifyContent:'flex-end',marginTop:12}}>
            <button onClick={()=>setShowCreate(true)} className="btn btn-primary" style={{borderRadius:999,padding:'10px 18px',fontWeight:800,background:'linear-gradient(135deg, var(--primary, #6d5efc), #b06bff)',border:'none',boxShadow:'0 10px 24px -12px rgba(109,94,252,.9)'}}>＋ ساخت مسابقهٔ جدید</button>
          </div>
          {showCreate && (
            <div className="modal-overlay" onClick={()=>setShowCreate(false)} style={{position:'fixed',inset:0,zIndex:50,background:'rgba(5,8,18,.72)',backdropFilter:'blur(8px)',WebkitBackdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
              <div className="modal-card" onClick={e=>e.stopPropagation()} style={{width:'min(640px,95vw)',maxHeight:'90dvh',overflowY:'auto',background:'var(--surface)',border:'1px solid var(--line)',borderRadius:20,padding:20,boxShadow:'0 24px 60px rgba(0,0,0,.65)'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,marginBottom:12}}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <div style={{width:34,height:34,borderRadius:12,display:'grid',placeItems:'center',background:'linear-gradient(135deg, var(--primary, #6d5efc), #b06bff)',color:'#fff',fontSize:16}}>🎯</div>
                    <h3 style={{fontWeight:900,margin:0,fontSize:15}}>ساخت مسابقهٔ جدید</h3>
                  </div>
                  <button onClick={()=>setShowCreate(false)} style={{width:32,height:32,borderRadius:999,border:'1px solid var(--line)',background:'var(--surface2)',cursor:'pointer',fontSize:16}}>×</button>
                </div>
            {/* header */}
            <div style={{display:'flex', alignItems:'center', gap:10}}>
              
              <div style={{display:'grid'}}>
                <p style={{color:'var(--muted)', fontSize:11, margin:0}}>ضرایب و مارجین دوطرفه همگام می‌شوند.</p>
              </div>
              <span style={{
                marginInlineStart:'auto', fontSize:10, fontWeight:800,
                padding:'4px 10px', borderRadius:999,
                background:'var(--surface2)', border:'1px solid var(--line)',
                color:'var(--muted)'
              }}>{form.odds_mode === 'auto' ? '⚙️ سیستمی' : '✋ دستی'}</span>
            </div>

            <form onSubmit={createMatch} style={{display:'grid', gap:14}}>
              {/* title + game */}
              <div style={sectionBoxStyle}>
                <label style={labelStyle}>عنوان و بازی</label>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}} className="responsive-2col">
                  <input className="input" placeholder="عنوان — مثلا فینال جمعه" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} required/>
                  <input className="input" list="admin-games" placeholder="بازی" value={form.game} onChange={e=>setForm({...form,game:e.target.value})} required/>
                </div>
              </div>

              {/* time */}
              <div style={sectionBoxStyle}>
                <JalaliPicker value={form.starts_at} onChange={v=>setForm({...form,starts_at:v})} />
              </div>

              {/* teams */}
              <div style={sectionBoxStyle}>
                <label style={labelStyle}>تیم‌ها</label>
                <div style={{display:'grid',gridTemplateColumns:'1fr auto 1fr',gap:10, alignItems:'center'}}>
                  <input className="input" placeholder="تیم A" value={form.team_a} onChange={e=>setForm({...form,team_a:e.target.value})} required/>
                  <span style={{
                    fontSize:11, fontWeight:900, color:'var(--muted)',
                    padding:'4px 8px', borderRadius:999,
                    background:'var(--surface2)', border:'1px solid var(--line)'
                  }}>VS</span>
                  <input className="input" placeholder="تیم B" value={form.team_b} onChange={e=>setForm({...form,team_b:e.target.value})} required/>
                </div>
              </div>

              {/* odds */}
              <div style={sectionBoxStyle}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <label style={labelStyle}>ضرایب</label>
                  {(!aValid || !bValid || !dValid) && (
                    <span style={{fontSize:10,color:'#f43f5e',fontWeight:800}}>هر ضریب باید ≥ 1.01 باشد</span>
                  )}
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}} className="responsive-3col">
                  <input
                    className="input"
                    placeholder="ضریب A"
                    value={form.odds_a}
                    onChange={e=>handleOddsChange('odds_a',e.target.value)}
                    dir="ltr"
                    style={{textAlign:'center', fontWeight:800, borderColor: aValid ? undefined : '#f43f5e'}}
                  />
                  <input
                    className="input"
                    placeholder="ضریب B"
                    value={form.odds_b}
                    onChange={e=>handleOddsChange('odds_b',e.target.value)}
                    dir="ltr"
                    style={{textAlign:'center', fontWeight:800, borderColor: bValid ? undefined : '#f43f5e'}}
                  />
                  <input
                    className="input"
                    placeholder="مساوی (اختیاری)"
                    value={form.odds_draw}
                    onChange={e=>handleOddsChange('odds_draw',e.target.value)}
                    dir="ltr"
                    style={{textAlign:'center', fontWeight:800, borderColor: dValid ? undefined : '#f43f5e'}}
                  />
                </div>
              </div>

              {/* mode + margin */}
              <div style={{
                display:'flex', gap:10, alignItems:'center', flexWrap:'wrap',
                padding:'10px 12px', borderRadius:14,
                background:'var(--surface2)', border:'1px solid var(--line)'
              }}>
                <select
                  value={form.odds_mode}
                  onChange={e=>{
                    const v=e.target.value as any
                    if(v==='manual'){ setForm({...form, odds_mode:v}); return }
                    const m=calcMarginPct(form.odds_a, form.odds_b, form.odds_draw)
                    setForm({...form, odds_mode:v, margin: m ? m.toFixed(2).replace(/\.00$/,'') : form.margin})
                  }}
                  className="input"
                  style={{width:'auto', minWidth:120}}
                >
                  <option value="auto">⚙️ سیستمی</option>
                  <option value="manual">✋ دستی</option>
                </select>

                <input
                  className="input"
                  style={{width:110, textAlign:'center'}}
                  placeholder="مارجین %"
                  value={form.margin}
                  onChange={e=>handleMarginChange(e.target.value)}
                  dir="ltr"
                />

                {form.odds_mode==='auto' && <MarginBadge value={previewMargin} />}

                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  style={{
                    marginInlineStart:'auto', borderRadius:999, padding:'10px 20px',
                    fontWeight:800,
                    background:'linear-gradient(135deg, var(--primary, #6d5efc), #b06bff)',
                    border:'none',
                    boxShadow:'0 10px 24px -12px rgba(109,94,252,.9)'
                  }}
                >＋ ساخت مسابقه</button>
              </div>

              {/* advanced */}
              <button
                type="button"
                onClick={()=>setShowAdvanced(s=>!s)}
                className="btn btn-ghost btn-sm"
                style={{borderRadius:999, justifySelf:'start', fontSize:11}}
              >{showAdvanced ? '▲ بستن تنظیمات پیشرفته' : '▼ تنظیمات پیشرفته (اختیاری)'}</button>

              {showAdvanced && (
                <div style={{
                  display:'grid', gap:12, padding:'12px 14px',
                  borderRadius:14, background:'var(--surface2)',
                  border:'1px dashed var(--line)'
                }}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}} className="responsive-2col">
                    <div style={sectionBoxStyle}>
                      <label style={labelStyle}>حداقل شرط (تومان)</label>
                      <input className="input" placeholder="مثلا 10000" value={form.min_bet} onChange={e=>setForm({...form,min_bet:e.target.value})} dir="ltr" inputMode="numeric"/>
                    </div>
                    <div style={sectionBoxStyle}>
                      <label style={labelStyle}>حداکثر شرط (تومان)</label>
                      <input className="input" placeholder="مثلا 500000" value={form.max_bet} onChange={e=>setForm({...form,max_bet:e.target.value})} dir="ltr" inputMode="numeric"/>
                    </div>
                  </div>
                  <div style={sectionBoxStyle}>
                    <label style={labelStyle}>توضیحات کوتاه</label>
                    <textarea
                      className="input"
                      placeholder="مثلا: نیمه‌نهایی — برنده به فینال می‌رود"
                      value={form.description}
                      onChange={e=>setForm({...form,description:e.target.value})}
                      rows={2}
                      style={{resize:'vertical', fontFamily:'inherit'}}
                    />
                  </div>
                </div>
              )}

              {/* live preview */}
              {(form.team_a || form.team_b) && (
                <div style={{
                  display:'flex', alignItems:'center', gap:10, flexWrap:'wrap',
                  padding:'10px 12px', borderRadius:14,
                  border:'1px dashed var(--line)',
                  fontSize:12
                }}>
                  <span style={{color:'var(--muted)', fontWeight:700}}>پیش‌نمایش:</span>
                  <Chip>{form.team_a || 'تیم A'}</Chip>
                  <span style={{color:'var(--muted)'}}>vs</span>
                  <Chip>{form.team_b || 'تیم B'}</Chip>
                  <div style={{marginInlineStart:'auto', display:'flex', gap:6, flexWrap:'wrap'}}>
                    {aValid && <Chip tone="primary">A {form.odds_a}</Chip>}
                    {bValid && <Chip tone="primary">B {form.odds_b}</Chip>}
                    {form.odds_draw && dValid && <Chip tone="primary">= {form.odds_draw}</Chip>}
                  </div>
                </div>
              )}
            </form>
              </div>
            </div>
          )}
          {/* ---------- /CREATE MATCH ---------- */}

          <div className="bet-grid" style={{marginTop:12}}>
            {filteredMatches.length===0 ? <div className="card" style={{padding:16,textAlign:'center', color:'var(--muted)',fontSize:13}}>مسابقه‌ای نیست</div> : filteredMatches.map(m=>{
              const exp = exposure[m.id]
              const hasBets = !!(exp && exp.total>0)
              const pA = hasBets ? exp.total - exp.a.pay : 0
              const pB = hasBets ? exp.total - exp.b.pay : 0
              const pD = hasBets ? exp.total - exp.d.pay : 0
              const worst = hasBets ? Math.min(pA, pB, m.odds_draw!=null ? pD : Infinity) : 0
              const fmt = (n:number)=> (n>=0?'+':'')+n.toLocaleString('fa-IR')+' ت'
              const teamA = m.team_a.trim(); const teamB = m.team_b.trim()
              const icon = gameIconOf(m.game)
              return (
                <div key={m.id} className="match-card" style={{
                  position:'relative', padding:16, borderRadius:18,
                  background:'linear-gradient(145deg, rgba(255,255,255,.055), rgba(255,255,255,.025))',
                  border: hasBets && worst<0 ? '1px solid rgba(244,63,94,.25)' : '1px solid var(--line)',
                  display:'flex', flexDirection:'column', gap:14, overflow:'hidden'
                }}>
                  <div style={{position:'absolute', top:0, left:24, right:24, height:1, background: m.status==='live' ? 'var(--accent)' : 'rgba(255,255,255,.08)'}}/>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
                    <div style={{display:'flex',alignItems:'center',gap:9,minWidth:0}}>
                      <div style={{width:30,height:30,borderRadius:10,display:'grid',placeItems:'center',background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.06)',fontSize:14,flexShrink:0}}>{icon}</div>
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:800,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{m.title}</div>
                        <div style={{marginTop:2,fontSize:10,color:'var(--muted)'}}>
                          {m.game} · {new Date(m.starts_at).toLocaleString('fa-IR',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})} · <span style={{padding:'1px 6px',borderRadius:999,background:'var(--surface2)',border:'1px solid var(--line)',fontSize:10}}>{m.odds_mode==='auto'?'⚙️ سیستمی':'✋ دستی'}</span>
                        </div>
                      </div>
                    </div>
                    <span className={'status status-'+m.status} style={{fontSize:10,fontWeight:800,padding:'4px 8px',borderRadius:999,flexShrink:0}}>
                      {m.status==='upcoming'?'پیش‌رو':m.status==='live'?'● زنده':'پایان'}
                    </span>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr auto 1fr',alignItems:'center',gap:10,padding:'4px 0'}}>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8,minWidth:0}}>
                      <div style={{width:46,height:46,borderRadius:14,display:'grid',placeItems:'center',background:'linear-gradient(145deg, rgba(40,100,180,.35), rgba(20,40,70,.5))',border:'1px solid rgba(255,255,255,.08)',fontSize:17,fontWeight:900}}>{teamA.charAt(0)||'A'}</div>
                      <div style={{maxWidth:110,textAlign:'center',fontSize:12,fontWeight:800,lineHeight:1.25,wordBreak:'break-word'}}>{teamA}</div>
                      <div style={{fontSize:14,fontWeight:900,color:'var(--accent)'}}>{Number(m.odds_a).toFixed(2)}×</div>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                      <span style={{fontSize:9,fontWeight:900,color:'var(--muted)',letterSpacing:'.08em'}}>VS</span>
                      <div style={{width:1,height:24,background:'var(--line)'}}/>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8,minWidth:0}}>
                      <div style={{width:46,height:46,borderRadius:14,display:'grid',placeItems:'center',background:'linear-gradient(145deg, rgba(170,45,75,.35), rgba(70,20,35,.5))',border:'1px solid rgba(255,255,255,.08)',fontSize:17,fontWeight:900}}>{teamB.charAt(0)||'B'}</div>
                      <div style={{maxWidth:110,textAlign:'center',fontSize:12,fontWeight:800,lineHeight:1.25,wordBreak:'break-word'}}>{teamB}</div>
                      <div style={{fontSize:14,fontWeight:900,color:'var(--accent)'}}>{Number(m.odds_b).toFixed(2)}×</div>
                    </div>
                  </div>
                  {m.odds_draw!=null && <div style={{textAlign:'center',padding:'7px 10px',borderRadius:10,border:'1px solid var(--line)',background:'rgba(255,255,255,.035)',fontSize:11}}>مساوی <span style={{marginRight:6,color:'var(--accent)',fontWeight:900,fontSize:12}}>{Number(m.odds_draw).toFixed(2)}×</span></div>}
                  {m.winner && <div style={{textAlign:'center',padding:'7px 10px',borderRadius:9,background:'rgba(0,229,160,.06)',color:'var(--muted)',fontSize:10}}>برنده: <strong style={{color:'var(--accent)'}}>{m.winner==='team_a'?teamA:m.winner==='team_b'?teamB:'مساوی'}</strong></div>}
                  <div style={{display:'flex',gap:8,flexWrap:'wrap',fontSize:11,color:'var(--muted)',background:'var(--surface2)',border:'1px solid var(--line)',borderRadius:10,padding:'8px 10px'}}>
                    {hasBets ? <>
                      <span>کل: <b style={{color:'var(--text)'}}>{exp.total.toLocaleString('fa-IR')} ت</b></span>
                      <span style={{opacity:.35}}>•</span>
                      <span>{teamA}: <b style={{color:'var(--text)'}}>{exp.a.amt.toLocaleString('fa-IR')} ت</b> → {exp.a.pay.toLocaleString('fa-IR')}</span>
                      <span style={{opacity:.35}}>•</span>
                      <span>{teamB}: <b style={{color:'var(--text)'}}>{exp.b.amt.toLocaleString('fa-IR')} ت</b> → {exp.b.pay.toLocaleString('fa-IR')}</span>
                      {m.odds_draw!=null && exp.d.amt>0 && <><span style={{opacity:.35}}>•</span><span>مساوی: <b style={{color:'var(--text)'}}>{exp.d.amt.toLocaleString('fa-IR')} ت</b></span></>}
                    </> : <span>هنوز شرطی ثبت نشده — P&L پس از اولین شرط</span>}
                  </div>
                  {hasBets ? <div style={{display:'grid',gridTemplateColumns: m.odds_draw!=null ? '1fr 1fr 1fr' : '1fr 1fr',gap:8}}>
                    {[{label:`اگر ${teamA} ببرد`,v:pA,pay:exp.a.pay},{label:`اگر ${teamB} ببرد`,v:pB,pay:exp.b.pay},...(m.odds_draw!=null?[{label:'اگر مساوی',v:pD,pay:exp.d.pay}]:[])].map(b=>(
                      <div key={b.label} style={{background:b.v>=0?'rgba(34,197,94,.08)':'rgba(244,63,94,.08)',border:`1px solid ${b.v>=0?'rgba(34,197,94,.22)':'rgba(244,63,94,.2)'}`,borderRadius:12,padding:'10px 8px',textAlign:'center'}}>
                        <div style={{fontSize:11,color:'var(--muted)',fontWeight:700}}>{b.label}</div>
                        <div style={{fontWeight:900,fontSize:13,marginTop:4,color:b.v>=0?'#22c55e':'#f43f5e'}}>{fmt(b.v)}</div>
                        <div style={{fontSize:10,color:'var(--muted)',marginTop:2}}>پرداخت {b.pay.toLocaleString('fa-IR')} ت</div>
                      </div>
                    ))}
                  </div> : <div style={{fontSize:11,color:'var(--muted)',textAlign:'center',background:'var(--surface2)',border:'1px dashed var(--line)',borderRadius:10,padding:'10px'}}>بدون شرط — هر نتیجه ۰</div>}
                  {hasBets && worst<0 && <div style={{fontSize:11,color:'#fecdd3',background:'rgba(244,63,94,.10)',border:'1px solid rgba(244,63,94,.2)',borderRadius:10,padding:'7px 10px',textAlign:'center'}}>⚠️ بدترین حالت <b>{fmt(worst)}</b></div>}
                  <div style={{display:'flex',gap:6,flexWrap:'wrap',paddingTop:10,borderTop:'1px solid var(--line)'}}>
                    <button className="btn btn-ghost btn-sm" style={{borderRadius:999}} onClick={()=>setLive(m.id)}>زنده کن</button>
                    <button className="btn btn-ghost btn-sm" style={{borderRadius:999}} onClick={()=>toggleMode(m)}>{m.odds_mode==='auto'?'دستی کن':'سیستمی کن'}</button>
                    <button className="btn btn-ghost btn-sm" style={{borderRadius:999}} onClick={()=>recalc(m.id)}>بازمحاسبه</button>
                    <button className="btn btn-ghost btn-sm" style={{borderRadius:999, borderColor:pA>=0?'rgba(34,197,94,.25)':undefined, color:pA>=0?'#22c55e':undefined}} onClick={()=>settle(m.id,'team_a')}>برد {teamA.slice(0,10)} {hasBets?`(${fmt(pA)})`:''}</button>
                    <button className="btn btn-ghost btn-sm" style={{borderRadius:999, borderColor:pB>=0?'rgba(34,197,94,.25)':undefined, color:pB>=0?'#22c55e':undefined}} onClick={()=>settle(m.id,'team_b')}>برد {teamB.slice(0,10)} {hasBets?`(${fmt(pB)})`:''}</button>
                    {m.odds_draw!=null && <button className="btn btn-ghost btn-sm" style={{borderRadius:999}} onClick={()=>settle(m.id,'draw')}>مساوی {hasBets?`(${fmt(pD)})`:''}</button>}
                    <button className="btn btn-ghost btn-sm" style={{color:'#f43f5e',marginInlineStart:'auto',borderRadius:999}} onClick={()=>removeMatch(m.id)}>حذف</button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {tab==='users' && (
        <div className="card" style={{marginTop:14,padding:0, overflow:'hidden'}}>
          <div style={{padding:'12px 14px', display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,flexWrap:'wrap', borderBottom:'1px solid var(--line)'}}>
            <h3 style={{fontWeight:900,fontSize:13}}>کاربران <span style={{fontWeight:700,color:'var(--muted)'}}>· {users.length.toLocaleString('fa-IR')}</span></h3>
            <input className="input" placeholder="جستجو نام / ایمیل…" value={userQuery} onChange={e=>setUserQuery(e.target.value)} style={{maxWidth:200, padding:'6px 10px', fontSize:12, borderRadius:999}} />
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>کاربر</th><th>ایمیل</th><th>موجودی</th><th>شرط‌ها</th><th>شناسه</th><th>عملیات</th></tr></thead>
              <tbody>
                {(userQuery.trim()?users.filter(u=>{const q=userQuery.trim().toLowerCase(); return (u.username||'').toLowerCase().includes(q)||(u.email||'').toLowerCase().includes(q)||(u.display_name||'').toLowerCase().includes(q)}):users).map(u=>{
                  const st = userStats[u.id]
                  return (
                    <tr key={u.id}>
                      <td>
                        <span style={{fontWeight:700}}>{u.username || '—'}</span>{' '}
                        {u.is_admin ? <span style={{fontSize:11, padding:'2px 6px', borderRadius:999, background:'rgba(34,197,94,.12)', border:'1px solid rgba(34,197,94,.2)', color:'#22c55e'}}>ادمین</span> : null}
                      </td>
                      <td dir="ltr" style={{fontSize:11, color:'var(--muted)', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{u.email || '—'}</td>
                      <td style={{fontWeight:800}}>{Number(u.balance).toLocaleString('fa-IR')} <span style={{fontSize:11,color:'var(--muted)'}}>ت</span></td>
                      <td style={{color:'var(--muted)',fontSize:12}}>{st ? `${st.count.toLocaleString('fa-IR')} / ${st.total.toLocaleString('fa-IR')} ت` : '—'}</td>
                      <td dir="ltr" style={{fontSize:11,fontFamily:'var(--site-font)', fontVariantNumeric:'tabular-nums', color:'var(--muted)'}}>{u.id.slice(0,8)}…</td>
                      <td>
                        <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
                          <button className="btn btn-ghost btn-sm" style={{borderRadius:999, padding:'4px 10px'}} onClick={()=>{
                            navigator.clipboard.writeText(u.id)
                            setChargeUser(u.id)
                            setMsg('✅ کپی شد و در فرم شارژ قرار گرفت: '+u.id)
                          }}>کپی</button>
                          <button className="btn btn-ghost btn-sm" style={{borderRadius:999, padding:'4px 10px', color: resetId===u.id ? 'var(--accent)' : undefined}} onClick={()=>{
                            if(resetId===u.id) setResetId(null)
                            else { setResetId(u.id); setResetPw('') }
                          }}>{resetId===u.id ? 'بستن' : '🔑 ریست رمز'}</button>
                        </div>
                        {resetId===u.id && (
                          <div style={{display:'flex',gap:6,marginTop:6,alignItems:'center'}}>
                            <input className="input" placeholder="رمز جدید (≥۶)" value={resetPw} onChange={e=>setResetPw(e.target.value)} type="text" dir="ltr" style={{width:140, padding:'6px 10px', fontSize:12}} />
                            <button className="btn btn-primary btn-sm" style={{borderRadius:999, padding:'6px 12px'}} onClick={()=>doReset(u)}>تایید</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {(() => { const qq=userQuery.trim().toLowerCase(); const fl=qq?users.filter(u=>(u.username||'').toLowerCase().includes(qq)||(u.email||'').toLowerCase().includes(qq)||(u.display_name||'').toLowerCase().includes(qq)):users; if(fl.length===0) return <div style={{color:'var(--muted)',fontSize:12,padding:14, textAlign:'center'}}>{users.length===0?'کاربری یافت نشد':'نتیجه‌ای یافت نشد'}</div>; return null })()}
        </div>
      )}

      {tab==='charge' && (
        <div className="card" style={{marginTop:14,padding:16, maxWidth:560}}>
          <h3 style={{fontWeight:900,fontSize:14}}>شارژ کیف پول</h3>
          <p style={{fontSize:11,color:'var(--muted)',marginTop:4, lineHeight:1.7}}>تومان — username یا UUID کامل. از جدول کاربران کپی کن.</p>
          <div style={{display:'grid',gap:10, marginTop:12}}>
            <input className="input" placeholder="UUID یا username" value={chargeUser} onChange={e=>setChargeUser(e.target.value)} dir="ltr"/>
            <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:8}}>
              <input className="input" placeholder="مبلغ — مثلا 100000" value={chargeAmount} onChange={e=>setChargeAmount(e.target.value)} dir="ltr" inputMode="numeric"/>
              <button className="btn btn-primary" onClick={charge} style={{borderRadius:999, padding:'0 18px', fontWeight:800}}>شارژ</button>
            </div>
          </div>
          <div style={{marginTop:12,display:'flex',gap:6,flexWrap:'wrap'}}>
            <Link to="/admin/settings" className="btn btn-ghost btn-sm" style={{borderRadius:999}}>تنظیمات →</Link>
            <Link to="/admin/design" className="btn btn-ghost btn-sm" style={{borderRadius:999}}>🎨 طراحی →</Link>
          </div>
        </div>
      )}
    </div>
  )
}