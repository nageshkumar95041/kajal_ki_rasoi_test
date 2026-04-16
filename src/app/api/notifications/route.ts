import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Notification } from '@/lib/models';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await connectDB();
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') || '20');
  const unreadOnly = searchParams.get('unread') === 'true';
  const query: Record<string, unknown> = { userId: auth.user.id };
  if (unreadOnly) query.isRead = false;
  const notifications = await Notification.find(query).sort({ createdAt: -1 }).limit(limit).lean();
  const unreadCount = await Notification.countDocuments({ userId: auth.user.id, isRead: false });
  return NextResponse.json({ notifications, unreadCount });
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await connectDB();
  const { title, message, type, orderId, restaurantId } = await req.json();
  if (!title || !message || !type) {
    return NextResponse.json({ success: false, message: 'Title, message, and type are required.' }, { status: 400 });
  }
  try {
    const notification = await Notification.create({
      userId: auth.user.id,
      type,
      title,
      message,
      orderId,
      restaurantId,
    });
    return NextResponse.json({ success: true, notification }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, message: 'Failed to create notification.' }, { status: 500 });
  }
}