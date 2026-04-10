import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models';
import { sendMail } from '@/lib/email';

export async function POST(req: NextRequest) {
  const { contact } = await req.json();
  await connectDB();
  const user = await User.findOne({ contact: contact.toLowerCase() });
  if (!user) return NextResponse.json({ success: false, message: 'User not found.' }, { status: 404 });
  if (user.isVerified) return NextResponse.json({ success: false, message: 'Already verified.' }, { status: 400 });
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  user.verificationOtp = await bcrypt.hash(otp, 10);
  user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();
  if (contact.includes('@')) await sendMail(contact, 'New Verification Code', `<p>Your code: <strong>${otp}</strong></p>`).catch(console.error);
  return NextResponse.json({ success: true, message: 'New code sent.' });
}
