import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Subscription } from '@/lib/models';
import { optionalAuth } from '@/lib/auth';
import { getSubscriptionQuote, parseSubscriptionStartDate } from '@/lib/payment';

export async function POST(req: NextRequest) {
  const user = optionalAuth(req);
  const { plan, frequency, price, customerName, contact, address, startDate, persons, couponCode } = await req.json();
  const normalizedCustomerName = typeof customerName === 'string' ? customerName.trim() : '';
  const normalizedContact = typeof contact === 'string' ? contact.trim() : '';
  const normalizedAddress = typeof address === 'string' ? address.trim() : '';
  const subscriptionQuote = getSubscriptionQuote({ plan, frequency, persons, couponCode });
  const parsedStartDate = parseSubscriptionStartDate(startDate);

  if (!normalizedCustomerName || !normalizedContact || !normalizedAddress || !parsedStartDate || !subscriptionQuote) {
    return NextResponse.json({ success: false, message: 'All fields required.' }, { status: 400 });
  }

  await connectDB();

  // Block duplicate active subscriptions for logged-in users
  if (user?.id) {
    const existing = await Subscription.findOne({
      userId: user.id,
      status: { $in: ['Pending', 'Active'] },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, message: `You already have an active ${existing.plan} subscription. Please cancel it before subscribing again.` },
        { status: 409 }
      );
    }
  }

  await Subscription.create({
    userId: user?.id || null,
    customerName: normalizedCustomerName,
    contact: normalizedContact,
    address: normalizedAddress,
    plan: subscriptionQuote.plan,
    frequency: subscriptionQuote.frequency,
    price: subscriptionQuote.finalPrice,
    persons: subscriptionQuote.persons,
    couponCode: subscriptionQuote.appliedCouponCode,
    startDate: parsedStartDate,
  });

  return NextResponse.json({ success: true, message: 'Subscription requested! Our team will contact you shortly.' }, { status: 201 });
}
