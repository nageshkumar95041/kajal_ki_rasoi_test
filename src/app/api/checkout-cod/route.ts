import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Order, User, MenuItem, TiffinItem, SiteSettings } from '@/lib/models';
import { optionalAuth } from '@/lib/auth';
import { emitOrderUpdate } from '@/lib/socket';
import { createBorzoDelivery } from '@/lib/borzo';

export async function POST(req: NextRequest) {
  const user = optionalAuth(req);
  if (!user) return NextResponse.json({ error: 'Must be logged in for COD.' }, { status: 403 });

  const { items, customerName, contact, phone, address, couponCode, deliveryFee, customerLat, customerLng } = await req.json();
  if (!Array.isArray(items) || !address || !customerName)
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

  const itemNames = items.map((i: { name: string }) => String(i.name));
  const [dbItems, dbTiffin] = await Promise.all([
    MenuItem.find({ name: { $in: itemNames } }),
    TiffinItem.find({ name: { $in: itemNames } }),
  ]);

  const priceMap: Record<string, number> = {};
  [...dbItems, ...dbTiffin].forEach(i => { priceMap[i.name] = i.price; });

  let subtotal = items.reduce(
    (s: number, i: { name: string; quantity: number }) => s + ((priceMap[i.name] || 0) * (i.quantity || 1)),
    0
  );
  if (couponCode === 'APNA50' && subtotal >= 200) subtotal -= 50;
  const total = subtotal + (deliveryFee || 0);

  const newOrder = await Order.create({
    userId: user.id, customerName: customerName.trim(), contact, phone,
    address: address.trim(), items, total, deliveryFee: deliveryFee || 0,
    customerLat, customerLng, paymentMethod: 'COD',
  });

  emitOrderUpdate({ type: 'NEW_ORDER' });
  await createBorzoDelivery(newOrder);
  return NextResponse.json({ success: true, orderId: newOrder._id });
}
