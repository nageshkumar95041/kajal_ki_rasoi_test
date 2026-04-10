'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/hooks/useAuth';

import { type SavedAddress, loadAddresses, saveAddresses } from '@/lib/address';

const LABELS = ['Home', 'Work', 'Other'];

const blank = (): Omit<SavedAddress, 'id' | 'isDefault'> => ({ label: 'Home', flat: '', area: '', landmark: '', city: '', pincode: '' });

export default function ProfilePage() {
  const { user, token, loading, logout } = useAuth(true);
  const [profile, setProfile]           = useState<{ name: string; contact: string } | null>(null);
  const [lastOrderName, setLastOrderName] = useState('Loading...');

  const [editOpen, setEditOpen]   = useState(false);
  const [editName, setEditName]   = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editMsg, setEditMsg]     = useState('');

  const [addresses, setAddresses]     = useState<SavedAddress[]>([]);
  const [addrOpen, setAddrOpen]       = useState(false);
  const [addrForm, setAddrForm]       = useState(blank());
  const [addrEditId, setAddrEditId]   = useState<string | null>(null);
  const [addrMsg, setAddrMsg]         = useState('');

  useEffect(() => {
    if (!token) return;
    fetch('/api/profile', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => {
        if (d.success) {
          setProfile(d.user);
          setAddresses(loadAddresses(d.user.contact));
          const legacy = localStorage.getItem(`savedDeliveryAddress_${d.user.contact}`);
          if (legacy) {
            try {
              const old = JSON.parse(legacy);
              const existing = loadAddresses(d.user.contact);
              if (existing.length === 0 && old.flat) {
                const migrated: SavedAddress = { id: Date.now().toString(), label: 'Home', flat: old.flat || '', area: old.area || '', landmark: old.landmark || '', city: old.city || '', pincode: old.pincode || '', isDefault: true };
                saveAddresses(d.user.contact, [migrated]);
                setAddresses([migrated]);
                localStorage.removeItem(`savedDeliveryAddress_${d.user.contact}`);
              }
            } catch {}
          }
        }
      });
    fetch('/api/my-orders?limit=1', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(orders => {
        if (Array.isArray(orders) && orders.length > 0 && orders[0].items?.length > 0)
          setLastOrderName(orders[0].items.map((i: { name: string }) => i.name).join(', '));
        else setLastOrderName('No past orders');
      });
  }, [token]);

  function openEdit() { setEditName(profile?.name || ''); setEditMsg(''); setEditOpen(true); }
  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editName.trim()) return;
    setEditSaving(true);
    const res  = await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: editName.trim() }) });
    const data = await res.json();
    if (data.success) {
      setProfile(data.user);
      localStorage.setItem('loggedInUser', JSON.stringify(data.user));
      setEditOpen(false);
    } else { setEditMsg(data.message || 'Failed to update.'); }
    setEditSaving(false);
  }

  function openAddNew() { setAddrEditId(null); setAddrForm(blank()); setAddrMsg(''); setAddrOpen(true); }
  function openEdit2(addr: SavedAddress) {
    setAddrEditId(addr.id);
    setAddrForm({ label: addr.label, flat: addr.flat, area: addr.area, landmark: addr.landmark, city: addr.city, pincode: addr.pincode });
    setAddrMsg('');
    setAddrOpen(true);
  }
  function saveAddr(e: React.FormEvent) {
    e.preventDefault();
    if (!addrForm.flat || !addrForm.area || !addrForm.city || !addrForm.pincode) { setAddrMsg('Please fill all required fields.'); return; }
    const contact = profile!.contact;
    let list      = [...addresses];
    if (addrEditId) {
      list = list.map(a => a.id === addrEditId ? { ...a, ...addrForm } : a);
    } else {
      const isFirst = list.length === 0;
      list.push({ id: Date.now().toString(), ...addrForm, isDefault: isFirst });
    }
    saveAddresses(contact, list);
    setAddresses(list);
    setAddrOpen(false);
  }
  function deleteAddr(id: string) {
    if (!confirm('Delete this address?')) return;
    const contact = profile!.contact;
    let list = addresses.filter(a => a.id !== id);
    if (list.length > 0 && !list.some(a => a.isDefault)) list[0].isDefault = true;
    saveAddresses(contact, list);
    setAddresses(list);
  }
  function setDefault(id: string) {
    const contact = profile!.contact;
    const list = addresses.map(a => ({ ...a, isDefault: a.id === id }));
    saveAddresses(contact, list);
    setAddresses(list);
  }

  if (loading) return <div style={{ padding: '6rem 1rem', textAlign: 'center' }}>Loading...</div>;

  return (
    <>
      <Navbar scrolled />
      <section className="profile-page">
        <div className="profile-header-card">
          <div className="profile-info-row">
            <div className="profile-avatar" id="profile-initials">{profile?.name?.charAt(0).toUpperCase() || '?'}</div>
            <div className="profile-details">
              <h2>{profile?.name || user?.name || 'Loading...'}</h2>
              <p>{profile?.contact || user?.contact}</p>
              <p className="profile-loyalty-text">⭐ VIP Member</p>
            </div>
            <button className="btn-edit-profile" onClick={openEdit}>Edit</button>
          </div>
        </div>

        <div className="quick-actions-container">
          <Link href="/my-orders" className="quick-action-btn primary" style={{ textDecoration: 'none' }}>
            <span className="icon">🔁</span>
            <div className="text-left">
              <p className="qa-title">My Orders</p>
              <p className="qa-subtitle">{lastOrderName}</p>
            </div>
          </Link>
          <div className="quick-action-btn secondary">
            <span className="icon" style={{ color: '#9b59b6' }}>🪙</span>
            <div className="text-left"><p className="qa-title">Loyalty Coins</p><p className="qa-subtitle" style={{ color: '#333' }}>450 Coins</p></div>
          </div>
        </div>

        <div className="profile-menu-list">
          <Link href="/my-orders" className="profile-menu-item">
            <div className="menu-item-left"><span className="menu-icon">📦</span><div><h4>My Orders</h4><p>View past &amp; active orders</p></div></div><span className="chevron">›</span>
          </Link>

          <div className="profile-menu-item" style={{ flexDirection: 'column', alignItems: 'stretch', cursor: 'default' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <div className="menu-item-left">
                <span className="menu-icon">📍</span>
                <div><h4>Manage Addresses</h4><p>{addresses.length === 0 ? 'No saved addresses' : `${addresses.length} saved address${addresses.length > 1 ? 'es' : ''}`}</p></div>
              </div>
              <button onClick={openAddNew} style={{ background: '#e67e22', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                + Add New
              </button>
            </div>

            {addresses.length > 0 && (
              <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {addresses.map(addr => (
                  <div key={addr.id} style={{ background: addr.isDefault ? '#fff7ed' : '#f9f9f9', border: `1.5px solid ${addr.isDefault ? '#e67e22' : '#e5e5e5'}`, borderRadius: 10, padding: '0.9rem 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                          <span style={{ background: addr.isDefault ? '#e67e22' : '#e0e0e0', color: addr.isDefault ? '#fff' : '#555', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
                            {addr.label}
                          </span>
                          {addr.isDefault && <span style={{ fontSize: '0.72rem', color: '#e67e22', fontWeight: 600 }}>✓ Default</span>}
                        </div>
                        <p style={{ margin: 0, fontSize: '0.88rem', color: '#333', lineHeight: 1.5 }}>
                          {addr.flat}{addr.area ? `, ${addr.area}` : ''}{addr.landmark ? `, ${addr.landmark}` : ''}<br />
                          {addr.city} — {addr.pincode}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                        {!addr.isDefault && (
                          <button onClick={() => setDefault(addr.id)} style={{ background: 'none', border: '1px solid #e67e22', color: '#e67e22', borderRadius: 6, padding: '4px 8px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}>
                            Set Default
                          </button>
                        )}
                        <button onClick={() => openEdit2(addr)} style={{ background: 'none', border: '1px solid #ccc', color: '#555', borderRadius: 6, padding: '4px 8px', fontSize: '0.75rem', cursor: 'pointer' }}>Edit</button>
                        <button onClick={() => deleteAddr(addr.id)} style={{ background: 'none', border: '1px solid #e74c3c', color: '#e74c3c', borderRadius: 6, padding: '4px 8px', fontSize: '0.75rem', cursor: 'pointer' }}>Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <a href="#" className="profile-menu-item" onClick={e => e.preventDefault()}>
            <div className="menu-item-left"><span className="menu-icon">🎟️</span><div><h4>Offers &amp; Coupons</h4><p>Use code APNA50 for ₹50 off</p></div></div><span className="chevron">›</span>
          </a>

          <h3 className="profile-section-title">Settings &amp; Support</h3>
          <a href="#" className="profile-menu-item" onClick={e => e.preventDefault()}>
            <div className="menu-item-left"><span className="menu-icon">🎧</span><div><h4>Help &amp; Support</h4><p>FAQs &amp; Order Issues</p></div></div><span className="chevron">›</span>
          </a>
        </div>

        <div className="profile-logout-container">
          <button className="btn-logout" onClick={logout}>🔴 Secure Logout</button>
        </div>
      </section>

      {editOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '2rem', width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ marginBottom: '1.2rem', fontWeight: 700 }}>Edit Name</h3>
            <form onSubmit={saveEdit}>
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)} required placeholder="Your name" style={{ width: '100%', padding: '12px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: '1rem', boxSizing: 'border-box', marginBottom: '0.8rem' }} />
              {editMsg && <p style={{ color: '#e74c3c', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{editMsg}</p>}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" onClick={() => setEditOpen(false)} style={{ flex: 1, padding: 11, borderRadius: 8, border: '1px solid #ddd', background: '#f5f5f5', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                <button type="submit" disabled={editSaving} style={{ flex: 1, padding: 11, borderRadius: 8, border: 'none', background: '#e67e22', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>{editSaving ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {addrOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '2rem', width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: '1.2rem', fontWeight: 700 }}>{addrEditId ? 'Edit Address' : 'Add New Address'}</h3>
            <form onSubmit={saveAddr} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#444', display: 'block', marginBottom: '0.4rem' }}>Address Label</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {LABELS.map(l => (
                    <button key={l} type="button" onClick={() => setAddrForm(f => ({ ...f, label: l }))}
                      style={{ padding: '6px 16px', borderRadius: 20, border: `1.5px solid ${addrForm.label === l ? '#e67e22' : '#ddd'}`, background: addrForm.label === l ? '#fff7ed' : '#fff', color: addrForm.label === l ? '#e67e22' : '#555', fontWeight: addrForm.label === l ? 700 : 400, cursor: 'pointer', fontSize: '0.88rem' }}>
                      {l === 'Home' ? '🏠' : l === 'Work' ? '💼' : '📌'} {l}
                    </button>
                  ))}
                  <input type="text" placeholder="Custom label" value={LABELS.includes(addrForm.label) ? '' : addrForm.label} onChange={e => setAddrForm(f => ({ ...f, label: e.target.value || 'Other' }))}
                    style={{ padding: '6px 12px', borderRadius: 20, border: '1.5px solid #ddd', fontSize: '0.88rem', width: 110 }} />
                </div>
              </div>

              {[
                { label: 'Flat / House No. / Building *', key: 'flat', placeholder: 'e.g. Plot B-223, Block A' },
                { label: 'Area / Street / Sector *', key: 'area', placeholder: 'e.g. Wazidpur, Sector 135' },
                { label: 'Landmark (Optional)', key: 'landmark', placeholder: 'e.g. Near Metro Station' },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#444', display: 'block', marginBottom: '0.3rem' }}>{label}</label>
                  <input type="text" placeholder={placeholder} value={(addrForm as any)[key]} onChange={e => setAddrForm(f => ({ ...f, [key]: e.target.value }))}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.95rem', boxSizing: 'border-box' }} />
                </div>
              ))}

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {[{ label: 'City *', key: 'city', placeholder: 'e.g. Noida' }, { label: 'Pincode *', key: 'pincode', placeholder: 'e.g. 201304' }].map(({ label, key, placeholder }) => (
                  <div key={key} style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#444', display: 'block', marginBottom: '0.3rem' }}>{label}</label>
                    <input type="text" placeholder={placeholder} value={(addrForm as any)[key]} onChange={e => setAddrForm(f => ({ ...f, [key]: e.target.value }))}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.95rem', boxSizing: 'border-box' }} />
                  </div>
                ))}
              </div>

              {addrMsg && <p style={{ color: '#e74c3c', fontSize: '0.85rem' }}>{addrMsg}</p>}

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setAddrOpen(false)} style={{ flex: 1, padding: 12, borderRadius: 8, border: '1px solid #ddd', background: '#f5f5f5', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                <button type="submit" style={{ flex: 1, padding: 12, borderRadius: 8, border: 'none', background: '#e67e22', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>{addrEditId ? 'Save Changes' : 'Add Address'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}