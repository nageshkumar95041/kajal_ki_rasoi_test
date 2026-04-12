import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Order, User, MenuItem, TiffinItem, SiteSettings } from '@/lib/models';
import { optionalAuth } from '@/lib/auth';
import { emitOrderUpdate } from '@/lib/socket';
import { createBorzoDelivery } from '@/lib/borzo';
import {
  applyApna50Coupon,
  normalizeCartItems,
  normalizeCoordinate,
  priceCartItems,
} from '@/lib/payment';

export async function POST(req: NextRequest) {
  const user = optionalAuth(req);
  if (!user) return NextResponse.json({ error: 'Must be logged in for COD.' }, { status: 403 });

  const { items, customerName, contact, phone, address, couponCode, deliveryFee, customerLat, customerLng } = await req.json();
  const normalizedAddress = typeof address === 'string' ? address.trim() : '';
  const normalizedCustomerName = typeof customerName === 'string' ? customerName.trim() : '';
  const normalizedItems = normalizeCartItems(items);

  if (!normalizedItems || !normalizedAddress || !normalizedCustomerName)
    return NextResponse.json({ error: 'Missing details.' }, { status: 400 });

  await connectDB();

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
    MenuItem.find({ name: { $in: itemNames }, available: true }),
    TiffinItem.find({ name: { $in: itemNames }, available: true }),
  ]);
  const pricedCart = priceCartItems(normalizedItems, [...dbItems, ...dbTiffin]);
  if (!pricedCart || pricedCart.subtotal <= 0) {
    return NextResponse.json({ error: 'Invalid or unavailable cart items.' }, { status: 400 });
  }

  const coupon = applyApna50Coupon(pricedCart.subtotal, couponCode);
  const total = coupon.finalTotal;
  const safeDeliveryFee = 0;

  const newOrder = await Order.create({
    userId: user.id,
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
  });

  emitOrderUpdate({ type: 'NEW_ORDER' });
  await createBorzoDelivery(newOrder);
  return NextResponse.json({ success: true, orderId: newOrder._id });
}
