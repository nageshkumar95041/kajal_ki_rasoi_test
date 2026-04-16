import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { MenuItem, Order, Restaurant } from '@/lib/models';
import { requireAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  await connectDB();

  const now = new Date();

  // Today: midnight to now
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  // This calendar week: Monday 00:00 to now
  const startOfWeek = new Date(now);
  const day = startOfWeek.getDay(); // 0=Sun, 1=Mon...
  const diffToMonday = (day === 0 ? -6 : 1 - day); // go back to Monday
  startOfWeek.setDate(startOfWeek.getDate() + diffToMonday);
  startOfWeek.setHours(0, 0, 0, 0);

  // This month: 1st of current month 00:00
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [revenueStats, orderCounts, topItems, restaurantCounts, menuCoverage, liveRestaurantCounts, topRestaurants] = await Promise.all([
    // Revenue: only Completed orders
    Order.aggregate([
      { $match: { status: 'Completed' } },
      { $facet: {
        today: [
          { $match: { timestamp: { $gte: startOfToday } } },
          { $group: { _id: null, total: { $sum: '$total' } } },
        ],
        week: [
          { $match: { timestamp: { $gte: startOfWeek } } },
          { $group: { _id: null, total: { $sum: '$total' } } },
        ],
        month: [
          { $match: { timestamp: { $gte: startOfMonth } } },
          { $group: { _id: null, total: { $sum: '$total' } } },
        ],
      }},
    ]),

    // Order counts by status — all statuses
    Order.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),

    // Top selling items — use $ifNull so items without quantity default to 1
    Order.aggregate([
      { $match: { status: { $in: ['Preparing', 'Out for Delivery', 'Completed'] } } },
      { $unwind: '$items' },
      { $group: {
        _id: '$items.name',
        count: { $sum: { $ifNull: ['$items.quantity', 1] } },
      }},
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),

    // Restaurant network stats
    Restaurant.aggregate([
      {
        $facet: {
          total: [{ $count: 'count' }],
          active: [{ $match: { isActive: true } }, { $count: 'count' }],
          open: [{ $match: { isOpen: true } }, { $count: 'count' }],
        },
      },
    ]),

    // Restaurants that have at least one menu item
    MenuItem.aggregate([
      { $group: { _id: '$restaurantId' } },
      { $count: 'count' },
    ]),

    // Restaurants with live orders
    Order.aggregate([
      { $match: { status: { $in: ['Pending', 'Preparing', 'Out for Delivery'] }, restaurantId: { $ne: null } } },
      { $group: { _id: '$restaurantId' } },
      { $count: 'count' },
    ]),

    // Top restaurants by completed revenue
    Order.aggregate([
      { $match: { status: 'Completed', restaurantId: { $ne: null } } },
      {
        $group: {
          _id: '$restaurantId',
          revenue: { $sum: '$total' },
          completedOrders: { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'restaurants',
          localField: '_id',
          foreignField: '_id',
          as: 'restaurant',
        },
      },
      { $unwind: { path: '$restaurant', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          restaurantId: '$_id',
          name: { $ifNull: ['$restaurant.name', 'Unknown Restaurant'] },
          revenue: 1,
          completedOrders: 1,
          isActive: '$restaurant.isActive',
          isOpen: '$restaurant.isOpen',
        },
      },
    ]),
  ]);

  const revenue = {
    today: revenueStats[0]?.today[0]?.total || 0,
    week:  revenueStats[0]?.week[0]?.total  || 0,
    month: revenueStats[0]?.month[0]?.total || 0,
  };

  // Meaningful orders = exclude Cancelled, Rejected, Failed
  const meaningfulStatuses = ['Pending', 'Preparing', 'Out for Delivery', 'Completed'];
  const meaningfulTotal = orderCounts
    .filter((o: any) => meaningfulStatuses.includes(o._id))
    .reduce((s: number, o: any) => s + o.count, 0);

  const pendingCount = orderCounts.find((o: any) => o._id === 'Pending')?.count || 0;
  const restaurantStats = {
    total: restaurantCounts[0]?.total[0]?.count || 0,
    active: restaurantCounts[0]?.active[0]?.count || 0,
    open: restaurantCounts[0]?.open[0]?.count || 0,
    withMenu: menuCoverage[0]?.count || 0,
    withLiveOrders: liveRestaurantCounts[0]?.count || 0,
  };

  return NextResponse.json({
    success: true,
    revenue,
    orderCounts,
    topItems,
    restaurantStats,
    topRestaurants,
    meaningfulTotal,
    pendingCount,
  });
}
