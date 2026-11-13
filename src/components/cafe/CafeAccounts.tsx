import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fa, faDT, LEDGER_LABEL, type CafePerson, type CafeLedger } from '../../lib/cafe'
import { Modal, Field, Msg, Empty } from './ui'

export default function CafeAccounts(){
  const [people, setPeople] = useState<CafePerson[]>([])
  const [ledger, setLedger] = useState<CafeLedger[]>([])
  const [msg, setMsg] = useState<{ t: string; ok?: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState('')
  const [openPerson, setOpenPerson] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', phone: '', note: '' })
  const [detailId, setDetailId] = useState<string | null>(null)
  const [entry, setEntry] = useState({ type: 'debt' as 'debt' | 'settle', amount: '', note: '' })

  const load = async () => {
    const [{ data: ppl }, { data: lg }] = await Promise.all([
      supabase.from('cafe_people').select('*').order('is_active', { ascending: false }).order('name'),
      supabase.from('cafe_ledger').select('*, profiles(username)').order('created_at', { ascending: false }).limit(500),
    ])
    setPeople((ppl as CafePerson[]) || [])
    setLedger((lg as CafeLedger[]) || [])
  }
  useEffect(() => { load() }, [])

  const balanceOf = (id: string) => ledger.filter(l => l.person_id === id).reduce((s, l) => s + Number(l.amount), 0)

  const savePerson = async () => {
    setBusy(true)
    const { error } = await supabase.rpc('cafe_person_save', { p_id: editId, p_name: form.name, p_phone: form.phone || null, p_note: form.note || null, p_is_active: true })
    setBusy(false)
    if (error) { setMsg({ t: error.message, ok: false }); return }
    setOpenPerson(false); setEditId(null); setForm({ name: '', phone: '', note: '' })
    setMsg({ t: '✅ ذخیره شد', ok: true }); load()
  }
  const delPerson = async (p: CafePerson) => {
    if (!confirm(`حذف «${p.name}»؟`)) return
    const { error } = await supabase.rpc('cafe_person_delete', { p_person_id: p.id })
    if (error) setMsg({ t: error.message, ok: false })
    else { setMsg({ t: '🗑 حذف شد', ok: true }); load() }
  }
  const submitEntry = async () => {
    if (!detailId) return
    setBusy(true)
    const { error } = await supabase.rpc('cafe_ledger_entry', { p_person_id: detailId, p_type: entry.type, p_amount: Number(entry.amount) || 0, p_note: entry.note || null })
    setBusy(false)
    if (error) { setMsg({ t: error.message, ok: false }); return }
    setEntry({ type: 'debt', amount: '', note: '' })
    setMsg({ t: '✅ ثبت شد', ok: true }); load()
  }

  const detail = people.find(p => p.id === detailId)
  const detailRows = detail ? ledger.filter(l => l.person_id === detail.id) : []
  const filtered = q ? people.filter(p => p.name.includes(q) || (p.phone || '').includes(q)) : people

  return (
    <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
      {msg && <Msg text={msg.t} tone={msg.ok ? 'ok' : 'err'} />}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input className="input" placeholder="جستجو…" value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: 200, padding: '7px 12px', fontSize: 12, borderRadius: 999 }} />
        <button className="btn btn-primary btn-sm" onClick={() => { setEditId(null); setForm({ name: '', phone: '', note: '' }); setOpenPerson(true) }}>+ شخص جدید</button>
      </div>

      {filtered.length === 0 ? <Empty text="شخصی ثبت نشده." /> : (
        <div style={{ display: 'grid', gap: 8 }}>
          {filtered.map(p => {
            const b = balanceOf(p.id)
            return (
              <div key={p.id} className="card" style={{ padding: '10px 12px', opacity: p.is_active ? 1 : .55 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 12 }}>{p.name}</div>
                    {p.phone && <div style={{ fontSize: 10, color: 'var(--muted)' }} dir="ltr">{p.phone}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="badge" style={{ fontSize: 11, color: b > 0 ? '#ff6b7a' : b < 0 ? 'var(--accent)' : undefined }}>
                      {b > 0 ? `بدهکار: ${fa(b)} ت` : b < 0 ? `بستانکار: ${fa(-b)} ت` : 'تسویه ✅'}
                    </span>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setDetailId(p.id); setEntry({ type: 'debt', amount: '', note: '' }) }}>گردش حساب</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditId(p.id); setForm({ name: p.name, phone: p.phone || '', note: p.note || '' }); setOpenPerson(true) }}>ویرایش</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => delPerson(p)} style={{ color: '#ff6b7a' }}>حذف</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* فرم شخص */}
      <Modal open={openPerson} onClose={() => setOpenPerson(false)} title={editId ? 'ویرایش شخص' : 'شخص جدید'}>
        <Field label="نام"><input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="تلفن (اختیاری)"><input className="input" dir="ltr" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></Field>
        <Field label="یادداشت (اختیاری)"><input className="input" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></Field>
        <button className="btn btn-primary" disabled={busy} onClick={savePerson} style={{ width: '100%' }}>{busy ? '…' : 'ذخیره'}</button>
      </Modal>

      {/* گردش حساب */}
      <Modal open={!!detailId} onClose={() => setDetailId(null)} title={`گردش حساب — ${detail?.name || ''}`} wide>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <span className="badge" style={{ color: balanceOf(detailId || '') > 0 ? '#ff6b7a' : 'var(--accent)' }}>
            مانده: {fa(balanceOf(detailId || ''))} تومان
          </span>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <button className={entry.type === 'debt' ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'} onClick={() => setEntry({ ...entry, type: 'debt' })}>ثبت بدهی</button>
          <button className={entry.type === 'settle' ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'} onClick={() => setEntry({ ...entry, type: 'settle' })}>تسویه حساب</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field label="مبلغ (تومان)"><input className="input" type="number" min={1} value={entry.amount} onChange={e => setEntry({ ...entry, amount: e.target.value })} /></Field>
          <Field label="یادداشت"><input className="input" value={entry.note} onChange={e => setEntry({ ...entry, note: e.target.value })} /></Field>
        </div>
        <button className="btn btn-primary" disabled={busy} onClick={submitEntry} style={{ width: '100%', marginBottom: 14 }}>
          {busy ? '…' : entry.type === 'debt' ? 'ثبت بدهی' : 'ثبت تسویه (وجه در صندوق ثبت می‌شود)'}
        </button>

        <h4 style={{ fontWeight: 800, fontSize: 12, marginBottom: 8 }}>📜 گردش حساب</h4>
        {detailRows.length === 0 ? <div style={{ fontSize: 12, color: 'var(--muted)' }}>گردشی ثبت نشده.</div> : (
          <div style={{ display: 'grid', gap: 6 }}>
            {detailRows.map(l => (
              <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, background: 'var(--surface2)', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 10px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>
                    <span style={{ color: l.amount > 0 ? '#ff6b7a' : 'var(--accent)' }}>{l.amount > 0 ? '+' : ''}{fa(l.amount)} ت</span>
                    {' '}· {LEDGER_LABEL[l.type] || l.type}{l.note ? ` — ${l.note}` : ''}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>{faDT(l.created_at)} · ثبت‌کننده: {l.profiles?.username || '—'}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
