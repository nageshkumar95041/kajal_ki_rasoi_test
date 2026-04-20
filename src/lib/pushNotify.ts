/**
 * pushNotify.ts
 * Server-side helper to send push notifications from within API routes.
 * Import and call these functions from checkout, delivery, order status routes.
 */

import { PushSubscription } from '@/lib/models';
import { sendPushToMany, PushSubscription as PushSub, PushPayload } from '@/lib/webpush';

/**
 * Notify a specific user by userId
 */
export async function notifyUser(userId: string, payload: PushPayload) {
  try {
    const subs = await PushSubscription.find({ userId }).lean();
    if (!subs.length) return;
    const expired = await sendPushToMany(subs as PushSub[], payload);
    if (expired.length) await PushSubscription.deleteMany({ endpoint: { $in: expired } });
  } catch (err) {
    console.error('[pushNotify] notifyUser error:', err);
  }
}

/**
 * Notify all users with a specific role
 * e.g. notifyRole('agent', { title: '...', body: '...' })
 */
export async function notifyRole(role: string, payload: PushPayload) {
  try {
    const subs = await PushSubscription.find({ role }).lean();
    if (!subs.length) return;
    const expired = await sendPushToMany(subs as PushSub[], payload);
    if (expired.length) await PushSubscription.deleteMany({ endpoint: { $in: expired } });
  } catch (err) {
    console.error('[pushNotify] notifyRole error:', err);
  }
}

/**
 * Notify the restaurant owner when a new order comes in
 */
export async function notifyRestaurantNewOrder(restaurantOwnerId: string, orderRef: string, customerName: string) {
  await notifyUser(restaurantOwnerId, {
    title: '🍱 New Order Received!',
    body:  `${customerName} placed order #${orderRef}. Open dashboard to accept.`,
    url:   '/restaurant/dashboard',
    tag:   `new-order-${orderRef}`,
  });
}

/**
 * Notify agent when an order is assigned to them
 */
export async function notifyAgentAssigned(agentUserId: string, orderRef: string, address: string) {
  await notifyUser(agentUserId, {
    title: '🛵 New Delivery Assigned!',
    body:  `Order #${orderRef} → ${address}. Open app to view details.`,
    url:   '/agent',
    tag:   `assigned-${orderRef}`,
  });
}

/**
 * Notify customer when order status changes
 */
export async function notifyCustomerStatusUpdate(userId: string, orderRef: string, status: string) {
  const messages: Record<string, string> = {
    placed:          '✅ Order placed! We\'ll start preparing it soon.',
    Preparing:       '👨‍🍳 Your order is being prepared!',
    'Out for Delivery': '🛵 Your order is on the way!',
    Completed:       '✅ Your order has been delivered. Enjoy!',
    Cancelled:       '❌ Your order has been cancelled.',
  };
  const body = messages[status] || `Your order status is now: ${status}`;
  await notifyUser(userId, {
    title: `Order #${orderRef} Update`,
    body,
    url:   `/track/${orderRef}`,
    tag:   `status-${orderRef}`,
  });
}
