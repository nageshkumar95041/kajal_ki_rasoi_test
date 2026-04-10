/**
 * Unit Tests — src/lib/utils.ts
 * Covers: escapeHTML, isTokenExpired, getDefaultImage, formatDate,
 *         getCart / saveCart / getCartCount (browser localStorage),
 *         getAuthToken, getLoggedInUser
 */

import {
  escapeHTML,
  isTokenExpired,
  getDefaultImage,
  formatDate,
  getCart,
  saveCart,
  getCartCount,
  getAuthToken,
  getLoggedInUser,
  CartItem,
} from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a signed-looking JWT with a custom expiry (seconds from now). */
function makeToken(expiresInSeconds: number): string {
  const payload = { exp: Math.floor(Date.now() / 1000) + expiresInSeconds };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `header.${encoded}.signature`;
}

// ─── escapeHTML ───────────────────────────────────────────────────────────────

describe('escapeHTML', () => {
  it('escapes all five dangerous characters', () => {
    expect(escapeHTML('<script>alert("XSS")&it\'s</script>')).toBe(
      '&lt;script&gt;alert(&quot;XSS&quot;)&amp;it&#39;s&lt;/script&gt;'
    );
  });

  it('returns empty string for null', () => expect(escapeHTML(null)).toBe(''));
  it('returns empty string for undefined', () => expect(escapeHTML(undefined)).toBe(''));
  it('leaves safe strings unchanged', () => expect(escapeHTML('Hello World')).toBe('Hello World'));
  it('coerces numbers to string', () => expect(escapeHTML(42)).toBe('42'));
  it('handles empty string', () => expect(escapeHTML('')).toBe(''));
});

// ─── isTokenExpired ───────────────────────────────────────────────────────────

describe('isTokenExpired', () => {
  it('returns true for an empty string', () => expect(isTokenExpired('')).toBe(true));
  it('returns true for a malformed token', () => expect(isTokenExpired('bad.token')).toBe(true));
  it('returns true for an already-expired token', () => {
    expect(isTokenExpired(makeToken(-60))).toBe(true);
  });
  it('returns false for a future-expiry token', () => {
    expect(isTokenExpired(makeToken(3600))).toBe(false);
  });
  it('returns true when exp is exactly now', () => {
    expect(isTokenExpired(makeToken(0))).toBe(true);
  });
});

// ─── getDefaultImage ──────────────────────────────────────────────────────────

describe('getDefaultImage', () => {
  const FALLBACK = 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=400&q=80';

  it('returns fallback for empty string', () => expect(getDefaultImage('')).toBe(FALLBACK));
  it('returns fallback for falsy value', () => expect(getDefaultImage(undefined as unknown as string)).toBe(FALLBACK));
  it('returns rice image for "Biryani"', () => {
    expect(getDefaultImage('Chicken Biryani')).toContain('1631515243349');
  });
  it('returns rice image for "Pulao"', () => {
    expect(getDefaultImage('Matar Pulao')).toContain('1631515243349');
  });
  it('returns roti image for "Naan"', () => {
    expect(getDefaultImage('Garlic Naan')).toContain('1626777552726');
  });
  it('returns roti image for "Paratha"', () => {
    expect(getDefaultImage('Aloo Paratha')).toContain('1626777552726');
  });
  it('returns curry image for "Paneer"', () => {
    expect(getDefaultImage('Paneer Butter Masala')).toContain('1585937421612');
  });
  it('returns thali image for "Thali"', () => {
    expect(getDefaultImage('Full Thali')).toContain('1546833999');
  });
  it('returns thali image for "Combo"', () => {
    expect(getDefaultImage('Lunch Combo')).toContain('1546833999');
  });
  it('returns dessert image for "Halwa"', () => {
    expect(getDefaultImage('Gajar Halwa')).toContain('1563805042');
  });
  it('returns fallback for unknown item', () => {
    expect(getDefaultImage('Dal Makhani')).toBe(FALLBACK);
  });
});

// ─── formatDate ───────────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('formats a Date object', () => {
    const d = new Date('2024-01-15');
    const result = formatDate(d);
    // en-IN medium style → "15 Jan 2024" (varies by Node ICU build)
    expect(result).toMatch(/Jan/i);
    expect(result).toMatch(/2024/);
  });

  it('formats an ISO string', () => {
    const result = formatDate('2024-06-01');
    expect(result).toMatch(/Jun/i);
  });
});

// ─── Cart utilities (localStorage) ───────────────────────────────────────────

describe('Cart utilities', () => {
  const mockStorage: Record<string, string> = {};

  beforeAll(() => {
    // Provide a window + localStorage stub for the Node test environment
    (global as Record<string, unknown>).window = global;
    Object.defineProperty(global, 'localStorage', {
      value: {
        getItem: (key: string) => mockStorage[key] ?? null,
        setItem: (key: string, val: string) => { mockStorage[key] = val; },
        removeItem: (key: string) => { delete mockStorage[key]; },
        clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); },
      },
      writable: true,
    });
  });

  beforeEach(() => {
    mockStorage['cart'] = '[]';
  });

  it('getCart returns [] when cart is empty', () => {
    expect(getCart()).toEqual([]);
  });

  it('saveCart persists items and getCart retrieves them', () => {
    const items: CartItem[] = [
      { name: 'Dal Makhani', price: 120, quantity: 2 },
      { name: 'Naan', price: 30, quantity: 3 },
    ];
    saveCart(items);
    expect(getCart()).toEqual(items);
  });

  it('getCartCount returns total quantity across all items', () => {
    saveCart([
      { name: 'Item A', price: 50, quantity: 2 },
      { name: 'Item B', price: 80, quantity: 5 },
    ]);
    expect(getCartCount()).toBe(7);
  });

  it('getCartCount defaults quantity to 1 when field is missing', () => {
    // Simulate legacy cart entry with no quantity field
    mockStorage['cart'] = JSON.stringify([{ name: 'Item', price: 50 }]);
    expect(getCartCount()).toBe(1);
  });

  it('getCart returns [] for corrupt localStorage data', () => {
    mockStorage['cart'] = '{broken json{{';
    expect(getCart()).toEqual([]);
  });

  it('saveCart overwrites previous cart', () => {
    saveCart([{ name: 'Old Item', price: 100, quantity: 1 }]);
    saveCart([{ name: 'New Item', price: 200, quantity: 3 }]);
    expect(getCart()).toHaveLength(1);
    expect(getCart()[0].name).toBe('New Item');
  });
});

// ─── Auth helpers (localStorage) ─────────────────────────────────────────────

describe('getAuthToken and getLoggedInUser', () => {
  const mockStorage: Record<string, string> = {};

  beforeAll(() => {
    (global as Record<string, unknown>).window = global;
    Object.defineProperty(global, 'localStorage', {
      value: {
        getItem: (key: string) => mockStorage[key] ?? null,
        setItem: (key: string, val: string) => { mockStorage[key] = val; },
        removeItem: (key: string) => { delete mockStorage[key]; },
      },
      writable: true,
    });
  });

  it('getAuthToken returns null when not set', () => {
    delete mockStorage['authToken'];
    expect(getAuthToken()).toBeNull();
  });

  it('getAuthToken returns stored token', () => {
    mockStorage['authToken'] = 'mytoken123';
    expect(getAuthToken()).toBe('mytoken123');
  });

  it('getLoggedInUser returns null when not set', () => {
    delete mockStorage['loggedInUser'];
    expect(getLoggedInUser()).toBeNull();
  });

  it('getLoggedInUser returns parsed user', () => {
    const user = { name: 'Kajal', contact: 'kajal@test.com', role: 'user' };
    mockStorage['loggedInUser'] = JSON.stringify(user);
    expect(getLoggedInUser()).toEqual(user);
  });

  it('getLoggedInUser returns null for corrupt JSON', () => {
    mockStorage['loggedInUser'] = '{bad}';
    expect(getLoggedInUser()).toBeNull();
  });
});
