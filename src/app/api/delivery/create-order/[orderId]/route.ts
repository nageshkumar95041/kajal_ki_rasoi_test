import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Order } from '@/lib/models';
import { requireAdmin } from '@/lib/auth';
import { createBorzoDelivery } from '@/lib/borzo';

export async function POST(req: NextRequest, { params }: { params: { orderId: string } }) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  await connectDB();
  const order = await Order.findById(params.orderId);
  if (!order) return NextResponse.json({ success: false, message: 'Order not found.' }, { status: 404 });
  if (order.borzoOrderId) return NextResponse.json({ success: false, message: 'Delivery already created.' }, { status: 400 });
  await createBorzoDelivery(order);
  return NextResponse.json({ success: true, message: 'Delivery creation initiated.' });
}
