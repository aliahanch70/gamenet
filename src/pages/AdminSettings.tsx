import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// ── defaults ────────────────────────────────────────────────
const DEFAULT_HERO = {
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
const DEFAULT_FEATURES = [
  { title: 'سیستم‌های حرفه‌ای', desc: 'RTX 4070 · i7-13700 · 32GB RAM · SSD NVMe', icon: '🖥️' },
  { title: 'مسابقات و شرط‌بندی', desc: 'هر هفته تورنمنت با ضرایب زنده و کیف پول تومانی', icon: '🏆' },
  { title: 'کافه و لانژ', desc: 'نوشیدنی گرم/سرد، اسنک، فضای کار اشتراکی', icon: '☕' },
]
const DEFAULT_GALLERY = [
  { title: 'FC 25', tag: 'فوتبال', img: 'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=600&q=80' },
  { title: 'Valorant', tag: 'شوتر', img: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&q=80' },
  { title: 'Call of Duty', tag: 'شوتر', img: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&q=80' },
  { title: 'League of Legends', tag: 'MOBA', img: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=600&q=80' },
  { title: 'FIFA Online', tag: 'ورزشی', img: 'https://images.unsplash.com/photo-1574629810360-214f3774381b?w=600&q=80' },
  { title: 'DOTA 2', tag: 'MOBA', img: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&q=80' },
]
const DEFAULT_GAMES: { name: string; icon: string }[] = [
  { name: 'FC 25', icon: '⚽' },
  { name: 'FC 26', icon: '⚽' },
  { name: 'Valorant', icon: '🎯' },
  { name: 'DOTA 2', icon: '⚔️' },
  { name: 'LoL', icon: '🏰' },
  { name: 'CoD', icon: '🔫' },
  { name: 'FIFA', icon: '⚽' },
]
const DEFAULT_CONTACT = {
  address: 'تهران، میدان ولیعصر، خیابان کریم‌خان، پلاک ۱۲۳',
  phone1: '۰۲۱-۸۸۸۸۱۲۳۴',
  phone2: '۰۹۱۲-۳۴۵۶۷۸۹',
  hours: 'هر روز ۱۰:۰۰ تا ۰۲:۰۰ بامداد',
  email: 'info@gamenet.ir',
}

export default function AdminSettings() {
  const [hero, setHero] = useState(DEFAULT_HERO)
  const [features, setFeatures] = useState(DEFAULT_FEATURES)
  const [gallery, setGallery] = useState(DEFAULT_GALLERY)
  const [games, setGames] = useState(DEFAULT_GAMES)
  const [contact, setContact] = useState(DEFAULT_CONTACT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('site_settings').select('*').eq('id', 1).single().then(({ data, error }) => {
      if (data) {
        if (data.hero) setHero(data.hero)
        if (Array.isArray(data.features) && data.features.length) setFeatures(data.features)
        if (Array.isArray(data.gallery) && data.gallery.length) setGallery(data.gallery)
        if (Array.isArray(data.games) && data.games.length) setGames(data.games)
        if (data.contact) setContact(data.contact)
      } else if (error && !String(error.message).includes('No rows')) {
        setMsg('خطا در بارگذاری: ' + error.message)
      }
      setLoading(false)
    })
  }, [])

  const save = async () => {
    setSaving(true); setMsg(null)
    const { error } = await supabase.from('site_settings').update({
      hero, features, gallery, games, contact, updated_at: new Date().toISOString(),
    }).eq('id', 1)
    // if row missing, try upsert
    if (error && error.message.includes('0 rows')) {
      const { error: e2 } = await supabase.from('site_settings').insert({ id: 1, hero, features, gallery, games, contact } as any)
      if (e2) setMsg('خطا: ' + e2.message); else setMsg('✅ تنظیمات ذخیره شد')
    } else if (error) setMsg('خطا: ' + error.message)
    else setMsg('✅ تنظیمات ذخیره شد')
    setSaving(false)
    setTimeout(() => setMsg(null), 3000)
  }

  if (loading) return <div className="container" style={{ padding: 40, color: 'var(--muted)' }}>در حال بارگذاری…</div>

  return (
    <div className="container" style={{ padding: '20px 20px 40px', maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <h1 style={{ fontWeight: 900, fontSize: 22, display: 'flex', gap: 8, alignItems: 'center' }}>⚙️ تنظیمات سایت</h1>
        <button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'در حال ذخیره…' : 'ذخیره'}</button>
      </div>
      {msg && <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10, background: msg.startsWith('✅') ? 'rgba(0,229,160,.12)' : 'rgba(255,60,90,.12)', border: `1px solid ${msg.startsWith('✅') ? 'rgba(0,229,160,.3)' : 'rgba(255,60,90,.3)'}`, color: msg.startsWith('✅') ? 'var(--accent)' : '#ff6b7a', fontSize: 13 }}>{msg}</div>}

      {/* Hero */}
      <div className="card" style={{ padding: 16, marginBottom: 14 }}>
        <h3 style={{ fontWeight: 800, marginBottom: 12 }}>بخش هیرو</h3>
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><label style={{ fontSize: 11, color: 'var(--muted)' }}>بج (Badge)</label><input className="input" value={hero.badge} onChange={e => setHero({ ...hero, badge: e.target.value })} /></div>
            <div><label style={{ fontSize: 11, color: 'var(--muted)' }}>عنوان اول</label><input className="input" value={hero.title1} onChange={e => setHero({ ...hero, title1: e.target.value })} /></div>
          </div>
          <div><label style={{ fontSize: 11, color: 'var(--muted)' }}>عنوان دوم (گرادیانت)</label><input className="input" value={hero.title2} onChange={e => setHero({ ...hero, title2: e.target.value })} /></div>
          <div><label style={{ fontSize: 11, color: 'var(--muted)' }}>توضیحات</label><textarea className="input" rows={2} value={hero.desc} onChange={e => setHero({ ...hero, desc: e.target.value })} style={{ resize: 'vertical' }} /></div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 11, color: 'var(--muted)' }}>آمارها</label>
              <button className="btn btn-ghost btn-sm" onClick={() => setHero({ ...hero, stats: [...hero.stats, { label: '', value: '' }] })}>+ افزودن</button>
            </div>
            {hero.stats.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <input className="input" placeholder="برچسب" value={s.label} onChange={e => { const a = [...hero.stats]; a[i] = { ...a[i], label: e.target.value }; setHero({ ...hero, stats: a }) }} />
                <input className="input" placeholder="مقدار" value={s.value} onChange={e => { const a = [...hero.stats]; a[i] = { ...a[i], value: e.target.value }; setHero({ ...hero, stats: a }) }} />
                <button className="btn btn-ghost btn-sm" style={{ color: '#ff6b7a' }} onClick={() => setHero({ ...hero, stats: hero.stats.filter((_, j) => j !== i) })}>حذف</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="card" style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontWeight: 800 }}>ویژگی‌ها</h3>
          <button className="btn btn-ghost btn-sm" onClick={() => setFeatures([...features, { title: '', desc: '', icon: '✨' }])}>+ افزودن</button>
        </div>
        {features.map((f, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, background: 'rgba(255,255,255,.04)', padding: 10, borderRadius: 10, alignItems: 'center' }}>
            <input className="input" placeholder="آیکون" value={f.icon} onChange={e => { const a = [...features]; a[i] = { ...a[i], icon: e.target.value }; setFeatures(a) }} style={{ width: 60, textAlign: 'center' }} />
            <div style={{ flex: 1, display: 'grid', gap: 6 }}>
              <input className="input" placeholder="عنوان" value={f.title} onChange={e => { const a = [...features]; a[i] = { ...a[i], title: e.target.value }; setFeatures(a) }} />
              <input className="input" placeholder="توضیحات" value={f.desc} onChange={e => { const a = [...features]; a[i] = { ...a[i], desc: e.target.value }; setFeatures(a) }} />
            </div>
            <button className="btn btn-ghost btn-sm" style={{ color: '#ff6b7a' }} onClick={() => setFeatures(features.filter((_, j) => j !== i))}>حذف</button>
          </div>
        ))}
        {features.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 12, textAlign: 'center', padding: 10 }}>بدون ویژگی</p>}
      </div>

      {/* Gallery */}
      <div className="card" style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontWeight: 800 }}>گالری</h3>
          <button className="btn btn-ghost btn-sm" onClick={() => setGallery([...gallery, { title: '', tag: '', img: '' }])}>+ افزودن</button>
        </div>
        {gallery.map((g, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, background: 'rgba(255,255,255,.04)', padding: 10, borderRadius: 10, alignItems: 'flex-start' }}>
            <div style={{ width: 80, height: 56, borderRadius: 8, overflow: 'hidden', background: '#0d1326', border: '1px solid var(--line)', flexShrink: 0, display: 'grid', placeItems: 'center' }}>
              {g.img ? <img src={g.img} alt={g.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => (e.currentTarget.style.display = 'none')} /> : <span style={{ fontSize: 10, color: 'var(--muted)' }}>پیش‌نمایش</span>}
            </div>
            <div style={{ flex: 1, display: 'grid', gap: 6 }}>
              <input className="input" placeholder="آدرس تصویر (https://...)" value={g.img} onChange={e => { const a = [...gallery]; a[i] = { ...a[i], img: e.target.value }; setGallery(a) }} dir="ltr" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <input className="input" placeholder="عنوان" value={g.title} onChange={e => { const a = [...gallery]; a[i] = { ...a[i], title: e.target.value }; setGallery(a) }} />
                <input className="input" placeholder="تگ" value={g.tag} onChange={e => { const a = [...gallery]; a[i] = { ...a[i], tag: e.target.value }; setGallery(a) }} />
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" style={{ color: '#ff6b7a', alignSelf: 'center' }} onClick={() => setGallery(gallery.filter((_, j) => j !== i))}>حذف</button>
          </div>
        ))}
        {gallery.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 12, textAlign: 'center', padding: 10 }}>بدون تصویر</p>}
      </div>

      {/* Games */}
      <div className="card" style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontWeight: 800 }}>بازی‌ها</h3>
          <button className="btn btn-ghost btn-sm" onClick={() => setGames([...games, { name: '', icon: '🎮' }])}>+ افزودن</button>
        </div>
        {games.map((g, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, background: 'rgba(255,255,255,.04)', padding: 10, borderRadius: 10, alignItems: 'center' }}>
            <input className="input" placeholder="⚽" value={g.icon} onChange={e => { const a = [...games]; a[i] = { ...a[i], icon: e.target.value }; setGames(a) }} style={{ width: 60, textAlign: 'center' }} />
            <input className="input" placeholder="نام بازی" value={g.name} onChange={e => { const a = [...games]; a[i] = { ...a[i], name: e.target.value }; setGames(a) }} style={{ flex: 1 }} />
            <span style={{ fontSize: 18, minWidth: 28, textAlign: 'center' }}>{g.icon || '🎮'}</span>
            <button className="btn btn-ghost btn-sm" style={{ color: '#ff6b7a' }} onClick={() => setGames(games.filter((_, j) => j !== i))}>حذف</button>
          </div>
        ))}
        {games.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 12, textAlign: 'center', padding: 10 }}>بدون بازی</p>}
      </div>

      {/* Contact */}
      <div className="card" style={{ padding: 16, marginBottom: 14 }}>
        <h3 style={{ fontWeight: 800, marginBottom: 12 }}>اطلاعات تماس</h3>
        <div style={{ display: 'grid', gap: 10 }}>
          <div><label style={{ fontSize: 11, color: 'var(--muted)' }}>آدرس</label><textarea className="input" rows={2} value={contact.address} onChange={e => setContact({ ...contact, address: e.target.value })} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><label style={{ fontSize: 11, color: 'var(--muted)' }}>تلفن ۱</label><input className="input" value={contact.phone1} onChange={e => setContact({ ...contact, phone1: e.target.value })} dir="ltr" /></div>
            <div><label style={{ fontSize: 11, color: 'var(--muted)' }}>تلفن ۲</label><input className="input" value={contact.phone2} onChange={e => setContact({ ...contact, phone2: e.target.value })} dir="ltr" /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><label style={{ fontSize: 11, color: 'var(--muted)' }}>ساعت کاری</label><input className="input" value={contact.hours} onChange={e => setContact({ ...contact, hours: e.target.value })} /></div>
            <div><label style={{ fontSize: 11, color: 'var(--muted)' }}>ایمیل</label><input className="input" value={contact.email} onChange={e => setContact({ ...contact, email: e.target.value })} dir="ltr" /></div>
          </div>
        </div>
      </div>

      <button className="btn btn-primary" style={{ width: '100%' }} disabled={saving} onClick={save}>{saving ? 'در حال ذخیره…' : 'ذخیره تنظیمات'}</button>
    </div>
  )
}
