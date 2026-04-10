import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Agent } from '@/lib/models';
import { requireAuth } from '@/lib/auth';

export async function PUT(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  if (user.role !== 'agent' && user.role !== 'admin') {
    return NextResponse.json({ success: false, message: 'Forbidden.' }, { status: 403 });
  }
  const { status } = await req.json();
  const validStatuses = ['Available', 'Busy', 'Offline'];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ success: false, message: 'Invalid status.' }, { status: 400 });
  }
  await connectDB();
  const agent = await Agent.findOneAndUpdate(
    { userId: user.id },
    { $set: { status } },
    { new: true }
  );
  if (!agent) return NextResponse.json({ success: false, message: 'Agent profile not found.' }, { status: 404 });
  return NextResponse.json({ success: true, agent });
}
