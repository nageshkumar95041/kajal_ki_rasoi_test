import { NextRequest, NextResponse } from 'next/server';
import { requireRestaurant } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = await requireRestaurant(req);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json(auth.restaurant);
}
