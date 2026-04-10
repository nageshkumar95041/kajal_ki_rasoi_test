import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Order } from '@/lib/models';
import { requireAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  await connectDB();
  const customers = await Order.aggregate([
    { $group: { _id: '$contact', name: { $first: '$customerName' }, orderCount: { $sum: 1 }, totalSpent: { $sum: '$total' }, lastOrderDate: { $max: '$timestamp' } } },
    { $match: { _id: { $ne: null } } },
    { $sort: { orderCount: -1 } },
  ]);
  return NextResponse.json({ success: true, customers });
}
