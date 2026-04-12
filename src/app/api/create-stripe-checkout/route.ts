import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { MenuItem, TiffinItem, TempCart } from '@/lib/models';
import { optionalAuth } from '@/lib/auth';
import {
  applyApna50Coupon,
  normalizeCartItems,
  normalizeCoordinate,
  priceCartItems,
  resolveSafeRedirectUrl,
} from '@/lib/payment';

// Lazy-loaded so jest.mock('stripe', ...) works correctly in tests
function getStripe() {
  const Stripe = require('stripe').default ?? require('stripe');
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

export async function POST(req: NextRequest) {
  const user = optionalAuth(req);
  const { items, customerName, contact, phone, address, successUrl, cancelUrl, couponCode, deliveryFee, customerLat, customerLng } = await req.json();
  const normalizedAddress = typeof address === 'string' ? address.trim() : '';
  const normalizedItems = normalizeCartItems(items);

  if (!normalizedItems || !normalizedAddress) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  await connectDB();
  const itemNames = normalizedItems.map(item => item.name);
  const [dbItems, dbTiffin] = await Promise.all([
    MenuItem.find({ name: { $in: itemNames }, available: true }),
    TiffinItem.find({ name: { $in: itemNames }, available: true }),
  ]);
  const pricedCart = priceCartItems(normalizedItems, [...dbItems, ...dbTiffin]);
  if (!pricedCart || pricedCart.subtotal <= 0) {
    return NextResponse.json({ error: 'Invalid or unavailable cart items.' }, { status: 400 });
  }

  const coupon = applyApna50Coupon(pricedCart.subtotal, couponCode);
  const finalTotal = coupon.finalTotal;
  const safeDeliveryFee = 0;
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{ price_data: { currency: 'inr', product_data: { name: 'Kajal Ki Rasoi Order' }, unit_amount: Math.round(finalTotal * 100) }, quantity: 1 }],
    mode: 'payment',
    success_url: resolveSafeRedirectUrl(req, successUrl, '/my-orders?session_id={CHECKOUT_SESSION_ID}'),
    cancel_url: resolveSafeRedirectUrl(req, cancelUrl, '/payment'),
    customer_email: typeof contact === 'string' && contact.includes('@') ? contact : undefined,
  });
  await TempCart.create({
    stripeSessionId: session.id,
    userId: user?.id || null,
    customerName: typeof customerName === 'string' && customerName.trim() ? customerName.trim() : 'Guest',
    contact,
    phone,
    address: normalizedAddress,
    cart: { items: pricedCart.items, total: finalTotal },
    deliveryFee: safeDeliveryFee,
    customerLat: normalizeCoordinate(customerLat),
    customerLng: normalizeCoordinate(customerLng),
  });
  return NextResponse.json({ id: session.id, url: session.url });
}
