import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Order } from '@/lib/models';
import { RESTAURANT_LAT, RESTAURANT_LNG } from '@/lib/borzo';

export async function GET(_req: NextRequest, { params }: { params: { orderId: string } }) {
  await connectDB();
  const order = await Order.findById(params.orderId).populate('agentId');
  if (!order) return NextResponse.json({ success: false, message: 'Order not found.' }, { status: 404 });

  const data: Record<string, unknown> = {
    success: true,
    orderId: order._id,
    status: order.status,
    customerLat: order.customerLat,
    customerLng: order.customerLng,
    inHouseDelivery: order.inHouseDelivery,
    restaurantLat: RESTAURANT_LAT,
    restaurantLng: RESTAURANT_LNG,
  };

  if (order.borzoTrackingUrl) data.borzoTrackingUrl = order.borzoTrackingUrl;

  // Include agent info if in-house delivery
  if (order.inHouseDelivery && order.agentId) {
    const agent = order.agentId as { name?: string; phone?: string };
    data.agentName = agent.name;
    data.agentPhone = agent.phone;
  }

  // Include OTP only for active deliveries (so customer can share with rider)
  if (order.status === 'Out for Delivery' && order.deliveryOtp) {
    data.deliveryOtp = order.deliveryOtp;
  }

  return NextResponse.json(data);
}
