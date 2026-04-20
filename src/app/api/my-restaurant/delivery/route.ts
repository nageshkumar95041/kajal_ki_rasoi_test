import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Agent, Order, User } from '@/lib/models';
import { requireRestaurant } from '@/lib/auth';
import { emitOrderUpdate } from '@/lib/socket';
import { sendMail } from '@/lib/email';
import { notifyAgentAssigned } from '@/lib/pushNotify';

function generateOtp(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function normalizeBatchLimit(rawLimit: unknown): number {
  const parsed = Number(rawLimit);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.floor(parsed);
}

async function decrementAgentLoad(agentId: string) {
  await Agent.findByIdAndUpdate(
    agentId,
    [
      {
        $set: {
          currentLoad: {
            $max: [0, { $subtract: [{ $ifNull: ['$currentLoad', 0] }, 1] }],
          },
        },
      },
      {
        $set: {
          status: {
            $cond: [{ $gt: ['$currentLoad', 0] }, 'Busy', 'Available'],
          },
        },
      },
    ]
  );
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
    const user = (await User.findById(order.userId).select('contact').lean()) as { contact?: string } | null;
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
  const maxBatchLimit = normalizeBatchLimit(agent.maxBatchLimit);

  if (!assigningSameAgent && agent.status === 'Offline') {
    return NextResponse.json({ success: false, message: 'Agent is offline and cannot be assigned orders.' }, { status: 400 });
  }

  if (!assigningSameAgent && agent.currentLoad >= maxBatchLimit) {
    return NextResponse.json(
      { success: false, message: `Agent is at max capacity (${maxBatchLimit} orders).` },
      { status: 400 }
    );
  }

  let assignedAgentName = agent.name;
  if (!assigningSameAgent) {
    const reservedAgent = await Agent.findOneAndUpdate(
      {
        _id: selectedAgentId,
        status: { $in: ['Available', 'Busy'] },
        currentLoad: { $lt: maxBatchLimit },
      },
      {
        $inc: { currentLoad: 1 },
        $set: { status: 'Busy' },
      },
      { new: true }
    );

    if (!reservedAgent) {
      return NextResponse.json(
        { success: false, message: `Agent is unavailable or at max capacity (${maxBatchLimit} orders).` },
        { status: 400 }
      );
    }

    assignedAgentName = reservedAgent.name;
  }

  if (previousAgentId && !assigningSameAgent) {
    await decrementAgentLoad(previousAgentId);
  }

  // Only generate a new OTP on fresh assignment.
  // Re-assigning the same agent keeps the existing OTP so the customer
  // isn't confused by multiple OTP emails.
  const otp = (assigningSameAgent && order.deliveryOtp) ? order.deliveryOtp : generateOtp();
  const isNewAssignment = !(assigningSameAgent && order.deliveryOtp);

  order.agentId = agent._id;
  order.inHouseDelivery = true;
  order.deliveryOtp = otp;
  order.status = 'Out for Delivery';
  await order.save();

  emitOrderUpdate({
    type: 'AGENT_ASSIGNED',
    orderId: order._id,
    status: 'Out for Delivery',
    agentName: assignedAgentName,
    deliveryOtp: otp,
  });

  // Only email the customer on a fresh assignment — not on same-agent reassignment
  if (isNewAssignment) {
    await sendOtpToCustomer(
      {
        _id: order._id,
        customerName: order.customerName,
        contact: order.contact,
        userId: order.userId,
        total: order.total,
      },
      otp,
      assignedAgentName
    );
  }

  // 🔔 Push notification to agent (works on locked screen)
  if (agent.userId) {
    await notifyAgentAssigned(
      String(agent.userId),
      String(order._id).slice(-5),
      order.address || ''
    );
  }

  const updatedOrder = await Order.findById(order._id)
    .populate('agentId', 'name phone status currentLoad maxBatchLimit')
    .lean();

  return NextResponse.json({
    success: true,
    message: `Order assigned to ${assignedAgentName}. OTP sent to customer.`,
    deliveryOtp: otp,
    order: updatedOrder,
  });
}
