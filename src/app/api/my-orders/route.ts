import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Order } from '@/lib/models';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await connectDB();
  const limit = parseInt(new URL(req.url).searchParams.get('limit') || '20');
  const orders = await Order.find({ userId: auth.user.id }).sort({ _id: -1 }).limit(limit).lean();
  return NextResponse.json(orders);
}
