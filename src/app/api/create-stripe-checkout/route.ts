import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Restaurant, MenuItem, TiffinItem, TempCart, Order, Notification } from '@/lib/models';
import { optionalAuth } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';
import { validateEmail, validatePhone, validateString } from '@/lib/validation';
import { emitOrderUpdate } from '@/lib/socket';
import { createBorzoDelivery } from '@/lib/borzo';
import {
  applyFirstTiffinFreeOffer,
  applyApna50Coupon,
  normalizeCartItems,
  normalizeCoordinate,
  priceCartItems,
  resolveSafeRedirectUrl,
} from '@/lib/payment';

async function createNotificationIfAvailable(payload: Record<string, unknown>) {
  if (typeof (Notification as any)?.create === 'function') {
    await (Notification as any).create(payload);
  }
}

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
  const normalizedCustomerName = typeof customerName === 'string' && customerName.trim() ? customerName.trim() : 'Guest';
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

  let priorOrderCount = 0;
  if (user?.id && typeof (Order as any)?.countDocuments === 'function') {
    priorOrderCount = await (Order as any).countDocuments({
      userId: user.id,
      status: { $ne: 'Failed' },
    });
  }
  const firstTiffinOffer = applyFirstTiffinFreeOffer({
    items: pricedCart.items,
    subtotal: pricedCart.subtotal,
    tiffinItemNames: dbTiffin.map((item: any) => item.name),
    isNewCustomer: Boolean(user?.id) && priorOrderCount === 0,
  });

  const coupon = applyApna50Coupon(firstTiffinOffer.discountedSubtotal, couponCode);
  const finalTotal = coupon.finalTotal;
  const safeDeliveryFee = 0;
  // Block order if restaurant is closed
  if (restaurantId) {
    const restaurantCheck = await Restaurant.findById(restaurantId).lean() as any;
    if (restaurantCheck && restaurantCheck.isOpen === false) {
      return NextResponse.json({ error: 'This restaurant is currently closed and not accepting orders.' }, { status: 400 });
    }
  }
  const normalizedCustomerLat = normalizeCoordinate(customerLat);
  const normalizedCustomerLng = normalizeCoordinate(customerLng);

  if (finalTotal <= 0) {
    const newOrder = await Order.create({
      userId: user?.id || null,
      restaurantId: restaurantId || null,
      customerName: normalizedCustomerName,
      contact,
      phone,
      address: normalizedAddress,
      items: pricedCart.items,
      total: 0,
      deliveryFee: safeDeliveryFee,
      customerLat: normalizedCustomerLat,
      customerLng: normalizedCustomerLng,
      paymentMethod: 'Online',
      newCustomerOfferApplied: firstTiffinOffer.applied,
      newCustomerOfferDiscount: firstTiffinOffer.discount,
      newCustomerOfferItemName: firstTiffinOffer.itemName || undefined,
    });

    if (user?.id) {
      await createNotificationIfAvailable({
        userId: user.id,
        type: 'order_placed',
        title: 'Order Placed',
        message: `Your order #${String(newOrder._id).slice(-5)} has been placed successfully.`,
        orderId: newOrder._id,
        restaurantId: restaurantId || undefined,
      });
    }

    if (restaurantId) {
      const restaurant = typeof (Restaurant as any)?.findById === 'function'
        ? await (Restaurant as any).findById(restaurantId)
        : null;
      if (restaurant) {
        await createNotificationIfAvailable({
          userId: String(restaurant.ownerId),
          type: 'new_order',
          title: 'New Order Received',
          message: `New order #${String(newOrder._id).slice(-5)} from ${normalizedCustomerName}`,
          orderId: newOrder._id,
          restaurantId: restaurantId,
        });
      }
    }

    emitOrderUpdate({ type: 'NEW_ORDER' });
    await createBorzoDelivery(newOrder);
    return NextResponse.json({
      success: true,
      freeOrder: true,
      orderId: newOrder._id,
      newCustomerOfferApplied: firstTiffinOffer.applied,
      newCustomerOfferDiscount: firstTiffinOffer.discount,
    });
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
    customerName: normalizedCustomerName,
    contact,
    phone,
    address: normalizedAddress,
    cart: { items: pricedCart.items, total: finalTotal },
    deliveryFee: safeDeliveryFee,
    customerLat: normalizedCustomerLat,
    customerLng: normalizedCustomerLng,
    newCustomerOfferApplied: firstTiffinOffer.applied,
    newCustomerOfferDiscount: firstTiffinOffer.discount,
    newCustomerOfferItemName: firstTiffinOffer.itemName || undefined,
  });
  return NextResponse.json({
    id: session.id,
    url: session.url,
    newCustomerOfferApplied: firstTiffinOffer.applied,
    newCustomerOfferDiscount: firstTiffinOffer.discount,
  });
}
