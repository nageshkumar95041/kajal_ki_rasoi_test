import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { connectDB } from '@/lib/mongodb';
import { TempCart, TempSubscription, Order, Subscription, Notification } from '@/lib/models';
import { sendMail } from '@/lib/email';
import { emitOrderUpdate } from '@/lib/socket';
import { createBorzoDelivery } from '@/lib/borzo';

async function createNotificationIfAvailable(payload: Record<string, unknown>) {
  if (typeof (Notification as any)?.create === 'function') {
    await (Notification as any).create(payload);
  }
}

// Lazy-loaded so jest.mock('stripe', ...) works correctly in tests
function getStripe() {
  const Stripe = require('stripe').default ?? require('stripe');
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');
  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: 'Webhook error' }, { status: 400 });
  }
  if (event.type === 'checkout.session.completed') {
    await connectDB();
    const session = event.data.object;
    // Process order
    const tempCart = await TempCart.findOneAndDelete({ stripeSessionId: session.id });
    if (tempCart) {
      const order = await Order.create({
        userId: tempCart.userId, restaurantId: tempCart.restaurantId,
        customerName: tempCart.customerName,
        contact: tempCart.contact, phone: tempCart.phone,
        address: tempCart.address, items: tempCart.cart.items,
        total: tempCart.cart.total, deliveryFee: tempCart.deliveryFee,
        customerLat: tempCart.customerLat, customerLng: tempCart.customerLng,
        paymentMethod: 'Online',
      });
      if (tempCart.contact?.includes('@')) {
        const html = `<h1>Thank you, ${order.customerName}!</h1><p>Order confirmed. Total: ₹${order.total}</p>`;
        sendMail(tempCart.contact, `Order Confirmation #${String(order._id).slice(-5)}`, html).catch(console.error);
      }
      // Create notification for customer
      if (tempCart.userId) {
        await createNotificationIfAvailable({
          userId: tempCart.userId,
          type: 'order_placed',
          title: 'Order Placed',
          message: `Your order #${String(order._id).slice(-5)} of ₹${order.total} has been placed successfully.`,
          orderId: order._id,
          restaurantId: order.restaurantId,
        });
      }
      // Create notification for restaurant owner
      if (order.restaurantId) {
        const RestaurantModel = (await import('@/lib/models')).Restaurant as any;
        const restaurant = typeof RestaurantModel?.findById === 'function'
          ? await RestaurantModel.findById(order.restaurantId)
          : null;
        if (restaurant) {
          await createNotificationIfAvailable({
            userId: restaurant.ownerId,
            type: 'new_order',
            title: 'New Order Received',
            message: `New order #${String(order._id).slice(-5)} from ${order.customerName} for ₹${order.total}`,
            orderId: order._id,
            restaurantId: order.restaurantId,
          });
        }
      }
      emitOrderUpdate({ type: 'NEW_ORDER' });
      await createBorzoDelivery(order);
    }
    // Process subscription
    const tempSub = await TempSubscription.findOneAndDelete({ stripeSessionId: session.id });
    if (tempSub) {
      const sub = await Subscription.create({
        userId: tempSub.userId,
        customerName: tempSub.customerName,
        contact: tempSub.contact,
        address: tempSub.address,
        plan: tempSub.plan,
        frequency: tempSub.frequency,
        persons: tempSub.persons,
        couponCode: tempSub.couponCode,
        price: tempSub.price,
        startDate: tempSub.startDate,
        status: 'Active',
      });
      if (tempSub.contact?.includes('@')) {
        sendMail(tempSub.contact, `Subscription Confirmed: ${sub.plan}`, `<h1>Welcome ${sub.customerName}!</h1><p>Your ${sub.plan} is active.</p>`).catch(console.error);
      }
      emitOrderUpdate({ type: 'NEW_SUBSCRIPTION', subscription: sub });
    }
  }
  return NextResponse.json({ status: 'ok' });
}
