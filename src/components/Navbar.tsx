
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import AdminBell from './AdminBell'

export default function Navbar() {
  const { userId, email, profile, isAdmin, signOut } = useAuth()
  const loc = useLocation()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)

  const close = () => setOpen(false)
  const askLogout = () => { close(); setConfirmLogout(true) }

  const isActive = (p: string) =>
    loc.pathname === p || loc.pathname.startsWith(p + '/')

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  useEffect(() => {
    close()
  }, [loc.pathname])

  const logout = async () => {
    setConfirmLogout(false)
    await signOut()
    close()
    nav('/')
  }

  return (
    <>
      <nav className="modern-nav">
        <div className="modern-nav-inner">

          {/* Logo */}
          <Link to="/" onClick={close} className="brand">
            <span className="brand-icon">
              <span />
            </span>

            <span className="brand-name">
              PLAY<span>STREET</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="desktop-nav">

            <div className="nav-menu">
              <Link
                className={`modern-nav-link ${
                  isActive('/betting') ? 'active' : ''
                }`}
                to="/betting"
              >
                <span className="nav-icon">🎲</span>
                پیشبینی
              </Link>

              {userId && (
                <>
                <Link
                  className={`modern-nav-link ${
                    isActive('/profile') ? 'active' : ''
                  }`}
                   to="/profile"
                >
                  <span className="nav-icon">👤</span>
                  پروفایل
                </Link>
                <Link
                  className={`modern-nav-link ${
                    isActive('/wallet') ? 'active' : ''
                  }`}
                  to="/wallet"
                >
                  <span className="nav-icon">◈</span>
                  کیف پول
                </Link>
                </>
              )}

              {isAdmin && (
                <>
                  <Link
                    className={`modern-nav-link ${
                      loc.pathname === '/admin' ? 'active admin' : ''
                    }`}
                    to="/admin"
                  >
                    <span className="nav-icon">✦</span>
                    ادمین
                  </Link>

                  <Link
                    className={`modern-nav-link ${
                      isActive('/admin/withdrawals') ? 'active' : ''
                    }`}
                    to="/admin/withdrawals"
                  >
                    <span className="nav-icon">↗</span>
                    برداشت‌ها
                    <AdminBell />
                  </Link>
                </>
              )}
            </div>

            {/* Right side */}
            <div className="nav-user-area">

              {userId && profile && (
                <Link to="/wallet" className="balance-badge">
                  <span className="balance-dot" />
                  <span>
                    {profile.balance.toLocaleString('fa-IR')}
                  </span>
                  <small>ت</small>
                </Link>
              )}

              {!userId ? (
                <Link
                  to="/auth"
                  className="nav-login"
                >
                  ورود / ثبت‌نام
                  <span>←</span>
                </Link>
              ) : (
                <div className="user-box">

                  <div className="user-avatar">
                    {(profile?.username || email || 'U')
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <div className="user-info">
                    <strong>
                      {profile?.username || email}
                    </strong>
                    <span>حساب کاربری</span>
                  </div>

                  <button
                    className="logout-btn"
                    onClick={askLogout}
                    title="خروج"
                  >
                    ↪
                  </button>

                </div>
              )}
            </div>
          </div>

          {/* Mobile: balance + logout in header */}
          {userId && (
            <div className="mobile-top-actions">
              {profile && (
                <Link to="/wallet" className="mobile-top-balance" style={{margin:0}}>
                  <span className="balance-dot" />
                  <span>{profile.balance.toLocaleString('fa-IR')}</span>
                  <small>ت</small>
                </Link>
              )}
              <button onClick={askLogout} aria-label="خروج" className="mobile-top-logout"><span>خروج</span><span style={{fontSize:14,lineHeight:1}}>↪</span></button>
            </div>
          )}

          {/* Mobile hamburger (hidden when bottom nav is active — kept for fallback) */}
          <button
            className={`modern-hamburger ${open ? 'open' : ''}`}
            aria-label="منو"
            aria-expanded={open}
            onClick={() => setOpen(v => !v)}
          >
            <span />
            <span />
            <span />
          </button>

        </div>
      </nav>

      {/* Mobile Drawer */}
      <div className={`modern-drawer ${open ? 'open' : ''}`}>
        <div className="drawer-backdrop" onClick={close} />

        <div className="modern-drawer-panel">

          {/* Drawer header */}
          <div className="drawer-header">

            <div className="brand">
              <span className="brand-icon">
                <span />
              </span>

              <div>
                <div className="brand-name">
                  GAME<span>VERSE</span>
                </div>
                <small>Gaming & Betting</small>
              </div>
            </div>

            <button
              className="drawer-close"
              onClick={close}
            >
              ×
            </button>

          </div>

          {/* User */}
          {userId && (
            <div className="mobile-user-card">

              <div className="user-avatar large">
                {(profile?.username || email || 'U')
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <div>
                <strong>
                  {profile?.username || email}
                </strong>

                {profile && (
                  <span>
                    موجودی: {profile.balance.toLocaleString('fa-IR')} ت
                  </span>
                )}
              </div>

            </div>
          )}

          {/* Links */}
          <div className="mobile-nav-links">

            <Link
              className={`mobile-nav-link ${
                isActive('/betting') ? 'active' : ''
              }`}
              to="/betting"
              onClick={close}
            >
              <span className="mobile-link-icon">🎲</span>
              <span>شرط‌بندی</span>
              <b>←</b>
            </Link>

            {userId && (
              <>
              <Link
                className={`mobile-nav-link ${
                  isActive('/profile') ? 'active' : ''
                }`}
                to="/profile"
                onClick={close}
              >
                <span className="mobile-link-icon">👤</span>
                <span>پروفایل</span>
                <b>←</b>
              </Link>

              <Link
                className={`mobile-nav-link ${
                  isActive('/wallet') ? 'active' : ''
                }`}
                to="/wallet"
                onClick={close}
              >
                <span className="mobile-link-icon">◈</span>
                <span>کیف پول</span>
                <b>←</b>
              </Link>
              </>
            )}

            {isAdmin && (
              <>
                <Link
                  className={`mobile-nav-link ${
                    loc.pathname === '/admin'
                      ? 'active admin'
                      : ''
                  }`}
                  to="/admin"
                  onClick={close}
                >
                  <span className="mobile-link-icon">✦</span>
                  <span>پنل ادمین</span>
                  <b>←</b>
                </Link>

                <Link
                  className={`mobile-nav-link ${
                    isActive('/admin/withdrawals')
                      ? 'active'
                      : ''
                  }`}
                  to="/admin/withdrawals"
                  onClick={close}
                >
                  <span className="mobile-link-icon">↗</span>
                  <span>برداشت‌ها</span>
                  <AdminBell />
                </Link>
              </>
            )}

          </div>

          {/* Bottom */}
          <div className="drawer-bottom">

            {!userId ? (
              <Link
                to="/auth"
                className="mobile-login"
                onClick={close}
              >
                ورود / ثبت‌نام
                <span>←</span>
              </Link>
            ) : (
              <button
                className="mobile-logout"
                onClick={askLogout}
              >
                خروج از حساب
                <span>↪</span>
              </button>
            )}

            <div className="drawer-footer">
              GAMEVERSE · ۲۰ سیستم · ۲۴/۷
            </div>

          </div>

        </div>
      </div>

      {/* Mobile bottom nav — replaces hamburger/drawer on ≤850px */}
      <nav className="mobile-bottom-nav" aria-label="منوی اصلی">
        <Link to="/" className={`bb-link ${loc.pathname==='/' ? 'active' : ''}`}>
          <span className="bb-icon">◐</span>
          <span className="bb-label">خانه</span>
        </Link>
        <Link to="/betting" className={`bb-link ${isActive('/betting') ? 'active' : ''}`}>
          <span className="bb-icon">🎲</span>
          <span className="bb-label">پیش‌بینی</span>
        </Link>
        {userId ? (
          <>
            <Link to="/wallet" className={`bb-link ${isActive('/wallet') ? 'active' : ''}`}>
              <span className="bb-icon">◈</span>
              <span className="bb-label">کیف</span>
            </Link>
            <Link to="/profile" className={`bb-link ${isActive('/profile') ? 'active' : ''}`}>
              <span className="bb-icon">👤</span>
              <span className="bb-label">پروفایل</span>
            </Link>
          </>
        ) : (
          <Link to="/auth" className={`bb-link ${isActive('/auth') ? 'active' : ''}`}>
            <span className="bb-icon">↪</span>
            <span className="bb-label">ورود</span>
          </Link>
        )}
        {isAdmin && (
          <Link to="/admin" className={`bb-link ${loc.pathname.startsWith('/admin') ? 'active admin' : ''}`}>
            <span className="bb-icon">✦</span>
            <span className="bb-label">ادمین</span>
            {isActive('/admin/withdrawals') && <span className="bb-dot" />}
          </Link>
        )}
      </nav>

      {/* Logout confirm */}
      {confirmLogout && (
        <div className="modal-overlay" onClick={()=>setConfirmLogout(false)} style={{position:'fixed',inset:0,zIndex:210,background:'rgba(5,8,18,.72)',backdropFilter:'blur(8px)',WebkitBackdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div className="modal-card" onClick={e=>e.stopPropagation()} style={{width:'min(380px,90vw)',maxHeight:'none',overflow:'visible',background:'var(--surface)',border:'1px solid var(--line)',borderRadius:20,padding:22,boxShadow:'0 24px 60px rgba(0,0,0,.65)',textAlign:'center'}}>
            <div style={{width:52,height:52,borderRadius:14,display:'grid',placeItems:'center',margin:'0 auto 14px',background:'rgba(244,63,94,.12)',border:'1px solid rgba(244,63,94,.25)',fontSize:22}}>↪</div>
            <h3 style={{fontWeight:900,fontSize:16,margin:0}}>خروج از حساب</h3>
            <p style={{color:'var(--muted)',fontSize:13,marginTop:6,marginBottom:18,lineHeight:1.7}}>آیا مطمئنید که می‌خواهید از حساب خارج شوید؟</p>
            <div style={{display:'flex',gap:10,justifyContent:'center'}}>
              <button onClick={()=>setConfirmLogout(false)} className="btn btn-ghost btn-sm" style={{borderRadius:999,padding:'10px 20px',fontWeight:800}}>لغو</button>
              <button onClick={logout} className="btn btn-primary btn-sm" style={{borderRadius:999,padding:'10px 20px',fontWeight:800,background:'#f43f5e',borderColor:'#f43f5e'}}>بله، خارج شوم</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

