import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Order } from '@/lib/models';
import { requireAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  await connectDB();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const paymentMethod = searchParams.get('paymentMethod');
  const contact = searchParams.get('contact');
  const date = searchParams.get('date');
  const limit = parseInt(searchParams.get('limit') || '50');
  const query: Record<string, unknown> = {};
  if (status && status !== 'all') query.status = status;
  else if (!status && !contact) query.status = { $nin: ['Completed', 'Rejected', 'Cancelled'] };
  if (paymentMethod) query.paymentMethod = paymentMethod;
  if (contact) query.contact = contact;
  if (date) {
    const s = new Date(date); s.setHours(0,0,0,0);
    const e = new Date(date); e.setHours(23,59,59,999);
    query.timestamp = { $gte: s, $lte: e };
  }
  const orders = await Order.find(query).sort({ timestamp: -1 }).limit(limit).lean();
  return NextResponse.json(orders);
}
