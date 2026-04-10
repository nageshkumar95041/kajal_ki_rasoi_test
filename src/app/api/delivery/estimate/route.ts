import { NextRequest, NextResponse } from 'next/server';
import { BORZO_API_BASE_URL, RESTAURANT_LAT, RESTAURANT_LNG, RESTAURANT_ADDRESS } from '@/lib/borzo';

export async function POST(req: NextRequest) {
  const BORZO_API_KEY = process.env.BORZO_API_KEY;
  if (!BORZO_API_KEY) return NextResponse.json({ success: false, error: 'Delivery service unavailable.' }, { status: 503 });
  const { customerLat, customerLng, customerAddress } = await req.json();
  if (!customerLat || !customerLng || !customerAddress) return NextResponse.json({ success: false, error: 'Location required.' }, { status: 400 });
  const payload = { matter: 'Food Delivery', vehicle_type_id: 8, points: [{ address: RESTAURANT_ADDRESS, latitude: RESTAURANT_LAT, longitude: RESTAURANT_LNG }, { address: customerAddress, latitude: parseFloat(customerLat), longitude: parseFloat(customerLng) }] };
  const res = await fetch(`${BORZO_API_BASE_URL}/calculate-order`, { method: 'POST', headers: { 'X-DV-Auth-Token': BORZO_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await res.json();
  if (res.ok && data.is_successful) return NextResponse.json({ success: true, deliveryFee: data.order.payment_amount, estimatedTime: '25-40 min' });
  return NextResponse.json({ success: false, error: data.message || 'Could not estimate.' }, { status: 400 });
}
