import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fa, faDT, CASH_LABEL, type CafeCashMove, type CafePerson, type CafeDayClose, type CafeDashboardData } from '../../lib/cafe'
import { Modal, Field, Msg, Empty, Stat } from './ui'

export default function CafeCashbox(){
  const [moves, setMoves] = useState<CafeCashMove[]>([])
  const [closes, setCloses] = useState<CafeDayClose[]>([])
  const [people, setPeople] = useState<CafePerson[]>([])
  const [dash, setDash] = useState<CafeDashboardData | null>(null)
  const [msg, setMsg] = useState<{ t: string; ok?: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [openMove, setOpenMove] = useState(false)
  const [move, setMove] = useState({ type: 'income' as 'income' | 'expense' | 'receive' | 'pay', amount: '', note: '', personId: '' })
  const [openClose, setOpenClose] = useState(false)
  const [closeForm, setCloseForm] = useState({ counted: '', note: '' })
  const [closeResult, setCloseResult] = useState<any>(null)

  const load = async () => {
    const [{ data: mv }, { data: cl }, { data: ppl }, { data: d }] = await Promise.all([
      supabase.from('cafe_cash_moves').select('*, profiles(username)').order('created_at', { ascending: false }).limit(30),
      supabase.from('cafe_day_close').select('*, profiles(username)').order('closed_at', { ascending: false }).limit(10),
      supabase.from('cafe_people').select('*').eq('is_active', true).order('name'),
      supabase.rpc('cafe_dashboard'),
    ])
    setMoves((mv as CafeCashMove[]) || [])
    setCloses((cl as CafeDayClose[]) || [])
    setPeople((ppl as CafePerson[]) || [])
    if (d) setDash(d as CafeDashboardData)
  }
  useEffect(() => { load() }, [])

  const submitMove = async () => {
    setBusy(true)
    const { error } = await supabase.rpc('cafe_cash_move', {
      p_type: move.type, p_amount: Number(move.amount) || 0,
      p_note: move.note || null, p_person_id: move.type === 'receive' && move.personId ? move.personId : null,
    })
    setBusy(false)
    if (error) { setMsg({ t: error.message, ok: false }); return }
    setOpenMove(false); setMove({ type: 'income', amount: '', note: '', personId: '' })
    setMsg({ t: '✅ ثبت شد', ok: true }); load()
  }

  const doClose = async () => {
    setBusy(true)
    const { data, error } = await supabase.rpc('cafe_close_day', { p_counted_cash: Number(closeForm.counted) || 0, p_note: closeForm.note || null })
    setBusy(false)
    if (error) { setMsg({ t: error.message, ok: false }); return }
    setCloseResult(data); setCloseForm({ counted: '', note: '' }); load()
  }

  const moveColor = (m: CafeCashMove) => m.amount >= 0 ? 'var(--accent)' : '#ff6b7a'

  return (
    <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
      {msg && <Msg text={msg.t} tone={msg.ok ? 'ok' : 'err'} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10 }}>
        <Stat label="موجودی صندوق" value={fa(dash?.cashbox || 0) + ' ت'} bg="rgba(34,197,94,.07)" />
        <Stat label="دریافتی امروز" value={fa((dash?.todayIncome || 0) + (dash?.todayExpenses ? 0 : 0)) + ' ت'} sub="شامل فروش نقدی/کارت" />
        <Stat label="هزینه امروز" value={fa(dash?.todayExpenses || 0) + ' ت'} color="#ffb84d" bg="rgba(245,166,35,.07)" />
        <Stat label="سود امروز" value={fa(dash?.todayProfit || 0) + ' ت'} color="var(--accent)" />
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button className="btn btn-primary btn-sm" onClick={() => { setMove({ type: 'income', amount: '', note: '', personId: '' }); setOpenMove(true) }}>+ دریافت وجه</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { setMove({ type: 'expense', amount: '', note: '', personId: '' }); setOpenMove(true) }}>− پرداخت وجه</button>
        <button className="btn btn-ghost btn-sm" style={{ color: '#ffb84d', borderColor: 'rgba(245,166,35,.3)' }} onClick={() => { setCloseResult(null); setCloseForm({ counted: String(dash?.cashbox ?? ''), note: '' }); setOpenClose(true) }}>🔒 بستن حساب روزانه</button>
      </div>

      {/* حرکات صندوق */}
      <div>
        <h3 style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>💵 گردش صندوق (۳۰ مورد اخیر)</h3>
        {moves.length === 0 ? <Empty text="گردشی ثبت نشده." /> : (
          <div style={{ display: 'grid', gap: 8 }}>
            {moves.map(m => (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,.04)', border: '1px solid var(--line)', borderRadius: 10, padding: '9px 12px', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>
                    {CASH_LABEL[m.type] || m.type}{m.method && m.type !== 'sale' ? '' : m.method ? ` (${m.method === 'cash' ? 'نقدی' : m.method === 'card' ? 'کارت‌خوان' : 'نسیه'})` : ''}{m.note ? ` — ${m.note}` : ''}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>{faDT(m.created_at)} · {m.profiles?.username || '—'}</div>
                </div>
                <div style={{ fontWeight: 900, fontSize: 13, color: moveColor(m), flexShrink: 0 }}>{m.amount >= 0 ? '+' : ''}{fa(m.amount)} ت</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* بسته‌های روزانه */}
      {closes.length > 0 && (
        <div>
          <h3 style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>📅 بستن حساب‌های قبلی</h3>
          <div className="card table-wrap" style={{ padding: 0 }}>
            <table className="table">
              <thead><tr><th>تاریخ</th><th>فروش کل</th><th>نقدی</th><th>کارت</th><th>نسیه</th><th>هزینه</th><th>سود</th><th>صندوق</th><th>اختلاف</th><th>بستن</th></tr></thead>
              <tbody>
                {closes.map(c => (
                  <tr key={c.id}>
                    <td>{new Date(c.close_date).toLocaleDateString('fa-IR')}</td>
                    <td>{fa(c.sales_total)}</td><td>{fa(c.sales_cash)}</td><td>{fa(c.sales_card)}</td><td>{fa(c.sales_credit)}</td>
                    <td>{fa(c.expenses)}</td><td style={{ color: 'var(--accent)' }}>{fa(c.profit)}</td>
                    <td>{fa(c.counted_cash)}</td>
                    <td style={{ color: c.diff !== 0 ? '#ffb84d' : undefined }}>{fa(c.diff)}</td>
                    <td style={{ fontSize: 11 }}>{c.profiles?.username || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* مودال دریافت/پرداخت */}
      <Modal open={openMove} onClose={() => setOpenMove(false)} title={move.type === 'income' || move.type === 'receive' ? 'ثبت دریافت وجه' : 'ثبت پرداخت وجه'}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {(['income', 'expense', 'receive', 'pay'] as const).map(t => (
            <button key={t} className={move.type === t ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'} onClick={() => setMove({ ...move, type: t })}>
              {t === 'income' ? 'درآمد' : t === 'expense' ? 'هزینه' : t === 'receive' ? 'دریافت' : 'پرداخت'}
            </button>
          ))}
        </div>
        <Field label="مبلغ (تومان)"><input className="input" type="number" min={1} value={move.amount} onChange={e => setMove({ ...move, amount: e.target.value })} /></Field>
        {move.type === 'receive' && (
          <Field label="شخص (برای تسویه بدهی — اختیاری)">
            <select className="input" value={move.personId} onChange={e => setMove({ ...move, personId: e.target.value })}>
              <option value="">— بدون اتصال به حساب —</option>
              {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="یادداشت"><input className="input" value={move.note} onChange={e => setMove({ ...move, note: e.target.value })} /></Field>
        <button className="btn btn-primary" disabled={busy} onClick={submitMove} style={{ width: '100%' }}>{busy ? '…' : 'ثبت'}</button>
      </Modal>

      {/* مودال بستن روز */}
      <Modal open={openClose} onClose={() => setOpenClose(false)} title="بستن حساب روزانه">
        {closeResult ? (
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)' }}>✅ حساب {(closeResult.close_date as string).replace(/-/g, '/')} بسته شد</div>
            {[
              ['فروش کل', closeResult.sales_total], ['نقدی', closeResult.sales_cash], ['کارت‌خوان', closeResult.sales_card],
              ['نسیه', closeResult.sales_credit], ['هزینه‌ها', closeResult.expenses], ['سود خالص', closeResult.profit],
              ['صندوق شمارش‌شده', closeResult.counted_cash],
            ].map(([k, v]) => (
              <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--muted)' }}>{k}</span><b>{fa(Number(v))} ت</b>
              </div>
            ))}
            <button className="btn btn-primary btn-sm" onClick={() => setOpenClose(false)}>بستن</button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
              موجودی سیستم صندوق: <b style={{ color: 'var(--text)' }}>{fa(dash?.cashbox || 0)} تومان</b> — مبلغ شمارش‌شده واقعی را وارد کنید.
            </div>
            <Field label="وجه شمارش‌شده (تومان)"><input className="input" type="number" min={0} value={closeForm.counted} onChange={e => setCloseForm({ ...closeForm, counted: e.target.value })} /></Field>
            <Field label="یادداشت (اختیاری)"><input className="input" value={closeForm.note} onChange={e => setCloseForm({ ...closeForm, note: e.target.value })} /></Field>
            <button className="btn btn-primary" disabled={busy} onClick={doClose} style={{ width: '100%' }}>{busy ? '…' : 'بستن حساب امروز'}</button>
          </>
        )}
      </Modal>
    </div>
  )
}
