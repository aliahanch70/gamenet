import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DESIGNS, DESIGN_IDS, type DesignId } from '../theme/designRegistry'
import { useTheme } from '../contexts/ThemeContext'

function Preview({ id }: { id: DesignId }){
  // minimal — white airy
  if(id==='minimal'){
    return (
      <div style={{background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:14, padding:10, minHeight:110}}>
        <div style={{height:10, background:'#fff', border:'1px solid #e2e8f0', borderRadius:999, marginBottom:8, display:'flex', alignItems:'center', padding:'0 8px', gap:6}}>
          <span style={{width:10,height:10, borderRadius:999, background:'#0ea5e9'}}/> <span style={{fontSize:9, color:'#334155', fontWeight:800}}>GAMEVERSE</span> <span style={{marginInlineStart:'auto', fontSize:8,color:'#94a3b8'}}>بستن</span>
        </div>
        <div style={{background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:8, display:'flex', justifyContent:'space-between', gap:8}}>
          <div><div style={{fontSize:10, fontWeight:800, color:'#0f172a'}}>Esteghlal — Persepolis</div><div style={{fontSize:8,color:'#94a3b8'}}>FC 25 · امروز ۲۰:۳۰</div></div>
          <span style={{fontSize:10, fontWeight:800, color:'#0ea5e9', background:'#e0f2fe', border:'1px solid #bae6fd', padding:'3px 8px', borderRadius:999}}>1.90×</span>
        </div>
      </div>
    )
  }
  if(id==='esports'){
    return (
      <div style={{background:'#080d1c', border:'1px solid rgba(255,255,255,.08)', borderRadius:14, padding:10, minHeight:110}}>
        <div style={{height:10, background:'rgba(255,255,255,.06)', borderRadius:999, marginBottom:8, display:'flex', alignItems:'center', gap:6, padding:'0 8px'}}>
          <span style={{width:8,height:8, background:'#22c55e', borderRadius:2, transform:'rotate(45deg)'}}/> <span style={{fontSize:9,color:'#f1f5f9', fontWeight:900}}>GAMEVERSE</span>
        </div>
        <div style={{background:'#111c33', border:'1px solid rgba(34,197,94,.22)', borderRadius:12, padding:8, display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:6, alignItems:'center'}}>
          <div style={{textAlign:'center'}}><div style={{width:22,height:22,borderRadius:999,background:'linear-gradient(135deg,#1e3a5f,#2a5a9a)',margin:'0 auto'}}/><div style={{fontSize:8,color:'#cbd5e1',marginTop:2}}>Esteghlal</div></div>
          <span style={{fontSize:8,color:'#64748b', background:'rgba(255,255,255,.06)', padding:'3px 6px', borderRadius:999}}>VS</span>
          <div style={{textAlign:'center'}}><div style={{width:22,height:22,borderRadius:999,background:'linear-gradient(135deg,#5a1e2a,#9a2a4a)',margin:'0 auto'}}/><div style={{fontSize:8,color:'#cbd5e1',marginTop:2}}>Persepolis</div></div>
        </div>
      </div>
    )
  }
  if(id==='glass'){
    return (
      <div style={{background:'linear-gradient(135deg,#0b1226 0%,#1a1033 50%,#0d1a2e 100%)', border:'1px solid rgba(255,255,255,.10)', borderRadius:14, padding:10, minHeight:110, backdropFilter:'blur(8px)'}}>
        <div style={{height:10, borderRadius:999, background:'rgba(255,255,255,.10)', border:'1px solid rgba(255,255,255,.14)', backdropFilter:'blur(12px)', marginBottom:8, display:'flex', alignItems:'center', gap:6, padding:'0 8px'}}>
          <span style={{width:8,height:8, background:'rgba(255,255,255,.9)', borderRadius:999}}/> <span style={{fontSize:9,color:'#fff', fontWeight:800}}>GAMEVERSE</span>
        </div>
        <div style={{background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.14)', backdropFilter:'blur(16px)', borderRadius:14, padding:8, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div><div style={{fontSize:10,color:'#fff',fontWeight:800}}>Esteghlal — Persepolis</div><div style={{fontSize:8,color:'rgba(255,255,255,.65)'}}>FC 25</div></div>
          <span style={{fontSize:10, color:'#fff', background:'rgba(139,92,246,.35)', border:'1px solid rgba(139,92,246,.5)', padding:'4px 10px', borderRadius:999, backdropFilter:'blur(8px)'}}>1.90×</span>
        </div>
      </div>
    )
  }
  if(id==='sportsbook'){
    return (
      <div style={{background:'#0b0f1e', border:'1px solid #1e293b', borderRadius:10, padding:8, minHeight:110}}>
        <div style={{height:8, background:'#111827', border:'1px solid #1f2937', borderRadius:6, marginBottom:8, display:'flex', alignItems:'center', gap:4, padding:'0 6px'}}>
          <span style={{fontSize:7,color:'#f59e0b', fontWeight:900}}>GAMEVERSE</span><span style={{marginInlineStart:'auto', fontSize:7, color:'#64748b'}}>۱:۴۲:۱۰</span>
        </div>
        <div style={{background:'#0f172a', border:'1px solid #1e293b', borderRadius:8, display:'flex', alignItems:'center', gap:6, padding:'6px 8px'}}>
          <span style={{fontSize:8, color:'#e2e8f0', flex:1, fontWeight:700}}>Esteghlal — Persepolis</span>
          <span style={{fontSize:9, fontWeight:900, color:'#0b0f1e', background:'#f59e0b', borderRadius:6, padding:'3px 8px'}}>1.90</span>
          <span style={{fontSize:9, fontWeight:900, color:'#0b0f1e', background:'#f59e0b', borderRadius:6, padding:'3px 8px'}}>1.90</span>
          <span style={{fontSize:9, fontWeight:900, color:'#94a3b8', background:'#1e293b', borderRadius:6, padding:'3px 8px'}}>3.20</span>
        </div>
        <div style={{fontSize:7, color:'#64748b', marginTop:6, textAlign:'center'}}>مساوی · FC 25 · امروز</div>
      </div>
    )
  }
  if(id==='neon'){
    return (
      <div style={{background:'#050a14', border:'1px solid rgba(0,229,255,.25)', borderRadius:14, padding:10, minHeight:110, boxShadow:'0 0 20px rgba(0,229,255,.12)'}}>
        <div style={{height:10, background:'linear-gradient(90deg,#00e5ff 0%,#ff2d95 100%)', borderRadius:999, marginBottom:8, display:'flex', alignItems:'center', gap:6, padding:'0 8px', position:'relative'}}>
          <span style={{width:8,height:8, background:'#fff', borderRadius:1, boxShadow:'0 0 6px #00e5ff'}}/> <span style={{fontSize:8,color:'#fff', fontWeight:900, letterSpacing:.08}}>GAMEVERSE</span><span style={{marginInlineStart:'auto',fontSize:7,color:'rgba(255,255,255,.9)'}}>◉ LIVE</span>
        </div>
        <div style={{background:'rgba(0,229,255,.06)', border:'1px solid rgba(0,229,255,.35)', borderRadius:12, padding:8, display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:6, alignItems:'center', boxShadow:'0 0 12px rgba(0,229,255,.18)'}}>
          <div style={{textAlign:'center'}}><div style={{width:22,height:22,borderRadius:4,background:'#00e5ff',margin:'0 auto', boxShadow:'0 0 8px rgba(0,229,255,.6)'}}/><div style={{fontSize:7,color:'#7dd3fc',marginTop:3, fontWeight:800}}>EST</div></div>
          <span style={{fontSize:8,color:'#ff2d95', background:'rgba(255,45,149,.12)', border:'1px solid rgba(255,45,149,.4)', padding:'3px 6px', borderRadius:4, fontWeight:900}}>VS</span>
          <div style={{textAlign:'center'}}><div style={{width:22,height:22,borderRadius:4,background:'#ff2d95',margin:'0 auto', boxShadow:'0 0 8px rgba(255,45,149,.5)'}}/><div style={{fontSize:7,color:'#fda4d5',marginTop:3, fontWeight:800}}>PER</div></div>
        </div>
      </div>
    )
  }
  if(id==='midnight'){
    return (
      <div style={{background:'#000', border:'1px solid #1a1a1a', borderRadius:12, padding:10, minHeight:110}}>
        <div style={{height:10, background:'#0a0a0a', border:'1px solid #1a1a1a', borderRadius:6, marginBottom:8, display:'flex', alignItems:'center', gap:6, padding:'0 8px'}}>
          <span style={{width:7,height:7, background:'#fff', borderRadius:999}}/> <span style={{fontSize:9,color:'#fff', fontWeight:700, letterSpacing:.06}}>GAMEVERSE</span><span style={{marginInlineStart:'auto',fontSize:7,color:'#52525b'}}>OLED</span>
        </div>
        <div style={{background:'#0a0a0a', border:'1px solid #1a1a1a', borderRadius:10, padding:8, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div><div style={{fontSize:9,color:'#fff',fontWeight:700}}>Esteghlal — Persepolis</div><div style={{fontSize:7,color:'#71717a'}}>FC 25 · ۲۰:۳۰</div></div>
          <span style={{fontSize:9, color:'#000', background:'#fff', padding:'3px 8px', borderRadius:6, fontWeight:800}}>1.90</span>
        </div>
      </div>
    )
  }
  if(id==='arctic'){
    return (
      <div style={{background:'#eef2f7', border:'1px solid #d6dde8', borderRadius:14, padding:10, minHeight:110}}>
        <div style={{height:10, background:'#fff', border:'1px solid #d6dde8', borderRadius:999, marginBottom:8, display:'flex', alignItems:'center', gap:6, padding:'0 8px', boxShadow:'0 1px 2px rgba(0,0,0,.04)'}}>
          <span style={{width:8,height:8, background:'#2563eb', borderRadius:999}}/> <span style={{fontSize:9,color:'#1e293b', fontWeight:800}}>GAMEVERSE</span><span style={{marginInlineStart:'auto',fontSize:7,color:'#64748b'}}>❄ ARCTIC</span>
        </div>
        <div style={{background:'#fff', border:'1px solid #d6dde8', borderRadius:12, padding:8, display:'flex', justifyContent:'space-between', alignItems:'center', boxShadow:'0 2px 8px rgba(37,99,235,.08)'}}>
          <div><div style={{fontSize:9,color:'#1e293b',fontWeight:800}}>Esteghlal — Persepolis</div><div style={{fontSize:7,color:'#64748b'}}>FC 25 · امروز</div></div>
          <span style={{fontSize:9, color:'#fff', background:'#2563eb', padding:'4px 10px', borderRadius:999, fontWeight:800}}>1.90×</span>
        </div>
      </div>
    )
  }
  // stadium
  return (
    <div style={{background:'#0f1410', border:'1px solid rgba(250,204,21,.18)', borderRadius:12, padding:10, minHeight:110}}>
      <div style={{height:10, background:'#182018', border:'1px solid rgba(250,204,21,.2)', borderRadius:6, marginBottom:8, display:'flex', alignItems:'center', gap:6, padding:'0 8px', borderTop:'2px solid #facc15'}}>
        <span style={{fontSize:7,color:'#facc15', fontWeight:900}}>⬢ GAMEVERSE</span><span style={{marginInlineStart:'auto',fontSize:7,color:'#a3a3a3'}}>● LIVE</span>
      </div>
      <div style={{background:'#1a2315', border:'1px solid rgba(250,204,21,.22)', borderRadius:10, padding:8, display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:6, alignItems:'center'}}>
        <div style={{textAlign:'center'}}><div style={{width:22,height:22,borderRadius:999,background:'#22c55e',margin:'0 auto', border:'2px solid #facc15'}}/><div style={{fontSize:7,color:'#bbf7d0',marginTop:2, fontWeight:800}}>EST</div></div>
        <span style={{fontSize:10,color:'#facc15', fontWeight:900}}>—</span>
        <div style={{textAlign:'center'}}><div style={{width:22,height:22,borderRadius:999,background:'#1e3a2a',margin:'0 auto', border:'2px solid #facc15'}}/><div style={{fontSize:7,color:'#bbf7d0',marginTop:2, fontWeight:800}}>PER</div></div>
      </div>
    </div>
  )
}

const BLURBS: Record<DesignId,string> = {
  minimal: 'کارت‌های هوادار سفید، فاصله زیاد، هدر مینیمال، تایپوگرافی درشت.',
  esports: 'دارک، کارت‌های دو تیم VS، گرادینت تیم، نئون سبز.',
  glass: 'سطوح شیشه‌ای، blur، حاشیه‌های روشن، گرادینت تیره.',
  sportsbook: 'ردیفی جدولی، Odds باکس نارنجی، تراکم بالا.',
  neon: 'سایبرپانک: حاشیه نئون فیروزه‌ای/سرخابی، کارت‌ها با glow، VS سرخابی باکس.',
  midnight: 'مشکی مطلق OLED — بدون سایه، حاشیه خاکستری، Odds سفید.',
  arctic: 'روشن یخی: پس‌زمینه آبی-خاکستری، سایه نرم، Odds آبی.',
  stadium: 'استادیوم: تم گرم چمنی، حاشیه زرد، اسکوربورد تیره.',
}

export default function AdminDesign(){
  const { design, setDesign } = useTheme()
  const [saving, setSaving] = useState<DesignId|null>(null)
  const [msg, setMsg] = useState<string|null>(null)

  const activate = async(id: DesignId)=>{
    setSaving(id); setMsg(null)
    try { await setDesign(id); setMsg(`✅ ${DESIGNS[id].label} فعال شد — همه کاربران الان همین ظاهر را می‌بینند.`) } 
    catch(e:any){ setMsg('خطا: '+(e?.message||'نامشخص')) }
    finally { setSaving(null); setTimeout(()=> setMsg(null), 3500) }
  }

  return (
    <div className="container" style={{padding:'20px 14px 28px', maxWidth:1100}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        <div>
          <h2 style={{fontWeight:900, fontSize:22}}>طراحی سایت</h2>
          <p style={{color:'var(--muted)', fontSize:13, marginTop:4}}>یک استایل را انتخاب کن — در Supabase ذخیره می‌شود و با Realtime برای همه بدون رفرش اعمال می‌شود.</p>
        </div>
        <Link to="/admin" className="btn btn-ghost btn-sm">← پنل ادمین</Link>
      </div>

      <div style={{marginTop:12, padding:'10px 12px', borderRadius:12, background:'rgba(99,102,241,.10)', border:'1px solid rgba(99,102,241,.18)', fontSize:12, color:'#cbd5e1'}}>
        فعال: <b style={{color:'#fff'}}>{DESIGNS[design].icon} {DESIGNS[design].label}</b> — {DESIGNS[design].desc}
        <span style={{marginInlineStart:8, fontSize:11, color:'#94a3b8'}}>· attribute: <code style={{background:'rgba(255,255,255,.08)', padding:'1px 6px', borderRadius:6}}>data-design="{design}"</code></span>
      </div>

      {msg && <div style={{marginTop:10, padding:'10px 12px', borderRadius:10, fontSize:13, background: msg.startsWith('✅')?'rgba(0,229,160,.12)':'rgba(255,60,90,.12)', border:`1px solid ${msg.startsWith('✅')?'rgba(0,229,160,.3)':'rgba(255,60,90,.3)'}`, color: msg.startsWith('✅')?'var(--accent)':'#ff6b7a'}}>{msg}</div>}

      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:14, marginTop:16}}>
        {DESIGN_IDS.map(id=>{
          const d = DESIGNS[id]
          const active = design===id
          const busy = saving===id
          return (
            <div key={id} className="card" style={{
              padding:14, display:'flex', flexDirection:'column', gap:10,
              borderColor: active? d.accent : 'var(--line)',
              background: active? `linear-gradient(135deg, ${d.accent}14, transparent)` : undefined,
              boxShadow: active? `0 0 0 1px ${d.accent}55` : undefined
            }}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div style={{display:'flex', gap:10, alignItems:'center'}}>
                  <span style={{
                    width:36,height:36,borderRadius:10,display:'grid',placeItems:'center',fontSize:16, fontWeight:900,
                    background: active? d.accent : 'rgba(255,255,255,.06)', color: active? '#0b0f1e' : '#e2e8f0',
                    border:`1px solid ${active? d.accent : 'var(--line)'}`
                  }}>{d.icon}</span>
                  <div>
                    <div style={{fontWeight:900, fontSize:13}}>{d.label}</div>
                    <div style={{fontSize:11, color:'var(--muted)'}}>{d.desc}</div>
                  </div>
                </div>
                {active && <span style={{fontSize:10, fontWeight:900, padding:'4px 8px', borderRadius:999, background:d.accent, color:'#0b0f1e'}}>فعال</span>}
              </div>

              <div style={{borderRadius:12, overflow:'hidden', border:'1px solid var(--line)'}}>
                <Preview id={id}/>
              </div>

              <div style={{fontSize:11, color:'var(--muted)', lineHeight:1.7}}>{BLURBS[id]}</div>

              <button
                className={active ? 'btn btn-ghost' : 'btn btn-primary'}
                style={{width:'100%', borderColor: active? d.accent : undefined, color: active? d.accent : undefined}}
                disabled={busy || active}
                onClick={()=> activate(id)}
              >
                {busy ? 'در حال اعمال…' : active ? 'فعال است ✓' : 'فعال‌سازی'}
              </button>
              {!active && <button className="btn btn-ghost btn-sm" onClick={()=> { document.documentElement.setAttribute('data-design', id); setTimeout(()=> document.documentElement.setAttribute('data-design', design), 1500) }}>پیش‌نمایش ۱.۵ ثانیه</button>}
            </div>
          )
        })}
      </div>

      <div className="card" style={{marginTop:16, padding:14, background:'rgba(255,255,255,.03)'}}>
        <h3 style={{fontWeight:800, fontSize:13}}>نکته فنی</h3>
        <ul style={{marginTop:8, paddingInlineStart:18, fontSize:12, color:'var(--muted)', lineHeight:1.9}}>
          <li>مقدار در <code>site_settings.design</code> ذخیره می‌شود (متن).</li>
          <li>همه کلاینت‌ها با <code>supabase.channel('site-design')</code> بدون رفرش آپدیت می‌شوند.</li>
          <li>افزودن تم جدید: فقط یک ورودی به <code>src/theme/designRegistry.ts</code> + یک بلاک <code>[data-design="..."]</code> در <code>styles.css</code> اضافه کن.</li>
        </ul>
      </div>
    </div>
  )
}
