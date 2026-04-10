import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { requireAuth } from '@/lib/auth';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { sessionId } = await req.json();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.payment_status === 'paid') {
    // processSuccessfulPayment is triggered by webhook - this is a fallback
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ success: false, message: 'Payment not completed.' });
}
