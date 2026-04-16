import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { MenuItem } from '@/lib/models';
import { requireAdmin } from '@/lib/auth';

let menuCache: Record<string, { data: unknown[] | null; lastFetch: number }> = {};
const CACHE_TTL = 5 * 60 * 1000;

export async function GET(req: NextRequest) {
  await connectDB();
  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get('restaurantId');
  const now = Date.now();
  const cacheKey = restaurantId || 'all';
  if (!menuCache[cacheKey] || now - menuCache[cacheKey].lastFetch > CACHE_TTL) {
    const query = restaurantId ? { restaurantId, available: true } : { available: true };
    const menu = await MenuItem.find(query).lean();
    menuCache[cacheKey] = { data: menu, lastFetch: now };
  }
  return NextResponse.json(menuCache[cacheKey].data);
}

export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  await connectDB();
  const { restaurantId, name, price, description, category, imageUrl, available } = await req.json();
  if (!restaurantId || !name || typeof price !== 'number') {
    return NextResponse.json({ success: false, message: 'Restaurant ID, valid name and price are required.' }, { status: 400 });
  }
  try {
    const item = await MenuItem.create({ restaurantId, name, price, description, category, imageUrl, available });
    // Invalidate cache
    Object.keys(menuCache).forEach(key => {
      if (key === 'all' || key === restaurantId) delete menuCache[key];
    });
    return NextResponse.json({ success: true, item }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, message: 'Failed to create item. Ensure name is unique for this restaurant.' }, { status: 500 });
  }
}
