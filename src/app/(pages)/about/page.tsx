import type { Metadata } from 'next';
import { Suspense } from 'react';
import AboutClient from './AboutClient';

export const metadata: Metadata = {
  title: 'About Us | Kajal Ki Rasoi – Our Story',
  description:
    'Learn about Kajal Ki Rasoi — a real home kitchen in Noida serving fresh, 100% homemade food with zero preservatives. Read our story and customer testimonials.',
  alternates: { canonical: 'https://www.kajalkirasoi.com/about' },
};

export default function AboutPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh' }} />}>
      <AboutClient />
    </Suspense>
  );
}