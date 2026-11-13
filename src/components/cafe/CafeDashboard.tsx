import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fa, type CafeDashboardData, type CafeProduct, type CafePerson, type CafeLedger } from '../../lib/cafe'
import { Stat, Empty, Msg } from './ui'

export default function CafeDashboard(){
  const [d, setD] = useState<CafeDashboardData | null>(null)
  const [low, setLow] = useState<CafeProduct[]>([])
  const [debtors, setDebtors] = useState<{ person: CafePerson; debt: number }[]>([])
  const [err, setErr] = useState<string | null>(null)

  const load = async () => {
    const { data, error } = await supabase.rpc('cafe_dashboard')
    if (error) setErr(error.message); else setErr(null)
    if (data) setD(data as CafeDashboardData)

    const { data: ps } = await supabase.from('cafe_products').select('id,name,category,stock,low_stock,is_active').eq('is_active', true).order('stock')
    setLow((((ps as any[]) || []) as CafeProduct[]).filter(p => p.stock <= p.low_stock))

    const [{ data: ppl }, { data: lg }] = await Promise.all([
      supabase.from('cafe_people').select('*').eq('is_active', true),
      supabase.from('cafe_ledger').select('person_id,amount'),
    ])
    const byP: Record<string, number> = {}
    for (const r of (lg as any[]) || []) byP[r.person_id] = (byP[r.person_id] || 0) + Number(r.amount)
    setDebtors(
      ((ppl as CafePerson[]) || [])
        .map(p => ({ person: p, debt: byP[p.id] || 0 }))
        .filter(x => x.debt > 0)
        .sort((a, b) => b.debt - a.debt),
    )
  }
  useEffect(() => { load() }, [])

  if (err) return <Msg text={'خطا: ' + err} tone="err" />

  const money = (n?: number) => fa(n || 0) + ' ت'
  return (
    <div style={{ marginTop: 14 }}>
      {/* کارت‌های مالی */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10 }}>
        <Stat label="درآمد امروز (فروش بوفه)" value={money(d?.todayIncome)} sub={`${fa(d?.todaySalesCount || 0)} فروش`} bg="rgba(34,197,94,.07)" />
        <Stat label="سود خالص امروز" value={money(d?.todayProfit)} color="var(--accent)" bg="rgba(34,197,94,.07)" />
        <Stat label="هزینه امروز" value={money(d?.todayExpenses)} color="#ffb84d" bg="rgba(245,166,35,.07)" />
        <Stat label="موجودی صندوق" value={money(d?.cashbox)} sub="کل گردش صندوق" />
        <Stat label="درآمد این ماه" value={money(d?.monthIncome)} sub={`${fa(d?.monthSalesCount || 0)} فروش`} />
        <Stat label="سود خالص ماه" value={money(d?.monthProfit)} color="var(--accent)" />
        <Stat label="هزینه‌های ماه" value={money(d?.monthExpenses)} color="#ffb84d" />
        <Stat label="بدهی افراد" value={money(d?.debts)} color="#ff6b7a" sub="مجموع مانده نسیه" bg="rgba(255,60,90,.06)" />
      </div>

      {/* هشدار انبار */}
      <h3 style={{ fontWeight: 800, fontSize: 13, marginTop: 18, marginBottom: 8 }}>
        ⚠️ هشدار کمبود موجودی {d && low.length > 0 ? <span className="badge" style={{ color: '#ffb84d' }}>{fa(low.length)} مورد</span> : null}
      </h3>
      {low.length === 0
        ? <Empty text="موجودی همه محصولات کافی است ✅" />
        : (
          <div style={{ display: 'grid', gap: 8 }}>
            {low.map(p => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, background: 'rgba(245,166,35,.06)', border: '1px solid rgba(245,166,35,.22)', borderRadius: 10, padding: '10px 12px', flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 800, fontSize: 12 }}>{p.name} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>· {p.category}</span></div>
                <div style={{ fontSize: 12, color: p.stock === 0 ? '#ff6b7a' : '#ffb84d', fontWeight: 800 }}>
                  {p.stock === 0 ? 'ناموجود!' : `${fa(p.stock)} عدد باقی مانده`}
                </div>
              </div>
            ))}
          </div>
        )}

      {/* بدهکاران */}
      <h3 style={{ fontWeight: 800, fontSize: 13, marginTop: 18, marginBottom: 8 }}>👥 بدهکاران (نسیه)</h3>
      {debtors.length === 0
        ? <Empty text="هیچ بدهی بازی نداریم ✅" />
        : (
          <div style={{ display: 'grid', gap: 8 }}>
            {debtors.map(x => (
              <div key={x.person.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, background: 'rgba(255,60,90,.05)', border: '1px solid rgba(255,60,90,.18)', borderRadius: 10, padding: '10px 12px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 12 }}>{x.person.name}</div>
                  {x.person.phone && <div style={{ fontSize: 11, color: 'var(--muted)' }} dir="ltr">{x.person.phone}</div>}
                </div>
                <div style={{ fontWeight: 900, fontSize: 13, color: '#ff6b7a' }}>{fa(x.debt)} ت</div>
              </div>
            ))}
          </div>
        )}
    </div>
  )
}
