'use client';
import { useEffect, useRef, useState } from 'react';
import { initToasts } from '@/components/Toast';
import { useAuth } from '@/hooks/useAuth';
import { escapeHTML, getDefaultImage } from '@/lib/utils';

type Tab = 'dashboard' | 'orders' | 'subscriptions' | 'menu' | 'tiffin' | 'restaurants' | 'customers' | 'users' | 'delivery';
interface Agent { _id: string; name: string; phone?: string; status: string; currentLoad: number; maxBatchLimit: number; userId: string; }
interface MenuItem { _id: string; name: string; price: number; description?: string; category: string; imageUrl?: string; available?: boolean; }
interface TiffinItem { _id: string; name: string; price: number; meta: string; emoji: string; available?: boolean; }
interface ManagedRestaurant {
  _id: string;
  name: string;
  ownerId: string;
  ownerName?: string;
  ownerContact?: string;
  ownerVerified?: boolean;
  ownerTrusted?: boolean;
  contact: string;
  address: string;
  description?: string;
  imageUrl?: string;
  isActive: boolean;
  isOpen: boolean;
  estimatedDeliveryTime?: number;
  menuCount: number;
  liveOrderCount: number;
  createdAt?: string;
}
interface Order { _id: string; status: string; customerName: string; contact?: string; address?: string; items: { name: string; quantity: number }[]; total: number; paymentMethod: string; timestamp: string; borzoStatus?: string; borzoTrackingUrl?: string; agentId?: string; inHouseDelivery?: boolean; deliveryOtp?: string; }
interface Subscription { _id: string; customerName: string; contact: string; address: string; plan: string; frequency: number; persons: number; price: number; status: string; startDate: string; }
interface Customer { _id: string; name: string; orderCount: number; totalSpent: number; lastOrderDate: string; }
interface User { _id: string; name: string; contact: string; role: string; isTrusted: boolean; isVerified: boolean; }

const ADMIN_TABS = (): { key: Tab; label: string; icon: string }[] => [
  ...TABS.slice(0, 5),
  { key: 'restaurants', label: 'Restaurants', icon: '🏪' },
  ...TABS.slice(5),
];

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'dashboard',     label: 'Dashboard',         icon: '📊' },
  { key: 'orders',        label: 'Live Orders',        icon: '📦' },
  { key: 'subscriptions', label: 'Subscriptions',      icon: '📅' },
  { key: 'menu',          label: 'Menu Management',    icon: '🍔' },
  { key: 'tiffin',        label: "Today's Tiffin",     icon: '🍱' },
  { key: 'customers',     label: 'Customers',          icon: '👥' },
  { key: 'users',         label: 'User Control',       icon: '🛡️' },
  { key: 'delivery',      label: 'Delivery',           icon: '🚚' },
];

const STATUS_COLORS: Record<string, string> = {
  Pending: '#f97316', Preparing: '#3b82f6', 'Out for Delivery': '#8b5cf6',
  Completed: '#22c55e', Rejected: '#ef4444', Cancelled: '#6b7280', Failed: '#dc2626',
};

function MenuModal({ item, onClose, onSave }: { item?: MenuItem | null; onClose: () => void; onSave: () => void }) {
  const isEdit = !!item;
  const [form, setForm] = useState({ name: item?.name || '', price: String(item?.price || ''), description: item?.description || '', category: item?.category || '🍲 Main Course', imageUrl: item?.imageUrl || '', available: item?.available !== false });
  const [preview, setPreview] = useState(item?.imageUrl || getDefaultImage(item?.name || ''));
  const [saving, setSaving] = useState(false);

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > 800) { h = h * 800 / w; w = 800; }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        const url = canvas.toDataURL('image/jpeg', 0.8);
        setForm(f => ({ ...f, imageUrl: url })); setPreview(url);
      };
      img.src = ev.target!.result as string;
    };
    reader.readAsDataURL(file);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    const token = localStorage.getItem('authToken');
    const url = isEdit ? `/api/menu/${item!._id}` : '/api/menu';
    const res = await fetch(url, { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ ...form, price: Number(form.price) }) });
    if (res.ok) { onSave(); onClose(); } else { const d = await res.json(); alert(d.message || 'Failed.'); }
    setSaving(false);
  }

  const cats = ["🌟 Today's Special","💰 Budget Meals","🍱 Value Combos","🍲 Main Course","🥖 Breads & Parathas","🍚 Rice & Biryani","🥗 Extras & Desserts"];
  const s = { width:'100%',padding:8,border:'1px solid var(--admin-border)',borderRadius:4,background:'var(--admin-bg)',color:'var(--admin-text-main)',boxSizing:'border-box' as const };

  return (
    <div id="custom-alert-page">
      <div className="custom-alert-box" style={{ textAlign:'left',maxWidth:520 }}>
        <h3 style={{ marginBottom:'1rem',textAlign:'center',color:'var(--admin-text-main)' }}>{isEdit?'Edit Menu Item':'Add New Item'}</h3>
        <form onSubmit={handleSave} style={{ display:'flex',flexDirection:'column',gap:'1rem' }}>
          <div><label style={{ fontWeight:'bold',display:'block',marginBottom:'0.3rem',color:'var(--admin-text-main)' }}>Name</label><input type="text" value={form.name} onChange={e=>{setForm(f=>({...f,name:e.target.value}));setPreview(getDefaultImage(e.target.value));}} required style={s}/></div>
          <div><label style={{ fontWeight:'bold',display:'block',marginBottom:'0.3rem',color:'var(--admin-text-main)' }}>Price (₹)</label><input type="number" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))} required style={s}/></div>
          <div><label style={{ fontWeight:'bold',display:'block',marginBottom:'0.3rem',color:'var(--admin-text-main)' }}>Description</label><textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} style={{...s,minHeight:60}}/></div>
          <div>
            <label style={{ fontWeight:'bold',display:'block',marginBottom:'0.3rem',color:'var(--admin-text-main)' }}>Image URL</label>
            <input type="text" value={form.imageUrl} onChange={e=>{setForm(f=>({...f,imageUrl:e.target.value}));setPreview(e.target.value||getDefaultImage(form.name));}} placeholder="Paste link..." style={{...s,marginBottom:6}}/>
            <div style={{ textAlign:'center',marginBottom:6,fontSize:'0.85rem',color:'var(--admin-text-muted)' }}>— OR upload image —</div>
            <input type="file" accept="image/*" onChange={handleImageUpload} style={s}/>
            <div style={{ textAlign:'center',marginTop:10 }}>
              {/* Plain img is intentional here because preview can be a local data URL or arbitrary admin-supplied URL. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Preview" style={{ maxWidth:'100%',height:120,borderRadius:8,objectFit:'cover',border:'1px solid var(--admin-border)' }} onError={e=>{(e.target as HTMLImageElement).src='https://via.placeholder.com/150?text=Error';}}/>
            </div>
          </div>
          <div><label style={{ fontWeight:'bold',display:'block',marginBottom:'0.3rem',color:'var(--admin-text-main)' }}>Category</label><select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} style={s}>{cats.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
          <label style={{ display:'flex',alignItems:'center',gap:8,cursor:'pointer',color:'var(--admin-text-main)' }}><input type="checkbox" checked={form.available} onChange={e=>setForm(f=>({...f,available:e.target.checked}))}/> Available (In Stock)</label>
          <div style={{ display:'flex',gap:'1rem',marginTop:'1rem' }}>
            <button type="submit" className="btn" style={{ flex:1 }} disabled={saving}>{saving?'Saving...':'Save'}</button>
            <button type="button" className="btn" style={{ flex:1,backgroundColor:'#95a5a6' }} onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TiffinModal({ item, onClose, onSave }: { item?: TiffinItem | null; onClose: () => void; onSave: () => void }) {
  const isEdit = !!item;
  const [form, setForm] = useState({ name:item?.name||'', price:String(item?.price||''), meta:item?.meta||'Lunch · Veg', emoji:item?.emoji||'🍛', available:item?.available!==false });
  const [saving, setSaving] = useState(false);
  const s = { width:'100%',padding:8,border:'1px solid var(--admin-border)',borderRadius:4,background:'var(--admin-bg)',color:'var(--admin-text-main)',boxSizing:'border-box' as const };

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    const token = localStorage.getItem('authToken');
    const url = isEdit ? `/api/admin/tiffin-menu/${item!._id}` : '/api/admin/tiffin-menu';
    const res = await fetch(url, { method:isEdit?'PUT':'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`}, body:JSON.stringify({...form,price:Number(form.price)}) });
    if (res.ok) { onSave(); onClose(); } else alert('Failed to save.');
    setSaving(false);
  }

  return (
    <div id="custom-alert-page">
      <div className="custom-alert-box" style={{ textAlign:'left' }}>
        <h3 style={{ marginBottom:'1rem',textAlign:'center',color:'var(--admin-text-main)' }}>{isEdit?'Edit Tiffin Item':'Add Tiffin Item'}</h3>
        <form onSubmit={handleSave} style={{ display:'flex',flexDirection:'column',gap:'1rem' }}>
          {[['Emoji','emoji'],['Name','name'],['Meta (e.g. Lunch · Veg)','meta'],['Price (₹)','price']].map(([label,key])=>(
            <div key={key}><label style={{ fontWeight:'bold',display:'block',marginBottom:'0.3rem',color:'var(--admin-text-main)' }}>{label}</label><input type={key==='price'?'number':'text'} value={(form as any)[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} required style={s}/></div>
          ))}
          <label style={{ display:'flex',alignItems:'center',gap:8,cursor:'pointer',color:'var(--admin-text-main)' }}><input type="checkbox" checked={form.available} onChange={e=>setForm(f=>({...f,available:e.target.checked}))}/> Available</label>
          <div style={{ display:'flex',gap:'1rem',marginTop:'1rem' }}>
            <button type="submit" className="btn" style={{ flex:1 }} disabled={saving}>{saving?'Saving...':'Save'}</button>
            <button type="button" className="btn" style={{ flex:1,backgroundColor:'#95a5a6' }} onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CustomerHistoryModal({ contact, name, token, onClose }: { contact:string; name:string; token:string; onClose:()=>void }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`/api/orders?contact=${encodeURIComponent(contact)}&status=all`,{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json()).then(d=>{setOrders(Array.isArray(d)?d:[]);setLoading(false);});
  },[contact,token]);
  return (
    <div id="custom-alert-page">
      <div className="custom-alert-box" style={{ textAlign:'left',maxWidth:600 }}>
        <h3 style={{ marginBottom:'0.5rem',color:'var(--admin-text-main)' }}>Order History: {name}</h3>
        <p style={{ marginBottom:'1rem',color:'var(--admin-text-muted)',fontSize:'0.9rem' }}>Contact: {contact}</p>
        <div style={{ maxHeight:'50vh',overflowY:'auto',paddingRight:10 }}>
          {loading?<p>Loading...</p>:orders.length===0?<p>No orders found.</p>:orders.map(o=>(
            <div key={o._id} style={{ border:'1px solid var(--admin-border)',padding:'1rem',borderRadius:8,marginBottom:'1rem',background:'var(--admin-bg)' }}>
              <div style={{ display:'flex',justifyContent:'space-between',marginBottom:5 }}>
                <strong>Order #{String(o._id).slice(-5)}</strong>
                <span className={`status ${o.status.toLowerCase().replace(/ /g,'-')}`}>{o.status}</span>
              </div>
              <p style={{ fontSize:'0.9rem',marginBottom:5 }}>{new Date(o.timestamp).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}</p>
              <p style={{ fontSize:'0.9rem',color:'var(--admin-text-muted)',marginBottom:5 }}>{o.items.map(i=>`${i.quantity||1}x ${i.name}`).join(', ')}</p>
              <p style={{ fontWeight:'bold',textAlign:'right' }}>Total: ₹{o.total}</p>
            </div>
          ))}
        </div>
        <button className="btn" style={{ width:'100%',marginTop:'1rem' }} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { user, token, loading } = useAuth(true, true);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [tiffinItems, setTiffinItems] = useState<TiffinItem[]>([]);
  const [allRestaurants, setAllRestaurants] = useState<ManagedRestaurant[]>([]);
  const [filteredRestaurants, setFilteredRestaurants] = useState<ManagedRestaurant[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [orderFilter, setOrderFilter] = useState('All');
  const [subFilter, setSubFilter] = useState('All');
  const [menuModal, setMenuModal] = useState<{open:boolean;item?:MenuItem|null}>({open:false});
  const [tiffinModal, setTiffinModal] = useState<{open:boolean;item?:TiffinItem|null}>({open:false});
  const [customerHistory, setCustomerHistory] = useState<{contact:string;name:string}|null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [deliveryOrders, setDeliveryOrders] = useState<Order[]>([]);
  const [newAgentForm, setNewAgentForm] = useState({open:false,name:'',contact:'',password:''});
  const [assigningOrder, setAssigningOrder] = useState<string|null>(null);
  const [assignResult, setAssignResult] = useState<{orderId:string;otp:string}|null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [darkMode, setDarkMode] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('adminSound') !== 'false';
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevPendingRef = useRef(0);
  const audioUnlockedRef = useRef(false);
  const isPlayingRef = useRef(false);
  const [onlinePaymentEnabled, setOnlinePaymentEnabled] = useState(false);
  const [paymentToggleLoading, setPaymentToggleLoading] = useState(false);
  const [firstTiffinEnabled, setFirstTiffinEnabled]     = useState(true);
  const [firstTiffinToggleLoading, setFirstTiffinToggleLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('adminTheme');
    if (saved === 'dark') { setDarkMode(true); document.documentElement.setAttribute('data-theme', 'dark'); }
    initToasts(); // initialise toast system for admin page
  }, []);

  // ── Notification sound setup ──

  useEffect(() => {
    audioRef.current = new Audio('/sound/order_alert.mp3');
    audioRef.current.volume = 0.7;
    // Unlock audio on first user interaction (browser requirement)
    const unlock = () => { audioUnlockedRef.current = true; };
    document.addEventListener('click', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
    document.addEventListener('touchstart', unlock, { once: true });
    return () => {
      document.removeEventListener('click', unlock);
      document.removeEventListener('keydown', unlock);
      document.removeEventListener('touchstart', unlock);
    };
  }, []);

  useEffect(() => {
    // Load from localStorage first for instant UI (no flicker)
    const cached = localStorage.getItem('onlinePaymentEnabled');
    if (cached !== null) setOnlinePaymentEnabled(cached === 'true');

    // Then verify from DB (source of truth)
    const authToken = localStorage.getItem('authToken');
    fetch('/api/admin/settings?key=onlinePaymentEnabled', {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then(r => r.json())
      .then(d => {
        // d.value is null if never set, or true/false
        const enabled = d.value === true || d.value === 'true';
        setOnlinePaymentEnabled(enabled);
        localStorage.setItem('onlinePaymentEnabled', String(enabled));
      })
      .catch(() => {
        // Fallback to public endpoint
        fetch('/api/config/payment-settings')
          .then(r => r.json())
          .then(d => setOnlinePaymentEnabled(!!d.onlinePaymentEnabled))
          .catch(() => {});
      });

    // Load firstTiffinEnabled from DB (defaults to true if never set)
    fetch('/api/admin/settings?key=firstTiffinEnabled', {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then(r => r.json())
      .then(d => {
        // null means never set → treat as enabled (true)
        const enabled = d.value === null ? true : d.value === true || d.value === 'true';
        setFirstTiffinEnabled(enabled);
      })
      .catch(() => {});
  }, []);

  async function toggleOnlinePayment() {
    setPaymentToggleLoading(true);
    const newVal = !onlinePaymentEnabled;
    try {
      const authToken = localStorage.getItem('authToken');
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ key: 'onlinePaymentEnabled', value: newVal }),
      });
      const data = await res.json();
      if (data.success) {
        setOnlinePaymentEnabled(newVal);
        localStorage.setItem('onlinePaymentEnabled', String(newVal));
        window.showSystemToast?.(
          newVal ? 'Online Payments Enabled' : 'COD Only Mode',
          newVal ? 'Customers can now pay via Stripe or Cash on Delivery.' : 'Online payment button is now hidden from customers.',
          newVal ? 'success' : 'info'
        );
      } else {
        console.error('Toggle failed:', data);
        window.showSystemToast?.('Failed to update', data.error || 'Unknown error', 'error');
      }
    } catch (err) {
      console.error('Toggle error:', err);
      window.showSystemToast?.('Network error', 'Could not reach server. Try again.', 'error');
    }
    setPaymentToggleLoading(false);
  }

  async function toggleFirstTiffin() {
    setFirstTiffinToggleLoading(true);
    const newVal = !firstTiffinEnabled;
    try {
      const authToken = localStorage.getItem('authToken');
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ key: 'firstTiffinEnabled', value: newVal }),
      });
      const data = await res.json();
      if (data.success) {
        setFirstTiffinEnabled(newVal);
        window.showSystemToast?.(
          newVal ? 'First Tiffin FREE Enabled' : 'First Tiffin FREE Disabled',
          newVal ? 'New customers will see the free tiffin offer at checkout.' : 'The free tiffin offer is now hidden from all customers.',
          newVal ? 'success' : 'info'
        );
      } else {
        window.showSystemToast?.('Failed to update', data.error || 'Unknown error', 'error');
      }
    } catch {
      window.showSystemToast?.('Network error', 'Could not reach server. Try again.', 'error');
    }
    setFirstTiffinToggleLoading(false);
  }

  function toggleTheme() {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : '');
    localStorage.setItem('adminTheme', next ? 'dark' : 'light');
  }

  async function api(path: string, options?: RequestInit) {
    const res = await fetch(path,{...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(options?.headers||{})}});
    return res.json();
  }

  async function loadTab(tab: Tab) {
    if (!token) return;
    if (tab==='dashboard') { const d=await api('/api/admin/dashboard-stats'); if(d.success) { setStats(d); setPendingCount(d.pendingCount||0); } }
    else if (tab==='orders') { const url=orderFilter==='All'?'/api/orders?status=all':`/api/orders?status=${encodeURIComponent(orderFilter)}`; const d=await api(url); setOrders(Array.isArray(d)?d:[]); }
    else if (tab==='subscriptions') { const d=await api(subFilter==='All'?'/api/admin/subscriptions':`/api/admin/subscriptions?status=${subFilter}`); if(d.success) setSubscriptions(d.subscriptions); }
    else if (tab==='menu') { const d=await api('/api/admin/menu'); setMenuItems(Array.isArray(d)?d:[]); }
    else if (tab==='tiffin') { const d=await api('/api/tiffin-menu'); setTiffinItems(Array.isArray(d)?d:[]); }
    else if (tab==='restaurants') { const d=await api('/api/admin/restaurants'); const list=Array.isArray(d)?d:[]; setAllRestaurants(list); setFilteredRestaurants(list); }
    else if (tab==='customers') { const d=await api('/api/admin/customers'); if(d.success){setAllCustomers(d.customers);setFilteredCustomers(d.customers);} }
    else if (tab==='users') { const d=await api('/api/admin/users'); const list=Array.isArray(d)?d:[]; setAllUsers(list); setFilteredUsers(list); }
    else if (tab==='delivery') {
      const [da, dord] = await Promise.all([api('/api/admin/agents'), api('/api/orders?status=Preparing')]);
      if (da.success) setAgents(da.agents);
      setDeliveryOrders(Array.isArray(dord) ? dord : []);
    }
  }

  useEffect(() => {
    if (!token) return;
    const poll = async () => {
      const d = await api('/api/admin/pending-count');
      if (d.success) {
        const newCount = d.count || 0;
        // Play sound if new orders arrived
        if (newCount > prevPendingRef.current && audioUnlockedRef.current && soundEnabled && audioRef.current && !isPlayingRef.current) {
          isPlayingRef.current = true;
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {});
          audioRef.current.onended = () => { isPlayingRef.current = false; };
        }
        prevPendingRef.current = newCount;
        setPendingCount(newCount);
        // Update browser tab title
        document.title = newCount > 0 ? `(${newCount}) New Orders — Admin` : 'Admin — Kajal Ki Rasoi';
      }
    };
    poll();
    const iv = setInterval(poll, 20000);
    return () => { clearInterval(iv); document.title = 'Admin — Kajal Ki Rasoi'; };
  }, [token, soundEnabled]); // eslint-disable-line

  useEffect(() => { if (token && user?.role==='admin') loadTab(activeTab); }, [activeTab, token, orderFilter, subFilter]); // eslint-disable-line

  async function updateOrderStatus(id:string, status:string) { await api(`/api/orders/${id}/status`,{method:'PUT',body:JSON.stringify({status})}); loadTab('orders'); }
  async function deleteOrder(id:string) { if(!confirm('Archive this order?')) return; await api(`/api/orders/${id}`,{method:'DELETE'}); loadTab('orders'); }
  async function updateSubStatus(id:string, status:string) { await api(`/api/admin/subscriptions/${id}/status`,{method:'PUT',body:JSON.stringify({status})}); loadTab('subscriptions'); }
  async function deleteMenuItem(id:string) { if(!confirm('Delete this menu item?')) return; await api(`/api/menu/${id}`,{method:'DELETE'}); loadTab('menu'); }
  async function toggleAvailability(id:string, current:boolean) { await api(`/api/menu/${id}`,{method:'PUT',body:JSON.stringify({available:!current})}); loadTab('menu'); }
  async function deleteTiffin(id:string) { if(!confirm('Delete this tiffin item?')) return; await api(`/api/admin/tiffin-menu/${id}`,{method:'DELETE'}); loadTab('tiffin'); }
  async function updateRestaurant(id:string, body:object) {
    const res = await api(`/api/admin/restaurants/${id}`, { method:'PATCH', body: JSON.stringify(body) });
    window.showSystemToast?.(
      res.success ? 'Restaurant Updated' : 'Update Failed',
      res.success ? 'Restaurant settings saved.' : (res.message || 'Unable to update restaurant.'),
      res.success ? 'success' : 'error'
    );
    if (res.success) loadTab('restaurants');
  }
  async function promptEtaUpdate(restaurant: ManagedRestaurant) {
    const value = prompt(`Estimated delivery time for ${restaurant.name} (minutes)`, String(restaurant.estimatedDeliveryTime || 30));
    if (value === null) return;
    await updateRestaurant(restaurant._id, { estimatedDeliveryTime: Number(value) });
  }
  async function userAction(id:string, endpoint:string, body:object) {
    const method = endpoint.endsWith(id) && Object.keys(body).length===0 ? 'DELETE' : 'PUT';
    const url = method==='DELETE' ? `/api/admin/users/${id}` : endpoint;
    const res = await api(url, {method, body: method==='DELETE' ? undefined : JSON.stringify(body)});
    alert(res.message || 'Done.'); loadTab('users');
  }

  function switchTab(tab: Tab) { setActiveTab(tab); setSidebarOpen(false); }

  if (loading) return <div style={{padding:'4rem',textAlign:'center'}}>Loading...</div>;
  if (!user || user.role!=='admin') return null;

  const todayLabel = new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  const btnStyle = (bg:string,color='#fff') => ({padding:'6px 10px',fontSize:11,background:bg,color,border:'none',borderRadius:4,cursor:'pointer'} as const);
  const thStyle = {padding:'0.75rem 1rem',textAlign:'left' as const,whiteSpace:'nowrap' as const};
  const tdStyle = {padding:'0.75rem 1rem'};

  return (
    <>
      {menuModal.open && <MenuModal item={menuModal.item} onClose={()=>setMenuModal({open:false})} onSave={()=>loadTab('menu')}/>}
      {tiffinModal.open && <TiffinModal item={tiffinModal.item} onClose={()=>setTiffinModal({open:false})} onSave={()=>loadTab('tiffin')}/>}
      {customerHistory && token && <CustomerHistoryModal contact={customerHistory.contact} name={customerHistory.name} token={token} onClose={()=>setCustomerHistory(null)}/>}

      <div className="admin-wrapper">

        {/* ── Mobile header (hamburger) ── */}
        <div className="admin-mobile-header">
          <button onClick={()=>setSidebarOpen(o=>!o)} style={{background:'none',border:'none',color:'#fff',fontSize:'1.6rem',cursor:'pointer',lineHeight:1,padding:0}}>☰</button>
          <span style={{color:'#fff',fontWeight:700,fontSize:'1rem',flex:1}}>Kajal Ki Rasoi — Admin</span>
          {pendingCount>0&&<span className="sidebar-badge">{pendingCount}</span>}
        </div>

        {/* ── Overlay when sidebar open on mobile ── */}
        {sidebarOpen && (
          <div onClick={()=>setSidebarOpen(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:998}}/>
        )}

        {/* ── Sidebar ── */}
        <aside className={`admin-sidebar${sidebarOpen?' open':''}`}>
          <div className="sidebar-logo">Kajal Ki Rasoi<br/><span>Admin Portal</span></div>
          <ul className="sidebar-nav">
            {ADMIN_TABS().map(t => (
              <li key={t.key}>
                <a href="#" className={activeTab===t.key?'active':''} onClick={e=>{e.preventDefault();switchTab(t.key);}} style={{display:'flex',alignItems:'center',gap:10}}>
                  <span style={{fontSize:17,lineHeight:1,flexShrink:0}}>{t.icon}</span>
                  <span style={{flex:1}}>{t.label}</span>
                  {t.key==='orders' && pendingCount>0 && <span className="sidebar-badge" style={{marginLeft:4,borderRadius:10,minWidth:20,textAlign:'center'}}>{pendingCount}</span>}
                </a>
              </li>
            ))}
          </ul>
          <div className="sidebar-footer">
            <button className="theme-toggle" onClick={toggleTheme}>{darkMode?'☀️ Light Mode':'🌙 Toggle Theme'}</button>
            <button className="theme-toggle" style={{marginTop:6}} onClick={()=>setSoundEnabled(s=>{const next=!s;localStorage.setItem('adminSound',String(next));return next;})}>{soundEnabled?'🔔 Sound On':'🔕 Sound Off'}</button>
            <a href="/" className="back-link">⬅ Back to Site</a>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="admin-main">

          {/* DASHBOARD */}
          {activeTab==='dashboard' && (
            <div className="admin-tab-content active">
              <h2 style={{marginBottom:4}}>Dashboard Overview</h2>
              <p style={{margin:'0 0 1.5rem',fontSize:13,color:'var(--admin-text-muted)'}}>{todayLabel}</p>

              {pendingCount>0&&(
                <div style={{background:'#7f1d1d',border:'1px solid #ef4444',borderRadius:10,padding:'12px 18px',marginBottom:'1.5rem',display:'flex',alignItems:'center',gap:10,cursor:'pointer'}} onClick={()=>switchTab('orders')}>
                  <span style={{fontSize:18}}>⚠️</span>
                  <span style={{color:'#fca5a5',fontWeight:600,fontSize:14}}>{pendingCount} pending order{pendingCount>1?'s':''} waiting for acceptance</span>
                </div>
              )}

              {/* ── Payment Method Control ── */}
              <div style={{
                background: onlinePaymentEnabled ? 'var(--admin-sidebar)' : '#1c1917',
                border: `1.5px solid ${onlinePaymentEnabled ? '#22c55e' : '#f97316'}`,
                borderRadius: 12, padding: '16px 20px', marginBottom: '1.5rem',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 28 }}>{onlinePaymentEnabled ? '💳' : '💵'}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--admin-text-main)' }}>
                      Payment Mode: <span style={{ color: onlinePaymentEnabled ? '#22c55e' : '#f97316' }}>
                        {onlinePaymentEnabled ? 'Online + COD Enabled' : 'COD Only (Online Disabled)'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--admin-text-muted)', marginTop: 3 }}>
                      {onlinePaymentEnabled
                        ? 'Customers can pay via Stripe or Cash on Delivery'
                        : 'Customers can only pay via Cash on Delivery — online button is hidden'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={toggleOnlinePayment}
                  disabled={paymentToggleLoading}
                  style={{
                    padding: '10px 22px', borderRadius: 8, border: 'none', cursor: paymentToggleLoading ? 'not-allowed' : 'pointer',
                    fontWeight: 700, fontSize: 14, flexShrink: 0,
                    background: onlinePaymentEnabled ? '#ef4444' : '#22c55e',
                    color: 'white', opacity: paymentToggleLoading ? 0.6 : 1,
                    transition: 'all 0.2s',
                  }}
                >
                  {paymentToggleLoading ? '⏳ Saving…' : onlinePaymentEnabled ? '🔴 Disable Online Pay' : '🟢 Enable Online Pay'}
                </button>
              </div>

              {/* ── First Tiffin FREE Offer Control ── */}
              <div style={{
                background: firstTiffinEnabled ? 'var(--admin-sidebar)' : '#1c1917',
                border: `1.5px solid ${firstTiffinEnabled ? '#f97316' : '#52525b'}`,
                borderRadius: 12, padding: '16px 20px', marginBottom: '1.5rem',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 28 }}>{firstTiffinEnabled ? '🎁' : '🚫'}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--admin-text-main)' }}>
                      First Tiffin FREE Offer:{' '}
                      <span style={{ color: firstTiffinEnabled ? '#f97316' : '#71717a' }}>
                        {firstTiffinEnabled ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--admin-text-muted)', marginTop: 3 }}>
                      {firstTiffinEnabled
                        ? 'New customers get their first tiffin free at checkout'
                        : 'Offer is hidden — all customers pay full price'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={toggleFirstTiffin}
                  disabled={firstTiffinToggleLoading}
                  style={{
                    padding: '10px 22px', borderRadius: 8, border: 'none',
                    cursor: firstTiffinToggleLoading ? 'not-allowed' : 'pointer',
                    fontWeight: 700, fontSize: 14, flexShrink: 0,
                    background: firstTiffinEnabled ? '#ef4444' : '#f97316',
                    color: 'white', opacity: firstTiffinToggleLoading ? 0.6 : 1,
                    transition: 'all 0.2s',
                  }}
                >
                  {firstTiffinToggleLoading ? '⏳ Saving…' : firstTiffinEnabled ? '🔴 Disable Offer' : '🟢 Enable Offer'}
                </button>
              </div>

              {!stats?<p>Loading stats...</p>:<>
                {/* Mini stat cards */}
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12,marginBottom:'1.5rem'}}>
                  {[
                    ["TODAY'S REVENUE",`₹${stats.revenue?.today?.toLocaleString('en-IN')||0}`,'From completed orders'],
                    ["TOTAL ORDERS",stats.meaningfulTotal||0,`${pendingCount} pending now`],
                    ["THIS WEEK",`₹${stats.revenue?.week?.toLocaleString('en-IN')||0}`,'Mon–today'],
                    ["THIS MONTH",`₹${stats.revenue?.month?.toLocaleString('en-IN')||0}`,'Current month'],
                    ["RESTAURANTS",stats.restaurantStats?.total||0,`${stats.restaurantStats?.active||0} active`],
                    ["OPEN NOW",stats.restaurantStats?.open||0,`${stats.restaurantStats?.withLiveOrders||0} with live orders`],
                  ].map(([label,value,sub])=>(
                    <div key={String(label)} style={{background:'var(--admin-sidebar)',borderRadius:12,border:'0.5px solid var(--admin-border)',padding:'16px 18px'}}>
                      <div style={{fontSize:10,color:'#6b7280',textTransform:'uppercase' as const,letterSpacing:0.5,marginBottom:4}}>{label}</div>
                      <div style={{fontSize:22,color:'var(--admin-sidebar-text)',fontWeight:600,margin:'4px 0 4px'}}>{value}</div>
                      <div style={{fontSize:11,color:'#6b7280'}}>{sub}</div>
                    </div>
                  ))}
                </div>

                {/* Stat cards — responsive grid */}
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:'1rem'}}>
                  <div className="stat-card">
                    <h3>Revenue (Completed)</h3>
                    <div style={{fontSize:32,fontWeight:700,color:'var(--admin-text-main)',margin:'8px 0 4px'}}>₹{stats.revenue?.today?.toLocaleString('en-IN')||0}</div>
                    <div style={{fontSize:12,color:'var(--admin-text-muted)',marginBottom:16}}>Today</div>
                    <div style={{borderTop:'1px solid var(--admin-border)',paddingTop:12,display:'flex',flexDirection:'column' as const,gap:6}}>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:14}}><span style={{color:'var(--admin-text-muted)'}}>This Week:</span><strong>₹{stats.revenue?.week?.toLocaleString('en-IN')||0}</strong></div>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:14}}><span style={{color:'var(--admin-text-muted)'}}>This Month:</span><strong>₹{stats.revenue?.month?.toLocaleString('en-IN')||0}</strong></div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <h3>Orders Status</h3>
                    <div style={{fontSize:32,fontWeight:700,color:'var(--admin-text-main)',margin:'8px 0 4px'}}>{stats.orderCounts?.reduce((s:number,o:any)=>s+o.count,0)||0}</div>
                    <div style={{fontSize:12,color:'var(--admin-text-muted)',marginBottom:16}}>All orders · {stats.meaningfulTotal||0} active</div>
                    <div style={{display:'flex',flexDirection:'column' as const,gap:8}}>
                      {['Pending','Preparing','Out for Delivery','Completed','Rejected','Cancelled','Failed'].map(st=>{
                        const count=stats.orderCounts?.find((o:any)=>o._id===st)?.count||0;
                        return(
                          <div key={st} style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:14}}>
                            <div style={{display:'flex',alignItems:'center',gap:8}}>
                              <span style={{width:8,height:8,borderRadius:'50%',background:STATUS_COLORS[st]||'#6b7280',display:'inline-block',flexShrink:0}}/>
                              <span style={{color:'var(--admin-text-muted)'}}>{st}:</span>
                            </div>
                            <strong style={{color:'var(--admin-text-main)'}}>{count}</strong>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="stat-card">
                    <h3>Restaurant Network</h3>
                    <div style={{fontSize:32,fontWeight:700,color:'var(--admin-text-main)',margin:'8px 0 4px'}}>{stats.restaurantStats?.total||0}</div>
                    <div style={{fontSize:12,color:'var(--admin-text-muted)',marginBottom:16}}>Total restaurants onboarded</div>
                    <div style={{borderTop:'1px solid var(--admin-border)',paddingTop:12,display:'flex',flexDirection:'column' as const,gap:8}}>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:14}}><span style={{color:'var(--admin-text-muted)'}}>Active:</span><strong>{stats.restaurantStats?.active||0}</strong></div>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:14}}><span style={{color:'var(--admin-text-muted)'}}>Open right now:</span><strong>{stats.restaurantStats?.open||0}</strong></div>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:14}}><span style={{color:'var(--admin-text-muted)'}}>With menu:</span><strong>{stats.restaurantStats?.withMenu||0}</strong></div>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:14}}><span style={{color:'var(--admin-text-muted)'}}>With live orders:</span><strong>{stats.restaurantStats?.withLiveOrders||0}</strong></div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <h3>Top Selling Items</h3>
                    <div style={{marginTop:12,display:'flex',flexDirection:'column' as const,gap:14}}>
                      {(stats.topItems||[]).map((item:any)=>(
                        <div key={item._id}>
                          <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                            <span style={{fontSize:14,color:'var(--admin-text-main)',fontWeight:500}}>{escapeHTML(item._id)}</span>
                            <strong style={{fontSize:13,color:'var(--admin-text-muted)'}}>{item.count} sold</strong>
                          </div>
                          <div style={{height:5,background:'var(--admin-border)',borderRadius:3}}>
                            <div style={{background:'#f97316',width:`${Math.min(100,(item.count/(stats.topItems[0]?.count||1))*100)}%`,height:'100%',borderRadius:3}}/>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="stat-card">
                    <h3>Top Restaurants (Revenue)</h3>
                    {(stats.topRestaurants||[]).length===0 ? (
                      <p style={{marginTop:12,fontSize:14,color:'var(--admin-text-muted)'}}>No restaurant revenue data yet.</p>
                    ) : (
                      <div style={{marginTop:12,display:'flex',flexDirection:'column' as const,gap:14}}>
                        {(stats.topRestaurants||[]).map((restaurant:any)=>(
                          <div key={String(restaurant.restaurantId||restaurant.name)}>
                            <div style={{display:'flex',justifyContent:'space-between',marginBottom:5,gap:8}}>
                              <span style={{fontSize:14,color:'var(--admin-text-main)',fontWeight:500}}>
                                {escapeHTML(restaurant.name)}
                              </span>
                              <strong style={{fontSize:13,color:'var(--admin-text-muted)'}}>
                                ₹{Number(restaurant.revenue||0).toLocaleString('en-IN')}
                              </strong>
                            </div>
                            <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'var(--admin-text-muted)',marginBottom:6}}>
                              <span>{restaurant.completedOrders||0} completed orders</span>
                              <span>{restaurant.isOpen ? 'Open' : 'Closed'}</span>
                            </div>
                            <div style={{height:5,background:'var(--admin-border)',borderRadius:3}}>
                              <div style={{background:'#3b82f6',width:`${Math.min(100,((restaurant.revenue||0)/((stats.topRestaurants?.[0]?.revenue)||1))*100)}%`,height:'100%',borderRadius:3}}/>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>}
            </div>
          )}

          {/* ORDERS */}
          {activeTab==='orders' && (
            <div className="admin-tab-content active">
              <h2>Live Order Feed</h2>
              <div className="admin-pill-filters" style={{marginBottom:'1rem'}}>
                {['All','Pending','Preparing','Out for Delivery','Completed','Rejected','Cancelled'].map(f=>(
                  <button key={f} className={`filter-pill ${f===orderFilter?'active':''}`} onClick={()=>setOrderFilter(f)}>{f}</button>
                ))}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:14,padding:'0 0 1rem'}}>
                {orders.length===0?<p className="empty-cart">No orders found.</p>:orders.map(order=>(
                  <div key={order._id} className={`order-card status-${order.status.toLowerCase().replace(/ /g,'-')}`}>
                    <div className="order-header">
                      <h3 style={{margin:0,color:'var(--admin-text-main)'}}>Order #{String(order._id).slice(-5)}</h3>
                      <div><span className={`status ${order.status.toLowerCase().replace(/ /g,'-')}`}>{order.status}</span>{order.borzoStatus&&<span style={{background:'#3b82f6',color:'#fff',padding:'2px 8px',borderRadius:10,fontSize:'0.75rem',marginLeft:8}}>Borzo: {order.borzoStatus}</span>}</div>
                    </div>
                    <div style={{marginBottom:12,fontSize:'0.95rem',color:'var(--admin-text-main)'}}>
                      <p style={{margin:'0 0 4px'}}><strong>Customer:</strong> {escapeHTML(order.customerName)}</p>
                      <p style={{margin:'0 0 4px'}}><strong>Contact:</strong> <a href={`tel:${order.contact}`} style={{color:'#e67e22',textDecoration:'none'}}>{escapeHTML(order.contact||'N/A')}</a></p>
                      <p style={{margin:'0 0 4px'}}><strong>Payment:</strong> {order.paymentMethod}</p>
                      <p style={{margin:'0 0 4px'}}><strong>Address:</strong> {escapeHTML(order.address||'N/A')} <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address||'')}`} target="_blank" rel="noreferrer" style={{color:'#3498db'}}>📍 Navigate</a></p>
                    </div>
                    <ul style={{background:'#f9fafb',borderRadius:8,padding:'8px 10px',listStyle:'none',margin:'1rem 0'}}>
                      {order.items.map((i,idx)=><li key={idx} style={{fontSize:'0.95rem',color:'#374151',marginBottom:4}}>• {i.quantity||1}x {escapeHTML(i.name)}</li>)}
                    </ul>
                    <div style={{borderTop:'0.5px solid #f3f4f6',display:'flex',justifyContent:'space-between',alignItems:'center',paddingTop:'1rem',marginTop:'1rem',flexWrap:'wrap',gap:8}}>
                      <div><strong style={{fontSize:'1.1rem'}}>Total: ₹{order.total}</strong><br/><span style={{fontSize:'0.85rem',color:'#6b7280'}}>{new Date(order.timestamp).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}</span></div>
                      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                        {order.status==='Pending'&&<><button className="btn-order" style={btnStyle('#f97316')} onClick={()=>updateOrderStatus(order._id,'Preparing')}>Accept</button><button className="btn-order" style={{padding:'6px 16px',background:'transparent',color:'#dc2626',border:'1px solid #dc2626',borderRadius:6,cursor:'pointer',fontSize:11}} onClick={()=>updateOrderStatus(order._id,'Rejected')}>Reject</button></>}
                        {order.status==='Preparing'&&<button className="btn-order" style={btnStyle('#3b82f6')} onClick={()=>updateOrderStatus(order._id,'Out for Delivery')}>Dispatch</button>}
                        {order.status==='Out for Delivery'&&<button className="btn-order" style={btnStyle('#22c55e')} onClick={()=>updateOrderStatus(order._id,'Completed')}>Mark Delivered</button>}
                        {['Completed','Rejected','Cancelled'].includes(order.status)&&<button className="btn-order" style={btnStyle('#6b7280')} onClick={()=>deleteOrder(order._id)}>Archive</button>}
                        {order.borzoTrackingUrl&&<a href={order.borzoTrackingUrl} target="_blank" rel="noreferrer" className="btn-order" style={{...btnStyle('#3b82f6'),textDecoration:'none'}}>Track Borzo</a>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SUBSCRIPTIONS */}
          {activeTab==='subscriptions' && (
            <div className="admin-tab-content active">
              <h2>Manage Subscriptions</h2>
              <div className="admin-pill-filters" style={{marginBottom:'1rem'}}>
                {['All','Pending','Active','Cancelled'].map(f=><button key={f} className={`filter-pill ${f===subFilter?'active':''}`} onClick={()=>setSubFilter(f)}>{f}</button>)}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:14}}>
                {subscriptions.length===0?<p className="empty-cart">No subscriptions found.</p>:subscriptions.map(sub=>{
                  const freqText=sub.frequency===7&&sub.plan.includes('Trial')?'7-Day Trial':`${sub.frequency} Days/Week`;
                  return(
                    <div key={sub._id} className="order-card" style={{borderTop:`3px solid ${sub.status==='Active'?'#22c55e':sub.status==='Pending'?'#f97316':'#dc2626'}`}}>
                      <div className="order-header"><h3 style={{margin:0}}>{escapeHTML(sub.customerName)}</h3><span className={`status ${sub.status.toLowerCase()}`}>{sub.status}</span></div>
                      <p><strong>Plan:</strong> {escapeHTML(sub.plan)} · {freqText} · {sub.persons} Person(s)</p>
                      <p><strong>Contact:</strong> <a href={`tel:${sub.contact}`} style={{color:'#e67e22',textDecoration:'none'}}>{escapeHTML(sub.contact)}</a></p>
                      <p><strong>Address:</strong> {escapeHTML(sub.address)}</p>
                      <p><strong>Start Date:</strong> {new Date(sub.startDate).toLocaleDateString('en-IN',{dateStyle:'medium'})}</p>
                      <p><strong>Price:</strong> ₹{sub.price}</p>
                      <div style={{display:'flex',gap:8,marginTop:'1rem',flexWrap:'wrap'}}>
                        {sub.status==='Pending'&&<button className="btn-order" style={btnStyle('#052e16','#4ade80')} onClick={()=>updateSubStatus(sub._id,'Active')}>Activate</button>}
                        {sub.status!=='Cancelled'&&<button className="btn-order" style={btnStyle('#3b0a0a','#f87171')} onClick={()=>updateSubStatus(sub._id,'Cancelled')}>Cancel</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* MENU */}
          {activeTab==='menu' && (
            <div className="admin-tab-content active">
              <h2>Menu Management</h2>
              <button className="btn" style={{marginBottom:'1rem'}} onClick={()=>setMenuModal({open:true,item:null})}>+ Add New Menu Item</button>
              {menuItems.length===0?<p className="empty-cart">No menu items found.</p>:(
                <div style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',background:'var(--admin-card-bg)',borderRadius:5,overflow:'hidden',minWidth:640}}>
                    <thead><tr style={{background:'var(--admin-sidebar)',color:'var(--admin-sidebar-text)',textAlign:'left'}}>{['Image','Name','Price','Category','Status','Actions'].map(h=><th key={h} style={thStyle}>{h}</th>)}</tr></thead>
                    <tbody>{menuItems.map(item=>(
                      <tr key={item._id} style={{borderBottom:'1px solid var(--admin-border)'}}>
                        <td style={tdStyle}>
                          {/* Plain img is intentional because menu items may reference arbitrary remote URLs outside Next image config. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={item.imageUrl?.trim()?escapeHTML(item.imageUrl):getDefaultImage(item.name)} alt={item.name} style={{width:50,height:50,objectFit:'cover',borderRadius:5}} onError={e=>{(e.target as HTMLImageElement).src='https://via.placeholder.com/50?text=Err';}}/>
                        </td>
                        <td style={tdStyle}>{escapeHTML(item.name)}</td>
                        <td style={tdStyle}>₹{item.price}</td>
                        <td style={{...tdStyle,fontSize:'0.85rem'}}>{escapeHTML(item.category)}</td>
                        <td style={tdStyle}><span className={`status ${item.available!==false?'completed':'preparing'}`}>{item.available!==false?'Available':'Sold Out'}</span></td>
                        <td style={tdStyle}><div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                          <button className="btn-order" style={btnStyle(item.available!==false?'#292524':'#052e16',item.available!==false?'#d4a574':'#4ade80')} onClick={()=>toggleAvailability(item._id,item.available!==false)}>{item.available!==false?'Sold Out':'Available'}</button>
                          <button className="btn-order" style={btnStyle('#1e3a5f','#60a5fa')} onClick={()=>setMenuModal({open:true,item})}>Edit</button>
                          <button className="btn-order" style={btnStyle('#3b0a0a','#f87171')} onClick={()=>deleteMenuItem(item._id)}>Delete</button>
                        </div></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TIFFIN */}
          {activeTab==='tiffin' && (
            <div className="admin-tab-content active">
              <h2>Today&apos;s Tiffin Menu</h2>
              <button className="btn" style={{marginBottom:'1rem'}} onClick={()=>setTiffinModal({open:true,item:null})}>+ Add Today&apos;s Tiffin</button>
              {tiffinItems.length===0?<p className="empty-cart">No tiffin items found.</p>:(
                <div style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',background:'var(--admin-card-bg)',borderRadius:5,overflow:'hidden',minWidth:520}}>
                    <thead><tr style={{background:'var(--admin-sidebar)',color:'var(--admin-sidebar-text)',textAlign:'left'}}>{['Emoji','Name','Meta','Price','Status','Actions'].map(h=><th key={h} style={thStyle}>{h}</th>)}</tr></thead>
                    <tbody>{tiffinItems.map(item=>(
                      <tr key={item._id} style={{borderBottom:'1px solid var(--admin-border)'}}>
                        <td style={{...tdStyle,fontSize:'1.5rem'}}>{item.emoji}</td>
                        <td style={tdStyle}>{escapeHTML(item.name)}</td>
                        <td style={{...tdStyle,color:'var(--admin-text-muted)'}}>{escapeHTML(item.meta)}</td>
                        <td style={tdStyle}>₹{item.price}</td>
                        <td style={tdStyle}><span className={`status ${item.available!==false?'completed':'preparing'}`}>{item.available!==false?'Available':'Sold Out'}</span></td>
                        <td style={tdStyle}><div style={{display:'flex',gap:6}}>
                          <button className="btn-order" style={btnStyle('#1e3a5f','#60a5fa')} onClick={()=>setTiffinModal({open:true,item})}>Edit</button>
                          <button className="btn-order" style={btnStyle('#3b0a0a','#f87171')} onClick={()=>deleteTiffin(item._id)}>Delete</button>
                        </div></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* RESTAURANTS */}
          {activeTab==='restaurants' && (
            <div className="admin-tab-content active">
              <h2>Restaurant Management</h2>
              <p style={{margin:'0 0 1rem',fontSize:'0.92rem',color:'var(--admin-text-muted)'}}>View registered restaurants, monitor owner details, and control whether each restaurant is active or open for orders.</p>
              <input
                type="text"
                placeholder="Search restaurants by name, owner, contact, or address..."
                onChange={e=>{
                  const t=e.target.value.toLowerCase();
                  setFilteredRestaurants(allRestaurants.filter(r=>
                    (r.name||'').toLowerCase().includes(t) ||
                    (r.ownerName||'').toLowerCase().includes(t) ||
                    (r.contact||'').toLowerCase().includes(t) ||
                    (r.ownerContact||'').toLowerCase().includes(t) ||
                    (r.address||'').toLowerCase().includes(t)
                  ));
                }}
                style={{background:'var(--admin-card-bg)',border:'1px solid var(--admin-border)',borderRadius:8,padding:'10px 14px',color:'var(--admin-text-main)',width:'100%',maxWidth:460,marginBottom:'1rem',boxSizing:'border-box'}}
              />

              {filteredRestaurants.length===0 ? <p className="empty-cart">No restaurants found.</p> : (
                <div style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',minWidth:920}}>
                    <thead>
                      <tr style={{background:'var(--admin-sidebar)',color:'var(--admin-sidebar-text)',textAlign:'left'}}>
                        {['Restaurant','Owner','Operations','Status','Actions'].map(h=><th key={h} style={thStyle}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRestaurants.map(restaurant=>(
                        <tr key={restaurant._id} style={{borderBottom:'1px solid var(--admin-border)'}}>
                          <td style={tdStyle}>
                            <div style={{display:'flex',alignItems:'center',gap:12}}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={restaurant.imageUrl?.trim()?escapeHTML(restaurant.imageUrl):getDefaultImage(restaurant.name)}
                                alt={restaurant.name}
                                style={{width:56,height:56,objectFit:'cover',borderRadius:10,flexShrink:0,border:'1px solid var(--admin-border)'}}
                                onError={e=>{(e.target as HTMLImageElement).src='https://via.placeholder.com/56?text=Err';}}
                              />
                              <div>
                                <div style={{fontWeight:600,color:'var(--admin-text-main)'}}>{escapeHTML(restaurant.name)}</div>
                                <div style={{fontSize:'0.85rem',color:'var(--admin-text-muted)',marginTop:2}}>{escapeHTML(restaurant.contact)}</div>
                                <div style={{fontSize:'0.82rem',color:'var(--admin-text-muted)',marginTop:4,maxWidth:260,lineHeight:1.5}}>{escapeHTML(restaurant.address)}</div>
                              </div>
                            </div>
                          </td>
                          <td style={tdStyle}>
                            <div style={{fontWeight:500,color:'var(--admin-text-main)'}}>{escapeHTML(restaurant.ownerName || 'Unknown Owner')}</div>
                            <div style={{fontSize:'0.85rem',color:'var(--admin-text-muted)',marginTop:2}}>{escapeHTML(restaurant.ownerContact || '')}</div>
                            <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:8}}>
                              <span style={{background:restaurant.ownerVerified?'#22c55e':'#f97316',color:'#fff',padding:'3px 8px',borderRadius:12,fontSize:'0.75rem'}}>{restaurant.ownerVerified?'Verified':'Unverified'}</span>
                              <span style={{background:restaurant.ownerTrusted?'#3b82f6':'#6b7280',color:'#fff',padding:'3px 8px',borderRadius:12,fontSize:'0.75rem'}}>{restaurant.ownerTrusted?'Trusted':'Standard'}</span>
                            </div>
                          </td>
                          <td style={tdStyle}>
                            <div style={{display:'flex',flexDirection:'column',gap:6,fontSize:'0.88rem'}}>
                              <div style={{color:'var(--admin-text-main)'}}><strong>{restaurant.menuCount}</strong> menu item{restaurant.menuCount!==1?'s':''}</div>
                              <div style={{color:'var(--admin-text-main)'}}><strong>{restaurant.liveOrderCount}</strong> live order{restaurant.liveOrderCount!==1?'s':''}</div>
                              <div style={{color:'var(--admin-text-muted)'}}>ETA: {restaurant.estimatedDeliveryTime || 30} mins</div>
                              <div style={{color:'var(--admin-text-muted)'}}>Added {restaurant.createdAt ? new Date(restaurant.createdAt).toLocaleDateString('en-IN') : 'recently'}</div>
                            </div>
                          </td>
                          <td style={tdStyle}>
                            <div style={{display:'flex',flexDirection:'column',gap:6}}>
                              <span className={`status ${restaurant.isActive ? 'completed' : 'cancelled'}`}>{restaurant.isActive ? 'Active' : 'Inactive'}</span>
                              <span className={`status ${restaurant.isOpen ? 'preparing' : 'rejected'}`}>{restaurant.isOpen ? 'Open for Orders' : 'Closed'}</span>
                            </div>
                          </td>
                          <td style={tdStyle}>
                            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                              <button
                                className="btn-order"
                                style={btnStyle(restaurant.isActive ? '#3b0a0a' : '#052e16', restaurant.isActive ? '#fca5a5' : '#4ade80')}
                                onClick={()=>updateRestaurant(restaurant._id,{isActive:!restaurant.isActive})}
                              >
                                {restaurant.isActive ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                className="btn-order"
                                style={btnStyle(restaurant.isOpen ? '#4b5563' : '#1e3a5f', restaurant.isOpen ? '#e5e7eb' : '#60a5fa')}
                                onClick={()=>updateRestaurant(restaurant._id,{isOpen:!restaurant.isOpen})}
                              >
                                {restaurant.isOpen ? 'Mark Closed' : 'Mark Open'}
                              </button>
                              <button
                                className="btn-order"
                                style={btnStyle('#7c2d12','#fdba74')}
                                onClick={()=>promptEtaUpdate(restaurant)}
                              >
                                Update ETA
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* CUSTOMERS */}
          {activeTab==='customers' && (
            <div className="admin-tab-content active">
              <h2>Customer Insights</h2>
              <input type="text" placeholder="Search customers..." onChange={e=>{const t=e.target.value.toLowerCase();setFilteredCustomers(allCustomers.filter(c=>(c.name||'Guest').toLowerCase().includes(t)||(c._id||'').toLowerCase().includes(t)));}} style={{background:'var(--admin-card-bg)',border:'1px solid var(--admin-border)',borderRadius:8,padding:'8px 14px',color:'var(--admin-text-main)',width:'100%',maxWidth:320,marginBottom:14,boxSizing:'border-box'}}/>
              <div style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
                <table style={{width:'100%',borderCollapse:'collapse',minWidth:560}}>
                  <thead><tr style={{background:'var(--admin-sidebar)',color:'var(--admin-sidebar-text)',textAlign:'left'}}>{['Customer','Contact','Orders','Spent','Last Order','Actions'].map(h=><th key={h} style={thStyle}>{h}</th>)}</tr></thead>
                  <tbody>{filteredCustomers.map(c=>{
                    const name=c.name||'Guest';
                    const initials=name.split(' ').map((w:string)=>w[0]).join('').toUpperCase().slice(0,2);
                    return(
                      <tr key={c._id} style={{borderBottom:'1px solid var(--admin-border)'}}>
                        <td style={tdStyle}><div style={{display:'flex',alignItems:'center',gap:10}}><div style={{width:32,height:32,borderRadius:'50%',background:'#1e3a5f',color:'#60a5fa',fontSize:12,fontWeight:500,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{initials}</div><span style={{fontWeight:500}}>{escapeHTML(name)}{c.orderCount>1?' ⭐':''}</span></div></td>
                        <td style={{...tdStyle,fontSize:'0.85rem'}}>{escapeHTML(c._id)}</td>
                        <td style={tdStyle}><span style={{background:'#3498db',color:'#fff',padding:'3px 8px',borderRadius:12,fontSize:'0.85rem'}}>{c.orderCount}</span></td>
                        <td style={{...tdStyle,fontWeight:'bold',color:'#27ae60'}}>₹{c.totalSpent.toLocaleString('en-IN')}</td>
                        <td style={{...tdStyle,color:'var(--admin-text-muted)',fontSize:'0.9rem'}}>{new Date(c.lastOrderDate).toLocaleDateString('en-IN')}</td>
                        <td style={tdStyle}><button className="btn-order" style={btnStyle('#f97316')} onClick={()=>setCustomerHistory({contact:c._id,name})}>History</button></td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
            </div>
          )}

          {/* USERS */}
          {activeTab==='users' && (
            <div className="admin-tab-content active">
              <h2>User Control Management</h2>
              <input type="text" placeholder="Search users by name or contact..." onChange={e=>{const t=e.target.value.toLowerCase();setFilteredUsers(allUsers.filter(u=>(u.name||'').toLowerCase().includes(t)||(u.contact||'').toLowerCase().includes(t)));}} style={{background:'var(--admin-card-bg)',border:'1px solid var(--admin-border)',borderRadius:8,padding:'10px 14px',color:'var(--admin-text-main)',width:'100%',maxWidth:400,marginBottom:'1rem',boxSizing:'border-box'}}/>
              <div style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
                <table style={{width:'100%',borderCollapse:'collapse',minWidth:640}}>
                  <thead><tr style={{background:'var(--admin-sidebar)',color:'var(--admin-sidebar-text)',textAlign:'left'}}>{['User','Role','Status','Actions'].map(h=><th key={h} style={thStyle}>{h}</th>)}</tr></thead>
                  <tbody>{filteredUsers.map(u=>(
                    <tr key={u._id} style={{borderBottom:'1px solid var(--admin-border)'}}>
                      <td style={tdStyle}><div style={{fontWeight:500,color:'var(--admin-text-main)'}}>{escapeHTML(u.name||'Guest')}</div><div style={{fontSize:'0.85rem',color:'var(--admin-text-muted)'}}>{escapeHTML(u.contact)}</div></td>
                      <td style={tdStyle}><span style={{background:u.role==='admin'?'#8b5cf6':u.role==='agent'?'#f97316':'#6b7280',color:'#fff',padding:'3px 8px',borderRadius:12,fontSize:'0.85rem'}}>{u.role}</span></td>
                      <td style={tdStyle}>
                        <div style={{display:'flex',flexDirection:'column',gap:4}}>
                          <span style={{background:u.isVerified?'#22c55e':'#f97316',color:'#fff',padding:'3px 8px',borderRadius:12,fontSize:'0.8rem',width:'fit-content'}}>{u.isVerified?'Verified':'Unverified'}</span>
                          <span style={{background:u.isTrusted?'#3b82f6':'#6b7280',color:'#fff',padding:'3px 8px',borderRadius:12,fontSize:'0.8rem',width:'fit-content'}}>{u.isTrusted?'Trusted':'Standard'}</span>
                        </div>
                      </td>
                      <td style={tdStyle}><div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                        {u.role!=='admin'&&<button className="btn-order" style={btnStyle('#8b5cf6')} onClick={()=>{if(confirm(`Make ${u.name} an admin?`)) userAction(u._id,`/api/admin/users/${u._id}/role`,{role:'admin'});}}>Admin</button>}
                        {u.role==='admin'&&<button className="btn-order" style={btnStyle('#4b5563')} onClick={()=>userAction(u._id,`/api/admin/users/${u._id}/role`,{role:'user'})}>Revoke</button>}
                        <button className="btn-order" style={btnStyle(u.isTrusted?'#4b5563':'#3b82f6')} onClick={()=>userAction(u._id,`/api/admin/users/${u._id}/trust`,{isTrusted:!u.isTrusted})}>{u.isTrusted?'Untrust':'Trust'}</button>
                        <button className="btn-order" style={btnStyle(u.isVerified?'#4b5563':'#22c55e')} onClick={()=>userAction(u._id,`/api/admin/users/${u._id}/verify`,{isVerified:!u.isVerified})}>{u.isVerified?'Unverify':'Verify'}</button>
                        <button className="btn-order" style={btnStyle('#dc2626')} onClick={()=>{if(confirm('Permanently delete this user?')) userAction(u._id,`/api/admin/users/${u._id}`,{});}}>Delete</button>
                      </div></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}

          {/* DELIVERY */}
          {activeTab==='delivery' && (
            <div className="admin-tab-content active">
              <h2>🚚 Delivery Management</h2>

              {assignResult && (
                <div style={{background:'#f0fdf4',border:'2px solid #22c55e',borderRadius:12,padding:'16px 20px',marginBottom:'1.5rem',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
                  <div>
                    <p style={{margin:0,fontWeight:700,color:'#166534'}}>✅ Agent Assigned! OTP sent to customer.</p>
                    <p style={{margin:'4px 0 0',fontSize:14,color:'#374151'}}>OTP for order #{String(assignResult.orderId).slice(-5)}: <strong style={{fontSize:22,letterSpacing:4,color:'#166534'}}>{assignResult.otp}</strong></p>
                  </div>
                  <button onClick={()=>setAssignResult(null)} style={{background:'none',border:'none',fontSize:22,cursor:'pointer',color:'#6b7280'}}>✕</button>
                </div>
              )}

              {/* Responsive 2-col → 1-col */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:'1.5rem',alignItems:'start'}}>

                {/* Agents panel */}
                <div>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}>
                    <h3 style={{margin:0,color:'var(--admin-text-main)'}}>Delivery Agents</h3>
                    <button className="btn" style={{fontSize:13,padding:'6px 14px'}} onClick={()=>setNewAgentForm(f=>({...f,open:!f.open}))}>+ Add Agent</button>
                  </div>

                  {newAgentForm.open && (
                    <div style={{background:'var(--admin-card-bg)',border:'1px solid var(--admin-border)',borderRadius:12,padding:'16px',marginBottom:'1rem'}}>
                      <h4 style={{margin:'0 0 12px',color:'var(--admin-text-main)'}}>New Agent Account</h4>
                      {[['Name','name','text'],['Phone / Contact','contact','tel'],['Password','password','password']].map(([label,key,type])=>(
                        <div key={key} style={{marginBottom:10}}>
                          <label style={{fontSize:12,fontWeight:600,color:'var(--admin-text-muted)',display:'block',marginBottom:4}}>{label}</label>
                          <input type={type} value={(newAgentForm as any)[key]} onChange={e=>setNewAgentForm(f=>({...f,[key]:e.target.value}))}
                            style={{width:'100%',padding:'8px 12px',border:'1px solid var(--admin-border)',borderRadius:8,background:'var(--admin-bg)',color:'var(--admin-text-main)',boxSizing:'border-box' as const}}/>
                        </div>
                      ))}
                      <div style={{display:'flex',gap:8,marginTop:12}}>
                        <button className="btn" style={{flex:1,fontSize:13}} onClick={async()=>{
                          if(!newAgentForm.name||!newAgentForm.contact||!newAgentForm.password){alert('All fields required.');return;}
                          const d=await api('/api/admin/agents',{method:'POST',body:JSON.stringify({name:newAgentForm.name,contact:newAgentForm.contact,password:newAgentForm.password})});
                          if(d.success){alert('Agent created!');setNewAgentForm({open:false,name:'',contact:'',password:''});loadTab('delivery');}
                          else alert(d.message||'Failed.');
                        }}>Create</button>
                        <button className="btn" style={{flex:1,fontSize:13,background:'#6b7280'}} onClick={()=>setNewAgentForm({open:false,name:'',contact:'',password:''})}>Cancel</button>
                      </div>
                    </div>
                  )}

                  {agents.length===0 ? (
                    <div style={{textAlign:'center',padding:'2rem',background:'var(--admin-card-bg)',borderRadius:12,border:'2px dashed var(--admin-border)'}}>
                      <p style={{color:'var(--admin-text-muted)',margin:0}}>No agents yet.</p>
                    </div>
                  ) : agents.map(agent=>(
                    <div key={agent._id} style={{background:'var(--admin-card-bg)',border:'1px solid var(--admin-border)',borderRadius:12,padding:'14px 16px',marginBottom:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div style={{display:'flex',alignItems:'center',gap:12}}>
                        <div style={{width:42,height:42,borderRadius:'50%',background:'#f97316',color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:18,flexShrink:0}}>
                          {agent.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p style={{margin:0,fontWeight:600,color:'var(--admin-text-main)'}}>{escapeHTML(agent.name)}</p>
                          <p style={{margin:0,fontSize:12,color:'var(--admin-text-muted)'}}>{escapeHTML(agent.phone||'No phone')}</p>
                        </div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <span style={{display:'inline-block',padding:'3px 10px',borderRadius:20,fontSize:12,fontWeight:600,marginBottom:4,background:agent.status==='Available'?'#dcfce7':agent.status==='Busy'?'#fef9c3':'#f3f4f6',color:agent.status==='Available'?'#166534':agent.status==='Busy'?'#92400e':'#6b7280'}}>{agent.status}</span>
                        <p style={{margin:0,fontSize:11,color:'var(--admin-text-muted)'}}>{agent.currentLoad}/{agent.maxBatchLimit} orders</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Assign delivery */}
                <div>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}>
                    <h3 style={{margin:0,color:'var(--admin-text-main)'}}>Assign Delivery</h3>
                    <button className="btn" style={{fontSize:13,padding:'6px 14px',background:'#6b7280'}} onClick={()=>loadTab('delivery')}>🔄 Refresh</button>
                  </div>
                  <p style={{fontSize:13,color:'var(--admin-text-muted)',marginBottom:'1rem'}}>Orders in <strong>Preparing</strong> status ready for dispatch:</p>

                  {deliveryOrders.length===0 ? (
                    <div style={{textAlign:'center',padding:'2rem',background:'var(--admin-card-bg)',borderRadius:12,border:'2px dashed var(--admin-border)'}}>
                      <p style={{fontSize:'1.5rem',margin:'0 0 8px'}}>🎉</p>
                      <p style={{color:'var(--admin-text-muted)',margin:0}}>No orders awaiting dispatch.</p>
                    </div>
                  ) : deliveryOrders.map(order=>(
                    <div key={order._id} style={{background:'var(--admin-card-bg)',border:'1px solid var(--admin-border)',borderRadius:12,padding:'14px 16px',marginBottom:12}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8,flexWrap:'wrap',gap:6}}>
                        <div>
                          <p style={{margin:0,fontWeight:700,color:'var(--admin-text-main)'}}>Order #{String(order._id).slice(-5)}</p>
                          <p style={{margin:'2px 0 0',fontSize:13,color:'var(--admin-text-muted)'}}>{escapeHTML(order.customerName)} · {order.paymentMethod==='COD'?'💵 COD':'✅ Paid'} · ₹{order.total}</p>
                        </div>
                        <span style={{background:'#fff7ed',color:'#ea580c',padding:'3px 10px',borderRadius:20,fontSize:12,fontWeight:600,border:'1px solid #fed7aa'}}>{order.status}</span>
                      </div>
                      <p style={{margin:'0 0 10px',fontSize:13,color:'var(--admin-text-muted)'}}>📍 {escapeHTML(order.address||'No address')}</p>

                      {order.inHouseDelivery ? (
                        <div style={{background:'#f0fdf4',borderRadius:8,padding:'8px 12px',fontSize:13,color:'#166534',fontWeight:500}}>
                          ✅ In-house delivery assigned {order.deliveryOtp&&`· OTP: ${order.deliveryOtp}`}
                        </div>
                      ) : (
                        <>
                          {assigningOrder===order._id ? (
                            <div style={{display:'flex',flexDirection:'column',gap:8}}>
                              <p style={{margin:0,fontSize:13,fontWeight:600,color:'var(--admin-text-main)'}}>Select agent:</p>
                              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                                {agents.map(agent=>{
                                  const isAssignable = agent.status === 'Available' && agent.currentLoad < agent.maxBatchLimit;
                                  return (
                                    <button key={agent._id} disabled={!isAssignable}
                                      style={{padding:'6px 12px',borderRadius:8,border:'1.5px solid #f97316',background:'var(--admin-bg)',color:'var(--admin-text-main)',cursor:isAssignable?'pointer':'not-allowed',opacity:isAssignable?1:0.5,fontSize:13,fontWeight:500}}
                                      onClick={async()=>{
                                        const d=await api('/api/admin/agents/assign',{method:'POST',body:JSON.stringify({orderId:order._id,agentId:agent._id})});
                                        if(d.success){setAssignResult({orderId:order._id,otp:d.deliveryOtp});setAssigningOrder(null);loadTab('delivery');}
                                        else alert(d.message||'Failed.');
                                      }}>
                                      {agent.name} ({agent.currentLoad}/{agent.maxBatchLimit})
                                    </button>
                                  );
                                })}
                                {agents.length===0&&<p style={{color:'#ef4444',fontSize:13}}>No agents available.</p>}
                              </div>
                              <div style={{display:'flex',gap:6}}>
                                <button style={{padding:'6px 12px',borderRadius:8,border:'none',background:'#f3f4f6',color:'#374151',cursor:'pointer',fontSize:13}} onClick={()=>setAssigningOrder(null)}>Cancel</button>
                                {!order.borzoTrackingUrl&&<button style={{padding:'6px 12px',borderRadius:8,border:'none',background:'#3b82f6',color:'white',cursor:'pointer',fontSize:13,fontWeight:600}}
                                  onClick={async()=>{const d=await api(`/api/delivery/create-order/${order._id}`,{method:'POST'});alert(d.message||'Borzo delivery initiated.');loadTab('delivery');}}>
                                  Use Borzo Instead
                                </button>}
                              </div>
                            </div>
                          ) : (
                            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                              <button className="btn-order" style={btnStyle('#f97316')} onClick={()=>setAssigningOrder(order._id)}>🚴 Assign Agent</button>
                              {!order.borzoTrackingUrl&&<button className="btn-order" style={btnStyle('#3b82f6')}
                                onClick={async()=>{const d=await api(`/api/delivery/create-order/${order._id}`,{method:'POST'});alert(d.message||'Done.');loadTab('delivery');}}>
                                🛵 Borzo Delivery
                              </button>}
                              {order.borzoTrackingUrl&&<a href={order.borzoTrackingUrl} target="_blank" rel="noreferrer" className="btn-order" style={{...btnStyle('#3b82f6'),textDecoration:'none'}}>Track Borzo</a>}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </>
  );
}