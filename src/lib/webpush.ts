/**
 * Web Push helper — Kajal Ki Rasoi
 *
 * Requires env vars:
 *   VAPID_PUBLIC_KEY   — generate with: npx web-push generate-vapid-keys
 *   VAPID_PRIVATE_KEY  — same command
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY — same value as VAPID_PUBLIC_KEY (exposed to browser)
 */

import webpush from 'web-push';

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY  || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = 'mailto:admin@kajalkirasoi.com';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

export interface PushPayload {
  title: string;
  body:  string;
  url?:  string;
  tag?:  string;
}

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth:   string;
  };
}

/**
 * Send a push notification to a single subscription.
 * Returns true on success, false on failure.
 * Automatically handles expired/invalid subscriptions (410 Gone).
 */
export async function sendPushNotification(
  subscription: PushSubscription,
  payload: PushPayload
): Promise<{ success: boolean; gone?: boolean }> {
  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify(payload),
      { TTL: 60 * 60 } // 1 hour TTL
    );
    return { success: true };
  } catch (err: any) {
    // 410 Gone = subscription expired/revoked → caller should delete it
    if (err.statusCode === 410 || err.statusCode === 404) {
      return { success: false, gone: true };
    }
    console.error('[webpush] sendNotification error:', err.message);
    return { success: false };
  }
}

/**
 * Send push to multiple subscriptions.
 * Returns list of expired endpoint URLs to remove from DB.
 */
export async function sendPushToMany(
  subscriptions: PushSubscription[],
  payload: PushPayload
): Promise<string[]> {
  const expiredEndpoints: string[] = [];
  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      const result = await sendPushNotification(sub, payload);
      if (result.gone) expiredEndpoints.push(sub.endpoint);
    })
  );
  return expiredEndpoints;
}
