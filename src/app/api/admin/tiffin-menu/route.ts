import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { TiffinItem } from '@/lib/models';
import { requireAdmin } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  await connectDB();
  const item = await TiffinItem.create(await req.json());
  return NextResponse.json({ success: true, item }, { status: 201 });
}
