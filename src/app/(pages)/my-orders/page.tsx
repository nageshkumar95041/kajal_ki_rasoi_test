'use client';
export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { getAuthToken, getLoggedInUser, formatDate } from '@/lib/utils';

interface Order { _id: string; status: string; items: { name: string; quantity: number }[]; total: number; timestamp: string; paymentMethod: string; rating?: number; deliveryOtp?: string; inHouseDelivery?: boolean; borzoTrackingUrl?: string; }

function MyOrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState('all');
  const [fetching, setFetching] = useState(true);

  // Read authToken from localStorage on mount (client-side only)
  useEffect(() => {
    const t = getAuthToken();
    if (!t) {
      router.push('/login');
      return;
    }
    setToken(t);
  }, [router]);

  const loadOrders = useCallback(async (t: string) => {
    setFetching(true);
    try {
      const sessionId = searchParams.get('session_id');
      if (sessionId) {
        await fetch('/api/verify-session', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: JSON.stringify({ sessionId }) });
        window.history.replaceState({}, '', '/my-orders');
        localStorage.removeItem('cart');
        window.dispatchEvent(new Event('cartUpdated'));
      }
      const res = await fetch('/api/my-orders', { headers: { Authorization: `Bearer ${t}` } });
      const data = await res.json();
      if (Array.isArray(data)) setOrders(data);
    } finally { setFetching(false); }
  }, [searchParams]);

  useEffect(() => { if (token) loadOrders(token); }, [token, loadOrders]);

  const ACTIVE_STATUSES = ['pending', 'preparing', 'out for delivery', 'out_for_delivery', 'in progress', 'assigned'];
  const isActive = (status: string) => ACTIVE_STATUSES.includes(status.toLowerCase().trim());
  const activeOrders = orders.filter(o => isActive(o.status));
  const pastOrders = orders.filter(o => !isActive(o.status));
  const filtered = filter === 'all' ? pastOrders : pastOrders.filter(o =>
    filter === 'Completed'
      ? o.status.toLowerCase() === 'completed'
      : ['rejected', 'cancelled'].includes(o.status.toLowerCase())
  );

  async function cancelOrder(id: string) {
    if (!confirm('Cancel this order?')) return;
    await fetch(`/api/orders/${id}/cancel`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
    if (token) loadOrders(token);
  }

  async function submitRating(orderId: string) {
    const rating = prompt('Rate your order (1-5 stars):');
    if (!rating || isNaN(Number(rating))) return;
    const review = prompt('Leave a review (optional):') || '';
    await fetch(`/api/orders/${orderId}/review`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ rating: Number(rating), review }) });
    if (token) loadOrders(token);
  }

  function reorderItems(items: Order['items']) {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    items.forEach(item => {
      const ex = cart.find((i: { name: string }) => i.name === item.name);
      if (ex) ex.quantity += item.quantity || 1;
      else cart.push({ name: item.name, price: 0, quantity: item.quantity || 1 });
    });
    localStorage.setItem('cart', JSON.stringify(cart));
    window.dispatchEvent(new Event('cartUpdated'));
    alert('Items added to cart!');
    window.location.href = '/cart';
  }

  if (!token || fetching) return <div style={{ padding: '6rem 1rem', textAlign: 'center' }}>Loading...</div>;

  return (
    <>
      <Navbar scrolled />
      <section className="admin-page my-orders-page" style={{ paddingTop: '6rem' }}>
        {/* Active orders */}
        <div id="active-order-container">
          {activeOrders.map(order => (
            <div key={order._id} className="active-order-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <div>
                  <p style={{ fontSize: '0.9rem', color: 'var(--admin-text-muted)', margin: 0 }}>Order Status</p>
                  <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2ecc71', marginTop: 0 }}>{order.status}</p>
                </div>
                <div className="hygiene-badge">✨ Max Safety &amp; Hygiene</div>
              </div>
              <p style={{ color: 'var(--admin-text-muted)' }}>{order.items.map(i => `${i.quantity || 1}x ${i.name}`).join(', ')}</p>
              <p style={{ fontWeight: 'bold' }}>Total: ₹{order.total} <span style={{ fontSize: '0.8rem', fontWeight: 'normal' }}>{order.paymentMethod}</span></p>
              {order.status.toLowerCase() === 'out for delivery' && order.deliveryOtp && (
                <div style={{ background: '#fef3c7', border: '1.5px dashed #f59e0b', borderRadius: 10, padding: '12px 16px', margin: '8px 0', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: 1 }}>Delivery OTP — Share with your rider</p>
                  <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color: '#78350f', letterSpacing: 6 }}>{order.deliveryOtp}</p>
                </div>
              )}
              <div className="order-actions-row">
                {order.status.toLowerCase() === 'pending' && <button className="btn-outline" style={{ color: '#e74c3c', borderColor: '#e74c3c' }} onClick={() => cancelOrder(order._id)}>Cancel Order</button>}
                {['preparing', 'out for delivery'].includes(order.status.toLowerCase()) && (
                  <a href={`/tracking?orderId=${order._id}`} className="btn-outline" style={{ color: '#3b82f6', borderColor: '#3b82f6', textDecoration: 'none', padding: '6px 14px', fontSize: '0.9rem' }}>
                    📍 Track Order
                  </a>
                )}
                {order.borzoTrackingUrl && (
                  <a href={order.borzoTrackingUrl} target="_blank" rel="noreferrer" className="btn-outline" style={{ color: '#6366f1', borderColor: '#6366f1', textDecoration: 'none', padding: '6px 14px', fontSize: '0.9rem' }}>
                    🛵 Live Borzo Track
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Past orders */}
        <div className="past-orders-section">
          <div className="order-header" style={{ marginTop: '2rem', borderBottom: 'none' }}>
            <h2>Past Orders</h2>
            <select value={filter} onChange={e => setFilter(e.target.value)} style={{ padding: 8, borderRadius: 5, border: '1px solid #ccc' }}>
              <option value="all">All Orders</option>
              <option value="Completed">Delivered</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
          <div id="my-orders-container">
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                <h3>No orders yet!</h3>
                <p>Your orders will appear here.</p>
                <a href="/" className="btn">Start Ordering</a>
              </div>
            ) : filtered.map(order => (
              <div key={order._id} className="order-card" style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ background: 'var(--admin-bg)', padding: '1rem', borderRadius: 10, fontSize: '1.5rem' }}>🍲</div>
                    <div>
                      <h4 style={{ margin: 0 }}>Kajal Ki Rasoi</h4>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--admin-text-muted)' }}>{formatDate(order.timestamp)} · #{String(order._id).slice(-5).toUpperCase()}</p>
                      <p style={{ margin: 0, fontWeight: 'bold' }}>₹{order.total} · <span className={`status ${order.status.toLowerCase().replace(/ /g, '-')}`}>{order.status}</span></p>
                    </div>
                  </div>
                  <p style={{ margin: '0.8rem 0 0 0', fontSize: '0.9rem', color: 'var(--admin-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>
                    {order.items.map(i => `${i.quantity || 1}x ${i.name}`).join(', ')}
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'right' }}>
                  {order.status.toLowerCase() === 'completed' && <button className="btn" style={{ padding: '8px 15px' }} onClick={() => reorderItems(order.items)}>🔁 Reorder</button>}
                  {order.status.toLowerCase() === 'completed' && !order.rating && <button className="btn-outline" style={{ padding: '6px 12px', fontSize: '0.85rem', color: '#f39c12', borderColor: '#f39c12' }} onClick={() => submitRating(order._id)}>⭐ Rate</button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <footer><p>&copy; {new Date().getFullYear()} Kajal Ki Rasoi. All Rights Reserved.</p></footer>
    </>
  );
}

export default function MyOrdersPage() {
  return (
    <Suspense fallback={<div style={{ padding: '6rem 1rem', textAlign: 'center' }}>Loading...</div>}>
      <MyOrdersContent />
    </Suspense>
  );
}
