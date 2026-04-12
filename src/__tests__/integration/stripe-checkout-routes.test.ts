process.env.JWT_SECRET = 'test-secret-kajal-ki-rasoi';
process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';

import { NextRequest } from 'next/server';
import { signToken } from '@/lib/auth';

function makeRequest(
  url: string,
  body: Record<string, unknown>,
  options?: {
    token?: string;
    origin?: string;
  }
): NextRequest {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options?.token) {
    headers.authorization = `Bearer ${options.token}`;
  }

  if (options?.origin) {
    headers.origin = options.origin;
  }

  return new NextRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.resetModules();
  jest.unmock('@/lib/auth');
  delete process.env.FRONTEND_URL;
});

describe('POST /api/create-stripe-checkout', () => {
  const URL = 'http://localhost/api/create-stripe-checkout';

  it('returns 400 for invalid cart payloads', async () => {
    jest.doMock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.doMock('@/lib/models', () => ({
      MenuItem: { find: jest.fn() },
      TiffinItem: { find: jest.fn() },
      TempCart: { create: jest.fn() },
    }));

    const { POST } = await import('@/app/api/create-stripe-checkout/route');
    const res = await POST(makeRequest(URL, { items: 'not-an-array', address: '' }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid request.' });
  });

  it('creates a Stripe checkout session and temp cart for guests', async () => {
    const createSessionMock = jest.fn().mockResolvedValue({
      id: 'sess_order_123',
      url: 'https://stripe.test/checkout/sess_order_123',
    });
    const tempCartCreate = jest.fn().mockResolvedValue(undefined);

    jest.doMock('stripe', () => ({
      default: jest.fn().mockImplementation(() => ({
        checkout: {
          sessions: {
            create: createSessionMock,
          },
        },
      })),
    }));
    jest.doMock('@/lib/mongodb', () => ({ connectDB: jest.fn().mockResolvedValue(undefined) }));
    jest.doMock('@/lib/models', () => ({
      MenuItem: {
        find: jest.fn().mockResolvedValue([{ name: 'Paneer Curry', price: 150 }]),
      },
      TiffinItem: {
        find: jest.fn().mockResolvedValue([{ name: 'Mini Tiffin', price: 80 }]),
      },
      TempCart: {
        create: tempCartCreate,
      },
    }));

    const { POST } = await import('@/app/api/create-stripe-checkout/route');
    const res = await POST(
      makeRequest(
        URL,
        {
          items: [
            { name: 'Paneer Curry', quantity: 2 },
            { name: 'Mini Tiffin', quantity: 1 },
          ],
          customerName: 'Guest User',
          contact: 'not-an-email',
          phone: '9999999999',
          address: ' 221B Baker Street ',
          couponCode: 'APNA50',
          successUrl: 'https://evil.example.com/steal',
          cancelUrl: 'https://evil.example.com/cancel',
          deliveryFee: 20,
          customerLat: 28.61,
          customerLng: 77.2,
        },
        { origin: 'https://orders.example.com' }
      )
    );

    expect(res.status).toBe(200);
    expect(createSessionMock).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'payment',
      success_url: 'https://orders.example.com/my-orders?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://orders.example.com/payment',
      customer_email: undefined,
      line_items: [
        expect.objectContaining({
          quantity: 1,
          price_data: expect.objectContaining({
            currency: 'inr',
            unit_amount: 33000,
            product_data: { name: 'Kajal Ki Rasoi Order' },
          }),
        }),
      ],
    }));
    expect(tempCartCreate).toHaveBeenCalledWith(expect.objectContaining({
      stripeSessionId: 'sess_order_123',
      userId: null,
      customerName: 'Guest User',
      contact: 'not-an-email',
      phone: '9999999999',
      address: '221B Baker Street',
      cart: {
        items: [
          { name: 'Paneer Curry', quantity: 2, price: 150 },
          { name: 'Mini Tiffin', quantity: 1, price: 80 },
        ],
        total: 330,
      },
      deliveryFee: 0,
      customerLat: 28.61,
      customerLng: 77.2,
    }));
    expect(await res.json()).toEqual({
      id: 'sess_order_123',
      url: 'https://stripe.test/checkout/sess_order_123',
    });
  });
});

describe('POST /api/create-stripe-subscription-checkout', () => {
  const URL = 'http://localhost/api/create-stripe-subscription-checkout';

  it('returns 400 when required fields are missing', async () => {
    const token = signToken({ id: 'user-id-123', role: 'user' });

    jest.doMock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.doMock('@/lib/models', () => ({
      Subscription: { findOne: jest.fn() },
      TempSubscription: { create: jest.fn() },
    }));

    const { POST } = await import('@/app/api/create-stripe-subscription-checkout/route');
    const res = await POST(makeRequest(URL, { plan: '', address: '', price: 0 }, { token }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Missing required fields.' });
  });

  it('creates a Stripe checkout session and temp subscription for authenticated users', async () => {
    process.env.FRONTEND_URL = 'https://frontend.example.com';

    const createSessionMock = jest.fn().mockResolvedValue({
      id: 'sess_sub_123',
      url: 'https://stripe.test/checkout/sess_sub_123',
    });
    const tempSubscriptionCreate = jest.fn().mockResolvedValue(undefined);
    const token = signToken({ id: 'user-id-123', role: 'user' });

    jest.doMock('stripe', () => ({
      default: jest.fn().mockImplementation(() => ({
        checkout: {
          sessions: {
            create: createSessionMock,
          },
        },
      })),
    }));
    jest.doMock('@/lib/mongodb', () => ({ connectDB: jest.fn().mockResolvedValue(undefined) }));
    jest.doMock('@/lib/models', () => ({
      Subscription: {
        findOne: jest.fn().mockResolvedValue(null),
      },
      TempSubscription: {
        create: tempSubscriptionCreate,
      },
    }));

    const { POST } = await import('@/app/api/create-stripe-subscription-checkout/route');
    const res = await POST(
      makeRequest(
        URL,
        {
          plan: '7-Day Trial Week',
          frequency: 7,
          price: 1,
          customerName: 'Kajal',
          contact: 'kajal@example.com',
          address: 'Sector 21',
          startDate: '2026-05-01T00:00:00.000Z',
          persons: 2,
          couponCode: 'APNA50',
          successUrl: 'https://success.example.com/done',
          cancelUrl: '/subscription',
        },
        { token }
      )
    );

    expect(res.status).toBe(200);
    expect(createSessionMock).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'payment',
      success_url: 'https://frontend.example.com/subscription?sub_success=true',
      cancel_url: 'https://frontend.example.com/subscription',
      customer_email: 'kajal@example.com',
      line_items: [
        expect.objectContaining({
          quantity: 1,
          price_data: expect.objectContaining({
            currency: 'inr',
            unit_amount: 134800,
            product_data: {
              name: 'Subscription: 7-Day Trial Week (7-Day Trial)',
              description: 'For 2 Person(s).',
            },
          }),
        }),
      ],
    }));
    expect(tempSubscriptionCreate).toHaveBeenCalledWith(expect.objectContaining({
      stripeSessionId: 'sess_sub_123',
      userId: 'user-id-123',
      customerName: 'Kajal',
      contact: 'kajal@example.com',
      address: 'Sector 21',
      plan: '7-Day Trial Week',
      frequency: 7,
      persons: 2,
      couponCode: 'APNA50',
      price: 1348,
      startDate: expect.any(Date),
    }));
    expect(await res.json()).toEqual({
      id: 'sess_sub_123',
      url: 'https://stripe.test/checkout/sess_sub_123',
    });
  });
});
