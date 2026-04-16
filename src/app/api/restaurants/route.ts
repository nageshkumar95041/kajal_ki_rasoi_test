import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Restaurant, User } from '@/lib/models';
import { requireAuth } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';
import { validateRestaurantForm } from '@/lib/validation';

export async function GET(req: NextRequest) {
  await connectDB();
  const restaurants = await Restaurant.find({ isActive: true }).lean();
  return NextResponse.json(restaurants);
}

export async function POST(req: NextRequest) {
  // Apply rate limiting for restaurant registration (5 per 15 minutes)
  const rateLimitError = rateLimit({ maxRequests: 5, windowMs: 900000 })(req);
  if (rateLimitError) {
    return rateLimitError;
  }

  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { name, contact, address, description, imageUrl, lat, lng } = await req.json();
  
  // Validate restaurant form
  const validation = validateRestaurantForm({ name, contact, address });
  if (!validation.valid) {
    return NextResponse.json({ success: false, message: validation.error }, { status: 400 });
  }

  await connectDB();

  try {
    // Check if user already has a restaurant
    const existing = await Restaurant.findOne({ ownerId: auth.user.id });
    if (existing) {
      return NextResponse.json({ success: false, message: 'User already owns a restaurant.' }, { status: 400 });
    }
    const restaurant = await Restaurant.create({
      name,
      ownerId: auth.user.id,
      contact,
      address,
      description,
      imageUrl,
      location: { coordinates: [lng || 0, lat || 0] },
    });
    return NextResponse.json({ success: true, restaurant }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, message: 'Failed to create restaurant.' }, { status: 500 });
  }
}
