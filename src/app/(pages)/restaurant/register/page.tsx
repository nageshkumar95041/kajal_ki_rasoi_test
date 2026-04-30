'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import ToastInit from '@/components/Toast';
import { getAuthToken } from '@/lib/utils';

const FEATURES = [
  { icon: '🍽️', title: 'Digital Storefront', desc: 'Professional listing with your menu, photos, and details' },
  { icon: '📦', title: 'Order Management', desc: 'Real-time order tracking and fulfilment dashboard' },
  { icon: '🚴', title: 'Delivery Routing', desc: 'Integrated delivery with Borzo and in-house agents' },
];

export default function RestaurantRegister() {
  const [form, setForm] = useState({
    name: '', contact: '', address: '', description: '', imageUrl: '', lat: '', lng: '',
  });
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [step, setStep] = useState(1); // 2-step form
  const router = useRouter();

  useEffect(() => {
    const token = getAuthToken() || localStorage.getItem('token') || '';
    if (!token) { router.push('/login?next=/restaurant/register'); return; }
    fetch('/api/my-restaurant', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => { if (res.ok) router.push('/restaurant/dashboard'); })
      .catch(() => {});
  }, [router]);

  const set = (field: keyof typeof form, value: string) =>
    setForm(cur => ({ ...cur, [field]: value }));

  function detectLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        set('lat', String(pos.coords.latitude.toFixed(6)));
        set('lng', String(pos.coords.longitude.toFixed(6)));
        setLocating(false);
      },
      () => setLocating(false)
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const token = getAuthToken() || localStorage.getItem('token') || '';
      const res = await fetch('/api/restaurants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, lat: parseFloat(form.lat) || 0, lng: parseFloat(form.lng) || 0 }),
      });
      const data = await res.json();
      if (data.success) {
        window.showSystemToast?.('Success', 'Restaurant registered successfully!', 'success');
        router.push('/restaurant/dashboard');
      } else {
        window.showSystemToast?.('Error', data.message, 'error');
      }
    } catch {
      window.showSystemToast?.('Error', 'Failed to register. Please try again.', 'error');
    }
    setLoading(false);
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '13px 16px', fontSize: '0.95rem',
    border: '1.5px solid #e5e0d8', borderRadius: 10,
    background: '#fdfaf7', color: '#1a0e00', outline: 'none',
    fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  };

  const label: React.CSSProperties = {
    display: 'block', marginBottom: 6, fontSize: '0.85rem',
    fontWeight: 600, color: '#4a3728', fontFamily: "'DM Sans', sans-serif",
    letterSpacing: '0.02em',
  };

  return (
    <>
      <Navbar scrolled />
      <ToastInit />

      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(160deg, #0d0700 0%, #1a0e00 40%, #0f0800 100%)',
        paddingTop: 80,
        paddingBottom: 60,
      }}>

        {/* Hero Header */}
        <div style={{ textAlign: 'center', padding: '3rem 1rem 2rem' }}>
          <div style={{
            display: 'inline-block', background: 'rgba(249,115,22,0.12)',
            border: '1px solid rgba(249,115,22,0.3)', borderRadius: 30,
            padding: '6px 18px', marginBottom: 20,
          }}>
            <span style={{ color: '#f97316', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              Partner Onboarding
            </span>
          </div>
          <h1 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 'clamp(2.2rem, 5vw, 3.5rem)',
            color: '#fff', fontWeight: 600,
            lineHeight: 1.1, margin: '0 0 16px',
            letterSpacing: '-0.02em',
          }}>
            List your restaurant<br />
            <span style={{ color: '#E8A84C' }}>on Kajal Ki Rasoi</span>
          </h1>
          <p style={{
            color: 'rgba(255,255,255,0.55)', fontSize: '1rem',
            fontFamily: "'DM Sans', sans-serif", maxWidth: 480,
            margin: '0 auto', lineHeight: 1.7,
          }}>
            Set up your kitchen profile in minutes and start receiving orders directly from customers in your area.
          </p>
        </div>

        {/* Feature cards */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 16,
          flexWrap: 'wrap', padding: '0 5%', marginBottom: '2.5rem',
        }}>
          {FEATURES.map(f => (
            <div key={f.title} style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14, padding: '18px 22px',
              flex: '1 1 180px', maxWidth: 220,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>{f.icon}</div>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem', marginBottom: 4, fontFamily: "'DM Sans', sans-serif" }}>{f.title}</div>
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.78rem', lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif" }}>{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Form card */}
        <div style={{
          maxWidth: 580, margin: '0 auto', padding: '0 1rem',
        }}>
          <div style={{
            background: '#fff',
            borderRadius: 20,
            boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
            overflow: 'hidden',
          }}>

            {/* Card top bar */}
            <div style={{
              background: 'linear-gradient(90deg, #1a0e00 0%, #2d1a08 100%)',
              padding: '20px 28px',
              display: 'flex', alignItems: 'center', gap: 14,
              borderBottom: '3px solid #E8A84C',
            }}>
              <div style={{
                width: 42, height: 42, borderRadius: '50%',
                background: 'linear-gradient(135deg, #E8A84C, #E07B2D)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: '1rem', color: '#fff',
                flexShrink: 0,
              }}>KK</div>
              <div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: '1rem', fontFamily: "'DM Sans', sans-serif" }}>
                  Restaurant Registration
                </div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem', fontFamily: "'DM Sans', sans-serif" }}>
                  Step {step} of 2 — {step === 1 ? 'Basic Info' : 'Location & Media'}
                </div>
              </div>
              {/* Step indicator */}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                {[1, 2].map(s => (
                  <div key={s} style={{
                    width: s === step ? 24 : 8, height: 8, borderRadius: 4,
                    background: s === step ? '#E8A84C' : 'rgba(255,255,255,0.2)',
                    transition: 'all 0.3s',
                  }} />
                ))}
              </div>
            </div>

            {/* Form body */}
            <form onSubmit={handleSubmit} style={{ padding: '28px' }}>

              {step === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div>
                    <label style={label}>Restaurant Name *</label>
                    <input type="text" required placeholder="e.g. Kajal's Family Kitchen"
                      value={form.name} onChange={e => set('name', e.target.value)}
                      style={inp}
                      onFocus={e => (e.target.style.borderColor = '#E8A84C')}
                      onBlur={e => (e.target.style.borderColor = '#e5e0d8')}
                    />
                  </div>

                  <div>
                    <label style={label}>Contact (Email or Phone) *</label>
                    <input type="text" required placeholder="hello@yourrestaurant.com or +91 9876543210"
                      value={form.contact} onChange={e => set('contact', e.target.value)}
                      style={inp}
                      onFocus={e => (e.target.style.borderColor = '#E8A84C')}
                      onBlur={e => (e.target.style.borderColor = '#e5e0d8')}
                    />
                  </div>

                  <div>
                    <label style={label}>Full Address *</label>
                    <input type="text" required placeholder="Shop no., Street, Area, City, Pincode"
                      value={form.address} onChange={e => set('address', e.target.value)}
                      style={inp}
                      onFocus={e => (e.target.style.borderColor = '#E8A84C')}
                      onBlur={e => (e.target.style.borderColor = '#e5e0d8')}
                    />
                  </div>

                  <div>
                    <label style={label}>About your Kitchen</label>
                    <textarea required placeholder="Tell customers what makes your food special — cuisine type, specialties, story..."
                      rows={4} value={form.description} onChange={e => set('description', e.target.value)}
                      style={{ ...inp, resize: 'vertical', minHeight: 100 }}
                      onFocus={e => (e.target.style.borderColor = '#E8A84C')}
                      onBlur={e => (e.target.style.borderColor = '#e5e0d8')}
                    />
                  </div>

                  <button type="button"
                    onClick={() => {
                      if (!form.name || !form.contact || !form.address || !form.description) {
                        window.showSystemToast?.('Error', 'Please fill all required fields.', 'error');
                        return;
                      }
                      setStep(2);
                    }}
                    style={{
                      width: '100%', padding: '14px', borderRadius: 10,
                      background: 'linear-gradient(135deg, #E8A84C 0%, #E07B2D 100%)',
                      color: '#fff', border: 'none', cursor: 'pointer',
                      fontWeight: 700, fontSize: '1rem', fontFamily: "'DM Sans', sans-serif",
                      marginTop: 4,
                    }}>
                    Continue →
                  </button>
                </div>
              )}

              {step === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div>
                    <label style={label}>Restaurant Cover Image URL</label>
                    <input type="url" placeholder="https://example.com/your-kitchen.jpg"
                      value={form.imageUrl} onChange={e => set('imageUrl', e.target.value)}
                      style={inp}
                      onFocus={e => (e.target.style.borderColor = '#E8A84C')}
                      onBlur={e => (e.target.style.borderColor = '#e5e0d8')}
                    />
                    {form.imageUrl && (
                      <img src={form.imageUrl} alt="Preview"
                        style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 8, marginTop: 8, border: '1px solid #e5e0d8' }}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                  </div>

                  {/* Location */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <label style={{ ...label, marginBottom: 0 }}>Location Coordinates</label>
                      <button type="button" onClick={detectLocation}
                        style={{
                          background: locating ? '#e5e0d8' : '#fff7ed',
                          border: '1px solid #E8A84C', color: '#c86f2d',
                          padding: '4px 12px', borderRadius: 20,
                          fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                          fontFamily: "'DM Sans', sans-serif",
                        }}>
                        {locating ? '📍 Locating…' : '📍 Auto-detect'}
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <input type="number" step="any" placeholder="Latitude e.g. 28.6139"
                          value={form.lat} onChange={e => set('lat', e.target.value)}
                          style={inp}
                          onFocus={e => (e.target.style.borderColor = '#E8A84C')}
                          onBlur={e => (e.target.style.borderColor = '#e5e0d8')}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <input type="number" step="any" placeholder="Longitude e.g. 77.2090"
                          value={form.lng} onChange={e => set('lng', e.target.value)}
                          style={inp}
                          onFocus={e => (e.target.style.borderColor = '#E8A84C')}
                          onBlur={e => (e.target.style.borderColor = '#e5e0d8')}
                        />
                      </div>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: '#9a8878', marginTop: 6, fontFamily: "'DM Sans', sans-serif" }}>
                      Used for accurate delivery routing. Click "Auto-detect" or enter manually.
                    </p>
                  </div>

                  {/* Summary box */}
                  <div style={{
                    background: '#fdfaf7', border: '1.5px solid #e5e0d8',
                    borderRadius: 10, padding: '14px 16px',
                  }}>
                    <p style={{ margin: '0 0 4px', fontSize: '0.78rem', fontWeight: 700, color: '#c86f2d', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'DM Sans', sans-serif" }}>Summary</p>
                    <p style={{ margin: '0 0 2px', fontWeight: 600, color: '#1a0e00', fontFamily: "'DM Sans', sans-serif" }}>{form.name}</p>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#6a5c50', fontFamily: "'DM Sans', sans-serif" }}>{form.address}</p>
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" onClick={() => setStep(1)}
                      style={{
                        flex: 1, padding: '14px', borderRadius: 10,
                        background: '#f5f0ea', color: '#4a3728',
                        border: '1.5px solid #e5e0d8', cursor: 'pointer',
                        fontWeight: 600, fontSize: '0.95rem', fontFamily: "'DM Sans', sans-serif",
                      }}>
                      ← Back
                    </button>
                    <button type="submit" disabled={loading}
                      style={{
                        flex: 2, padding: '14px', borderRadius: 10,
                        background: loading ? '#d4a96a' : 'linear-gradient(135deg, #E8A84C 0%, #E07B2D 100%)',
                        color: '#fff', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                        fontWeight: 700, fontSize: '1rem', fontFamily: "'DM Sans', sans-serif",
                      }}>
                      {loading ? 'Registering…' : '🍽️ Register Restaurant'}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>

          <p style={{
            textAlign: 'center', marginTop: 20, color: 'rgba(255,255,255,0.35)',
            fontSize: '0.82rem', fontFamily: "'DM Sans', sans-serif",
          }}>
            Your restaurant will be linked to your current account.<br />
            You can edit all details from your dashboard after registration.
          </p>
        </div>
      </div>
    </>
  );
}