import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fa, faDT, METHOD_LABEL, type CafeProduct, type CafePerson, type CafeSale } from '../../lib/cafe'
import { Field, Msg, Empty } from './ui'

type CartRow = { qty: number; price: number }

export default function CafeSales(){
  const [products, setProducts] = useState<CafeProduct[]>([])
  const [people, setPeople] = useState<CafePerson[]>([])
  const [sales, setSales] = useState<CafeSale[]>([])
  const [cart, setCart] = useState<Record<string, CartRow>>({})
  const [method, setMethod] = useState<'cash' | 'card' | 'credit'>('cash')
  const [personId, setPersonId] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ t: string; ok?: boolean } | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = async () => {
    const [{ data: ps }, { data: ppl }, { data: ss }] = await Promise.all([
      supabase.from('cafe_products').select('*').eq('is_active', true).order('name'),
      supabase.from('cafe_people').select('*').eq('is_active', true).order('name'),
      supabase.from('cafe_sales').select('*, profiles(username), cafe_sale_items(*)').order('created_at', { ascending: false }).limit(25),
    ])
    setProducts((ps as CafeProduct[]) || [])
    setPeople((ppl as CafePerson[]) || [])
    setSales((ss as CafeSale[]) || [])
  }
  useEffect(() => { load() }, [])

  const total = Object.entries(cart).reduce((s, [, r]) => s + r.qty * r.price, 0)

  const addToCart = (p: CafeProduct) => {
    setMsg(null)
    setCart(c => ({ ...c, [p.id]: { qty: (c[p.id]?.qty || 0) + 1, price: c[p.id]?.price ?? p.sell_price } }))
  }
  const setQty = (id: string, q: number) => setCart(c => { const n = { ...c }; if (q < 1) delete n[id]; else n[id] = { ...n[id], qty: q }; return n })
  const setPrice = (id: string, v: number) => setCart(c => ({ ...c, [id]: { ...c[id], price: Math.max(0, v) } }))

  const submit = async () => {
    const items = Object.entries(cart).map(([product_id, r]) => ({ product_id, qty: r.qty, unit_price: r.price }))
    if (!items.length) { setMsg({ t: 'سبد فروش خالی است', ok: false }); return }
    if (method === 'credit' && !personId) { setMsg({ t: 'برای فروش نسیه، مشتری را انتخاب کنید', ok: false }); return }
    setBusy(true)
    const { error } = await supabase.rpc('cafe_record_sale', { p_items: items, p_method: method, p_person_id: method === 'credit' ? personId : null, p_note: note || null })
    setBusy(false)
    if (error) { setMsg({ t: error.message, ok: false }); return }
    setCart({}); setNote(''); setMethod('cash'); setPersonId('')
    setMsg({ t: '✅ فروش با موفقیت ثبت شد — انبار و صندوق به‌روزرسانی شد', ok: true })
    load()
  }

  const delSale = async (id: string) => {
    if (!confirm('حذف فروش؟ موجودی انبار برگشت داده شده و قلم صندوق/بدهی اصلاح می‌شود.')) return
    const { error } = await supabase.rpc('cafe_delete_sale', { p_sale_id: id })
    if (error) setMsg({ t: error.message, ok: false })
    else { setMsg({ t: '↩️ فروش حذف شد و موجودی برگشت خورد', ok: true }); load() }
  }

  return (
    <div style={{ marginTop: 14, display: 'grid', gap: 14 }}>
      {msg && <Msg text={msg.t} tone={msg.ok ? 'ok' : 'err'} />}

      {/* محصولات */}
      <div>
        <h3 style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>🧾 محصولات بوفه</h3>
        {products.length === 0 ? <Empty text="هنوز محصولی ثبت نشده — از تب «مدیریت انبار» اضافه کنید." /> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 8 }}>
            {products.map(p => (
              <button key={p.id} className="card" onClick={() => addToCart(p)} style={{ padding: '10px 12px', textAlign: 'right', cursor: 'pointer' }}>
                <div style={{ fontWeight: 800, fontSize: 12 }}>{p.name}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{p.category}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                  <span style={{ fontWeight: 900, fontSize: 12, color: 'var(--accent)' }}>{fa(p.sell_price)} ت</span>
                  <span className="badge" style={{ fontSize: 10, color: p.stock <= p.low_stock ? '#ffb84d' : undefined }}>{fa(p.stock)} عدد</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* سبد فروش */}
      <div className="card" style={{ padding: 14 }}>
        <h3 style={{ fontWeight: 800, fontSize: 13, marginBottom: 10 }}>🛒 سبد فروش</h3>
        {Object.keys(cart).length === 0 ? <div style={{ fontSize: 12, color: 'var(--muted)' }}>برای افزودن، روی محصول کلیک کنید.</div> : (
          <div style={{ display: 'grid', gap: 8 }}>
            {Object.entries(cart).map(([id, r]) => {
              const p = products.find(x => x.id === id)
              return (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface2)', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 10px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 90 }}>
                    <div style={{ fontWeight: 800, fontSize: 12 }}>{p?.name || 'محصول'}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>موجودی: {fa(p?.stock || 0)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setQty(id, r.qty - 1)}>−</button>
                    <span style={{ fontWeight: 900, minWidth: 22, textAlign: 'center' }}>{fa(r.qty)}</span>
                    <button className="btn btn-ghost btn-sm" onClick={() => setQty(id, r.qty + 1)}>+</button>
                  </div>
                  <input className="input" type="number" min={0} value={r.price} onChange={e => setPrice(id, Number(e.target.value))} style={{ width: 110, padding: '6px 10px', fontSize: 12 }} />
                  <span style={{ fontWeight: 800, fontSize: 12, minWidth: 70, textAlign: 'left', color: 'var(--accent)' }}>{fa(r.qty * r.price)} ت</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => setQty(id, 0)} style={{ color: '#ff6b7a' }}>🗑</button>
                </div>
              )
            })}
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
          {(['cash', 'card', 'credit'] as const).map(m => (
            <button key={m} className={method === m ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'} onClick={() => setMethod(m)}>
              {m === 'cash' ? '💵 نقدی' : m === 'card' ? '💳 کارت‌خوان' : '📒 نسیه'}
            </button>
          ))}
        </div>

        {method === 'credit' && (
          <div style={{ marginTop: 10 }}>
            <Field label="مشتری (بدهکار)">
              <select className="input" value={personId} onChange={e => setPersonId(e.target.value)}>
                <option value="">— انتخاب مشتری —</option>
                {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
          </div>
        )}
        <Field label="یادداشت (اختیاری)">
          <input className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="مثلاً مشتری میز ۳" />
        </Field>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            مجموع: <b style={{ color: 'var(--accent)', fontSize: 16 }}>{fa(total)} تومان</b>
            <span style={{ marginInlineStart: 10 }}>{METHOD_LABEL[method]}</span>
          </div>
          <button className="btn btn-primary" disabled={busy} onClick={submit}>{busy ? '…' : 'ثبت فروش'}</button>
        </div>
      </div>

      {/* فروش‌های اخیر */}
      <div>
        <h3 style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>📋 فروش‌های اخیر</h3>
        {sales.length === 0 ? <Empty text="فروشی ثبت نشده." /> : (
          <div style={{ display: 'grid', gap: 8 }}>
            {sales.map(s => {
              const mc = s.method === 'cash' ? 'var(--accent)' : s.method === 'card' ? '#6d9efc' : '#ff6b7a'
              return (
                <div key={s.id} className="card" style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div onClick={() => setExpanded(expanded === s.id ? null : s.id)} style={{ cursor: 'pointer', minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 12 }}>{fa(s.total)} ت · {METHOD_LABEL[s.method]}{(s as any).cafe_sale_items?.length ? ` · ${fa((s as any).cafe_sale_items.length)} قلم` : ''}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                        {faDT(s.created_at)} · {s.profiles?.username || '—'}{s.note ? ` · ${s.note}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span className="badge" style={{ fontSize: 10, color: mc }}>{METHOD_LABEL[s.method]}</span>
                      <button className="btn btn-ghost btn-sm" onClick={() => setExpanded(expanded === s.id ? null : s.id)}>جزئیات</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => delSale(s.id)} style={{ color: '#ff6b7a' }}>حذف</button>
                    </div>
                  </div>
                  {expanded === s.id && (
                    <div style={{ marginTop: 8, borderTop: '1px solid var(--line)', paddingTop: 8, display: 'grid', gap: 4 }}>
                      {((s as any).cafe_sale_items || []).map((it: any) => (
                        <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                          <span>{it.product_name} × {fa(it.qty)}</span>
                          <span>{fa(it.unit_price)} ت — سود: {fa(it.qty * (it.unit_price - it.unit_cost))} ت</span>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                        <span>بهای تمام‌شده: {fa(s.cost_total)} ت</span>
                        <span style={{ color: 'var(--accent)' }}>سود کل فروش: {fa(s.total - s.cost_total)} ت</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
