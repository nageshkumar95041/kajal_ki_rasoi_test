import type { Metadata } from 'next';
import MenuClient from './MenuClient';

export const metadata: Metadata = {
  title: 'Our Menu | Kajal Ki Rasoi – Homemade Food Noida',
  description:
    'Explore our full menu of fresh homemade meals — thalis, dal, biryani, rotis & more. Order online from Kajal Ki Rasoi, Noida. Zero preservatives, delivered hot.',
  alternates: { canonical: 'https://www.kajalkirasoi.com/menu' },
};

export default function MenuPage() {
  return <MenuClient />;
}
