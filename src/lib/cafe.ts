import { supabase } from './supabase'

// ── انواع بوفه و حسابداری ──
export type CafeProduct = {
  id: string; name: string; category: string
  buy_price: number; sell_price: number; stock: number; low_stock: number
  is_active: boolean; created_at: string
}
export type CafeSaleItem = { id: string; product_id: string | null; product_name: string; qty: number; unit_price: number; unit_cost: number }
export type CafeSale = {
  id: string; total: number; cost_total: number
  method: 'cash' | 'card' | 'credit'; person_id: string | null
  note: string | null; created_by: string | null; created_at: string
  profiles?: { username: string | null } | null
  cafe_sale_items?: CafeSaleItem[]
}
export type CafePerson = { id: string; name: string; phone: string | null; note: string | null; is_active: boolean; created_at: string }
export type CafeLedger = {
  id: string; person_id: string; amount: number
  type: 'debt' | 'settle' | 'reversal'; note: string | null
  created_by: string | null; created_at: string
  profiles?: { username: string | null } | null
}
export type CafeCashMove = {
  id: string; amount: number
  type: 'sale' | 'stock' | 'expense' | 'income' | 'receive' | 'pay' | 'close'
  method: 'cash' | 'card' | 'credit' | null; note: string | null
  person_id: string | null; created_by: string | null; created_at: string
  profiles?: { username: string | null } | null
}
export type CafeStockMove = {
  id: string; product_id: string; qty: number; type: 'in' | 'out'
  reason: string | null; created_by: string | null; created_at: string
  profiles?: { username: string | null } | null
}
export type CafeDayClose = {
  id: string; close_date: string; system_cash: number; counted_cash: number; diff: number
  sales_total: number; sales_cash: number; sales_card: number; sales_credit: number
  expenses: number; profit: number; note: string | null; closed_at: string
  profiles?: { username: string | null } | null
}
export type CafeAudit = {
  id: string; table_name: string; row_id: string | null; action: string
  old_data: any; new_data: any; admin_id: string | null; created_at: string
  profiles?: { username: string | null } | null
}
export type CafeDashboardData = {
  todayIncome: number; todayProfit: number; todayExpenses: number; todaySalesCount: number
  monthIncome: number; monthProfit: number; monthExpenses: number; monthSalesCount: number
  cashbox: number; debts: number; lowStockCount: number
}

// ── برچسب‌های فارسی ──
export const METHOD_LABEL: Record<string, string> = { cash: 'نقدی', card: 'کارت‌خوان', credit: 'نسیه' }
export const CASH_LABEL: Record<string, string> = {
  sale: 'فروش بوفه', stock: 'خرید کالا', expense: 'هزینه', income: 'درآمد',
  receive: 'دریافت وجه', pay: 'پرداخت وجه', close: 'تعدیل صندوق',
}
export const LEDGER_LABEL: Record<string, string> = { debt: 'بدهی جدید', settle: 'تسویه', reversal: 'برگشت بدهی' }
export const TABLE_LABEL: Record<string, string> = {
  cafe_products: 'محصولات', cafe_people: 'اشخاص', cafe_sales: 'فروش‌ها',
  cafe_cash_moves: 'صندوق', cafe_ledger: 'حساب اشخاص', cafe_stock_moves: 'انبار', cafe_day_close: 'بستن روز',
}
export const ACTION_LABEL: Record<string, string> = { insert: 'ثبت', update: 'ویرایش', delete: 'حذف' }

// ── ابزارها ──
export const fa = (n: number) => (Number(n) || 0).toLocaleString('fa-IR')
export const faDT = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleDateString('fa-IR') + ' ' + d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
}
export const dayKey = (iso: string) => new Date(iso).toLocaleDateString('fa-IR')
export const monthKey = (iso: string) => new Date(iso).toLocaleDateString('fa-IR', { year: 'numeric', month: 'long' })

/** خروجی Excel (فایل .xls سازگار با Excel، UTF-8 + BOM برای فارسی) */
export function exportExcel(rows: Array<Record<string, any>>, filename: string) {
  if (!rows.length) { alert('داده‌ای برای خروجی نیست'); return }
  const esc = (v: any) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const headers = Object.keys(rows[0])
  const html =
    `<html dir="rtl"><head><meta charset="utf-8"></head><body>` +
    `<table border="1" cellspacing="0"><thead><tr>${headers.map(h => `<th style="background:#e5e7eb;font-weight:bold">${esc(h)}</th>`).join('')}</tr></thead>` +
    `<tbody>${rows.map(r => `<tr>${headers.map(h => `<td>${esc(r[h])}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`
  const blob = new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.xls') ? filename : filename + '.xls'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
