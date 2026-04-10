'use client';
import { useState } from 'react';
import Navbar from '@/components/Navbar';
import Link from 'next/link';

export default function ContactClient() {
  const [form, setForm]       = useState({ name: '', contact: '', message: '' });
  const [msg, setMsg]         = useState('');
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    const res  = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const data = await res.json();
    setMsg(data.success ? "✅ Message sent! We'll reply shortly." : '❌ Failed to send. Please try again.');
    if (data.success) setForm({ name: '', contact: '', message: '' });
    setSending(false);
  }

  return (
    <>
      <Navbar scrolled />

      <main style={{ paddingTop: '64px', minHeight: '100vh' }}>
        <section className="contact-section" >
          <h1 style={{ textAlign:'center', fontSize:'2.4rem', color:'#2c3e50', marginBottom:'0.75rem' }}>
            We&apos;d Love to Serve You! ❤️
          </h1>
          <p style={{ textAlign:'center', color:'#666', marginBottom:'2.5rem', maxWidth:800, marginLeft:'auto', marginRight:'auto', fontSize:'1.1rem' }}>
            Craving <em>maa ke haath ka khana</em>? Whether you need a customized daily office tiffin, have special
            dietary needs, or just want a cozy weekend meal, we are here for you. Drop a message, and we&apos;ll reply in minutes!
          </p>

          <div className="contact-container">

            {/* Contact info card — dark theme */}
            <div className="contact-info" style={{ background:'#1a0f00', padding:'2rem', borderRadius:12, border:'1px solid #3d2a0a' }}>
              <h3>Get in Touch Directly</h3>
              <p style={{ fontSize:'1rem', marginBottom:'1rem', lineHeight:1.6, color:'#d4c4a8' }}>
                📍 <strong style={{ color:'#e8d5b0' }}>Kitchen Location:</strong> Sector 130, Noida<br/>
                <span style={{ fontSize:'0.88rem', color:'#a89070' }}>(Delivering hot &amp; fresh across Noida, Ghaziabad &amp; Delhi NCR)</span>
              </p>
              <p style={{ fontSize:'1rem', marginBottom:'1rem', color:'#d4c4a8' }}>
                📞 <strong style={{ color:'#e8d5b0' }}>Call/WhatsApp:</strong>{' '}
                <a href="tel:+917366952957" style={{ color:'#c8952a', textDecoration:'none', fontWeight:'bold' }}>+91 7366952957</a>{' '}
                <span style={{ fontSize:'0.85rem', color:'#2ecc71', fontWeight:'bold' }}>Fast Response ⚡</span>
              </p>
              <p style={{ fontSize:'1rem', marginBottom:'1.5rem', color:'#d4c4a8' }}>
                ✉️ <strong style={{ color:'#e8d5b0' }}>Email:</strong>{' '}
                <a href="mailto:kajalkirasoi4@gmail.com" style={{ color:'#c8952a', textDecoration:'none', fontWeight:'bold' }}>kajalkirasoi4@gmail.com</a>
              </p>
              <div style={{ marginTop:'1.5rem', borderTop:'1px dashed #3d2a0a', paddingTop:'1.5rem' }}>
                <ul style={{ listStyle:'none', padding:0, color:'#a89070', fontSize:'0.95rem', lineHeight:1.9 }}>
                  <li>✨ 100% Homemade &amp; Hygienic</li>
                  <li>🥗 Custom Diet &amp; Jain Food Available</li>
                  <li>🕐 Order by 11 AM for same-day lunch delivery</li>
                </ul>
              </div>
              <div style={{ display:'flex', gap:10, marginTop:'1.5rem', flexDirection:'column' }}>
                <a href="https://wa.me/917366952957" target="_blank" rel="noreferrer" className="btn"
                   style={{ backgroundColor:'#25D366', textAlign:'center', padding:'12px 20px', borderRadius:6, letterSpacing:'0.05em' }}>
                  CHAT ON WHATSAPP →
                </a>
                <Link href="/menu" className="btn"
                      style={{ textAlign:'center', padding:'12px 20px', borderRadius:6, letterSpacing:'0.05em' }}>
                  ORDER NOW
                </Link>
              </div>
            </div>

            {/* Contact form */}
            <form className="contact-form" onSubmit={handleSubmit}
                  style={{ background:'#fff', padding:'2rem', borderRadius:10, boxShadow:'0 4px 15px rgba(0,0,0,0.03)' }}>
              <h2 style={{ color:'#2c3e50', marginBottom:'0.5rem', fontSize:'1.4rem' }}>Send a Request</h2>
              <p style={{ color:'#888', fontSize:'0.9rem', marginBottom:'1.5rem' }}>Fill out the form below and we&apos;ll get back to you quickly!</p>
              <input type="text" placeholder="Your Name"           required value={form.name}    onChange={e => setForm({ ...form, name:    e.target.value })} />
              <input type="text" placeholder="Your Email or Phone" required value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} />
              <textarea rows={5} placeholder="Hi, I'm interested in the monthly tiffin subscription..." required value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} />
              <button type="submit" className="btn" style={{ maxWidth:200, padding:'10px 20px', alignSelf:'center' }} disabled={sending}>
                {sending ? 'Sending…' : 'Send Message'}
              </button>
              {msg && <p style={{ color: msg.startsWith('✅') ? '#2ecc71' : '#e74c3c', marginTop:'0.5rem' }}>{msg}</p>}
            </form>

          </div>
        </section>
      </main>

      <footer>
        <p>&copy; {new Date().getFullYear()} Kajal Ki Rasoi. All Rights Reserved.</p>
        <p>Noida Sector 130 | +91 7366952957</p>
      </footer>
    </>
  );
}