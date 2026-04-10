import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { SiteSettings } from '@/lib/models';

export async function GET() {
  try {
    await connectDB();
    const setting = (await SiteSettings.findOne({ key: 'onlinePaymentEnabled' }).lean()) as unknown as { key: string; value: any } | null;
    console.log('[payment-settings] raw setting:', JSON.stringify(setting));
    // Handle all possible stored formats: true, "true", 1, "1"
    const val = setting?.value;
    const enabled = val === true || val === 'true' || val === 1 || val === '1';
    console.log('[payment-settings] enabled:', enabled);
    return NextResponse.json({ onlinePaymentEnabled: enabled });
  } catch (err) {
    console.error('[payment-settings] error:', err);
    return NextResponse.json({ onlinePaymentEnabled: false });
  }
}