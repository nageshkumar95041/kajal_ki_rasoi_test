import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { MenuItem } from '@/lib/models';
import { requireRestaurant } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = await requireRestaurant(req);
  if (auth instanceof NextResponse) return auth;
  await connectDB();
  const menu = await MenuItem.find({ restaurantId: auth.restaurant._id }).lean();
  return NextResponse.json(menu);
}

export async function POST(req: NextRequest) {
  const auth = await requireRestaurant(req);
  if (auth instanceof NextResponse) return auth;
  await connectDB();
  const { name, price, description, category, imageUrl, available } = await req.json();
  if (!name || typeof price !== 'number') {
    return NextResponse.json({ success: false, message: 'Name and price are required.' }, { status: 400 });
  }
  try {
    const item = await MenuItem.create({
      restaurantId: auth.restaurant._id,
      name,
      price,
      description,
      category,
      imageUrl,
      available,
    });
    return NextResponse.json({ success: true, item }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, message: 'Failed to create menu item.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireRestaurant(req);
  if (auth instanceof NextResponse) return auth;
  await connectDB();
  const { itemId, ...updates } = await req.json();
  if (!itemId) {
    return NextResponse.json({ success: false, message: 'Item ID is required.' }, { status: 400 });
  }
  try {
    const item = await MenuItem.findOneAndUpdate(
      { _id: itemId, restaurantId: auth.restaurant._id },
      updates,
      { new: true }
    );
    if (!item) {
      return NextResponse.json({ success: false, message: 'Menu item not found.' }, { status: 404 });
    }
    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, message: 'Failed to update menu item.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireRestaurant(req);
  if (auth instanceof NextResponse) return auth;
  await connectDB();
  const { searchParams } = new URL(req.url);
  const itemId = searchParams.get('itemId');
  if (!itemId) {
    return NextResponse.json({ success: false, message: 'Item ID is required.' }, { status: 400 });
  }
  try {
    const item = await MenuItem.findOneAndDelete({ _id: itemId, restaurantId: auth.restaurant._id });
    if (!item) {
      return NextResponse.json({ success: false, message: 'Menu item not found.' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, message: 'Failed to delete menu item.' }, { status: 500 });
  }
}