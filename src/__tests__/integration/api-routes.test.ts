/**
 * Integration Tests — API routes (extended coverage)
 * Covers:
 *   GET  /api/menu
 *   POST /api/menu          (admin)
 *   POST /api/forgot-password
 *   POST /api/verify
 *   POST /api/resend-otp
 *   POST /api/reset-password
 *   GET  /api/profile
 *   PUT  /api/profile
 *   GET  /api/my-orders
 *   POST /api/contact
 *   POST /api/logout
 *   POST /api/checkout-cod
 */

process.env.JWT_SECRET = 'test-secret-kajal-ki-rasoi';

import { NextRequest } from 'next/server';
import { signToken } from '@/lib/auth';

// ─── Shared mocks ─────────────────────────────────────────────────────────────

jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/email',   () => ({ sendMail: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/socket',  () => ({ emitOrderUpdate: jest.fn() }));
jest.mock('@/lib/borzo',   () => ({ createBorzoDelivery: jest.fn().mockResolvedValue(undefined) }));
jest.mock('bcrypt', () => ({
  hash:    jest.fn().mockImplementation(async (str: string) => `hashed:${str}`),
  compare: jest.fn().mockImplementation(async (plain: string, hashed: string) => hashed === `hashed:${plain}`),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function jsonRequest(url: string, body: Record<string, unknown>, method = 'POST'): NextRequest {
  return new NextRequest(url, {
    method,
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function authedRequest(url: string, role: 'admin' | 'user', method = 'GET', body?: Record<string, unknown>): NextRequest {
  const token = signToken({ id: `${role}-id-123`, role });
  return new NextRequest(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

// ─── GET /api/menu ────────────────────────────────────────────────────────────

describe('GET /api/menu', () => {
  const URL = 'http://localhost/api/menu';

  it('returns 200 with menu items array', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const mockItems = [{ _id: 'm1', name: 'Dal Makhani', price: 120, category: '🍲 Main Course' }];
    jest.mock('@/lib/models', () => ({
      MenuItem: { find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(mockItems) }) },
    }));
    const { GET } = await import('@/app/api/menu/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].name).toBe('Dal Makhani');
  });

  it('returns cached data on second call within TTL', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const findMock = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
    jest.mock('@/lib/models', () => ({ MenuItem: { find: findMock } }));
    const { GET } = await import('@/app/api/menu/route');
    await GET();
    await GET();
    // DB should only be queried once — second call uses cache
    expect(findMock).toHaveBeenCalledTimes(1);
  });
});

// ─── POST /api/menu ───────────────────────────────────────────────────────────

describe('POST /api/menu', () => {
  const URL = 'http://localhost/api/menu';

  it('returns 401 when no auth token', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ MenuItem: { create: jest.fn() } }));
    const { POST } = await import('@/app/api/menu/route');
    const req = new NextRequest(URL, { method: 'POST', body: JSON.stringify({ name: 'Test', price: 100 }), headers: { 'Content-Type': 'application/json' } });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 403 when caller is not admin', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ MenuItem: { create: jest.fn() } }));
    const { POST } = await import('@/app/api/menu/route');
    const res = await POST(authedRequest(URL, 'user', 'POST', { name: 'Test', price: 100 }));
    expect(res.status).toBe(403);
  });

  it('returns 400 when name or price is missing', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ MenuItem: { create: jest.fn() } }));
    const { POST } = await import('@/app/api/menu/route');
    const res = await POST(authedRequest(URL, 'admin', 'POST', { name: '', price: 'bad' }));
    expect(res.status).toBe(400);
  });

  it('returns 201 and creates item when admin sends valid data', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const newItem = { _id: 'new-id', name: 'Paneer Butter Masala', price: 160, category: '🍲 Main Course' };
    jest.mock('@/lib/models', () => ({ MenuItem: { create: jest.fn().mockResolvedValue(newItem) } }));
    const { POST } = await import('@/app/api/menu/route');
    const res = await POST(authedRequest(URL, 'admin', 'POST', { name: 'Paneer Butter Masala', price: 160, category: '🍲 Main Course' }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.item.name).toBe('Paneer Butter Masala');
  });
});

// ─── POST /api/forgot-password ────────────────────────────────────────────────

describe('POST /api/forgot-password', () => {
  const URL = 'http://localhost/api/forgot-password';

  it('returns 400 for invalid email', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ User: { findOne: jest.fn() } }));
    jest.mock('@/lib/email', () => ({ sendMail: jest.fn() }));
    const { POST } = await import('@/app/api/forgot-password/route');
    const res = await POST(jsonRequest(URL, { email: 'notanemail' }));
    expect(res.status).toBe(400);
  });

  it('returns 200 even when email does not exist (security: no user enumeration)', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ User: { findOne: jest.fn().mockResolvedValue(null) } }));
    jest.mock('@/lib/email', () => ({ sendMail: jest.fn() }));
    const { POST } = await import('@/app/api/forgot-password/route');
    const res = await POST(jsonRequest(URL, { email: 'nouser@test.com' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('saves reset token and sends email for valid existing user', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const mockUser = { contact: 'kajal@test.com', resetPasswordToken: '', resetPasswordExpires: null, save: jest.fn() };
    jest.mock('@/lib/models', () => ({ User: { findOne: jest.fn().mockResolvedValue(mockUser) } }));
    const sendMailMock = jest.fn().mockResolvedValue(undefined);
    jest.mock('@/lib/email', () => ({ sendMail: sendMailMock }));
    const { POST } = await import('@/app/api/forgot-password/route');
    const res = await POST(jsonRequest(URL, { email: 'kajal@test.com' }));
    expect(res.status).toBe(200);
    expect(mockUser.save).toHaveBeenCalled();
    expect(sendMailMock).toHaveBeenCalledWith('kajal@test.com', expect.stringContaining('Reset'), expect.any(String));
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('returns 500 when email sending fails', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const mockUser = { contact: 'kajal@test.com', resetPasswordToken: '', resetPasswordExpires: null, save: jest.fn() };
    jest.mock('@/lib/models', () => ({ User: { findOne: jest.fn().mockResolvedValue(mockUser) } }));
    jest.mock('@/lib/email', () => ({ sendMail: jest.fn().mockRejectedValue(new Error('SMTP error')) }));
    const { POST } = await import('@/app/api/forgot-password/route');
    const res = await POST(jsonRequest(URL, { email: 'kajal@test.com' }));
    expect(res.status).toBe(500);
  });
});

// ─── POST /api/verify ─────────────────────────────────────────────────────────

describe('POST /api/verify', () => {
  const URL = 'http://localhost/api/verify';

  it('returns 404 when user not found', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ User: { findOne: jest.fn().mockResolvedValue(null) } }));
    const { POST } = await import('@/app/api/verify/route');
    const res = await POST(jsonRequest(URL, { contact: 'noone@test.com', otp: '123456' }));
    expect(res.status).toBe(404);
  });

  it('returns 400 if user is already verified', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ User: { findOne: jest.fn().mockResolvedValue({ isVerified: true }) } }));
    const { POST } = await import('@/app/api/verify/route');
    const res = await POST(jsonRequest(URL, { contact: 'kajal@test.com', otp: '123456' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toMatch(/already verified/i);
  });

  it('returns 400 when OTP is expired', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({
      User: { findOne: jest.fn().mockResolvedValue({ isVerified: false, otpExpires: Date.now() - 1000 }) },
    }));
    const { POST } = await import('@/app/api/verify/route');
    const res = await POST(jsonRequest(URL, { contact: 'kajal@test.com', otp: '123456' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toMatch(/expired/i);
  });

  it('returns 400 for wrong OTP', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({
      User: { findOne: jest.fn().mockResolvedValue({
        isVerified: false,
        otpExpires: Date.now() + 60000,
        verificationOtp: 'hashed:999999', // bcrypt mock: matches only '999999'
      })},
    }));
    const { POST } = await import('@/app/api/verify/route');
    const res = await POST(jsonRequest(URL, { contact: 'kajal@test.com', otp: '123456' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toMatch(/invalid code/i);
  });

  it('returns 200 with token on successful verification', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const mockUser = {
      _id: { toString: () => 'user-id' },
      name: 'Kajal',
      contact: 'kajal@test.com',
      role: 'user',
      isVerified: false,
      otpExpires: Date.now() + 60000,
      verificationOtp: 'hashed:123456',
      save: jest.fn(),
    };
    jest.mock('@/lib/models', () => ({ User: { findOne: jest.fn().mockResolvedValue(mockUser) } }));
    const { POST } = await import('@/app/api/verify/route');
    const res = await POST(jsonRequest(URL, { contact: 'kajal@test.com', otp: '123456' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.token).toBe('string');
    expect(mockUser.isVerified).toBe(true);
    expect(mockUser.save).toHaveBeenCalled();
  });
});

// ─── POST /api/resend-otp ─────────────────────────────────────────────────────

describe('POST /api/resend-otp', () => {
  const URL = 'http://localhost/api/resend-otp';

  it('returns 404 when user not found', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ User: { findOne: jest.fn().mockResolvedValue(null) } }));
    jest.mock('@/lib/email', () => ({ sendMail: jest.fn() }));
    const { POST } = await import('@/app/api/resend-otp/route');
    const res = await POST(jsonRequest(URL, { contact: 'noone@test.com' }));
    expect(res.status).toBe(404);
  });

  it('returns 400 if user is already verified', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ User: { findOne: jest.fn().mockResolvedValue({ isVerified: true }) } }));
    jest.mock('@/lib/email', () => ({ sendMail: jest.fn() }));
    const { POST } = await import('@/app/api/resend-otp/route');
    const res = await POST(jsonRequest(URL, { contact: 'kajal@test.com' }));
    expect(res.status).toBe(400);
  });

  it('returns 200 and saves new OTP for unverified user', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const mockUser = { contact: 'kajal@test.com', isVerified: false, verificationOtp: '', otpExpires: null, save: jest.fn() };
    jest.mock('@/lib/models', () => ({ User: { findOne: jest.fn().mockResolvedValue(mockUser) } }));
    const sendMailMock = jest.fn().mockResolvedValue(undefined);
    jest.mock('@/lib/email', () => ({ sendMail: sendMailMock }));
    const { POST } = await import('@/app/api/resend-otp/route');
    const res = await POST(jsonRequest(URL, { contact: 'kajal@test.com' }));
    expect(res.status).toBe(200);
    expect(mockUser.save).toHaveBeenCalled();
    expect(sendMailMock).toHaveBeenCalled();
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('does not send email for phone-based contacts', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const mockUser = { contact: '9876543210', isVerified: false, verificationOtp: '', otpExpires: null, save: jest.fn() };
    jest.mock('@/lib/models', () => ({ User: { findOne: jest.fn().mockResolvedValue(mockUser) } }));
    const sendMailMock = jest.fn();
    jest.mock('@/lib/email', () => ({ sendMail: sendMailMock }));
    const { POST } = await import('@/app/api/resend-otp/route');
    await POST(jsonRequest(URL, { contact: '9876543210' }));
    expect(sendMailMock).not.toHaveBeenCalled();
  });
});

// ─── POST /api/reset-password ─────────────────────────────────────────────────

describe('POST /api/reset-password', () => {
  const URL = 'http://localhost/api/reset-password';

  it('returns 400 when token or newPassword is missing', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ User: { findOne: jest.fn() } }));
    const { POST } = await import('@/app/api/reset-password/route');
    const res = await POST(jsonRequest(URL, { token: '', newPassword: '' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when token is invalid or expired', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ User: { findOne: jest.fn().mockResolvedValue(null) } }));
    const { POST } = await import('@/app/api/reset-password/route');
    const res = await POST(jsonRequest(URL, { token: 'badtoken', newPassword: 'NewPass@123' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toMatch(/invalid or expired/i);
  });

  it('resets password and clears token on valid request', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const mockUser = { password: '', resetPasswordToken: 'old-token', resetPasswordExpires: undefined, save: jest.fn() };
    jest.mock('@/lib/models', () => ({ User: { findOne: jest.fn().mockResolvedValue(mockUser) } }));
    const { POST } = await import('@/app/api/reset-password/route');
    const res = await POST(jsonRequest(URL, { token: 'validtoken123', newPassword: 'NewPass@123' }));
    expect(res.status).toBe(200);
    expect(mockUser.password).toBe('hashed:NewPass@123');
    expect(mockUser.resetPasswordToken).toBeUndefined();
    expect(mockUser.save).toHaveBeenCalled();
  });
});

// ─── GET /api/profile ─────────────────────────────────────────────────────────

describe('GET /api/profile', () => {
  const URL = 'http://localhost/api/profile';

  it('returns 401 when not authenticated', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ User: { findById: jest.fn() }, Order: { countDocuments: jest.fn() } }));
    const { GET } = await import('@/app/api/profile/route');
    const req = new NextRequest(URL, { method: 'GET' });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 404 when user not found in DB', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({
      User: { findById: jest.fn().mockResolvedValue(null) },
      Order: { countDocuments: jest.fn().mockResolvedValue(0) },
    }));
    const { GET } = await import('@/app/api/profile/route');
    const res = await GET(authedRequest(URL, 'user'));
    expect(res.status).toBe(404);
  });

  it('returns 200 with user profile data', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({
      User: { findById: jest.fn().mockResolvedValue({ name: 'Kajal', contact: 'kajal@test.com', isTrusted: false }) },
      Order: { countDocuments: jest.fn().mockResolvedValue(3) },
    }));
    const { GET } = await import('@/app/api/profile/route');
    const res = await GET(authedRequest(URL, 'user'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.user.name).toBe('Kajal');
    expect(body.user.isTrusted).toBe(true); // has 3 completed orders
  });
});

// ─── PUT /api/profile ─────────────────────────────────────────────────────────

describe('PUT /api/profile', () => {
  const URL = 'http://localhost/api/profile';

  it('returns 401 when not authenticated', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ User: { findById: jest.fn() } }));
    const { PUT } = await import('@/app/api/profile/route');
    const req = new NextRequest(URL, { method: 'PUT', body: JSON.stringify({ name: 'New' }), headers: { 'Content-Type': 'application/json' } });
    const res = await PUT(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when new contact is already taken', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({
      User: {
        findById: jest.fn().mockResolvedValue({ name: 'Kajal', contact: 'kajal@test.com', save: jest.fn() }),
        findOne: jest.fn().mockResolvedValue({ contact: 'taken@test.com' }), // already exists
      },
    }));
    const { PUT } = await import('@/app/api/profile/route');
    const res = await PUT(authedRequest(URL, 'user', 'PUT', { contact: 'taken@test.com' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toMatch(/already in use/i);
  });

  it('updates name and returns 200', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const mockUser = { name: 'Kajal', contact: 'kajal@test.com', role: 'user', save: jest.fn() };
    jest.mock('@/lib/models', () => ({
      User: { findById: jest.fn().mockResolvedValue(mockUser), findOne: jest.fn().mockResolvedValue(null) },
    }));
    const { PUT } = await import('@/app/api/profile/route');
    const res = await PUT(authedRequest(URL, 'user', 'PUT', { name: 'Kajal Updated' }));
    expect(res.status).toBe(200);
    expect(mockUser.name).toBe('Kajal Updated');
    expect(mockUser.save).toHaveBeenCalled();
  });
});

// ─── GET /api/my-orders ───────────────────────────────────────────────────────

describe('GET /api/my-orders', () => {
  const URL = 'http://localhost/api/my-orders';

  it('returns 401 when not authenticated', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ Order: { find: jest.fn() } }));
    const { GET } = await import('@/app/api/my-orders/route');
    const req = new NextRequest(URL, { method: 'GET' });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 with orders array for authenticated user', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const mockOrders = [{ _id: 'o1', status: 'Completed', total: 250 }];
    jest.mock('@/lib/models', () => ({
      Order: {
        find: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          lean: jest.fn().mockResolvedValue(mockOrders),
        }),
      },
    }));
    const { GET } = await import('@/app/api/my-orders/route');
    const res = await GET(authedRequest(URL, 'user'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].status).toBe('Completed');
  });
});

// ─── POST /api/contact ────────────────────────────────────────────────────────

describe('POST /api/contact', () => {
  const URL = 'http://localhost/api/contact';

  it('returns 400 when any field is missing', async () => {
    jest.resetModules();
    jest.mock('@/lib/email', () => ({ sendMail: jest.fn() }));
    const { POST } = await import('@/app/api/contact/route');
    const res = await POST(jsonRequest(URL, { name: 'Kajal', contact: '', message: '' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toMatch(/required/i);
  });

  it('sends email and returns 200 on valid submission', async () => {
    jest.resetModules();
    const sendMailMock = jest.fn().mockResolvedValue(undefined);
    jest.mock('@/lib/email', () => ({ sendMail: sendMailMock }));
    const { POST } = await import('@/app/api/contact/route');
    const res = await POST(jsonRequest(URL, { name: 'Kajal', contact: '9876543210', message: 'Hello!' }));
    expect(res.status).toBe(200);
    expect(sendMailMock).toHaveBeenCalledWith(
      'kajalkirasoi4@gmail.com',
      expect.stringContaining('Kajal'),
      expect.any(String),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

// ─── POST /api/logout ─────────────────────────────────────────────────────────

describe('POST /api/logout', () => {
  it('returns 200 and clears authToken cookie', async () => {
    jest.resetModules();
    const { POST } = await import('@/app/api/logout/route');
    const res = await POST();
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toMatch(/authToken/);
    expect(setCookie).toMatch(/Max-Age=0|max-age=0/i);
  });
});

// ─── POST /api/checkout-cod ───────────────────────────────────────────────────

describe('POST /api/checkout-cod', () => {
  const URL = 'http://localhost/api/checkout-cod';

  it('returns 403 when not authenticated', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ Order: {}, User: {}, MenuItem: {}, TiffinItem: {}, SiteSettings: {} }));
    jest.mock('@/lib/socket', () => ({ emitOrderUpdate: jest.fn() }));
    jest.mock('@/lib/borzo',  () => ({ createBorzoDelivery: jest.fn() }));
    const { POST } = await import('@/app/api/checkout-cod/route');
    const req = new NextRequest(URL, { method: 'POST', body: JSON.stringify({}), headers: { 'Content-Type': 'application/json' } });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('returns 400 when required order fields are missing', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({
      Order: {}, User: {}, MenuItem: {}, TiffinItem: {},
      SiteSettings: { findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }) },
    }));
    jest.mock('@/lib/socket', () => ({ emitOrderUpdate: jest.fn() }));
    jest.mock('@/lib/borzo',  () => ({ createBorzoDelivery: jest.fn() }));
    const { POST } = await import('@/app/api/checkout-cod/route');
    const res = await POST(authedRequest(URL, 'user', 'POST', { items: [], address: '', customerName: '' }));
    expect(res.status).toBe(400);
  });

  it('creates COD order and returns 200 with orderId', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const newOrder = { _id: 'order-123' };
    jest.mock('@/lib/models', () => ({
      SiteSettings: { findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }) },
      MenuItem:   { find: jest.fn().mockResolvedValue([{ name: 'Dal Makhani', price: 120 }]) },
      TiffinItem: { find: jest.fn().mockResolvedValue([]) },
      Order:      { create: jest.fn().mockResolvedValue(newOrder), countDocuments: jest.fn().mockResolvedValue(0) },
      User:       { findById: jest.fn().mockResolvedValue({ isTrusted: true }) },
    }));
    jest.mock('@/lib/socket', () => ({ emitOrderUpdate: jest.fn() }));
    jest.mock('@/lib/borzo',  () => ({ createBorzoDelivery: jest.fn().mockResolvedValue(undefined) }));
    const { POST } = await import('@/app/api/checkout-cod/route');
    const res = await POST(authedRequest(URL, 'user', 'POST', {
      items: [{ name: 'Dal Makhani', quantity: 1 }],
      customerName: 'Kajal',
      contact: 'kajal@test.com',
      phone: '9876543210',
      address: '123 Test St, Noida',
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.orderId).toBe('order-123');
  });

  it('applies APNA50 coupon when subtotal >= 200', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    let capturedTotal = 0;
    jest.mock('@/lib/models', () => ({
      SiteSettings: { findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }) },
      MenuItem:   { find: jest.fn().mockResolvedValue([{ name: 'Paneer Thali', price: 250 }]) },
      TiffinItem: { find: jest.fn().mockResolvedValue([]) },
      Order: {
        create: jest.fn().mockImplementation(async (data: { total: number }) => { capturedTotal = data.total; return { _id: 'o1' }; }),
        countDocuments: jest.fn().mockResolvedValue(0),
      },
      User: { findById: jest.fn().mockResolvedValue({ isTrusted: true }) },
    }));
    jest.mock('@/lib/socket', () => ({ emitOrderUpdate: jest.fn() }));
    jest.mock('@/lib/borzo',  () => ({ createBorzoDelivery: jest.fn().mockResolvedValue(undefined) }));
    const { POST } = await import('@/app/api/checkout-cod/route');
    await POST(authedRequest(URL, 'user', 'POST', {
      items: [{ name: 'Paneer Thali', quantity: 1 }],
      customerName: 'Kajal', contact: 'kajal@test.com', phone: '9876543210',
      address: '123 Test St', couponCode: 'APNA50',
    }));
    // 250 - 50 coupon = 200
    expect(capturedTotal).toBe(200);
  });
});