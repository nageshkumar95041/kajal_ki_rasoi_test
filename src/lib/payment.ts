import { NextRequest } from 'next/server';

const DEFAULT_FRONTEND_ORIGIN = 'http://localhost:3000';
const APNA50_CODE = 'APNA50';
const APNA50_DISCOUNT = 50;
const MIN_COUPON_SUBTOTAL = 200;
const MAX_ITEM_QUANTITY = 50;
const MAX_SUBSCRIPTION_PERSONS = 20;

type Frequency = 5 | 7;

interface SubscriptionPlanConfig {
  label: string;
  frequencies: Partial<Record<Frequency, number>>;
}

const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlanConfig> = {
  'Basic Thali': {
    label: 'Basic Thali',
    frequencies: { 5: 3200, 7: 4200 },
  },
  'Standard Thali': {
    label: 'Standard Thali',
    frequencies: { 5: 4200, 7: 5200 },
  },
  'Premium Thali': {
    label: 'Premium Thali',
    frequencies: { 5: 5800, 7: 7000 },
  },
  '7-Day Trial Week': {
    label: '7-Day Trial Week',
    frequencies: { 7: 699 },
  },
};

export interface CanonicalCartItem {
  name: string;
  quantity: number;
  price: number;
}

export interface SubscriptionQuote {
  plan: string;
  frequency: Frequency;
  persons: number;
  basePrice: number;
  finalPrice: number;
  appliedCouponCode: string | null;
  frequencyLabel: string;
}

function normalizeOrigin(value?: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function normalizeCouponCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toUpperCase();
  return trimmed || null;
}

function toBoundedInteger(value: unknown, min: number, max: number): number | null {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(numeric) || numeric < min || numeric > max) return null;
  return numeric;
}

export function getAppOrigin(req: NextRequest): string {
  return (
    normalizeOrigin(process.env.FRONTEND_URL) ??
    normalizeOrigin(req.headers.get('origin')) ??
    DEFAULT_FRONTEND_ORIGIN
  );
}

export function resolveSafeRedirectUrl(req: NextRequest, candidate: unknown, fallbackPath: string): string {
  const appOrigin = getAppOrigin(req);
  const allowedOrigins = new Set(
    [appOrigin, normalizeOrigin(process.env.FRONTEND_URL), normalizeOrigin(req.headers.get('origin'))].filter(
      (origin): origin is string => Boolean(origin)
    )
  );

  if (typeof candidate !== 'string' || !candidate.trim()) {
    return new URL(fallbackPath, appOrigin).toString();
  }

  try {
    const url = new URL(candidate, appOrigin);
    if (allowedOrigins.has(url.origin)) {
      return url.toString();
    }
  } catch {
    // Fall back to the safe local route below.
  }

  return new URL(fallbackPath, appOrigin).toString();
}

export function normalizeCoordinate(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

export function normalizeCartItems(items: unknown): Array<{ name: string; quantity: number }> | null {
  if (!Array.isArray(items)) return null;

  const merged = new Map<string, number>();

  for (const item of items) {
    if (!item || typeof item !== 'object') return null;

    const maybeName = 'name' in item ? item.name : undefined;
    const maybeQuantity = 'quantity' in item ? item.quantity : 1;
    const name = typeof maybeName === 'string' ? maybeName.trim() : '';
    const quantity = toBoundedInteger(maybeQuantity, 1, MAX_ITEM_QUANTITY);

    if (!name || quantity === null) return null;

    const nextQuantity = (merged.get(name) ?? 0) + quantity;
    if (nextQuantity > MAX_ITEM_QUANTITY) return null;
    merged.set(name, nextQuantity);
  }

  return Array.from(merged.entries()).map(([name, quantity]) => ({ name, quantity }));
}

export function priceCartItems(
  items: Array<{ name: string; quantity: number }>,
  priceSources: Array<{ name: string; price: number }>
): { items: CanonicalCartItem[]; subtotal: number } | null {
  const priceMap = new Map<string, number>();

  for (const source of priceSources) {
    if (!source || typeof source.name !== 'string' || typeof source.price !== 'number' || source.price <= 0) {
      continue;
    }

    const existing = priceMap.get(source.name);
    if (existing !== undefined && existing !== source.price) {
      return null;
    }
    priceMap.set(source.name, source.price);
  }

  const canonicalItems: CanonicalCartItem[] = [];
  let subtotal = 0;

  for (const item of items) {
    const unitPrice = priceMap.get(item.name);
    if (unitPrice === undefined) return null;

    subtotal += unitPrice * item.quantity;
    canonicalItems.push({ name: item.name, quantity: item.quantity, price: unitPrice });
  }

  return { items: canonicalItems, subtotal };
}

export function applyApna50Coupon(subtotal: number, couponCode: unknown): {
  finalTotal: number;
  appliedCouponCode: string | null;
  discount: number;
} {
  const normalizedCoupon = normalizeCouponCode(couponCode);

  if (normalizedCoupon === APNA50_CODE && subtotal >= MIN_COUPON_SUBTOTAL) {
    return {
      finalTotal: subtotal - APNA50_DISCOUNT,
      appliedCouponCode: APNA50_CODE,
      discount: APNA50_DISCOUNT,
    };
  }

  return {
    finalTotal: subtotal,
    appliedCouponCode: null,
    discount: 0,
  };
}

export function getSubscriptionQuote(input: {
  plan: unknown;
  frequency: unknown;
  persons: unknown;
  couponCode?: unknown;
}): SubscriptionQuote | null {
  const plan = typeof input.plan === 'string' ? input.plan.trim() : '';
  const config = SUBSCRIPTION_PLANS[plan];
  const frequency = toBoundedInteger(input.frequency, 5, 7) as Frequency | null;
  const persons = toBoundedInteger(input.persons ?? 1, 1, MAX_SUBSCRIPTION_PERSONS);

  if (!config || !frequency || !persons) return null;

  const unitPrice = config.frequencies[frequency];
  if (!unitPrice) return null;

  const basePrice = unitPrice * persons;
  const coupon = applyApna50Coupon(basePrice, input.couponCode);
  const frequencyLabel = plan === '7-Day Trial Week' ? '7-Day Trial' : `${frequency} Days/Week`;

  return {
    plan: config.label,
    frequency,
    persons,
    basePrice,
    finalPrice: coupon.finalTotal,
    appliedCouponCode: coupon.appliedCouponCode,
    frequencyLabel,
  };
}

export function parseSubscriptionStartDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const selectedDay = new Date(parsed);
  selectedDay.setHours(0, 0, 0, 0);

  if (selectedDay < today) return null;

  return parsed;
}
