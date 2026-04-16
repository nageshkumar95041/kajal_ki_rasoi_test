import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { connectDB } from '@/lib/mongodb';
import { User, Restaurant } from '@/lib/models';
import { signToken } from '@/lib/auth';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function POST(req: NextRequest) {
  const { token } = await req.json();
  if (!token) return NextResponse.json({ success: false, message: 'Token required.' }, { status: 400 });
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: token, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    const email = payload?.email?.toLowerCase();
    const name = payload?.name;
    if (!email || !name) {
      return NextResponse.json({ success: false, message: 'Invalid Google token.' }, { status: 401 });
    }
    await connectDB();
    let user = await User.findOne({ contact: email });
    if (!user) {
      const rp = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10);
      user = await User.create({ name, contact: email, password: await bcrypt.hash(rp, 10), role: 'user', isVerified: true });
    }
    const hasRestaurant = typeof (Restaurant as any)?.exists === 'function'
      ? await (Restaurant as any).exists({ ownerId: user._id.toString() })
      : null;
    const jwtToken = signToken({ id: user._id.toString(), role: user.role });
    const res = NextResponse.json({
      success: true,
      token: jwtToken,
      user: {
        name: user.name,
        contact: user.contact,
        role: user.role,
        hasRestaurant: Boolean(hasRestaurant),
      },
    });
    res.cookies.set('authToken', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 2,
    });
    return res;
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid Google token.' }, { status: 401 });
  }
}
