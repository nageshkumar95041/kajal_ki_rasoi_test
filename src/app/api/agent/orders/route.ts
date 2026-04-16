import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Order, Agent } from '@/lib/models';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  if (user.role !== 'agent' && user.role !== 'admin') {
    return NextResponse.json({ success: false, message: 'Forbidden.' }, { status: 403 });
  }

  await connectDB();

  // Find the agent profile linked to this user account
  const agent = await Agent.findOne({ userId: user.id });
  if (!agent) {
    return NextResponse.json({ success: false, message: 'Agent profile not found. Contact admin.' }, { status: 404 });
  }

  // Query orders by agent._id (which is what gets stored in order.agentId)
  const baseQuery = Order.find({
    agentId: agent._id,
    status: { $in: ['Out for Delivery', 'Preparing'] },
  }).sort({ timestamp: -1 });

  const rawOrders = typeof (baseQuery as any)?.populate === 'function'
    ? await (baseQuery as any).populate('restaurantId', 'name address')
    : await baseQuery;

  const orders = (Array.isArray(rawOrders) ? rawOrders : []).map((order: any) => {
    const plainOrder = typeof order?.toObject === 'function' ? order.toObject() : order;
    const restaurant = plainOrder?.restaurantId && typeof plainOrder.restaurantId === 'object'
      ? plainOrder.restaurantId
      : null;

    return {
      ...plainOrder,
      restaurantName: restaurant?.name || undefined,
      restaurantAddress: restaurant?.address || undefined,
    };
  });

  return NextResponse.json({
    success: true,
    orders,
    agentInfo: {
      name: agent.name,
      status: agent.status,
      currentLoad: agent.currentLoad,
      maxBatchLimit: agent.maxBatchLimit,
    },
  });
}
