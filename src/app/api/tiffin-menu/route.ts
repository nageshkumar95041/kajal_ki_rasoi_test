import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { TiffinItem } from '@/lib/models';

export async function GET() {
  await connectDB();
  return NextResponse.json(await TiffinItem.find().lean());
}
