import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Notification } from '@/lib/models';
import { requireAuth } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await connectDB();
  const { isRead } = await req.json();
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: params.id, userId: auth.user.id },
      { isRead },
      { new: true }
    );
    if (!notification) {
      return NextResponse.json({ success: false, message: 'Notification not found.' }, { status: 404 });
    }
    return NextResponse.json({ success: true, notification });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, message: 'Failed to update notification.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await connectDB();
  try {
    const notification = await Notification.findOneAndDelete({ _id: params.id, userId: auth.user.id });
    if (!notification) {
      return NextResponse.json({ success: false, message: 'Notification not found.' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, message: 'Failed to delete notification.' }, { status: 500 });
  }
}