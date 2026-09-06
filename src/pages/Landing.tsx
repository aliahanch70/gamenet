import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, type Match } from '../lib/supabase'

const GALLERY = [
  { title:'FC 25', tag:'فوتبال', img:'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=600&q=80' },
  { title:'Valorant', tag:'شوتر', img:'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&q=80' },
  { title:'Call of Duty', tag:'شوتر', img:'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&q=80' },
  { title:'League of Legends', tag:'MOBA', img:'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=600&q=80' },
  { title:'FIFA Online', tag:'ورزشی', img:'https://images.unsplash.com/photo-1574629810360-214f3774381b?w=600&q=80' },
  { title:'DOTA 2', tag:'MOBA', img:'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&q=80' },
]

export default function Landing(){
  const [matches,setMatches]=useState<Match[]>([])
  useEffect(()=>{ supabase.from('matches').select('*').eq('status','upcoming').order('starts_at').limit(3).then(r=> setMatches((r.data as Match[])||[])) },[])

  return (
    <>
      <section className="hero" style={{padding:'56px 0 36px'}}>
        <div className="container hero-grid">
          <div>
            <span className="badge">🎮 گیم‌نت حرفه‌ای · تهران</span>
            <h1 className="hero-title">
              بازی کن، رقابت کن،<br/><span style={{background:'linear-gradient(90deg,var(--accent),var(--accent2))', WebkitBackgroundClip:'text', color:'transparent'}}>برنده شو.</span>
            </h1>
            <p style={{color:'var(--muted)',maxWidth:520,fontSize:15}}>GAMEVERSE — ۲۰ سیستم RTX 4070، سالن VIP، مسابقات هفتگی با جایزه نقدی. شرط‌بندی امن روی مسابقات داخلی با کیف پول تومانی و تسویه آنی.</p>
            <div style={{display:'flex',gap:10,marginTop:18,flexWrap:'wrap'}}>
              <Link className="btn btn-primary" to="/betting">ورود به شرط‌بندی →</Link>
              <a className="btn btn-ghost" href="#contact">رزرو جایگاه</a>
            </div>
            <div style={{display:'flex',gap:18,marginTop:22,color:'var(--muted)',fontSize:13,flexWrap:'wrap'}}>
              <span>⏱ ۲۴/۷ باز</span><span>📍 میدان ولیعصر</span><span>⭐ ۴.۸ / ۵۰۰+ نظر</span>
            </div>
          </div>
          <div className="card" style={{padding:14,background:'linear-gradient(180deg,#162040,#0f1730)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <b>مسابقات پیش‌رو</b><Link to="/betting" style={{fontSize:12,color:'var(--accent)'}}>همه →</Link>
            </div>
            {matches.length===0 ? <p style={{color:'var(--muted)',fontSize:13}}>در حال بارگذاری…</p> : matches.map(m=>(
              <div key={m.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 12px',borderRadius:12,background:'rgba(255,255,255,.06)',marginBottom:8,gap:8}}>
                <div style={{minWidth:0}}><div style={{fontWeight:700,fontSize:13,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{m.team_a} — {m.team_b}</div><div style={{fontSize:11,color:'var(--muted)'}}>{m.game} · {new Date(m.starts_at).toLocaleString('fa-IR')}</div></div>
                <span className="odds" style={{fontSize:12,flexShrink:0}}>{Number(m.odds_a).toFixed(2)} / {Number(m.odds_b).toFixed(2)}</span>
              </div>
            ))}
            <div className="divider" />
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,textAlign:'center'}}>
              <div><div style={{fontWeight:900}}>۲۰</div><div style={{fontSize:11,color:'var(--muted)'}}>سیستم گیمینگ</div></div>
              <div><div style={{fontWeight:900}}>144Hz</div><div style={{fontSize:11,color:'var(--muted)'}}>مانیتور</div></div>
              <div><div style={{fontWeight:900}}>۱Gbps</div><div style={{fontSize:11,color:'var(--muted)'}}>اینترنت</div></div>
            </div>
          </div>
        </div>
      </section>

      <section style={{padding:'28px 0'}}>
        <div className="container">
          <h2 style={{fontWeight:900,marginBottom:6}}>گالری بازی‌ها</h2>
          <p style={{color:'var(--muted)',fontSize:13,marginBottom:14}}>روی تمام عناوین روز — از FC 25 تا Valorant — با اکانت پرمیوم بازی کنید.</p>
          <div className="gallery-grid">
            {GALLERY.map(g=>(
              <div key={g.title} className="card" style={{overflow:'hidden'}}>
                <img src={g.img} alt={g.title} style={{width:'100%',height:110,objectFit:'cover',display:'block'}} loading="lazy"/>
                <div style={{padding:'10px 12px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <b style={{fontSize:13}}>{g.title}</b><span className="badge" style={{fontSize:10}}>{g.tag}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{padding:'10px 0 28px'}}>
        <div className="container features-grid">
          {[
            {t:'سیستم‌های حرفه‌ای',d:'RTX 4070 · i7-13700 · 32GB RAM · SSD NVMe'},
            {t:'مسابقات و شرط‌بندی',d:'هر هفته تورنمنت با ضرایب زنده و کیف پول تومانی'},
            {t:'کافه و لانژ',d:'نوشیدنی گرم/سرد، اسنک، فضای کار اشتراکی'},
          ].map(f=>(
            <div key={f.t} className="card" style={{padding:16}}>
              <div style={{fontWeight:800,marginBottom:4}}>{f.t}</div>
              <div style={{color:'var(--muted)',fontSize:13}}>{f.d}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="contact" style={{padding:'8px 0 32px'}}>
        <div className="container card contact-grid" style={{padding:18}}>
          <div>
            <h3 style={{fontWeight:900,marginBottom:8}}>تماس و آدرس</h3>
            <div style={{color:'var(--muted)',fontSize:13,lineHeight:1.9}}>
              📍 تهران، میدان ولیعصر، خیابان کریم‌خان، پلاک ۱۲۳<br/>
              📞 ۰۲۱-۸۸۸۸۱۲۳۴ · ۰۹۱۲-۳۴۵۶۷۸۹<br/>
              🕘 هر روز ۱۰:۰۰ تا ۰۲:۰۰ بامداد<br/>
              ✉️ info@gamverse.ir
            </div>
            <div style={{display:'flex',gap:8,marginTop:12,flexWrap:'wrap'}}>
              <a className="btn btn-primary btn-sm" href="tel:+982188881234">تماس</a>
              <a className="btn btn-ghost btn-sm" href="https://maps.google.com" target="_blank" rel="noreferrer">مسیریابی</a>
            </div>
          </div>
          <div style={{background:'#0d1326',borderRadius:12,border:'1px solid var(--line)',display:'grid',placeItems:'center',minHeight:150,color:'var(--muted)',fontSize:13,padding:12}}>
            نقشه — iframe گوگل‌مپ را اینجا جایگزین کنید
          </div>
        </div>
      </section>

      <footer style={{borderTop:'1px solid var(--line)',padding:'14px 0',color:'var(--muted)',fontSize:12}}>
        <div className="container" style={{display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
          <span>© 2026 GAMEVERSE — همه حقوق محفوظ است.</span>
        </div>
      </footer>
    </>
  )
}
