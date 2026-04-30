import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Restaurant } from '@/lib/models';
import { requireRestaurant } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = await requireRestaurant(req);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json(auth.restaurant);
}

export async function PATCH(req: NextRequest) {
  const auth = await requireRestaurant(req);
  if (auth instanceof NextResponse) return auth;
  await connectDB();
  const { isOpen } = await req.json();
  if (typeof isOpen !== 'boolean') {
    return NextResponse.json({ success: false, message: 'isOpen must be a boolean.' }, { status: 400 });
  }
  const updated = await Restaurant.findByIdAndUpdate(
    auth.restaurant._id,
    { isOpen },
    { new: true }
  ).lean();
  return NextResponse.json({ success: true, restaurant: updated });
}
