import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models';
import { requireAdmin } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const { isVerified } = await req.json();
  await connectDB();
  const user = await User.findByIdAndUpdate(params.id, { isVerified }, { new: true });
  return NextResponse.json({ success: true, user });
}
