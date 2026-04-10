import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Order } from '@/lib/models';

export async function POST(req: NextRequest) {
  const { orderIds } = await req.json();
  if (!Array.isArray(orderIds) || orderIds.length === 0) return NextResponse.json([]);
  await connectDB();
  const orders = await Order.find({ _id: { $in: orderIds } }).sort({ _id: -1 }).lean();
  return NextResponse.json(orders);
}
