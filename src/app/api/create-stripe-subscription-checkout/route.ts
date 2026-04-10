import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { connectDB } from '@/lib/mongodb';
import { TempSubscription } from '@/lib/models';
import { optionalAuth } from '@/lib/auth';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const user = optionalAuth(req);
  const { plan, frequency, price, customerName, contact, address, startDate, persons, couponCode, successUrl, cancelUrl } = await req.json();
  if (!plan || !customerName || !address || !startDate || !price) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
  }
  const origin = req.headers.get('origin') || process.env.FRONTEND_URL || 'http://localhost:3000';
  const freqText = frequency === 7 && plan.includes('Trial') ? '7-Day Trial' : `${frequency} Days/Week`;
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{ price_data: { currency: 'inr', product_data: { name: `Subscription: ${plan} (${freqText})`, description: `For ${persons || 1} Person(s).` }, unit_amount: Math.round(price * 100) }, quantity: 1 }],
    mode: 'payment',
    success_url: successUrl?.startsWith('http') ? successUrl : `${origin}/subscription?sub_success=true`,
    cancel_url: cancelUrl?.startsWith('http') ? cancelUrl : `${origin}/subscription`,
    customer_email: contact?.includes('@') ? contact : undefined,
  });
  await connectDB();
  await TempSubscription.create({ stripeSessionId: session.id, userId: user?.id || null, customerName, contact, address, plan, frequency, persons, couponCode, price, startDate: new Date(startDate) });
  return NextResponse.json({ id: session.id, url: session.url });
}
