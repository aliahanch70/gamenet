import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DESIGNS, DESIGN_IDS, type DesignId } from '../theme/designRegistry'
import { useTheme } from '../contexts/ThemeContext'

// ——— کارت پیش‌بینی ———
function CardPreview({ id }: { id: DesignId }){
  if(id==='minimal') return (
    <div style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:12,padding:8}}>
      <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:10,padding:8,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div><div style={{fontSize:10,fontWeight:800,color:'#0f172a'}}>استقلال — پرسپولیس</div><div style={{fontSize:8,color:'#94a3b8'}}>FC 25 · امروز ۲۰:۳۰</div></div>
        <span style={{fontSize:10,fontWeight:800,color:'#0ea5e9',background:'#e0f2fe',border:'1px solid #bae6fd',padding:'3px 8px',borderRadius:999}}>1.90×</span>
      </div>
      <div style={{display:'flex',gap:6,marginTop:6}}>{[1,2,3].map(i=><span key={i} style={{flex:1,height:22,borderRadius:6,background:i===1?'#0ea5e9':'#fff',border:'1px solid '+(i===1?'#0ea5e9':'#e2e8f0'),color:i===1?'#fff':'#64748b',fontSize:8,fontWeight:700,display:'grid',placeItems:'center'}}>۱.۹۰</span>)}</div>
    </div>
  )
  if(id==='esports') return (
    <div style={{background:'#080d1c',border:'1px solid rgba(255,255,255,.08)',borderRadius:12,padding:8}}>
      <div style={{background:'#111c33',border:'1px solid rgba(34,197,94,.22)',borderRadius:10,padding:8,display:'grid',gridTemplateColumns:'1fr auto 1fr',gap:6,alignItems:'center'}}>
        <div style={{textAlign:'center'}}><div style={{width:22,height:22,borderRadius:999,background:'linear-gradient(135deg,#1e3a5f,#2a5a9a)',margin:'0 auto'}}/><div style={{fontSize:7,color:'#cbd5e1',marginTop:2}}>استقلال</div></div>
        <span style={{fontSize:7,color:'#64748b',background:'rgba(255,255,255,.06)',padding:'3px 6px',borderRadius:999}}>VS</span>
        <div style={{textAlign:'center'}}><div style={{width:22,height:22,borderRadius:999,background:'linear-gradient(135deg,#5a1e2a,#9a2a4a)',margin:'0 auto'}}/><div style={{fontSize:7,color:'#cbd5e1',marginTop:2}}>پرسپولیس</div></div>
      </div>
      <div style={{display:'flex',gap:5,marginTop:6}}>{['استقلال','مساوی','پرسپولیس'].map((t,i)=><span key={t} style={{flex:1,padding:'4px 0',borderRadius:8,textAlign:'center',fontSize:7,fontWeight:700,background:i===0?'rgba(34,197,94,.14)':'rgba(255,255,255,.06)',border:'1px solid '+(i===0?'rgba(34,197,94,.28)':'rgba(255,255,255,.08)'),color:i===0?'#86efac':'#cbd5e1'}}>{t}</span>)}</div>
    </div>
  )
  if(id==='glass') return (
    <div style={{background:'linear-gradient(135deg,#0b1226,#1a1033)',border:'1px solid rgba(255,255,255,.10)',borderRadius:12,padding:8}}>
      <div style={{background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.14)',backdropFilter:'blur(12px)',borderRadius:12,padding:8,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div><div style={{fontSize:9,color:'#fff',fontWeight:800}}>استقلال — پرسپولیس</div><div style={{fontSize:7,color:'rgba(255,255,255,.6)'}}>FC 25</div></div>
        <span style={{fontSize:9,color:'#fff',background:'rgba(139,92,246,.35)',border:'1px solid rgba(139,92,246,.5)',padding:'3px 8px',borderRadius:999}}>1.90×</span>
      </div>
      <div style={{display:'flex',gap:5,marginTop:6}}>{[1,2,3].map(i=><span key={i} style={{flex:1,height:20,borderRadius:8,background:i===1?'rgba(139,92,246,.35)':'rgba(255,255,255,.06)',border:'1px solid '+(i===1?'rgba(139,92,246,.5)':'rgba(255,255,255,.1)'),color:'#fff',fontSize:7,display:'grid',placeItems:'center'}}>۱.۹</span>)}</div>
    </div>
  )
  if(id==='sportsbook') return (
    <div style={{background:'#0b0f1e',border:'1px solid #1e293b',borderRadius:8,padding:6}}>
      <div style={{background:'#0f172a',border:'1px solid #1e293b',borderRadius:6,display:'flex',alignItems:'center',gap:6,padding:'6px 8px'}}>
        <span style={{fontSize:8,color:'#e2e8f0',flex:1,fontWeight:700}}>استقلال — پرسپولیس</span>
        <span style={{fontSize:8,fontWeight:900,color:'#0b0f1e',background:'#f59e0b',borderRadius:5,padding:'2px 6px'}}>1.90</span>
        <span style={{fontSize:8,fontWeight:900,color:'#94a3b8',background:'#1e293b',borderRadius:5,padding:'2px 6px'}}>3.20</span>
      </div>
      <div style={{fontSize:7,color:'#64748b',marginTop:4,textAlign:'center'}}>FC 25 · امروز ۲۰:۳۰</div>
    </div>
  )
  if(id==='neon') return (
    <div style={{background:'#050a14',border:'1px solid rgba(0,229,255,.25)',borderRadius:12,padding:8,boxShadow:'0 0 12px rgba(0,229,255,.12)'}}>
      <div style={{background:'rgba(0,229,255,.06)',border:'1px solid rgba(0,229,255,.3)',borderRadius:10,padding:8,display:'grid',gridTemplateColumns:'1fr auto 1fr',gap:6,alignItems:'center'}}>
        <div style={{textAlign:'center'}}><div style={{width:22,height:22,borderRadius:4,background:'#00e5ff',margin:'0 auto',boxShadow:'0 0 8px rgba(0,229,255,.6)'}}/><div style={{fontSize:7,color:'#7dd3fc',marginTop:2,fontWeight:800}}>EST</div></div>
        <span style={{fontSize:7,color:'#ff2d95',background:'rgba(255,45,149,.12)',border:'1px solid rgba(255,45,149,.4)',padding:'3px 6px',borderRadius:4,fontWeight:900}}>VS</span>
        <div style={{textAlign:'center'}}><div style={{width:22,height:22,borderRadius:4,background:'#ff2d95',margin:'0 auto'}}/><div style={{fontSize:7,color:'#fda4d5',marginTop:2,fontWeight:800}}>PER</div></div>
      </div>
    </div>
  )
  if(id==='midnight') return (
    <div style={{background:'#000',border:'1px solid #1a1a1a',borderRadius:10,padding:8}}>
      <div style={{background:'#0a0a0a',border:'1px solid #1a1a1a',borderRadius:8,padding:8,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div><div style={{fontSize:9,color:'#fff',fontWeight:700}}>استقلال — پرسپولیس</div><div style={{fontSize:7,color:'#71717a'}}>FC 25</div></div>
        <span style={{fontSize:9,color:'#000',background:'#fff',padding:'3px 8px',borderRadius:6,fontWeight:800}}>1.90</span>
      </div>
    </div>
  )
  if(id==='arctic') return (
    <div style={{background:'#eef2f7',border:'1px solid #d6dde8',borderRadius:12,padding:8}}>
      <div style={{background:'#fff',border:'1px solid #d6dde8',borderRadius:10,padding:8,display:'flex',justifyContent:'space-between',alignItems:'center',boxShadow:'0 2px 8px rgba(37,99,235,.07)'}}>
        <div><div style={{fontSize:9,color:'#1e293b',fontWeight:800}}>استقلال — پرسپولیس</div><div style={{fontSize:7,color:'#64748b'}}>FC 25</div></div>
        <span style={{fontSize:9,color:'#fff',background:'#2563eb',padding:'3px 8px',borderRadius:999,fontWeight:800}}>1.90×</span>
      </div>
    </div>
  )
  // stadium
  return (
    <div style={{background:'#0f1410',border:'1px solid rgba(250,204,21,.18)',borderRadius:10,padding:8}}>
      <div style={{background:'#1a2315',border:'1px solid rgba(250,204,21,.22)',borderTop:'2px solid #facc15',borderRadius:8,padding:8,display:'grid',gridTemplateColumns:'1fr auto 1fr',gap:6,alignItems:'center'}}>
        <div style={{textAlign:'center'}}><div style={{width:22,height:22,borderRadius:999,background:'#22c55e',margin:'0 auto',border:'2px solid #facc15'}}/><div style={{fontSize:7,color:'#bbf7d0',marginTop:2,fontWeight:800}}>EST</div></div>
        <span style={{fontSize:10,color:'#facc15',fontWeight:900}}>—</span>
        <div style={{textAlign:'center'}}><div style={{width:22,height:22,borderRadius:999,background:'#1e3a2a',margin:'0 auto',border:'2px solid #facc15'}}/><div style={{fontSize:7,color:'#bbf7d0',marginTop:2,fontWeight:800}}>PER</div></div>
      </div>
    </div>
  )
}

// ——— پاپ‌آپ پیش‌بینی ———
function ModalPreview({ id }: { id: DesignId }){
  const picks = ['استقلال','مساوی','پرسپولیس']
  const sel = 0
  // per-design modal tokens
  const TOKENS: Record<DesignId,{bg:string;border:string;title:string;pickBg:string;pickSel:string;btn:string}> = {
    minimal:    { bg:'#fff', border:'#e2e8f0', title:'#0f172a', pickBg:'#f8fafc', pickSel:'#0ea5e9', btn:'#0ea5e9' },
    esports:    { bg:'#111c33', border:'rgba(255,255,255,.10)', title:'#f1f5f9', pickBg:'rgba(255,255,255,.06)', pickSel:'#22c55e', btn:'#22c55e' },
    glass:      { bg:'rgba(15,23,42,.72)', border:'rgba(255,255,255,.14)', title:'#fff', pickBg:'rgba(255,255,255,.06)', pickSel:'#8b5cf6', btn:'#8b5cf6' },
    sportsbook: { bg:'#111827', border:'#1e293b', title:'#f1f5f9', pickBg:'#0f172a', pickSel:'#f59e0b', btn:'#f59e0b' },
    neon:       { bg:'#0a1628', border:'rgba(0,229,255,.18)', title:'#e0f2fe', pickBg:'rgba(0,229,255,.06)', pickSel:'#00e5ff', btn:'#00e5ff' },
    midnight:   { bg:'#0a0a0a', border:'#1a1a1a', title:'#fff', pickBg:'#141414', pickSel:'#fff', btn:'#fff' },
    arctic:     { bg:'#fff', border:'#d6dde8', title:'#1e293b', pickBg:'#f1f5f9', pickSel:'#2563eb', btn:'#2563eb' },
    stadium:    { bg:'#182018', border:'rgba(250,204,21,.14)', title:'#fef08a', pickBg:'#0f1410', pickSel:'#facc15', btn:'#facc15' },
  }
  const t = TOKENS[id]
  const dark = id!=='minimal' && id!=='arctic'
  return (
    <div style={{background:t.bg,border:`1px solid ${t.border}`,borderRadius:10,padding:8,boxShadow: dark?'0 8px 20px rgba(0,0,0,.35)':'0 4px 12px rgba(0,0,0,.08)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
        <span style={{fontSize:8,fontWeight:800,color:t.title}}>پیش‌بینی مسابقه</span>
        <span style={{width:14,height:14,borderRadius:999,display:'grid',placeItems:'center',fontSize:8,background: dark?'rgba(255,255,255,.08)':'#f1f5f9',color: dark?'#cbd5e1':'#64748b',border:`1px solid ${t.border}`}}>✕</span>
      </div>
      <div style={{display:'flex',gap:4}}>
        {picks.map((p,i)=>(
          <span key={p} style={{
            flex:1,padding:'4px 0',borderRadius:7,textAlign:'center',fontSize:7,fontWeight:700,
            background: i===sel? t.pickSel : t.pickBg,
            color: i===sel? (id==='midnight'||id==='stadium'? '#000':'#fff') : (dark?'#cbd5e1':'#475569'),
            border:`1px solid ${i===sel? t.pickSel : t.border}`
          }}>{p} {i===sel?'✓':''}</span>
        ))}
      </div>
      <div style={{marginTop:6,background: dark?'rgba(255,255,255,.06)':'#f8fafc',border:`1px solid ${t.border}`,borderRadius:7,padding:'5px 6px',display:'flex',alignItems:'center',gap:6}}>
        <span style={{fontSize:7,color: dark?'#94a3b8':'#64748b'}}>مبلغ</span>
        <span style={{flex:1,height:4,borderRadius:999,background: dark?'rgba(255,255,255,.12)':'#e2e8f0',position:'relative'}}>
          <span style={{position:'absolute',right:'35%',top:-3,width:10,height:10,borderRadius:999,background:t.pickSel,boxShadow:`0 0 6px ${t.pickSel}88`}}/>
        </span>
        <span style={{fontSize:7,fontWeight:800,color:t.title}}>۵۰,۰۰۰</span>
      </div>
      <div style={{marginTop:6,height:18,borderRadius:7,background:t.btn,color: id==='midnight'||id==='stadium'?'#000':'#fff',display:'grid',placeItems:'center',fontSize:7,fontWeight:800}}>ثبت پیش‌بینی ✓</div>
    </div>
  )
}

const BLURBS: Record<DesignId,string> = {
  minimal: 'سفید تمیز، Odd آبی، کارت هوادار.',
  esports: 'دارک حرفه‌ای، VS دوتیمی، نئون سبز.',
  glass: 'شیشه‌ای با blur و گرادینت بنفش.',
  sportsbook: 'جدولی فشرده، Odd نارنجی.',
  neon: 'سایبرپانک فیروزه‌ای/سرخابی با glow.',
  midnight: 'مشکی مطلق OLED.',
  arctic: 'روشن یخی، سایه نرم آبی.',
  stadium: 'چمنی گرم، لبه زرد استادیوم.',
}

export default function AdminDesign(){
  const { design, setDesign } = useTheme()
  const [saving, setSaving] = useState<DesignId|null>(null)
  const [msg, setMsg] = useState<string|null>(null)
  const [tab, setTab] = useState<'card'|'modal'>('card')

  const activate = async(id: DesignId)=>{
    setSaving(id); setMsg(null)
    try { await setDesign(id); setMsg(`✅ ${DESIGNS[id].label} فعال شد.`) } 
    catch(e:any){ setMsg('خطا: '+(e?.message||'نامشخص')) }
    finally { setSaving(null); setTimeout(()=> setMsg(null), 3000) }
  }

  return (
    <div className="container" style={{padding:'20px 14px 28px', maxWidth:1100}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        <div>
          <h2 style={{fontWeight:900,fontSize:22}}>طراحی سایت</h2>
          <p style={{color:'var(--muted)',fontSize:13,marginTop:4}}>طرح را انتخاب کن — با Realtime برای همه اعمال می‌شود. پیش‌نمایش کارت و پاپ‌آپ را ببین.</p>
        </div>
        <Link to="/admin" className="btn btn-ghost btn-sm">← پنل ادمین</Link>
      </div>

      <div style={{marginTop:12,padding:'10px 12px',borderRadius:12,background:'rgba(99,102,241,.10)',border:'1px solid rgba(99,102,241,.18)',fontSize:12,color:'#cbd5e1'}}>
        فعال: <b style={{color:'#fff'}}>{DESIGNS[design].icon} {DESIGNS[design].label}</b> — {DESIGNS[design].desc}
        <span style={{marginInlineStart:8,fontSize:11,color:'#94a3b8'}}>· <code style={{background:'rgba(255,255,255,.08)',padding:'1px 6px',borderRadius:6}}>data-design="{design}"</code></span>
      </div>

      <div style={{display:'inline-flex',gap:6,marginTop:12,padding:4,borderRadius:999,background:'var(--surface)',border:'1px solid var(--line)'}}>
        <button onClick={()=> setTab('card')} className="btn btn-sm" style={{borderRadius:999, background: tab==='card'?'var(--accent)':'transparent', color: tab==='card'? (design==='midnight'||design==='stadium'?'#000':'#052e16'):'var(--muted)', borderColor: tab==='card'?'var(--accent)':'transparent', padding:'6px 14px'}}>🃏 کارت پیش‌بینی</button>
        <button onClick={()=> setTab('modal')} className="btn btn-sm" style={{borderRadius:999, background: tab==='modal'?'var(--accent)':'transparent', color: tab==='modal'? (design==='midnight'||design==='stadium'?'#000':'#052e16'):'var(--muted)', borderColor: tab==='modal'?'var(--accent)':'transparent', padding:'6px 14px'}}>🪟 پاپ‌آپ پیش‌بینی</button>
      </div>

      {msg && <div style={{marginTop:10,padding:'10px 12px',borderRadius:10,fontSize:13,background: msg.startsWith('✅')?'rgba(0,229,160,.12)':'rgba(255,60,90,.12)',border:`1px solid ${msg.startsWith('✅')?'rgba(0,229,160,.3)':'rgba(255,60,90,.3)'}`,color: msg.startsWith('✅')?'var(--accent)':'#ff6b7a'}}>{msg}</div>}

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:14,marginTop:14}}>
        {DESIGN_IDS.map(id=>{
          const d = DESIGNS[id]
          const active = design===id
          const busy = saving===id
          return (
            <div key={id} className="card" style={{
              padding:12,display:'flex',flexDirection:'column',gap:10,
              borderColor: active? d.accent : 'var(--line)',
              background: active? `linear-gradient(135deg, ${d.accent}14, transparent)` : undefined,
              boxShadow: active? `0 0 0 1px ${d.accent}55` : undefined
            }}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <span style={{width:32,height:32,borderRadius:8,display:'grid',placeItems:'center',fontSize:14,fontWeight:900,background: active? d.accent : 'rgba(255,255,255,.06)',color: active?'#0b0f1e':'#e2e8f0',border:`1px solid ${active? d.accent : 'var(--line)'}`}}>{d.icon}</span>
                  <div><div style={{fontWeight:800,fontSize:12}}>{d.label}</div><div style={{fontSize:11,color:'var(--muted)'}}>{d.desc}</div></div>
                </div>
                {active && <span style={{fontSize:10,fontWeight:800,padding:'3px 7px',borderRadius:999,background:d.accent,color:'#0b0f1e'}}>فعال</span>}
              </div>

              <div style={{borderRadius:12,overflow:'hidden',border:'1px solid var(--line)',minHeight:110}}>
                {tab==='card' ? <CardPreview id={id}/> : <ModalPreview id={id}/>}
              </div>
              <div style={{fontSize:11,color:'var(--muted)',lineHeight:1.6}}>{BLURBS[id]}</div>

              <button className={active ? 'btn btn-ghost' : 'btn btn-primary'} style={{width:'100%',borderColor: active? d.accent : undefined,color: active? d.accent : undefined}} disabled={busy || active} onClick={()=> activate(id)}>
                {busy ? 'در حال اعمال…' : active ? 'فعال است ✓' : 'فعال‌سازی'}
              </button>
              {!active && <button className="btn btn-ghost btn-sm" onClick={()=> { document.documentElement.setAttribute('data-design', id); setTimeout(()=> document.documentElement.setAttribute('data-design', design), 1400) }}>پیش‌نمایش زنده ۱.۴ث</button>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
