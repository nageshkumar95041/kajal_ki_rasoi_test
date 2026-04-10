import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { MenuItem } from '@/lib/models';
import { requireAdmin } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  await connectDB();
  const body = await req.json();
  const { name, price, description, category, imageUrl, available } = body;
  const updateData: Record<string, unknown> = { name, price, description, category, imageUrl, available };
  Object.keys(updateData).forEach(k => updateData[k] === undefined && delete updateData[k]);
  const item = await MenuItem.findByIdAndUpdate(params.id, updateData, { new: true });
  return NextResponse.json({ success: true, item });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  await connectDB();
  await MenuItem.findByIdAndDelete(params.id);
  return NextResponse.json({ success: true, message: 'Menu item deleted.' });
}
