'use client';

import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import ToastInit from '@/components/Toast';
import StickyCart from '@/components/StickyCart';
import {
  getCart,
  saveCart,
  getAuthToken,
  isTokenExpired,
  getDefaultImage,
  escapeHTML,
  CartItem,
  getCartRestaurantId,
} from '@/lib/utils';

interface MenuItem {
  _id: string;
  restaurantId?: string;
  name: string;
  price: number;
  description?: string;
  category: string;
  imageUrl?: string;
  available?: boolean;
}

interface Restaurant {
  _id: string;
  name: string;
  address: string;
}

export default function MenuClient() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [cart, setCart] = useState<CartItem[]>(getCart());
  const [cartRestaurantId, setCartRestaurantId] = useState<string | null>(getCartRestaurantId());
  const [vegFilter, setVegFilter] = useState('all');
  const [priceFilter, setPriceFilter] = useState('all');
  const [popularFilter, setPopularFilter] = useState(false);
  const priceOptions = [
    { value: 'all', label: 'All Prices' },
    { value: '0-150', label: 'Under Rs150' },
    { value: '150-250', label: 'Rs150 - Rs250' },
    { value: '250+', label: 'Over Rs250' },
  ];

  useEffect(() => {
    Promise.all([
      fetch('/api/restaurants').then((response) => response.json()),
      fetch('/api/menu').then((response) => response.json()),
    ])
      .then(([restaurantData, menuData]) => {
        setRestaurants(restaurantData);
        setMenuItems(menuData);
      })
      .catch(console.error);
  }, []);

  function checkAuth(): boolean {
    const token = getAuthToken();
    if (!token || isTokenExpired(token)) {
      window.showSystemToast?.('Info', 'Please login to add items to cart.');
      setTimeout(() => {
        window.location.href = '/login';
      }, 1500);
      return false;
    }
    return true;
  }

  function getRestaurantName(restaurantId?: string) {
    if (!restaurantId) return 'Partner Kitchen';
    return restaurants.find((restaurant) => restaurant._id === restaurantId)?.name || 'Partner Kitchen';
  }

  function addToCart(name: string, price: number, restaurantId?: string) {
    if (!checkAuth()) return;

    const activeRestaurantId = restaurantId || cartRestaurantId || undefined;
    if (cart.length > 0 && cartRestaurantId && activeRestaurantId && cartRestaurantId !== activeRestaurantId) {
      window.showSystemToast?.(
        'One Restaurant Per Order',
        `Your cart already has items from ${getRestaurantName(cartRestaurantId)}. Please finish or clear that cart before adding dishes from ${getRestaurantName(activeRestaurantId)}.`,
        'warning'
      );
      return;
    }

    const updated = [...cart];
    const existing = updated.find((item) => item.name === name);
    if (existing) existing.quantity++;
    else updated.push({ name, price, quantity: 1 });

    saveCart(updated, activeRestaurantId);
    setCart(updated);
    setCartRestaurantId(activeRestaurantId || null);
    window.dispatchEvent(new Event('cartUpdated'));
    window.showToast?.(name, price);
  }

  function changeQty(name: string, delta: number) {
    if (!checkAuth()) return;

    const updated = [...cart];
    const idx = updated.findIndex((item) => item.name === name);
    if (idx === -1) return;
    updated[idx].quantity += delta;
    if (updated[idx].quantity <= 0) updated.splice(idx, 1);

    const nextRestaurantId = updated.length > 0 ? cartRestaurantId || undefined : undefined;
    saveCart(updated, nextRestaurantId);
    setCart(updated);
    if (updated.length === 0) setCartRestaurantId(null);
    window.dispatchEvent(new Event('cartUpdated'));
  }

  const cartTotal = cart.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0);
  const cartCount = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);

  const filtered = menuItems.filter((item) => {
    const name = escapeHTML(item.name).toLowerCase();
    if (vegFilter === 'veg' && (name.includes('chicken') || name.includes('egg'))) return false;
    if (priceFilter !== 'all') {
      const [min, max] = priceFilter.split('-');
      if (max) {
        if (item.price < Number(min) || item.price > Number(max)) return false;
      } else if (item.price < Number(min)) {
        return false;
      }
    }
    if (popularFilter && !name.includes('thali') && !name.includes('paneer') && !name.includes('biryani')) return false;
    return true;
  });

  const catOrder = [
    "🌟 Today's Special",
    '💰 Budget Meals',
    '🍱 Value Combos',
    '🍲 Main Course',
    '🥖 Breads & Parathas',
    '🍚 Rice & Biryani',
    '🥗 Extras & Desserts',
  ];

  const grouped: Record<string, MenuItem[]> = {};
  filtered.forEach((item) => {
    const category = item.category || '🍲 Main Course';
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(item);
  });
  Object.keys(grouped).forEach((category) => {
    if (!catOrder.includes(category)) catOrder.push(category);
  });

  const visibleCategoryCount = Object.keys(grouped).filter((category) => grouped[category]?.length > 0).length;

  return (
    <>
      <ToastInit />
      <Navbar scrolled />

      <main style={{ paddingTop: '80px', minHeight: '100vh' }}>
        <section className="menu-section">
          <div className="menu-page-hero">
            <div className="menu-page-hero-copy">
              <p className="menu-page-eyebrow">Fresh Menu</p>
              <h1 className="section-title menu-page-title">Our Menu</h1>
              <p className="menu-page-subtitle">
                Fresh, homemade, zero preservatives - cooked daily with love.
              </p>
              <p className="menu-page-note">
                Browse all available dishes from our partner kitchens without selecting a restaurant first.
              </p>

              <div className="menu-page-hero-tags">
                <span className="menu-page-tag">Homemade daily</span>
                <span className="menu-page-tag">Fresh partner kitchens</span>
                <span className="menu-page-tag">Curated by Kajal Ki Rasoi</span>
              </div>
            </div>

            <div className="menu-page-hero-stats">
              <div className="menu-page-stat-card">
                <span className="menu-page-stat-label">Available Dishes</span>
                <strong>{menuItems.length}</strong>
                <p>Currently ready to order across all active kitchens.</p>
              </div>
              <div className="menu-page-stat-card">
                <span className="menu-page-stat-label">Partner Kitchens</span>
                <strong>{restaurants.length}</strong>
                <p>Serving fresh dishes through the Kajal Ki Rasoi menu.</p>
              </div>
              <div className="menu-page-stat-card">
                <span className="menu-page-stat-label">Live Categories</span>
                <strong>{visibleCategoryCount}</strong>
                <p>Organized sections to help customers discover quickly.</p>
              </div>
            </div>
          </div>

          {cartRestaurantId && (
            <p className="menu-page-cart-note">
              Your cart is currently linked to <strong>{getRestaurantName(cartRestaurantId)}</strong>. Orders can include items from one restaurant at a time.
            </p>
          )}

          <div className="menu-filters">
            <div className="filter-group filter-group-segmented">
              <span className="filter-group-label">Type</span>
              <div className="filter-chip-row">
                <button
                  type="button"
                  className={`filter-chip ${vegFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setVegFilter('all')}
                >
                  All Dishes
                </button>
                <button
                  type="button"
                  className={`filter-chip ${vegFilter === 'veg' ? 'active' : ''}`}
                  onClick={() => setVegFilter('veg')}
                >
                  Veg Only
                </button>
              </div>
            </div>

            <div className="filter-group filter-group-segmented">
              <span className="filter-group-label">Budget</span>
              <div className="filter-chip-row">
                {priceOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`filter-chip ${priceFilter === option.value ? 'active' : ''}`}
                    onClick={() => setPriceFilter(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group filter-group-toggle">
              <span className="filter-group-label">Quick Filter</span>
              <button
                type="button"
                className={`filter-toggle ${popularFilter ? 'active' : ''}`}
                onClick={() => setPopularFilter((value) => !value)}
              >
                Popular Items
              </button>
            </div>
          </div>

          <div className="menu-results-summary">
            <span>{filtered.length} dishes showing</span>
            <button
              type="button"
              className="menu-results-reset"
              onClick={() => {
                setVegFilter('all');
                setPriceFilter('all');
                setPopularFilter(false);
              }}
            >
              Reset Filters
            </button>
          </div>

          <div id="dynamic-menu-container">
            {catOrder.map((category) => grouped[category]?.length > 0 && (
              <div key={category}>
                <h2 className="menu-category-title">{category}</h2>
                <div className="menu-grid">
                  {grouped[category].map((item) => {
                    const safeName = escapeHTML(item.name);
                    const qty = cart.find((cartItem) => cartItem.name === safeName)?.quantity || 0;
                    const imgSrc = item.imageUrl?.trim() ? escapeHTML(item.imageUrl) : getDefaultImage(safeName);
                    const isAvail = item.available !== false;
                    const isBest = safeName.includes('Thali') || safeName.includes('Paneer') || safeName.includes('Biryani');
                    const isRec = item.category === "🌟 Today's Special";
                    const isVeg = !safeName.toLowerCase().includes('chicken') && !safeName.toLowerCase().includes('egg');

                    return (
                      <div key={item._id} className={`menu-card ${!isAvail ? 'item-unavailable' : ''}`} data-name={safeName} data-price={item.price}>
                        <div className="card-img-container">
                          {/* Plain img is intentional because cards can use arbitrary remote image URLs from admin input. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={imgSrc} alt={safeName} className="card-img" loading="lazy" />
                          {isRec && isAvail && <span className="badge badge-recommended">Recommended</span>}
                          {isBest && isAvail && !isRec && <span className="badge badge-bestseller">Best Seller</span>}
                          {isVeg && isAvail && <span className="badge badge-veg"><span className="veg-dot"></span>Veg</span>}
                          {!isAvail && <span className="badge badge-sold-out">Sold Out</span>}
                        </div>
                        <div className="card-content">
                          <div className="card-title-row"><h3>{safeName}</h3></div>
                          <p className="card-description">{escapeHTML(item.description || '')}</p>
                          <div className="menu-card-source-row">
                            <span className="menu-card-source-label">Kitchen</span>
                            <span className="menu-card-source-pill">{escapeHTML(getRestaurantName(item.restaurantId))}</span>
                          </div>
                          <div className="card-footer">
                            <span className="price">Rs{item.price}</span>
                            <div className="card-action-control">
                              {!isAvail ? (
                                <button className="btn-order" style={{ backgroundColor: '#95a5a6', cursor: 'not-allowed' }} disabled>
                                  Sold Out
                                </button>
                              ) : qty > 0 ? (
                                <div className="qty-stepper">
                                  <button onClick={() => changeQty(safeName, -1)}>-</button>
                                  <span>{qty}</span>
                                  <button onClick={() => changeQty(safeName, 1)}>+</button>
                                </div>
                              ) : (
                                <button className="btn-order" onClick={() => addToCart(safeName, item.price, item.restaurantId)}>
                                  Add
                                </button>
                              )}
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
              <p style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>No items match your filters.</p>
            )}

            {menuItems.length === 0 && (
              <p style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>Loading menu...</p>
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
