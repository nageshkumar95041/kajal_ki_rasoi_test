'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import ToastInit from '@/components/Toast';
import { formatDate, getAuthToken, getDefaultImage } from '@/lib/utils';

interface OrderItem {
  name?: string;
  quantity?: number;
  price?: number;
}

interface Order {
  _id: string;
  customerName: string;
  contact?: string;
  phone?: string;
  address: string;
  items: OrderItem[];
  total: number;
  status: string;
  paymentMethod?: string;
  timestamp: string;
  borzoStatus?: string;
  borzoTrackingUrl?: string;
  inHouseDelivery?: boolean;
  deliveryOtp?: string;
  agentId?:
    | string
    | {
        _id: string;
        name?: string;
        phone?: string;
        status?: string;
        currentLoad?: number;
        maxBatchLimit?: number;
      };
}

interface DeliveryAgent {
  _id: string;
  name: string;
  phone?: string;
  status: string;
  currentLoad: number;
  maxBatchLimit: number;
}

interface MenuItem {
  _id: string;
  name: string;
  price: number;
  description?: string;
  category: string;
  imageUrl?: string;
  available: boolean;
}

interface RestaurantProfile {
  _id: string;
  name: string;
  contact: string;
  address: string;
  description?: string;
  imageUrl?: string;
  estimatedDeliveryTime?: number;
  isOpen?: boolean;
}

const CATEGORY_OPTIONS = ['Main Course', 'Starter', 'Bread', 'Rice', 'Dessert', 'Beverage'];

function getRestaurantToken() {
  return getAuthToken() || localStorage.getItem('token') || '';
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatOrderTime(value: string) {
  const date = new Date(value);
  return `${formatDate(date)} at ${date.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}

function isToday(value: string) {
  const today = new Date();
  const date = new Date(value);
  return today.toDateString() === date.toDateString();
}

type StatusKey = 'pending' | 'preparing' | 'out-for-delivery' | 'completed' | 'rejected' | 'cancelled';

function getStatusColors(status: string): { bg: string; color: string; border: string; dot: string } {
  const s = status.toLowerCase().replace(/\s+/g, '-') as StatusKey;
  const map: Record<StatusKey, { bg: string; color: string; border: string; dot: string }> = {
    'pending':           { bg: 'rgba(245,158,11,0.12)',  color: '#fbbf24', border: 'rgba(245,158,11,0.4)',  dot: '#fbbf24' },
    'preparing':         { bg: 'rgba(59,130,246,0.12)',  color: '#60a5fa', border: 'rgba(59,130,246,0.4)',  dot: '#60a5fa' },
    'out-for-delivery':  { bg: 'rgba(139,92,246,0.12)', color: '#a78bfa', border: 'rgba(139,92,246,0.4)', dot: '#a78bfa' },
    'completed':         { bg: 'rgba(16,185,129,0.12)', color: '#34d399', border: 'rgba(16,185,129,0.4)', dot: '#34d399' },
    'rejected':          { bg: 'rgba(239,68,68,0.12)',  color: '#f87171', border: 'rgba(239,68,68,0.4)',  dot: '#f87171' },
    'cancelled':         { bg: 'rgba(113,113,122,0.12)',color: '#a1a1aa', border: 'rgba(113,113,122,0.4)',dot: '#a1a1aa' },
  };
  return map[s] ?? { bg: 'rgba(113,113,122,0.12)', color: '#a1a1aa', border: 'rgba(113,113,122,0.4)', dot: '#a1a1aa' };
}

function getStatusBorderColor(status: string): string {
  const s = status.toLowerCase().replace(/\s+/g, '-');
  const map: Record<string, string> = {
    'pending': '#f59e0b',
    'preparing': '#3b82f6',
    'out-for-delivery': '#8b5cf6',
    'completed': '#10b981',
    'rejected': '#ef4444',
    'cancelled': '#52525b',
  };
  return map[s] ?? '#52525b';
}

// ── Shared style tokens ──────────────────────────────────────────
const C = {
  bg:        '#0C0A09',
  surface:   '#161210',
  elevated:  '#1C1816',
  border:    '#2E2520',
  border2:   '#3E3530',
  orange:    '#f97316',
  orangeHov: '#ea6c0d',
  textMain:  '#ffffff',
  textMuted: '#a1a1aa',
  textFaint: '#71717a',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: C.elevated,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: 14,
  color: C.textMain,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: "'DM Sans', sans-serif",
};

export default function RestaurantDashboard() {
  const searchParams = useSearchParams();
  const [restaurant, setRestaurant] = useState<RestaurantProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [deliveryOrders, setDeliveryOrders] = useState<Order[]>([]);
  const [agents, setAgents] = useState<DeliveryAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [activeTab, setActiveTab] = useState<'orders' | 'delivery' | 'menu'>('orders');
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [savingOrderId, setSavingOrderId] = useState('');
  const [savingMenu, setSavingMenu] = useState(false);
  const [togglingOpen, setTogglingOpen] = useState(false);
  const [menuActionItemId, setMenuActionItemId] = useState('');
  const [loadingDelivery, setLoadingDelivery] = useState(false);
  const [assigningOrderId, setAssigningOrderId] = useState('');
  const [expandedAssignOrderId, setExpandedAssignOrderId] = useState('');
  const [dispatchingOrderId, setDispatchingOrderId] = useState('');
  const [deliveryResult, setDeliveryResult] = useState<{ orderId: string; otp: string } | null>(null);
  const [menuForm, setMenuForm] = useState({
    name: '',
    price: '',
    description: '',
    category: 'Main Course',
    imageUrl: '',
    available: true,
  });

  useEffect(() => { loadDashboard(); }, []);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'orders' || tab === 'delivery' || tab === 'menu') {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const updateOrdersState = (updatedOrder: Order) => {
    setOrders((current) => current.map((o) => (o._id === updatedOrder._id ? { ...o, ...updatedOrder } : o)));
    setDeliveryOrders((current) => {
      const isDeliveryStatus = ['Preparing', 'Out for Delivery'].includes(updatedOrder.status);
      const exists = current.some((o) => o._id === updatedOrder._id);
      let next = exists
        ? current.map((o) => (o._id === updatedOrder._id ? { ...o, ...updatedOrder } : o))
        : current;
      if (!exists && isDeliveryStatus) next = [updatedOrder, ...next];
      if (!isDeliveryStatus) return next.filter((o) => o._id !== updatedOrder._id);
      return next;
    });
  };

  const loadDeliveryWorkspace = async (token: string) => {
    const res = await fetch('/api/my-restaurant/delivery', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('Failed to load delivery workspace');
    const data = await res.json();
    setDeliveryOrders(Array.isArray(data.orders) ? data.orders : []);
    setAgents(Array.isArray(data.agents) ? data.agents : []);
  };

  const loadDashboard = async () => {
    const token = getRestaurantToken();
    if (!token) { window.location.href = '/login?next=/restaurant/dashboard'; return; }
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [restaurantRes, ordersRes, menuRes, deliveryRes] = await Promise.all([
        fetch('/api/my-restaurant', { headers }),
        fetch('/api/my-restaurant/orders?status=all&limit=100', { headers }),
        fetch('/api/my-restaurant/menu', { headers }),
        fetch('/api/my-restaurant/delivery', { headers }),
      ]);
      if (restaurantRes.status === 404) {
        window.showSystemToast?.('Restaurant Required', 'Please register your restaurant before opening the dashboard.', 'warning');
        setTimeout(() => { window.location.href = '/restaurant/register'; }, 1200);
        return;
      }
      if (restaurantRes.status === 401 || restaurantRes.status === 403) { window.location.href = '/login?next=/restaurant/dashboard'; return; }
      if (!restaurantRes.ok || !ordersRes.ok || !menuRes.ok || !deliveryRes.ok) throw new Error('Failed to load');
      const [restaurantData, ordersData, menuData, deliveryData] = await Promise.all([
        restaurantRes.json(), ordersRes.json(), menuRes.json(), deliveryRes.json(),
      ]);
      setRestaurant(restaurantData);
      setOrders(ordersData);
      setMenuItems(menuData);
      setDeliveryOrders(Array.isArray(deliveryData.orders) ? deliveryData.orders : []);
      setAgents(Array.isArray(deliveryData.agents) ? deliveryData.agents : []);
      setIsOwner(true);
    } catch {
      window.showSystemToast?.('Error', 'Failed to load your restaurant dashboard.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const updateMenuField = (field: keyof typeof menuForm, value: string | boolean) =>
    setMenuForm((c) => ({ ...c, [field]: value }));

  const addMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!menuForm.name.trim() || !menuForm.price.trim()) {
      window.showSystemToast?.('Missing Details', 'Menu name and price are required.', 'warning');
      return;
    }
    setSavingMenu(true);
    try {
      const res = await fetch('/api/my-restaurant/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getRestaurantToken()}` },
        body: JSON.stringify({ ...menuForm, price: parseFloat(menuForm.price) }),
      });
      const data = await res.json();
      if (data.success) {
        setMenuItems((c) => [data.item, ...c]);
        setMenuForm({ name: '', price: '', description: '', category: 'Main Course', imageUrl: '', available: true });
        setShowAddMenu(false);
        window.showSystemToast?.('Saved', 'Menu item added successfully.', 'success');
      } else {
        window.showSystemToast?.('Error', data.message, 'error');
      }
    } catch {
      window.showSystemToast?.('Error', 'Failed to add menu item.', 'error');
    } finally {
      setSavingMenu(false);
    }
  };

  const toggleRestaurantOpen = async () => {
    if (!restaurant) return;
    const token = getRestaurantToken();
    const newIsOpen = !(restaurant.isOpen !== false);
    setTogglingOpen(true);
    try {
      const res = await fetch('/api/my-restaurant', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isOpen: newIsOpen }),
      });
      if (res.ok) {
        setRestaurant((r) => r ? { ...r, isOpen: newIsOpen } : r);
        window.showSystemToast?.(
          newIsOpen ? 'Restaurant Open' : 'Restaurant Closed',
          newIsOpen ? 'You are now accepting orders.' : 'You are no longer accepting orders.',
          newIsOpen ? 'success' : 'warning'
        );
      } else {
        window.showSystemToast?.('Error', 'Failed to update restaurant status.', 'error');
      }
    } catch {
      window.showSystemToast?.('Error', 'Network error. Please try again.', 'error');
    } finally {
      setTogglingOpen(false);
    }
  };

  const updateStatus = async (orderId: string, status: string) => {
    setSavingOrderId(orderId);
    try {
      const res = await fetch('/api/my-restaurant/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getRestaurantToken()}` },
        body: JSON.stringify({ orderId, status }),
      });
      const data = await res.json();
      if (data.success) {
        updateOrdersState(data.order);
        window.showSystemToast?.('Status Updated', `Order moved to ${status}.`, 'success');
      } else {
        window.showSystemToast?.('Error', data.message, 'error');
      }
    } catch {
      window.showSystemToast?.('Error', 'Failed to update order status.', 'error');
    } finally {
      setSavingOrderId('');
    }
  };

  const assignAgent = async (orderId: string, agentId: string) => {
    setAssigningOrderId(orderId);
    try {
      const res = await fetch('/api/my-restaurant/delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getRestaurantToken()}` },
        body: JSON.stringify({ orderId, agentId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { window.showSystemToast?.('Error', data.message || 'Failed to assign agent.', 'error'); return; }
      if (data.order) updateOrdersState(data.order);
      setDeliveryResult({ orderId, otp: data.deliveryOtp });
      setExpandedAssignOrderId('');
      await loadDeliveryWorkspace(getRestaurantToken());
      window.showSystemToast?.('Agent Assigned', data.message || 'Delivery partner assigned successfully.', 'success');
    } catch {
      window.showSystemToast?.('Error', 'Unable to assign delivery agent.', 'error');
    } finally {
      setAssigningOrderId('');
    }
  };

  const createBorzoDispatch = async (orderId: string) => {
    setDispatchingOrderId(orderId);
    try {
      const res = await fetch(`/api/my-restaurant/delivery/borzo/${orderId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getRestaurantToken()}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) { window.showSystemToast?.('Error', data.message || 'Failed to start Borzo delivery.', 'error'); return; }
      if (data.order) updateOrdersState(data.order);
      await loadDeliveryWorkspace(getRestaurantToken());
      window.showSystemToast?.('Borzo Updated', data.message || 'Borzo delivery requested.', 'success');
    } catch {
      window.showSystemToast?.('Error', 'Unable to create Borzo delivery.', 'error');
    } finally {
      setDispatchingOrderId('');
    }
  };

  const toggleAvailability = async (itemId: string, available: boolean) => {
    setMenuActionItemId(itemId);
    try {
      const res = await fetch('/api/my-restaurant/menu', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getRestaurantToken()}` },
        body: JSON.stringify({ itemId, available }),
      });
      const data = await res.json();
      if (data.success) {
        setMenuItems((c) => c.map((item) => (item._id === itemId ? data.item : item)));
        window.showSystemToast?.('Menu Updated', available ? 'Item is now visible to customers.' : 'Item has been hidden.', 'success');
      } else {
        window.showSystemToast?.('Error', data.message, 'error');
      }
    } catch {
      window.showSystemToast?.('Error', 'Failed to update item availability.', 'error');
    } finally {
      setMenuActionItemId('');
    }
  };

  const deleteMenuItem = async (itemId: string) => {
    if (!confirm('Delete this menu item? This action cannot be undone.')) return;
    setMenuActionItemId(itemId);
    try {
      const res = await fetch(`/api/my-restaurant/menu?itemId=${itemId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getRestaurantToken()}` },
      });
      const data = await res.json();
      if (data.success) {
        setMenuItems((c) => c.filter((item) => item._id !== itemId));
        window.showSystemToast?.('Deleted', 'Menu item removed successfully.', 'success');
      } else {
        window.showSystemToast?.('Error', data.message, 'error');
      }
    } catch {
      window.showSystemToast?.('Error', 'Failed to delete menu item.', 'error');
    } finally {
      setMenuActionItemId('');
    }
  };

  // ── Loading ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <Navbar scrolled />
        <main style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 44, height: 44, border: `2px solid ${C.orange}`, borderTopColor: 'transparent',
              borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
            }} />
            <p style={{ color: C.textMuted, fontSize: 12, letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif" }}>
              Loading workspace
            </p>
          </div>
        </main>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </>
    );
  }

  if (!isOwner || !restaurant) {
    return (
      <>
        <Navbar scrolled />
        <main style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: C.orange, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 12 }}>Redirecting</p>
            <h1 style={{ color: C.textMain, fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Restaurant profile required</h1>
            <p style={{ color: C.textMuted }}>Taking you to restaurant registration…</p>
          </div>
        </main>
      </>
    );
  }

  // ── Derived data ─────────────────────────────────────────────────
  const liveOrders           = orders.filter((o) => !['Completed', 'Rejected', 'Cancelled'].includes(o.status));
  const todayOrders          = orders.filter((o) => isToday(o.timestamp));
  const activeMenuItems      = menuItems.filter((i) => i.available);
  const preparingOrders      = deliveryOrders.filter((o) => o.status === 'Preparing');
  const outForDeliveryOrders = deliveryOrders.filter((o) => o.status === 'Out for Delivery');
  const availableAgents      = agents.filter((a) => a.status === 'Available');
  const totalRevenue         = orders
    .filter((o) => !['Rejected', 'Cancelled', 'Failed'].includes(o.status))
    .reduce((sum, o) => sum + (o.total || 0), 0);

  const tabs = [
    { id: 'orders'   as const, label: 'Orders',   count: liveOrders.length },
    { id: 'delivery' as const, label: 'Delivery',  count: preparingOrders.length },
    { id: 'menu'     as const, label: 'Menu',      count: activeMenuItems.length },
  ];

  const stats = [
    { label: 'Orders Today',    value: todayOrders.length,          icon: '📋', color: C.orange },
    { label: 'Active Orders',   value: liveOrders.length,           icon: '🔥', color: '#fbbf24' },
    { label: 'Live Menu Items', value: activeMenuItems.length,      icon: '🍽️', color: '#34d399' },
    { label: 'Revenue',         value: formatCurrency(totalRevenue), icon: '💰', color: '#a78bfa' },
  ];

  return (
    <>
      <Navbar scrolled />
      <ToastInit />

      <main style={{ minHeight: '100vh', background: C.bg, fontFamily: "'DM Sans', sans-serif" }}>

        {/* ── Hero Banner ───────────────────────────────────────────── */}
        <div style={{ position: 'relative', height: 260, overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: `url(${restaurant.imageUrl || getDefaultImage(restaurant.name)})`,
            backgroundSize: 'cover', backgroundPosition: 'center',
          }} />
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to top, ${C.bg} 0%, ${C.bg}bb 40%, transparent 100%)` }} />
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to right, ${C.bg}99, transparent)` }} />

          <div style={{ position: 'relative', height: '100%', maxWidth: 1280, margin: '0 auto', padding: '0 24px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <p style={{ color: C.orange, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>
                  Restaurant Operations
                </p>
                <h1 style={{ color: C.textMain, fontSize: 'clamp(28px, 5vw, 42px)', fontWeight: 700, fontFamily: "'Playfair Display', serif", margin: '0 0 8px' }}>
                  {restaurant.name}
                </h1>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', alignItems: 'center' }}>
                  {[restaurant.contact, restaurant.address, `${restaurant.estimatedDeliveryTime || 30} min delivery`].map((text, i) => (
                    <span key={i} style={{ color: C.textMuted, fontSize: 13 }}>{text}</span>
                  ))}
                </div>
              </div>
              <button
                onClick={toggleRestaurantOpen}
                disabled={togglingOpen}
                title={restaurant.isOpen === false ? 'Click to open restaurant' : 'Click to close restaurant'}
                style={{
                  padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 6, cursor: togglingOpen ? 'wait' : 'pointer',
                  background: restaurant.isOpen === false ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
                  color: restaurant.isOpen === false ? '#f87171' : '#34d399',
                  border: `1px solid ${restaurant.isOpen === false ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
                  transition: 'all 0.2s', opacity: togglingOpen ? 0.6 : 1,
                }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: restaurant.isOpen === false ? '#f87171' : '#34d399',
                  display: 'inline-block',
                  animation: restaurant.isOpen !== false ? 'pulse 2s infinite' : 'none',
                }} />
                {togglingOpen ? 'Updating...' : (restaurant.isOpen === false ? '● Closed — tap to open' : '● Open for orders — tap to close')}
              </button>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px 80px' }}>

          {/* ── Stat Cards ──────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 28 }}>
            {stats.map((s) => (
              <div key={s.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ color: C.textFaint, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600 }}>{s.label}</span>
                  <span style={{ fontSize: 20 }}>{s.icon}</span>
                </div>
                <p style={{ color: s.color, fontSize: 26, fontWeight: 700, margin: 0 }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* ── Tabs ────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 4, padding: 4, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, width: 'fit-content', marginBottom: 24 }}>
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 18px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                  border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                  background: active ? C.orange : 'transparent',
                  color: active ? '#fff' : C.textMuted,
                  boxShadow: active ? `0 4px 14px ${C.orange}40` : 'none',
                  transition: 'all 0.18s',
                }}>
                  {tab.label}
                  {tab.count > 0 && (
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      padding: '2px 7px', borderRadius: 999,
                      background: active ? 'rgba(255,255,255,0.22)' : C.border,
                      color: active ? '#fff' : '#d4d4d8',
                    }}>{tab.count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ════════════════════════════════════════════════════════
              ORDERS TAB
          ════════════════════════════════════════════════════════ */}
          {activeTab === 'orders' && (
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
                <div>
                  <p style={{ color: C.orange, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 700, margin: '0 0 4px' }}>Live Queue</p>
                  <h2 style={{ color: C.textMain, fontSize: 22, fontWeight: 700, margin: 0 }}>Order Management</h2>
                </div>
                <span style={{ color: C.textFaint, fontSize: 13 }}>{orders.length} total orders</span>
              </div>

              {orders.length === 0 ? (
                <div style={{ background: C.surface, border: `1px dashed ${C.border}`, borderRadius: 16, padding: '64px 24px', textAlign: 'center' }}>
                  <p style={{ fontSize: 32, margin: '0 0 12px' }}>🍽️</p>
                  <h3 style={{ color: C.textMain, fontWeight: 600, margin: '0 0 6px' }}>No orders yet</h3>
                  <p style={{ color: C.textFaint, fontSize: 14, margin: 0 }}>Once customers place orders, they will appear here.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                  {orders.map((order) => {
                    const sc = getStatusColors(order.status);
                    const borderCol = getStatusBorderColor(order.status);
                    return (
                      <article key={order._id} style={{
                        background: C.surface,
                        border: `1px solid ${C.border}`,
                        borderLeft: `4px solid ${borderCol}`,
                        borderRadius: 14,
                        display: 'flex', flexDirection: 'column',
                        overflow: 'hidden',
                      }}>
                        {/* Card top */}
                        <div style={{ padding: '16px 16px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                          <div>
                            <p style={{ color: C.textFaint, fontSize: 11, fontFamily: 'monospace', margin: '0 0 2px' }}>#{order._id.slice(-6).toUpperCase()}</p>
                            <h3 style={{ color: C.textMain, fontSize: 15, fontWeight: 600, margin: 0 }}>{order.customerName}</h3>
                          </div>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                            background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
                            whiteSpace: 'nowrap', flexShrink: 0,
                          }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.dot, display: 'inline-block' }} />
                            {order.status}
                          </span>
                        </div>

                        <div style={{ padding: '0 16px 10px', display: 'flex', flexWrap: 'wrap', gap: '2px 12px' }}>
                          <span style={{ color: C.textFaint, fontSize: 12 }}>{formatOrderTime(order.timestamp)}</span>
                          {(order.phone || order.contact) && <span style={{ color: C.textFaint, fontSize: 12 }}>{order.phone || order.contact}</span>}
                          <span style={{ color: C.textFaint, fontSize: 12 }}>{order.paymentMethod || 'Online'}</span>
                        </div>

                        <div style={{ padding: '0 16px 10px' }}>
                          <p style={{ color: C.textMuted, fontSize: 12, lineHeight: 1.5, margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>{order.address}</p>
                        </div>

                        <div style={{ padding: '0 16px 12px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {order.items?.length ? order.items.map((item, i) => (
                            <span key={i} style={{ background: C.elevated, color: '#d4d4d8', fontSize: 12, padding: '3px 8px', borderRadius: 6 }}>
                              {item.quantity || 1}× {item.name || 'Item'}
                            </span>
                          )) : <span style={{ color: C.textFaint, fontSize: 12 }}>No item details</span>}
                        </div>

                        <div style={{ marginTop: 'auto', borderTop: `1px solid ${C.border}`, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                          <div>
                            <p style={{ color: C.textFaint, fontSize: 11, margin: '0 0 2px' }}>Order total</p>
                            <p style={{ color: C.textMain, fontSize: 15, fontWeight: 700, margin: 0 }}>{formatCurrency(order.total)}</p>
                          </div>
                          {order.status === 'Pending' ? (
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button type="button" disabled={savingOrderId === order._id} onClick={() => updateStatus(order._id, 'Preparing')} style={{
                                background: C.orange, color: '#fff', border: 'none', borderRadius: 8,
                                padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                                opacity: savingOrderId === order._id ? 0.5 : 1, fontFamily: "'DM Sans', sans-serif",
                              }}>
                                {savingOrderId === order._id ? 'Accepting…' : 'Accept'}
                              </button>
                              <button type="button" disabled={savingOrderId === order._id} onClick={() => updateStatus(order._id, 'Rejected')} style={{
                                background: C.elevated, border: `1px solid ${C.border2}`,
                                color: '#d4d4d8', borderRadius: 8,
                                padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                                opacity: savingOrderId === order._id ? 0.5 : 1, fontFamily: "'DM Sans', sans-serif",
                              }}>
                                Reject
                              </button>
                            </div>
                          ) : order.status === 'Preparing' ? (
                            <button type="button" onClick={() => setActiveTab('delivery')} style={{
                              background: C.elevated, border: `1px solid ${C.border2}`,
                              color: '#93c5fd', borderRadius: 8,
                              padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                            }}>
                              Assign Agent →
                            </button>
                          ) : order.status === 'Out for Delivery' ? (
                            <span style={{ color: '#a78bfa', fontSize: 12, fontWeight: 600 }}>Out for delivery</span>
                          ) : order.status === 'Completed' ? (
                            <span style={{ color: '#34d399', fontSize: 12, fontWeight: 600 }}>✓ Delivered</span>
                          ) : (
                            <span style={{ color: C.textFaint, fontSize: 12 }}>No action needed</span>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* ════════════════════════════════════════════════════════
              DELIVERY TAB
          ════════════════════════════════════════════════════════ */}
          {activeTab === 'delivery' && (
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
                <div>
                  <p style={{ color: C.orange, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 700, margin: '0 0 4px' }}>Dispatch Center</p>
                  <h2 style={{ color: C.textMain, fontSize: 22, fontWeight: 700, margin: 0 }}>Delivery Management</h2>
                </div>
                <button type="button" disabled={loadingDelivery} onClick={async () => {
                  setLoadingDelivery(true);
                  try { await loadDeliveryWorkspace(getRestaurantToken()); }
                  catch { window.showSystemToast?.('Error', 'Failed to refresh.', 'error'); }
                  finally { setLoadingDelivery(false); }
                }} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: C.elevated, border: `1px solid ${C.border}`,
                  color: '#d4d4d8', fontSize: 13, fontWeight: 600, padding: '8px 14px',
                  borderRadius: 10, cursor: 'pointer', opacity: loadingDelivery ? 0.5 : 1,
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                  <span style={{ display: 'inline-block', animation: loadingDelivery ? 'spin 0.8s linear infinite' : 'none' }}>↻</span>
                  {loadingDelivery ? 'Refreshing…' : 'Refresh'}
                </button>
              </div>

              {deliveryResult && (
                <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 14, padding: '14px 18px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ color: '#34d399', fontSize: 14, fontWeight: 600, margin: '0 0 4px' }}>Agent assigned successfully</p>
                    <p style={{ color: '#6ee7b7', fontSize: 14, margin: 0 }}>
                      OTP for <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>#{deliveryResult.orderId.slice(-5).toUpperCase()}</span>:{' '}
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 18 }}>{deliveryResult.otp}</span>
                    </p>
                  </div>
                  <button type="button" onClick={() => setDeliveryResult(null)} style={{ background: 'none', border: 'none', color: '#34d399', fontSize: 18, cursor: 'pointer', padding: 4 }}>✕</button>
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                {[
                  { label: 'Preparing',        count: preparingOrders.length,      bg: 'rgba(59,130,246,0.12)',  color: '#60a5fa' },
                  { label: 'Out for delivery', count: outForDeliveryOrders.length, bg: 'rgba(139,92,246,0.12)', color: '#a78bfa' },
                  { label: 'Agents available', count: availableAgents.length,      bg: 'rgba(16,185,129,0.12)', color: '#34d399' },
                ].map((p) => (
                  <span key={p.label} style={{ background: p.bg, color: p.color, fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 999 }}>
                    {p.count} {p.label}
                  </span>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>

                {/* Agents Panel */}
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
                  <div style={{ padding: '16px 18px', borderBottom: `1px solid ${C.border}` }}>
                    <h3 style={{ color: C.textMain, fontSize: 15, fontWeight: 600, margin: '0 0 2px' }}>Delivery Agents</h3>
                    <p style={{ color: C.textFaint, fontSize: 12, margin: 0 }}>Live workload of your riders</p>
                  </div>
                  <div style={{ padding: 12 }}>
                    {agents.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                        <p style={{ fontSize: 28, margin: '0 0 8px' }}>🛵</p>
                        <p style={{ color: C.textMuted, fontSize: 14, margin: '0 0 4px' }}>No delivery agents found</p>
                        <p style={{ color: C.textFaint, fontSize: 12, margin: 0 }}>Ask admin to add riders</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {agents.map((agent) => {
                          const isAvail = agent.status === 'Available';
                          const loadPct = Math.min(100, Math.round((agent.currentLoad / agent.maxBatchLimit) * 100));
                          return (
                            <div key={agent._id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: C.elevated, borderRadius: 10, padding: '10px 14px' }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: isAvail ? '#34d399' : '#52525b', flexShrink: 0 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ color: C.textMain, fontSize: 14, fontWeight: 600, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agent.name}</p>
                                <p style={{ color: C.textFaint, fontSize: 12, margin: 0 }}>{agent.phone || 'No phone'}</p>
                              </div>
                              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <span style={{ color: isAvail ? '#34d399' : C.textFaint, fontSize: 12, fontWeight: 600 }}>{agent.status}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                  <div style={{ width: 56, height: 4, background: C.border, borderRadius: 2, overflow: 'hidden' }}>
                                    <div style={{ width: `${loadPct}%`, height: '100%', background: C.orange, borderRadius: 2 }} />
                                  </div>
                                  <span style={{ color: C.textFaint, fontSize: 11 }}>{agent.currentLoad}/{agent.maxBatchLimit}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Dispatch Panel */}
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
                  <div style={{ padding: '16px 18px', borderBottom: `1px solid ${C.border}` }}>
                    <h3 style={{ color: C.textMain, fontSize: 15, fontWeight: 600, margin: '0 0 2px' }}>Ready for Dispatch</h3>
                    <p style={{ color: C.textFaint, fontSize: 12, margin: 0 }}>Assign agents or trigger Borzo</p>
                  </div>
                  <div style={{ padding: 12 }}>
                    {deliveryOrders.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                        <p style={{ fontSize: 28, margin: '0 0 8px' }}>📦</p>
                        <p style={{ color: C.textMuted, fontSize: 14, margin: '0 0 4px' }}>No active delivery orders</p>
                        <p style={{ color: C.textFaint, fontSize: 12, margin: 0 }}>Preparing orders will appear here</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {deliveryOrders.map((order) => {
                          const assignedAgent = order.agentId && typeof order.agentId === 'object' ? order.agentId : null;
                          const canAssign = order.status === 'Preparing';
                          const sc = getStatusColors(order.status);
                          return (
                            <div key={order._id} style={{ background: C.elevated, borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                                <div>
                                  <p style={{ color: C.textFaint, fontSize: 11, fontFamily: 'monospace', margin: '0 0 2px' }}>#{order._id.slice(-6).toUpperCase()}</p>
                                  <p style={{ color: C.textMain, fontSize: 14, fontWeight: 600, margin: 0 }}>{order.customerName}</p>
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: sc.bg, color: sc.color }}>
                                  {order.status}
                                </span>
                              </div>

                              <p style={{ color: C.textFaint, fontSize: 12, margin: 0 }}>
                                {order.paymentMethod === 'COD' ? 'Cash on delivery' : 'Paid online'} · {formatCurrency(order.total)}
                              </p>
                              <p style={{ color: C.textMuted, fontSize: 12, margin: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{order.address}</p>

                              {order.inHouseDelivery && (
                                <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '8px 12px' }}>
                                  <p style={{ color: '#34d399', fontSize: 12, margin: 0 }}>
                                    Assigned to {assignedAgent?.name || 'agent'}
                                    {order.deliveryOtp ? ` · OTP: ${order.deliveryOtp}` : ''}
                                  </p>
                                </div>
                              )}

                              {order.borzoStatus && (
                                <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '8px 12px' }}>
                                  <p style={{ color: '#60a5fa', fontSize: 12, margin: 0 }}>Borzo: {order.borzoStatus}</p>
                                </div>
                              )}

                              {canAssign && expandedAssignOrderId === order._id ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  <p style={{ color: C.textMuted, fontSize: 12, fontWeight: 600, margin: 0 }}>Choose delivery agent:</p>
                                  {agents.map((agent) => (
                                    <button key={agent._id} type="button"
                                      disabled={assigningOrderId === order._id || agent.status === 'Offline'}
                                      onClick={() => assignAgent(order._id, agent._id)}
                                      style={{
                                        textAlign: 'left', background: C.border, border: `1px solid ${C.border2}`,
                                        borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#d4d4d8',
                                        cursor: 'pointer', opacity: agent.status === 'Offline' ? 0.4 : 1,
                                        fontFamily: "'DM Sans', sans-serif",
                                      }}>
                                      {agent.name} <span style={{ color: C.textFaint }}>({agent.currentLoad}/{agent.maxBatchLimit})</span>
                                    </button>
                                  ))}
                                  <div style={{ display: 'flex', gap: 8 }}>
                                    <button type="button" onClick={() => setExpandedAssignOrderId('')} style={{ flex: 1, background: C.border, border: 'none', color: C.textMuted, fontSize: 12, fontWeight: 600, padding: '8px', borderRadius: 8, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                                      Cancel
                                    </button>
                                    {!order.borzoTrackingUrl && (
                                      <button type="button" disabled={dispatchingOrderId === order._id} onClick={() => createBorzoDispatch(order._id)} style={{ flex: 1, background: C.orange, border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, padding: '8px', borderRadius: 8, cursor: 'pointer', opacity: dispatchingOrderId === order._id ? 0.5 : 1, fontFamily: "'DM Sans', sans-serif" }}>
                                        {dispatchingOrderId === order._id ? 'Starting…' : 'Use Borzo'}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ) : canAssign ? (
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <button type="button" disabled={assigningOrderId === order._id} onClick={() => setExpandedAssignOrderId(order._id)} style={{ flex: 1, background: C.orange, border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, padding: '8px', borderRadius: 8, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                                    Assign Agent
                                  </button>
                                  {!order.borzoTrackingUrl ? (
                                    <button type="button" disabled={dispatchingOrderId === order._id} onClick={() => createBorzoDispatch(order._id)} style={{ flex: 1, background: C.elevated, border: `1px solid ${C.border2}`, color: '#d4d4d8', fontSize: 12, fontWeight: 600, padding: '8px', borderRadius: 8, cursor: 'pointer', opacity: dispatchingOrderId === order._id ? 0.5 : 1, fontFamily: "'DM Sans', sans-serif" }}>
                                      {dispatchingOrderId === order._id ? 'Starting…' : 'Borzo'}
                                    </button>
                                  ) : (
                                    <a href={order.borzoTrackingUrl} target="_blank" rel="noreferrer" style={{ flex: 1, textAlign: 'center', background: C.elevated, border: `1px solid ${C.border2}`, color: '#93c5fd', fontSize: 12, fontWeight: 600, padding: '8px', borderRadius: 8, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                      Track Borzo ↗
                                    </a>
                                  )}
                                </div>
                              ) : (
                                <p style={{ color: C.textFaint, fontSize: 12, margin: 0 }}>Waiting for delivery confirmation</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ════════════════════════════════════════════════════════
              MENU TAB
          ════════════════════════════════════════════════════════ */}
          {activeTab === 'menu' && (
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
                <div>
                  <p style={{ color: C.orange, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 700, margin: '0 0 4px' }}>Menu Control</p>
                  <h2 style={{ color: C.textMain, fontSize: 22, fontWeight: 700, margin: 0 }}>Publish &amp; Manage Items</h2>
                </div>
                <button type="button" onClick={() => setShowAddMenu((v) => !v)} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: showAddMenu ? C.elevated : C.orange,
                  border: showAddMenu ? `1px solid ${C.border2}` : 'none',
                  color: showAddMenu ? '#d4d4d8' : '#fff',
                  fontSize: 14, fontWeight: 700, padding: '9px 18px', borderRadius: 10, cursor: 'pointer',
                  boxShadow: showAddMenu ? 'none' : `0 4px 14px ${C.orange}40`,
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                  {showAddMenu ? '✕ Close' : '+ Add Item'}
                </button>
              </div>

              {showAddMenu && (
                <form onSubmit={addMenuItem} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, marginBottom: 24 }}>
                  <h3 style={{ color: C.textMain, fontSize: 15, fontWeight: 600, margin: '0 0 16px' }}>New Menu Item</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 14 }}>
                    {[
                      { label: 'Item name', field: 'name' as const, type: 'text', placeholder: 'Paneer Butter Masala', required: true },
                      { label: 'Price (₹)', field: 'price' as const, type: 'number', placeholder: '249', required: true },
                    ].map(({ label, field, type, placeholder, required }) => (
                      <label key={field} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <span style={{ color: C.textMuted, fontSize: 12, fontWeight: 600 }}>
                          {label} {required && <span style={{ color: C.orange }}>*</span>}
                        </span>
                        <input type={type} placeholder={placeholder} value={menuForm[field] as string}
                          onChange={(e) => updateMenuField(field, e.target.value)}
                          style={inputStyle} required={required} />
                      </label>
                    ))}
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ color: C.textMuted, fontSize: 12, fontWeight: 600 }}>Category</span>
                      <select value={menuForm.category} onChange={(e) => updateMenuField('category', e.target.value)} style={inputStyle}>
                        {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ color: C.textMuted, fontSize: 12, fontWeight: 600 }}>Image URL</span>
                      <input type="url" placeholder="https://…" value={menuForm.imageUrl} onChange={(e) => updateMenuField('imageUrl', e.target.value)} style={inputStyle} />
                    </label>
                  </div>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                    <span style={{ color: C.textMuted, fontSize: 12, fontWeight: 600 }}>Description</span>
                    <textarea rows={3} placeholder="Write an appetizing description…" value={menuForm.description}
                      onChange={(e) => updateMenuField('description', e.target.value)}
                      style={{ ...inputStyle, resize: 'vertical' }} />
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => updateMenuField('available', !menuForm.available)}>
                      <div style={{ width: 36, height: 20, borderRadius: 999, background: menuForm.available ? C.orange : C.border, position: 'relative', transition: 'background 0.2s' }}>
                        <div style={{ position: 'absolute', top: 2, left: menuForm.available ? 18 : 2, width: 16, height: 16, background: '#fff', borderRadius: '50%', boxShadow: '0 1px 4px rgba(0,0,0,0.25)', transition: 'left 0.2s' }} />
                      </div>
                      <span style={{ color: C.textMuted, fontSize: 14 }}>Visible to customers immediately</span>
                    </div>
                    <button type="submit" disabled={savingMenu} style={{
                      background: C.orange, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700,
                      padding: '10px 24px', borderRadius: 10, cursor: 'pointer',
                      opacity: savingMenu ? 0.5 : 1, fontFamily: "'DM Sans', sans-serif",
                    }}>
                      {savingMenu ? 'Saving…' : 'Save Item'}
                    </button>
                  </div>
                </form>
              )}

              {menuItems.length === 0 ? (
                <div style={{ background: C.surface, border: `1px dashed ${C.border}`, borderRadius: 16, padding: '64px 24px', textAlign: 'center' }}>
                  <p style={{ fontSize: 32, margin: '0 0 12px' }}>🍛</p>
                  <h3 style={{ color: C.textMain, fontWeight: 600, margin: '0 0 6px' }}>Your menu is empty</h3>
                  <p style={{ color: C.textFaint, fontSize: 14, margin: 0 }}>Add your first dish to start building your storefront.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
                  {menuItems.map((item) => (
                    <article key={item._id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                      {/* Image */}
                      <div style={{
                        height: 160, position: 'relative',
                        backgroundImage: `linear-gradient(180deg, rgba(12,10,9,0.1) 0%, rgba(12,10,9,0.55) 100%), url(${item.imageUrl || getDefaultImage(item.name)})`,
                        backgroundSize: 'cover', backgroundPosition: 'center',
                      }}>
                        <div style={{ position: 'absolute', top: 10, right: 10 }}>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
                            background: item.available ? 'rgba(16,185,129,0.18)' : 'rgba(82,82,91,0.5)',
                            color: item.available ? '#34d399' : '#a1a1aa',
                            border: `1px solid ${item.available ? 'rgba(16,185,129,0.35)' : 'rgba(82,82,91,0.4)'}`,
                          }}>
                            {item.available ? '● Live' : '○ Hidden'}
                          </span>
                        </div>
                      </div>

                      {/* Content */}
                      <div style={{ padding: '14px 14px 0', display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                          <h3 style={{ color: C.textMain, fontSize: 14, fontWeight: 600, margin: 0, lineHeight: 1.3 }}>{item.name}</h3>
                          <span style={{ color: C.orange, fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{formatCurrency(item.price)}</span>
                        </div>
                        <p style={{ color: C.textFaint, fontSize: 12, margin: 0 }}>{item.category}</p>
                        <p style={{ color: C.textMuted, fontSize: 12, lineHeight: 1.5, margin: 0, flex: 1, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                          {item.description || 'No description added yet.'}
                        </p>
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: 8, margin: '12px 14px 14px', paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                        <button type="button" disabled={menuActionItemId === item._id} onClick={() => toggleAvailability(item._id, !item.available)} style={{
                          flex: 1, fontSize: 12, fontWeight: 700, padding: '7px', borderRadius: 8, cursor: 'pointer',
                          opacity: menuActionItemId === item._id ? 0.4 : 1, fontFamily: "'DM Sans', sans-serif",
                          ...(item.available
                            ? { background: C.elevated, border: `1px solid ${C.border2}`, color: '#d4d4d8' }
                            : { background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', color: '#34d399' }),
                        }}>
                          {item.available ? 'Hide' : 'Show'}
                        </button>
                        <button type="button" disabled={menuActionItemId === item._id} onClick={() => deleteMenuItem(item._id)} style={{
                          flex: 1, fontSize: 12, fontWeight: 700, padding: '7px', borderRadius: 8, cursor: 'pointer',
                          background: C.elevated, border: `1px solid ${C.border2}`, color: '#a1a1aa',
                          opacity: menuActionItemId === item._id ? 0.4 : 1, fontFamily: "'DM Sans', sans-serif",
                        }}>
                          Delete
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

        </div>
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
      `}</style>
    </>
  );
}