'use client';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { getAuthToken, isTokenExpired, getLoggedInUser } from '@/lib/utils';

// Free delivery as of now
const FREE_DELIVERY_THRESHOLD = 40;

interface Props {
  cartCount: number;
  cartTotal: number;
}

export default function StickyCart({ cartCount, cartTotal }: Props) {
  const [mounted, setMounted] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  function checkAuth() {
    const token = getAuthToken();
    const user  = getLoggedInUser();
    setIsLoggedIn(!!(user && token && !isTokenExpired(token)));
  }

  useEffect(() => {
    setMounted(true);
    checkAuth();
    window.addEventListener('storage',     checkAuth);
    window.addEventListener('cartUpdated', checkAuth);
    return () => {
      window.removeEventListener('storage',     checkAuth);
      window.removeEventListener('cartUpdated', checkAuth);
    };
  }, []);

  // Hide if not mounted, cart empty, or user not logged in
  if (!mounted || cartCount === 0 || !isLoggedIn) return null;

  const remaining = FREE_DELIVERY_THRESHOLD - cartTotal;

  return createPortal(
    <div
      id="sticky-cart"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#1a0e00',
        color: '#fff',
        padding: '12px 20px',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
        flexWrap: 'wrap',
        gap: '8px',
      }}
    >
      {/* LEFT — icon + item count + price */}
      <div className="sc-left" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div className="sc-icon-pill" style={{ position: 'relative', fontSize: '1.4rem' }}>
          🛒
          <span
            style={{
              position: 'absolute',
              top: -6,
              right: -8,
              background: '#f97316',
              color: '#fff',
              borderRadius: '50%',
              width: 18,
              height: 18,
              fontSize: '0.7rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
            }}
          >
            {cartCount}
          </span>
        </div>

        <div className="sc-details">
          <p style={{ margin: 0, fontSize: '0.82rem', color: '#ccc' }}>
            {cartCount} item{cartCount > 1 ? 's' : ''} in cart
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#f97316' }}>
              ₹{cartTotal}
            </span>
            {remaining <= 0 && (
              <span style={{ background: '#16a34a', color: '#fff', fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px', borderRadius: 4 }}>
                FREE delivery 🎉
              </span>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT — free delivery nudge + CTA */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
        {remaining > 0 && (
          <span style={{ fontSize: '0.75rem', color: '#aaa' }}>
            free delivery 🎉
          </span>
        )}
        <Link
          href="/cart"
          style={{
            background: '#f97316',
            color: '#fff',
            padding: '10px 24px',
            borderRadius: 25,
            fontWeight: 'bold',
            textDecoration: 'none',
            fontSize: '0.95rem',
            whiteSpace: 'nowrap',
          }}
        >
          View Cart →
        </Link>
      </div>
    </div>,
    document.body
  );
}