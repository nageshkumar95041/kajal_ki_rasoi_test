import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Agent, User } from '@/lib/models';
import { requireAdmin } from '@/lib/auth';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  await connectDB();

  const body = await req.json();
  const { maxBatchLimit } = body;

  if (maxBatchLimit !== undefined) {
    const parsed = Number(maxBatchLimit);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 20) {
      return NextResponse.json(
        { success: false, message: 'maxBatchLimit must be between 1 and 20.' },
        { status: 400 }
      );
    }
  }

  const update: Record<string, any> = {};
  if (maxBatchLimit !== undefined) update.maxBatchLimit = Math.floor(Number(maxBatchLimit));

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ success: false, message: 'Nothing to update.' }, { status: 400 });
  }

  const agent = await Agent.findByIdAndUpdate(
    params.id,
    { $set: update },
    { new: true }
  );

  if (!agent) {
    return NextResponse.json({ success: false, message: 'Agent not found.' }, { status: 404 });
  }

  return NextResponse.json({ success: true, agent });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  await connectDB();

  const agent = await Agent.findById(params.id);
  if (!agent) {
    return NextResponse.json({ success: false, message: 'Agent not found.' }, { status: 404 });
  }

  // Downgrade the linked user's role back to 'user'
  await User.findOneAndUpdate(
    { _id: agent.userId },
    { $set: { role: 'user' } }
  );

  await Agent.findByIdAndDelete(params.id);

  return NextResponse.json({ success: true, message: 'Agent deleted successfully.' });
}