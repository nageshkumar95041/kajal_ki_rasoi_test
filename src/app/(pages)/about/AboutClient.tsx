'use client';
import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';
import Link from 'next/link';
export const metadata: Metadata = {
  title: 'About Us | Kajal Ki Rasoi – Our Story',
  description:
    'Learn about Kajal Ki Rasoi — a real home kitchen in Noida serving fresh, 100% homemade food with zero preservatives. Read our story and customer testimonials.',
  alternates: { canonical: 'https://www.kajalkirasoi.com/about' },
};

const testimonials = [
  { initial:'A', name:'Ankit Sharma',  location:'Sector 62, Noida',       quote:"I moved to Noida for work and missed my mom's cooking terribly. Kajal Ki Rasoi is a lifesaver! The rotis are super soft, and the dal tadka feels like a warm hug after a long day at the office." },
  { initial:'P', name:'Priya Verma',   location:'Indirapuram, Ghaziabad', quote:"Finally, a tiffin service that doesn't use a thick layer of oil. It's light, fresh, and perfectly spiced. My stomach feels great, and I actually look forward to lunchtime now." },
  { initial:'R', name:'Rahul Desai',   location:'Sector 137, Noida',      quote:"The 7-day trial won me over instantly. The packaging is neat, delivery is always on time, and the premium paneer sabzi on weekends is just fantastic. Highly recommended for bachelors!" },
  { initial:'S', name:'Sneha Gupta',   location:'Vaishali, Ghaziabad',    quote:"As a working mother, cooking every single day was exhausting. Their standard thali is my saving grace. It truly tastes like it was cooked in my own kitchen. Pure, clean, and delicious." },
];

export default function AboutPage() {
  return (
    <>
      <Navbar scrolled />

      <main style={{ paddingTop: '64px', minHeight: '100vh' }}>

        {/* OUR STORY */}
        <section style={{ maxWidth: 900, margin: '0 auto', padding: '3rem 1.5rem 0' }}>
          <h1 style={{ fontSize: '2.4rem', color: '#2c3e50', marginBottom: '1.25rem', textAlign: 'center' }}>
            Our Story: From Our Home to Yours ❤️
          </h1>
          <p style={{ color: '#555', fontSize: '1.1rem', lineHeight: 1.8, textAlign: 'center', maxWidth: 720, margin: '0 auto 2.5rem' }}>
            Living away from home often means missing out on the warmth of <em>maa ke haath ka khana</em>.
            We aren&apos;t a commercial restaurant; we are a real home kitchen. Every meal is prepared with
            fresh, locally sourced vegetables, strict hygiene, and a mother&apos;s touch. Our promise is simple:
            to bring you pure, comforting, and healthy food that feels like a warm hug on a busy day.
          </p>

          {/* Why Choose box — full width, no float */}
          <div style={{ background: '#fdfbf7', padding: '2rem 2.5rem', borderRadius: 12, borderLeft: '5px solid #e67e22', boxShadow: '0 4px 15px rgba(0,0,0,0.04)', marginBottom: '3.5rem' }}>
            <h2 style={{ color: '#2c3e50', marginBottom: '1.25rem', fontSize: '1.5rem' }}>
              Why Choose Kajal Ki Rasoi?
            </h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: '#555', fontSize: '1.05rem', lineHeight: 2 }}>
              <li>✅ <strong>100% Homemade Taste:</strong> Authentic, light-on-the-stomach meals cooked with love.</li>
              <li>✅ <strong>Freshly Cooked Daily:</strong> No freezing, no leftovers. Just fresh goodness every single day.</li>
              <li>✅ <strong>Zero Preservatives:</strong> Pure spices, no artificial colors, no hidden chemicals.</li>
              <li>✅ <strong>Affordable &amp; Honest:</strong> Premium quality food that fits your everyday budget.</li>
              <li>✅ <strong>Perfect for Everyone:</strong> Whether you&apos;re working late at the office or craving a cozy weekend meal.</li>
            </ul>
          </div>
        </section>

        {/* TIFFIN SUBSCRIPTION CTA */}
        <section style={{ background: '#1a0f00', padding: '4rem 1.5rem' }}>
          <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
            <h2 style={{ color: '#c8952a', fontSize: '2rem', marginBottom: '0.75rem', fontWeight: 700 }}>
              🍱 Daily Office &amp; Home Tiffin Subscription
            </h2>
            <p style={{ color: '#a89070', fontSize: '1.05rem', marginBottom: '2.5rem' }}>
              Tired of cooking or ordering greasy food daily? Let us take care of your everyday meals.
            </p>

            {/* 3 benefit pills — dark cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2.5rem', maxWidth: 560, marginLeft: 'auto', marginRight: 'auto' }}>
              {[['⏱️','Save Time'],['🥗','Eat Healthy'],['💰','Budget-Friendly']].map(([icon, label]) => (
                <div key={label} style={{ background: '#2a1a05', padding: '1.1rem 0.75rem', borderRadius: 10, border: '1px solid #3d2a0a', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>{icon}</div>
                  <strong style={{ color: '#d4aa60', fontSize: '0.9rem' }}>{label}</strong>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <Link href="/menu" className="btn" style={{ padding: '12px 28px', borderRadius: 6 }}>
                Order Your Next Meal
              </Link>
              <Link href="/subscription" className="btn" style={{ background: 'transparent', border: '1px solid #c8952a', color: '#c8952a', padding: '12px 28px', borderRadius: 6 }}>
                Subscribe for Monthly Tiffin
              </Link>
            </div>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section className="testimonials-section" style={{ backgroundColor: '#fffaf5' }}>
          <h2 style={{ fontSize: '2.5rem', color: '#2c3e50', marginBottom: '1rem', textAlign: 'center' }}>
            Loved by Our NCR Family ❤️
          </h2>
          <p style={{ color: '#666', maxWidth: 600, margin: '0 auto 3rem', fontSize: '1.1rem', textAlign: 'center' }}>
            Don&apos;t just take our word for it. Here is what our lovely customers have to say about their everyday meals.
          </p>
          <div className="testimonials-container">
            {testimonials.map(t => (
              <div key={t.name} className="testimonial-card">
                <div style={{ color: '#f97316', fontSize: '1.3rem', marginBottom: 10, letterSpacing: 2 }}>★★★★★</div>
                <p>&quot;{t.quote}&quot;</p>
                <div className="testimonial-author">
                  <div style={{ width: 45, height: 45, borderRadius: '50%', background: '#fff1e6', color: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.2rem', border: '1px solid #f97316', flexShrink: 0 }}>
                    {t.initial}
                  </div>
                  <div>
                    <h4 style={{ color: '#2c3e50', margin: 0, fontSize: '1.05rem' }}>{t.name}</h4>
                    <span style={{ color: '#888', fontSize: '0.85rem' }}>{t.location}</span>
                  </div>
                </div>
              </div>
            ))}
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