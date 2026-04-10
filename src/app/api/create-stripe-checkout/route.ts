import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { connectDB } from '@/lib/mongodb';
import { MenuItem, TiffinItem, TempCart } from '@/lib/models';
import { optionalAuth } from '@/lib/auth';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const user = optionalAuth(req);
  const { items, customerName, contact, phone, address, successUrl, cancelUrl, couponCode, deliveryFee, customerLat, customerLng } = await req.json();
  if (!Array.isArray(items) || !address) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  await connectDB();
  const itemNames = items.map((i: { name: string }) => String(i.name));
  const [dbItems, dbTiffin] = await Promise.all([MenuItem.find({ name: { $in: itemNames } }), TiffinItem.find({ name: { $in: itemNames } })]);
  const priceMap: Record<string, number> = {};
  [...dbItems, ...dbTiffin].forEach(i => { priceMap[i.name] = i.price; });
  let subtotal = items.reduce((s: number, i: { name: string; quantity: number }) => s + ((priceMap[i.name] || 0) * (i.quantity || 1)), 0);
  if (couponCode === 'APNA50' && subtotal >= 200) subtotal -= 50;
  const finalTotal = subtotal + (deliveryFee || 0);
  if (finalTotal <= 0) return NextResponse.json({ error: 'Empty cart.' }, { status: 400 });
  const origin = req.headers.get('origin') || process.env.FRONTEND_URL || 'http://localhost:3000';
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{ price_data: { currency: 'inr', product_data: { name: 'Kajal Ki Rasoi Order' }, unit_amount: Math.round(finalTotal * 100) }, quantity: 1 }],
    mode: 'payment',
    success_url: successUrl?.startsWith('http') ? successUrl : `${origin}/my-orders?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl?.startsWith('http') ? cancelUrl : `${origin}/payment`,
    customer_email: contact?.includes('@') ? contact : undefined,
  });
  await TempCart.create({ stripeSessionId: session.id, userId: user?.id || null, customerName: customerName || 'Guest', contact, phone, address: address.trim(), cart: { items, total: finalTotal }, deliveryFee: deliveryFee || 0, customerLat, customerLng });
  return NextResponse.json({ id: session.id, url: session.url });
}
