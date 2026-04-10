import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Subscription } from '@/lib/models';
import { requireAdmin } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const { status } = await req.json();
  await connectDB();
  const sub = await Subscription.findByIdAndUpdate(params.id, { status }, { new: true });
  return NextResponse.json({ success: true, sub });
}
