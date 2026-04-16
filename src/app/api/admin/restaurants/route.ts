import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { MenuItem, Order, Restaurant, User } from '@/lib/models';
import { requireAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  await connectDB();

  const restaurants = await Restaurant.find().sort({ createdAt: -1 }).lean();
  const ownerIds = restaurants.map((restaurant) => restaurant.ownerId).filter(Boolean);

  const [owners, menuCounts, liveOrderCounts] = await Promise.all([
    User.find({ _id: { $in: ownerIds } }, 'name contact isVerified isTrusted').lean(),
    MenuItem.aggregate([{ $group: { _id: '$restaurantId', count: { $sum: 1 } } }]),
    Order.aggregate([
      { $match: { status: { $nin: ['Completed', 'Rejected', 'Cancelled', 'Failed'] } } },
      { $group: { _id: '$restaurantId', count: { $sum: 1 } } },
    ]),
  ]);

  const ownerMap = new Map(owners.map((owner) => [String(owner._id), owner]));
  const menuCountMap = new Map(menuCounts.map((entry) => [String(entry._id), entry.count]));
  const liveOrderCountMap = new Map(liveOrderCounts.map((entry) => [String(entry._id), entry.count]));

  const payload = restaurants.map((restaurant) => {
    const owner = ownerMap.get(String(restaurant.ownerId));
    return {
      ...restaurant,
      ownerName: owner?.name || 'Unknown Owner',
      ownerContact: owner?.contact || '',
      ownerVerified: !!owner?.isVerified,
      ownerTrusted: !!owner?.isTrusted,
      menuCount: menuCountMap.get(String(restaurant._id)) || 0,
      liveOrderCount: liveOrderCountMap.get(String(restaurant._id)) || 0,
    };
  });

  return NextResponse.json(payload);
}
