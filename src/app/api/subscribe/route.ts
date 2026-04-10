import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Subscription } from '@/lib/models';
import { optionalAuth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const user = optionalAuth(req);
  const { plan, frequency, price, customerName, contact, address, startDate, persons, couponCode } = await req.json();

  if (!plan || !customerName || !contact || !address || !startDate) {
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
    customerName, contact, address, plan, frequency, price,
    persons: persons || 1, couponCode,
    startDate: new Date(startDate),
  });

  return NextResponse.json({ success: true, message: 'Subscription requested! Our team will contact you shortly.' }, { status: 201 });
}