import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { PushSubscription } from '@/lib/models';
import { requireAuth } from '@/lib/auth';

// POST /api/push/subscribe — save or update a push subscription
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const body = await req.json();
  const { endpoint, keys } = body;

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ success: false, message: 'Invalid subscription object.' }, { status: 400 });
  }

  await connectDB();

  // Upsert — same endpoint can be updated (keys can rotate)
  await PushSubscription.findOneAndUpdate(
    { endpoint },
    {
      $set: {
        userId:   user.id,
        role:     user.role || 'user',
        endpoint,
        keys,
      },
    },
    { upsert: true, new: true }
  );

  return NextResponse.json({ success: true });
}

// DELETE /api/push/subscribe — unsubscribe (user opts out)
export async function DELETE(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { endpoint } = await req.json();
  if (!endpoint) return NextResponse.json({ success: false }, { status: 400 });

  await connectDB();
  await PushSubscription.deleteOne({ endpoint });

  return NextResponse.json({ success: true });
}
