import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Kajal Ki Rasoi – Homemade Food & Tiffin Delivery in Noida',
    template: '%s | Kajal Ki Rasoi',
  },
  description:
    'Order fresh homemade food from Kajal Ki Rasoi. Daily tiffin subscriptions and home-cooked meals delivered across Noida Sector 130, Sector 135, Wazidpur & Ghaziabad NCR.',
  keywords: [
    'tiffin service Noida',
    'homemade food delivery Noida',
    'cloud kitchen Noida',
    'daily tiffin subscription',
    'home cooked food Noida',
    'ghar ka khana Noida',
    'tiffin service Sector 130',
    'office tiffin Noida',
  ],
  metadataBase: new URL('https://www.kajalkirasoi.com'),
  alternates: { canonical: 'https://www.kajalkirasoi.com' },
  openGraph: {
    title: 'Kajal Ki Rasoi – Homemade Food & Tiffin Delivery in Noida',
    description:
      'Fresh homemade food delivered to your door. Daily tiffin subscriptions and à-la-carte meals across Noida NCR.',
    url: 'https://www.kajalkirasoi.com',
    siteName: 'Kajal Ki Rasoi',
    type: 'website',
    locale: 'en_IN',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kajal Ki Rasoi – Homemade Tiffin & Food Delivery Noida',
    description: 'Fresh homemade food & daily tiffin subscription in Noida NCR.',
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
