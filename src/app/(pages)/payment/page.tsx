'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { getCart, getAuthToken, getLoggedInUser, CartItem } from '@/lib/utils';
import { type SavedAddress, loadAddresses, saveAddresses, loadPhone, savePhone } from '@/lib/address';

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
      s.async = true;
      s.defer = true;
      s.onerror = () => resolve();
      document.head.appendChild(s);
    } catch { resolve(); }
  });
  return window.__mapsLoadPromise;
}

function onMapsReady(cb: () => void) { loadMapsScript().then(cb); }

export default function PaymentPage() {
  const router = useRouter();
  const [cart, setCart]                           = useState<CartItem[]>([]);
  const [name, setName]                           = useState('');
  const [phone, setPhone]                         = useState('');
  const [guestContact, setGuestContact]           = useState('');
  const [flat, setFlat]                           = useState('');
  const [area, setArea]                           = useState('');
  const [landmark, setLandmark]                   = useState('');
  const [city, setCity]                           = useState('');
  const [pincode, setPincode]                     = useState('');
  const [payMethod, setPayMethod]                 = useState('cod');
  const [couponCode, setCouponCode]               = useState('');
  const [couponMsg, setCouponMsg]                 = useState('');
  const [appliedCoupon, setAppliedCoupon]         = useState<string | null>(null);
  const [deliveryFee, setDeliveryFee]             = useState(0);
  const [deliveryMsg, setDeliveryMsg]             = useState('');
  const [customerLat, setCustomerLat]             = useState('');
  const [customerLng, setCustomerLng]             = useState('');
  const [message, setMessage]                     = useState('');
  const [loading, setLoading]                     = useState(false);
  const [discount, setDiscount]                   = useState(0);
  const [isLoggedIn, setIsLoggedIn]               = useState(false);
  const [autofillMsg, setAutofillMsg]             = useState('');
  const [flatHelperVisible, setFlatHelperVisible] = useState(false);
  const [searchValue, setSearchValue]             = useState('');
  const [suggestions, setSuggestions]             = useState<any[]>([]);
  const [activeSuggIdx, setActiveSuggIdx]         = useState(-1);
  const [mapsReady, setMapsReady]                 = useState(false);
  const [savedAddresses, setSavedAddresses]       = useState<SavedAddress[]>([]);
  const [selectedAddrId, setSelectedAddrId]       = useState<string | null>(null);
  const [saveAddrLabel, setSaveAddrLabel]         = useState('');
  const [showSavePrompt, setShowSavePrompt]       = useState(false);
  const [onlinePaymentEnabled, setOnlinePaymentEnabled] = useState(false);
  const [mounted, setMounted]                     = useState(false);
  // true when user has saved phone + address — show compact summary, hide full form
  const [quickCheckout, setQuickCheckout]         = useState(false);

  const debounceRef   = useRef<NodeJS.Timeout | null>(null);
  const geocoderRef   = useRef<any>(null);
  const sessionTok    = useRef<any>(null);
  const searchContRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const c = getCart();
    if (!c.length) { router.replace('/cart'); return; }
    setCart(c);

    fetch('/api/config/payment-settings')
      .then(r => r.json())
      .then(d => {
        const enabled = !!d.onlinePaymentEnabled;
        setOnlinePaymentEnabled(enabled);
        setPayMethod(enabled ? 'online' : 'cod');
        localStorage.setItem('onlinePaymentEnabled', String(enabled));
      })
      .catch(() => {
        const cached = localStorage.getItem('onlinePaymentEnabled');
        const enabled = cached === 'true';
        setOnlinePaymentEnabled(enabled);
        setPayMethod(enabled ? 'online' : 'cod');
      });

    const u     = getLoggedInUser();
    const token = getAuthToken();
    if (u && token) { setName(u.name); setIsLoggedIn(true); }

    if (u?.contact) {
      try {
        const addrs = loadAddresses(u.contact);
        setSavedAddresses(addrs);
        const def = addrs.find(a => a.isDefault) || addrs[0];
        if (def) {
          setSelectedAddrId(def.id);
          setFlat(def.flat); setArea(def.area); setLandmark(def.landmark);
          setCity(def.city); setPincode(def.pincode);
          if (def.lat) setCustomerLat(def.lat);
          if (def.lng) setCustomerLng(def.lng);
        }

        // Load saved phone
        const savedPh = loadPhone(u.contact);
        if (savedPh) {
          setPhone(savedPh);
          // If both phone and address are saved → quick checkout mode
          if (def && savedPh) setQuickCheckout(true);
        }
      } catch {}
    }

    onMapsReady(() => {
      geocoderRef.current = new window.google.maps.Geocoder();
      sessionTok.current  = new window.google.maps.places.AutocompleteSessionToken();
      setMapsReady(true);
    });
  }, []); // eslint-disable-line

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (searchContRef.current && !searchContRef.current.contains(e.target as Node))
        setSuggestions([]);
    };
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, []);

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
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    try {
      const place = new window.google.maps.places.Place({ id: placeId });
      await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'addressComponents', 'location', 'types'] });
      processPlace(place);
      sessionTok.current = new window.google.maps.places.AutocompleteSessionToken();
    } catch (err) { console.error('Place details error', err); }
  }

  function processPlace(place: any) {
    const get = (...types: string[]) => {
      for (const t of types) {
        const c = place.addressComponents?.find((x: any) => x.types.includes(t));
        if (c) return c.longText ?? c.long_name ?? '';
      }
      return '';
    };
    const locObj  = place.location ?? place.geometry?.location;
    const lat     = String(locObj?.lat() || '');
    const lng     = String(locObj?.lng() || '');
    const flatB   = get('premise', 'subpremise', 'street_number');
    const street  = get('route');
    const sub2    = get('sublocality_level_2');
    const sub1    = get('sublocality_level_1');
    const neighb  = get('neighborhood');
    const cityVal = get('locality', 'administrative_area_level_2');
    const pinVal  = get('postal_code');
    const isPoI   = place.types?.includes('point_of_interest') || place.types?.includes('establishment');
    const displayName = place.displayName ?? place.name ?? '';
    setFlat(flatB || street); setArea(sub2 || sub1 || neighb);
    setLandmark(isPoI ? displayName : ''); setCity(cityVal); setPincode(pinVal);
    setCustomerLat(lat); setCustomerLng(lng);
    setAutofillMsg('✅ Address fields auto-filled.');
    setTimeout(() => setAutofillMsg(''), 3000);
    setFlatHelperVisible(true);
    if (pinVal && lat && lng) triggerEstimate(lat, lng, `${flatB||street}, ${sub1}, ${cityVal}`);
    setTimeout(() => document.getElementById('coupon-section-heading')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
  }

  function handleKeyboardNav(e: React.KeyboardEvent) {
    if (!suggestions.length) return;
    if (e.key === 'ArrowDown')  { e.preventDefault(); setActiveSuggIdx(i => (i + 1) % suggestions.length); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveSuggIdx(i => i <= 0 ? suggestions.length - 1 : i - 1); }
    else if (e.key === 'Enter')     { e.preventDefault(); if (activeSuggIdx >= 0) selectSuggestion(suggestions[activeSuggIdx].placePrediction?.placeId); }
    else if (e.key === 'Escape')    { setSuggestions([]); }
  }

  function geolocateAndFill() {
    if (!navigator.geolocation) { alert('Geolocation not supported.'); return; }
    navigator.geolocation.getCurrentPosition(pos => {
      if (!geocoderRef.current) {
        setCustomerLat(String(pos.coords.latitude)); setCustomerLng(String(pos.coords.longitude));
        alert('📍 Location captured!'); return;
      }
      geocoderRef.current.geocode(
        { location: { lat: pos.coords.latitude, lng: pos.coords.longitude } },
        (results: any[], status: string) => {
          if (status === 'OK' && results[0]) {
            processPlace(results[0]);
            setSearchValue(results[0].formatted_address.split(',').slice(0, 2).join(','));
          } else {
            setCustomerLat(String(pos.coords.latitude)); setCustomerLng(String(pos.coords.longitude));
            alert('📍 Location set. Please fill address fields manually.');
          }
        }
      );
    }, () => alert('Location denied. Please enable location services.'));
  }

  async function triggerEstimate(_lat?: string, _lng?: string, _addr?: string) {
    // Delivery charge temporarily disabled — always free
    setDeliveryFee(0);
    setDeliveryMsg('🚴 Free delivery — enjoy!');
  }

  function applyCoupon() {
    if (couponCode.toUpperCase() === 'APNA50' && subtotal >= 200) {
      setDiscount(50); setAppliedCoupon('APNA50'); setCouponMsg('✅ Coupon APNA50 applied! ₹50 off.');
    } else { setCouponMsg('❌ Invalid coupon or minimum ₹200 required.'); }
  }

  const subtotal   = cart.reduce((s, i) => s + i.price * (i.quantity || 1), 0);
  const finalTotal = subtotal - discount + deliveryFee;

  function saveCurrentAddress(label: string) {
    const u = getLoggedInUser();
    if (!u?.contact || !flat || !area || !city || !pincode) return;
    const existing = loadAddresses(u.contact);
    const isDupe = existing.some(a => a.flat === flat && a.area === area && a.city === city && a.pincode === pincode);
    if (isDupe) return;
    const newAddr: SavedAddress = {
      id: Date.now().toString(), label: label || 'Home',
      flat, area, landmark, city, pincode,
      lat: customerLat || undefined, lng: customerLng || undefined,
      isDefault: existing.length === 0,
    };
    const updated = [...existing, newAddr];
    saveAddresses(u.contact, updated);
    setSavedAddresses(updated); setSelectedAddrId(newAddr.id);
    setShowSavePrompt(false); setSaveAddrLabel('');
    setAutofillMsg('✅ Address saved for future orders!');
    setTimeout(() => setAutofillMsg(''), 3000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) { setMessage('Phone number is required for delivery.'); return; }
    if (!flat || !area || !city || !pincode) { setMessage('Please complete all required address fields.'); return; }

    const address = `${flat}, ${area}${landmark ? `, Landmark: ${landmark}` : ''}, ${city} - ${pincode}`;
    const token   = getAuthToken();
    const u       = getLoggedInUser();
    const contact = u?.contact || guestContact;

    // Save phone for future orders
    if (u?.contact) {
      savePhone(u.contact, phone.trim());
    }

    if (u?.contact && selectedAddrId) {
      const updated = savedAddresses.map(a => a.id === selectedAddrId ? { ...a, flat, area, landmark, city, pincode } : a);
      saveAddresses(u.contact, updated);
    }

    setLoading(true);
    const payload = { items: cart, customerName: name, contact, phone: phone.trim(), address, couponCode: appliedCoupon, deliveryFee, customerLat, customerLng };

    if (payMethod === 'cod') {
      const res  = await fetch('/api/checkout-cod', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.success) {
        if (isLoggedIn && !selectedAddrId && flat && area && city && pincode) {
          const u2 = getLoggedInUser();
          if (u2?.contact) {
            const existing = loadAddresses(u2.contact);
            if (!existing.some(a => a.flat === flat && a.area === area && a.city === city)) {
              saveAddresses(u2.contact, [...existing, { id: Date.now().toString(), label: 'Home', flat, area, landmark, city, pincode, lat: customerLat || undefined, lng: customerLng || undefined, isDefault: existing.length === 0 }]);
            }
          }
        }
        localStorage.removeItem('cart'); window.dispatchEvent(new Event('cartUpdated')); router.push('/my-orders');
      } else { setMessage(data.error || 'Checkout failed.'); setLoading(false); }
      return;
    }

    const base = window.location.origin;
    const res  = await fetch('/api/create-stripe-checkout', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify({ ...payload, successUrl: `${base}/my-orders?session_id={CHECKOUT_SESSION_ID}`, cancelUrl: `${base}/payment` }) });
    const data = await res.json();
    if (data.url) {
      if (isLoggedIn && !selectedAddrId && flat && area && city && pincode) {
        const u2 = getLoggedInUser();
        if (u2?.contact) {
          const existing = loadAddresses(u2.contact);
          if (!existing.some(a => a.flat === flat && a.area === area && a.city === city)) {
            saveAddresses(u2.contact, [...existing, { id: Date.now().toString(), label: 'Home', flat, area, landmark, city, pincode, lat: customerLat || undefined, lng: customerLng || undefined, isDefault: existing.length === 0 }]);
          }
        }
      }
      window.location.href = data.url;
    } else { setMessage(data.error || 'Checkout failed.'); setLoading(false); }
  }

  const inp: React.CSSProperties = { padding: 15, fontSize: '1rem', borderRadius: 8, border: '1px solid #ccc', width: '100%', boxSizing: 'border-box' };

  return (
    <>
      <Navbar scrolled />
      <section className="payment-page">
        <div className="payment-container">
          <h2>Checkout Details</h2>

          {/* Order summary */}
          <div style={{ marginBottom: '1.5rem', padding: '1.5rem', background: '#f8f9fa', borderRadius: 8, textAlign: 'center', color: '#2c3e50', lineHeight: 1.6 }}>
            <strong>{cart.reduce((s, i) => s + (i.quantity || 1), 0)} Item(s)</strong> | Subtotal: ₹{subtotal}<br />
            {discount > 0 && <span style={{ color: '#27ae60' }}>Discount: -₹{discount}<br /></span>}
            <span style={{ color: '#27ae60' }}>Delivery: FREE 🚴<br /></span>
            <span style={{ color: '#e67e22', fontSize: '1.5rem', fontWeight: 'bold' }}>Total: ₹{finalTotal}</span>
          </div>

          <form className="payment-form" onSubmit={handleSubmit}>

            {/* ── QUICK CHECKOUT MODE — phone + address already saved ── */}
            {quickCheckout && isLoggedIn ? (
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: '1.25rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <span style={{ fontWeight: 700, color: '#15803d', fontSize: '0.9rem' }}>✅ Delivering to saved details</span>
                  <button type="button" onClick={() => setQuickCheckout(false)}
                    style={{ fontSize: '0.78rem', color: '#e67e22', background: 'none', border: '1px solid #e67e22', borderRadius: 20, padding: '2px 10px', cursor: 'pointer' }}>
                    Edit
                  </button>
                </div>
                <div style={{ fontSize: '0.9rem', color: '#374151', lineHeight: 1.7 }}>
                  <div>👤 <strong>{name}</strong></div>
                  <div>📞 {phone}</div>
                  <div>📍 {flat}{area ? `, ${area}` : ''}{city ? `, ${city}` : ''}{pincode ? ` - ${pincode}` : ''}</div>
                </div>
              </div>
            ) : (
              <>
                {/* Full form */}
                <input type="text" placeholder="Full Name" required value={name} onChange={e => setName(e.target.value)} style={inp} />

                {/* Phone number — required */}
                <input
                  type="tel"
                  placeholder="Phone Number for Delivery *"
                  required
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  pattern="[0-9+\s\-]{7,15}"
                  title="Enter a valid phone number"
                  style={inp}
                />

                {!isLoggedIn && (
                  <div>
                    <h3 style={{ fontSize: '1.1rem', color: '#2c3e50', margin: '1rem 0 0.5rem' }}>Contact Info (Required for Guest)</h3>
                    <input type="text" placeholder="Email or Phone Number" required value={guestContact} onChange={e => setGuestContact(e.target.value)} style={inp} />
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem', color: '#2c3e50', margin: 0 }}>Delivery Address</h3>
                  <button type="button" onClick={geolocateAndFill} style={{ background: '#e67e22', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 20, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>
                    📍 Use My Location
                  </button>
                </div>

                {isLoggedIn && (
                  <div style={{ marginTop: '0.75rem' }}>
                    {savedAddresses.length > 0 && (
                      <>
                        <p style={{ fontSize: '0.82rem', color: '#888', marginBottom: '0.5rem' }}>📋 Saved addresses — tap to select:</p>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                          {savedAddresses.map(addr => (
                            <button key={addr.id} type="button"
                              onClick={() => {
                                setSelectedAddrId(addr.id);
                                setFlat(addr.flat); setArea(addr.area); setLandmark(addr.landmark);
                                setCity(addr.city); setPincode(addr.pincode);
                                setCustomerLat(addr.lat || ''); setCustomerLng(addr.lng || '');
                                setShowSavePrompt(false);
                                setAutofillMsg(addr.lat ? '✅ Address loaded.' : '✅ Address loaded. Tap 📍 to confirm delivery location.');
                                setTimeout(() => setAutofillMsg(''), 4000);
                              }}
                              style={{ padding: '8px 16px', borderRadius: 20, border: `2px solid ${selectedAddrId === addr.id ? '#e67e22' : '#e5e7eb'}`, background: selectedAddrId === addr.id ? '#fff7ed' : '#fff', color: selectedAddrId === addr.id ? '#e67e22' : '#555', fontSize: '0.85rem', fontWeight: selectedAddrId === addr.id ? 700 : 400, cursor: 'pointer', transition: 'all 0.2s' }}>
                              {addr.label === 'Home' ? '🏠' : addr.label === 'Work' ? '💼' : '📌'} {addr.label}
                              {addr.isDefault && <span style={{ fontSize: '0.7rem', marginLeft: 4, color: '#22c55e' }}>✓ Default</span>}
                            </button>
                          ))}
                          <button type="button"
                            onClick={() => { setSelectedAddrId(null); setFlat(''); setArea(''); setLandmark(''); setCity(''); setPincode(''); setCustomerLat(''); setCustomerLng(''); setSearchValue(''); setShowSavePrompt(false); }}
                            style={{ padding: '8px 16px', borderRadius: 20, border: '2px dashed #e5e7eb', background: '#fafafa', color: '#888', fontSize: '0.85rem', cursor: 'pointer' }}>
                            + New Address
                          </button>
                        </div>
                      </>
                    )}
                    {!selectedAddrId && flat && area && city && pincode && (
                      <div style={{ marginTop: '0.5rem' }}>
                        {!showSavePrompt ? (
                          <button type="button" onClick={() => setShowSavePrompt(true)}
                            style={{ fontSize: '0.82rem', color: '#e67e22', background: 'none', border: '1px solid #e67e22', borderRadius: 20, padding: '4px 12px', cursor: 'pointer' }}>
                            💾 Save this address for future orders
                          </button>
                        ) : (
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.82rem', color: '#555' }}>Label:</span>
                            {['Home', 'Work', 'Other'].map(lbl => (
                              <button key={lbl} type="button" onClick={() => saveCurrentAddress(lbl)}
                                style={{ padding: '4px 14px', borderRadius: 20, border: `1.5px solid ${saveAddrLabel === lbl ? '#e67e22' : '#ddd'}`, background: saveAddrLabel === lbl ? '#fff7ed' : '#fff', color: saveAddrLabel === lbl ? '#e67e22' : '#555', fontSize: '0.82rem', cursor: 'pointer' }}>
                                {lbl === 'Home' ? '🏠' : lbl === 'Work' ? '💼' : '📌'} {lbl}
                              </button>
                            ))}
                            <button type="button" onClick={() => setShowSavePrompt(false)}
                              style={{ fontSize: '0.82rem', color: '#999', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div ref={searchContRef} id="address-search-container" style={{ position: 'relative', marginTop: '1rem' }}>
                  <div style={{ position: 'relative' }}>
                    <input type="text" id="address-search"
                      placeholder={mapsReady ? 'Search your area, street or landmark…' : 'Loading maps…'}
                      autoComplete="off" value={searchValue}
                      onChange={e => handleSearchInput(e.target.value)}
                      onKeyDown={handleKeyboardNav} disabled={!mapsReady}
                      style={{ ...inp, paddingRight: 80, opacity: mapsReady ? 1 : 0.6 }} />
                    {searchValue && (
                      <button type="button" onClick={() => { setSearchValue(''); setSuggestions([]); }}
                        style={{ position: 'absolute', top: '50%', right: 45, transform: 'translateY(-50%)', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#999', padding: 0 }}>
                        &times;
                      </button>
                    )}
                    <button type="button" title="Use current location" onClick={geolocateAndFill}
                      style={{ position: 'absolute', top: '50%', right: 12, transform: 'translateY(-50%)', background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#e67e22', padding: 0 }}>
                      📍
                    </button>
                  </div>
                  {suggestions.length > 0 && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0 0 10px 10px', boxShadow: '0 6px 20px rgba(0,0,0,0.12)', zIndex: 100, maxHeight: 300, overflowY: 'auto' }}>
                      {suggestions.map((sugg, idx) => {
                        const pred     = sugg.placePrediction;
                        const placeId  = pred?.placeId;
                        const mainText = pred?.mainText?.toString() ?? '';
                        const secText  = pred?.secondaryText?.toString() ?? '';
                        return (
                          <div key={placeId || idx} onClick={() => selectSuggestion(placeId)}
                            style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', background: idx === activeSuggIdx ? '#fff7ed' : '#fff', transition: 'background 0.1s' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#fff7ed')}
                            onMouseLeave={e => (e.currentTarget.style.background = idx === activeSuggIdx ? '#fff7ed' : '#fff')}>
                            <div style={{ fontWeight: 500, fontSize: '0.95rem', color: '#1f2937' }}>📍 {mainText}</div>
                            <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: 2 }}>{secText}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {autofillMsg && <div style={{ fontSize: '0.85rem', marginTop: 6, color: '#2ecc71', fontWeight: 500 }}>{autofillMsg}</div>}
                  {!mapsReady && <div style={{ fontSize: '0.8rem', marginTop: 4, color: '#f97316' }}>⏳ Loading Google Maps… You can still type the address below.</div>}
                </div>

                <input type="text" placeholder="Flat, House no., Building, Apartment" value={flat} onChange={e => { setFlat(e.target.value); setFlatHelperVisible(false); }} onBlur={() => triggerEstimate()} style={inp} />
                {flatHelperVisible && <div style={{ fontSize: 12, color: '#888', marginTop: -6, marginBottom: 4 }}>Enter your flat or house number to complete the address</div>}
                <input type="text" placeholder="Area, Street, Sector, Village *" required value={area} onChange={e => setArea(e.target.value)} onBlur={() => triggerEstimate()} style={inp} />
                <input type="text" placeholder="Nearby Landmark (Optional)" value={landmark} onChange={e => setLandmark(e.target.value)} style={inp} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                  <input type="text" placeholder="Town/City *" required value={city} onChange={e => setCity(e.target.value)} onBlur={() => triggerEstimate()} style={inp} />
                  <input type="text" placeholder="Pincode *" required value={pincode} onChange={e => setPincode(e.target.value)} onBlur={() => triggerEstimate()} style={inp} />
                </div>
                {deliveryMsg && <div style={{ fontSize: '0.9rem', color: '#27ae60', fontWeight: 'bold', textAlign: 'center' }}>{deliveryMsg}</div>}
              </>
            )}

            <h3 id="coupon-section-heading" style={{ fontSize: '1.1rem', color: '#2c3e50', marginTop: '1rem' }}>Have a Coupon?</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
              <input type="text" placeholder="e.g. APNA50" value={couponCode} onChange={e => setCouponCode(e.target.value)} style={{ padding: 10, width: '100%', border: '1px solid #ccc', borderRadius: 5 }} />
              <button type="button" className="btn" style={{ padding: 10 }} onClick={applyCoupon}>Apply</button>
            </div>
            {couponMsg && <p style={{ fontSize: '0.85rem', marginTop: 5, color: couponMsg.startsWith('✅') ? '#2ecc71' : '#e74c3c' }}>{couponMsg}</p>}

            <h3 style={{ fontSize: '1.1rem', color: '#2c3e50', marginTop: '1rem' }}>Payment Method</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              {!mounted ? null : onlinePaymentEnabled ? (
                <label style={{ cursor: 'pointer' }}>
                  <input type="radio" name="pay_method" value="online" checked={payMethod === 'online'} onChange={() => setPayMethod('online')} />
                  {' '}Pay Online (Cards via Stripe)
                </label>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#f3f4f6', borderRadius: 8, border: '1px dashed #d1d5db', color: '#9ca3af' }}>
                  <span style={{ fontSize: '1.1rem' }}>💳</span>
                  <div>
                    <span style={{ fontWeight: 600, textDecoration: 'line-through' }}>Pay Online</span>
                    <span style={{ fontSize: '0.78rem', marginLeft: 8, background: '#e5e7eb', color: '#6b7280', borderRadius: 4, padding: '2px 6px' }}>Coming Soon</span>
                    <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>We are new! Online payments will be enabled soon 🙏</p>
                  </div>
                </div>
              )}
              <label style={{ cursor: 'pointer' }}>
                <input type="radio" name="pay_method" value="cod" checked={payMethod === 'cod'} onChange={() => setPayMethod('cod')} />
                {' '}Cash on Delivery (COD) ✅
              </label>
            </div>

            <button className="btn" style={{ width: '100%', marginTop: '1rem', padding: 15, fontSize: '1.1rem', borderRadius: 8 }} disabled={loading}>
              {loading ? 'Processing…' : payMethod === 'cod' ? `Confirm Order (₹${finalTotal} COD)` : `Pay ₹${finalTotal} Securely`}
            </button>
            {message && <p style={{ color: 'red', textAlign: 'center', marginTop: '1rem' }}>{message}</p>}
          </form>
        </div>
      </section>
      <footer><p>&copy; {new Date().getFullYear()} Kajal Ki Rasoi. All Rights Reserved.</p></footer>
    </>
  );
}
