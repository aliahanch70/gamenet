
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import AdminBell from './AdminBell'

export default function Navbar() {
  const { userId, email, profile, isAdmin, signOut } = useAuth()
  const loc = useLocation()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)

  const close = () => setOpen(false)

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
              GAME<span>VERSE</span>
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
                <Link
                  className={`modern-nav-link ${
                    isActive('/wallet') ? 'active' : ''
                  }`}
                  to="/wallet"
                >
                  <span className="nav-icon">◈</span>
                  کیف پول
                </Link>
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
                    onClick={logout}
                    title="خروج"
                  >
                    ↪
                  </button>

                </div>
              )}
            </div>
          </div>

          {/* Mobile hamburger */}
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
                onClick={logout}
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
    </>
  )
}

