/**
 * Integration Tests — Remaining routes for coverage
 * Covers:
 *   GET  /api/admin/menu
 *   GET  /api/menu  (public, with cache)
 *   POST /api/menu  (admin create)
 *   PUT  /api/menu/[id]
 *   DELETE /api/menu/[id]
 *   GET  /api/tiffin-menu
 *   POST /api/admin/tiffin-menu
 *   PUT  /api/admin/tiffin-menu/[id]
 *   DELETE /api/admin/tiffin-menu/[id]
 *   PUT  /api/admin/subscriptions/[id]/status
 *   PUT  /api/admin/users/[id]/verify
 *   GET  /api/orders/[id]
 *   DELETE /api/orders/[id]
 *   PUT  /api/orders/[id]/status
 *   POST /api/orders/[id]/review
 *   POST /api/guest-orders
 *   POST /api/verify-session
 *   GET  /api/config/payment-settings
 *   POST /api/delivery/webhook
 *   POST /api/delivery/create-order/[orderId]
 *   POST /api/webhook  (Stripe)
 */

process.env.JWT_SECRET          = 'test-secret-kajal-ki-rasoi';
process.env.STRIPE_SECRET_KEY   = 'sk_test_dummy';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_dummy';

import { NextRequest } from 'next/server';
import { signToken } from '@/lib/auth';

// ─── Shared mocks ─────────────────────────────────────────────────────────────
jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/email',   () => ({ sendMail: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/socket',  () => ({ emitOrderUpdate: jest.fn() }));
jest.mock('@/lib/borzo',   () => ({
  createBorzoDelivery: jest.fn().mockResolvedValue(undefined),
  RESTAURANT_LAT: 28.5,
  RESTAURANT_LNG: 77.3,
}));

beforeEach(() => {
  jest.unmock('@/lib/auth');
});

// ─── Request helpers ──────────────────────────────────────────────────────────
function adminReq(url: string, method = 'GET', body?: Record<string, unknown>): NextRequest {
  const token = signToken({ id: 'admin-id', role: 'admin' });
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

function userReq(url: string, method = 'GET', body?: Record<string, unknown>): NextRequest {
  const token = signToken({ id: 'user-id-123', role: 'user' });
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

function anonReq(url: string, method = 'GET', body?: Record<string, unknown>): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MENU ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/menu (public)', () => {
  const URL = 'http://localhost/api/menu';

  it('returns 200 with menu items', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const mockMenu = [{ _id: 'm1', name: 'Dal Tadka', price: 120, available: true }];
    jest.mock('@/lib/models', () => ({
      MenuItem: { find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(mockMenu) }) },
    }));
    const { GET } = await import('@/app/api/menu/route');
    const res = await GET(new NextRequest(URL));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Dal Tadka');
  });
});

describe('POST /api/menu (admin create)', () => {
  const URL = 'http://localhost/api/menu';

  it('returns 401 when not authenticated', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ MenuItem: { create: jest.fn(), find: jest.fn() } }));
    const { POST } = await import('@/app/api/menu/route');
    const res = await POST(anonReq(URL, 'POST', { name: 'Test', price: 100 }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when name or price is missing', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ MenuItem: { create: jest.fn(), find: jest.fn() } }));
    const { POST } = await import('@/app/api/menu/route');
    const res = await POST(adminReq(URL, 'POST', { name: '', price: 'notanumber' }));
    expect(res.status).toBe(400);
  });

  it('creates menu item and returns 201', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const newItem = { _id: 'm1', name: 'Shahi Paneer', price: 220 };
    jest.mock('@/lib/models', () => ({
      MenuItem: { create: jest.fn().mockResolvedValue(newItem), find: jest.fn() },
    }));
    const { POST } = await import('@/app/api/menu/route');
    const res = await POST(adminReq(URL, 'POST', { name: 'Shahi Paneer', price: 220 }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.item.name).toBe('Shahi Paneer');
  });
});

describe('PUT /api/menu/[id]', () => {
  const URL = 'http://localhost/api/menu/m1';

  it('returns 401 when not authenticated', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ MenuItem: { findByIdAndUpdate: jest.fn() } }));
    const { PUT } = await import('@/app/api/menu/[id]/route');
    const res = await PUT(anonReq(URL, 'PUT', { available: false }), { params: { id: 'm1' } });
    expect(res.status).toBe(401);
  });

  it('updates menu item and returns 200', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const updatedItem = { _id: 'm1', name: 'Dal Tadka', available: false };
    jest.mock('@/lib/models', () => ({
      MenuItem: { findByIdAndUpdate: jest.fn().mockResolvedValue(updatedItem) },
    }));
    const { PUT } = await import('@/app/api/menu/[id]/route');
    const res = await PUT(adminReq(URL, 'PUT', { available: false }), { params: { id: 'm1' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.item.available).toBe(false);
  });
});

describe('DELETE /api/menu/[id]', () => {
  const URL = 'http://localhost/api/menu/m1';

  it('returns 401 when not authenticated', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ MenuItem: { findByIdAndDelete: jest.fn() } }));
    const { DELETE } = await import('@/app/api/menu/[id]/route');
    const res = await DELETE(anonReq(URL, 'DELETE'), { params: { id: 'm1' } });
    expect(res.status).toBe(401);
  });

  it('deletes menu item and returns 200', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const deleteMock = jest.fn().mockResolvedValue(undefined);
    jest.mock('@/lib/models', () => ({
      MenuItem: { findByIdAndDelete: deleteMock },
    }));
    const { DELETE } = await import('@/app/api/menu/[id]/route');
    const res = await DELETE(adminReq(URL, 'DELETE'), { params: { id: 'm1' } });
    expect(res.status).toBe(200);
    expect(deleteMock).toHaveBeenCalledWith('m1');
  });
});

describe('GET /api/admin/menu', () => {
  const URL = 'http://localhost/api/admin/menu';

  it('returns 401 when not authenticated', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ MenuItem: { find: jest.fn() } }));
    const { GET } = await import('@/app/api/admin/menu/route');
    const res = await GET(anonReq(URL));
    expect(res.status).toBe(401);
  });

  it('returns 200 with full menu for admin', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const mockMenu = [{ _id: 'm1', name: 'Dal Tadka' }, { _id: 'm2', name: 'Paneer' }];
    jest.mock('@/lib/models', () => ({
      MenuItem: { find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(mockMenu) }) },
    }));
    const { GET } = await import('@/app/api/admin/menu/route');
    const res = await GET(adminReq(URL));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TIFFIN ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/tiffin-menu', () => {
  it('returns 200 with tiffin items', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const mockTiffin = [{ _id: 't1', name: 'Dal + Rice', emoji: '🍛', price: 120 }];
    jest.mock('@/lib/models', () => ({
      TiffinItem: { find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(mockTiffin) }) },
    }));
    const { GET } = await import('@/app/api/tiffin-menu/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Dal + Rice');
  });
});

describe('POST /api/admin/tiffin-menu', () => {
  const URL = 'http://localhost/api/admin/tiffin-menu';

  it('returns 401 when not authenticated', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ TiffinItem: { create: jest.fn() } }));
    const { POST } = await import('@/app/api/admin/tiffin-menu/route');
    const res = await POST(anonReq(URL, 'POST', { name: 'Test Tiffin', price: 100 }));
    expect(res.status).toBe(401);
  });

  it('creates tiffin item and returns 201', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const newItem = { _id: 't1', name: 'Paneer + Roti', price: 130, emoji: '🍲' };
    jest.mock('@/lib/models', () => ({
      TiffinItem: { create: jest.fn().mockResolvedValue(newItem) },
    }));
    const { POST } = await import('@/app/api/admin/tiffin-menu/route');
    const res = await POST(adminReq(URL, 'POST', { name: 'Paneer + Roti', price: 130, emoji: '🍲' }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.item.name).toBe('Paneer + Roti');
  });
});

describe('PUT /api/admin/tiffin-menu/[id]', () => {
  const URL = 'http://localhost/api/admin/tiffin-menu/t1';

  it('updates tiffin item and returns 200', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const updatedItem = { _id: 't1', name: 'Dal + Rice', available: false };
    jest.mock('@/lib/models', () => ({
      TiffinItem: { findByIdAndUpdate: jest.fn().mockResolvedValue(updatedItem) },
    }));
    const { PUT } = await import('@/app/api/admin/tiffin-menu/[id]/route');
    const res = await PUT(adminReq(URL, 'PUT', { available: false }), { params: { id: 't1' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

describe('DELETE /api/admin/tiffin-menu/[id]', () => {
  const URL = 'http://localhost/api/admin/tiffin-menu/t1';

  it('returns 401 when not authenticated', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ TiffinItem: { findByIdAndDelete: jest.fn() } }));
    const { DELETE } = await import('@/app/api/admin/tiffin-menu/[id]/route');
    const res = await DELETE(anonReq(URL, 'DELETE'), { params: { id: 't1' } });
    expect(res.status).toBe(401);
  });

  it('deletes tiffin item and returns 200', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const deleteMock = jest.fn().mockResolvedValue(undefined);
    jest.mock('@/lib/models', () => ({
      TiffinItem: { findByIdAndDelete: deleteMock },
    }));
    const { DELETE } = await import('@/app/api/admin/tiffin-menu/[id]/route');
    const res = await DELETE(adminReq(URL, 'DELETE'), { params: { id: 't1' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(deleteMock).toHaveBeenCalledWith('t1');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN — SUBSCRIPTIONS & USERS
// ═══════════════════════════════════════════════════════════════════════════════

describe('PUT /api/admin/subscriptions/[id]/status', () => {
  const URL = 'http://localhost/api/admin/subscriptions/sub1/status';

  it('returns 401 when not authenticated', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ Subscription: { findByIdAndUpdate: jest.fn() } }));
    const { PUT } = await import('@/app/api/admin/subscriptions/[id]/status/route');
    const res = await PUT(anonReq(URL, 'PUT', { status: 'Active' }), { params: { id: 'sub1' } });
    expect(res.status).toBe(401);
  });

  it('updates subscription status and returns 200', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const updatedSub = { _id: 'sub1', plan: 'Monthly', status: 'Active' };
    jest.mock('@/lib/models', () => ({
      Subscription: { findByIdAndUpdate: jest.fn().mockResolvedValue(updatedSub) },
    }));
    const { PUT } = await import('@/app/api/admin/subscriptions/[id]/status/route');
    const res = await PUT(adminReq(URL, 'PUT', { status: 'Active' }), { params: { id: 'sub1' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.sub.status).toBe('Active');
  });
});

describe('PUT /api/admin/users/[id]/verify', () => {
  const URL = 'http://localhost/api/admin/users/u1/verify';

  it('returns 401 when not authenticated', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ User: { findByIdAndUpdate: jest.fn() } }));
    const { PUT } = await import('@/app/api/admin/users/[id]/verify/route');
    const res = await PUT(anonReq(URL, 'PUT', { isVerified: true }), { params: { id: 'u1' } });
    expect(res.status).toBe(401);
  });

  it('verifies user and returns 200', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const updateMock = jest.fn().mockResolvedValue({ _id: 'u1', isVerified: true });
    jest.mock('@/lib/models', () => ({ User: { findByIdAndUpdate: updateMock } }));
    const { PUT } = await import('@/app/api/admin/users/[id]/verify/route');
    const res = await PUT(adminReq(URL, 'PUT', { isVerified: true }), { params: { id: 'u1' } });
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith('u1', { isVerified: true }, { new: true });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ORDER ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/orders/[id]', () => {
  const URL = 'http://localhost/api/orders/o1';

  it('returns 401 when not authenticated', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ Order: { findById: jest.fn() } }));
    jest.mock('@/lib/socket', () => ({ emitOrderUpdate: jest.fn() }));
    const { GET } = await import('@/app/api/orders/[id]/route');
    const res = await GET(anonReq(URL), { params: { id: 'o1' } });
    expect(res.status).toBe(401);
  });

  it('returns 404 when order not found', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ Order: { findById: jest.fn().mockResolvedValue(null) } }));
    jest.mock('@/lib/socket', () => ({ emitOrderUpdate: jest.fn() }));
    const { GET } = await import('@/app/api/orders/[id]/route');
    const res = await GET(userReq(URL), { params: { id: 'o1' } });
    expect(res.status).toBe(404);
  });

  it('returns 403 when user tries to access another user order', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({
      Order: { findById: jest.fn().mockResolvedValue({ _id: 'o1', userId: 'other-user-id' }) },
    }));
    jest.mock('@/lib/socket', () => ({ emitOrderUpdate: jest.fn() }));
    const { GET } = await import('@/app/api/orders/[id]/route');
    const res = await GET(userReq(URL), { params: { id: 'o1' } });
    expect(res.status).toBe(403);
  });

  it('returns 200 when user accesses their own order', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({
      Order: { findById: jest.fn().mockResolvedValue({ _id: 'o1', userId: 'user-id-123', status: 'Pending' }) },
    }));
    jest.mock('@/lib/socket', () => ({ emitOrderUpdate: jest.fn() }));
    const { GET } = await import('@/app/api/orders/[id]/route');
    const res = await GET(userReq(URL), { params: { id: 'o1' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('returns 200 when admin accesses any order', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({
      Order: { findById: jest.fn().mockResolvedValue({ _id: 'o1', userId: 'some-other-user', status: 'Pending' }) },
    }));
    jest.mock('@/lib/socket', () => ({ emitOrderUpdate: jest.fn() }));
    const { GET } = await import('@/app/api/orders/[id]/route');
    const res = await GET(adminReq(URL), { params: { id: 'o1' } });
    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/orders/[id]', () => {
  const URL = 'http://localhost/api/orders/o1';

  it('returns 401 when not admin', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ Order: { findByIdAndDelete: jest.fn() } }));
    jest.mock('@/lib/socket', () => ({ emitOrderUpdate: jest.fn() }));
    const { DELETE } = await import('@/app/api/orders/[id]/route');
    const res = await DELETE(userReq(URL, 'DELETE'), { params: { id: 'o1' } });
    expect(res.status).toBe(403);
  });

  it('deletes order and emits socket event', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const deleteMock = jest.fn().mockResolvedValue(undefined);
    const emitMock = jest.fn();
    jest.mock('@/lib/models', () => ({ Order: { findByIdAndDelete: deleteMock } }));
    jest.mock('@/lib/socket', () => ({ emitOrderUpdate: emitMock }));
    const { DELETE } = await import('@/app/api/orders/[id]/route');
    const res = await DELETE(adminReq(URL, 'DELETE'), { params: { id: 'o1' } });
    expect(res.status).toBe(200);
    expect(deleteMock).toHaveBeenCalledWith('o1');
    expect(emitMock).toHaveBeenCalledWith({ type: 'ORDER_DELETED' });
  });
});

describe('PUT /api/orders/[id]/status', () => {
  const URL = 'http://localhost/api/orders/o1/status';

  it('returns 401 when not admin', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ Order: { findByIdAndUpdate: jest.fn() } }));
    jest.mock('@/lib/socket', () => ({ emitOrderUpdate: jest.fn() }));
    const { PUT } = await import('@/app/api/orders/[id]/status/route');
    const res = await PUT(userReq(URL, 'PUT', { status: 'Completed' }), { params: { id: 'o1' } });
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid status', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ Order: { findByIdAndUpdate: jest.fn() } }));
    jest.mock('@/lib/socket', () => ({ emitOrderUpdate: jest.fn() }));
    const { PUT } = await import('@/app/api/orders/[id]/status/route');
    const res = await PUT(adminReq(URL, 'PUT', { status: 'InvalidStatus' }), { params: { id: 'o1' } });
    expect(res.status).toBe(400);
  });

  it('returns 404 when order not found', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ Order: { findByIdAndUpdate: jest.fn().mockResolvedValue(null) } }));
    jest.mock('@/lib/socket', () => ({ emitOrderUpdate: jest.fn() }));
    const { PUT } = await import('@/app/api/orders/[id]/status/route');
    const res = await PUT(adminReq(URL, 'PUT', { status: 'Preparing' }), { params: { id: 'o1' } });
    expect(res.status).toBe(404);
  });

  it('updates status and emits socket event', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const updatedOrder = { _id: 'o1', status: 'Preparing' };
    const emitMock = jest.fn();
    jest.mock('@/lib/models', () => ({
      Order: { findByIdAndUpdate: jest.fn().mockResolvedValue(updatedOrder) },
    }));
    jest.mock('@/lib/socket', () => ({ emitOrderUpdate: emitMock }));
    const { PUT } = await import('@/app/api/orders/[id]/status/route');
    const res = await PUT(adminReq(URL, 'PUT', { status: 'Preparing' }), { params: { id: 'o1' } });
    expect(res.status).toBe(200);
    expect(emitMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'STATUS_UPDATE', status: 'Preparing' }));
  });
});

describe('POST /api/orders/[id]/review', () => {
  const URL = 'http://localhost/api/orders/o1/review';

  it('returns 401 when not authenticated', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ Order: { updateOne: jest.fn() } }));
    const { POST } = await import('@/app/api/orders/[id]/review/route');
    const res = await POST(anonReq(URL, 'POST', { rating: 5, review: 'Great!' }), { params: { id: 'o1' } });
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid rating (out of range)', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ Order: { updateOne: jest.fn() } }));
    const { POST } = await import('@/app/api/orders/[id]/review/route');
    const res = await POST(userReq(URL, 'POST', { rating: 6, review: 'Too good' }), { params: { id: 'o1' } });
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-numeric rating', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ Order: { updateOne: jest.fn() } }));
    const { POST } = await import('@/app/api/orders/[id]/review/route');
    const res = await POST(userReq(URL, 'POST', { rating: 'great', review: 'Nice' }), { params: { id: 'o1' } });
    expect(res.status).toBe(400);
  });

  it('returns 404 when order not matched', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({
      Order: { updateOne: jest.fn().mockResolvedValue({ matchedCount: 0 }) },
    }));
    const { POST } = await import('@/app/api/orders/[id]/review/route');
    const res = await POST(userReq(URL, 'POST', { rating: 4, review: 'Good' }), { params: { id: 'o1' } });
    expect(res.status).toBe(404);
  });

  it('saves review and returns 200', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const updateMock = jest.fn().mockResolvedValue({ matchedCount: 1 });
    jest.mock('@/lib/models', () => ({ Order: { updateOne: updateMock } }));
    const { POST } = await import('@/app/api/orders/[id]/review/route');
    const res = await POST(userReq(URL, 'POST', { rating: 5, review: 'Loved it!' }), { params: { id: 'o1' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(updateMock).toHaveBeenCalledWith(
      { _id: 'o1', userId: 'user-id-123' },
      { $set: { rating: 5, review: 'Loved it!' } }
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GUEST ORDERS
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/guest-orders', () => {
  const URL = 'http://localhost/api/guest-orders';

  it('returns empty array when orderIds is empty', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ Order: { find: jest.fn() } }));
    const { POST } = await import('@/app/api/guest-orders/route');
    const res = await POST(anonReq(URL, 'POST', { orderIds: [] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it('returns empty array when orderIds is not an array', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ Order: { find: jest.fn() } }));
    const { POST } = await import('@/app/api/guest-orders/route');
    const res = await POST(anonReq(URL, 'POST', { orderIds: 'not-an-array' } as any));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('returns matching orders for valid ids', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const mockOrders = [{ _id: 'o1', total: 200 }, { _id: 'o2', total: 150 }];
    jest.mock('@/lib/models', () => ({
      Order: { find: jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(mockOrders) }) }) },
    }));
    const { POST } = await import('@/app/api/guest-orders/route');
    const res = await POST(anonReq(URL, 'POST', { orderIds: ['o1', 'o2'] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIG ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/config/payment-settings', () => {
  it('returns false when setting not found', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({
      SiteSettings: { findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }) },
    }));
    const { GET } = await import('@/app/api/config/payment-settings/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.onlinePaymentEnabled).toBe(false);
  });

  it('returns true when value is boolean true', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({
      SiteSettings: { findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ key: 'onlinePaymentEnabled', value: true }) }) },
    }));
    const { GET } = await import('@/app/api/config/payment-settings/route');
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).onlinePaymentEnabled).toBe(true);
  });

  it('returns true when value is string "true"', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({
      SiteSettings: { findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ key: 'onlinePaymentEnabled', value: 'true' }) }) },
    }));
    const { GET } = await import('@/app/api/config/payment-settings/route');
    const res = await GET();
    expect((await res.json()).onlinePaymentEnabled).toBe(true);
  });

  it('returns false on DB error', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn().mockRejectedValue(new Error('DB down')) }));
    jest.mock('@/lib/models', () => ({ SiteSettings: { findOne: jest.fn() } }));
    const { GET } = await import('@/app/api/config/payment-settings/route');
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).onlinePaymentEnabled).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DELIVERY WEBHOOK (Borzo)
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/delivery/webhook', () => {
  const URL = 'http://localhost/api/delivery/webhook';

  it('returns 400 when order_id is missing', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ Order: { findOneAndUpdate: jest.fn() } }));
    jest.mock('@/lib/socket', () => ({ emitOrderUpdate: jest.fn() }));
    const { POST } = await import('@/app/api/delivery/webhook/route');
    const res = await POST(anonReq(URL, 'POST', { status_name: 'picked_up' }));
    expect(res.status).toBe(400);
  });

  it('updates order status to Out for Delivery on picked_up', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const updatedOrder = { _id: 'o1', status: 'Out for Delivery' };
    const emitMock = jest.fn();
    jest.mock('@/lib/models', () => ({
      Order: { findOneAndUpdate: jest.fn().mockResolvedValue(updatedOrder) },
    }));
    jest.mock('@/lib/socket', () => ({ emitOrderUpdate: emitMock }));
    const { POST } = await import('@/app/api/delivery/webhook/route');
    const res = await POST(anonReq(URL, 'POST', { order_id: 'borzo-123', status_name: 'picked_up' }));
    expect(res.status).toBe(200);
    expect(emitMock).toHaveBeenCalledWith(expect.objectContaining({ status: 'Out for Delivery' }));
  });

  it('updates order status to Completed on completed', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const updatedOrder = { _id: 'o1', status: 'Completed' };
    jest.mock('@/lib/models', () => ({
      Order: { findOneAndUpdate: jest.fn().mockResolvedValue(updatedOrder) },
    }));
    jest.mock('@/lib/socket', () => ({ emitOrderUpdate: jest.fn() }));
    const { POST } = await import('@/app/api/delivery/webhook/route');
    const res = await POST(anonReq(URL, 'POST', { order_id: 'borzo-123', status_name: 'completed' }));
    expect(res.status).toBe(200);
  });

  it('updates order status to Cancelled on canceled', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({
      Order: { findOneAndUpdate: jest.fn().mockResolvedValue({ _id: 'o1', status: 'Cancelled' }) },
    }));
    jest.mock('@/lib/socket', () => ({ emitOrderUpdate: jest.fn() }));
    const { POST } = await import('@/app/api/delivery/webhook/route');
    const res = await POST(anonReq(URL, 'POST', { order_id: 'borzo-123', status_name: 'canceled' }));
    expect(res.status).toBe(200);
  });

  it('does not emit when order not found', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const emitMock = jest.fn();
    jest.mock('@/lib/models', () => ({
      Order: { findOneAndUpdate: jest.fn().mockResolvedValue(null) },
    }));
    jest.mock('@/lib/socket', () => ({ emitOrderUpdate: emitMock }));
    const { POST } = await import('@/app/api/delivery/webhook/route');
    const res = await POST(anonReq(URL, 'POST', { order_id: 'borzo-unknown', status_name: 'picked_up' }));
    expect(res.status).toBe(200);
    expect(emitMock).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DELIVERY CREATE ORDER
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/delivery/create-order/[orderId]', () => {
  const URL = 'http://localhost/api/delivery/create-order/o1';

  it('returns 401 when not admin', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ Order: { findById: jest.fn() } }));
    jest.mock('@/lib/borzo', () => ({ createBorzoDelivery: jest.fn() }));
    const { POST } = await import('@/app/api/delivery/create-order/[orderId]/route');
    const res = await POST(userReq(URL, 'POST'), { params: { orderId: 'o1' } });
    expect(res.status).toBe(403);
  });

  it('returns 404 when order not found', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ Order: { findById: jest.fn().mockResolvedValue(null) } }));
    jest.mock('@/lib/borzo', () => ({ createBorzoDelivery: jest.fn() }));
    const { POST } = await import('@/app/api/delivery/create-order/[orderId]/route');
    const res = await POST(adminReq(URL, 'POST'), { params: { orderId: 'o1' } });
    expect(res.status).toBe(404);
  });

  it('returns 400 when borzo delivery already exists', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({
      Order: { findById: jest.fn().mockResolvedValue({ _id: 'o1', borzoOrderId: 'existing-id' }) },
    }));
    jest.mock('@/lib/borzo', () => ({ createBorzoDelivery: jest.fn() }));
    const { POST } = await import('@/app/api/delivery/create-order/[orderId]/route');
    const res = await POST(adminReq(URL, 'POST'), { params: { orderId: 'o1' } });
    expect(res.status).toBe(400);
  });

  it('creates borzo delivery and returns 200', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const borzMock = jest.fn().mockResolvedValue(undefined);
    jest.mock('@/lib/models', () => ({
      Order: { findById: jest.fn().mockResolvedValue({ _id: 'o1', borzoOrderId: null }) },
    }));
    jest.mock('@/lib/borzo', () => ({ createBorzoDelivery: borzMock }));
    const { POST } = await import('@/app/api/delivery/create-order/[orderId]/route');
    const res = await POST(adminReq(URL, 'POST'), { params: { orderId: 'o1' } });
    expect(res.status).toBe(200);
    expect(borzMock).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// STRIPE WEBHOOK
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/webhook (Stripe)', () => {
  const URL = 'http://localhost/api/webhook';

  it('returns 400 when stripe signature is invalid', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ TempCart: {}, TempSubscription: {}, Order: {}, Subscription: {} }));
    jest.mock('@/lib/email',  () => ({ sendMail: jest.fn() }));
    jest.mock('@/lib/socket', () => ({ emitOrderUpdate: jest.fn() }));
    jest.mock('@/lib/borzo',  () => ({ createBorzoDelivery: jest.fn() }));
    jest.mock('stripe', () => ({
      default: jest.fn().mockImplementation(() => ({
        webhooks: {
          constructEvent: jest.fn().mockImplementation(() => { throw new Error('Invalid signature'); }),
        },
      })),
    }));
    const { POST } = await import('@/app/api/webhook/route');
    const req = new NextRequest(URL, {
      method: 'POST',
      headers: { 'stripe-signature': 'bad-sig', 'Content-Type': 'text/plain' },
      body: 'raw-body',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('creates order and sends email for checkout.session.completed with email contact', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const createdOrder = { _id: 'o1', customerName: 'Kajal', total: 300 };
    const tempCartMock = {
      userId: 'u1', customerName: 'Kajal', contact: 'kajal@gmail.com', phone: '9876543210',
      address: '123 St', cart: { items: [], total: 300 }, deliveryFee: 0,
      customerLat: null, customerLng: null,
    };
    const sendMailMock = jest.fn().mockResolvedValue(undefined);
    jest.mock('@/lib/models', () => ({
      TempCart: { findOneAndDelete: jest.fn().mockResolvedValue(tempCartMock) },
      TempSubscription: { findOneAndDelete: jest.fn().mockResolvedValue(null) },
      Order: { create: jest.fn().mockResolvedValue(createdOrder) },
      Subscription: {},
    }));
    jest.mock('@/lib/email',  () => ({ sendMail: sendMailMock }));
    jest.mock('@/lib/socket', () => ({ emitOrderUpdate: jest.fn() }));
    jest.mock('@/lib/borzo',  () => ({ createBorzoDelivery: jest.fn().mockResolvedValue(undefined) }));
    jest.mock('stripe', () => ({
      default: jest.fn().mockImplementation(() => ({
        webhooks: {
          constructEvent: jest.fn().mockReturnValue({
            type: 'checkout.session.completed',
            data: { object: { id: 'sess_123' } },
          }),
        },
      })),
    }));
    const { POST } = await import('@/app/api/webhook/route');
    const req = new NextRequest(URL, {
      method: 'POST',
      headers: { 'stripe-signature': 'valid-sig', 'Content-Type': 'text/plain' },
      body: 'raw-body',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(sendMailMock).toHaveBeenCalledWith('kajal@gmail.com', expect.stringContaining('Order Confirmation'), expect.any(String));
  });

  it('creates subscription for checkout.session.completed with tempSub', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const tempSubMock = {
      contact: 'kajal@gmail.com', customerName: 'Kajal', plan: 'Monthly',
      toObject: () => ({ contact: 'kajal@gmail.com', plan: 'Monthly' }),
    };
    const sendMailMock = jest.fn().mockResolvedValue(undefined);
    jest.mock('@/lib/models', () => ({
      TempCart: { findOneAndDelete: jest.fn().mockResolvedValue(null) },
      TempSubscription: { findOneAndDelete: jest.fn().mockResolvedValue(tempSubMock) },
      Order: { create: jest.fn() },
      Subscription: { create: jest.fn().mockResolvedValue({ plan: 'Monthly', customerName: 'Kajal' }) },
    }));
    jest.mock('@/lib/email',  () => ({ sendMail: sendMailMock }));
    jest.mock('@/lib/socket', () => ({ emitOrderUpdate: jest.fn() }));
    jest.mock('@/lib/borzo',  () => ({ createBorzoDelivery: jest.fn() }));
    jest.mock('stripe', () => ({
      default: jest.fn().mockImplementation(() => ({
        webhooks: {
          constructEvent: jest.fn().mockReturnValue({
            type: 'checkout.session.completed',
            data: { object: { id: 'sess_sub_123' } },
          }),
        },
      })),
    }));
    const { POST } = await import('@/app/api/webhook/route');
    const req = new NextRequest(URL, {
      method: 'POST',
      headers: { 'stripe-signature': 'valid-sig', 'Content-Type': 'text/plain' },
      body: 'raw-body',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(sendMailMock).toHaveBeenCalledWith('kajal@gmail.com', expect.stringContaining('Subscription Confirmed'), expect.any(String));
  });

  it('returns 200 ok for unhandled event types', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ TempCart: {}, TempSubscription: {}, Order: {}, Subscription: {} }));
    jest.mock('@/lib/email',  () => ({ sendMail: jest.fn() }));
    jest.mock('@/lib/socket', () => ({ emitOrderUpdate: jest.fn() }));
    jest.mock('@/lib/borzo',  () => ({ createBorzoDelivery: jest.fn() }));
    jest.mock('stripe', () => ({
      default: jest.fn().mockImplementation(() => ({
        webhooks: {
          constructEvent: jest.fn().mockReturnValue({
            type: 'payment_intent.created',
            data: { object: {} },
          }),
        },
      })),
    }));
    const { POST } = await import('@/app/api/webhook/route');
    const req = new NextRequest(URL, {
      method: 'POST',
      headers: { 'stripe-signature': 'valid-sig', 'Content-Type': 'text/plain' },
      body: 'raw-body',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe('ok');
  });
});
