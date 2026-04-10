import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models';
import { requireAdmin } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const { role } = await req.json();
  if (!['admin','user','agent'].includes(role)) return NextResponse.json({ success: false, message: 'Invalid role.' }, { status: 400 });
  await connectDB();
  const update = role === 'agent' ? { role, isVerified: true } : { role };
  const user = await User.findByIdAndUpdate(params.id, update, { new: true });
  return NextResponse.json({ success: true, user });
}