import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Order } from '@/lib/models';
import { requireAuth, requireAdmin } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await connectDB();
  const order = await Order.findById(params.id);
  if (!order) return NextResponse.json({ success: false, message: 'Order not found.' }, { status: 404 });
  if (order.userId !== auth.user.id && auth.user.role !== 'admin') {
    return NextResponse.json({ success: false, message: 'Unauthorized.' }, { status: 403 });
  }
  return NextResponse.json({ success: true, order });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  await connectDB();
  await Order.findByIdAndDelete(params.id);
  const { emitOrderUpdate } = await import('@/lib/socket');
  emitOrderUpdate({ type: 'ORDER_DELETED' });
  return NextResponse.json({ success: true });
}
