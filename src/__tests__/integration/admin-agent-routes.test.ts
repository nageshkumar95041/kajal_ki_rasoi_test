/**
 * Integration Tests — Admin, Agent, Subscribe, Track, Google-login routes
 * Covers:
 *   GET  /api/admin/agents
 *   POST /api/admin/agents
 *   DELETE /api/admin/agents/[id]
 *   POST /api/admin/agents/assign
 *   GET  /api/admin/dashboard-stats
 *   GET  /api/admin/customers
 *   GET  /api/admin/pending-count
 *   GET  /api/admin/subscriptions
 *   GET  /api/admin/settings
 *   POST /api/admin/settings
 *   GET  /api/admin/users
 *   DELETE /api/admin/users/[id]
 *   PUT  /api/admin/users/[id]/role
 *   PUT  /api/admin/users/[id]/trust
 *   GET  /api/agent/orders
 *   PUT  /api/agent/status
 *   PUT  /api/agent/location
 *   POST /api/agent/deliver/[orderId]
 *   POST /api/subscribe
 *   GET  /api/track/[orderId]
 *   POST /api/google-login
 */

process.env.JWT_SECRET = 'test-secret-kajal-ki-rasoi';

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
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockImplementation(async (str: string) => `hashed:${str}`),
}));
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: jest.fn(),
  })),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function adminRequest(url: string, method = 'GET', body?: Record<string, unknown>): NextRequest {
  const token = signToken({ id: 'admin-id-123', role: 'admin' });
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

function agentRequest(url: string, method = 'GET', body?: Record<string, unknown>): NextRequest {
  const token = signToken({ id: 'agent-user-id', role: 'agent' });
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

function userRequest(url: string, method = 'GET', body?: Record<string, unknown>): NextRequest {
  const token = signToken({ id: 'user-id-123', role: 'user' });
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

function anonRequest(url: string, method = 'GET', body?: Record<string, unknown>): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

// ─── GET /api/admin/agents ────────────────────────────────────────────────────

describe('GET /api/admin/agents', () => {
  const URL = 'http://localhost/api/admin/agents';

  it('returns 401 when not authenticated', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ Agent: {}, User: {} }));
    const { GET } = await import('@/app/api/admin/agents/route');
    const res = await GET(anonRequest(URL));
    expect(res.status).toBe(401);
  });

  it('returns 403 when caller is not admin', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ Agent: {}, User: {} }));
    const { GET } = await import('@/app/api/admin/agents/route');
    const res = await GET(userRequest(URL));
    expect(res.status).toBe(403);
  });

  it('returns 200 with agents list for admin', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const mockAgents = [{ _id: 'a1', name: 'Raju', status: 'Available' }];
    jest.mock('@/lib/models', () => ({
      Agent: { find: jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue(mockAgents) }) },
      User: {},
    }));
    jest.mock('bcryptjs', () => ({ hash: jest.fn() }));
    const { GET } = await import('@/app/api/admin/agents/route');
    const res = await GET(adminRequest(URL));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.agents).toHaveLength(1);
  });
});

// ─── POST /api/admin/agents ───────────────────────────────────────────────────

describe('POST /api/admin/agents', () => {
  const URL = 'http://localhost/api/admin/agents';

  it('returns 400 when required fields are missing', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ Agent: {}, User: { findOne: jest.fn() } }));
    jest.mock('bcryptjs', () => ({ hash: jest.fn() }));
    const { POST } = await import('@/app/api/admin/agents/route');
    const res = await POST(adminRequest(URL, 'POST', { name: '', contact: '', password: '' }));
    expect(res.status).toBe(400);
  });

  it('returns 409 when agent with contact already exists', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({
      Agent: {},
      User: { findOne: jest.fn().mockResolvedValue({ role: 'agent' }) },
    }));
    jest.mock('bcryptjs', () => ({ hash: jest.fn() }));
    const { POST } = await import('@/app/api/admin/agents/route');
    const res = await POST(adminRequest(URL, 'POST', { name: 'Raju', contact: '9876543210', password: 'pass' }));
    expect(res.status).toBe(409);
  });

  it('creates agent and returns 200 for new contact', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const newAgent = { _id: 'agent-id', name: 'Raju', phone: '9876543210' };
    jest.mock('@/lib/models', () => ({
      Agent: { create: jest.fn().mockResolvedValue(newAgent) },
      User: {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ _id: 'user-id' }),
      },
    }));
    jest.mock('bcryptjs', () => ({ hash: jest.fn().mockResolvedValue('hashed:pass') }));
    const { POST } = await import('@/app/api/admin/agents/route');
    const res = await POST(adminRequest(URL, 'POST', { name: 'Raju', contact: '9876543210', password: 'pass123' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.agent.name).toBe('Raju');
  });
});

// ─── DELETE /api/admin/agents/[id] ───────────────────────────────────────────

describe('DELETE /api/admin/agents/[id]', () => {
  const URL = 'http://localhost/api/admin/agents/agent-id';

  it('returns 404 when agent not found', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({
      Agent: { findById: jest.fn().mockResolvedValue(null), findByIdAndDelete: jest.fn() },
      User: { findOneAndUpdate: jest.fn() },
    }));
    jest.mock('bcryptjs', () => ({ hash: jest.fn() }));
    const { DELETE } = await import('@/app/api/admin/agents/[id]/route');
    const res = await DELETE(adminRequest(URL, 'DELETE'), { params: { id: 'agent-id' } });
    expect(res.status).toBe(404);
  });

  it('deletes agent and downgrades user role', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const findOneAndUpdateMock = jest.fn().mockResolvedValue(undefined);
    const findByIdAndDeleteMock = jest.fn().mockResolvedValue(undefined);
    jest.mock('@/lib/models', () => ({
      Agent: { findById: jest.fn().mockResolvedValue({ _id: 'agent-id', userId: 'user-id' }), findByIdAndDelete: findByIdAndDeleteMock },
      User: { findOneAndUpdate: findOneAndUpdateMock },
    }));
    jest.mock('bcryptjs', () => ({ hash: jest.fn() }));
    const { DELETE } = await import('@/app/api/admin/agents/[id]/route');
    const res = await DELETE(adminRequest(URL, 'DELETE'), { params: { id: 'agent-id' } });
    expect(res.status).toBe(200);
    expect(findOneAndUpdateMock).toHaveBeenCalledWith({ _id: 'user-id' }, { $set: { role: 'user' } });
    expect(findByIdAndDeleteMock).toHaveBeenCalledWith('agent-id');
  });
});

// ─── POST /api/admin/agents/assign ───────────────────────────────────────────

describe('POST /api/admin/agents/assign', () => {
  const URL = 'http://localhost/api/admin/agents/assign';

  it('returns 400 when orderId or agentId is missing', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ Order: {}, Agent: {}, User: {} }));
    jest.mock('@/lib/socket', () => ({ emitOrderUpdate: jest.fn() }));
    jest.mock('@/lib/email', () => ({ sendMail: jest.fn() }));
    const { POST } = await import('@/app/api/admin/agents/assign/route');
    const res = await POST(adminRequest(URL, 'POST', { orderId: '', agentId: '' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when order not found', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({
      Order: { findById: jest.fn().mockResolvedValue(null) },
      Agent: {}, User: {},
    }));
    jest.mock('@/lib/socket', () => ({ emitOrderUpdate: jest.fn() }));
    jest.mock('@/lib/email', () => ({ sendMail: jest.fn() }));
    const { POST } = await import('@/app/api/admin/agents/assign/route');
    const res = await POST(adminRequest(URL, 'POST', { orderId: 'o1', agentId: 'a1' }));
    expect(res.status).toBe(404);
  });

  it('returns 400 when agent is at max capacity', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({
      Order: { findById: jest.fn().mockResolvedValue({ _id: 'o1', agentId: null, status: 'Preparing', save: jest.fn() }) },
      Agent: {
        findById: jest.fn().mockResolvedValue({ _id: 'a1', currentLoad: 5, maxBatchLimit: 5, status: 'Available', name: 'Raju' }),
        findOneAndUpdate: jest.fn().mockResolvedValue(null),
      },
      User: {},
    }));
    jest.mock('@/lib/socket', () => ({ emitOrderUpdate: jest.fn() }));
    jest.mock('@/lib/email', () => ({ sendMail: jest.fn() }));
    const { POST } = await import('@/app/api/admin/agents/assign/route');
    const res = await POST(adminRequest(URL, 'POST', { orderId: 'o1', agentId: 'a1' }));
    expect(res.status).toBe(400);
  });

  it('assigns agent to order and returns 200', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const orderMock = { _id: 'o1', agentId: null, status: 'Preparing', customerName: 'Kajal', contact: 'kajal@test.com', userId: null, total: 200, save: jest.fn() };
    jest.mock('@/lib/models', () => ({
      Order: { findById: jest.fn().mockResolvedValue(orderMock) },
      Agent: {
        findById: jest.fn().mockResolvedValue({ _id: 'a1', name: 'Raju', status: 'Available', currentLoad: 0, maxBatchLimit: 5 }),
        findOneAndUpdate: jest.fn().mockResolvedValue({ _id: 'a1', name: 'Raju', status: 'Busy', currentLoad: 1, maxBatchLimit: 5 }),
        findByIdAndUpdate: jest.fn().mockResolvedValue(undefined),
      },
      User: { findById: jest.fn().mockResolvedValue(null) },
    }));
    jest.mock('@/lib/socket', () => ({ emitOrderUpdate: jest.fn() }));
    jest.mock('@/lib/email', () => ({ sendMail: jest.fn().mockResolvedValue(undefined) }));
    const { POST } = await import('@/app/api/admin/agents/assign/route');
    const res = await POST(adminRequest(URL, 'POST', { orderId: 'o1', agentId: 'a1' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.deliveryOtp).toBe('string');
    expect(orderMock.status).toBe('Out for Delivery');
  });
});

// ─── GET /api/admin/dashboard-stats ──────────────────────────────────────────

describe('GET /api/admin/dashboard-stats', () => {
  const URL = 'http://localhost/api/admin/dashboard-stats';

  it('returns 401 when not authenticated', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ Order: { aggregate: jest.fn() } }));
    const { GET } = await import('@/app/api/admin/dashboard-stats/route');
    const res = await GET(anonRequest(URL));
    expect(res.status).toBe(401);
  });

  it('returns 200 with stats for admin', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({
      Order: {
        aggregate: jest.fn()
          .mockResolvedValueOnce([{ today: [{ total: 500 }], week: [{ total: 2000 }], month: [{ total: 8000 }] }])
          .mockResolvedValueOnce([{ _id: 'Pending', count: 3 }, { _id: 'Completed', count: 10 }])
          .mockResolvedValueOnce([{ _id: 'Dal Makhani', count: 15 }]),
      },
    }));
    const { GET } = await import('@/app/api/admin/dashboard-stats/route');
    const res = await GET(adminRequest(URL));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.revenue.today).toBe(500);
    expect(body.pendingCount).toBe(3);
    expect(body.topItems).toHaveLength(1);
  });
});

// ─── GET /api/admin/customers ─────────────────────────────────────────────────

describe('GET /api/admin/customers', () => {
  const URL = 'http://localhost/api/admin/customers';

  it('returns 401 when not authenticated', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ Order: { aggregate: jest.fn() } }));
    const { GET } = await import('@/app/api/admin/customers/route');
    const res = await GET(anonRequest(URL));
    expect(res.status).toBe(401);
  });

  it('returns 200 with customers list for admin', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const mockCustomers = [{ _id: 'kajal@test.com', name: 'Kajal', orderCount: 5, totalSpent: 1200 }];
    jest.mock('@/lib/models', () => ({
      Order: { aggregate: jest.fn().mockResolvedValue(mockCustomers) },
    }));
    const { GET } = await import('@/app/api/admin/customers/route');
    const res = await GET(adminRequest(URL));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.customers).toHaveLength(1);
  });
});

// ─── GET /api/admin/pending-count ────────────────────────────────────────────

describe('GET /api/admin/pending-count', () => {
  const URL = 'http://localhost/api/admin/pending-count';

  it('returns 401 when not authenticated', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ Order: { countDocuments: jest.fn() } }));
    const { GET } = await import('@/app/api/admin/pending-count/route');
    const res = await GET(anonRequest(URL));
    expect(res.status).toBe(401);
  });

  it('returns 200 with pending count for admin', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ Order: { countDocuments: jest.fn().mockResolvedValue(7) } }));
    const { GET } = await import('@/app/api/admin/pending-count/route');
    const res = await GET(adminRequest(URL));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.count).toBe(7);
  });
});

// ─── GET /api/admin/subscriptions ────────────────────────────────────────────

describe('GET /api/admin/subscriptions', () => {
  const URL = 'http://localhost/api/admin/subscriptions';

  it('returns 401 when not authenticated', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ Subscription: { find: jest.fn() } }));
    const { GET } = await import('@/app/api/admin/subscriptions/route');
    const res = await GET(anonRequest(URL));
    expect(res.status).toBe(401);
  });

  it('returns 200 with all subscriptions for admin', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const mockSubs = [{ _id: 's1', plan: 'Monthly', status: 'Active' }];
    jest.mock('@/lib/models', () => ({
      Subscription: { find: jest.fn().mockReturnValue({ sort: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(mockSubs) }) },
    }));
    const { GET } = await import('@/app/api/admin/subscriptions/route');
    const res = await GET(adminRequest(URL));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.subscriptions).toHaveLength(1);
  });
});

// ─── GET & POST /api/admin/settings ──────────────────────────────────────────

describe('GET /api/admin/settings', () => {
  const URL = 'http://localhost/api/admin/settings?key=onlinePaymentEnabled';

  it('returns 400 when key is missing', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ SiteSettings: { findOne: jest.fn() } }));
    const { GET } = await import('@/app/api/admin/settings/route');
    const res = await GET(anonRequest('http://localhost/api/admin/settings'));
    expect(res.status).toBe(400);
  });

  it('returns 200 with setting value', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({
      SiteSettings: { findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ key: 'onlinePaymentEnabled', value: true }) }) },
    }));
    const { GET } = await import('@/app/api/admin/settings/route');
    const res = await GET(anonRequest(URL));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.value).toBe(true);
  });
});

describe('POST /api/admin/settings', () => {
  const URL = 'http://localhost/api/admin/settings';

  it('returns 401 when not admin', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ SiteSettings: { findOneAndUpdate: jest.fn() } }));
    const { POST } = await import('@/app/api/admin/settings/route');
    const res = await POST(anonRequest(URL, 'POST', { key: 'onlinePaymentEnabled', value: true }));
    expect(res.status).toBe(401);
  });

  it('saves setting and returns 200 for admin', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({
      SiteSettings: { findOneAndUpdate: jest.fn().mockResolvedValue({ key: 'onlinePaymentEnabled', value: true }) },
    }));
    const { POST } = await import('@/app/api/admin/settings/route');
    const res = await POST(adminRequest(URL, 'POST', { key: 'onlinePaymentEnabled', value: true }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.value).toBe(true);
  });
});

// ─── GET /api/admin/users ─────────────────────────────────────────────────────

describe('GET /api/admin/users', () => {
  const URL = 'http://localhost/api/admin/users';

  it('returns 401 when not authenticated', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ User: { find: jest.fn() } }));
    const { GET } = await import('@/app/api/admin/users/route');
    const res = await GET(anonRequest(URL));
    expect(res.status).toBe(401);
  });

  it('returns 200 with users list for admin', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const mockUsers = [{ _id: 'u1', name: 'Kajal', contact: 'kajal@test.com', role: 'user' }];
    jest.mock('@/lib/models', () => ({
      User: { find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(mockUsers) }) },
    }));
    const { GET } = await import('@/app/api/admin/users/route');
    const res = await GET(adminRequest(URL));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].name).toBe('Kajal');
  });
});

// ─── DELETE /api/admin/users/[id] ────────────────────────────────────────────

describe('DELETE /api/admin/users/[id]', () => {
  const URL = 'http://localhost/api/admin/users/u1';

  it('returns 401 when not authenticated', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ User: { findByIdAndDelete: jest.fn() } }));
    const { DELETE } = await import('@/app/api/admin/users/[id]/route');
    const res = await DELETE(anonRequest(URL, 'DELETE'), { params: { id: 'u1' } });
    expect(res.status).toBe(401);
  });

  it('deletes user and returns 200 for admin', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const deleteMock = jest.fn().mockResolvedValue(undefined);
    jest.mock('@/lib/models', () => ({ User: { findByIdAndDelete: deleteMock } }));
    const { DELETE } = await import('@/app/api/admin/users/[id]/route');
    const res = await DELETE(adminRequest(URL, 'DELETE'), { params: { id: 'u1' } });
    expect(res.status).toBe(200);
    expect(deleteMock).toHaveBeenCalledWith('u1');
  });
});

// ─── PUT /api/admin/users/[id]/role ──────────────────────────────────────────

describe('PUT /api/admin/users/[id]/role', () => {
  const URL = 'http://localhost/api/admin/users/u1/role';

  it('returns 400 for invalid role', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ User: { findByIdAndUpdate: jest.fn() } }));
    const { PUT } = await import('@/app/api/admin/users/[id]/role/route');
    const res = await PUT(adminRequest(URL, 'PUT', { role: 'superuser' }), { params: { id: 'u1' } });
    expect(res.status).toBe(400);
  });

  it('updates role to agent and auto-verifies', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const updateMock = jest.fn().mockResolvedValue({ _id: 'u1', role: 'agent', isVerified: true });
    jest.mock('@/lib/models', () => ({ User: { findByIdAndUpdate: updateMock } }));
    const { PUT } = await import('@/app/api/admin/users/[id]/role/route');
    const res = await PUT(adminRequest(URL, 'PUT', { role: 'agent' }), { params: { id: 'u1' } });
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith('u1', { role: 'agent', isVerified: true }, { new: true });
  });
});

// ─── PUT /api/admin/users/[id]/trust ─────────────────────────────────────────

describe('PUT /api/admin/users/[id]/trust', () => {
  const URL = 'http://localhost/api/admin/users/u1/trust';

  it('returns 401 when not admin', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ User: { findByIdAndUpdate: jest.fn() } }));
    const { PUT } = await import('@/app/api/admin/users/[id]/trust/route');
    const res = await PUT(anonRequest(URL, 'PUT', { isTrusted: true }), { params: { id: 'u1' } });
    expect(res.status).toBe(401);
  });

  it('updates isTrusted and returns 200', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const updateMock = jest.fn().mockResolvedValue({ _id: 'u1', isTrusted: true });
    jest.mock('@/lib/models', () => ({ User: { findByIdAndUpdate: updateMock } }));
    const { PUT } = await import('@/app/api/admin/users/[id]/trust/route');
    const res = await PUT(adminRequest(URL, 'PUT', { isTrusted: true }), { params: { id: 'u1' } });
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith('u1', { isTrusted: true }, { new: true });
  });
});

// ─── GET /api/agent/orders ────────────────────────────────────────────────────

describe('GET /api/agent/orders', () => {
  const URL = 'http://localhost/api/agent/orders';

  it('returns 401 when not authenticated', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ Order: {}, Agent: {} }));
    const { GET } = await import('@/app/api/agent/orders/route');
    const res = await GET(anonRequest(URL));
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-agent users', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ Order: {}, Agent: {} }));
    const { GET } = await import('@/app/api/agent/orders/route');
    const res = await GET(userRequest(URL));
    expect(res.status).toBe(403);
  });

  it('returns 404 when agent profile not found', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({
      Order: {},
      Agent: { findOne: jest.fn().mockResolvedValue(null) },
    }));
    const { GET } = await import('@/app/api/agent/orders/route');
    const res = await GET(agentRequest(URL));
    expect(res.status).toBe(404);
  });

  it('returns 200 with orders for valid agent', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const mockOrders = [{ _id: 'o1', status: 'Out for Delivery' }];
    jest.mock('@/lib/models', () => ({
      Agent: { findOne: jest.fn().mockResolvedValue({ _id: 'a1', name: 'Raju', status: 'Busy', currentLoad: 1, maxBatchLimit: 5 }) },
      Order: { find: jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue(mockOrders) }) },
    }));
    const { GET } = await import('@/app/api/agent/orders/route');
    const res = await GET(agentRequest(URL));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.orders).toHaveLength(1);
  });
});

// ─── PUT /api/agent/status ────────────────────────────────────────────────────

describe('PUT /api/agent/status', () => {
  const URL = 'http://localhost/api/agent/status';

  it('returns 400 for invalid status value', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ Agent: { findOneAndUpdate: jest.fn() } }));
    const { PUT } = await import('@/app/api/agent/status/route');
    const res = await PUT(agentRequest(URL, 'PUT', { status: 'OnBreak' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when agent profile not found', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ Agent: { findOneAndUpdate: jest.fn().mockResolvedValue(null) } }));
    const { PUT } = await import('@/app/api/agent/status/route');
    const res = await PUT(agentRequest(URL, 'PUT', { status: 'Available' }));
    expect(res.status).toBe(404);
  });

  it('updates agent status and returns 200', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const mockAgent = { _id: 'a1', status: 'Available' };
    jest.mock('@/lib/models', () => ({ Agent: { findOneAndUpdate: jest.fn().mockResolvedValue(mockAgent) } }));
    const { PUT } = await import('@/app/api/agent/status/route');
    const res = await PUT(agentRequest(URL, 'PUT', { status: 'Available' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

// ─── PUT /api/agent/location ──────────────────────────────────────────────────

describe('PUT /api/agent/location', () => {
  const URL = 'http://localhost/api/agent/location';

  it('returns 400 when lat or lng is missing', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ Agent: { findOneAndUpdate: jest.fn() } }));
    const { PUT } = await import('@/app/api/agent/location/route');
    const res = await PUT(agentRequest(URL, 'PUT', { lat: null, lng: null }));
    expect(res.status).toBe(400);
  });

  it('updates location and returns 200', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const updateMock = jest.fn().mockResolvedValue(undefined);
    jest.mock('@/lib/models', () => ({ Agent: { findOneAndUpdate: updateMock } }));
    const { PUT } = await import('@/app/api/agent/location/route');
    const res = await PUT(agentRequest(URL, 'PUT', { lat: 28.5, lng: 77.3 }));
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalled();
  });
});

// ─── POST /api/agent/deliver/[orderId] ───────────────────────────────────────

describe('POST /api/agent/deliver/[orderId]', () => {
  const URL = 'http://localhost/api/agent/deliver/o1';

  it('returns 404 when order not found', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({
      Order: { findById: jest.fn().mockResolvedValue(null) },
      Agent: {},
    }));
    jest.mock('@/lib/socket', () => ({ emitOrderUpdate: jest.fn() }));
    const { POST } = await import('@/app/api/agent/deliver/[orderId]/route');
    const res = await POST(agentRequest(URL, 'POST', { otp: '1234' }), { params: { orderId: 'o1' } });
    expect(res.status).toBe(404);
  });

  it('returns 400 when OTP is wrong', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({
      Order: { findById: jest.fn().mockResolvedValue({ agentId: 'a1', deliveryOtp: '5678', status: 'Out for Delivery', save: jest.fn() }) },
      Agent: { findOne: jest.fn().mockResolvedValue({ _id: 'a1' }), findByIdAndUpdate: jest.fn() },
    }));
    jest.mock('@/lib/socket', () => ({ emitOrderUpdate: jest.fn() }));
    const { POST } = await import('@/app/api/agent/deliver/[orderId]/route');
    const res = await POST(agentRequest(URL, 'POST', { otp: '9999' }), { params: { orderId: 'o1' } });
    expect(res.status).toBe(400);
  });

  it('marks order as Completed on valid OTP', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const orderMock = { _id: 'o1', agentId: 'a1', deliveryOtp: '1234', status: 'Out for Delivery', save: jest.fn() };
    jest.mock('@/lib/models', () => ({
      Order: { findById: jest.fn().mockResolvedValue(orderMock) },
      Agent: {
        findOne: jest.fn().mockResolvedValue({ _id: 'a1' }),
        findByIdAndUpdate: jest.fn().mockResolvedValue(undefined),
      },
    }));
    jest.mock('@/lib/socket', () => ({ emitOrderUpdate: jest.fn() }));
    const { POST } = await import('@/app/api/agent/deliver/[orderId]/route');
    const res = await POST(agentRequest(URL, 'POST', { otp: '1234' }), { params: { orderId: 'o1' } });
    expect(res.status).toBe(200);
    expect(orderMock.status).toBe('Completed');
    expect(orderMock.save).toHaveBeenCalled();
  });
});

// ─── POST /api/subscribe ──────────────────────────────────────────────────────

describe('POST /api/subscribe', () => {
  const URL = 'http://localhost/api/subscribe';

  it('returns 400 when required fields are missing', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ Subscription: { findOne: jest.fn(), create: jest.fn() } }));
    const { POST } = await import('@/app/api/subscribe/route');
    const res = await POST(anonRequest(URL, 'POST', { plan: '', customerName: '', contact: '', address: '', startDate: '' }));
    expect(res.status).toBe(400);
  });

  it('returns 409 when user already has active subscription', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({
      Subscription: { findOne: jest.fn().mockResolvedValue({ plan: 'Monthly', status: 'Active' }), create: jest.fn() },
    }));
    const { POST } = await import('@/app/api/subscribe/route');
    const res = await POST(userRequest(URL, 'POST', {
      plan: 'Standard Thali', frequency: 7, customerName: 'Kajal', contact: 'kajal@test.com',
      address: '123 Test St', startDate: '2026-05-01',
    }));
    expect(res.status).toBe(409);
  });

  it('creates subscription and returns 201', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const createMock = jest.fn().mockResolvedValue({ _id: 'sub1' });
    jest.mock('@/lib/models', () => ({
      Subscription: { findOne: jest.fn().mockResolvedValue(null), create: createMock },
    }));
    const { POST } = await import('@/app/api/subscribe/route');
    const res = await POST(anonRequest(URL, 'POST', {
      plan: 'Standard Thali', frequency: 7, customerName: 'Kajal', contact: 'kajal@test.com',
      address: '123 Test St', startDate: '2026-05-01', persons: 2, couponCode: 'APNA50',
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(createMock).toHaveBeenCalled();
  });
});

// ─── GET /api/track/[orderId] ─────────────────────────────────────────────────

describe('GET /api/track/[orderId]', () => {
  const URL = 'http://localhost/api/track/o1';

  it('returns 404 when order not found', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ Order: { findById: jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(null) }) } }));
    jest.mock('@/lib/borzo', () => ({ RESTAURANT_LAT: 28.5, RESTAURANT_LNG: 77.3 }));
    const { GET } = await import('@/app/api/track/[orderId]/route');
    const res = await GET(anonRequest(URL), { params: { orderId: 'o1' } });
    expect(res.status).toBe(404);
  });

  it('returns 200 with tracking data for valid order', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const mockOrder = { _id: 'o1', status: 'Preparing', customerLat: 28.5, customerLng: 77.3, inHouseDelivery: false, agentId: null, borzoTrackingUrl: null, deliveryOtp: null };
    jest.mock('@/lib/models', () => ({ Order: { findById: jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(mockOrder) }) } }));
    jest.mock('@/lib/borzo', () => ({ RESTAURANT_LAT: 28.5, RESTAURANT_LNG: 77.3 }));
    const { GET } = await import('@/app/api/track/[orderId]/route');
    const res = await GET(anonRequest(URL), { params: { orderId: 'o1' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.status).toBe('Preparing');
    expect(body.restaurantLat).toBe(28.5);
  });

  it('includes deliveryOtp when order is Out for Delivery', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const mockOrder = { _id: 'o1', status: 'Out for Delivery', customerLat: 28.5, customerLng: 77.3, inHouseDelivery: true, agentId: { name: 'Raju', phone: '9876543210' }, borzoTrackingUrl: null, deliveryOtp: '4321' };
    jest.mock('@/lib/models', () => ({ Order: { findById: jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(mockOrder) }) } }));
    jest.mock('@/lib/borzo', () => ({ RESTAURANT_LAT: 28.5, RESTAURANT_LNG: 77.3 }));
    const { GET } = await import('@/app/api/track/[orderId]/route');
    const res = await GET(anonRequest(URL), { params: { orderId: 'o1' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deliveryOtp).toBe('4321');
    expect(body.agentName).toBe('Raju');
  });
});

// ─── POST /api/google-login ───────────────────────────────────────────────────

describe('POST /api/google-login', () => {
  const URL = 'http://localhost/api/google-login';

  it('returns 400 when token is missing', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ User: {} }));
    jest.mock('google-auth-library', () => ({ OAuth2Client: jest.fn().mockImplementation(() => ({ verifyIdToken: jest.fn() })) }));
    jest.mock('bcrypt', () => ({ hash: jest.fn() }));
    const { POST } = await import('@/app/api/google-login/route');
    const res = await POST(anonRequest(URL, 'POST', { token: '' }));
    expect(res.status).toBe(400);
  });

  it('returns 401 for invalid Google token', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    jest.mock('@/lib/models', () => ({ User: {} }));
    jest.mock('google-auth-library', () => ({
      OAuth2Client: jest.fn().mockImplementation(() => ({
        verifyIdToken: jest.fn().mockRejectedValue(new Error('Invalid token')),
      })),
    }));
    jest.mock('bcrypt', () => ({ hash: jest.fn() }));
    const { POST } = await import('@/app/api/google-login/route');
    const res = await POST(anonRequest(URL, 'POST', { token: 'bad-token' }));
    expect(res.status).toBe(401);
  });

  it('returns 200 and creates new user for first-time Google login', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const newUser = { _id: { toString: () => 'u1' }, name: 'Kajal', contact: 'kajal@gmail.com', role: 'user' };
    jest.mock('@/lib/models', () => ({
      User: { findOne: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(newUser) },
    }));
    jest.mock('google-auth-library', () => ({
      OAuth2Client: jest.fn().mockImplementation(() => ({
        verifyIdToken: jest.fn().mockResolvedValue({
          getPayload: () => ({ email: 'kajal@gmail.com', name: 'Kajal' }),
        }),
      })),
    }));
    jest.mock('bcrypt', () => ({ hash: jest.fn().mockResolvedValue('hashed:rp') }));
    const { POST } = await import('@/app/api/google-login/route');
    const res = await POST(anonRequest(URL, 'POST', { token: 'valid-google-token' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.token).toBe('string');
    expect(body.user.contact).toBe('kajal@gmail.com');
  });

  it('returns 200 and logs in existing Google user', async () => {
    jest.resetModules();
    jest.mock('@/lib/mongodb', () => ({ connectDB: jest.fn() }));
    const existingUser = { _id: { toString: () => 'u1' }, name: 'Kajal', contact: 'kajal@gmail.com', role: 'user' };
    jest.mock('@/lib/models', () => ({
      User: { findOne: jest.fn().mockResolvedValue(existingUser), create: jest.fn() },
    }));
    jest.mock('google-auth-library', () => ({
      OAuth2Client: jest.fn().mockImplementation(() => ({
        verifyIdToken: jest.fn().mockResolvedValue({
          getPayload: () => ({ email: 'kajal@gmail.com', name: 'Kajal' }),
        }),
      })),
    }));
    jest.mock('bcrypt', () => ({ hash: jest.fn() }));
    const { POST } = await import('@/app/api/google-login/route');
    const res = await POST(anonRequest(URL, 'POST', { token: 'valid-google-token' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
