import { NextResponse } from 'next/server';
export async function GET() {
  if (!process.env.GOOGLE_MAPS_API_KEY) return NextResponse.json({ success: false, message: 'Not configured.' }, { status: 500 });
  return NextResponse.json({ apiKey: process.env.GOOGLE_MAPS_API_KEY });
}
