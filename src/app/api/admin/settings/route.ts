import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import { SiteSettings } from '@/lib/models';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const key = req.nextUrl.searchParams.get('key');
    if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 });
    const setting = (await SiteSettings.findOne({ key }).lean()) as unknown as { key: string; value: any } | null;
    console.log('[settings GET] key:', key, 'raw:', JSON.stringify(setting));
    return NextResponse.json({ value: setting?.value ?? null });
  } catch (err) {
    console.error('[settings GET] error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    await connectDB();
    const body = await req.json();
    const { key, value } = body;
    console.log('[settings POST] saving key:', key, 'value:', value, 'type:', typeof value);

    if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 });

    const boolValue = value === true || value === 'true';

    const result = await SiteSettings.findOneAndUpdate(
      { key },
      { $set: { key, value: boolValue } },
      { upsert: true, new: true }
    );
    console.log('[settings POST] saved result:', JSON.stringify(result));
    return NextResponse.json({ success: true, key, value: boolValue });
  } catch (err) {
    console.error('[settings POST] error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}