import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { TiffinItem } from '@/lib/models';
import { requireAdmin } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  await connectDB();
  const item = await TiffinItem.findByIdAndUpdate(params.id, await req.json(), { new: true });
  return NextResponse.json({ success: true, item });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  await connectDB();
  await TiffinItem.findByIdAndDelete(params.id);
  return NextResponse.json({ success: true, message: 'Tiffin item deleted.' });
}
