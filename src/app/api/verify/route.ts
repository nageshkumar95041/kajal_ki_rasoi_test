import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models';
import { signToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { contact, otp } = await req.json();
  await connectDB();
  const user = await User.findOne({ contact: contact.toLowerCase() });
  if (!user) return NextResponse.json({ success: false, message: 'User not found.' }, { status: 404 });
  if (user.isVerified) return NextResponse.json({ success: false, message: 'Already verified.' }, { status: 400 });
  if (!user.otpExpires || Date.now() > user.otpExpires) {
    return NextResponse.json({ success: false, message: 'Code expired.' }, { status: 400 });
  }
  const isValid = await bcrypt.compare(otp, user.verificationOtp);
  if (!isValid) return NextResponse.json({ success: false, message: 'Invalid code.' }, { status: 400 });
  user.isVerified = true; user.verificationOtp = undefined; user.otpExpires = undefined;
  await user.save();
  const token = signToken({ id: user._id.toString(), role: user.role });
  return NextResponse.json({ success: true, token, user: { name: user.name, contact: user.contact, role: user.role } });
}
