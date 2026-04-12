/**
 * Integration Tests — Missing coverage routes
 * Covers:
 *   GET /api/config/google
 *   GET /api/config/stripe
 *   GET /api/config/google-maps
 *   POST /api/verify-session
 *   GET  /api/agent/debug
 */

process.env.JWT_SECRET          = 'test-secret-kajal-ki-rasoi';
process.env.STRIPE_SECRET_KEY   = 'sk_test_dummy';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_dummy';

import { NextRequest } from 'next/server';
import { signToken } from '@/lib/auth';

beforeEach(() => {
  jest.unmock('@/lib/auth');
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function authedReq(url: string, role: 'admin' | 'user' | 'agent' = 'user', method = 'GET', body?: Record<string, unknown>): NextRequest {
  const token = signToken({ id: 'user-id-123', role });
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
// GET /api/config/google
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/config/google', () => {
  const URL = 'http://localhost/api/config/google';

  it('returns 200 with clientId from env', async () => {
    jest.resetModules();
    process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
    const { GET } = await import('@/app/api/config/google/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.clientId).toBe('test-google-client-id');
  });

  it('returns an empty payload when env is not set', async () => {
    jest.resetModules();
    delete process.env.GOOGLE_CLIENT_ID;
    const { GET } = await import('@/app/api/config/google/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({});
    expect(body.clientId).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/config/stripe
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/config/stripe', () => {
  it('returns 200 with publishableKey from env', async () => {
    jest.resetModules();
    process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_dummy_key';
    const { GET } = await import('@/app/api/config/stripe/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.publishableKey).toBe('pk_test_dummy_key');
  });

  it('returns an empty payload when env is not set', async () => {
    jest.resetModules();
    delete process.env.STRIPE_PUBLISHABLE_KEY;
    const { GET } = await import('@/app/api/config/stripe/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({});
    expect(body.publishableKey).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/config/google-maps
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/config/google-maps', () => {
  it('returns 500 when GOOGLE_MAPS_API_KEY is not set', async () => {
    jest.resetModules();
    delete process.env.GOOGLE_MAPS_API_KEY;
    const { GET } = await import('@/app/api/config/google-maps/route');
    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('returns 200 with apiKey when env is set', async () => {
    jest.resetModules();
    process.env.GOOGLE_MAPS_API_KEY = 'test-maps-key';
    const { GET } = await import('@/app/api/config/google-maps/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.apiKey).toBe('test-maps-key');
    delete process.env.GOOGLE_MAPS_API_KEY;
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/verify-session
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/verify-session', () => {
  const URL = 'http://localhost/api/verify-session';

  it('returns 401 when not authenticated', async () => {
    jest.resetModules();
    jest.mock('stripe', () => ({
      default: jest.fn().mockImplementation(() => ({
        checkout: { sessions: { retrieve: jest.fn() } },
      })),
    }));
    const { POST } = await import('@/app/api/verify-session/route');
    const res = await POST(anonReq(URL, 'POST', { sessionId: 'sess_123' }));
    expect(res.status).toBe(401);
  });

  it('returns 200 when session payment_status is paid', async () => {
    jest.resetModules();
    jest.mock('stripe', () => ({
      default: jest.fn().mockImplementation(() => ({
        checkout: {
          sessions: {
            retrieve: jest.fn().mockResolvedValue({ payment_status: 'paid' }),
          },
        },
      })),
    }));
    const { POST } = await import('@/app/api/verify-session/route');
    const res = await POST(authedReq(URL, 'user', 'POST', { sessionId: 'sess_123' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('returns success false when payment is not completed', async () => {
    jest.resetModules();
    jest.mock('stripe', () => ({
      default: jest.fn().mockImplementation(() => ({
        checkout: {
          sessions: {
            retrieve: jest.fn().mockResolvedValue({ payment_status: 'unpaid' }),
          },
        },
      })),
    }));
    const { POST } = await import('@/app/api/verify-session/route');
    const res = await POST(authedReq(URL, 'user', 'POST', { sessionId: 'sess_unpaid' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/agent/debug
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/agent/debug', () => {
  const URL = 'http://localhost/api/agent/debug';

  it('returns 401 when not authenticated', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ Order: {}, Agent: {} }));
    const { GET } = await import('@/app/api/agent/debug/route');
    const res = await GET(anonReq(URL));
    expect(res.status).toBe(401);
  });

  it('returns 200 with debug info for authenticated user', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn().mockResolvedValue(undefined) }));
    const mockAgent = { _id: 'a1', userId: 'user-id-123', name: 'Raju' };
    jest.mock('@/lib/models', () => ({
      Agent: {
        findOne: jest.fn().mockResolvedValue(mockAgent),
        find: jest.fn().mockResolvedValue([mockAgent]),
      },
      Order: {
        find: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue([]),
        }),
      },
    }));
    const { GET } = await import('@/app/api/agent/debug/route');
    const res = await GET(authedReq(URL, 'agent'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.jwtUserId).toBe('user-id-123');
    expect(body.agentFound).toBe(true);
    expect(body.agentName).toBe('Raju');
    expect(Array.isArray(body.allAgents)).toBe(true);
    expect(Array.isArray(body.activeOrders)).toBe(true);
  });

  it('returns agentFound false when no agent profile exists', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn().mockResolvedValue(undefined) }));
    jest.mock('@/lib/models', () => ({
      Agent: {
        findOne: jest.fn().mockResolvedValue(null),
        find: jest.fn().mockResolvedValue([]),
      },
      Order: {
        find: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue([]),
        }),
      },
    }));
    const { GET } = await import('@/app/api/agent/debug/route');
    const res = await GET(authedReq(URL, 'user'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.agentFound).toBe(false);
  });
});
