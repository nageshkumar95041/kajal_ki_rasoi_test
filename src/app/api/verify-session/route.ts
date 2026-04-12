import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

// Lazy-loaded so jest.mock('stripe', ...) works correctly in tests
function getStripe() {
  const Stripe = require('stripe').default ?? require('stripe');
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { sessionId } = await req.json();
  if (typeof sessionId !== 'string' || !sessionId.trim()) {
    return NextResponse.json({ success: false, message: 'Session ID is required.' }, { status: 400 });
  }
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.payment_status === 'paid') {
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ success: false, message: 'Payment not completed.' });
}
