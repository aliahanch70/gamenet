import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, type Match } from '../lib/supabase'
import type { Widget } from '../lib/widgets'

const FALLBACK_HERO = {
  badge: 'گیم‌نت حرفه‌ای · تهران',
  title1: 'بازی کن، رقابت کن،',
  title2: 'برنده شو.',
  desc: 'GAMEVERSE — ۲۰ سیستم RTX 4070، سالن VIP، مسابقات هفتگی با جایزه نقدی. شرط‌بندی امن روی مسابقات داخلی با کیف پول تومانی و تسویه آنی.',
  stats: [
    { label: 'سیستم گیمینگ', value: '۲۰' },
    { label: 'مانیتور', value: '144Hz' },
    { label: 'اینترنت', value: '۱Gbps' },
  ],
}
const FALLBACK_FEATURES = [
  { title: 'سیستم‌های حرفه‌ای', desc: 'RTX 4070 · i7-13700 · 32GB RAM · SSD NVMe', icon: '🖥️' },
  { title: 'مسابقات و شرط‌بندی', desc: 'هر هفته تورنمنت با ضرایب زنده و کیف پول تومانی', icon: '🏆' },
  { title: 'کافه و لانژ', desc: 'نوشیدنی گرم/سرد، اسنک، فضای کار اشتراکی', icon: '☕' },
]
const FALLBACK_GALLERY = [
  { title:'FC 25', tag:'فوتبال', img:'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=600&q=80' },
  { title:'Valorant', tag:'شوتر', img:'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&q=80' },
  { title:'Call of Duty', tag:'شوتر', img:'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&q=80' },
  { title:'League of Legends', tag:'MOBA', img:'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=600&q=80' },
  { title:'FIFA Online', tag:'ورزشی', img:'https://images.unsplash.com/photo-1574629810360-214f3774381b?w=600&q=80' },
  { title:'DOTA 2', tag:'MOBA', img:'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&q=80' },
]
const FALLBACK_CONTACT = {
  address: 'تهران، میدان ولیعصر، خیابان کریم‌خان، پلاک ۱۲۳',
  phone1: '۰۲۱-۸۸۸۸۱۲۳۴',
  phone2: '۰۹۱۲-۳۴۵۶۷۸۹',
  hours: 'هر روز ۱۰:۰۰ تا ۰۲:۰۰ بامداد',
  email: 'info@gamenet.ir',
}
const FALLBACK_GAMES: { name: string; icon: string }[] = [
  { name: 'FC 25', icon: '⚽' },
  { name: 'Valorant', icon: '🎯' },
  { name: 'DOTA 2', icon: '⚔️' },
  { name: 'LoL', icon: '🏰' },
  { name: 'CoD', icon: '🔫' },
]


function WidgetsRenderer({ widgets }: { widgets: Widget[] }) {
  const [board, setBoard] = useState<{username:string;balance:number}[]|null>(null)
  useEffect(()=>{
    const need = widgets.some(w=> w.enabled && w.type==='leaderboard')
    if(!need){ setBoard([]); return }
    supabase.rpc('get_leaderboard').then(({ data })=> setBoard((data as any)||[]))
  }, [widgets])
  const vis = widgets.filter(w=> w.enabled)
  if(!vis.length) return null
  return (
    <>
      {vis.map(w=> {
        if(w.type==='announcement') return (
          <div key={w.id} style={{ background:'linear-gradient(90deg, rgba(0,229,160,.18), rgba(0,229,160,.06))', borderTop:'1px solid rgba(0,229,160,.18)', borderBottom:'1px solid rgba(0,229,160,.18)', padding:'8px 16px', textAlign:'center', fontSize:13 }}>{w.props.text}</div>
        )
        if(w.type==='stats') return (
          <section key={w.id} style={{padding:'18px 0'}}>
            <div className="container">
              <h3 style={{fontWeight:800,marginBottom:10}}>{w.title}</h3>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
                {w.props.items.map((it:any,i:number)=>(
                  <div key={i} className="card" style={{padding:14,textAlign:'center'}}>
                    <div style={{fontWeight:900,fontSize:22}}>{it.value}</div>
                    <div style={{fontSize:11,color:'var(--muted)',marginTop:4}}>{it.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )
        if(w.type==='promo') return (
          <section key={w.id} style={{padding:'18px 0'}}>
            <div className="container">
              <div className="card" style={{padding:14,display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap',background:'linear-gradient(135deg, rgba(0,229,160,.12), rgba(255,255,255,.03))'}}>
                <span style={{fontWeight:700}}>{w.props.text}</span>
                <a className="btn btn-primary" href={w.props.link}>{w.props.cta}</a>
              </div>
            </div>
          </section>
        )
        if(w.type==='leaderboard') return (
          <section key={w.id} style={{padding:'18px 0'}}>
            <div className="container">
              <h3 style={{fontWeight:800,marginBottom:10}}>{w.title} 🏆</h3>
              {!board ? <p style={{color:'var(--muted)',fontSize:12}}>در حال بارگذاری…</p> : board.length===0 ? <p style={{color:'var(--muted)',fontSize:12}}>هنوز داده‌ای نیست.</p> : (
                <div style={{display:'grid',gap:8}}>
                  {board.map((r,i)=>(
                    <div key={r.username} className="card" style={{padding:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span>#{i+1} — {r.username}</span>
                      <b>{Number(r.balance).toLocaleString('fa-IR')} ت</b>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )
        if(w.type==='faq') return (
          <section key={w.id} style={{padding:'18px 0'}}>
            <div className="container">
              <h3 style={{fontWeight:800,marginBottom:10}}>{w.title}</h3>
              <div style={{display:'grid',gap:8}}>
                {w.props.items.map((it:any,i:number)=>(
                  <details key={i} className="card" style={{padding:12}}>
                    <summary style={{fontWeight:700,cursor:'pointer',fontSize:13}}>{it.q}</summary>
                    <p style={{color:'var(--muted)',fontSize:12,marginTop:8,lineHeight:1.8}}>{it.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>
        )
        if(w.type==='testimonials') return (
          <section key={w.id} style={{padding:'18px 0'}}>
            <div className="container">
              <h3 style={{fontWeight:800,marginBottom:10}}>{w.title}</h3>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
                {w.props.items.map((it:any,i:number)=>(
                  <div key={i} className="card" style={{padding:14}}>
                    <div style={{fontWeight:700}}>{it.name}</div>
                    <div style={{color:'var(--muted)',fontSize:12,marginTop:6,lineHeight:1.7}}>“{it.text}”</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )
        return null
      })}
    </>
  )
}

export default function Landing(){
  const [matches,setMatches]=useState<Match[]>([])
  const [hero,setHero]=useState(FALLBACK_HERO)
  const [features,setFeatures]=useState(FALLBACK_FEATURES)
  const [gallery,setGallery]=useState(FALLBACK_GALLERY)
  const [contact,setContact]=useState(FALLBACK_CONTACT)
  const [games,setGames]=useState(FALLBACK_GAMES)
  const [matchesLoading,setMatchesLoading]=useState(true)
  const [widgets,setWidgets]=useState<Widget[]>([])

  useEffect(()=>{
    supabase.from('matches').select('*').eq('status','upcoming').order('starts_at').limit(3).then(r=> { setMatches((r.data as Match[])||[]); setMatchesLoading(false) })
    supabase.from('site_settings').select('*').eq('id',1).single().then(({ data })=>{
      if(data){
        if(data.hero) setHero(data.hero)
        if(Array.isArray(data.features) && data.features.length) setFeatures(data.features)
        if(Array.isArray(data.gallery) && data.gallery.length) setGallery(data.gallery)
        if(data.contact) setContact(data.contact)
        if(Array.isArray(data.games) && data.games.length) setGames(data.games)
        if(Array.isArray((data as any).widgets)) setWidgets((data as any).widgets)
      }
    })
  },[])

  return (
    <>
      <section className="hero" style={{padding:'56px 0 36px'}}>
        <div className="container hero-grid">
          <div>
            <span className="badge">{hero.badge}</span>
            <h1 className="hero-title">
              {hero.title1}<br/><span style={{background:'linear-gradient(90deg,var(--accent),var(--accent2))', WebkitBackgroundClip:'text', color:'transparent'}}>{hero.title2}</span>
            </h1>
            <p style={{color:'var(--muted)',maxWidth:520,fontSize:15}}>{hero.desc}</p>
            <div style={{display:'flex',gap:10,marginTop:18,flexWrap:'wrap'}}>
              <Link className="btn btn-primary" to="/betting">ورود به پیشبینی →</Link>
              <a className="btn btn-ghost" href="#contact">رزرو جایگاه</a>
            </div>
            <div style={{display:'flex',gap:18,marginTop:22,color:'var(--muted)',fontSize:13,flexWrap:'wrap'}}>
              <span>⏱ ۲۴/۷ باز</span><span>📍 lمجیدیه جنوبی</span><span>⭐ ۴.۸ / ۵۰۰+ نظر</span>
            </div>
          </div>
          <div className="card" style={{padding:14,background:'linear-gradient(180deg,#162040,#0f1730)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <b>مسابقات پیش‌رو</b><Link to="/betting" style={{fontSize:12,color:'var(--accent)'}}>همه →</Link>
            </div>
            {matchesLoading ? <div style={{display:'grid',gap:8}}>{[0,1,2].map(i=> <div key={i} className="skeleton" style={{height:52,borderRadius:12}} />)}</div> : matches.length===0 ? <p style={{color:'var(--muted)',fontSize:13}}>مسابقه‌ای یافت نشد.</p> : matches.map(m=>(
              <div key={m.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 12px',borderRadius:12,background:'rgba(255,255,255,.06)',marginBottom:8,gap:8}}>
                <div style={{minWidth:0}}><div style={{fontWeight:700,fontSize:13,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{m.team_a} — {m.team_b}</div><div style={{fontSize:11,color:'var(--muted)'}}>{m.game} · {new Date(m.starts_at).toLocaleString('fa-IR')}</div></div>
                <span className="odds" style={{fontSize:12,flexShrink:0}}>{Number(m.odds_a).toFixed(2)} / {Number(m.odds_b).toFixed(2)}</span>
              </div>
            ))}
            <div className="divider" />
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,textAlign:'center'}}>
              {hero.stats.map((s,i)=>(
                <div key={i}><div style={{fontWeight:900}}>{s.value}</div><div style={{fontSize:11,color:'var(--muted)'}}>{s.label}</div></div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section style={{padding:'28px 0'}}>
        <div className="container">
          <h2 style={{fontWeight:900,marginBottom:6}}>ویژگی‌ها</h2>
          <div className="features-grid">
            {features.map((f,i)=>(
              <div key={i} className="card" style={{padding:16}}>
                <div style={{fontSize:22}}>{f.icon}</div>
                <div style={{fontWeight:800,marginTop:8}}>{f.title}</div>
                <div style={{fontSize:12,color:'var(--muted)',marginTop:4}}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{padding:'28px 0'}}>
        <div className="container">
          <h2 style={{fontWeight:900,marginBottom:6}}>گالری بازی‌ها</h2>
          <p style={{color:'var(--muted)',fontSize:13,marginBottom:14}}>روی تمام عناوین روز — از FC 25 تا Valorant — با اکانت پرمیوم بازی کنید.</p>
          <div className="gallery-grid">
            {gallery.map(g=>(
              <div key={g.title} className="card" style={{overflow:'hidden'}}>
                <img src={g.img} alt={g.title} style={{width:'100%',height:110,objectFit:'cover',display:'block'}} loading="lazy"/>
                <div style={{padding:'10px 12px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <b style={{fontSize:13}}>{g.title}</b><span className="badge" style={{fontSize:10}}>{g.tag}</span>
                </div>
              </div>
            ))}
          </div>
          {games.length>0 && (
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:14}}>
              {games.map((g,i)=>(
                <span key={i} className="badge">{g.icon} {g.name}</span>
              ))}
            </div>
          )}
        </div>
      </section>

      <WidgetsRenderer widgets={widgets} />
      <section id="contact" style={{padding:'10px 0 28px'}}>
        <div className="container contact-grid">
          <div className="card" style={{padding:16}}>
            <h3 style={{fontWeight:800}}>تماس با ما</h3>
            <div style={{fontSize:13,color:'var(--muted)',marginTop:8,lineHeight:1.8}}>
              <div>📍 {contact.address}</div>
              <div>📞 {contact.phone1} {contact.phone2 ? '· '+contact.phone2 : ''}</div>
              <div>⏰ {contact.hours}</div>
              <div>✉️ {contact.email}</div>
            </div>
          </div>
          <div className="card" style={{padding:16,display:'grid',placeItems:'center',color:'var(--muted)',fontSize:13}}>
            نقشه — میدان ولیعصر، تهران
          </div>
        </div>
      </section>
    </>
  )
}
