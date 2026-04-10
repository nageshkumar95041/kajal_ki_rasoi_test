/**
 * Integration Tests — Login & Register API routes
 *
 * Strategy: mock the heavy I/O (MongoDB, email) and test
 * the pure HTTP request-response logic of each route handler.
 */

// MUST be set before any import that reads JWT_SECRET at module evaluation time
process.env.JWT_SECRET = 'test-secret-kajal-ki-rasoi';

import { NextRequest } from 'next/server';

// ─── Shared mocks ─────────────────────────────────────────────────────────────

jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/email', () => ({ sendMail: jest.fn().mockResolvedValue(undefined) }));

// bcrypt mock — instant, deterministic
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockImplementation(async (str: string) => `hashed:${str}`),
  compare: jest.fn().mockImplementation(async (plain: string, hashed: string) =>
    hashed === `hashed:${plain}`
  ),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>, url = 'http://localhost/api/login'): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

// ─── /api/login ───────────────────────────────────────────────────────────────

describe('POST /api/login', () => {
  const mockUser = {
    _id: { toString: () => 'user-id-123' },
    name: 'Kajal',
    contact: 'kajal@test.com',
    role: 'user',
    isVerified: true,
    password: 'hashed:secret123',
    save: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.resetModules();
    process.env.JWT_SECRET = 'test-secret';
  });

  it('returns 400 when contact or password is missing', async () => {
    const { POST } = await import('@/app/api/login/route');
    const res = await POST(makeRequest({ contact: '' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('returns 401 for wrong password', async () => {
    jest.doMock('@/lib/models', () => ({
      User: { findOne: jest.fn().mockResolvedValue(mockUser) },
    }));
    const { POST } = await import('@/app/api/login/route');
    const res = await POST(makeRequest({ contact: 'kajal@test.com', password: 'wrongpass' }));
    expect(res.status).toBe(401);
  });

  it('returns 401 when user does not exist', async () => {
    jest.doMock('@/lib/models', () => ({
      User: { findOne: jest.fn().mockResolvedValue(null) },
    }));
    const { POST } = await import('@/app/api/login/route');
    const res = await POST(makeRequest({ contact: 'noone@test.com', password: 'pass' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toMatch(/invalid credentials/i);
  });

  it('returns 403 with requiresVerification=true for unverified user', async () => {
    const unverifiedUser = {
      ...mockUser,
      isVerified: false,
      role: 'user',
      contact: 'kajal@test.com',
      otpExpires: new Date(),
      verificationOtp: '',
      save: jest.fn().mockResolvedValue(undefined),
    };
    jest.doMock('@/lib/models', () => ({
      User: { findOne: jest.fn().mockResolvedValue(unverifiedUser) },
    }));
    const { POST } = await import('@/app/api/login/route');
    const res = await POST(makeRequest({ contact: 'kajal@test.com', password: 'secret123' }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.requiresVerification).toBe(true);
  });

  it('returns 403 with agent-specific message for unverified agent', async () => {
    const agentUser = { ...mockUser, isVerified: false, role: 'agent' };
    jest.doMock('@/lib/models', () => ({
      User: { findOne: jest.fn().mockResolvedValue(agentUser) },
    }));
    const { POST } = await import('@/app/api/login/route');
    const res = await POST(makeRequest({ contact: 'kajal@test.com', password: 'secret123' }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.message).toMatch(/agent/i);
  });

  it('returns 200 with token and user on successful login', async () => {
    jest.doMock('@/lib/models', () => ({
      User: { findOne: jest.fn().mockResolvedValue(mockUser) },
    }));
    const { POST } = await import('@/app/api/login/route');
    const res = await POST(makeRequest({ contact: 'kajal@test.com', password: 'secret123' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.token).toBe('string');
    expect(body.user.role).toBe('user');
  });

  it('sets httpOnly authToken cookie on successful login', async () => {
    jest.doMock('@/lib/models', () => ({
      User: { findOne: jest.fn().mockResolvedValue(mockUser) },
    }));
    const { POST } = await import('@/app/api/login/route');
    const res = await POST(makeRequest({ contact: 'kajal@test.com', password: 'secret123' }));
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toMatch(/authToken/);
    expect(setCookie).toMatch(/HttpOnly/i);
  });
});

// ─── /api/register ────────────────────────────────────────────────────────────

describe('POST /api/register', () => {
  const url = 'http://localhost/api/register';

  beforeEach(() => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/email', () => ({ sendMail: jest.fn().mockResolvedValue(undefined) }));
    jest.mock('bcryptjs', () => ({
      hash: jest.fn().mockImplementation(async (str: string) => `hashed:${str}`),
      compare: jest.fn().mockImplementation(async (plain: string, hashed: string) => hashed === `hashed:${plain}`),
    }));
  });

  it('returns 400 when required fields are missing', async () => {
    const { POST } = await import('@/app/api/register/route');
    const res = await POST(makeRequest({ name: '', contact: '', password: '' }, url));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toMatch(/required/i);
  });

  it('returns 400 for invalid contact format', async () => {
    jest.doMock('@/lib/models', () => ({
      User: { findOne: jest.fn().mockResolvedValue(null) },
    }));
    const { POST } = await import('@/app/api/register/route');
    const res = await POST(makeRequest({ name: 'Kajal', contact: 'notvalid', password: 'pass' }, url));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toMatch(/email|phone/i);
  });

  it('returns 400 if verified account already exists', async () => {
    jest.doMock('@/lib/models', () => ({
      User: { findOne: jest.fn().mockResolvedValue({ isVerified: true }) },
    }));
    const { POST } = await import('@/app/api/register/route');
    const res = await POST(makeRequest({ name: 'K', contact: 'kajal@test.com', password: 'p' }, url));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toMatch(/already exists/i);
  });

  it('accepts a valid Indian phone number', async () => {
    const userInstance = {
      contact: '9876543210',
      isVerified: false,
      verificationOtp: '',
      otpExpires: null,
      name: '',
      password: '',
      save: jest.fn().mockResolvedValue(undefined),
    };
    jest.doMock('@/lib/models', () => ({
      User: Object.assign(
        jest.fn().mockReturnValue(userInstance),
        { findOne: jest.fn().mockResolvedValue(null) }
      ),
    }));
    const { POST } = await import('@/app/api/register/route');
    const res = await POST(makeRequest({ name: 'Kajal', contact: '9876543210', password: 'secret' }, url));
    // Phone numbers skip email sending → 201 expected
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('returns 201 with requiresVerification=true for new email user', async () => {
    const userInstance = {
      contact: 'new@test.com',
      isVerified: false,
      verificationOtp: '',
      otpExpires: null,
      name: '',
      password: '',
      save: jest.fn().mockResolvedValue(undefined),
    };
    jest.doMock('@/lib/models', () => ({
      User: Object.assign(
        jest.fn().mockReturnValue(userInstance),
        { findOne: jest.fn().mockResolvedValue(null) }
      ),
    }));
    const { POST } = await import('@/app/api/register/route');
    const res = await POST(makeRequest({ name: 'New User', contact: 'new@test.com', password: 'pass123' }, url));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.requiresVerification).toBe(true);
  });
});
