import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Order, Agent } from '@/lib/models';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  await connectDB();

  const agent = await Agent.findOne({ userId: user.id });
  const allAgents = await Agent.find({});
  const allOrders = await Order.find({ status: { $in: ['Out for Delivery', 'Preparing'] } }).select('_id agentId status customerName');

  return NextResponse.json({
    jwtUserId: user.id,
    jwtRole: user.role,
    agentFound: !!agent,
    agentId: agent?._id,
    agentUserId: agent?.userId,
    agentName: agent?.name,
    allAgents: allAgents.map(a => ({ _id: a._id, userId: a.userId, name: a.name })),
    activeOrders: allOrders.map(o => ({ _id: o._id, agentId: o.agentId, status: o.status, customer: o.customerName })),
  });
}