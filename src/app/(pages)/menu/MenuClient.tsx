'use client';
import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import ToastInit from '@/components/Toast';
import StickyCart from '@/components/StickyCart';
import { getCart, saveCart, getAuthToken, isTokenExpired, getDefaultImage, escapeHTML, CartItem } from '@/lib/utils';

interface MenuItem {
  _id: string;
  name: string;
  price: number;
  description?: string;
  category: string;
  imageUrl?: string;
  available?: boolean;
}

export default function MenuClient() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart]           = useState<CartItem[]>(getCart());
  const [vegFilter, setVegFilter]     = useState('all');
  const [priceFilter, setPriceFilter] = useState('all');
  const [popularFilter, setPopularFilter] = useState(false);

  useEffect(() => {
    fetch('/api/menu').then(r => r.json()).then(setMenuItems).catch(console.error);
  }, []);

  function checkAuth(): boolean {
    const token = getAuthToken();
    if (!token || isTokenExpired(token)) {
      window.showSystemToast?.('Info', 'Please login to add items to cart.');
      setTimeout(() => { window.location.href = '/login'; }, 1500);
      return false;
    }
    return true;
  }

  function addToCart(name: string, price: number) {
    if (!checkAuth()) return;
    const updated = [...cart];
    const existing = updated.find(i => i.name === name);
    if (existing) existing.quantity++;
    else updated.push({ name, price, quantity: 1 });
    saveCart(updated); setCart(updated);
    window.dispatchEvent(new Event('cartUpdated'));
    window.showToast?.(name, price);
  }

  function changeQty(name: string, delta: number) {
    if (!checkAuth()) return;
    const updated = [...cart];
    const idx = updated.findIndex(i => i.name === name);
    if (idx === -1) return;
    updated[idx].quantity += delta;
    if (updated[idx].quantity <= 0) updated.splice(idx, 1);
    saveCart(updated); setCart(updated);
    window.dispatchEvent(new Event('cartUpdated'));
  }

  const cartTotal = cart.reduce((s, i) => s + i.price * (i.quantity || 1), 0);
  const cartCount = cart.reduce((s, i) => s + (i.quantity || 1), 0);

  const filtered = menuItems.filter(item => {
    const n = escapeHTML(item.name).toLowerCase();
    if (vegFilter === 'veg' && (n.includes('chicken') || n.includes('egg'))) return false;
    if (priceFilter !== 'all') {
      const [min, max] = priceFilter.split('-');
      if (max) { if (item.price < Number(min) || item.price > Number(max)) return false; }
      else if (item.price < Number(min)) return false;
    }
    if (popularFilter && !n.includes('thali') && !n.includes('paneer') && !n.includes('biryani')) return false;
    return true;
  });

  const catOrder = ["🌟 Today's Special","💰 Budget Meals","🍱 Value Combos","🍲 Main Course","🥖 Breads & Parathas","🍚 Rice & Biryani","🥗 Extras & Desserts"];
  const grouped: Record<string, MenuItem[]> = {};
  filtered.forEach(item => { const c = item.category || '🍲 Main Course'; if (!grouped[c]) grouped[c] = []; grouped[c].push(item); });
  Object.keys(grouped).forEach(c => { if (!catOrder.includes(c)) catOrder.push(c); });

  return (
    <>
      <ToastInit />
      <Navbar scrolled />

      <main style={{ paddingTop: '80px', minHeight: '100vh' }}>
        <section className="menu-section">
          <h1 className="section-title" style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>Our Menu</h1>
          <p style={{ textAlign: 'center', color: '#888', marginBottom: '2rem', fontSize: '1rem' }}>
            Fresh, homemade, zero preservatives — cooked daily with love 🍱
          </p>

          <div className="menu-filters">
            <div className="filter-group">
              <label><input type="radio" name="veg-filter" value="all" checked={vegFilter==='all'} onChange={() => setVegFilter('all')} /> All</label>
              <label><input type="radio" name="veg-filter" value="veg" checked={vegFilter==='veg'} onChange={() => setVegFilter('veg')} /> Veg Only</label>
            </div>
            <div className="filter-group">
              <select value={priceFilter} onChange={e => setPriceFilter(e.target.value)}>
                <option value="all">All Prices</option>
                <option value="0-150">Under ₹150</option>
                <option value="150-250">₹150 - ₹250</option>
                <option value="250+">Over ₹250</option>
              </select>
            </div>
            <div className="filter-group">
              <label><input type="checkbox" checked={popularFilter} onChange={e => setPopularFilter(e.target.checked)} /> ⭐ Popular Items</label>
            </div>
          </div>

          <div id="dynamic-menu-container">
            {catOrder.map(cat => grouped[cat]?.length > 0 && (
              <div key={cat}>
                <h2 className="menu-category-title">{cat}</h2>
                <div className="menu-grid">
                  {grouped[cat].map(item => {
                    const safeName = escapeHTML(item.name);
                    const qty      = cart.find(i => i.name === safeName)?.quantity || 0;
                    const imgSrc   = item.imageUrl?.trim() ? escapeHTML(item.imageUrl) : getDefaultImage(safeName);
                    const isAvail  = item.available !== false;
                    const isBest   = safeName.includes('Thali') || safeName.includes('Paneer') || safeName.includes('Biryani');
                    const isRec    = item.category === "🌟 Today's Special";
                    const isVeg    = !safeName.toLowerCase().includes('chicken') && !safeName.toLowerCase().includes('egg');
                    return (
                      <div key={item._id} className={`menu-card ${!isAvail ? 'item-unavailable' : ''}`} data-name={safeName} data-price={item.price}>
                        <div className="card-img-container">
                          <img src={imgSrc} alt={safeName} className="card-img" loading="lazy" />
                          {isRec  && isAvail && <span className="badge badge-recommended">🔥 Recommended</span>}
                          {isBest && isAvail && !isRec && <span className="badge badge-bestseller">⭐ Best Seller</span>}
                          {isVeg  && isAvail && <span className="badge badge-veg"><span className="veg-dot"></span>Veg</span>}
                          {!isAvail && <span className="badge badge-sold-out">Sold Out</span>}
                        </div>
                        <div className="card-content">
                          <div className="card-title-row"><h3>{safeName}</h3></div>
                          <p className="card-description">{escapeHTML(item.description || '')}</p>
                          <div className="card-footer">
                            <span className="price">₹{item.price}</span>
                            <div className="card-action-control">
                              {!isAvail
                                ? <button className="btn-order" style={{ backgroundColor:'#95a5a6', cursor:'not-allowed' }} disabled>Sold Out</button>
                                : qty > 0
                                  ? <div className="qty-stepper">
                                      <button onClick={() => changeQty(safeName, -1)}>-</button>
                                      <span>{qty}</span>
                                      <button onClick={() => changeQty(safeName, 1)}>+</button>
                                    </div>
                                  : <button className="btn-order" onClick={() => addToCart(safeName, item.price)}>＋ Add</button>
                              }
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {filtered.length === 0 && menuItems.length > 0 && (
              <p style={{ textAlign:'center', padding:'2rem', color:'#888' }}>No items match your filters.</p>
            )}
            {menuItems.length === 0 && (
              <p style={{ textAlign:'center', padding:'2rem', color:'#888' }}>Loading menu…</p>
            )}
          </div>
        </section>
      </main>

      <StickyCart cartCount={cartCount} cartTotal={cartTotal} />

      <footer>
        <p>&copy; {new Date().getFullYear()} Kajal Ki Rasoi. All Rights Reserved.</p>
        <p>Noida Sector 130 | +91 7366952957</p>
      </footer>
    </>
  );
}
