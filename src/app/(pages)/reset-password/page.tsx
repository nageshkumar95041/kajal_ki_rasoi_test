'use client';
export const dynamic = 'force-dynamic';
import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';

function ResetPasswordContent() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) { alert('Invalid reset link.'); router.push('/login'); }
  }, [token, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true); setError('');
    const res = await fetch('/api/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, newPassword: password }) });
    const data = await res.json();
    if (data.success) { alert(data.message); router.push('/login'); }
    else setError(data.message || 'Reset failed.');
    setLoading(false);
  }

  return (
    <>
      <Navbar scrolled />
      <main className="auth-page">
        <div className="auth-container">
          <div className="auth-header">
            <div className="brand-logo">KK</div>
            <h1 className="auth-title">Set a New Password</h1>
          </div>
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>New Password</label>
              <input type="password" placeholder="Enter new password" required value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Confirm New Password</label>
              <input type="password" placeholder="Confirm your password" required value={confirm} onChange={e => setConfirm(e.target.value)} />
            </div>
            {error && <p style={{ color: '#e74c3c' }}>{error}</p>}
            <button type="submit" className="btn btn-full" disabled={loading}>{loading ? 'Resetting...' : 'Reset Password'}</button>
          </form>
        </div>
      </main>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ padding: '6rem 1rem', textAlign: 'center' }}>Loading...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
