import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Agent } from '@/lib/models';
import { requireAuth } from '@/lib/auth';

export async function PUT(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  if (user.role !== 'agent' && user.role !== 'admin') {
    return NextResponse.json({ success: false, message: 'Forbidden.' }, { status: 403 });
  }
  const { lat, lng } = await req.json();
  if (!lat || !lng) return NextResponse.json({ success: false, message: 'lat and lng required.' }, { status: 400 });
  await connectDB();
  await Agent.findOneAndUpdate(
    { userId: user.id },
    { $set: { 'location.coordinates': [parseFloat(lng), parseFloat(lat)] } },
    { upsert: false }
  );
  return NextResponse.json({ success: true });
}
