'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface OrderItem { name: string; quantity: number; }
interface AssignedOrder {
  _id: string;
  customerName: string;
  contact?: string;
  phone?: string;
  address: string;
  restaurantName?: string;
  restaurantAddress?: string;
  items: OrderItem[];
  total: number;
  paymentMethod: string;
  status: string;
  deliveryOtp?: string;
  timestamp: string;
  customerLat?: number;
  customerLng?: number;
}

interface AgentInfo {
  name: string;
  status: string;
  currentLoad: number;
  maxBatchLimit: number;
}

function OrderCard({
  order,
  token,
  onDelivered,
}: {
  order: AssignedOrder;
  token: string;
  onDelivered: () => void;
}) {
  const [otp, setOtp] = useState('');
  const [delivering, setDelivering] = useState(false);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [err, setErr] = useState('');
  const [delivered, setDelivered] = useState(false);

  async function handleDeliver() {
    if (!otp || otp.length !== 4) { setErr('Please enter the 4-digit OTP.'); return; }
    setDelivering(true); setErr('');
    try {
      const res = await fetch(`/api/agent/deliver/${order._id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ otp: otp || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        setDelivered(true);
        setTimeout(() => onDelivered(), 2500);
      } else {
        setErr(data.message || 'Failed.');
      }
    } catch {
      setErr('Network error. Try again.');
    }
    setDelivering(false);
  }

  const mapsUrl = order.customerLat && order.customerLng
    ? `https://www.google.com/maps/dir/?api=1&destination=${order.customerLat},${order.customerLng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}`;
  const pickupMapsUrl = order.restaurantAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.restaurantAddress)}`
    : null;

  if (delivered) {
    return (
      <div style={{
        background: '#f0fdf4', borderRadius: 16, padding: '32px 20px', marginBottom: 16,
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)', border: '2px solid #22c55e',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>🎉</div>
        <h3 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800, color: '#16a34a' }}>
          Delivered Successfully!
        </h3>
        <p style={{ margin: '0 0 4px', fontSize: 15, color: '#374151', fontWeight: 600 }}>
          Order #{String(order._id).slice(-5)}
        </p>
        <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>
          Great job, keep it up! 💪
        </p>
      </div>
    );
  }

  return (
    <div style={{
      background: 'white', borderRadius: 16, padding: '20px', marginBottom: 16,
      boxShadow: '0 2px 12px rgba(0,0,0,0.08)', border: '1.5px solid #f0e6d2',
      borderLeft: '5px solid #f97316',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1a1a1a' }}>
            Order #{String(order._id).slice(-5)}
          </h3>
          <span style={{
            display: 'inline-block', marginTop: 4, padding: '2px 10px', borderRadius: 20,
            fontSize: 12, fontWeight: 600, background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa',
          }}>
            {order.status}
          </span>
        </div>
        <span style={{ fontSize: 12, color: '#9ca3af' }}>
          {new Date(order.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Customer info */}
      <div style={{ background: '#faf8f4', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
        {order.restaurantAddress && (
          <div style={{ marginBottom: 8 }}>
            <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Pickup Restaurant
            </p>
            <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 600, color: '#1f2937' }}>
              {order.restaurantName || 'Restaurant'}
            </p>
            <p style={{ margin: 0, fontSize: 13, color: '#4b5563' }}>{order.restaurantAddress}</p>
          </div>
        )}
        <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>
          👤 {order.customerName}
        </p>
        {(order.phone || order.contact) && (
          <a href={`tel:${order.phone || order.contact}`} style={{ display: 'block', color: '#2563eb', textDecoration: 'none', fontSize: 14, marginBottom: 6, fontWeight: 500 }}>
            📞 {order.phone || order.contact}
          </a>
        )}
        <p style={{ margin: 0, fontSize: 13, color: '#4b5563' }}>📍 {order.address}</p>
      </div>

      {/* Items */}
      <div style={{ marginBottom: 14 }}>
        <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Items</p>
        {order.items.map((item, i) => (
          <p key={i} style={{ margin: '0 0 3px', fontSize: 14, color: '#374151' }}>
            • {item.quantity || 1}× {item.name}
          </p>
        ))}
      </div>

      {/* Payment */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
        padding: '10px 14px', borderRadius: 10,
        background: order.paymentMethod === 'COD' ? '#fef9c3' : '#f0fdf4',
        border: `1px solid ${order.paymentMethod === 'COD' ? '#fde047' : '#86efac'}`,
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>
          {order.paymentMethod === 'COD' ? '💵 Collect Cash' : '✅ Paid Online'}
        </span>
        <span style={{ fontSize: 16, fontWeight: 800, color: '#1a1a1a' }}>₹{order.total}</span>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {pickupMapsUrl && (
          <a
            href={pickupMapsUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              flex: 1, padding: '12px 10px', borderRadius: 10, background: '#7c3aed', color: 'white',
              textAlign: 'center', textDecoration: 'none', fontWeight: 600, fontSize: 14,
            }}
          >
            Pickup Route
          </a>
        )}
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            flex: 1, padding: '12px 10px', borderRadius: 10, background: '#2563eb', color: 'white',
            textAlign: 'center', textDecoration: 'none', fontWeight: 600, fontSize: 14,
          }}
        >
          🗺️ Customer Route
        </a>
        <button
          onClick={() => { setShowOtpInput(v => !v); setErr(''); setOtp(''); }}
          style={{
            flex: 1, padding: '12px 10px', borderRadius: 10,
            background: showOtpInput ? '#f97316' : '#22c55e',
            color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14,
            transition: 'background 0.2s',
          }}
        >
          {showOtpInput ? '✖ Cancel' : '✅ Mark Delivered'}
        </button>
      </div>

      {/* OTP input */}
      {showOtpInput && (
        <div style={{ marginTop: 14, padding: 16, background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#374151', fontWeight: 600 }}>
            🔐 Ask the customer for their OTP to confirm delivery:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              type="number"
              placeholder="Enter 4-digit OTP"
              value={otp}
              onChange={e => { setOtp(e.target.value.slice(0, 4)); setErr(''); }}
              style={{
                flex: 1, padding: '12px 14px', borderRadius: 8,
                border: `1.5px solid ${err ? '#ef4444' : '#d1d5db'}`,
                fontSize: 20, fontWeight: 700, letterSpacing: 4, textAlign: 'center',
                outline: 'none',
              }}
              maxLength={4}
            />
            <button
              onClick={handleDeliver}
              disabled={delivering || otp.length !== 4}
              style={{
                padding: '12px 20px', borderRadius: 8,
                background: otp.length === 4 ? '#22c55e' : '#d1d5db',
                color: 'white', border: 'none',
                cursor: otp.length === 4 ? 'pointer' : 'not-allowed',
                fontWeight: 700, fontSize: 15,
                opacity: delivering ? 0.7 : 1,
                transition: 'background 0.2s',
                whiteSpace: 'nowrap',
              }}
            >
              {delivering ? 'Confirming…' : '✓ Confirm'}
            </button>
          </div>
          {err && (
            <p style={{ margin: '10px 0 0', color: '#ef4444', fontSize: 13, fontWeight: 500 }}>
              ⚠️ {err}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function AgentPage() {
  const { user, token, loading } = useAuth(true);
  const [orders, setOrders] = useState<AssignedOrder[]>([]);
  const [agentInfo, setAgentInfo] = useState<AgentInfo | null>(null);
  const [fetching, setFetching] = useState(true);
  const [online, setOnline] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const locationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ── Notification refs ──
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUnlockedRef = useRef(false);
  const isPlayingRef = useRef(false);
  const prevOrderCountRef = useRef(0);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('agentSound') !== 'false';
  });

  // ── Audio + Push Notification setup ──
  useEffect(() => {
    audioRef.current = new Audio('/sound/order_alert.mp3');
    audioRef.current.volume = 0.8;

    // Browsers require a user gesture before playing audio
    const unlock = () => { audioUnlockedRef.current = true; };
    document.addEventListener('click', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
    document.addEventListener('touchstart', unlock, { once: true });

    // Ask for browser push notification permission once
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      document.removeEventListener('click', unlock);
      document.removeEventListener('keydown', unlock);
      document.removeEventListener('touchstart', unlock);
    };
  }, []);

  // ── Fetch orders + fire notifications on new order ──
  const fetchOrders = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/agent/orders', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        const incoming: AssignedOrder[] = Array.isArray(data.orders) ? data.orders : [];
        const newCount = incoming.length;
        const isNewOrder = newCount > prevOrderCountRef.current;
        prevOrderCountRef.current = newCount;

        setOrders(incoming);
        if (data.agentInfo) setAgentInfo(data.agentInfo);

        if (isNewOrder) {
          // 🔊 Audio alert
          if (audioUnlockedRef.current && soundEnabled && audioRef.current && !isPlayingRef.current) {
            isPlayingRef.current = true;
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(() => {});
            audioRef.current.onended = () => { isPlayingRef.current = false; };
          }

          // 📳 Vibrate on mobile (200ms - pause - 200ms)
          if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);

          // 🔔 Browser push notification
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            new Notification('🛵 New delivery assigned!', {
              body: `You have ${newCount} active order${newCount > 1 ? 's' : ''}. Open the app to view.`,
              icon: '/favicon.ico',
              tag: 'new-order', // replaces previous notification instead of stacking
            });
          }

          // Update browser tab title
          document.title = `(${newCount}) New Order — Agent`;
        } else if (newCount === 0) {
          document.title = 'Agent Dashboard';
        }
      } else {
        console.error('Agent orders API error:', data.message);
      }
    } catch (err) {
      console.error('fetchOrders failed:', err);
    } finally {
      setFetching(false);
    }
  }, [token, soundEnabled]);

  const pushLocation = useCallback(async (lat: number, lng: number) => {
    if (!token) return;
    await fetch('/api/agent/location', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ lat, lng }),
    });
  }, [token]);

  async function toggleOnline() {
    if (!token) return;
    setTogglingStatus(true);
    const newStatus = online ? 'Offline' : 'Available';
    try {
      const res = await fetch('/api/agent/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setOnline(!online);
        setAgentInfo(data.agent);
        if (!online) {
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(pos => {
              pushLocation(pos.coords.latitude, pos.coords.longitude);
            });
            locationIntervalRef.current = setInterval(() => {
              navigator.geolocation.getCurrentPosition(pos => {
                pushLocation(pos.coords.latitude, pos.coords.longitude);
              });
            }, 30000);
          }
        } else {
          if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
        }
      }
    } catch { /* ignore */ }
    setTogglingStatus(false);
  }

  // ── Polling ──
  useEffect(() => {
    if (token) fetchOrders();
    const interval = setInterval(() => { if (token) fetchOrders(); }, 20000);
    return () => {
      clearInterval(interval);
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
      document.title = 'Agent Dashboard';
    };
  }, [token, fetchOrders]);

  if (loading) return (
    <div className="agent-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <p>Loading…</p>
    </div>
  );
  if (!user) return null;
  if (user.role !== 'agent' && user.role !== 'admin') {
    return (
      <div className="agent-body" style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: '#ef4444', fontSize: '1.1rem' }}>⛔ This page is only for delivery agents.</p>
        <a href="/" style={{ color: '#f97316' }}>← Back to Home</a>
      </div>
    );
  }

  return (
    <div className="agent-body" style={{ minHeight: '100vh' }}>
      <header className="agent-header">
        <div style={{ fontWeight: 700, fontSize: 16 }}>🛵 Agent Dashboard</div>
        <div style={{ fontSize: 13, opacity: 0.8 }}>Hi, {user.name} 👋</div>
      </header>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px' }}>

        {/* Online toggle */}
        <div style={{
          background: online ? '#f0fdf4' : '#f9fafb',
          border: `2px solid ${online ? '#22c55e' : '#d1d5db'}`,
          borderRadius: 16, padding: '20px', marginBottom: 24, textAlign: 'center',
          transition: 'all 0.3s',
        }}>
          <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>Delivery Status</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: online ? '#16a34a' : '#6b7280', marginBottom: 16 }}>
            {online ? '🟢 You are Online' : '🔴 You are Offline'}
          </div>
          <button
            onClick={toggleOnline}
            disabled={togglingStatus}
            style={{
              padding: '12px 32px', borderRadius: 50, border: 'none', cursor: 'pointer',
              background: online ? '#ef4444' : '#22c55e', color: 'white', fontWeight: 700, fontSize: 15,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)', transition: 'all 0.2s',
              opacity: togglingStatus ? 0.7 : 1,
            }}
          >
            {togglingStatus ? 'Updating…' : online ? 'Go Offline' : 'Go Online'}
          </button>
          {agentInfo && online && (
            <p style={{ margin: '12px 0 0', fontSize: 13, color: '#6b7280' }}>
              Active orders: {agentInfo.currentLoad} / {agentInfo.maxBatchLimit}
            </p>
          )}
        </div>

        {/* Orders header */}
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>
            📦 Your Deliveries
          </h2>
          <button
            onClick={fetchOrders}
            style={{
              padding: '6px 14px', borderRadius: 8, background: '#f3f4f6', border: '1px solid #e5e7eb',
              cursor: 'pointer', fontSize: 13, color: '#374151', fontWeight: 500,
            }}
          >
            🔄 Refresh
          </button>
        </div>

        {fetching ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>⏳</div>
            <p style={{ color: '#6b7280' }}>Loading orders…</p>
          </div>
        ) : orders.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '3rem 2rem', background: 'white', borderRadius: 16,
            border: '2px dashed #e5e7eb',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>🎉</div>
            <p style={{ fontWeight: 600, color: '#374151', margin: '0 0 6px' }}>No active deliveries</p>
            <p style={{ color: '#9ca3af', fontSize: 14, margin: 0 }}>New orders will appear here automatically.</p>
          </div>
        ) : (
          orders.map(order => (
            <OrderCard
              key={order._id}
              order={order}
              token={token!}
              onDelivered={() => {
                setOrders(prev => prev.filter(o => o._id !== order._id));
                fetchOrders();
              }}
            />
          ))
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 32, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
          <a href="/" style={{ color: '#9ca3af', fontSize: 13, textDecoration: 'none' }}>← Back to Site</a>

          {/* Sound toggle */}
          <div style={{ marginTop: 12 }}>
            <button
              onClick={() => setSoundEnabled(s => {
                const next = !s;
                localStorage.setItem('agentSound', String(next));
                return next;
              })}
              style={{
                padding: '8px 18px', borderRadius: 8, border: '1px solid #e5e7eb',
                background: '#f9fafb', cursor: 'pointer', fontSize: 13, color: '#374151',
              }}
            >
              {soundEnabled ? '🔔 Sound On' : '🔕 Sound Off'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

