/**
 * Integration Tests — Orders API routes
 * Covers: GET /api/orders (admin), PUT /api/orders/[id]/cancel
 */

// MUST be set before any import that reads JWT_SECRET at module evaluation time
process.env.JWT_SECRET = 'test-secret-kajal-ki-rasoi';

import { NextRequest } from 'next/server';
import { signToken } from '@/lib/auth';

jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn().mockResolvedValue(undefined) }));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bearerRequest(url: string, role: 'admin' | 'user' | null, method = 'GET'): NextRequest {
  const headers: Record<string, string> = {};
  if (role) {
    const token = signToken({ id: `${role}-id`, role });
    headers['authorization'] = `Bearer ${token}`;
  }
  return new NextRequest(url, { method, headers });
}

// ─── GET /api/orders ──────────────────────────────────────────────────────────

describe('GET /api/orders', () => {
  const ORDERS_URL = 'http://localhost/api/orders';

  it('returns 401 when no auth token', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ Order: { find: jest.fn() } }));
    const { GET } = await import('@/app/api/orders/route');
    const req = new NextRequest(ORDERS_URL, { method: 'GET' });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 403 when caller is not admin', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ Order: { find: jest.fn() } }));
    const { GET } = await import('@/app/api/orders/route');
    const token = signToken({ id: 'user-id', role: 'user' });
    const req = new NextRequest(ORDERS_URL, {
      method: 'GET',
      headers: { authorization: `Bearer ${token}` },
    });
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('returns 200 with orders array for admin', async () => {
    const mockOrders = [
      { _id: 'o1', status: 'Pending', customerName: 'Rahul', total: 250 },
      { _id: 'o2', status: 'Preparing', customerName: 'Priya', total: 180 },
    ];
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({
      Order: {
        find: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          lean: jest.fn().mockResolvedValue(mockOrders),
        }),
      },
    }));
    const { GET } = await import('@/app/api/orders/route');
    const token = signToken({ id: 'admin-id', role: 'admin' });
    const req = new NextRequest(ORDERS_URL, {
      method: 'GET',
      headers: { authorization: `Bearer ${token}` },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);
  });

  it('filters by status query param', async () => {
    const findMock = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ Order: { find: findMock } }));
    const { GET } = await import('@/app/api/orders/route');
    const token = signToken({ id: 'admin-id', role: 'admin' });
    const req = new NextRequest(`${ORDERS_URL}?status=Pending`, {
      method: 'GET',
      headers: { authorization: `Bearer ${token}` },
    });
    await GET(req);
    const queryArg = findMock.mock.calls[0]?.[0];
    expect(queryArg?.status).toBe('Pending');
  });
});

// ─── PUT /api/orders/[id]/cancel ──────────────────────────────────────────────

describe('PUT /api/orders/[id]/cancel', () => {
  const makeParams = (id: string) => ({ params: { id } });

  it('returns 401 when no auth token', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ Order: { findById: jest.fn() } }));
    jest.mock('@/lib/socket', () => ({ emitOrderUpdate: jest.fn() }));
    const { PUT } = await import('@/app/api/orders/[id]/cancel/route');
    const req = new NextRequest('http://localhost/api/orders/o1/cancel', { method: 'PUT' });
    const res = await PUT(req, makeParams('o1'));
    expect(res.status).toBe(401);
  });

  it('returns 404 when order not found', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ Order: { findById: jest.fn().mockResolvedValue(null) } }));
    jest.mock('@/lib/socket', () => ({ emitOrderUpdate: jest.fn() }));
    const { PUT } = await import('@/app/api/orders/[id]/cancel/route');
    const token = signToken({ id: 'user-id', role: 'user' });
    const req = new NextRequest('http://localhost/api/orders/o99/cancel', {
      method: 'PUT',
      headers: { authorization: `Bearer ${token}` },
    });
    const res = await PUT(req, makeParams('o99'));
    expect(res.status).toBe(404);
  });

  it('returns 403 if order belongs to different user', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({
      Order: { findById: jest.fn().mockResolvedValue({ userId: 'other-user-id', status: 'Pending' }) },
    }));
    jest.mock('@/lib/socket', () => ({ emitOrderUpdate: jest.fn() }));
    const { PUT } = await import('@/app/api/orders/[id]/cancel/route');
    const token = signToken({ id: 'user-id', role: 'user' });
    const req = new NextRequest('http://localhost/api/orders/o1/cancel', {
      method: 'PUT',
      headers: { authorization: `Bearer ${token}` },
    });
    const res = await PUT(req, makeParams('o1'));
    expect(res.status).toBe(403);
  });

  it('returns 400 if order is not in Pending status', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({
      Order: { findById: jest.fn().mockResolvedValue({ userId: 'user-id', status: 'Preparing' }) },
    }));
    jest.mock('@/lib/socket', () => ({ emitOrderUpdate: jest.fn() }));
    const { PUT } = await import('@/app/api/orders/[id]/cancel/route');
    const token = signToken({ id: 'user-id', role: 'user' });
    const req = new NextRequest('http://localhost/api/orders/o1/cancel', {
      method: 'PUT',
      headers: { authorization: `Bearer ${token}` },
    });
    const res = await PUT(req, makeParams('o1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toMatch(/cannot cancel/i);
  });

  it('cancels the order successfully and returns 200', async () => {
    const orderMock = {
      _id: 'o1',
      userId: 'user-id',
      status: 'Pending',
      save: jest.fn().mockResolvedValue(undefined),
    };
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ Order: { findById: jest.fn().mockResolvedValue(orderMock) } }));
    jest.mock('@/lib/socket', () => ({ emitOrderUpdate: jest.fn() }));
    const { PUT } = await import('@/app/api/orders/[id]/cancel/route');
    const token = signToken({ id: 'user-id', role: 'user' });
    const req = new NextRequest('http://localhost/api/orders/o1/cancel', {
      method: 'PUT',
      headers: { authorization: `Bearer ${token}` },
    });
    const res = await PUT(req, makeParams('o1'));
    expect(res.status).toBe(200);
    expect(orderMock.status).toBe('Cancelled');
    expect(orderMock.save).toHaveBeenCalled();
  });
});
