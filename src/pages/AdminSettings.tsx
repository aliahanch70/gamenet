import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { WIDGET_CATALOG, type Widget, type WidgetType, newId } from '../lib/widgets'

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

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 16, marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontWeight: 800, fontSize: 14 }}>{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}

export default function AdminSettings() {
  const [hero, setHero] = useState(DEFAULT_HERO)
  const [features, setFeatures] = useState(DEFAULT_FEATURES)
  const [gallery, setGallery] = useState(DEFAULT_GALLERY)
  const [games, setGames] = useState(DEFAULT_GAMES)
  const [contact, setContact] = useState(DEFAULT_CONTACT)
  const [widgets, setWidgets] = useState<Widget[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('site_settings').select('hero,features,gallery,games,contact,widgets').eq('id', 1).single().then(({ data, error }) => {
      if (data) {
        if (data.hero) setHero(data.hero)
        if (Array.isArray(data.features) && data.features.length) setFeatures(data.features)
        if (Array.isArray(data.gallery) && data.gallery.length) setGallery(data.gallery)
        if (Array.isArray(data.games) && data.games.length) setGames(data.games)
        if (data.contact) setContact(data.contact)
        if (Array.isArray((data as any).widgets)) setWidgets((data as any).widgets as Widget[])
      } else if (error && !String(error.message).includes('No rows')) {
        setMsg('خطا در بارگذاری: ' + error.message)
      }
      setLoading(false)
    })
  }, [])

  const save = async () => {
    setSaving(true); setMsg(null)
    const payload: any = { hero, features, gallery, games, contact, widgets, updated_at: new Date().toISOString() }
    const { error } = await supabase.from('site_settings').update(payload).eq('id', 1)
    if (error && error.message.includes('0 rows')) {
      const { error: e2 } = await supabase.from('site_settings').insert({ id: 1, hero, features, gallery, games, contact, widgets } as any)
      if (e2) setMsg('خطا: ' + e2.message); else setMsg('✅ تنظیمات ذخیره شد')
    } else if (error) setMsg('خطا: ' + error.message)
    else setMsg('✅ تنظیمات ذخیره شد')
    setSaving(false)
    setTimeout(() => setMsg(null), 3000)
  }

  const addWidget = (type: WidgetType) => {
    const c = WIDGET_CATALOG[type]
    setWidgets(w => [...w, { id: newId(), type, enabled: true, title: c.label, props: JSON.parse(JSON.stringify(c.defaults)) } as Widget])
  }
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= widgets.length) return
    const a = [...widgets]; const tmp = a[i]; a[i] = a[j]; a[j] = tmp; setWidgets(a)
  }

  if (loading) return <div className="container" style={{ padding: 40, color: 'var(--muted)' }}>در حال بارگذاری…</div>

  return (
    <div className="container" style={{ padding: '20px 20px 40px', maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontWeight: 900, fontSize: 22, display: 'flex', gap: 8, alignItems: 'center' }}>⚙️ تنظیمات سایت</h1>
          <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>هر بخشِ صفحه اصلی اینجاست — متن‌ها را ویرایش کن، ویجت‌ها را روشن/خاموش یا جابه‌جا کن، سپس ذخیره.</p>
        </div>
        <button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'در حال ذخیره…' : 'ذخیره'}</button>
      </div>
      {msg && <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10, background: msg.startsWith('✅') ? 'rgba(0,229,160,.12)' : 'rgba(255,60,90,.12)', border: `1px solid ${msg.startsWith('✅') ? 'rgba(0,229,160,.3)' : 'rgba(255,60,90,.3)'}`, color: msg.startsWith('✅') ? 'var(--accent)' : '#ff6b7a', fontSize: 13 }}>{msg}</div>}

      {/* ── Hero */}
      <Card title="🌟 هیرو (بالای صفحه)">
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><label style={{ fontSize: 11, color: 'var(--muted)' }}>بج (Badge)</label><input className="input" value={hero.badge} onChange={e => setHero({ ...hero, badge: e.target.value })} /></div>
            <div><label style={{ fontSize: 11, color: 'var(--muted)' }}>عنوان اول</label><input className="input" value={hero.title1} onChange={e => setHero({ ...hero, title1: e.target.value })} /></div>
          </div>
          <div><label style={{ fontSize: 11, color: 'var(--muted)' }}>عنوان دوم (گرادیانت)</label><input className="input" value={hero.title2} onChange={e => setHero({ ...hero, title2: e.target.value })} /></div>
          <div><label style={{ fontSize: 11, color: 'var(--muted)' }}>توضیحات</label><textarea className="input" rows={2} value={hero.desc} onChange={e => setHero({ ...hero, desc: e.target.value })} /></div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 11, color: 'var(--muted)' }}>آمارهای هیرو</label>
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
      </Card>

      {/* ── Features */}
      <Card title="✨ ویژگی‌ها (۳ کارت وسط)" action={<button className="btn btn-ghost btn-sm" onClick={() => setFeatures([...features, { title: '', desc: '', icon: '✨' }])}>+ افزودن</button>}>
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
        {features.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 12, textAlign: 'center', padding: 10 }}>بدون ویژگی — یک مورد اضافه کن تا در لندینگ نمایش یابد.</p>}
      </Card>

      {/* ── Gallery */}
      <Card title="🖼️ گالری بازی‌ها" action={<button className="btn btn-ghost btn-sm" onClick={() => setGallery([...gallery, { title: '', tag: '', img: '' }])}>+ افزودن</button>}>
        {gallery.map((g, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, background: 'rgba(255,255,255,.04)', padding: 10, borderRadius: 10, alignItems: 'flex-start' }}>
            <div style={{ width: 80, height: 56, borderRadius: 8, overflow: 'hidden', background: '#0d1326', border: '1px solid var(--line)', flexShrink: 0, display: 'grid', placeItems: 'center' }}>
              {g.img ? <img src={g.img} alt={g.title} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => (e.currentTarget.style.display = 'none')} /> : <span style={{ fontSize: 10, color: 'var(--muted)' }}>پیش‌نمایش</span>}
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
      </Card>

      {/* ── Games */}
      <Card title="🎮 برچسب بازی‌ها" action={<button className="btn btn-ghost btn-sm" onClick={() => setGames([...games, { name: '', icon: '🎮' }])}>+ افزودن</button>}>
        {games.map((g, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, background: 'rgba(255,255,255,.04)', padding: 10, borderRadius: 10, alignItems: 'center' }}>
            <input className="input" placeholder="⚽" value={g.icon} onChange={e => { const a = [...games]; a[i] = { ...a[i], icon: e.target.value }; setGames(a) }} style={{ width: 60, textAlign: 'center' }} />
            <input className="input" placeholder="نام بازی" value={g.name} onChange={e => { const a = [...games]; a[i] = { ...a[i], name: e.target.value }; setGames(a) }} style={{ flex: 1 }} />
            <span style={{ fontSize: 18, minWidth: 28, textAlign: 'center' }}>{g.icon || '🎮'}</span>
            <button className="btn btn-ghost btn-sm" style={{ color: '#ff6b7a' }} onClick={() => setGames(games.filter((_, j) => j !== i))}>حذف</button>
          </div>
        ))}
        {games.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 12, textAlign: 'center', padding: 10 }}>بدون بازی</p>}
      </Card>

      {/* ── Contact */}
      <Card title="📍 اطلاعات تماس">
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
      </Card>

      {/* ── Widgets */}
      <Card title={`🧩 ویجت‌ها · ${widgets.length} فعال`} action={<span style={{ fontSize: 11, color: 'var(--muted)' }}>روشن/خاموش · جابه‌جا · ویرایش</span>}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {(Object.keys(WIDGET_CATALOG) as WidgetType[]).map(k => {
            const c = WIDGET_CATALOG[k]
            return <button key={k} className="btn btn-ghost btn-sm" onClick={() => addWidget(k)} title={c.desc}>{c.icon} {c.label}</button>
          })}
        </div>
        {widgets.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 12, textAlign: 'center', padding: 12, border: '1px dashed var(--line)', borderRadius: 10 }}>ویجتی انتخاب نشده — از بالا یکی اضافه کن.</p>}
        {widgets.map((w, i) => {
          const cat = WIDGET_CATALOG[w.type]
          return (
            <div key={w.id} style={{ padding: 10, borderRadius: 10, background: w.enabled ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.02)', border: '1px solid var(--line)', marginBottom: 8, opacity: w.enabled ? 1 : 0.6 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 16 }}>{cat.icon}</span>
                <input className="input" value={w.title} onChange={e => { const a = [...widgets]; a[i] = { ...a[i], title: e.target.value }; setWidgets(a) }} style={{ flex: 1, minWidth: 120 }} placeholder="عنوان ویجت" />
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={w.enabled} onChange={e => { const a = [...widgets]; a[i] = { ...a[i], enabled: e.target.checked }; setWidgets(a) }} />
                  فعال
                </label>
                <button className="btn btn-ghost btn-sm" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                <button className="btn btn-ghost btn-sm" disabled={i === widgets.length - 1} onClick={() => move(i, 1)}>↓</button>
                <button className="btn btn-ghost btn-sm" style={{ color: '#ff6b7a' }} onClick={() => setWidgets(widgets.filter(x => x.id !== w.id))}>حذف</button>
              </div>

              {/* per-type editors — minimal */}
              {w.type === 'stats' && (
                <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                  {w.props.items.map((it: any, idx: number) => (
                    <div key={idx} style={{ display: 'flex', gap: 6 }}>
                      <input className="input" placeholder="برچسب" value={it.label} onChange={e => { const a = [...widgets]; (a[i].props.items[idx] as any).label = e.target.value; setWidgets(a) }} />
                      <input className="input" placeholder="مقدار" value={it.value} onChange={e => { const a = [...widgets]; (a[i].props.items[idx] as any).value = e.target.value; setWidgets(a) }} style={{ width: 120 }} />
                      <button className="btn btn-ghost btn-sm" onClick={() => { const a = [...widgets]; a[i].props.items.splice(idx, 1); setWidgets([...a]) }}>حذف</button>
                    </div>
                  ))}
                  <button className="btn btn-ghost btn-sm" onClick={() => { const a = [...widgets]; a[i].props.items.push({ label: '', value: '' }); setWidgets([...a]) }}>+ ردیف</button>
                </div>
              )}
              {w.type === 'promo' && (
                <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                  <input className="input" placeholder="متن بنر" value={w.props.text} onChange={e => { const a = [...widgets]; a[i].props.text = e.target.value; setWidgets(a) }} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <input className="input" placeholder="متن دکمه" value={w.props.cta} onChange={e => { const a = [...widgets]; a[i].props.cta = e.target.value; setWidgets(a) }} />
                    <input className="input" placeholder="لینک" value={w.props.link} onChange={e => { const a = [...widgets]; a[i].props.link = e.target.value; setWidgets(a) }} dir="ltr" />
                  </div>
                </div>
              )}
              {w.type === 'announcement' && (
                <div style={{ marginTop: 8 }}>
                  <input className="input" placeholder="متن نوار" value={w.props.text} onChange={e => { const a = [...widgets]; a[i].props.text = e.target.value; setWidgets(a) }} />
                </div>
              )}
              {w.type === 'faq' && (
                <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                  {w.props.items.map((it: any, idx: number) => (
                    <div key={idx} style={{ display: 'grid', gap: 4, padding: 8, background: 'rgba(255,255,255,.03)', borderRadius: 8 }}>
                      <input className="input" placeholder="سوال" value={it.q} onChange={e => { const a = [...widgets]; a[i].props.items[idx].q = e.target.value; setWidgets(a) }} />
                      <textarea className="input" rows={2} placeholder="پاسخ" value={it.a} onChange={e => { const a = [...widgets]; a[i].props.items[idx].a = e.target.value; setWidgets(a) }} />
                      <div style={{ textAlign: 'left' }}><button className="btn btn-ghost btn-sm" onClick={() => { const a = [...widgets]; a[i].props.items.splice(idx, 1); setWidgets([...a]) }}>حذف</button></div>
                    </div>
                  ))}
                  <button className="btn btn-ghost btn-sm" onClick={() => { const a = [...widgets]; a[i].props.items.push({ q: '', a: '' }); setWidgets([...a]) }}>+ سوال</button>
                </div>
              )}
              {w.type === 'testimonials' && (
                <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                  {w.props.items.map((it: any, idx: number) => (
                    <div key={idx} style={{ display: 'flex', gap: 6 }}>
                      <input className="input" placeholder="نام" value={it.name} onChange={e => { const a = [...widgets]; a[i].props.items[idx].name = e.target.value; setWidgets(a) }} style={{ width: 120 }} />
                      <input className="input" placeholder="نظر" value={it.text} onChange={e => { const a = [...widgets]; a[i].props.items[idx].text = e.target.value; setWidgets(a) }} />
                      <button className="btn btn-ghost btn-sm" onClick={() => { const a = [...widgets]; a[i].props.items.splice(idx, 1); setWidgets([...a]) }}>حذف</button>
                    </div>
                  ))}
                  <button className="btn btn-ghost btn-sm" onClick={() => { const a = [...widgets]; a[i].props.items.push({ name: '', text: '' }); setWidgets([...a]) }}>+ نظر</button>
                </div>
              )}
              {w.type === 'leaderboard' && (
                <p style={{ marginTop: 8, color: 'var(--muted)', fontSize: 12 }}>خودکار از موجودی کاربران پر می‌شود — تنظیم دستی ندارد.</p>
              )}
            </div>
          )
        })}
      </Card>

      <button className="btn btn-primary" style={{ width: '100%' }} disabled={saving} onClick={save}>{saving ? 'در حال ذخیره…' : 'ذخیره همه تنظیمات'}</button>
    </div>
  )
}
