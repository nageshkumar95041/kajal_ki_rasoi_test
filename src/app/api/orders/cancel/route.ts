import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Order, Notification } from '@/lib/models';
import { requireAuth } from '@/lib/auth';
import { sendMail } from '@/lib/email';
import { rateLimit, RATE_LIMITS } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  // Apply rate limiting
  const rateLimitError = rateLimit(RATE_LIMITS.api.maxRequests, RATE_LIMITS.api.windowMs)(req);
  if (rateLimitError) return rateLimitError;

  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await connectDB();

  const { orderId, reason } = await req.json();
  if (!orderId) {
    return NextResponse.json({ success: false, message: 'Order ID is required.' }, { status: 400 });
  }
  if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
    return NextResponse.json({ success: false, message: 'Cancellation reason (min 5 chars) is required.' }, { status: 400 });
  }

  try {
    const order = await Order.findOne({ _id: orderId, userId: auth.user.id });
    if (!order) {
      return NextResponse.json({ success: false, message: 'Order not found.' }, { status: 404 });
    }

    // Only allow cancellation of pending or preparing orders
    if (!['Pending', 'Preparing'].includes(order.status)) {
      return NextResponse.json({
        success: false,
        message: `Cannot cancel order with status: ${order.status}. Only Pending or Preparing orders can be cancelled.`,
      }, { status: 400 });
    }

    // Update order
    order.status = 'Cancelled';
    order.cancellationReason = reason.trim();
    order.cancelledAt = new Date();
    order.cancelledBy = 'customer';
    await order.save();

    // Create notification for customer
    await Notification.create({
      userId: auth.user.id,
      type: 'order_completed',
      title: 'Order Cancelled',
      message: `Your order #${String(order._id).slice(-5)} has been cancelled.`,
      orderId: order._id,
      restaurantId: order.restaurantId,
    });

    // Create notification for restaurant
    if (order.restaurantId) {
      const restaurant = await require('@/lib/models').Restaurant.findById(order.restaurantId);
      if (restaurant) {
        await Notification.create({
          userId: restaurant.ownerId,
          type: 'order_status',
          title: 'Order Cancelled by Customer',
          message: `Order #${String(order._id).slice(-5)} from ${order.customerName} was cancelled. Reason: ${reason}`,
          orderId: order._id,
          restaurantId: order.restaurantId,
        });
      }
    }

    // Send email notification
    if (order.contact?.includes('@')) {
      const emailHtml = `
        <h2>Order Cancelled</h2>
        <p>Your order #${String(order._id).slice(-5)} has been cancelled.</p>
        <p><strong>Reason:</strong> ${reason}</p>
        <p><strong>Amount:</strong> ₹${order.total}</p>
        <p>If you have any questions, please contact our support team.</p>
      `;
      sendMail(order.contact, 'Order Cancelled', emailHtml).catch(console.error);
    }

    return NextResponse.json({ success: true, order });
  } catch (error) {
    console.error('Order cancellation error:', error);
    return NextResponse.json({ success: false, message: 'Failed to cancel order.' }, { status: 500 });
  }
}