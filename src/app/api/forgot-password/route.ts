import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models';
import { sendMail } from '@/lib/email';

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email?.includes('@')) return NextResponse.json({ success: false, message: 'Valid email required.' }, { status: 400 });
  await connectDB();
  const user = await User.findOne({ contact: email.toLowerCase() });
  if (!user) return NextResponse.json({ success: true, message: 'If this email exists, a reset link has been sent.' });
  const token = crypto.randomBytes(32).toString('hex');
  user.resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');
  user.resetPasswordExpires = new Date(Date.now() + 3600000);
  await user.save();
  const origin = process.env.FRONTEND_URL || 'http://localhost:3000';
  const resetUrl = `${origin}/reset-password?token=${token}`;
  try {
    await sendMail(email, 'Password Reset - Kajal Ki Rasoi',
      `<h3>Reset your password</h3><p>Click the button below to reset your password. This link expires in 1 hour.</p><a href="${resetUrl}" style="display:inline-block;padding:10px 20px;background:#E07B2D;color:#fff;border-radius:5px;text-decoration:none;font-weight:bold;">Reset Password</a><p style="margin-top:1rem;color:#888;font-size:0.9rem;">If you didn't request this, ignore this email.</p>`
    );
  } catch (err) {
    console.error('Failed to send reset email:', err);
    return NextResponse.json({ success: false, message: 'Failed to send email. Please try again later.' }, { status: 500 });
  }
  return NextResponse.json({ success: true, message: 'Reset link sent! Check your inbox (and spam folder).' });
}