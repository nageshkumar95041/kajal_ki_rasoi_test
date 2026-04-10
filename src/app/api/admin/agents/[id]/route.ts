import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Agent, User } from '@/lib/models';
import { requireAdmin } from '@/lib/auth';

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