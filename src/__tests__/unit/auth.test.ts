/**
 * Unit Tests — src/lib/auth.ts
 * Covers: signToken, verifyToken, getTokenFromRequest,
 *         requireAuth, requireAdmin, optionalAuth
 */

// MUST be set before any module that reads JWT_SECRET at import time
process.env.JWT_SECRET = 'test-secret-kajal-ki-rasoi';

import { NextRequest } from 'next/server';
import {
  signToken,
  verifyToken,
  getTokenFromRequest,
  requireAuth,
  requireAdmin,
  optionalAuth,
} from '@/lib/auth';

// ─── Helper ───────────────────────────────────────────────────────────────────

function makeRequest(authHeader?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (authHeader) headers['authorization'] = authHeader;
  return new NextRequest('http://localhost/api/test', { headers });
}

// ─── signToken ────────────────────────────────────────────────────────────────

describe('signToken', () => {
  it('returns a non-empty JWT string', () => {
    const token = signToken({ id: 'user123', role: 'user' });
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });

  it('embeds the correct payload', () => {
    const token = signToken({ id: 'abc', role: 'admin' });
    const decoded = verifyToken(token);
    expect(decoded?.id).toBe('abc');
    expect(decoded?.role).toBe('admin');
  });
});

// ─── verifyToken ──────────────────────────────────────────────────────────────

describe('verifyToken', () => {
  it('verifies a freshly signed token', () => {
    const token = signToken({ id: 'u1', role: 'user' });
    const result = verifyToken(token);
    expect(result).not.toBeNull();
    expect(result?.id).toBe('u1');
  });

  it('returns null for a tampered token', () => {
    const token = signToken({ id: 'u1', role: 'user' });
    const tampered = token.slice(0, -5) + 'XXXXX';
    expect(verifyToken(tampered)).toBeNull();
  });

  it('returns null for a completely invalid string', () => {
    expect(verifyToken('not.a.token')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(verifyToken('')).toBeNull();
  });
});

// ─── getTokenFromRequest ──────────────────────────────────────────────────────

describe('getTokenFromRequest', () => {
  it('extracts Bearer token from Authorization header', () => {
    const req = makeRequest('Bearer mytoken123');
    expect(getTokenFromRequest(req)).toBe('mytoken123');
  });

  it('returns null when no Authorization header', () => {
    const req = makeRequest();
    expect(getTokenFromRequest(req)).toBeNull();
  });

  it('returns null for non-Bearer scheme', () => {
    const req = makeRequest('Basic someBase64==');
    expect(getTokenFromRequest(req)).toBeNull();
  });

  it('returns null for malformed header (no space)', () => {
    const req = makeRequest('BearerNoSpace');
    expect(getTokenFromRequest(req)).toBeNull();
  });
});

// ─── requireAuth ─────────────────────────────────────────────────────────────

describe('requireAuth', () => {
  it('returns { user } for a valid token', () => {
    const token = signToken({ id: 'u1', role: 'user' });
    const req = makeRequest(`Bearer ${token}`);
    const result = requireAuth(req);
    expect('user' in result).toBe(true);
  });

  it('returns 401 NextResponse when no token', async () => {
    const req = makeRequest();
    const result = requireAuth(req);
    expect(result).toHaveProperty('status', 401);
    const body = await (result as Response).json();
    expect(body.success).toBe(false);
  });

  it('returns 403 NextResponse for invalid token', async () => {
    const req = makeRequest('Bearer invalid.token.here');
    const result = requireAuth(req);
    expect(result).toHaveProperty('status', 403);
  });
});

// ─── requireAdmin ─────────────────────────────────────────────────────────────

describe('requireAdmin', () => {
  it('returns { user } for a valid admin token', () => {
    const token = signToken({ id: 'admin1', role: 'admin' });
    const req = makeRequest(`Bearer ${token}`);
    const result = requireAdmin(req);
    expect('user' in result).toBe(true);
    if ('user' in result) {
      expect(result.user.role).toBe('admin');
    }
  });

  it('returns 403 for a non-admin user', async () => {
    const token = signToken({ id: 'u1', role: 'user' });
    const req = makeRequest(`Bearer ${token}`);
    const result = requireAdmin(req);
    expect(result).toHaveProperty('status', 403);
    const body = await (result as Response).json();
    expect(body.message).toMatch(/admin/i);
  });

  it('returns 401 when no token is provided', () => {
    const req = makeRequest();
    const result = requireAdmin(req);
    expect(result).toHaveProperty('status', 401);
  });
});

// ─── optionalAuth ─────────────────────────────────────────────────────────────

describe('optionalAuth', () => {
  it('returns user payload for a valid token', () => {
    const token = signToken({ id: 'u2', role: 'user' });
    const req = makeRequest(`Bearer ${token}`);
    const result = optionalAuth(req);
    expect(result?.id).toBe('u2');
  });

  it('returns null when no token is present', () => {
    const req = makeRequest();
    expect(optionalAuth(req)).toBeNull();
  });

  it('returns null for an invalid token', () => {
    const req = makeRequest('Bearer garbage');
    expect(optionalAuth(req)).toBeNull();
  });
});
