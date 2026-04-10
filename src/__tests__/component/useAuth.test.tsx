/**
 * Component / Hook Tests — src/hooks/useAuth.ts
 * Uses React Testing Library's renderHook with a mocked router.
 */

import { renderHook, act } from '@testing-library/react';
import { useAuth } from '@/hooks/useAuth';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPush    = jest.fn();
const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

// Controlled localStorage
const mockStorage: Record<string, string> = {};
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem:    (k: string) => mockStorage[k] ?? null,
    setItem:    (k: string, v: string) => { mockStorage[k] = v; },
    removeItem: (k: string) => { delete mockStorage[k]; },
    clear:      () => Object.keys(mockStorage).forEach(k => delete mockStorage[k]),
  },
  writable: true,
});

// Token helpers
function futureToken(): string {
  const payload = { exp: Math.floor(Date.now() / 1000) + 3600 };
  return `h.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.s`;
}
function expiredToken(): string {
  const payload = { exp: Math.floor(Date.now() / 1000) - 3600 };
  return `h.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.s`;
}

const VALID_USER = JSON.stringify({ name: 'Kajal', contact: 'k@test.com', role: 'user' });
const ADMIN_USER = JSON.stringify({ name: 'Admin', contact: 'a@test.com', role: 'admin' });

beforeEach(() => {
  Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
  mockPush.mockClear();
  mockReplace.mockClear();
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useAuth', () => {
  it('returns user and token when valid token is stored', () => {
    mockStorage['authToken']    = futureToken();
    mockStorage['loggedInUser'] = VALID_USER;

    const { result } = renderHook(() => useAuth());
    expect(result.current.user?.name).toBe('Kajal');
    expect(result.current.token).not.toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('returns null user when no token is stored', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
  });

  it('returns null user when token is expired', () => {
    mockStorage['authToken']    = expiredToken();
    mockStorage['loggedInUser'] = VALID_USER;

    const { result } = renderHook(() => useAuth());
    expect(result.current.user).toBeNull();
  });

  it('redirects to /login when requireLogin=true and no token', () => {
    renderHook(() => useAuth(true));
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });

  it('does NOT redirect when requireLogin=true and valid token exists', () => {
    mockStorage['authToken']    = futureToken();
    mockStorage['loggedInUser'] = VALID_USER;

    renderHook(() => useAuth(true));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('redirects non-admin to /login when requireAdmin=true', () => {
    mockStorage['authToken']    = futureToken();
    mockStorage['loggedInUser'] = VALID_USER; // role: 'user'

    renderHook(() => useAuth(false, true));
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });

  it('does NOT redirect admin when requireAdmin=true', () => {
    mockStorage['authToken']    = futureToken();
    mockStorage['loggedInUser'] = ADMIN_USER;

    renderHook(() => useAuth(false, true));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('clears state and navigates to /login on logout', async () => {
    mockStorage['authToken']    = futureToken();
    mockStorage['loggedInUser'] = VALID_USER;

    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.logout(); });

    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('refresh() re-reads valid token from localStorage', () => {
    // Start with no storage
    const { result } = renderHook(() => useAuth());
    expect(result.current.user).toBeNull();

    // Now set storage and call refresh
    mockStorage['authToken']    = futureToken();
    mockStorage['loggedInUser'] = VALID_USER;

    act(() => { result.current.refresh(); });
    expect(result.current.user?.name).toBe('Kajal');
  });
});
