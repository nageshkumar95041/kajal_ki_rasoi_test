import type { Metadata } from 'next';
import ContactClient from './ContactClient';

export const metadata: Metadata = {
  title: 'Contact Us | Kajal Ki Rasoi – Get in Touch',
  description:
    'Contact Kajal Ki Rasoi for custom tiffin orders, special dietary needs, or delivery enquiries. Call/WhatsApp +91 7366952957. Based in Sector 130, Noida.',
  alternates: { canonical: 'https://www.kajalkirasoi.com/contact' },
};

export default function ContactPage() {
  return <ContactClient />;
}
