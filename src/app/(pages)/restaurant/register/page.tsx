'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import ToastInit from '@/components/Toast';
import { getAuthToken } from '@/lib/utils';

const PARTNER_HIGHLIGHTS = [
  'Professional storefront setup',
  'Accurate contact and delivery details',
  'Ready for menu and order management',
];

export default function RestaurantRegister() {
  const [form, setForm] = useState({
    name: '',
    contact: '',
    address: '',
    description: '',
    imageUrl: '',
    lat: '',
    lng: '',
  });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const token = getAuthToken() || localStorage.getItem('token') || '';

    if (!token) {
      router.push('/login?next=/restaurant/register');
      return;
    }

    fetch('/api/my-restaurant', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (res.ok) router.push('/restaurant/dashboard');
      })
      .catch(() => {});
  }, [router]);

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = getAuthToken() || localStorage.getItem('token') || '';
      const res = await fetch('/api/restaurants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...form,
          lat: parseFloat(form.lat) || 0,
          lng: parseFloat(form.lng) || 0,
        }),
      });

      const data = await res.json();

      if (data.success) {
        window.showSystemToast?.('Success', 'Restaurant registered successfully!', 'success');
        router.push('/restaurant/dashboard');
      } else {
        window.showSystemToast?.('Error', data.message, 'error');
      }
    } catch {
      window.showSystemToast?.('Error', 'Failed to register restaurant.', 'error');
    }

    setLoading(false);
  };

  return (
    <>
      <Navbar scrolled />
      <ToastInit />

      <main className="auth-page restaurant-register-page">
        <section className="restaurant-register-shell">
          <div className="restaurant-register-intro">
            <p className="restaurant-register-eyebrow">Restaurant Onboarding</p>
            <h1 className="restaurant-register-title">Register your restaurant</h1>
            <p className="restaurant-register-copy">
              Add your core business details and create a clean restaurant profile that is ready for dashboard operations.
            </p>

            <div className="restaurant-register-badges">
              {PARTNER_HIGHLIGHTS.map((item) => (
                <span key={item} className="restaurant-register-badge">
                  {item}
                </span>
              ))}
            </div>

            <div className="restaurant-register-note">
              <h2>Signed-in partner setup</h2>
              <p>
                Your restaurant will be linked to your current account so you can manage orders, menu items, and updates
                from one place.
              </p>
            </div>
          </div>

          <div className="auth-container restaurant-register-container">
            <div className="auth-header restaurant-register-header">
              <div className="brand-logo">KK</div>
              <h2 className="auth-title">Register your restaurant</h2>
              <p className="auth-subtitle">Keep the details clear, accurate, and customer-ready.</p>
            </div>

            <form className="auth-form restaurant-register-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="restaurant-name">Restaurant Name</label>
                <input
                  id="restaurant-name"
                  type="text"
                  required
                  placeholder="e.g. Kajal's Family Kitchen"
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="restaurant-contact">Contact</label>
                <input
                  id="restaurant-contact"
                  type="text"
                  required
                  placeholder="Email or phone number"
                  value={form.contact}
                  onChange={(e) => updateField('contact', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="restaurant-address">Address</label>
                <input
                  id="restaurant-address"
                  type="text"
                  required
                  placeholder="Full restaurant address"
                  value={form.address}
                  onChange={(e) => updateField('address', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="restaurant-description">Description</label>
                <textarea
                  id="restaurant-description"
                  rows={4}
                  placeholder="Tell customers what makes your kitchen special"
                  value={form.description}
                  onChange={(e) => updateField('description', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="restaurant-image">Image URL</label>
                <input
                  id="restaurant-image"
                  type="url"
                  placeholder="https://example.com/restaurant-cover.jpg"
                  value={form.imageUrl}
                  onChange={(e) => updateField('imageUrl', e.target.value)}
                />
              </div>

              <div className="restaurant-register-grid">
                <div className="form-group">
                  <label htmlFor="restaurant-lat">Latitude</label>
                  <input
                    id="restaurant-lat"
                    type="number"
                    step="any"
                    placeholder="28.6139"
                    value={form.lat}
                    onChange={(e) => updateField('lat', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="restaurant-lng">Longitude</label>
                  <input
                    id="restaurant-lng"
                    type="number"
                    step="any"
                    placeholder="77.2090"
                    value={form.lng}
                    onChange={(e) => updateField('lng', e.target.value)}
                  />
                </div>
              </div>

              <p className="restaurant-register-helper">
                Use the most accurate address and coordinates available for reliable delivery routing.
              </p>

              <button type="submit" className="btn btn-full restaurant-register-submit" disabled={loading}>
                {loading ? 'Registering restaurant...' : 'Register Restaurant'}
              </button>
            </form>
          </div>
        </section>
      </main>
    </>
  );
}
