import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import Navbar from './components/Navbar'
import Landing from './pages/Landing'
import Auth from './pages/Auth'
import Betting from './pages/Betting'
import Wallet from './pages/Wallet'
import ProfilePage from './pages/Profile'

// ponytail: admin routes lazy — keeps initial bundle ~vendor+app, admin chunk loads on /admin only
const Admin = lazy(() => import('./pages/Admin'))
const AdminWithdrawals = lazy(() => import('./pages/AdminWithdrawals'))
const AdminHouse = lazy(() => import('./pages/AdminHouse'))
const AdminSettings = lazy(() => import('./pages/AdminSettings'))
const AdminDesign = lazy(() => import('./pages/AdminDesign'))
const AdminLayout = lazy(() => import('./components/AdminLayout'))

function AdminFallback(){
  return (
    <div className="container" style={{padding:'20px 14px',minHeight:'60vh'}}>
      <div className="skeleton" style={{height:22,width:120,marginBottom:14}}/>
      <div style={{display:'grid',gap:10}}>
        <div className="skeleton skeleton-card"/>
        <div className="skeleton skeleton-card" style={{height:120}}/>
        <div className="skeleton" style={{height:14,width:'60%'}}/>
      </div>
    </div>
  )
}

function applyFont(font: string){
  const MAP: Record<string,string> = {
    vazir: "'Vazirmatn',system-ui,sans-serif",
    samim: "'Samim',system-ui,sans-serif",
  }
  const fam = MAP[font] || MAP.vazir
  document.documentElement.style.setProperty('--site-font', fam)
  document.body.style.fontFamily = fam
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
          <Route path="/profile" element={<Guard><ProfilePage/></Guard>}/>
          <Route path="/admin" element={<Guard admin><Suspense fallback={<AdminFallback/>}><AdminLayout/></Suspense></Guard>}>
            <Route index element={<Suspense fallback={<AdminFallback/>}><Admin/></Suspense>}/>
            <Route path="withdrawals" element={<Suspense fallback={<AdminFallback/>}><AdminWithdrawals/></Suspense>}/>
            <Route path="house" element={<Suspense fallback={<AdminFallback/>}><AdminHouse/></Suspense>}/>
            <Route path="settings" element={<Suspense fallback={<AdminFallback/>}><AdminSettings/></Suspense>}/>
            <Route path="design" element={<Suspense fallback={<AdminFallback/>}><AdminDesign/></Suspense>}/>
          </Route>
          <Route path="*" element={<Navigate to="/" replace/>}/>
        </Routes>
      </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  )
}
