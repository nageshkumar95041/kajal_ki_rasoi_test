import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Restaurant } from '@/lib/models';
import { MenuItem, TiffinItem, TempCart } from '@/lib/models';
import { optionalAuth } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';
import { validateEmail, validatePhone, validateString } from '@/lib/validation';
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
  // Apply rate limiting for checkout (5 per minute)
  const rateLimitError = rateLimit({ maxRequests: 5, windowMs: 60000 })(req);
  if (rateLimitError) {
    return rateLimitError;
  }

  const user = optionalAuth(req);
  const { items, customerName, contact, phone, address, successUrl, cancelUrl, couponCode, deliveryFee, customerLat, customerLng, restaurantId } = await req.json();
  const normalizedAddress = typeof address === 'string' ? address.trim() : '';
  const normalizedItems = normalizeCartItems(items);

  if (!normalizedItems || !normalizedAddress) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  
  // Validate inputs
  if (typeof contact === 'string' && contact.includes('@') && !validateEmail(contact).valid) {
    return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
  }
  if (phone && !validatePhone(phone).valid) {
    return NextResponse.json({ error: 'Invalid phone number.' }, { status: 400 });
  }
  if (!validateString(normalizedAddress, 5, 250).valid) {
    return NextResponse.json({ error: 'Address must be between 5 and 250 characters.' }, { status: 400 });
  }
  if (customerName && !validateString(customerName, 2, 100).valid) {
    return NextResponse.json({ error: 'Customer name must be between 2 and 100 characters.' }, { status: 400 });
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
  // Block order if restaurant is closed
  if (restaurantId) {
    const restaurantCheck = await Restaurant.findById(restaurantId).lean() as any;
    if (restaurantCheck && restaurantCheck.isOpen === false) {
      return NextResponse.json({ error: 'This restaurant is currently closed and not accepting orders.' }, { status: 400 });
    }
  }

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
    restaurantId: restaurantId || null,
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