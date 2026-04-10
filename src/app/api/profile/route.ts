import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { connectDB } from '@/lib/mongodb';
import { User, Order } from '@/lib/models';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await connectDB();
  const user = await User.findById(auth.user.id);
  if (!user) return NextResponse.json({ success: false, message: 'Not found.' }, { status: 404 });
  const completedCount = await Order.countDocuments({ userId: auth.user.id, status: 'Completed' });
  return NextResponse.json({ success: true, user: { name: user.name, contact: user.contact, isTrusted: user.isTrusted || completedCount > 0 } });
}

export async function PUT(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { name, contact, password } = await req.json();
  await connectDB();
  const user = await User.findById(auth.user.id);
  if (!user) return NextResponse.json({ success: false, message: 'Not found.' }, { status: 404 });
  if (contact && contact !== user.contact) {
    const exists = await User.findOne({ contact: contact.toLowerCase() });
    if (exists) return NextResponse.json({ success: false, message: 'Contact already in use.' }, { status: 400 });
    user.contact = contact.toLowerCase();
  }
  if (name) user.name = name;
  if (password) user.password = await bcrypt.hash(password, 10);
  await user.save();
  return NextResponse.json({ success: true, user: { name: user.name, contact: user.contact, role: user.role } });
}
