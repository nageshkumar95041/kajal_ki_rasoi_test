import type { Metadata } from 'next';
import { Suspense } from 'react';
import HomeClient from './HomeClient';

export const metadata: Metadata = {
  title: 'Order Homemade Food & Daily Tiffin in Noida | Kajal Ki Rasoi',
  description:
    'Order fresh homemade meals & daily tiffin from Kajal Ki Rasoi in Noida. Serving Sector 130, Sector 135, Wazidpur & Ghaziabad. Zero preservatives. 500+ happy customers.',
  alternates: { canonical: 'https://www.kajalkirasoi.com' },
};

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomeClient />
    </Suspense>
  );
}