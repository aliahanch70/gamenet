import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fa, faDT, TABLE_LABEL, ACTION_LABEL, type CafeAudit } from '../../lib/cafe'
import { Empty, Msg } from './ui'

/** خلاصه خوانا برای یک رکورد audit */
function summarize(t: string, d: any): string {
  if (!d) return '—'
  switch (t) {
    case 'cafe_products': return `${d.name} (موجودی ${fa(d.stock)})`
    case 'cafe_people': return d.name
    case 'cafe_sales': return `فروش ${fa(d.total)} ت — ${d.method === 'cash' ? 'نقدی' : d.method === 'card' ? 'کارت‌خوان' : 'نسیه'}`
    case 'cafe_stock_moves': return `${d.qty > 0 ? 'ورود' : 'خروج'} ${fa(Math.abs(d.qty))} — ${d.reason || ''}`
    case 'cafe_cash_moves': return `${d.amount >= 0 ? 'دریافت' : 'پرداخت'} ${fa(Math.abs(d.amount))} ت — ${d.note || ''}`
    case 'cafe_ledger': return `${d.amount >= 0 ? 'بدهی' : 'تسویه'} ${fa(Math.abs(d.amount))} ت — ${d.note || ''}`
    case 'cafe_day_close': return `بستن روز ${d.close_date} — فروش ${fa(d.sales_total)} ت`
    default: return ''
  }
}

export default function CafeHistory(){
  const [rows, setRows] = useState<CafeAudit[]>([])
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('cafe_audit').select('*, profiles(username)').order('created_at', { ascending: false }).limit(200)
      if (error) setErr(error.message)
      setRows((data as CafeAudit[]) || [])
    })()
  }, [])

  const filtered = rows
    .filter(r => filter === 'all' || r.table_name === filter)
    .filter(r => {
      if (!q.trim()) return true
      const s = summarize(r.table_name, r.new_data || r.old_data)
      return s.includes(q) || (r.profiles?.username || '').includes(q)
    })

  return (
    <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
      {err && <Msg text={'خطا: ' + err} tone="err" />}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input className="input" placeholder="جستجو در توضیحات یا ادمین…" value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: 240, padding: '7px 12px', fontSize: 12, borderRadius: 999 }} />
        <select className="input" value={filter} onChange={e => setFilter(e.target.value)} style={{ maxWidth: 170, padding: '7px 12px', fontSize: 12, borderRadius: 999 }}>
          <option value="all">همه بخش‌ها</option>
          {Object.entries(TABLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <span style={{ fontSize: 11, color: 'var(--muted)', alignSelf: 'center' }}>{fa(filtered.length)} رکورد (۲۰۰ اخیر)</span>
      </div>

      {filtered.length === 0 ? <Empty text="تراکنشی ثبت نشده." /> : (
        <div style={{ display: 'grid', gap: 6 }}>
          {filtered.map(r => {
            const d = r.new_data || r.old_data
            const ac = r.action === 'delete' ? '#ff6b7a' : r.action === 'update' ? '#ffb84d' : 'var(--accent)'
            return (
              <div key={r.id} style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--line)', borderRadius: 10, padding: '9px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', cursor: 'pointer' }} onClick={() => setOpenId(openId === r.id ? null : r.id)}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>
                      <span style={{ color: ac }}>{ACTION_LABEL[r.action] || r.action}</span>
                      {' · '}{TABLE_LABEL[r.table_name] || r.table_name}
                      {r.table_name !== 'cafe_day_close' && d ? ` — ${summarize(r.table_name, d)}` : ''}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>{faDT(r.created_at)} · ادمین: {r.profiles?.username || '—'}</div>
                  </div>
                  <span className="badge" style={{ fontSize: 10, color: ac }}>{r.action}</span>
                </div>
                {openId === r.id && (
                  <pre dir="ltr" style={{ marginTop: 8, fontSize: 10, background: 'var(--surface2)', border: '1px solid var(--line)', borderRadius: 10, padding: 10, overflow: 'auto', maxHeight: 220 }}>
                    {JSON.stringify({ old: r.old_data, new: r.new_data }, null, 2)}
                  </pre>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
