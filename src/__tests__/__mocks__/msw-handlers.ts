/**
 * MSW (Mock Service Worker) Handlers
 * Use these in component tests to intercept API calls without hitting real endpoints.
 *
 * Usage in a test file:
 *   import { server } from '../__mocks__/msw-server';
 *   beforeAll(() => server.listen());
 *   afterEach(() => server.resetHandlers());
 *   afterAll(() => server.close());
 */

import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// ─── Mock data ────────────────────────────────────────────────────────────────

export const MOCK_MENU_ITEMS = [
  { _id: 'm1', name: 'Dal Makhani',        price: 120, category: '🍲 Main Course', available: true },
  { _id: 'm2', name: 'Paneer Butter Masala', price: 150, category: '🍲 Main Course', available: true },
  { _id: 'm3', name: 'Garlic Naan',         price:  40, category: '🍞 Breads',      available: true },
  { _id: 'm4', name: 'Steamed Rice',        price:  60, category: '🍚 Rice',        available: true },
];

export const MOCK_USER = {
  name: 'Kajal Test',
  contact: 'kajal@test.com',
  role: 'user',
};

export const MOCK_ORDER = {
  _id: 'order-123',
  customerName: 'Kajal Test',
  items: [{ name: 'Dal Makhani', price: 120, quantity: 2 }],
  total: 240,
  status: 'Pending',
  paymentMethod: 'Online',
  timestamp: new Date().toISOString(),
};

// ─── Route handlers ───────────────────────────────────────────────────────────

export const handlers = [
  // Menu
  http.get('/api/menu', () => HttpResponse.json(MOCK_MENU_ITEMS)),

  // Tiffin menu
  http.get('/api/tiffin-menu', () =>
    HttpResponse.json([
      { _id: 't1', name: 'Lunch Tiffin', price: 80, meta: 'Lunch · Veg', available: true },
    ])
  ),

  // Login — success
  http.post('/api/login', async ({ request }) => {
    const body = await request.json() as { contact?: string; password?: string };
    if (body?.contact === 'kajal@test.com' && body?.password === 'Test@1234') {
      return HttpResponse.json({
        success: true,
        token: 'mock-jwt-token',
        user: MOCK_USER,
      });
    }
    return HttpResponse.json({ success: false, message: 'Invalid credentials.' }, { status: 401 });
  }),

  // Register
  http.post('/api/register', async ({ request }) => {
    const body = await request.json() as { contact?: string };
    if (!body?.contact) {
      return HttpResponse.json({ success: false, message: 'All fields are required.' }, { status: 400 });
    }
    return HttpResponse.json({ success: true, requiresVerification: true }, { status: 201 });
  }),

  // Logout
  http.post('/api/logout', () => HttpResponse.json({ success: true })),

  // My orders
  http.get('/api/my-orders', () => HttpResponse.json([MOCK_ORDER])),

  // Single order
  http.get('/api/orders/:id', ({ params }) =>
    HttpResponse.json({ ...MOCK_ORDER, _id: params.id })
  ),

  // Cancel order
  http.put('/api/orders/:id/cancel', () =>
    HttpResponse.json({ success: true, message: 'Order cancelled.' })
  ),

  // Profile
  http.get('/api/profile', () =>
    HttpResponse.json({ success: true, user: MOCK_USER })
  ),
  http.put('/api/profile', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ success: true, user: { ...MOCK_USER, ...body } });
  }),

  // Delivery estimate
  http.post('/api/delivery/estimate', () =>
    HttpResponse.json({ fee: 30, distanceKm: 2.5 })
  ),

  // Verify session
  http.get('/api/verify-session', () =>
    HttpResponse.json({ valid: true, user: MOCK_USER })
  ),
];

// ─── Server setup ─────────────────────────────────────────────────────────────

export const server = setupServer(...handlers);
