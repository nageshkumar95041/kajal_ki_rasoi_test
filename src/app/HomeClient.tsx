'use client';
import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import ToastInit from '@/components/Toast';
import StickyCart from '@/components/StickyCart';
import { getCart, saveCart, getAuthToken, isTokenExpired, CartItem } from '@/lib/utils';
import Link from 'next/link';

interface TiffinItem { _id: string; name: string; price: number; meta: string; emoji: string; available?: boolean; }

export default function HomeClient() {
  const [tiffinItems, setTiffinItems] = useState<TiffinItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>(getCart());

  useEffect(() => {
    fetch('/api/tiffin-menu').then(r => r.json()).then(setTiffinItems).catch(console.error);
  }, []);

  function checkAuth(): boolean {
    const token = getAuthToken();
    if (!token || isTokenExpired(token)) {
      window.showSystemToast?.('Info', 'Please login to add items to cart.');
      setTimeout(() => { window.location.href = '/login'; }, 1500);
      return false;
    }
    return true;
  }

  function addToCart(name: string, price: number) {
    if (!checkAuth()) return;
    const updated = [...cart];
    const existing = updated.find(i => i.name === name);
    if (existing) existing.quantity++;
    else updated.push({ name, price, quantity: 1 });
    saveCart(updated); setCart(updated);
    window.dispatchEvent(new Event('cartUpdated'));
    window.showToast?.(name, price);
  }

  const cartTotal = cart.reduce((s, i) => s + i.price * (i.quantity || 1), 0);
  const cartCount = cart.reduce((s, i) => s + (i.quantity || 1), 0);

  return (
    <>
      <ToastInit />
      <Navbar />

      {/* ── HERO ──────────────────────────────────────────────── */}
      <header id="home" className="hero">
        <div className="hero-content">
          <div className="hero-tags">
            <span className="hero-tag">HOMEMADE</span>
            <span className="hero-tag">FRESH</span>
            <span className="hero-tag">NOIDA NCR</span>
          </div>
          <h1>
            <span className="italic-line">Ghar Jaisa Khana,</span>{' '}
            <span className="bold-line">Delivered to You.</span>
          </h1>
          <p>Missing home? Enjoy 100% homemade, fresh, and healthy meals prepared with love. No artificial flavors, just pure goodness.</p>
          <div className="hero-delivery-badge">⚡ Delivered within 30 minutes of order</div>
          <div className="hero-cta">
            <Link href="/menu" className="btn">Order Now</Link>
            <Link href="/menu" className="btn btn-secondary">View Menu</Link>
            <Link href="/subscription" className="btn btn-tiffin">Tiffin Plan</Link>
          </div>
          <div className="hero-stats">
            {[['500+','Happy Customers'],['4.9★','Avg. Rating'],['3 yr','Serving NCR'],['0','ARTIFICIAL']].map(([n,l]) => (
              <div key={l} className="stat-item">
                <div className="stat-num">{n}</div>
                <div className="stat-label">{l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="hero-right">
          <div className="hero-offer-strip">
            <strong>🎁 NEW CUSTOMER OFFER:</strong> First tiffin FREE — try before you subscribe!
          </div>
          <div className="hero-tiffin-card">
            <div className="hero-tiffin-header">
              <span>TODAY&apos;S TIFFIN MENU</span>
              <span className="tiffin-status">● OPEN</span>
            </div>
            {tiffinItems.filter(t => t.available !== false).map(item => (
              <div key={item._id} className="hero-tiffin-item">
                <div className="tiffin-item-info">
                  <span className="tiffin-emoji">{item.emoji}</span>
                  <div>
                    <div className="tiffin-item-name">{item.name}</div>
                    <div className="tiffin-item-meta">{item.meta}</div>
                  </div>
                </div>
                <div className="tiffin-item-action">
                  <span className="tiffin-price">₹{item.price}</span>
                  <button className="tiffin-add-btn" onClick={() => addToCart(item.name, item.price)}>+</button>
                </div>
              </div>
            ))}
          </div>
          <div className="hero-delivery-zones">
            <span className="zones-label">DELIVERING TO</span>
            {['Noida Sector 130','Noida Sector 135','Wazidpur'].map(z => <span key={z} className="zone-pill">{z}</span>)}
          </div>
          <div className="hero-reviews">
            {[
              { quote: '"Best dal outside maa ki rasoi!"',        author: '— Priya S., Sector 130' },
              { quote: '"Finally ghar jaisa khana in Noida!"',    author: '— Rahul M., Wazidpur' },
            ].map(r => (
              <div key={r.author} className="hero-review-card">
                <div className="review-stars">★★★★★</div>
                <p className="review-quote">{r.quote}</p>
                <div className="review-author">{r.author}</div>
              </div>
            ))}
          </div>
          <a href="https://wa.me/917366952957" className="hero-wa-strip" target="_blank" rel="noreferrer">
            📱 Order on WhatsApp → 
          </a>
        </div>
      </header>

      {/* ── QUICK LINKS STRIP ─────────────────────────────────── */}
      <section style={{ background:'#fffaf5', padding:'2.5rem 0.2rem', textAlign:'center' }}>
        <h2 style={{ fontSize:'1.6rem', color:'#2c3e50', marginBottom:'1.5rem' }}>
          Explore Kajal Ki Rasoi
        </h2>
        <div style={{ display:'flex', justifyContent:'center', gap:'1rem', flexWrap:'wrap' }}>
          {[
            { href:'/menu',         emoji:'🍽️',  label:'Full Menu',    sub:'Browse all dishes' },
            { href:'/subscription', emoji:'🍱',  label:'Tiffin Plans', sub:'Daily subscription' },
            { href:'/about',        emoji:'❤️',  label:'Our Story',    sub:'Who we are' },
            { href:'/contact',      emoji:'📞',  label:'Contact Us',   sub:'Get in touch' },
          ].map(item => (
            <Link key={item.href} href={item.href} style={{ textDecoration:'none', background:'#fff', border:'1px solid #eee', borderRadius:12, padding:'1.25rem 1.5rem', minWidth:160, boxShadow:'0 2px 8px rgba(0,0,0,0.04)', display:'block' }}>
              <div style={{ fontSize:'2rem', marginBottom:'0.4rem' }}>{item.emoji}</div>
              <div style={{ fontWeight:700, color:'#2c3e50', fontSize:'1rem' }}>{item.label}</div>
              <div style={{ color:'#999', fontSize:'0.82rem', marginTop:'0.2rem' }}>{item.sub}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Sticky Cart */}
      <StickyCart cartCount={cartCount} cartTotal={cartTotal} />

      <footer>
        <p>&copy; {new Date().getFullYear()} Kajal Ki Rasoi. All Rights Reserved.</p>
        <p>Noida Sector 130 | +91 7366952957</p>
      </footer>
    </>
  );
}
