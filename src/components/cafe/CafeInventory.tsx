import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fa, faDT, type CafeProduct, type CafeStockMove } from '../../lib/cafe'
import { Modal, Field, Msg, Empty } from './ui'

const CATS = ['نوشیدنی', 'خوراکی', 'تنقلات', 'عمومی']

export default function CafeInventory(){
  const [products, setProducts] = useState<CafeProduct[]>([])
  const [msg, setMsg] = useState<{ t: string; ok?: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState('')
  const [openForm, setOpenForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', category: CATS[0], buy_price: '', sell_price: '', stock: '0', low_stock: '5', is_active: true })
  const [stockInId, setStockInId] = useState<string | null>(null)
  const [stockIn, setStockIn] = useState({ qty: '', buy_price: '', note: '', pay_cash: true })
  const [movesFor, setMovesFor] = useState<string | null>(null)
  const [moves, setMoves] = useState<CafeStockMove[]>([])

  const load = async () => {
    const { data } = await supabase.from('cafe_products').select('*').order('is_active', { ascending: false }).order('name')
    setProducts((data as CafeProduct[]) || [])
  }
  useEffect(() => { load() }, [])

  const openNew = () => {
    setEditId(null)
    setForm({ name: '', category: CATS[0], buy_price: '', sell_price: '', stock: '0', low_stock: '5', is_active: true })
    setOpenForm(true)
  }
  const openEdit = (p: CafeProduct) => {
    setEditId(p.id)
    setForm({ name: p.name, category: p.category, buy_price: String(p.buy_price), sell_price: String(p.sell_price), stock: String(p.stock), low_stock: String(p.low_stock), is_active: p.is_active })
    setOpenForm(true)
  }

  const save = async () => {
    setBusy(true)
    const { error } = await supabase.rpc('cafe_save_product', {
      p_id: editId, p_name: form.name, p_category: form.category,
      p_buy_price: Number(form.buy_price) || 0, p_sell_price: Number(form.sell_price) || 0,
      p_stock: editId ? 0 : (Number(form.stock) || 0), p_low_stock: Number(form.low_stock) || 0, p_is_active: form.is_active,
    })
    setBusy(false)
    if (error) { setMsg({ t: error.message, ok: false }); return }
    setOpenForm(false)
    setMsg({ t: editId ? '✅ محصول ویرایش شد' : '✅ محصول اضافه شد', ok: true })
    load()
  }

  const del = async (p: CafeProduct) => {
    if (!confirm(`حذف محصول «${p.name}»؟`)) return
    const { error } = await supabase.rpc('cafe_delete_product', { p_product_id: p.id })
    if (error) setMsg({ t: error.message, ok: false })
    else { setMsg({ t: '🗑 محصول حذف شد', ok: true }); load() }
  }

  const doStockIn = async () => {
    if (!stockInId) return
    setBusy(true)
    const { error } = await supabase.rpc('cafe_stock_in', {
      p_product_id: stockInId, p_qty: Number(stockIn.qty) || 0,
      p_buy_price: stockIn.buy_price ? Number(stockIn.buy_price) : null,
      p_note: stockIn.note || null, p_pay_cash: stockIn.pay_cash,
    })
    setBusy(false)
    if (error) { setMsg({ t: error.message, ok: false }); return }
    setStockInId(null); setStockIn({ qty: '', buy_price: '', note: '', pay_cash: true })
    setMsg({ t: '📥 ورود کالا ثبت شد' + (stockIn.pay_cash ? ' — وجه خرید از صندوق کسر شد' : ''), ok: true })
    load()
  }

  const showMoves = async (id: string) => {
    if (movesFor === id) { setMovesFor(null); return }
    setMovesFor(id)
    const { data } = await supabase.from('cafe_stock_moves').select('*, profiles(username)').eq('product_id', id).order('created_at', { ascending: false }).limit(10)
    setMoves((data as CafeStockMove[]) || [])
  }

  const filtered = q ? products.filter(p => p.name.includes(q) || p.category.includes(q)) : products

  return (
    <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
      {msg && <Msg text={msg.t} tone={msg.ok ? 'ok' : 'err'} />}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input className="input" placeholder="جستجو…" value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: 200, padding: '7px 12px', fontSize: 12, borderRadius: 999 }} />
        <button className="btn btn-primary btn-sm" onClick={openNew}>+ محصول جدید</button>
      </div>

      {filtered.length === 0 ? <Empty text="محصولی نیست." /> : (
        <div style={{ display: 'grid', gap: 8 }}>
          {filtered.map(p => {
            const low = p.stock <= p.low_stock
            return (
              <div key={p.id} className="card" style={{ padding: '10px 12px', opacity: p.is_active ? 1 : .55 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 12 }}>
                      {p.name} {!p.is_active && <span className="badge" style={{ fontSize: 9 }}>غیرفعال</span>}
                      {low && p.is_active && <span className="badge" style={{ fontSize: 9, color: p.stock === 0 ? '#ff6b7a' : '#ffb84d' }}>{p.stock === 0 ? 'ناموجود' : 'کمبود موجودی'}</span>}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                      {p.category} · خرید {fa(p.buy_price)} · فروش {fa(p.sell_price)} ت · هشدار زیر {fa(p.low_stock)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="badge" style={{ fontSize: 11, color: low ? '#ffb84d' : 'var(--accent)' }}>موجودی: {fa(p.stock)}</span>
                    <button className="btn btn-ghost btn-sm" onClick={() => showMoves(p.id)}>گردش</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setStockInId(p.id); setStockIn({ qty: '', buy_price: String(p.buy_price), note: '', pay_cash: true }) }}>📥 ورود کالا</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>ویرایش</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => del(p)} style={{ color: '#ff6b7a' }}>حذف</button>
                  </div>
                </div>
                {movesFor === p.id && (
                  <div style={{ marginTop: 8, borderTop: '1px solid var(--line)', paddingTop: 8, display: 'grid', gap: 4 }}>
                    {moves.length === 0 ? <div style={{ fontSize: 11, color: 'var(--muted)' }}>گردشی ثبت نشده.</div> : moves.map(m => (
                      <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                        <span>
                          <span style={{ color: m.qty > 0 ? 'var(--accent)' : '#ff6b7a', fontWeight: 800 }}>{m.qty > 0 ? '+' : ''}{fa(m.qty)}</span>
                          {' '}{m.reason || '—'}
                        </span>
                        <span style={{ color: 'var(--muted)' }}>{faDT(m.created_at)} · {m.profiles?.username || '—'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* فرم محصول */}
      <Modal open={openForm} onClose={() => setOpenForm(false)} title={editId ? 'ویرایش محصول' : 'محصول جدید'}>
        <Field label="نام محصول"><input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="دسته‌بندی">
          <select className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
            {CATS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field label="قیمت خرید (تومان)"><input className="input" type="number" min={0} value={form.buy_price} onChange={e => setForm({ ...form, buy_price: e.target.value })} /></Field>
          <Field label="قیمت فروش (تومان)"><input className="input" type="number" min={0} value={form.sell_price} onChange={e => setForm({ ...form, sell_price: e.target.value })} /></Field>
          {!editId && <Field label="موجودی اولیه"><input className="input" type="number" min={0} value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} /></Field>}
          <Field label="هشدار کمبود (عدد)"><input className="input" type="number" min={0} value={form.low_stock} onChange={e => setForm({ ...form, low_stock: e.target.value })} /></Field>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 12 }}>
          <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
          فعال (در صفحه فروش نمایش داده شود)
        </label>
        {editId && <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 10 }}>موجودی فقط از طریق «ورود کالا» یا ثبت فروش تغییر می‌کند.</div>}
        <button className="btn btn-primary" disabled={busy} onClick={save} style={{ width: '100%' }}>{busy ? '…' : 'ذخیره'}</button>
      </Modal>

      {/* ورود کالا */}
      <Modal open={!!stockInId} onClose={() => setStockInId(null)} title="ورود کالا به انبار">
        <Field label="تعداد ورودی"><input className="input" type="number" min={1} value={stockIn.qty} onChange={e => setStockIn({ ...stockIn, qty: e.target.value })} /></Field>
        <Field label="قیمت خرید واحد (تومان) — خالی = بدون تغییر"><input className="input" type="number" min={0} value={stockIn.buy_price} onChange={e => setStockIn({ ...stockIn, buy_price: e.target.value })} /></Field>
        <Field label="یادداشت"><input className="input" value={stockIn.note} onChange={e => setStockIn({ ...stockIn, note: e.target.value })} /></Field>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 12 }}>
          <input type="checkbox" checked={stockIn.pay_cash} onChange={e => setStockIn({ ...stockIn, pay_cash: e.target.checked })} />
          خرید نقدی است (از صندوق کسر شود)
        </label>
        <button className="btn btn-primary" disabled={busy} onClick={doStockIn} style={{ width: '100%' }}>{busy ? '…' : 'ثبت ورود'}</button>
      </Modal>
    </div>
  )
}
