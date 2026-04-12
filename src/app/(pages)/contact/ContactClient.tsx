'use client';
import { useState } from 'react';
import Navbar from '@/components/Navbar';
import Link from 'next/link';

interface FormErrors {
  name?: string;
  contact?: string;
  message?: string;
}

function validateForm(form: { name: string; contact: string; message: string }): FormErrors {
  const errors: FormErrors = {};

  // Name: at least 2 chars, only letters/spaces/dots/hyphens
  const nameTrimmed = form.name.trim();
  if (!nameTrimmed) {
    errors.name = 'Name is required.';
  } else if (nameTrimmed.length < 2) {
    errors.name = 'Name must be at least 2 characters.';
  } else if (nameTrimmed.length > 60) {
    errors.name = 'Name is too long.';
  } else if (!/^[a-zA-Z\u00C0-\u024F\s.\-']+$/.test(nameTrimmed)) {
    errors.name = 'Name contains invalid characters.';
  }

  // Contact: valid email OR valid Indian/international phone
  const contactTrimmed = form.contact.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const phoneRegex = /^[+]?[\d\s\-()]{7,15}$/;
  if (!contactTrimmed) {
    errors.contact = 'Email or phone is required.';
  } else if (!emailRegex.test(contactTrimmed) && !phoneRegex.test(contactTrimmed)) {
    errors.contact = 'Enter a valid email address or phone number.';
  }

  // Message: meaningful length, no pure garbage
  const msgTrimmed = form.message.trim();
  if (!msgTrimmed) {
    errors.message = 'Message is required.';
  } else if (msgTrimmed.length < 10) {
    errors.message = 'Message is too short (min 10 characters).';
  } else if (msgTrimmed.length > 1000) {
    errors.message = `Message is too long (${msgTrimmed.length}/1000 characters).`;
  } else if (/^(.)\1{9,}$/.test(msgTrimmed)) {
    // Catches "aaaaaaaaaa", "!!!!!!!!!", etc.
    errors.message = 'Please write a meaningful message.';
  }

  return errors;
}

export default function ContactClient() {
  const [form, setForm]     = useState({ name: '', contact: '', message: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState({ name: false, contact: false, message: false });
  const [msg, setMsg]       = useState('');
  const [sending, setSending] = useState(false);

  // Validate a single field on blur
  function handleBlur(field: keyof typeof form) {
    setTouched(t => ({ ...t, [field]: true }));
    const fieldErrors = validateForm(form);
    setErrors(e => ({ ...e, [field]: fieldErrors[field] }));
  }

  // Re-validate on change if field was already touched
  function handleChange(field: keyof typeof form, value: string) {
    const updated = { ...form, [field]: value };
    setForm(updated);
    if (touched[field]) {
      const fieldErrors = validateForm(updated);
      setErrors(e => ({ ...e, [field]: fieldErrors[field] }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Mark all fields as touched and run full validation
    setTouched({ name: true, contact: true, message: true });
    const allErrors = validateForm(form);
    setErrors(allErrors);
    if (Object.keys(allErrors).length > 0) return;

    setSending(true);
    setMsg('');
    try {
      const res  = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:    form.name.trim(),
          contact: form.contact.trim(),
          message: form.message.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg("✅ Message sent! We'll reply shortly.");
        setForm({ name: '', contact: '', message: '' });
        setTouched({ name: false, contact: false, message: false });
        setErrors({});
      } else {
        setMsg('❌ Failed to send. Please try again.');
      }
    } catch {
      setMsg('❌ Network error. Please check your connection and try again.');
    } finally {
      setSending(false);
    }
  }

  const inputStyle = (field: keyof typeof form): React.CSSProperties => ({
    border: `1px solid ${touched[field] && errors[field] ? '#e74c3c' : touched[field] && !errors[field] ? '#2ecc71' : '#ccc'}`,
    borderRadius: 6,
    padding: '10px 14px',
    width: '100%',
    boxSizing: 'border-box' as const,
    fontSize: '1rem',
    outline: 'none',
    transition: 'border-color 0.2s',
  });

  const charCount = form.message.trim().length;

  return (
    <>
      <Navbar scrolled />

      <main style={{ paddingTop: '64px', minHeight: '100vh' }}>
        <section className="contact-section">
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
            <form className="contact-form" onSubmit={handleSubmit} noValidate
                  style={{ background:'#fff', padding:'2rem', borderRadius:10, boxShadow:'0 4px 15px rgba(0,0,0,0.03)' }}>
              <h2 style={{ color:'#2c3e50', marginBottom:'0.5rem', fontSize:'1.4rem' }}>Send a Request</h2>
              <p style={{ color:'#888', fontSize:'0.9rem', marginBottom:'1.5rem' }}>Fill out the form below and we&apos;ll get back to you quickly!</p>

              {/* Name */}
              <div style={{ marginBottom: '1rem' }}>
                <input
                  type="text"
                  placeholder="Your Name *"
                  value={form.name}
                  onChange={e => handleChange('name', e.target.value)}
                  onBlur={() => handleBlur('name')}
                  style={inputStyle('name')}
                  maxLength={60}
                  autoComplete="name"
                />
                {touched.name && errors.name && (
                  <p style={{ color:'#e74c3c', fontSize:'0.8rem', marginTop:4 }}>⚠ {errors.name}</p>
                )}
              </div>

              {/* Contact */}
              <div style={{ marginBottom: '1rem' }}>
                <input
                  type="text"
                  placeholder="Your Email or Phone *"
                  value={form.contact}
                  onChange={e => handleChange('contact', e.target.value)}
                  onBlur={() => handleBlur('contact')}
                  style={inputStyle('contact')}
                  autoComplete="email"
                />
                {touched.contact && errors.contact && (
                  <p style={{ color:'#e74c3c', fontSize:'0.8rem', marginTop:4 }}>⚠ {errors.contact}</p>
                )}
              </div>

              {/* Message */}
              <div style={{ marginBottom: '1rem' }}>
                <textarea
                  rows={5}
                  placeholder="Hi, I'm interested in the monthly tiffin subscription... *"
                  value={form.message}
                  onChange={e => handleChange('message', e.target.value)}
                  onBlur={() => handleBlur('message')}
                  style={{ ...inputStyle('message'), resize: 'vertical', fontFamily: 'inherit' }}
                  maxLength={1000}
                />
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop: 2 }}>
                  {touched.message && errors.message
                    ? <p style={{ color:'#e74c3c', fontSize:'0.8rem', margin:0 }}>⚠ {errors.message}</p>
                    : <span />
                  }
                  <span style={{ fontSize:'0.75rem', color: charCount > 900 ? '#e74c3c' : '#aaa', marginLeft:'auto' }}>
                    {charCount}/1000
                  </span>
                </div>
              </div>

              <button
                type="submit"
                className="btn"
                style={{ maxWidth:200, padding:'10px 20px', alignSelf:'center', opacity: sending ? 0.7 : 1 }}
                disabled={sending}
              >
                {sending ? 'Sending…' : 'Send Message'}
              </button>

              {msg && (
                <p style={{ color: msg.startsWith('✅') ? '#2ecc71' : '#e74c3c', marginTop:'0.75rem', fontSize:'0.95rem' }}>
                  {msg}
                </p>
              )}
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