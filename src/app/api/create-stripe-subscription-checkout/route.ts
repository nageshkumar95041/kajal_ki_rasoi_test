import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Subscription, TempSubscription } from '@/lib/models';
import { requireAuth } from '@/lib/auth';
import { getSubscriptionQuote, parseSubscriptionStartDate, resolveSafeRedirectUrl } from '@/lib/payment';

// Lazy-loaded so jest.mock('stripe', ...) works correctly in tests
function getStripe() {
  const Stripe = require('stripe').default ?? require('stripe');
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { plan, frequency, price, customerName, contact, address, startDate, persons, couponCode, successUrl, cancelUrl } = await req.json();
  const normalizedCustomerName = typeof customerName === 'string' ? customerName.trim() : '';
  const normalizedContact = typeof contact === 'string' ? contact.trim() : '';
  const normalizedAddress = typeof address === 'string' ? address.trim() : '';
  const subscriptionQuote = getSubscriptionQuote({ plan, frequency, persons, couponCode });
  const parsedStartDate = parseSubscriptionStartDate(startDate);

  if (!normalizedCustomerName || !normalizedContact || !normalizedAddress || !subscriptionQuote || !parsedStartDate) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
  }

  await connectDB();
  const existing = await Subscription.findOne({
    userId: auth.user.id,
    status: { $in: ['Pending', 'Active'] },
  });
  if (existing) {
    return NextResponse.json(
      { error: `You already have an active ${existing.plan} subscription.` },
      { status: 409 }
    );
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'inr',
        product_data: {
          name: `Subscription: ${subscriptionQuote.plan} (${subscriptionQuote.frequencyLabel})`,
          description: `For ${subscriptionQuote.persons} Person(s).`,
        },
        unit_amount: Math.round(subscriptionQuote.finalPrice * 100),
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: resolveSafeRedirectUrl(req, successUrl, '/subscription?sub_success=true'),
    cancel_url: resolveSafeRedirectUrl(req, cancelUrl, '/subscription'),
    customer_email: normalizedContact.includes('@') ? normalizedContact : undefined,
  });
  await TempSubscription.create({
    stripeSessionId: session.id,
    userId: auth.user.id,
    customerName: normalizedCustomerName,
    contact: normalizedContact,
    address: normalizedAddress,
    plan: subscriptionQuote.plan,
    frequency: subscriptionQuote.frequency,
    persons: subscriptionQuote.persons,
    couponCode: subscriptionQuote.appliedCouponCode,
    price: subscriptionQuote.finalPrice,
    startDate: parsedStartDate,
  });
  return NextResponse.json({ id: session.id, url: session.url });
}
