'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getCartCount, getLoggedInUser, getAuthToken, isTokenExpired, type LoggedInUser } from '@/lib/utils';
import NotificationBell from './NotificationBell';

type User = LoggedInUser;

export default function Navbar({ scrolled: defaultScrolled = false }: { scrolled?: boolean }) {
  const pathname  = usePathname();
  const router    = useRouter();
  const [cartCount, setCartCount]   = useState(0);
  const [user, setUser]             = useState<User | null>(null);
  const [menuOpen, setMenuOpen]     = useState(false);
  const [isScrolled, setIsScrolled] = useState(defaultScrolled);
  const [dropOpen, setDropOpen]     = useState(false);
  const [mounted, setMounted]         = useState(false);
  const navRef  = useRef<HTMLElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  function syncState() {
    setCartCount(getCartCount());
    const token = getAuthToken();
    const u     = getLoggedInUser();
    // Only set user if BOTH token and user data exist and token is not expired
    if (token && u && !isTokenExpired(token)) {
      setUser(u);
    } else {
      // Clear stale data
      if (!token || isTokenExpired(token || '')) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('loggedInUser');
      }
      setUser(null);
    }
  }

  useEffect(() => {
    setMounted(true);
    syncState();
    window.addEventListener('storage',     syncState);
    window.addEventListener('cartUpdated', syncState);
    return () => {
      window.removeEventListener('storage',     syncState);
      window.removeEventListener('cartUpdated', syncState);
    };
  }, []);

  useEffect(() => {
    if (defaultScrolled) return;
    const onScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, [defaultScrolled]);

  // Close mobile menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // Close avatar dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropOpen(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  async function handleLogout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('loggedInUser');
    await fetch('/api/logout', { method: 'POST' });
    setUser(null); setDropOpen(false);
    window.location.href = '/';
  }

  const isHome  = pathname === '/';
  const hideCart = pathname === '/restaurant/dashboard' || pathname === '/restaurant/register';
  const initial = user?.name ? user.name.charAt(0).toUpperCase() : 'U';
  const restaurantRegisterHref = user ? '/restaurant/register' : '/login?next=/restaurant/register';
  const isRestaurantOwner = user?.role === 'user' && !!user?.hasRestaurant;
  const showRestaurantRegisterNav =
    !user || (user.role === 'user' && !user.hasRestaurant);
  const menuHref =
    isRestaurantOwner
      ? '/restaurant/dashboard?tab=menu'
      : '/menu';

  function scrollTo(id: string) {
    setMenuOpen(false);
    if (isHome) {
      const el = document.getElementById(id);
      if (el) { el.scrollIntoView({ behavior: 'smooth' }); return; }
    }
    // Store target so homepage picks it up after navigation
    sessionStorage.setItem('scrollTarget', id);
    router.push('/');
  }

  return (
    <nav
      id="navbar"
      ref={navRef}
      suppressHydrationWarning
      className={`${isScrolled ? 'scrolled' : ''} ${menuOpen ? 'menu-open' : ''}`}
    >
      {/* Logo */}
      <div className="logo">
        <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>
          Kajal <span style={{ color: '#f97316' }}>Ki</span> Rasoi
        </Link>
      </div>

      {/* Nav links */}
      <ul className={`nav-links ${menuOpen ? 'active' : ''}`} data-authed={user ? 'true' : 'false'}>
        {!isRestaurantOwner && (
          <li><Link href="/" onClick={() => setMenuOpen(false)}>Home</Link></li>
        )}
        <li><Link href={menuHref} onClick={() => setMenuOpen(false)}>Menu</Link></li>
        {!isRestaurantOwner && (
          <li><Link href="/subscription" onClick={() => setMenuOpen(false)}>Tiffin</Link></li>
        )}
        <li><Link href="/about" onClick={() => setMenuOpen(false)}>About</Link></li>
        <li><Link href="/contact" onClick={() => setMenuOpen(false)}>Contact</Link></li>
        {showRestaurantRegisterNav && (
          <li><Link href={restaurantRegisterHref} onClick={() => setMenuOpen(false)}>Register Restaurant</Link></li>
        )}
        <li className="nav-login-item">
          <Link href="/login" onClick={() => setMenuOpen(false)}>Login</Link>
        </li>
      </ul>

      {/* Right side */}
      <div className="nav-right">
        {/* Notification Bell — only when logged in */}
        {mounted && user && <NotificationBell />}

        {/* Cart — only when logged in and not on restaurant pages */}
        {mounted && user && !hideCart && (
          <Link href="/cart" className="nav-cart-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            Cart <span id="cart-count">{cartCount}</span>
          </Link>
        )}

        {/* Avatar dropdown — only when logged in (hidden on mobile via CSS) */}
        {mounted && user && (
          <div ref={dropRef} className="nav-avatar-wrapper">
            <div
              className="nav-avatar-circle"
              onClick={e => { e.stopPropagation(); setDropOpen(o => !o); }}
              title={user.name}
            >
              {initial}
            </div>

            {dropOpen && (
              <div className="nav-dropdown">
                <div className="nav-dropdown-header">{user.name}</div>
                {[
                  ...(user.hasRestaurant ? [{ label: 'Restaurant Dashboard', href: '/restaurant/dashboard' }] : [{ label: 'My Orders', href: '/my-orders' }]),
                  { label: 'Profile', href: '/profile' },
                  ...(user.role === 'admin' ? [{ label: 'Admin Dashboard', href: '/admin' }] : []),
                ].map(item => (
                  <Link key={item.href} href={item.href} className="nav-dropdown-item" onClick={() => setDropOpen(false)}>
                    {item.label}
                  </Link>
                ))}
                <div className="nav-dropdown-divider" />
                <a href="#" className="nav-dropdown-item nav-dropdown-logout"
                  onClick={e => { e.preventDefault(); handleLogout(); }}>
                  🔴 Logout
                </a>
              </div>
            )}
          </div>
        )}

        {/* Login / Sign Up buttons — only when logged out */}
        {mounted && !user && (
          <div className="nav-auth-buttons">
            <Link href="/login" className="nav-btn-login" onClick={() => setMenuOpen(false)}>
              Login
            </Link>
            <Link href="/register" className="nav-btn-signup" onClick={() => setMenuOpen(false)}>
              Sign Up
            </Link>
          </div>
        )}

        {/* Hamburger */}
        <div
          className="menu-toggle"
          id="mobile-menu"
          onClick={e => { e.stopPropagation(); setMenuOpen(o => !o); }}
        >
          &#9776;
        </div>
      </div>
    </nav>
  );
}