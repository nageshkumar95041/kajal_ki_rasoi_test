import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Order } from '@/lib/models';
import { requireRestaurant } from '@/lib/auth';
import { createBorzoDelivery } from '@/lib/borzo';

export async function POST(req: NextRequest, { params }: { params: { orderId: string } }) {
  const auth = await requireRestaurant(req);
  if (auth instanceof NextResponse) return auth;

  await connectDB();

  const order = await Order.findOne({ _id: params.orderId, restaurantId: auth.restaurant._id });
  if (!order) {
    return NextResponse.json({ success: false, message: 'Order not found.' }, { status: 404 });
  }

  if (['Completed', 'Rejected', 'Cancelled', 'Failed'].includes(order.status)) {
    return NextResponse.json({ success: false, message: 'This order cannot be dispatched.' }, { status: 400 });
  }

  if (order.status !== 'Preparing') {
    return NextResponse.json(
      { success: false, message: 'Only accepted (Preparing) orders can be dispatched.' },
      { status: 400 }
    );
  }

  if (order.inHouseDelivery && order.agentId) {
    return NextResponse.json(
      { success: false, message: 'In-house delivery is already assigned for this order.' },
      { status: 400 }
    );
  }

  if (order.borzoOrderId) {
    return NextResponse.json({ success: false, message: 'Borzo delivery already created.' }, { status: 400 });
  }

  if (!order.customerLat || !order.customerLng) {
    return NextResponse.json(
      { success: false, message: 'Customer location is missing. Delivery cannot be created.' },
      { status: 400 }
    );
  }

  await createBorzoDelivery(order);

  const updatedOrder = await Order.findById(order._id).lean();
  if (!updatedOrder) {
    return NextResponse.json({ success: false, message: 'Order not found after dispatch.' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    message: updatedOrder.borzoTrackingUrl
      ? 'Borzo delivery has been created.'
      : 'Borzo request sent. Tracking details will appear once accepted.',
    order: updatedOrder,
  });
}
