import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Order } from '@/lib/models';
import { requireAuth } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await connectDB();
  const order = await Order.findById(params.id);
  if (!order) return NextResponse.json({ success: false, message: 'Not found.' }, { status: 404 });
  if (order.userId !== auth.user.id) return NextResponse.json({ success: false, message: 'Unauthorized.' }, { status: 403 });
  if (order.status !== 'Pending') return NextResponse.json({ success: false, message: 'Cannot cancel accepted order.' }, { status: 400 });
  order.status = 'Cancelled';
  await order.save();
  const { emitOrderUpdate } = await import('@/lib/socket');
  emitOrderUpdate({ type: 'STATUS_UPDATE', orderId: order._id, status: 'Cancelled' });
  return NextResponse.json({ success: true, message: 'Order cancelled.' });
}
