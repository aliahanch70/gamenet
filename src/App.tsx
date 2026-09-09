import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import Navbar from './components/Navbar'
import Landing from './pages/Landing'
import Auth from './pages/Auth'
import Betting from './pages/Betting'
import Wallet from './pages/Wallet'
import Admin from './pages/Admin'
import AdminWithdrawals from './pages/AdminWithdrawals'
import AdminHouse from './pages/AdminHouse'
import AdminSettings from './pages/AdminSettings'
import AdminDesign from './pages/AdminDesign'

function applyFont(font: string){
  document.documentElement.setAttribute('data-font', font)
  if(font === 'vazir') document.body.style.fontFamily = "'Vazirmatn',system-ui,sans-serif"
  else if(font === 'samim') document.body.style.fontFamily = "'Samim',system-ui,sans-serif"
  else document.body.style.fontFamily = "'Vazirmatn',system-ui,sans-serif"
}

function ScrollToTop(){ const {pathname}=useLocation(); useEffect(()=>{ window.scrollTo({top:0,behavior:'instant' as any}); try{ (window as any).scrollTo({top:0,left:0,behavior:'instant'}) }catch{} },[pathname]); return null }

function Guard({ children, admin=false }: { children: React.ReactNode; admin?: boolean }) {
  const { userId, isAdmin, loading } = useAuth() as any
  if (loading) return <div className="container" style={{padding:'20px 14px',minHeight:'60vh'}}><div className="skeleton" style={{height:22,width:120,marginBottom:14}}/><div style={{display:'grid',gap:10}}><div className="skeleton skeleton-card"/><div className="skeleton skeleton-card" style={{height:120}}/></div></div>
  if (!userId) return <Navigate to="/auth" replace />
  if (admin && !isAdmin) return (
    <div className="container" style={{padding:'32px 20px',maxWidth:560}}>
      <div className="card" style={{padding:18}}>
        <h3 style={{fontWeight:900}}>دسترسی مجاز نیست</h3>
        <p style={{color:'var(--muted)',fontSize:13,marginTop:6}}>برای ورود به پنل مدیریت با حساب ادمین وارد شوید.</p>
        <div style={{marginTop:12}}><Link to="/" className="btn btn-ghost btn-sm">بازگشت به خانه</Link></div>
      </div>
    </div>
  )
  return <>{children}</>
}

export default function App(){
  useEffect(()=>{
    const saved = localStorage.getItem('site_font')
    if(saved) applyFont(saved)
    const handler = (e: Event)=>{
      const detail = (e as CustomEvent).detail
      if(detail) applyFont(detail)
    }
    window.addEventListener('site-font', handler as EventListener)
    return ()=> window.removeEventListener('site-font', handler as EventListener)
  },[])

  return (
    <AuthProvider>
      <ThemeProvider>
      <BrowserRouter>
        <ScrollToTop/>
        <Navbar/>
        <Routes>
          <Route path="/" element={<Landing/>}/>
          <Route path="/auth" element={<Auth/>}/>
          <Route path="/betting" element={<Guard><Betting/></Guard>}/>
          <Route path="/wallet" element={<Guard><Wallet/></Guard>}/>
          <Route path="/admin" element={<Guard admin><Admin/></Guard>}/>
          <Route path="/admin/withdrawals" element={<Guard admin><AdminWithdrawals/></Guard>}/>
          <Route path="/admin/house" element={<Guard admin><AdminHouse/></Guard>}/>
          <Route path="/admin/settings" element={<Guard admin><AdminSettings/></Guard>}/>
          <Route path="/admin/design" element={<Guard admin><AdminDesign/></Guard>}/>
          <Route path="*" element={<Navigate to="/" replace/>}/>
        </Routes>
      </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  )
}
