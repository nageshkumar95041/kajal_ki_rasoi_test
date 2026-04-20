import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Order, Notification } from '@/lib/models';
import { requireRestaurant } from '@/lib/auth';
import { notifyCustomerStatusUpdate } from '@/lib/pushNotify';

export async function GET(req: NextRequest) {
  const auth = await requireRestaurant(req);
  if (auth instanceof NextResponse) return auth;
  await connectDB();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const limit = parseInt(searchParams.get('limit') || '50');
  const query: Record<string, unknown> = { restaurantId: auth.restaurant._id };
  if (status && status !== 'all') query.status = status;
  else if (!status) query.status = { $nin: ['Completed', 'Rejected', 'Cancelled'] };
  const orders = await Order.find(query).sort({ timestamp: -1 }).limit(limit).lean();
  return NextResponse.json(orders);
}

export async function PATCH(req: NextRequest) {
  const auth = await requireRestaurant(req);
  if (auth instanceof NextResponse) return auth;
  await connectDB();
  const { orderId, status } = await req.json();
  if (!orderId || !status) {
    return NextResponse.json({ success: false, message: 'Order ID and status are required.' }, { status: 400 });
  }
  const validStatuses = ['Pending', 'Preparing', 'Out for Delivery', 'Completed', 'Rejected', 'Cancelled'];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ success: false, message: 'Invalid status.' }, { status: 400 });
  }
  try {
    const order = await Order.findOne({ _id: orderId, restaurantId: auth.restaurant._id });
    if (!order) {
      return NextResponse.json({ success: false, message: 'Order not found.' }, { status: 404 });
    }

    const transitionMap: Record<string, string[]> = {
      Pending: ['Preparing', 'Rejected', 'Cancelled'],
      Preparing: ['Cancelled'],
      'Out for Delivery': [],
      Completed: [],
      Rejected: [],
      Cancelled: [],
      Failed: [],
    };

    const currentStatus = String(order.status || 'Pending');
    const allowedNext = transitionMap[currentStatus] || [];

    if (currentStatus === status) {
      return NextResponse.json({ success: true, order });
    }

    if (!allowedNext.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          message:
            currentStatus === 'Pending'
              ? 'Only Accept (Preparing), Reject, or Cancel is allowed for pending orders.'
              : currentStatus === 'Preparing'
                ? 'Preparing orders can only be cancelled from this screen. Use delivery assignment to move to Out for Delivery.'
                : 'This order status can no longer be changed from restaurant dashboard.',
        },
        { status: 400 }
      );
    }

    order.status = status;
    await order.save();

    // Create notification for customer
    if (order.userId) {
      const notifType = status === 'Completed' ? 'order_completed' : 'order_status';
      const message = `Your order #${String(order._id).slice(-5)} status: ${status}`;
      await Notification.create({
        userId: order.userId,
        type: notifType,
        title: `Order ${status}`,
        message,
        orderId: order._id,
        restaurantId: auth.restaurant._id,
      });
      // 🔔 Push to customer locked screen
      await notifyCustomerStatusUpdate(
        String(order.userId),
        String(order._id).slice(-5),
        status
      );
    }
    return NextResponse.json({ success: true, order });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, message: 'Failed to update order.' }, { status: 500 });
  }
}
