import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models';
import { sendMail } from '@/lib/email';

export async function POST(req: NextRequest) {
  const { name, contact, password } = await req.json();
  if (!name || !contact || !password) {
    return NextResponse.json({ success: false, message: 'All fields are required.' }, { status: 400 });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRegex = /^(?:\+91[\-\s]?)?\d{10}$/;
  if (!emailRegex.test(contact) && !phoneRegex.test(contact)) {
    return NextResponse.json({ success: false, message: 'Valid email or 10-digit phone required.' }, { status: 400 });
  }
  await connectDB();
  let user = await User.findOne({ contact: contact.toLowerCase() });
  if (user?.isVerified) {
    return NextResponse.json({ success: false, message: 'Account already exists.' }, { status: 400 });
  }
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedPassword = await bcrypt.hash(password, 10);
  const hashedOtp = await bcrypt.hash(otp, 10);
  if (!user) user = new User({ contact: contact.toLowerCase(), role: 'user' });
  user.name = name; user.password = hashedPassword;
  user.isVerified = false; user.verificationOtp = hashedOtp;
  user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();

  if (contact.includes('@')) {
    try {
      await sendMail(contact, 'Verify your Kajal Ki Rasoi Account',
        `<h3>Welcome ${name}!</h3><p>Your code: <strong style="font-size:1.5rem">${otp}</strong></p><p>Expires in 10 min.</p>`
      );
    } catch (err) {
      // Email failed — delete the saved user so they can retry cleanly
      await user.deleteOne();
      console.error('[register] Email send failed:', err);
      return NextResponse.json({ success: false, message: 'Failed to send verification code. Please check your email address and try again.' }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, message: 'Verification code sent.', requiresVerification: true }, { status: 201 });
}