import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Order, TiffinItem, SiteSettings } from '@/lib/models';
import { optionalAuth } from '@/lib/auth';
import { normalizeCartItems } from '@/lib/payment';

type EligibilityReason =
  | 'eligible'
  | 'login_required'
  | 'no_tiffin_item'
  | 'already_used';

function responsePayload(input: {
  eligible: boolean;
  reason: EligibilityReason;
  message: string;
  offerItemName?: string | null;
  offerDiscount?: number;
  isNewCustomer: boolean;
  hasTiffinInCart: boolean;
}) {
  return {
    eligible: input.eligible,
    reason: input.reason,
    message: input.message,
    offerItemName: input.offerItemName ?? null,
    offerDiscount: input.offerDiscount ?? 0,
    isNewCustomer: input.isNewCustomer,
    hasTiffinInCart: input.hasTiffinInCart,
  };
}

export async function POST(req: NextRequest) {
  const { items } = await req.json().catch(() => ({ items: null }));
  const normalizedItems = normalizeCartItems(items);

  if (!normalizedItems || normalizedItems.length === 0) {
    return NextResponse.json({ error: 'Invalid cart items.' }, { status: 400 });
  }

  await connectDB();

  // Check if admin has disabled the offer
  const offerSetting = await SiteSettings.findOne({ key: 'firstTiffinEnabled' }).lean() as unknown as { value: any } | null;
  const offerActive = offerSetting === null || offerSetting.value === null || offerSetting.value === true || offerSetting.value === 'true';
  if (!offerActive) {
    return NextResponse.json(
      responsePayload({
        eligible: false,
        reason: 'already_used',
        message: 'First Tiffin FREE offer is not currently active.',
        isNewCustomer: false,
        hasTiffinInCart: false,
      })
    );
  }
  const itemNames = normalizedItems.map((item) => item.name);
  const tiffinItems = await TiffinItem.find({ name: { $in: itemNames } });
  const tiffinPriceMap = new Map<string, number>(
    tiffinItems
      .filter((item: any) => typeof item?.name === 'string' && typeof item?.price === 'number' && item.price > 0)
      .map((item: any) => [item.name, item.price])
  );

  const firstTiffinItem = normalizedItems.find((item) => tiffinPriceMap.has(item.name));

  if (!firstTiffinItem) {
    return NextResponse.json(
      responsePayload({
        eligible: false,
        reason: 'no_tiffin_item',
        message: 'Add a tiffin item to unlock First Tiffin FREE.',
        isNewCustomer: false,
        hasTiffinInCart: false,
      })
    );
  }

  const user = optionalAuth(req);
  if (!user) {
    return NextResponse.json(
      responsePayload({
        eligible: false,
        reason: 'login_required',
        message: 'Login to unlock First Tiffin FREE.',
        offerItemName: firstTiffinItem.name,
        offerDiscount: tiffinPriceMap.get(firstTiffinItem.name) || 0,
        isNewCustomer: false,
        hasTiffinInCart: true,
      })
    );
  }

  const priorOrderCount = await Order.countDocuments({
    userId: user.id,
    status: { $ne: 'Failed' },
  });

  if (priorOrderCount > 0) {
    return NextResponse.json(
      responsePayload({
        eligible: false,
        reason: 'already_used',
        message: 'First Tiffin FREE is for first-time customers only.',
        offerItemName: firstTiffinItem.name,
        offerDiscount: tiffinPriceMap.get(firstTiffinItem.name) || 0,
        isNewCustomer: false,
        hasTiffinInCart: true,
      })
    );
  }

  const discount = tiffinPriceMap.get(firstTiffinItem.name) || 0;
  return NextResponse.json(
    responsePayload({
      eligible: true,
      reason: 'eligible',
      message: `Eligible: First "${firstTiffinItem.name}" is FREE (−₹${discount}) and will apply at checkout.`,
      offerItemName: firstTiffinItem.name,
      offerDiscount: discount,
      isNewCustomer: true,
      hasTiffinInCart: true,
    })
  );
}