import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Order, User, MenuItem, TiffinItem, SiteSettings, Notification, Restaurant } from '@/lib/models';
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
} from '@/lib/payment';

async function createNotificationIfAvailable(payload: Record<string, unknown>) {
  if (typeof (Notification as any)?.create === 'function') {
    await (Notification as any).create(payload);
  }
}

export async function POST(req: NextRequest) {
  // Apply rate limiting for checkout (5 per minute)
  const rateLimitError = rateLimit({ maxRequests: 5, windowMs: 60000 })(req);
  if (rateLimitError) {
    return rateLimitError;
  }

  const user = optionalAuth(req);
  if (!user) return NextResponse.json({ error: 'Must be logged in for COD.' }, { status: 403 });

  const { items, customerName, contact, phone, address, couponCode, deliveryFee, customerLat, customerLng, restaurantId } = await req.json();
  const normalizedAddress = typeof address === 'string' ? address.trim() : '';
  const normalizedCustomerName = typeof customerName === 'string' ? customerName.trim() : '';
  
  // Validate inputs
  if (contact && !validateEmail(contact).valid) {
    return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
  }
  if (phone && !validatePhone(phone).valid) {
    return NextResponse.json({ error: 'Invalid phone number.' }, { status: 400 });
  }
  if (!validateString(normalizedAddress, 5, 250).valid) {
    return NextResponse.json({ error: 'Address must be between 5 and 250 characters.' }, { status: 400 });
  }
  if (!validateString(normalizedCustomerName, 2, 100).valid) {
    return NextResponse.json({ error: 'Customer name must be between 2 and 100 characters.' }, { status: 400 });
  }

  const normalizedItems = normalizeCartItems(items);

  if (!normalizedItems || !normalizedAddress || !normalizedCustomerName)
    return NextResponse.json({ error: 'Missing details.' }, { status: 400 });

  await connectDB();

  // Block order if restaurant is closed
  if (restaurantId) {
    const restaurantCheck = await Restaurant.findById(restaurantId).lean() as any;
    if (restaurantCheck && restaurantCheck.isOpen === false) {
      return NextResponse.json({ error: 'This restaurant is currently closed and not accepting orders.' }, { status: 400 });
    }
  }

  const setting = await SiteSettings.findOne({ key: 'onlinePaymentEnabled' }).lean() as unknown as { value: any } | null;
  const val = setting?.value;
  const onlineEnabled = val === true || val === 'true' || val === 1 || val === '1';

  if (onlineEnabled) {
    const dbUser = await User.findById(user.id);
    const completedCount = await Order.countDocuments({ userId: user.id, status: 'Completed' });
    if (!dbUser || (!dbUser.isTrusted && completedCount === 0)) {
      return NextResponse.json({ error: 'COD requires 1 completed order.' }, { status: 403 });
    }
  }

  const itemNames = normalizedItems.map(item => item.name);
  const [dbItems, dbTiffin] = await Promise.all([
    MenuItem.find({ name: { $in: itemNames } }),
    TiffinItem.find({ name: { $in: itemNames } }),
  ]);

  // Prefer MenuItem prices — only use TiffinItem for names not found in MenuItem
  const menuNames = new Set(dbItems.map((i: any) => i.name));
  const tiffinOnly = dbTiffin.filter((i: any) => !menuNames.has(i.name));
  const priceSources = [...dbItems, ...tiffinOnly];

  const pricedCart = priceCartItems(normalizedItems, priceSources);
  if (!pricedCart || pricedCart.subtotal <= 0) {
    return NextResponse.json({ error: 'Invalid or unavailable cart items.' }, { status: 400 });
  }

  const priorOrderCount = await Order.countDocuments({
    userId: user.id,
    status: { $ne: 'Failed' },
  });
  const isNewCustomer = priorOrderCount === 0;
  const firstTiffinOffer = applyFirstTiffinFreeOffer({
    items: pricedCart.items,
    subtotal: pricedCart.subtotal,
    tiffinItemNames: tiffinOnly.map((item: any) => item.name),
    isNewCustomer,
  });

  const coupon = applyApna50Coupon(firstTiffinOffer.discountedSubtotal, couponCode);
  const total = coupon.finalTotal;
  const safeDeliveryFee = 0;

  const newOrder = await Order.create({
    userId: user.id,
    restaurantId: restaurantId || null,
    customerName: normalizedCustomerName,
    contact,
    phone,
    address: normalizedAddress,
    items: pricedCart.items,
    total,
    deliveryFee: safeDeliveryFee,
    customerLat: normalizeCoordinate(customerLat),
    customerLng: normalizeCoordinate(customerLng),
    paymentMethod: 'COD',
    newCustomerOfferApplied: firstTiffinOffer.applied,
    newCustomerOfferDiscount: firstTiffinOffer.discount,
    newCustomerOfferItemName: firstTiffinOffer.itemName || undefined,
  });

  // Create notification for customer
  await createNotificationIfAvailable({
    userId: user.id,
    type: 'order_placed',
    title: 'Order Placed',
    message: `Your order #${String(newOrder._id).slice(-5)} of ₹${total} has been placed successfully.`,
    orderId: newOrder._id,
    restaurantId: restaurantId || undefined,
  });

  // Create notification for restaurant owner
  if (restaurantId) {
    const restaurant = typeof (Restaurant as any)?.findById === 'function'
      ? await (Restaurant as any).findById(restaurantId)
      : null;
    if (restaurant) {
      await createNotificationIfAvailable({
        userId: String(restaurant.ownerId),
        type: 'new_order',
        title: 'New Order Received',
        message: `New order #${String(newOrder._id).slice(-5)} from ${normalizedCustomerName} for ₹${total}`,
        orderId: newOrder._id,
        restaurantId: restaurantId,
      });
    }
  }

  emitOrderUpdate({ type: 'NEW_ORDER' });
  await createBorzoDelivery(newOrder);
  return NextResponse.json({
    success: true,
    orderId: newOrder._id,
    newCustomerOfferApplied: firstTiffinOffer.applied,
    newCustomerOfferDiscount: firstTiffinOffer.discount,
  });
}
