'use client';
export const dynamic = 'force-dynamic';
import { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Script from 'next/script';
import Navbar from '@/components/Navbar';

/* ── Validation helpers ──────────────────────────────────────────────────── */
const EMAIL_RE  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE  = /^(?:\+91[\-\s]?)?\d{10}$/;

function validateName(v: string) {
  if (!v.trim())              return 'Full name is required.';
  if (v.trim().length < 2)   return 'Name must be at least 2 characters.';
  if (v.trim().length > 60)  return 'Name is too long.';
  if (!/^[a-zA-Z\s]+$/.test(v.trim())) return 'Name can only contain letters and spaces.';
  return '';
}
function validateContact(v: string) {
  if (!v.trim()) return 'Email or phone is required.';
  if (!EMAIL_RE.test(v) && !PHONE_RE.test(v))
    return 'Enter a valid email address or 10-digit phone number.';
  return '';
}
function validatePassword(v: string) {
  if (!v)              return 'Password is required.';
  if (v.length < 8)   return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(v))  return 'Include at least one uppercase letter.';
  if (!/[0-9]/.test(v))  return 'Include at least one number.';
  if (!/[^A-Za-z0-9]/.test(v)) return 'Include at least one special character (!@#$…).';
  return '';
}
function validateConfirm(p: string, c: string) {
  if (!c) return 'Please confirm your password.';
  if (p !== c) return 'Passwords do not match.';
  return '';
}

/* ── Password strength ───────────────────────────────────────────────────── */
function getStrength(p: string): { score: number; label: string; color: string } {
  if (!p) return { score: 0, label: '', color: '#e5e5e5' };
  let score = 0;
  if (p.length >= 8)  score++;
  if (p.length >= 12) score++;
  if (/[A-Z]/.test(p)) score++;
  if (/[0-9]/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;
  if (score <= 1) return { score, label: 'Weak',   color: '#ef4444' };
  if (score <= 3) return { score, label: 'Fair',   color: '#f97316' };
  if (score === 4) return { score, label: 'Good',  color: '#eab308' };
  return             { score, label: 'Strong', color: '#22c55e' };
}

/* ── Component ───────────────────────────────────────────────────────────── */
function RegisterContent() {
  const router     = useRouter();
  const params     = useSearchParams();
  const verifyMode = params.get('verify') === 'true';

  // Form fields
  const [name, setName]           = useState('');
  const [contact, setContact]     = useState('');
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [showConf, setShowConf]   = useState(false);

  // Field-level errors (shown after first blur or submit attempt)
  const [touched, setTouched]     = useState({ name: false, contact: false, password: false, confirm: false });
  const [errors, setErrors]       = useState({ name: '', contact: '', password: '', confirm: '' });

  // Submit state
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading]         = useState(false);

  // OTP
  const [needsVerify, setNeedsVerify]     = useState(verifyMode);
  const [pendingContact, setPendingContact] = useState('');
  const [otp, setOtp]                       = useState('');
  const [resendMsg, setResendMsg]           = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (verifyMode) setPendingContact(localStorage.getItem('pendingContact') || '');
  }, [verifyMode]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  /* Live validation on change */
  const revalidate = useCallback((field: string, value: string, pwd = password) => {
    setErrors(prev => ({
      ...prev,
      name:    field === 'name'    || field === 'all' ? validateName(field === 'name' ? value : name) : prev.name,
      contact: field === 'contact' || field === 'all' ? validateContact(field === 'contact' ? value : contact) : prev.contact,
      password:field === 'password'|| field === 'all' ? validatePassword(field === 'password' ? value : pwd) : prev.password,
      confirm: field === 'confirm' || field === 'all' || field === 'password'
        ? validateConfirm(field === 'password' ? value : pwd, field === 'confirm' ? value : confirm)
        : prev.confirm,
    }));
  }, [name, contact, password, confirm]);

  function touch(field: string) { setTouched(t => ({ ...t, [field]: true })); }

  /* ── Register ── */
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    // Mark all touched and run full validation
    setTouched({ name: true, contact: true, password: true, confirm: true });
    const errs = {
      name:     validateName(name),
      contact:  validateContact(contact),
      password: validatePassword(password),
      confirm:  validateConfirm(password, confirm),
    };
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;

    setLoading(true); setSubmitError('');
    const res  = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, contact, password }) });
    const data = await res.json();
    if (data.success && data.requiresVerification) {
      localStorage.setItem('pendingContact', contact);
      setPendingContact(contact);
      setNeedsVerify(true);
      setResendCooldown(30);
    } else {
      setSubmitError(data.message || 'Registration failed.');
    }
    setLoading(false);
  }

  /* ── Verify OTP ── */
  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) return;
    setLoading(true); setSubmitError('');
    const res  = await fetch('/api/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact: pendingContact, otp }) });
    const data = await res.json();
    if (data.success) {
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('loggedInUser', JSON.stringify(data.user));
      localStorage.removeItem('pendingContact');
      router.push('/');
    } else {
      setSubmitError(data.message || 'Invalid code.');
    }
    setLoading(false);
  }

  async function resendOtp() {
    if (resendCooldown > 0) return;
    setResendMsg('');
    const res  = await fetch('/api/resend-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact: pendingContact }) });
    const data = await res.json();
    setResendMsg(data.message || 'Code resent!');
    setResendCooldown(30);
  }

  const strength = getStrength(password);

  /* ── Helper: field wrapper ── */
  const err = (f: keyof typeof errors) => touched[f] ? errors[f] : '';
  const inpStyle = (f: keyof typeof errors): React.CSSProperties => ({
    borderColor: err(f) ? '#ef4444' : touched[f] && !errors[f] ? '#22c55e' : undefined,
    boxShadow:   err(f) ? '0 0 0 3px rgba(239,68,68,0.1)' : touched[f] && !errors[f] ? '0 0 0 3px rgba(34,197,94,0.1)' : undefined,
  });

  /* ── OTP screen ── */
  if (needsVerify) return (
    <>
      <Navbar scrolled />
      <main className="auth-page">
        <div className="auth-container">
          <div className="auth-header">
            <div className="brand-logo">KK</div>
            <h1 className="auth-title">Verify Account</h1>
            <p className="auth-subtitle">Enter the 6-digit code sent to <strong>{pendingContact}</strong></p>
          </div>
          <form className="auth-form" onSubmit={handleVerify}>
            <div className="form-group">
              <label htmlFor="otp-input">Verification Code</label>
              <input
                type="text" id="otp-input" placeholder="000000" required maxLength={6}
                value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                style={{ textAlign: 'center', letterSpacing: '0.5rem', fontSize: '1.8rem', fontWeight: 700 }}
              />
              {otp.length > 0 && otp.length < 6 && (
                <p style={{ color: '#f97316', fontSize: '0.82rem', marginTop: 4 }}>{6 - otp.length} digit{6 - otp.length !== 1 ? 's' : ''} remaining</p>
              )}
            </div>
            {submitError && <p style={{ color: '#e74c3c', fontSize: '0.88rem' }}>{submitError}</p>}
            <button type="submit" className="btn btn-full" disabled={loading || otp.length !== 6}>
              {loading ? 'Verifying...' : 'Verify & Continue'}
            </button>
          </form>
          <p style={{ textAlign: 'center', marginTop: '1rem', color: '#666', fontSize: '0.9rem' }}>
            {resendMsg
              ? <span style={{ color: '#22c55e' }}>{resendMsg}</span>
              : resendCooldown > 0
                ? <span style={{ color: '#aaa' }}>Resend in {resendCooldown}s</span>
                : <><span>Didn&apos;t get the code? </span><a href="#" onClick={e => { e.preventDefault(); resendOtp(); }} style={{ color: '#e67e22', fontWeight: 600 }}>Resend Code</a></>
            }
          </p>
        </div>
      </main>
    </>
  );

  /* ── Register screen ── */
  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" />
      <Navbar scrolled />
      <main className="auth-page">
        <div className="auth-container">
          <div className="auth-header">
            <div className="brand-logo">KK</div>
            <h1 className="auth-title">Create your account</h1>
            <p className="auth-subtitle">Join Kajal Kitchen and order your favourites</p>
          </div>

          <form className="auth-form" onSubmit={handleRegister} noValidate>

            {/* Full Name */}
            <div className="form-group">
              <label htmlFor="reg-name">Full Name</label>
              <input
                type="text" id="reg-name" placeholder="e.g. Rahul Sharma"
                value={name}
                onChange={e => { setName(e.target.value); if (touched.name) revalidate('name', e.target.value); }}
                onBlur={() => { touch('name'); revalidate('name', name); }}
                style={inpStyle('name')}
              />
              {err('name')
                ? <p style={{ color: '#ef4444', fontSize: '0.82rem', marginTop: 4 }}>⚠ {err('name')}</p>
                : touched.name && !errors.name
                  ? <p style={{ color: '#22c55e', fontSize: '0.82rem', marginTop: 4 }}>✓ Looks good!</p>
                  : null
              }
            </div>

            {/* Email / Phone */}
            <div className="form-group">
              <label htmlFor="reg-contact">Email address or Phone</label>
              <input
                type="text" id="reg-contact" placeholder="e.g. rahul@example.com or 9876543210"
                value={contact}
                onChange={e => { setContact(e.target.value); if (touched.contact) revalidate('contact', e.target.value); }}
                onBlur={() => { touch('contact'); revalidate('contact', contact); }}
                style={inpStyle('contact')}
              />
              {err('contact')
                ? <p style={{ color: '#ef4444', fontSize: '0.82rem', marginTop: 4 }}>⚠ {err('contact')}</p>
                : touched.contact && !errors.contact
                  ? <p style={{ color: '#22c55e', fontSize: '0.82rem', marginTop: 4 }}>✓ {EMAIL_RE.test(contact) ? 'Valid email' : 'Valid phone number'}</p>
                  : null
              }
            </div>

            {/* Password */}
            <div className="form-group">
              <label htmlFor="reg-password">Password</label>
              <div className="password-wrapper">
                <input
                  type={showPass ? 'text' : 'password'} id="reg-password" placeholder="Min 8 chars, 1 uppercase, 1 number, 1 special"
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    if (touched.password) revalidate('password', e.target.value, e.target.value);
                  }}
                  onBlur={() => { touch('password'); revalidate('password', password, password); }}
                  style={inpStyle('password')}
                />
                <button type="button" className="password-toggle" onClick={() => setShowPass(v => !v)}>
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>

              {/* Strength meter */}
              {password && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= strength.score ? strength.color : '#e5e5e5', transition: 'background 0.2s' }} />
                    ))}
                  </div>
                  <p style={{ fontSize: '0.78rem', color: strength.color, fontWeight: 600 }}>{strength.label} password</p>
                </div>
              )}

              {err('password') && <p style={{ color: '#ef4444', fontSize: '0.82rem', marginTop: 4 }}>⚠ {err('password')}</p>}
            </div>

            {/* Confirm Password */}
            <div className="form-group">
              <label htmlFor="reg-confirm">Confirm Password</label>
              <div className="password-wrapper">
                <input
                  type={showConf ? 'text' : 'password'} id="reg-confirm" placeholder="Re-enter your password"
                  value={confirm}
                  onChange={e => { setConfirm(e.target.value); if (touched.confirm) revalidate('confirm', e.target.value); }}
                  onBlur={() => { touch('confirm'); revalidate('confirm', confirm); }}
                  style={inpStyle('confirm')}
                />
                <button type="button" className="password-toggle" onClick={() => setShowConf(v => !v)}>
                  {showConf ? '🙈' : '👁️'}
                </button>
              </div>
              {err('confirm')
                ? <p style={{ color: '#ef4444', fontSize: '0.82rem', marginTop: 4 }}>⚠ {err('confirm')}</p>
                : touched.confirm && !errors.confirm && confirm
                  ? <p style={{ color: '#22c55e', fontSize: '0.82rem', marginTop: 4 }}>✓ Passwords match</p>
                  : null
              }
            </div>

            {/* Password requirements checklist */}
            {(touched.password || password) && (
              <div style={{ background: '#f9f9f9', borderRadius: 8, padding: '0.75rem 1rem', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[
                  { ok: password.length >= 8,          label: 'At least 8 characters' },
                  { ok: /[A-Z]/.test(password),        label: 'One uppercase letter (A–Z)' },
                  { ok: /[0-9]/.test(password),        label: 'One number (0–9)' },
                  { ok: /[^A-Za-z0-9]/.test(password), label: 'One special character (!@#$…)' },
                ].map(({ ok, label }) => (
                  <span key={label} style={{ color: ok ? '#22c55e' : '#999' }}>
                    {ok ? '✓' : '○'} {label}
                  </span>
                ))}
              </div>
            )}

            {submitError && <p style={{ color: '#e74c3c', fontSize: '0.88rem' }}>{submitError}</p>}

            <button type="submit" className="btn btn-full" disabled={loading}>
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <div className="divider">or</div>
          <div id="google-btn-container" />
          <div className="auth-footer">
            <p>Already have an account? <Link href="/login">Sign in</Link></p>
          </div>
        </div>
      </main>
    </>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div style={{ padding: '6rem 1rem', textAlign: 'center' }}>Loading...</div>}>
      <RegisterContent />
    </Suspense>
  );
}
