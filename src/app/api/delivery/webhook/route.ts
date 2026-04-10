import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Order } from '@/lib/models';
import { emitOrderUpdate } from '@/lib/socket';

export async function POST(req: NextRequest) {
  const { order_id, status_name, courier } = await req.json();
  if (!order_id) return NextResponse.json({ error: 'Missing order_id' }, { status: 400 });
  await connectDB();
  const update: Record<string, unknown> = { borzoStatus: status_name };
  if (courier) { update['borzoCourier.name'] = courier.name; update['borzoCourier.phone'] = courier.phone; }
  if (status_name === 'picked_up') update.status = 'Out for Delivery';
  if (status_name === 'completed') update.status = 'Completed';
  if (status_name === 'canceled') update.status = 'Cancelled';
  const updated = await Order.findOneAndUpdate({ borzoOrderId: order_id }, { $set: update }, { new: true });
  if (updated) emitOrderUpdate({ type: 'STATUS_UPDATE', orderId: updated._id, status: updated.status, borzoStatus: status_name });
  return NextResponse.json({ status: 'ok' });
}
