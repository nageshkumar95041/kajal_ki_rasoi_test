import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Order, Agent } from '@/lib/models';
import { requireAuth } from '@/lib/auth';
import { emitOrderUpdate } from '@/lib/socket';

export async function POST(req: NextRequest, { params }: { params: { orderId: string } }) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  if (user.role !== 'agent' && user.role !== 'admin') {
    return NextResponse.json({ success: false, message: 'Forbidden.' }, { status: 403 });
  }

  const { otp, podImageUrl } = await req.json();
  await connectDB();

  const order = await Order.findById(params.orderId);
  if (!order) return NextResponse.json({ success: false, message: 'Order not found.' }, { status: 404 });

  // Look up the agent profile by userId (same as how orders route works)
  // order.agentId stores Agent._id, NOT User._id — so we must resolve it first
  if (user.role !== 'admin') {
    const agent = await Agent.findOne({ userId: user.id });
    if (!agent) {
      return NextResponse.json({ success: false, message: 'Agent profile not found. Contact admin.' }, { status: 404 });
    }
    if (String(order.agentId) !== String(agent._id)) {
      return NextResponse.json({ success: false, message: 'Not your order.' }, { status: 403 });
    }
  }

  // Verify delivery OTP if set
  if (order.deliveryOtp && order.deliveryOtp !== String(otp)) {
    return NextResponse.json({ success: false, message: 'Invalid OTP. Please try again.' }, { status: 400 });
  }

  order.status = 'Completed';
  if (podImageUrl) order.podImageUrl = podImageUrl;
  await order.save();

  // Free up agent slot
  await Agent.findOneAndUpdate(
    { userId: user.id },
    { $inc: { currentLoad: -1 }, $set: { status: 'Available' } }
  );

  emitOrderUpdate({ type: 'STATUS_UPDATE', orderId: order._id, status: 'Completed' });

  return NextResponse.json({ success: true, message: 'Order marked as delivered.' });
}