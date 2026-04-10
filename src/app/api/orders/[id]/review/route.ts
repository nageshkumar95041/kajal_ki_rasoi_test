import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Order } from '@/lib/models';
import { requireAuth } from '@/lib/auth';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { rating, review } = await req.json();
  const numRating = Number(rating);
  if (isNaN(numRating) || numRating < 1 || numRating > 5) {
    return NextResponse.json({ success: false, message: 'Rating must be 1-5.' }, { status: 400 });
  }
  await connectDB();
  const result = await Order.updateOne(
    { _id: params.id, userId: auth.user.id },
    { $set: { rating: numRating, review } }
  );
  if (result.matchedCount === 0) return NextResponse.json({ success: false, message: 'Order not found.' }, { status: 404 });
  return NextResponse.json({ success: true, message: 'Thank you for your feedback!' });
}
