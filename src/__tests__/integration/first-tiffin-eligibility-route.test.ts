process.env.JWT_SECRET = 'test-secret-kajal-ki-rasoi';

import { NextRequest } from 'next/server';
import { signToken } from '@/lib/auth';

function makeRequest(body: Record<string, unknown>, token?: string): NextRequest {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  return new NextRequest('http://localhost/api/offers/first-tiffin-eligibility', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.resetModules();
  jest.unmock('@/lib/auth');
});

describe('POST /api/offers/first-tiffin-eligibility', () => {
  it('returns 400 for invalid cart payload', async () => {
    jest.doMock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.doMock('@/lib/models', () => ({
      TiffinItem: { find: jest.fn() },
      Order: { countDocuments: jest.fn() },
      SiteSettings: { findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }) },
    }));

    const { POST } = await import('@/app/api/offers/first-tiffin-eligibility/route');
    const res = await POST(makeRequest({ items: 'not-an-array' as any }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid cart items.' });
  });

  it('returns login_required for guest with tiffin in cart', async () => {
    jest.doMock('@/lib/mongodb', () => ({ connectDB: jest.fn().mockResolvedValue(undefined) }));
    jest.doMock('@/lib/models', () => ({
      TiffinItem: { find: jest.fn().mockResolvedValue([{ name: 'Mini Tiffin', price: 80 }]) },
      Order: { countDocuments: jest.fn() },
      SiteSettings: { findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }) },
    }));

    const { POST } = await import('@/app/api/offers/first-tiffin-eligibility/route');
    const res = await POST(makeRequest({ items: [{ name: 'Mini Tiffin', quantity: 1 }] }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(expect.objectContaining({
      eligible: false,
      reason: 'login_required',
      offerItemName: 'Mini Tiffin',
      offerDiscount: 80,
      hasTiffinInCart: true,
    }));
  });

  it('returns eligible for new logged-in customer with tiffin in cart', async () => {
    const token = signToken({ id: 'user-123', role: 'user' });
    jest.doMock('@/lib/mongodb', () => ({ connectDB: jest.fn().mockResolvedValue(undefined) }));
    jest.doMock('@/lib/models', () => ({
      TiffinItem: { find: jest.fn().mockResolvedValue([{ name: 'Mini Tiffin', price: 80 }]) },
      Order: { countDocuments: jest.fn().mockResolvedValue(0) },
      SiteSettings: { findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }) },
    }));

    const { POST } = await import('@/app/api/offers/first-tiffin-eligibility/route');
    const res = await POST(makeRequest({ items: [{ name: 'Mini Tiffin', quantity: 1 }] }, token));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(expect.objectContaining({
      eligible: true,
      reason: 'eligible',
      offerItemName: 'Mini Tiffin',
      offerDiscount: 80,
      isNewCustomer: true,
    }));
  });

  it('returns already_used for returning logged-in customer', async () => {
    const token = signToken({ id: 'user-123', role: 'user' });
    jest.doMock('@/lib/mongodb', () => ({ connectDB: jest.fn().mockResolvedValue(undefined) }));
    jest.doMock('@/lib/models', () => ({
      TiffinItem: { find: jest.fn().mockResolvedValue([{ name: 'Mini Tiffin', price: 80 }]) },
      Order: { countDocuments: jest.fn().mockResolvedValue(2) },
      SiteSettings: { findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }) },
    }));

    const { POST } = await import('@/app/api/offers/first-tiffin-eligibility/route');
    const res = await POST(makeRequest({ items: [{ name: 'Mini Tiffin', quantity: 1 }] }, token));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(expect.objectContaining({
      eligible: false,
      reason: 'already_used',
      offerItemName: 'Mini Tiffin',
      offerDiscount: 80,
      isNewCustomer: false,
    }));
  });
});
