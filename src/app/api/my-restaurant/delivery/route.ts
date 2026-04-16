import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Agent, Order, User } from '@/lib/models';
import { requireRestaurant } from '@/lib/auth';
import { emitOrderUpdate } from '@/lib/socket';
import { sendMail } from '@/lib/email';

function generateOtp(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

async function sendOtpToCustomer(
  order: {
    _id: unknown;
    customerName: string;
    contact?: string;
    userId?: string;
    total: number;
  },
  otp: string,
  agentName: string
) {
  let email: string | null = null;

  if (order.contact && order.contact.includes('@')) {
    email = order.contact;
  } else if (order.userId) {
    const user = await User.findById(order.userId).select('contact').lean();
    if (user?.contact?.includes('@')) email = user.contact;
  }

  if (!email) return;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px;background:#fff;border-radius:12px;border:1px solid #f0e6d2;">
      <h2 style="color:#f97316;margin:0 0 8px;">Your order is out for delivery</h2>
      <p style="color:#374151;margin:0 0 16px;">Hi <strong>${order.customerName}</strong>, your order <strong>#${String(order._id).slice(-5)}</strong> has been assigned to <strong>${agentName}</strong>.</p>

      <div style="background:#fef3c7;border:2px dashed #f59e0b;border-radius:10px;padding:20px;text-align:center;margin:20px 0;">
        <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:1px;">Delivery OTP</p>
        <p style="margin:0;font-size:36px;font-weight:900;color:#78350f;letter-spacing:8px;">${otp}</p>
        <p style="margin:8px 0 0;font-size:12px;color:#92400e;">Share this OTP with your delivery partner to confirm delivery.</p>
      </div>

      <p style="color:#6b7280;font-size:13px;margin:0;">Order total: <strong>INR ${order.total}</strong></p>
      <p style="color:#6b7280;font-size:12px;margin:8px 0 0;">Kajal Ki Rasoi</p>
    </div>
  `;

  await sendMail(email, `Delivery OTP for your order #${String(order._id).slice(-5)}`, html).catch((error) =>
    console.error('OTP email failed:', error)
  );
}

export async function GET(req: NextRequest) {
  const auth = await requireRestaurant(req);
  if (auth instanceof NextResponse) return auth;

  await connectDB();

  const [agents, orders] = await Promise.all([
    Agent.find({}).sort({ status: 1, name: 1 }).lean(),
    Order.find({
      restaurantId: auth.restaurant._id,
      status: { $in: ['Preparing', 'Out for Delivery'] },
    })
      .sort({ timestamp: -1 })
      .populate('agentId', 'name phone status currentLoad maxBatchLimit')
      .lean(),
  ]);

  return NextResponse.json({ success: true, agents, orders });
}

export async function POST(req: NextRequest) {
  const auth = await requireRestaurant(req);
  if (auth instanceof NextResponse) return auth;

  await connectDB();

  const { orderId, agentId } = await req.json();
  if (!orderId || !agentId) {
    return NextResponse.json({ success: false, message: 'orderId and agentId are required.' }, { status: 400 });
  }

  const order = await Order.findOne({ _id: orderId, restaurantId: auth.restaurant._id });
  if (!order) {
    return NextResponse.json({ success: false, message: 'Order not found.' }, { status: 404 });
  }

  if (['Completed', 'Rejected', 'Cancelled', 'Failed'].includes(order.status)) {
    return NextResponse.json({ success: false, message: 'This order can no longer be assigned.' }, { status: 400 });
  }

  if (order.status !== 'Preparing') {
    return NextResponse.json(
      { success: false, message: 'Only accepted (Preparing) orders can be assigned to an agent.' },
      { status: 400 }
    );
  }

  if (order.borzoOrderId && !order.inHouseDelivery) {
    return NextResponse.json(
      { success: false, message: 'Borzo delivery is already active for this order.' },
      { status: 400 }
    );
  }

  const agent = await Agent.findById(agentId);
  if (!agent) {
    return NextResponse.json({ success: false, message: 'Agent not found.' }, { status: 404 });
  }

  const selectedAgentId = String(agent._id);
  const previousAgentId = order.agentId ? String(order.agentId) : '';
  const assigningSameAgent = previousAgentId && previousAgentId === selectedAgentId;

  if (!assigningSameAgent && agent.currentLoad >= agent.maxBatchLimit) {
    return NextResponse.json(
      { success: false, message: `Agent is at max capacity (${agent.maxBatchLimit} orders).` },
      { status: 400 }
    );
  }

  if (previousAgentId && !assigningSameAgent) {
    await Agent.findByIdAndUpdate(previousAgentId, { $inc: { currentLoad: -1 } });
  }

  const otp = generateOtp();
  order.agentId = agent._id;
  order.inHouseDelivery = true;
  order.deliveryOtp = otp;
  order.status = 'Out for Delivery';
  await order.save();

  if (!assigningSameAgent) {
    await Agent.findByIdAndUpdate(selectedAgentId, {
      $inc: { currentLoad: 1 },
      $set: { status: 'Busy' },
    });
  }

  emitOrderUpdate({
    type: 'AGENT_ASSIGNED',
    orderId: order._id,
    status: 'Out for Delivery',
    agentName: agent.name,
    deliveryOtp: otp,
  });

  await sendOtpToCustomer(
    {
      _id: order._id,
      customerName: order.customerName,
      contact: order.contact,
      userId: order.userId,
      total: order.total,
    },
    otp,
    agent.name
  );

  const updatedOrder = await Order.findById(order._id)
    .populate('agentId', 'name phone status currentLoad maxBatchLimit')
    .lean();

  return NextResponse.json({
    success: true,
    message: `Order assigned to ${agent.name}. OTP sent to customer.`,
    deliveryOtp: otp,
    order: updatedOrder,
  });
}
