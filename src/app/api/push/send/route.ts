import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { PushSubscription } from '@/lib/models';
import { requireAdmin } from '@/lib/auth';
import { sendPushToMany, PushSubscription as PushSub } from '@/lib/webpush';

/**
 * POST /api/push/send
 * Send a push notification to users by role or specific userId.
 * Admin only.
 *
 * Body:
 *   { role: 'agent' | 'restaurant' | 'user' | 'admin' | 'all', title, body, url?, tag? }
 *   OR
 *   { userId: 'specificId', title, body, url?, tag? }
 */
export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const { role, userId, title, body, url, tag } = await req.json();

  if (!title || !body) {
    return NextResponse.json({ success: false, message: 'title and body are required.' }, { status: 400 });
  }

  await connectDB();

  // Build query
  const query: Record<string, any> = {};
  if (userId) {
    query.userId = userId;
  } else if (role && role !== 'all') {
    query.role = role;
  }

  const subs = await PushSubscription.find(query).lean();

  if (!subs.length) {
    return NextResponse.json({ success: true, sent: 0, message: 'No subscriptions found.' });
  }

  const payload = { title, body, url: url || '/', tag: tag || 'kkr-push' };
  const expiredEndpoints = await sendPushToMany(subs as PushSub[], payload);

  // Clean up expired subscriptions
  if (expiredEndpoints.length > 0) {
    await PushSubscription.deleteMany({ endpoint: { $in: expiredEndpoints } });
  }

  return NextResponse.json({
    success: true,
    sent: subs.length - expiredEndpoints.length,
    expired: expiredEndpoints.length,
  });
}
