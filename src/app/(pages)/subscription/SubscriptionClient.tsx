'use client';
import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import ToastInit from '@/components/Toast';
import { getAuthToken, getLoggedInUser, isTokenExpired } from '@/lib/utils';

/* ── Google Maps loader (same as payment page) ─────────────────────────────── */
declare global {
  interface Window {
    google: any;
    googleMapsInitialized?: boolean;
    __mapsLoadPromise?: Promise<void>;
    __initGoogleMaps?: () => void;
  }
}

function loadMapsScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.googleMapsInitialized && window.google) return Promise.resolve();
  if (window.__mapsLoadPromise) return window.__mapsLoadPromise;
  window.__mapsLoadPromise = new Promise<void>(async (resolve) => {
    if (document.querySelector('script[src*="maps.googleapis.com"]')) {
      if (window.googleMapsInitialized) { resolve(); return; }
      const prev = window.__initGoogleMaps;
      window.__initGoogleMaps = () => { prev?.(); resolve(); };
      return;
    }
    try {
      const res = await fetch('/api/config/google-maps');
      if (!res.ok) { resolve(); return; }
      const { apiKey } = await res.json();
      if (!apiKey) { resolve(); return; }
      window.__initGoogleMaps = () => { window.googleMapsInitialized = true; resolve(); };
      const s = document.createElement('script');
      s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=__initGoogleMaps&loading=async`;
      s.async = true; s.defer = true;
      s.onerror = () => resolve();
      document.head.appendChild(s);
    } catch { resolve(); }
  });
  return window.__mapsLoadPromise;
}

/* ─────────── Plan Config ─────────── */
interface PlanConfig {
  name: string; desc: string;
  monthlyPrice5: number; monthlyPrice7: number;
  mealPrice5: number;    mealPrice7: number;
  origPrice5: number;    origPrice7: number;
  features: string[];    popular?: boolean;
}

const PLANS: PlanConfig[] = [
  {
    name: 'Basic Thali', desc: 'Perfect for a light, everyday lunch.',
    monthlyPrice5: 3200, monthlyPrice7: 4200, mealPrice5: 120, mealPrice7: 130,
    origPrice5: 3600, origPrice7: 4800,
    features: ['4 Soft Rotis', 'Fresh Seasonal Sabzi', 'Yellow Dal Tadka', 'Fresh Green Salad'],
  },
  {
    name: 'Standard Thali', desc: 'The classic, balanced Indian meal.',
    monthlyPrice5: 4200, monthlyPrice7: 5200, mealPrice5: 160, mealPrice7: 170,
    origPrice5: 4800, origPrice7: 5800,
    features: ['3 Rotis & Plain Rice', 'Premium Dry Sabzi', 'Dal Makhani / Dal Tadka', 'Salad & Homemade Pickle'],
    popular: true,
  },
  {
    name: 'Premium Thali', desc: 'For those who love a little extra.',
    monthlyPrice5: 5800, monthlyPrice7: 7000, mealPrice5: 220, mealPrice7: 230,
    origPrice5: 6600, origPrice7: 7800,
    features: ['3 Butter Rotis & Jeera Rice', 'Special Paneer Sabzi', 'Rich Dal', 'Boondi Raita, Salad & Sweet'],
  },
];

const FAQS = [
  { q: 'Can I pause my subscription if I travel?',    a: 'Absolutely! Just drop us a WhatsApp message a day in advance, and we will pause your tiffin and carry forward your balance. No money lost!' },
  { q: 'Can I customize the food?',                   a: 'Yes, you can request less oil, mild spices, or extra items like rice and rotis when setting up your plan.' },
  { q: "What if I don't like a specific vegetable?",  a: 'Let us know your dislikes beforehand, and we will happily swap it out with an alternative sabzi or extra dal.' },
  { q: 'How do I pay for my subscription?',           a: 'You can pay online via UPI, card, or net banking. We also accept cash payments for select areas.' },
];

export default function SubscriptionClient() {
  const searchParams = useSearchParams();
  const router       = useRouter();

  const [frequency, setFrequency]   = useState<5 | 7>(7);
  const [persons, setPersons]       = useState(1);
  const [openFaq, setOpenFaq]       = useState<number | null>(null);
  const [modal, setModal]           = useState<{ plan: string; frequency: number; price: number; persons: number } | null>(null);
  const [form, setForm]             = useState({ name: '', contact: '', address: '', startDate: '', coupon: '' });
  const [finalPrice, setFinalPrice] = useState(0);
  const [couponMsg, setCouponMsg]   = useState('');
  const [loading, setLoading]       = useState(false);

  // Address search state
  const [searchValue, setSearchValue]   = useState('');
  const [suggestions, setSuggestions]   = useState<any[]>([]);
  const [activeSuggIdx, setActiveSuggIdx] = useState(-1);
  const [mapsReady, setMapsReady]       = useState(false);
  const [autofillMsg, setAutofillMsg]   = useState('');

  const debounceRef  = useRef<NodeJS.Timeout | null>(null);
  const sessionTok   = useRef<any>(null);
  const searchContRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (searchParams.get('sub_success') === 'true') {
      window.showSystemToast?.('Payment Successful!', 'Your subscription is now active. 🎉', 'success');
      window.history.replaceState({}, '', '/subscription');
    }
    const u    = getLoggedInUser();
    const tmrw = new Date(); tmrw.setDate(tmrw.getDate() + 1);
    setForm(f => ({
      ...f,
      name:      u?.name    || '',
      contact:   u?.contact || '',
      startDate: tmrw.toISOString().split('T')[0],
    }));

    // Load Google Maps
    loadMapsScript().then(() => {
      if (window.google?.maps?.places) {
        sessionTok.current = new window.google.maps.places.AutocompleteSessionToken();
        setMapsReady(true);
      }
    });
  }, [searchParams]);

  // Close suggestions on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (searchContRef.current && !searchContRef.current.contains(e.target as Node))
        setSuggestions([]);
    };
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, []);

  // ── Address search ───────────────────────────────────────────────────────────
  async function getSuggestions(input: string) {
    if (!input || input.trim().length < 3 || !mapsReady) { setSuggestions([]); return; }
    try {
      const { suggestions: results } =
        await window.google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input, sessionToken: sessionTok.current, includedRegionCodes: ['in'],
        });
      setSuggestions(results || []);
      setActiveSuggIdx(-1);
    } catch { setSuggestions([]); }
  }

  function handleSearchInput(val: string) {
    setSearchValue(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => getSuggestions(val), 300);
  }

  async function selectSuggestion(placeId: string) {
    setSuggestions([]); setSearchValue('');
    if (!placeId) return;
    try {
      const place = new window.google.maps.places.Place({ id: placeId });
      await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'addressComponents', 'location', 'types'] });

      const get = (...types: string[]) => {
        for (const t of types) {
          const c = place.addressComponents?.find((x: any) => x.types.includes(t));
          if (c) return c.longText ?? c.long_name ?? '';
        }
        return '';
      };
      const flatB   = get('premise', 'subpremise', 'street_number');
      const street  = get('route');
      const sub2    = get('sublocality_level_2');
      const sub1    = get('sublocality_level_1');
      const neighb  = get('neighborhood');
      const cityVal = get('locality', 'administrative_area_level_2');
      const pinVal  = get('postal_code');
      const isPoI   = place.types?.includes('point_of_interest') || place.types?.includes('establishment');
      const displayName = place.displayName ?? place.name ?? '';

      // Build a clean single address string for the textarea
      const parts = [
        flatB || street,
        sub2 || sub1 || neighb,
        isPoI ? displayName : '',
        cityVal,
        pinVal,
      ].filter(Boolean);
      const fullAddress = parts.join(', ');

      setForm(f => ({ ...f, address: fullAddress }));
      setAutofillMsg('✅ Address filled in automatically.');
      setTimeout(() => setAutofillMsg(''), 3000);
      sessionTok.current = new window.google.maps.places.AutocompleteSessionToken();
    } catch (err) { console.error('Place details error', err); }
  }

  function handleKeyboardNav(e: React.KeyboardEvent) {
    if (!suggestions.length) return;
    if (e.key === 'ArrowDown')  { e.preventDefault(); setActiveSuggIdx(i => (i + 1) % suggestions.length); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveSuggIdx(i => i <= 0 ? suggestions.length - 1 : i - 1); }
    else if (e.key === 'Enter')     { e.preventDefault(); if (activeSuggIdx >= 0) selectSuggestion(suggestions[activeSuggIdx].placePrediction?.placeId); }
    else if (e.key === 'Escape')    { setSuggestions([]); }
  }

  // ── Auth check ───────────────────────────────────────────────────────────────
  function checkAuth(): boolean {
    const token = getAuthToken();
    if (!token || isTokenExpired(token)) {
      window.showSystemToast?.('Login Required', 'Please login to subscribe.', 'info');
      setTimeout(() => router.push('/login'), 1500);
      return false;
    }
    return true;
  }

  function openModal(plan: string, freq: number, price: number) {
    if (!checkAuth()) return;
    const total = price * persons;
    setModal({ plan, frequency: freq, price: total, persons });
    setFinalPrice(total);
    setCouponMsg('');
    setSearchValue('');
    setSuggestions([]);
    setAutofillMsg('');
    const u = getLoggedInUser();
    if (u) setForm(f => ({ ...f, name: u.name, contact: u.contact }));
  }

  function applyCoupon() {
    if (!modal) return;
    if (form.coupon.toUpperCase() === 'APNA50' && modal.price >= 200) {
      setFinalPrice(modal.price - 50);
      setCouponMsg('✅ ₹50 off applied!');
    } else {
      setCouponMsg('❌ Invalid coupon or minimum not met.');
    }
  }

  async function submitSub(method: 'offline' | 'online') {
    if (!modal) return;
    if (!form.name || !form.contact || !form.address || !form.startDate) {
      window.showSystemToast?.('Missing Fields', 'Please fill all required fields.', 'warning');
      return;
    }
    setLoading(true);
    const token   = getAuthToken();
    const payload = {
      plan: modal.plan, frequency: modal.frequency, price: finalPrice, persons: modal.persons,
      couponCode: form.coupon || null, customerName: form.name,
      contact: form.contact, address: form.address, startDate: form.startDate,
    };

    if (method === 'offline') {
      const res  = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setModal(null);
        window.showSystemToast?.('Subscription Requested!', data.message, 'success');
      } else {
        window.showSystemToast?.('Failed', data.message || 'Something went wrong.', 'error');
      }
    } else {
      const subPayload = {
        ...payload,
        successUrl: `${window.location.origin}/subscription?sub_success=true`,
        cancelUrl:  `${window.location.origin}/subscription`,
      };
      const res  = await fetch('/api/create-stripe-subscription-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
        body: JSON.stringify(subPayload),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        window.showSystemToast?.('Checkout Failed', data.error || 'Please try again.', 'error');
      }
    }
    setLoading(false);
  }

  const getPrice = (p: PlanConfig) => frequency === 5 ? p.monthlyPrice5 : p.monthlyPrice7;
  const getMeal  = (p: PlanConfig) => frequency === 5 ? p.mealPrice5    : p.mealPrice7;
  const getOrig  = (p: PlanConfig) => frequency === 5 ? p.origPrice5    : p.origPrice7;

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: '#0f0a04',
    border: '1px solid #3a2a10', borderRadius: 8, padding: '10px 12px',
    color: '#f0e6d0', fontSize: '0.9rem', outline: 'none', fontFamily: 'inherit',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: '0.7rem', fontWeight: 700, color: '#e67e22', display: 'block',
    marginBottom: 5, letterSpacing: '0.08em', textTransform: 'uppercase',
  };

  return (
    <>
      <ToastInit />
      <Navbar scrolled />

      <main style={{ background: '#f5f0e8', minHeight: '100vh', paddingTop: '64px', paddingBottom: '4rem' }}>

        {/* HEADER */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem', padding: '0 1.5rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#1a1a1a' }}>Plans &amp; Pricing</h1>
          <p style={{ color: '#555', marginTop: '0.5rem', fontSize: '1rem' }}>
            Flexible weekly and monthly subscriptions designed for your appetite.<br />
            (100% Pure Veg &amp; Customizable)
          </p>
        </div>

        {/* 7-DAY TRIAL CARD */}
        <div style={{ maxWidth: 860, margin: '0 auto 2.5rem', padding: '0 1rem' }}>
          <div style={{ background: 'linear-gradient(135deg,#fde8c0,#fcd08a)', borderRadius: 20, padding: '2.2rem 2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem' }}>
            <div>
              <span style={{ background: '#e74c3c', color: '#fff', borderRadius: 20, padding: '4px 14px', fontSize: '0.8rem', fontWeight: 700 }}>New Customers ✨</span>
              <h2 style={{ color: '#c0392b', fontSize: '1.9rem', fontWeight: 800, margin: '0.7rem 0 0.6rem' }}>7-Day Trial Week</h2>
              <p style={{ color: '#5a3e28', maxWidth: 500, lineHeight: 1.7 }}>
                Not sure yet? Taste our <strong>Standard Thali</strong> for a full week at a special introductory price. Taste the difference before committing to a monthly plan!
              </p>
            </div>
            <div style={{ background: '#fff', borderRadius: 16, padding: '1.5rem 2rem', textAlign: 'center', minWidth: 170, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
              <div style={{ fontSize: '2.4rem', fontWeight: 800, color: '#e67e22' }}>₹699</div>
              <div style={{ color: '#888', textDecoration: 'line-through', fontSize: '0.9rem', margin: '0.2rem 0 1rem' }}>Regular Price: ₹840</div>
              <button onClick={() => openModal('7-Day Trial Week', 7, 699)}
                style={{ background: '#d4860a', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 20px', fontWeight: 700, letterSpacing: '0.05em', cursor: 'pointer', fontSize: '0.85rem', width: '100%' }}>
                CLAIM TRIAL OFFER
              </button>
            </div>
          </div>
        </div>

        {/* FREQUENCY & PERSONS */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2.5rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: '#888', textAlign: 'center', marginBottom: '0.4rem' }}>Delivery Frequency</div>
            <div style={{ display: 'flex', background: '#eee', borderRadius: 40, padding: 4 }}>
              {([5, 7] as const).map(f => (
                <button key={f} onClick={() => setFrequency(f)} style={{ padding: '10px 22px', borderRadius: 40, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', background: frequency === f ? '#e67e22' : 'transparent', color: frequency === f ? '#fff' : '#555', transition: 'all 0.2s' }}>
                  {f === 5 ? '5 Days (Mon-Fri)' : '7 Days (Mon-Sun)'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: '#888', textAlign: 'center', marginBottom: '0.4rem' }}>Number of People</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
              <button onClick={() => setPersons(p => Math.max(1, p - 1))} style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid #ccc', background: '#fff', fontSize: '1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>−</button>
              <span style={{ fontWeight: 700, fontSize: '1.1rem', minWidth: 20, textAlign: 'center' }}>{persons}</span>
              <button onClick={() => setPersons(p => p + 1)} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: '#e67e22', fontSize: '1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>+</button>
            </div>
          </div>
        </div>

        {/* PLAN CARDS */}
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center', maxWidth: 960, margin: '0 auto', padding: '0 1rem' }}>
          {PLANS.map(p => (
            <div key={p.name} style={{ background: '#fff', borderRadius: 20, border: p.popular ? '2px solid #e67e22' : '1px solid #e5e5e5', padding: '2rem 1.8rem', flex: '1 1 260px', maxWidth: 300, position: 'relative', boxShadow: p.popular ? '0 6px 30px rgba(230,126,34,0.15)' : '0 2px 12px rgba(0,0,0,0.05)' }}>
              {p.popular && (
                <div style={{ position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)', background: '#e67e22', color: '#fff', borderRadius: 20, padding: '6px 18px', fontSize: '0.82rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  Most Popular ⭐
                </div>
              )}
              <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1a1a1a', marginBottom: '0.4rem' }}>{p.name}</h3>
              <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '1.2rem' }}>{p.desc}</p>
              <div style={{ marginBottom: '0.3rem' }}>
                <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#e67e22' }}>₹{(getPrice(p) * persons).toLocaleString('en-IN')}</span>
                <span style={{ color: '#888', fontSize: '0.9rem' }}> / month</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.4rem' }}>
                <span style={{ color: '#27ae60', fontWeight: 600, fontSize: '0.9rem' }}>₹{getMeal(p)} / meal</span>
                <span style={{ color: '#bbb', textDecoration: 'line-through', fontSize: '0.85rem' }}>₹{(getOrig(p) * persons).toLocaleString('en-IN')}</span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, marginBottom: '1.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {p.features.map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: '#444' }}>
                    <span style={{ color: '#27ae60' }}>✅</span> {f}
                  </li>
                ))}
              </ul>
              <button onClick={() => openModal(p.name, frequency, getPrice(p))}
                style={{ width: '100%', background: '#d4860a', color: '#fff', border: 'none', borderRadius: 10, padding: '14px', fontWeight: 700, letterSpacing: '0.05em', cursor: 'pointer', fontSize: '0.9rem' }}>
                SELECT {p.name.toUpperCase().split(' ')[0]} PLAN
              </button>
            </div>
          ))}
        </div>

        {/* PRO TIP */}
        <div style={{ textAlign: 'center', margin: '2.5rem auto 0', padding: '0 1rem' }}>
          <p style={{ color: '#27ae60', fontWeight: 700, fontSize: '0.95rem' }}>
            💡 Pro Tip: Subscribe for a month and get up to 15% OFF your daily meal cost!
          </p>
        </div>

        {/* CUSTOMIZATION */}
        <div style={{ maxWidth: 720, margin: '3.5rem auto 0', padding: '0 1.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#e67e22', marginBottom: '0.8rem' }}>👩‍🍳 Made Just the Way You Like It</h2>
          <p style={{ color: '#444', marginBottom: '1.2rem' }}>We aren&apos;t a rigid commercial kitchen. Tell us what you need!</p>
          <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <li style={{ color: '#444' }}><span style={{ marginRight: 8 }}>🧂</span><strong>Less Oil &amp; Spice:</strong> Prefer mild food? We&apos;ll cook it perfectly for your gut.</li>
            <li style={{ color: '#444' }}><span style={{ marginRight: 8 }}>🥦</span><strong>Dietary Needs:</strong> Jain food or specific vegetable allergies? Just let us know.</li>
            <li style={{ color: '#444' }}><span style={{ marginRight: 8 }}>➕</span><strong>Easy Add-ons:</strong> Need an extra roti, a bowl of curd, or double paneer? Customize effortlessly.</li>
          </ul>
        </div>

        {/* DELIVERY DETAILS */}
        <div style={{ maxWidth: 720, margin: '2.5rem auto 0', padding: '0 1.5rem' }}>
          <div style={{ borderLeft: '4px solid #27ae60', background: '#fff', borderRadius: '0 12px 12px 0', padding: '1.5rem 1.5rem 1.5rem 2rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1a1a1a', marginBottom: '1rem' }}>🚚 Delivery Details</h2>
            <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              <li style={{ color: '#444' }}><span style={{ marginRight: 8 }}>📍</span><strong>Areas Covered:</strong> Noida, Ghaziabad, and Delhi NCR.</li>
              <li style={{ color: '#444' }}><span style={{ marginRight: 8 }}>🌞</span><strong>Lunch Slot:</strong> 12:30 PM – 2:00 PM <em style={{ color: '#888' }}>(Perfect for office desks)</em></li>
              <li style={{ color: '#444' }}><span style={{ marginRight: 8 }}>🌙</span><strong>Dinner Slot:</strong> 7:30 PM – 9:00 PM <em style={{ color: '#888' }}>(Relax at home)</em></li>
              <li style={{ color: '#444' }}><span style={{ marginRight: 8 }}>⛅</span><strong>Reliability:</strong> Weather rain or shine, your everyday meal will reach you.</li>
            </ul>
          </div>
        </div>

        {/* FAQ */}
        <div style={{ maxWidth: 720, margin: '3rem auto 0', padding: '0 1.5rem' }}>
          <h2 style={{ textAlign: 'center', fontWeight: 800, fontSize: '1.5rem', color: '#1a1a1a', marginBottom: '1.5rem' }}>
            Got Questions? We&apos;ve Got Answers!
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {FAQS.map((faq, i) => (
              <div key={i} onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{ background: '#fff', borderRadius: 12, padding: '1.2rem 1.5rem', cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ color: '#1a1a1a', fontSize: '0.97rem' }}>{faq.q}</strong>
                  <span style={{ color: '#e67e22', fontSize: '1.2rem', marginLeft: '1rem' }}>{openFaq === i ? '−' : '+'}</span>
                </div>
                {openFaq === i && <p style={{ marginTop: '0.8rem', color: '#555', fontSize: '0.93rem', lineHeight: 1.65 }}>{faq.a}</p>}
              </div>
            ))}
          </div>
        </div>

      </main>

      {/* ── MODAL ── */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ width: '100%', maxWidth: 440, background: '#1a1208', border: '1px solid #3a2a10', borderRadius: 16, overflow: 'hidden', color: '#f0e6d0', maxHeight: '90vh', overflowY: 'auto' }}>

            {/* Header */}
            <div style={{ background: '#211508', padding: '1.3rem 1.5rem 1.1rem', borderBottom: '1px solid #3a2a10' }}>
              <p style={{ fontSize: '0.65rem', fontWeight: 700, color: '#e67e22', letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 5px' }}>
                Confirm Subscription
              </p>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f0e6d0' }}>
                  {modal.plan}{modal.persons > 1 ? ` × ${modal.persons}` : ''}
                </span>
                <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#e67e22' }}>₹{finalPrice.toLocaleString('en-IN')}</span>
              </div>
              <div style={{ display: 'flex', gap: 7, marginTop: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.65rem', padding: '3px 10px', borderRadius: 20, border: '1px solid #e67e22', color: '#e67e22', fontWeight: 700, letterSpacing: '0.05em' }}>
                  {modal.frequency} DAYS/WEEK
                </span>
                <span style={{ fontSize: '0.65rem', padding: '3px 10px', borderRadius: 20, border: '1px solid #555', color: '#bbb', fontWeight: 700, letterSpacing: '0.05em' }}>
                  {modal.persons} {modal.persons > 1 ? 'PEOPLE' : 'PERSON'}
                </span>
              </div>
            </div>

            {/* Form body */}
            <div style={{ padding: '1.3rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>

              {/* Name + Contact */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Full Name</label>
                  <input type="text" placeholder="Your name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Contact</label>
                  <input type="text" placeholder="98765 43210" value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} style={inputStyle} />
                </div>
              </div>

              {/* Start Date */}
              <div>
                <label style={labelStyle}>Start Date</label>
                <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} min={new Date(Date.now() + 86400000).toISOString().split('T')[0]} style={{ ...inputStyle, colorScheme: 'dark' }} />
              </div>

              {/* Address search */}
              <div>
                <label style={labelStyle}>Delivery Address</label>

                {/* Search box with autocomplete */}
                <div ref={searchContRef} style={{ position: 'relative', marginBottom: 8 }}>
                  <input
                    type="text"
                    placeholder={mapsReady ? '🔍 Search area, street or landmark…' : '⏳ Loading search…'}
                    autoComplete="off"
                    value={searchValue}
                    onChange={e => handleSearchInput(e.target.value)}
                    onKeyDown={handleKeyboardNav}
                    disabled={!mapsReady}
                    style={{ ...inputStyle, paddingRight: searchValue ? 36 : 12, opacity: mapsReady ? 1 : 0.6 }}
                  />
                  {searchValue && (
                    <button type="button" onClick={() => { setSearchValue(''); setSuggestions([]); }}
                      style={{ position: 'absolute', top: '50%', right: 10, transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#888', fontSize: '1.2rem', cursor: 'pointer', padding: 0, lineHeight: 1 }}>
                      ×
                    </button>
                  )}

                  {/* Dropdown */}
                  {suggestions.length > 0 && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0, background: '#1a1208', border: '1px solid #3a2a10', borderRadius: '0 0 10px 10px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 200, maxHeight: 220, overflowY: 'auto' }}>
                      {suggestions.map((sugg, idx) => {
                        const pred     = sugg.placePrediction;
                        const placeId  = pred?.placeId;
                        const mainText = pred?.mainText?.toString() ?? '';
                        const secText  = pred?.secondaryText?.toString() ?? '';
                        return (
                          <div key={placeId || idx} onClick={() => selectSuggestion(placeId)}
                            style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #2a1a05', background: idx === activeSuggIdx ? '#2a1a05' : 'transparent', transition: 'background 0.1s' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#2a1a05')}
                            onMouseLeave={e => (e.currentTarget.style.background = idx === activeSuggIdx ? '#2a1a05' : 'transparent')}>
                            <div style={{ fontWeight: 500, fontSize: '0.88rem', color: '#f0e6d0' }}>📍 {mainText}</div>
                            <div style={{ fontSize: '0.75rem', color: '#888', marginTop: 2 }}>{secText}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {autofillMsg && (
                  <p style={{ fontSize: '0.78rem', color: '#27ae60', marginBottom: 6, fontWeight: 500 }}>{autofillMsg}</p>
                )}

                {/* Editable textarea — pre-filled by search or typed manually */}
                <textarea
                  placeholder="Or type your full address here…"
                  value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })}
                  rows={2}
                  style={{ ...inputStyle, resize: 'none' }}
                />
              </div>

              {/* Coupon */}
              <div>
                <label style={labelStyle}>
                  Coupon Code{' '}
                  <span style={{ color: '#555', fontWeight: 400, fontSize: '0.6rem', textTransform: 'none', letterSpacing: 0 }}>optional</span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                  <input type="text" placeholder="e.g. APNA50" value={form.coupon} onChange={e => setForm({ ...form, coupon: e.target.value })} style={{ ...inputStyle, width: '100%' }} />
                  <button type="button" onClick={applyCoupon} style={{ background: 'transparent', border: '1px solid #e67e22', borderRadius: 8, padding: '10px 16px', color: '#e67e22', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', cursor: 'pointer' }}>
                    APPLY
                  </button>
                </div>
                {couponMsg && <p style={{ fontSize: '0.8rem', marginTop: 5, color: couponMsg.startsWith('✅') ? '#27ae60' : '#e74c3c' }}>{couponMsg}</p>}
              </div>

              {/* Total */}
              <div style={{ background: '#0f0a04', border: '1px solid #3a2a10', borderRadius: 10, padding: '11px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#888', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Total Payable</span>
                <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#e67e22' }}>₹{finalPrice.toLocaleString('en-IN')}</span>
              </div>

              {/* Action buttons — original layout */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, paddingTop: 4 }}>
                <button type="button" onClick={() => setModal(null)} style={{ background: 'transparent', border: '1px solid #3a2a10', borderRadius: 8, padding: '11px 0', color: '#888', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.05em' }}>
                  CANCEL
                </button>
                <button type="button" onClick={() => submitSub('offline')} disabled={loading} style={{ background: 'transparent', border: '1px solid #f39c12', borderRadius: 8, padding: '11px 0', color: '#f39c12', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.04em', opacity: loading ? 0.6 : 1 }}>
                  Cash On Delivery
                </button>
                <button type="button" onClick={() => submitSub('online')} disabled={loading} style={{ background: '#e67e22', border: 'none', borderRadius: 8, padding: '11px 0', color: '#fff', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.04em', opacity: loading ? 0.6 : 1 }}>
                  {loading ? '...' : 'PAY ONLINE'}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      <footer><p>&copy; {new Date().getFullYear()} Kajal Ki Rasoi. All Rights Reserved.</p></footer>
    </>
  );
}
