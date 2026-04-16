'use client';
export const dynamic = 'force-dynamic';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Script from 'next/script';
import Navbar from '@/components/Navbar';

function LoginContent() {
  const router     = useRouter();
  const searchParams = useSearchParams();
  const nextPath   = searchParams.get('next') || '/';

  const [contact, setContact]         = useState('');
  const [password, setPassword]       = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]             = useState('');
  const [loading, setLoading]         = useState(false);

  // Forgot password modal state
  const [forgotOpen, setForgotOpen]   = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg]     = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const getPostLoginPath = useCallback(
    (user: { role?: string; hasRestaurant?: boolean }) => {
      if (user.role === 'admin') return '/admin';
      if (user.role === 'agent') return '/agent';
      if (nextPath && nextPath !== '/') return nextPath;
      if (user.hasRestaurant) return '/restaurant/dashboard';
      return '/';
    },
    [nextPath]
  );

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    if (!forgotEmail.includes('@')) { setForgotMsg('Please enter a valid email.'); return; }
    setForgotLoading(true); setForgotMsg('');
    try {
      const res  = await fetch('/api/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: forgotEmail }) });
      const data = await res.json();
      setForgotMsg(data.message || 'Reset link sent!');
    } catch {
      setForgotMsg('Network error. Please try again.');
    }
    setForgotLoading(false);
  }

  function closeForgot() { setForgotOpen(false); setForgotEmail(''); setForgotMsg(''); }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res  = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact, password }) });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('loggedInUser', JSON.stringify(data.user));
        router.push(getPostLoginPath(data.user));
      } else if (data.requiresVerification) {
        localStorage.setItem('pendingContact', contact);
        router.push('/register?verify=true');
      } else {
        setError(data.message || 'Login failed.');
      }
    } catch {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  }

  const handleGoogleResponse = useCallback((response: { credential: string }) => {
    fetch('/api/google-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: response.credential }) })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          localStorage.setItem('authToken', data.token);
          localStorage.setItem('loggedInUser', JSON.stringify(data.user));
          router.push(getPostLoginPath(data.user));
        }
      });
  }, [getPostLoginPath, router]);

  useEffect(() => {
    const initGoogle = () => {
      fetch('/api/config/google').then(r => r.json()).then(({ clientId }) => {
        if (!clientId || !(window as any).google) return;
        (window as any).google.accounts.id.initialize({ client_id: clientId, callback: handleGoogleResponse });
        (window as any).google.accounts.id.renderButton(document.getElementById('google-btn-container'), { theme: 'outline', size: 'large', width: '100%' });
      });
    };
    if ((window as any).google) initGoogle();
    else window.addEventListener('google-loaded', initGoogle, { once: true });
  }, [handleGoogleResponse]);

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" onLoad={() => window.dispatchEvent(new Event('google-loaded'))} />
      <Navbar scrolled />
      <main className="auth-page">
        <div className="auth-container">
          <div className="auth-header">
            <div className="brand-logo">KK</div>
            <h1 className="auth-title">Welcome back</h1>
            <p className="auth-subtitle">Sign in to continue to Kajal Kitchen</p>
          </div>
          <form className="auth-form" onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="login-contact">Email address or Phone</label>
              <input type="text" id="login-contact" placeholder="Enter your email or phone" required value={contact} onChange={e => setContact(e.target.value)} />
            </div>
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label htmlFor="login-password" style={{ marginBottom: 0 }}>Password</label>
                <a href="#" className="forgot-password-link" onClick={e => { e.preventDefault(); setForgotOpen(true); }}>Forgot password?</a>
              </div>
              <div className="password-wrapper">
                <input type={showPassword ? 'text' : 'password'} id="login-password" placeholder="Enter your password" required value={password} onChange={e => setPassword(e.target.value)} />
                <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>{showPassword ? '🙈' : '👁️'}</button>
              </div>
            </div>
            {error && <p style={{ color: '#e74c3c', fontSize: '0.9rem' }}>{error}</p>}
            <button type="submit" className="btn btn-full" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
          </form>
          <div className="divider">or</div>
          <div id="google-btn-container" />
          <div className="auth-footer">
            <p>New here? <Link href="/register">Create an account</Link></p>
          </div>
        </div>
      </main>

      {/* ── Forgot Password Modal ── */}
      {forgotOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '2rem', width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1a1a1a', marginBottom: '0.4rem' }}>Reset Password</h2>
            <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Enter your registered email address and we'll send you a reset link.</p>

            <form onSubmit={handleForgot}>
              <input
                type="email"
                placeholder="your@email.com"
                required
                value={forgotEmail}
                onChange={e => setForgotEmail(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: '1rem', boxSizing: 'border-box', marginBottom: '0.8rem' }}
              />
              {forgotMsg && (
                <p style={{ fontSize: '0.88rem', marginBottom: '0.8rem', color: forgotMsg.toLowerCase().includes('sent') || forgotMsg.toLowerCase().includes('exist') ? '#16a34a' : '#e74c3c' }}>
                  {forgotMsg}
                </p>
              )}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" onClick={closeForgot} style={{ flex: 1, padding: '11px', borderRadius: 8, border: '1px solid #ddd', background: '#f5f5f5', cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem' }}>
                  Cancel
                </button>
                <button type="submit" disabled={forgotLoading} style={{ flex: 1, padding: '11px', borderRadius: 8, border: 'none', background: '#e67e22', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem' }}>
                  {forgotLoading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ padding: '6rem 1rem', textAlign: 'center' }}>Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
