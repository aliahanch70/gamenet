import { useState } from 'react'
import CafeDashboard from '../components/cafe/CafeDashboard'
import CafeSales from '../components/cafe/CafeSales'
import CafeInventory from '../components/cafe/CafeInventory'
import CafeAccounts from '../components/cafe/CafeAccounts'
import CafeCashbox from '../components/cafe/CafeCashbox'
import CafeReports from '../components/cafe/CafeReports'
import CafeHistory from '../components/cafe/CafeHistory'

const TABS = [
  { k: 'dash', label: 'داشبورد مالی', icon: '📊' },
  { k: 'sales', label: 'مدیریت فروش', icon: '🧾' },
  { k: 'stock', label: 'مدیریت انبار', icon: '📦' },
  { k: 'accounts', label: 'مدیریت حساب‌ها', icon: '👥' },
  { k: 'cashbox', label: 'صندوق', icon: '💵' },
  { k: 'reports', label: 'گزارش‌گیری', icon: '📈' },
  { k: 'history', label: 'تاریخچه و تراکنش‌ها', icon: '🕓' },
] as const

type TabKey = typeof TABS[number]['k']

export default function AdminCafe(){
  const [tab, setTab] = useState<TabKey>('dash')
  return (
    <div className="container" style={{ padding: '20px 14px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ fontWeight: 900, fontSize: 22 }}>🍔 مدیریت حساب‌ها و بوفه</h2>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>حسابداری و انبارداری گیم‌نت</span>
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.k} className={tab === t.k ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'} onClick={() => setTab(t.k)}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {tab === 'dash' && <CafeDashboard />}
      {tab === 'sales' && <CafeSales />}
      {tab === 'stock' && <CafeInventory />}
      {tab === 'accounts' && <CafeAccounts />}
      {tab === 'cashbox' && <CafeCashbox />}
      {tab === 'reports' && <CafeReports />}
      {tab === 'history' && <CafeHistory />}
    </div>
  )
}
