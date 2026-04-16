// Rate limiting middleware for production

import { NextRequest, NextResponse } from 'next/server';

export interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
}

const requestCounts = new Map<string, { count: number; resetTime: number }>();

function applyRateLimit(req: NextRequest, options: RateLimitOptions): NextResponse | null {
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const now = Date.now();
  const record = requestCounts.get(ip);

  if (!record || now > record.resetTime) {
    requestCounts.set(ip, { count: 1, resetTime: now + options.windowMs });
    return null;
  }

  record.count++;
  if (record.count > options.maxRequests) {
    return NextResponse.json(
      { success: false, message: 'Too many requests. Please try again later.' },
      { status: 429 }
    );
  }

  return null;
}

export function rateLimit(options: RateLimitOptions): (req: NextRequest) => NextResponse | null;
export function rateLimit(req: NextRequest, options: RateLimitOptions): NextResponse | null;
export function rateLimit(arg1: NextRequest | RateLimitOptions, arg2?: RateLimitOptions) {
  if (arg2) {
    return applyRateLimit(arg1 as NextRequest, arg2);
  }
  return (req: NextRequest) => applyRateLimit(req, arg1 as RateLimitOptions);
}

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of requestCounts.entries()) {
    if (now > record.resetTime) {
      requestCounts.delete(ip);
    }
  }
}, 5 * 60 * 1000);

// Rate limit configs for different endpoints
export const RATE_LIMITS = {
  checkout: { maxRequests: 5, windowMs: 60 * 1000 }, // 5 per minute
  auth: { maxRequests: 5, windowMs: 15 * 60 * 1000 }, // 5 per 15 minutes
  api: { maxRequests: 30, windowMs: 60 * 1000 }, // 30 per minute
};
