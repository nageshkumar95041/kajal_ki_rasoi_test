import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Order } from '@/lib/models';
import { requireAdmin } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const { status } = await req.json();
  const valid = ['Pending','Preparing','Out for Delivery','Completed','Rejected','Cancelled','Failed'];
  if (!valid.includes(status)) return NextResponse.json({ success: false, message: 'Invalid status.' }, { status: 400 });
  await connectDB();
  const order = await Order.findByIdAndUpdate(params.id, { status }, { new: true });
  if (!order) return NextResponse.json({ success: false, message: 'Order not found.' }, { status: 404 });
  const { emitOrderUpdate } = await import('@/lib/socket');
  emitOrderUpdate({ type: 'STATUS_UPDATE', orderId: order._id, status: order.status });
  return NextResponse.json({ success: true, order });
}
