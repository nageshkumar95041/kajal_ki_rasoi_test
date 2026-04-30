import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Restaurant } from '@/lib/models';

const SECRET_KEY = process.env.JWT_SECRET!;

export interface JWTPayload {
  id: string;
  role: string;
  iat?: number;
  exp?: number;
}

export function signToken(payload: { id: string; role: string }): string {
  return jwt.sign(payload, SECRET_KEY, { expiresIn: '2h' });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, SECRET_KEY) as JWTPayload;
  } catch {
    return null;
  }
}

export function getTokenFromRequest(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  return parts.length === 2 && parts[0] === 'Bearer' ? parts[1] : null;
}

// Middleware helpers — use these inside route handlers
export function requireAuth(req: NextRequest): { user: JWTPayload } | NextResponse {
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ success: false, message: 'Access denied. No token provided.' }, { status: 401 });
  const user = verifyToken(token);
  if (!user) return NextResponse.json({ success: false, message: 'Invalid or expired token.' }, { status: 403 });
  return { user };
}

export function requireAdmin(req: NextRequest): { user: JWTPayload } | NextResponse {
  const result = requireAuth(req);
  if (result instanceof NextResponse) return result;
  if (result.user.role !== 'admin') {
    return NextResponse.json({ success: false, message: 'Forbidden. Admins only.' }, { status: 403 });
  }
  return result;
}

export async function requireRestaurant(req: NextRequest): Promise<{ user: JWTPayload; restaurant: any } | NextResponse> {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  await connectDB();
  const restaurant = await Restaurant.findOne({ ownerId: auth.user.id }).lean();
  if (!restaurant) {
    return NextResponse.json({ success: false, message: 'Restaurant not found for this user.' }, { status: 404 });
  }

  return { user: auth.user, restaurant };
}

export function optionalAuth(req: NextRequest): JWTPayload | null {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  return verifyToken(token);
}
