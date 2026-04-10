import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Order, Agent, User } from '@/lib/models';
import { requireAdmin } from '@/lib/auth';
import { emitOrderUpdate } from '@/lib/socket';
import { sendMail } from '@/lib/email';

function generateOtp(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

async function sendOtpToCustomer(order: {
  _id: unknown;
  customerName: string;
  contact?: string;
  userId?: string;
  total: number;
}, otp: string, agentName: string) {
  // Try to get email: check if contact is email, or look up user account
  let email: string | null = null;

  if (order.contact && order.contact.includes('@')) {
    email = order.contact;
  } else if (order.userId) {
    const user = await User.findById(order.userId).select('contact');
    if (user?.contact?.includes('@')) email = user.contact;
  }

  if (!email) return; // Phone-only users — OTP shown in admin panel & my-orders page

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px;background:#fff;border-radius:12px;border:1px solid #f0e6d2;">
      <h2 style="color:#f97316;margin:0 0 8px;">🛵 Your order is on the way!</h2>
      <p style="color:#374151;margin:0 0 16px;">Hi <strong>${order.customerName}</strong>, your order <strong>#${String(order._id).slice(-5)}</strong> has been picked up by <strong>${agentName}</strong>.</p>

      <div style="background:#fef3c7;border:2px dashed #f59e0b;border-radius:10px;padding:20px;text-align:center;margin:20px 0;">
        <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:1px;">Your Delivery OTP</p>
        <p style="margin:0;font-size:36px;font-weight:900;color:#78350f;letter-spacing:8px;">${otp}</p>
        <p style="margin:8px 0 0;font-size:12px;color:#92400e;">Share this with your delivery partner to confirm delivery</p>
      </div>

      <p style="color:#6b7280;font-size:13px;margin:0;">Order total: <strong>₹${order.total}</strong></p>
      <p style="color:#6b7280;font-size:12px;margin:8px 0 0;">— Kajal Ki Rasoi</p>
    </div>
  `;

  await sendMail(email, `🛵 OTP for your order #${String(order._id).slice(-5)} — Kajal Ki Rasoi`, html)
    .catch(err => console.error('OTP email failed:', err));
}

export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const { orderId, agentId } = await req.json();
  if (!orderId || !agentId) {
    return NextResponse.json({ success: false, message: 'orderId and agentId are required.' }, { status: 400 });
  }

  await connectDB();

  const order = await Order.findById(orderId);
  if (!order) return NextResponse.json({ success: false, message: 'Order not found.' }, { status: 404 });

  const agent = await Agent.findById(agentId);
  if (!agent) return NextResponse.json({ success: false, message: 'Agent not found.' }, { status: 404 });

  if (agent.currentLoad >= agent.maxBatchLimit) {
    return NextResponse.json({ success: false, message: `Agent is at max capacity (${agent.maxBatchLimit} orders).` }, { status: 400 });
  }

  // Unassign from previous agent if any
  if (order.agentId) {
    await Agent.findByIdAndUpdate(order.agentId, { $inc: { currentLoad: -1 } });
  }

  const otp = generateOtp();
  order.agentId = agent._id;
  order.inHouseDelivery = true;
  order.deliveryOtp = otp;
  order.status = 'Out for Delivery';
  await order.save();

  await Agent.findByIdAndUpdate(agentId, {
    $inc: { currentLoad: 1 },
    $set: { status: 'Busy' },
  });

  emitOrderUpdate({
    type: 'AGENT_ASSIGNED',
    orderId: order._id,
    status: 'Out for Delivery',
    agentName: agent.name,
    deliveryOtp: otp,
  });

  // Send OTP to customer automatically
  await sendOtpToCustomer(
    { _id: order._id, customerName: order.customerName, contact: order.contact, userId: order.userId, total: order.total },
    otp,
    agent.name
  );

  return NextResponse.json({
    success: true,
    message: `Order assigned to ${agent.name}. OTP: ${otp}`,
    deliveryOtp: otp,
  });
}