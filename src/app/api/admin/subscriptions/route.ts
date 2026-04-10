import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Subscription } from '@/lib/models';
import { requireAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  await connectDB();
  const status = new URL(req.url).searchParams.get('status');
  const query = status ? { status } : {};
  const subscriptions = await Subscription.find(query).sort({ timestamp: -1 }).lean();
  return NextResponse.json({ success: true, subscriptions });
}
