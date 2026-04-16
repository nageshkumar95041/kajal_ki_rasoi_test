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

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'orders' || tab === 'delivery' || tab === 'menu') {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const updateOrdersState = (updatedOrder: Order) => {
    setOrders((current) => current.map((order) => (order._id === updatedOrder._id ? { ...order, ...updatedOrder } : order)));
    setDeliveryOrders((current) => {
      const isDeliveryStatus = ['Preparing', 'Out for Delivery'].includes(updatedOrder.status);
      const exists = current.some((order) => order._id === updatedOrder._id);
      let next = exists
        ? current.map((order) => (order._id === updatedOrder._id ? { ...order, ...updatedOrder } : order))
        : current;

      if (!exists && isDeliveryStatus) {
        next = [updatedOrder, ...next];
      }

      if (!isDeliveryStatus) {
        return next.filter((order) => order._id !== updatedOrder._id);
      }

      return next;
    });
  };

  const loadDeliveryWorkspace = async (token: string) => {
    const res = await fetch('/api/my-restaurant/delivery', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error('Failed to load delivery workspace');
    }

    const data = await res.json();
    setDeliveryOrders(Array.isArray(data.orders) ? data.orders : []);
    setAgents(Array.isArray(data.agents) ? data.agents : []);
  };

  const loadDashboard = async () => {
    const token = getRestaurantToken();

    if (!token) {
      window.location.href = '/login?next=/restaurant/dashboard';
      return;
    }

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
        setTimeout(() => {
          window.location.href = '/restaurant/register';
        }, 1200);
        return;
      }

      if (restaurantRes.status === 401 || restaurantRes.status === 403) {
        window.location.href = '/login?next=/restaurant/dashboard';
        return;
      }

      if (!restaurantRes.ok || !ordersRes.ok || !menuRes.ok || !deliveryRes.ok) {
        throw new Error('Failed to load restaurant workspace');
      }

      const [restaurantData, ordersData, menuData, deliveryData] = await Promise.all([
        restaurantRes.json(),
        ordersRes.json(),
        menuRes.json(),
        deliveryRes.json(),
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

  const updateMenuField = (field: keyof typeof menuForm, value: string | boolean) => {
    setMenuForm((current) => ({ ...current, [field]: value }));
  };

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
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getRestaurantToken()}`,
        },
        body: JSON.stringify({
          ...menuForm,
          price: parseFloat(menuForm.price),
        }),
      });

      const data = await res.json();

      if (data.success) {
        setMenuItems((current) => [data.item, ...current]);
        setMenuForm({
          name: '',
          price: '',
          description: '',
          category: 'Main Course',
          imageUrl: '',
          available: true,
        });
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

  const updateStatus = async (orderId: string, status: string) => {
    setSavingOrderId(orderId);

    try {
      const res = await fetch('/api/my-restaurant/orders', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getRestaurantToken()}`,
        },
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
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getRestaurantToken()}`,
        },
        body: JSON.stringify({ orderId, agentId }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        window.showSystemToast?.('Error', data.message || 'Failed to assign agent.', 'error');
        return;
      }

      if (data.order) {
        updateOrdersState(data.order);
      }
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

      if (!res.ok || !data.success) {
        window.showSystemToast?.('Error', data.message || 'Failed to start Borzo delivery.', 'error');
        return;
      }

      if (data.order) {
        updateOrdersState(data.order);
      }
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
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getRestaurantToken()}`,
        },
        body: JSON.stringify({ itemId, available }),
      });

      const data = await res.json();

      if (data.success) {
        setMenuItems((current) => current.map((item) => (item._id === itemId ? data.item : item)));
        window.showSystemToast?.(
          'Menu Updated',
          available ? 'Item is now visible to customers.' : 'Item has been hidden from customers.',
          'success'
        );
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
        setMenuItems((current) => current.filter((item) => item._id !== itemId));
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

  if (loading) {
    return (
      <>
        <Navbar scrolled />
        <main className="restaurant-dashboard-page restaurant-dashboard-loading">
          <div className="restaurant-dashboard-loading-card">
            <p className="restaurant-dashboard-eyebrow">Loading Workspace</p>
            <h1>Preparing your restaurant dashboard...</h1>
            <p>We are fetching your overview, order queue, and menu inventory.</p>
          </div>
        </main>
      </>
    );
  }

  if (!isOwner || !restaurant) {
    return (
      <>
        <Navbar scrolled />
        <main className="restaurant-dashboard-page restaurant-dashboard-loading">
          <div className="restaurant-dashboard-loading-card">
            <p className="restaurant-dashboard-eyebrow">Redirecting</p>
            <h1>Restaurant profile required</h1>
            <p>Taking you to restaurant registration so your dashboard can be activated.</p>
          </div>
        </main>
      </>
    );
  }

  const liveOrders = orders.filter((order) => !['Completed', 'Rejected', 'Cancelled'].includes(order.status));
  const todayOrders = orders.filter((order) => isToday(order.timestamp));
  const activeMenuItems = menuItems.filter((item) => item.available);
  const preparingOrders = deliveryOrders.filter((order) => order.status === 'Preparing');
  const outForDeliveryOrders = deliveryOrders.filter((order) => order.status === 'Out for Delivery');
  const availableAgents = agents.filter((agent) => agent.status === 'Available');
  const totalRevenue = orders
    .filter((order) => !['Rejected', 'Cancelled', 'Failed'].includes(order.status))
    .reduce((sum, order) => sum + (order.total || 0), 0);

  return (
    <>
      <Navbar scrolled />
      <ToastInit />

      <main className="restaurant-dashboard-page">
        <section className="restaurant-dashboard-shell">
          <header className="restaurant-dashboard-hero">
            <div className="restaurant-dashboard-hero-copy">
              <p className="restaurant-dashboard-eyebrow">Restaurant Operations</p>
              <h1>{restaurant.name}</h1>
              <p className="restaurant-dashboard-lead">
                Manage menu updates, keep order statuses accurate, and maintain a polished storefront for your customers.
              </p>

              <div className="restaurant-dashboard-meta">
                <span>{restaurant.contact}</span>
                <span>{restaurant.address}</span>
                <span>{restaurant.estimatedDeliveryTime || 30} min average delivery</span>
              </div>

              {restaurant.description && (
                <div className="restaurant-dashboard-story">
                  <h2>About your restaurant</h2>
                  <p>{restaurant.description}</p>
                </div>
              )}
            </div>

            <div className="restaurant-dashboard-cover-card">
              <div
                className="restaurant-dashboard-cover"
                style={{
                  backgroundImage: `linear-gradient(180deg, rgba(18, 8, 0, 0.06), rgba(18, 8, 0, 0.68)), url(${restaurant.imageUrl || getDefaultImage(restaurant.name)})`,
                }}
              >
                <span className={`restaurant-dashboard-open-pill ${restaurant.isOpen === false ? 'closed' : ''}`}>
                  {restaurant.isOpen === false ? 'Currently Closed' : 'Open for Orders'}
                </span>
                <div className="restaurant-dashboard-cover-info">
                  <p>Today&apos;s focus</p>
                  <strong>{liveOrders.length} active orders to manage</strong>
                </div>
              </div>
            </div>
          </header>

          <section className="restaurant-dashboard-stats">
            <article className="restaurant-stat-card">
              <span className="restaurant-stat-label">Orders Today</span>
              <strong>{todayOrders.length}</strong>
              <p>Fresh incoming demand across today&apos;s service window.</p>
            </article>
            <article className="restaurant-stat-card">
              <span className="restaurant-stat-label">Active Orders</span>
              <strong>{liveOrders.length}</strong>
              <p>Orders that still need kitchen or delivery action.</p>
            </article>
            <article className="restaurant-stat-card">
              <span className="restaurant-stat-label">Live Menu Items</span>
              <strong>{activeMenuItems.length}</strong>
              <p>Currently visible dishes your customers can order.</p>
            </article>
            <article className="restaurant-stat-card">
              <span className="restaurant-stat-label">Revenue Tracked</span>
              <strong>{formatCurrency(totalRevenue)}</strong>
              <p>Total from all non-cancelled orders in the dashboard history.</p>
            </article>
          </section>

          <section className="restaurant-dashboard-tabs">
            <button
              type="button"
              className={`restaurant-tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
              onClick={() => setActiveTab('orders')}
            >
              Orders
            </button>
            <button
              type="button"
              className={`restaurant-tab-btn ${activeTab === 'menu' ? 'active' : ''}`}
              onClick={() => setActiveTab('menu')}
            >
              Menu
            </button>
            <button
              type="button"
              className={`restaurant-tab-btn ${activeTab === 'delivery' ? 'active' : ''}`}
              onClick={() => setActiveTab('delivery')}
            >
              Delivery
            </button>
          </section>

          {activeTab === 'orders' && (
            <section className="restaurant-dashboard-section">
              <div className="restaurant-section-heading">
                <div>
                  <p className="restaurant-dashboard-eyebrow">Live Queue</p>
                  <h2>Order management</h2>
                </div>
                <p>Accept or reject new orders first, then assign delivery only after acceptance.</p>
              </div>

              {orders.length === 0 ? (
                <div className="restaurant-empty-state">
                  <h3>No orders yet</h3>
                  <p>Your dashboard is ready. Once customers place orders, they will appear here for live tracking.</p>
                </div>
              ) : (
                <div className="restaurant-orders-grid">
                  {orders.map((order) => (
                    <article key={order._id} className="restaurant-order-card">
                      <div className="restaurant-order-top">
                        <div>
                          <p className="restaurant-order-id">Order #{order._id.slice(-6).toUpperCase()}</p>
                          <h3>{order.customerName}</h3>
                        </div>
                        <span className={`restaurant-status-pill ${order.status.toLowerCase().replace(/\s+/g, '-')}`}>
                          {order.status}
                        </span>
                      </div>

                      <div className="restaurant-order-meta">
                        <span>{formatOrderTime(order.timestamp)}</span>
                        <span>{order.phone || order.contact || 'No contact provided'}</span>
                        <span>{order.paymentMethod || 'Online'}</span>
                      </div>

                      <p className="restaurant-order-address">{order.address}</p>

                      <div className="restaurant-order-items">
                        {order.items?.length ? (
                          order.items.map((item, index) => (
                            <span key={`${order._id}-${item.name || 'item'}-${index}`} className="restaurant-order-item-pill">
                              {(item.quantity || 1)} x {item.name || 'Menu item'}
                            </span>
                          ))
                        ) : (
                          <span className="restaurant-order-item-pill">No item details available</span>
                        )}
                      </div>

                      <div className="restaurant-order-footer">
                        <div>
                          <span className="restaurant-order-total-label">Order total</span>
                          <strong>{formatCurrency(order.total)}</strong>
                        </div>

                        {order.status === 'Pending' ? (
                          <div className="restaurant-inline-actions">
                            <button
                              type="button"
                              className="restaurant-primary-btn"
                              disabled={savingOrderId === order._id}
                              onClick={() => updateStatus(order._id, 'Preparing')}
                            >
                              {savingOrderId === order._id ? 'Accepting...' : 'Accept Order'}
                            </button>
                            <button
                              type="button"
                              className="restaurant-secondary-btn danger"
                              disabled={savingOrderId === order._id}
                              onClick={() => updateStatus(order._id, 'Rejected')}
                            >
                              {savingOrderId === order._id ? 'Updating...' : 'Reject Order'}
                            </button>
                          </div>
                        ) : order.status === 'Preparing' ? (
                          <div className="restaurant-order-stage-note">
                            <p>Order accepted. Assign delivery partner now.</p>
                            <button type="button" className="restaurant-secondary-btn" onClick={() => setActiveTab('delivery')}>
                              Assign Agent
                            </button>
                          </div>
                        ) : order.status === 'Out for Delivery' ? (
                          <div className="restaurant-order-stage-note">
                            <p>Out for delivery. Status will become completed after agent delivery confirmation.</p>
                          </div>
                        ) : order.status === 'Completed' ? (
                          <div className="restaurant-order-stage-note">
                            <p>Delivered successfully.</p>
                          </div>
                        ) : (
                          <div className="restaurant-order-stage-note">
                            <p>No further action needed for this order.</p>
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {activeTab === 'delivery' && (
            <section className="restaurant-dashboard-section">
              <div className="restaurant-section-heading restaurant-section-heading-menu">
                <div>
                  <p className="restaurant-dashboard-eyebrow">Dispatch Center</p>
                  <h2>Delivery management</h2>
                </div>
                <button
                  type="button"
                  className="restaurant-primary-btn"
                  disabled={loadingDelivery}
                  onClick={async () => {
                    setLoadingDelivery(true);
                    try {
                      await loadDeliveryWorkspace(getRestaurantToken());
                    } catch {
                      window.showSystemToast?.('Error', 'Failed to refresh delivery data.', 'error');
                    } finally {
                      setLoadingDelivery(false);
                    }
                  }}
                >
                  {loadingDelivery ? 'Refreshing...' : 'Refresh Delivery'}
                </button>
              </div>

              {deliveryResult && (
                <div className="restaurant-delivery-result">
                  <div>
                    <p>Agent assigned successfully.</p>
                    <strong>
                      OTP for #{deliveryResult.orderId.slice(-5).toUpperCase()}: {deliveryResult.otp}
                    </strong>
                  </div>
                  <button type="button" onClick={() => setDeliveryResult(null)}>
                    Close
                  </button>
                </div>
              )}

              <div className="restaurant-delivery-summary">
                <span>{preparingOrders.length} preparing orders</span>
                <span>{outForDeliveryOrders.length} out for delivery</span>
                <span>{availableAgents.length} agents available</span>
              </div>

              <div className="restaurant-delivery-grid">
                <article className="restaurant-delivery-panel">
                  <div className="restaurant-delivery-panel-head">
                    <h3>Delivery Agents</h3>
                    <p>Live workload of your riders.</p>
                  </div>

                  {agents.length === 0 ? (
                    <div className="restaurant-empty-state restaurant-delivery-empty">
                      <h3>No delivery agents found</h3>
                      <p>Ask admin to add riders so you can assign in-house deliveries.</p>
                    </div>
                  ) : (
                    <div className="restaurant-agent-list">
                      {agents.map((agent) => (
                        <div key={agent._id} className="restaurant-agent-card">
                          <div>
                            <h4>{agent.name}</h4>
                            <p>{agent.phone || 'No phone provided'}</p>
                          </div>
                          <div className="restaurant-agent-status-wrap">
                            <span className={`restaurant-agent-status ${agent.status.toLowerCase()}`}>{agent.status}</span>
                            <small>
                              {agent.currentLoad}/{agent.maxBatchLimit} orders
                            </small>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </article>

                <article className="restaurant-delivery-panel">
                  <div className="restaurant-delivery-panel-head">
                    <h3>Orders Ready for Dispatch</h3>
                    <p>Assign agents or trigger Borzo for active orders.</p>
                  </div>

                  {deliveryOrders.length === 0 ? (
                    <div className="restaurant-empty-state restaurant-delivery-empty">
                      <h3>No active delivery orders</h3>
                      <p>Preparing and out-for-delivery orders will appear here.</p>
                    </div>
                  ) : (
                    <div className="restaurant-dispatch-list">
                      {deliveryOrders.map((order) => {
                        const assignedAgent =
                          order.agentId && typeof order.agentId === 'object' ? order.agentId : null;
                        const canAssignNow = order.status === 'Preparing';

                        return (
                          <div key={order._id} className="restaurant-dispatch-card">
                            <div className="restaurant-dispatch-head">
                              <div>
                                <p className="restaurant-order-id">Order #{order._id.slice(-6).toUpperCase()}</p>
                                <h4>{order.customerName}</h4>
                              </div>
                              <span className={`restaurant-status-pill ${order.status.toLowerCase().replace(/\s+/g, '-')}`}>
                                {order.status}
                              </span>
                            </div>

                            <p className="restaurant-dispatch-meta">
                              {order.paymentMethod === 'COD' ? 'Cash on delivery' : 'Paid online'} - {formatCurrency(order.total)}
                            </p>
                            <p className="restaurant-order-address">{order.address}</p>

                            {order.inHouseDelivery ? (
                              <div className="restaurant-dispatch-info success">
                                <p>
                                  Assigned to {assignedAgent?.name || 'delivery agent'}.
                                  {order.deliveryOtp ? ` OTP: ${order.deliveryOtp}` : ''}
                                </p>
                              </div>
                            ) : (
                              <div className="restaurant-dispatch-info">
                                <p>No in-house agent assigned yet.</p>
                              </div>
                            )}

                            {order.borzoStatus && (
                              <div className="restaurant-dispatch-info info">
                                <p>Borzo status: {order.borzoStatus}</p>
                              </div>
                            )}

                            {canAssignNow && expandedAssignOrderId === order._id ? (
                              <div className="restaurant-assign-wrap">
                                <p>Choose a delivery agent:</p>
                                <div className="restaurant-assign-actions">
                                  {agents.map((agent) => (
                                    <button
                                      key={agent._id}
                                      type="button"
                                      className="restaurant-secondary-btn"
                                      disabled={assigningOrderId === order._id || agent.status === 'Offline'}
                                      onClick={() => assignAgent(order._id, agent._id)}
                                    >
                                      {agent.name} ({agent.currentLoad}/{agent.maxBatchLimit})
                                    </button>
                                  ))}
                                </div>
                                <div className="restaurant-inline-actions">
                                  <button
                                    type="button"
                                    className="restaurant-secondary-btn"
                                    onClick={() => setExpandedAssignOrderId('')}
                                  >
                                    Cancel
                                  </button>
                                  {!order.borzoTrackingUrl && (
                                    <button
                                      type="button"
                                      className="restaurant-primary-btn"
                                      disabled={dispatchingOrderId === order._id}
                                      onClick={() => createBorzoDispatch(order._id)}
                                    >
                                      {dispatchingOrderId === order._id ? 'Starting Borzo...' : 'Use Borzo Instead'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            ) : canAssignNow ? (
                              <div className="restaurant-inline-actions">
                                <button
                                  type="button"
                                  className="restaurant-primary-btn"
                                  disabled={assigningOrderId === order._id}
                                  onClick={() => setExpandedAssignOrderId(order._id)}
                                >
                                  Assign Agent
                                </button>
                                {!order.borzoTrackingUrl ? (
                                  <button
                                    type="button"
                                    className="restaurant-secondary-btn"
                                    disabled={dispatchingOrderId === order._id}
                                    onClick={() => createBorzoDispatch(order._id)}
                                  >
                                    {dispatchingOrderId === order._id ? 'Starting Borzo...' : 'Borzo Delivery'}
                                  </button>
                                ) : (
                                  <a
                                    href={order.borzoTrackingUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="restaurant-secondary-btn restaurant-secondary-link"
                                  >
                                    Track Borzo
                                  </a>
                                )}
                              </div>
                            ) : (
                              <div className="restaurant-order-stage-note">
                                <p>Waiting for delivery completion by assigned agent.</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </article>
              </div>
            </section>
          )}

          {activeTab === 'menu' && (
            <section className="restaurant-dashboard-section">
              <div className="restaurant-section-heading restaurant-section-heading-menu">
                <div>
                  <p className="restaurant-dashboard-eyebrow">Menu Control</p>
                  <h2>Publish and manage menu items</h2>
                </div>
                <button
                  type="button"
                  className="restaurant-primary-btn"
                  onClick={() => setShowAddMenu((value) => !value)}
                >
                  {showAddMenu ? 'Close Form' : 'Add Menu Item'}
                </button>
              </div>

              {showAddMenu && (
                <form className="restaurant-menu-form-card" onSubmit={addMenuItem}>
                  <div className="restaurant-menu-form-grid">
                    <label className="form-group">
                      <span>Item name</span>
                      <input
                        type="text"
                        placeholder="Paneer Butter Masala"
                        value={menuForm.name}
                        onChange={(e) => updateMenuField('name', e.target.value)}
                      />
                    </label>

                    <label className="form-group">
                      <span>Price</span>
                      <input
                        type="number"
                        placeholder="249"
                        value={menuForm.price}
                        onChange={(e) => updateMenuField('price', e.target.value)}
                      />
                    </label>

                    <label className="form-group">
                      <span>Category</span>
                      <select
                        value={menuForm.category}
                        onChange={(e) => updateMenuField('category', e.target.value)}
                      >
                        {CATEGORY_OPTIONS.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="form-group">
                      <span>Image URL</span>
                      <input
                        type="url"
                        placeholder="https://example.com/menu-item.jpg"
                        value={menuForm.imageUrl}
                        onChange={(e) => updateMenuField('imageUrl', e.target.value)}
                      />
                    </label>
                  </div>

                  <label className="form-group">
                    <span>Description</span>
                    <textarea
                      rows={4}
                      placeholder="Write a clear, appetizing description for customers."
                      value={menuForm.description}
                      onChange={(e) => updateMenuField('description', e.target.value)}
                    />
                  </label>

                  <label className="restaurant-checkbox-row">
                    <input
                      type="checkbox"
                      checked={menuForm.available}
                      onChange={(e) => updateMenuField('available', e.target.checked)}
                    />
                    <span>Make this item visible to customers immediately</span>
                  </label>

                  <div className="restaurant-menu-form-actions">
                    <button type="submit" className="restaurant-primary-btn" disabled={savingMenu}>
                      {savingMenu ? 'Saving item...' : 'Save Menu Item'}
                    </button>
                  </div>
                </form>
              )}

              {menuItems.length === 0 ? (
                <div className="restaurant-empty-state">
                  <h3>Your menu is empty</h3>
                  <p>Add your first dish to start building a complete storefront for customers.</p>
                </div>
              ) : (
                <div className="restaurant-menu-grid">
                  {menuItems.map((item) => (
                    <article key={item._id} className="restaurant-menu-card">
                      <div
                        className="restaurant-menu-image"
                        style={{
                          backgroundImage: `linear-gradient(180deg, rgba(12, 6, 1, 0.12), rgba(12, 6, 1, 0.58)), url(${item.imageUrl || getDefaultImage(item.name)})`,
                        }}
                      >
                        <span className={`restaurant-menu-availability ${item.available ? 'available' : 'hidden'}`}>
                          {item.available ? 'Live' : 'Hidden'}
                        </span>
                      </div>

                      <div className="restaurant-menu-content">
                        <div className="restaurant-menu-title-row">
                          <div>
                            <h3>{item.name}</h3>
                            <p>{item.category || 'Menu Item'}</p>
                          </div>
                          <strong>{formatCurrency(item.price)}</strong>
                        </div>

                        <p className="restaurant-menu-description">
                          {item.description || 'Add a thoughtful description so customers know what to expect.'}
                        </p>

                        <div className="restaurant-menu-actions">
                          <button
                            type="button"
                            className={`restaurant-secondary-btn ${item.available ? 'danger' : ''}`}
                            disabled={menuActionItemId === item._id}
                            onClick={() => toggleAvailability(item._id, !item.available)}
                          >
                            {item.available ? 'Hide Item' : 'Show Item'}
                          </button>
                          <button
                            type="button"
                            className="restaurant-secondary-btn"
                            disabled={menuActionItemId === item._id}
                            onClick={() => deleteMenuItem(item._id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </section>
      </main>
    </>
  );
}