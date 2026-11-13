import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fa, dayKey, monthKey, exportExcel, type CafeSale, type CafeProduct } from '../../lib/cafe'
import { Empty, Msg } from './ui'

type Range = 'today' | 'month' | 'all'
type Tab = 'daily' | 'monthly' | 'product' | 'expenses' | 'stock'

export default function CafeReports(){
  const [tab, setTab] = useState<Tab>('daily')
  const [range, setRange] = useState<Range>('month')
  const [sales, setSales] = useState<CafeSale[]>([])
  const [products, setProducts] = useState<CafeProduct[]>([])
  const [expenses, setExpenses] = useState<{ type: string; amount: number; created_at: string }[]>([])
  const [err, setErr] = useState<string | null>(null)

  const load = async () => {
    const [{ data: ss }, { data: ps }, { data: cm }] = await Promise.all([
      supabase.from('cafe_sales').select('id,total,cost_total,method,created_at').order('created_at', { ascending: false }).limit(2000),
      supabase.from('cafe_products').select('*').order('name'),
      supabase.from('cafe_cash_moves').select('type,amount,created_at').lt('amount', 0).order('created_at', { ascending: false }).limit(2000),
    ])
    setSales((ss as CafeSale[]) || [])
    setProducts((ps as CafeProduct[]) || [])
    setExpenses((cm as any[]) || [])
  }
  useEffect(() => { load() }, [])
  if (err) return <Msg text={'خطا: ' + err} tone="err" />

  // بازه زمانی (مبنا: تهران)
  const now = new Date()
  const todayStr = now.toLocaleDateString('fa-IR')
  const monthStr = now.toLocaleDateString('fa-IR', { year: 'numeric', month: 'long' })
  const inRange = (iso: string) => {
    if (range === 'all') return true
    if (range === 'today') return dayKey(iso) === todayStr
    return monthKey(iso) === monthStr
  }
  const rs = sales.filter(s => inRange(s.created_at))
  const rExp = expenses.filter(e => inRange(e.created_at))

  // گزارش‌ها
  const dailyMap: Record<string, { count: number; total: number; cost: number }> = {}
  for (const s of rs) {
    const k = dayKey(s.created_at)
    dailyMap[k] = dailyMap[k] || { count: 0, total: 0, cost: 0 }
    dailyMap[k].count++; dailyMap[k].total += Number(s.total); dailyMap[k].cost += Number(s.cost_total)
  }
  const dailyRows = Object.entries(dailyMap).sort().reverse().map(([d, v]) => ({
    'تاریخ': d, 'تعداد فروش': fa(v.count), 'فروش کل (تومان)': fa(v.total),
    'بهای تمام‌شده': fa(v.cost), 'سود (تومان)': fa(v.total - v.cost),
  }))

  const monthlyMap: Record<string, { count: number; total: number; cost: number }> = {}
  for (const s of rs) {
    const k = monthKey(s.created_at)
    monthlyMap[k] = monthlyMap[k] || { count: 0, total: 0, cost: 0 }
    monthlyMap[k].count++; monthlyMap[k].total += Number(s.total); monthlyMap[k].cost += Number(s.cost_total)
  }
  const monthlyRows = Object.entries(monthlyMap).sort().reverse().map(([m, v]) => ({
    'ماه': m, 'تعداد فروش': fa(v.count), 'فروش کل (تومان)': fa(v.total),
    'بهای تمام‌شده': fa(v.cost), 'سود (تومان)': fa(v.total - v.cost),
  }))

  // نیاز به اقلام برای سود هر محصول
  const [items, setItems] = useState<any[]>([])
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('cafe_sale_items').select('sale_id,product_name,qty,unit_price,unit_cost').limit(5000)
      setItems((data as any[]) || [])
    })()
  }, [])
  const saleIdsInRange = new Set(rs.map(s => s.id))
  const prodMap: Record<string, { qty: number; rev: number; cost: number }> = {}
  for (const it of items) {
    if (!saleIdsInRange.has(it.sale_id)) continue
    const k = it.product_name || '—'
    prodMap[k] = prodMap[k] || { qty: 0, rev: 0, cost: 0 }
    prodMap[k].qty += Number(it.qty); prodMap[k].rev += Number(it.qty) * Number(it.unit_price); prodMap[k].cost += Number(it.qty) * Number(it.unit_cost)
  }
  const productRows = Object.entries(prodMap).sort((a, b) => b[1].rev - a[1].rev).map(([n, v]) => ({
    'محصول': n, 'تعداد فروخته‌شده': fa(v.qty), 'فروش (تومان)': fa(v.rev), 'بهای تمام‌شده': fa(v.cost), 'سود (تومان)': fa(v.rev - v.cost),
  }))

  const expMap: Record<string, { count: number; total: number }> = {}
  for (const e of rExp) {
    const k = e.type
    expMap[k] = expMap[k] || { count: 0, total: 0 }
    expMap[k].count++; expMap[k].total += Math.abs(Number(e.amount))
  }
  const expLabels: Record<string, string> = { stock: 'خرید کالا', expense: 'هزینه', pay: 'پرداخت وجه', close: 'تعدیل صندوق', sale: 'فروش', income: 'درآمد', receive: 'دریافت' }
  const expenseRows = Object.entries(expMap).map(([k, v]) => ({ 'نوع هزینه': expLabels[k] || k, 'تعداد': fa(v.count), 'مجموع (تومان)': fa(v.total) }))

  const stockRows = products.map(p => ({
    'محصول': p.name, 'دسته': p.category, 'موجودی': fa(p.stock), 'قیمت خرید': fa(p.buy_price),
    'قیمت فروش': fa(p.sell_price), 'ارزش انبار (تومان)': fa(p.stock * p.buy_price), 'وضعیت': p.stock <= p.low_stock ? 'کمبود' : 'کافی',
  }))

  const RANGES: { k: Range; label: string }[] = [{ k: 'today', label: 'امروز' }, { k: 'month', label: 'این ماه' }, { k: 'all', label: 'همه' }]
  const TABS: { k: Tab; label: string }[] = [
    { k: 'daily', label: 'فروش روزانه' }, { k: 'monthly', label: 'فروش ماهانه' },
    { k: 'product', label: 'سود هر محصول' }, { k: 'expenses', label: 'هزینه‌ها' }, { k: 'stock', label: 'موجودی انبار' },
  ]
  const data: Record<Tab, { rows: any[]; file: string }> = {
    daily: { rows: dailyRows, file: 'گزارش-فروش-روزانه' },
    monthly: { rows: monthlyRows, file: 'گزارش-فروش-ماهانه' },
    product: { rows: productRows, file: 'گزارش-سود-محصولات' },
    expenses: { rows: expenseRows, file: 'گزارش-هزینه‌ها' },
    stock: { rows: stockRows, file: 'گزارش-انبار' },
  }
  const cur = data[tab]

  return (
    <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.k} className={tab === t.k ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'} onClick={() => setTab(t.k)}>{t.label}</button>
        ))}
        {tab !== 'stock' && (
          <span style={{ marginInlineStart: 'auto', display: 'flex', gap: 6 }}>
            {RANGES.map(r => (
              <button key={r.k} className={range === r.k ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'} onClick={() => setRange(r.k)}>{r.label}</button>
            ))}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary btn-sm" onClick={() => exportExcel(cur.rows, cur.file)}>⬇️ خروجی Excel</button>
      </div>

      {cur.rows.length === 0 ? <Empty text="داده‌ای در این بازه نیست." /> : (
        <div className="card table-wrap" style={{ padding: 0 }}>
          <table className="table">
            <thead><tr>{Object.keys(cur.rows[0]).map(h => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {cur.rows.map((r, i) => (
                <tr key={i}>{Object.keys(cur.rows[0]).map(h => <td key={h}>{r[h]}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
