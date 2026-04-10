import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models';

export async function POST(req: NextRequest) {
  const { token, newPassword } = await req.json();
  if (!token || !newPassword) return NextResponse.json({ success: false, message: 'Invalid request.' }, { status: 400 });
  await connectDB();
  const hashed = crypto.createHash('sha256').update(token).digest('hex');
  const user = await User.findOne({ resetPasswordToken: hashed, resetPasswordExpires: { $gt: Date.now() } });
  if (!user) return NextResponse.json({ success: false, message: 'Token invalid or expired.' }, { status: 400 });
  user.password = await bcrypt.hash(newPassword, 10);
  user.resetPasswordToken = undefined; user.resetPasswordExpires = undefined;
  await user.save();
  return NextResponse.json({ success: true, message: 'Password reset successfully.' });
}
