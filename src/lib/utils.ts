export function escapeHTML(str: unknown): string {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>'"]/g, (tag) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

export function isTokenExpired(token: string): boolean {
  if (!token) return true;
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));
    return Math.floor(Date.now() / 1000) >= payload.exp;
  } catch {
    return true;
  }
}

export function getDefaultImage(itemName: string): string {
  if (!itemName) return 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=400&q=80';
  if (itemName.includes('Halwa') || itemName.includes('Dessert'))
    return 'https://images.unsplash.com/photo-1563805042-7684c8e9e9cb?auto=format&fit=crop&w=400&q=80';
  if (itemName.includes('Rice') || itemName.includes('Pulao') || itemName.includes('Biryani'))
    return 'https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?auto=format&fit=crop&w=400&q=80';
  if (itemName.includes('Roti') || itemName.includes('Naan') || itemName.includes('Paratha'))
    return 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=400&q=80';
  if (itemName.includes('Paneer') || itemName.includes('Masala') || itemName.includes('Curry'))
    return 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=400&q=80';
  if (itemName.includes('Thali') || itemName.includes('Meal') || itemName.includes('Combo'))
    return 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=400&q=80';
  return 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=400&q=80';
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-IN', { dateStyle: 'medium' });
}

export interface CartItem {
  name: string;
  price: number;
  quantity: number;
}

export interface CartData {
  items: CartItem[];
  restaurantId?: string;
}

export function getCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const data: CartData = JSON.parse(localStorage.getItem('cart') || '{"items":[]}');
    return data.items || [];
  } catch {
    return [];
  }
}

export function getCartRestaurantId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const data: CartData = JSON.parse(localStorage.getItem('cart') || '{"items":[]}');
    return data.restaurantId || null;
  } catch {
    return null;
  }
}

export function saveCart(cart: CartItem[], restaurantId?: string) {
  if (typeof window === 'undefined') return;
  const data: CartData = { items: cart };
  if (restaurantId) data.restaurantId = restaurantId;
  localStorage.setItem('cart', JSON.stringify(data));
}

export function getCartCount(): number {
  return getCart().reduce((sum, item) => sum + (item.quantity || 1), 0);
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('authToken');
}

export interface LoggedInUser {
  name: string;
  contact: string;
  role: string;
  hasRestaurant?: boolean;
}

export function getLoggedInUser(): LoggedInUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const u = localStorage.getItem('loggedInUser');
    return u ? JSON.parse(u) : null;
  } catch {
    return null;
  }
}
