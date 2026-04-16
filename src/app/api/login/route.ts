import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/mongodb';
import { User, Restaurant } from '@/lib/models';
import { signToken } from '@/lib/auth';
import { sendMail } from '@/lib/email';
import { rateLimit } from '@/lib/rateLimit';
import { validateEmail, validatePhone } from '@/lib/validation';

export async function POST(req: NextRequest) {
  // Apply rate limiting for login (5 per 15 minutes)
  const rateLimitError = rateLimit({ maxRequests: 5, windowMs: 900000 })(req);
  if (rateLimitError) {
    return rateLimitError;
  }

  const { contact, password } = await req.json();
  if (!contact || !password) {
    return NextResponse.json({ success: false, message: 'Contact and password required.' }, { status: 400 });
  }
  
  // Validate contact format
  const isEmail = validateEmail(contact).valid;
  const isPhone = validatePhone(contact).valid;
  if (!isEmail && !isPhone) {
    return NextResponse.json({ success: false, message: 'Valid email or phone number required.' }, { status: 400 });
  }

  await connectDB();
  const user = await User.findOne({ contact: contact.toLowerCase() });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return NextResponse.json({ success: false, message: 'Invalid credentials.' }, { status: 401 });
  }
  if (!user.isVerified) {
    // Agents are verified by admins — if an agent account is unverified, show a clear message
    if (user.role === 'agent') {
      return NextResponse.json({ success: false, message: 'Your agent account is not yet activated. Please contact admin.' }, { status: 403 });
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.verificationOtp = await bcrypt.hash(otp, 10);
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();
    if (user.contact.includes('@')) {
      await sendMail(user.contact, 'Verify your Kajal Ki Rasoi Account',
        `<h3>Welcome back!</h3><p>Your code: <strong>${otp}</strong></p>`).catch(console.error);
    }
    return NextResponse.json({ success: false, message: 'Please verify your account.', requiresVerification: true }, { status: 403 });
  }
  const token = signToken({ id: user._id.toString(), role: user.role });
  const hasRestaurant = await Restaurant.exists({ ownerId: user._id.toString() });
  const res = NextResponse.json({
    success: true,
    token,
    user: {
      name: user.name,
      contact: user.contact,
      role: user.role,
      hasRestaurant: Boolean(hasRestaurant),
    },
  });
  res.cookies.set('authToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 2, // 2 hours — matches JWT expiry
  });
  return res;
}
