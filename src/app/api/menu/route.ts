import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { MenuItem } from '@/lib/models';
import { requireAdmin } from '@/lib/auth';

let menuCache: { data: unknown[] | null; lastFetch: number } = { data: null, lastFetch: 0 };
const CACHE_TTL = 5 * 60 * 1000;

export async function GET() {
  await connectDB();
  const now = Date.now();
  if (menuCache.data && now - menuCache.lastFetch < CACHE_TTL) {
    return NextResponse.json(menuCache.data);
  }
  const menu = await MenuItem.find().lean();
  menuCache = { data: menu, lastFetch: now };
  return NextResponse.json(menu);
}

export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  await connectDB();
  const { name, price, description, category, imageUrl, available } = await req.json();
  if (!name || typeof price !== 'number') {
    return NextResponse.json({ success: false, message: 'A valid name and price are required.' }, { status: 400 });
  }
  try {
    const item = await MenuItem.create({ name, price, description, category, imageUrl, available });
    menuCache.data = null;
    return NextResponse.json({ success: true, item }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, message: 'Failed to create item. Ensure name is unique.' }, { status: 500 });
  }
}
