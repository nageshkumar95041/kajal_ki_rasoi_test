import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Restaurant } from '@/lib/models';
import { requireAdmin } from '@/lib/auth';

const ALLOWED_FIELDS = ['name', 'contact', 'address', 'description', 'imageUrl', 'isActive', 'isOpen', 'estimatedDeliveryTime'] as const;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  await connectDB();

  const body = await req.json();
  const updates: Record<string, unknown> = {};

  for (const field of ALLOWED_FIELDS) {
    if (body[field] !== undefined) updates[field] = body[field];
  }

  if (updates.estimatedDeliveryTime !== undefined) {
    const eta = Number(updates.estimatedDeliveryTime);
    if (Number.isNaN(eta) || eta <= 0) {
      return NextResponse.json({ success: false, message: 'Estimated delivery time must be a positive number.' }, { status: 400 });
    }
    updates.estimatedDeliveryTime = eta;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: false, message: 'No valid restaurant updates were provided.' }, { status: 400 });
  }

  const restaurant = await Restaurant.findByIdAndUpdate(params.id, updates, { new: true }).lean();
  if (!restaurant) {
    return NextResponse.json({ success: false, message: 'Restaurant not found.' }, { status: 404 });
  }

  return NextResponse.json({ success: true, restaurant });
}
