'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { getCart, saveCart, CartItem, escapeHTML } from '@/lib/utils';

export default function CartPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const router = useRouter();

  useEffect(() => { setCart(getCart()); }, []);

  function updateQty(index: number, delta: number) {
    const updated = [...cart];
    updated[index].quantity = (updated[index].quantity || 1) + delta;
    if (updated[index].quantity <= 0) updated.splice(index, 1);
    saveCart(updated);
    setCart([...updated]);
    window.dispatchEvent(new Event('cartUpdated'));
  }

  const subtotal = cart.reduce((s, i) => s + i.price * (i.quantity || 1), 0);
  const deliveryFee = subtotal > 0 && subtotal < 199 ? 40 : 0;
  const grandTotal = subtotal + deliveryFee;

  return (
    <>
      <Navbar scrolled />
      <section className="cart-page">
        <div className="cart-container">
          <h2>Your Order</h2>
          <div id="cart-items">
            {cart.length === 0 ? (
              <p className="empty-cart">Your cart is currently empty.</p>
            ) : (
              cart.map((item, i) => (
                <div key={i} className="cart-item">
                  <div style={{ flex: 1 }}>
                    <strong>{escapeHTML(item.name)}</strong>
                    <br /><span style={{ fontSize: '0.85rem', color: '#888' }}>₹{item.price} each</span>
                  </div>
                  <div className="qty-controls">
                    <button className="qty-btn" onClick={() => updateQty(i, -1)}>-</button>
                    <span style={{ fontWeight: 'bold', width: 20, textAlign: 'center' }}>{item.quantity || 1}</span>
                    <button className="qty-btn" onClick={() => updateQty(i, 1)}>+</button>
                  </div>
                  <div style={{ fontWeight: 'bold', width: 70, textAlign: 'right' }}>₹{item.price * (item.quantity || 1)}</div>
                </div>
              ))
            )}
          </div>

          {cart.length > 0 && (
            <div className="cart-total">
              {subtotal < 199 && (
                <p style={{ color: '#e74c3c', fontSize: '0.95rem', textAlign: 'right', marginBottom: 10 }}>
                  Add ₹{199 - subtotal} more for <strong>FREE delivery!</strong>
                </p>
              )}
              {subtotal >= 199 && (
                <p style={{ color: '#2ecc71', fontSize: '0.95rem', textAlign: 'right', fontWeight: 'bold', marginBottom: 10 }}>
                  🎉 You unlocked FREE delivery!
                </p>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '2rem', fontSize: '1.1rem', color: '#666' }}>
                <span>Subtotal:</span><span>₹{subtotal}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '2rem', fontSize: '1.1rem', borderBottom: '1px solid #eee', paddingBottom: 10, color: '#666' }}>
                <span>Delivery Fee:</span><span>₹{deliveryFee}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '2rem', marginTop: 15, fontSize: '1.4rem', color: '#2c3e50' }}>
                <span>Grand Total:</span><span>₹{grandTotal}</span>
              </div>
            </div>
          )}

          {cart.length > 0 && (
            <div style={{ textAlign: 'right', marginTop: '2rem' }}>
              <button className="btn" onClick={() => router.push('/payment')}>Checkout</button>
            </div>
          )}
        </div>
      </section>
      <footer><p>&copy; {new Date().getFullYear()} Kajal Ki Rasoi. All Rights Reserved.</p></footer>
    </>
  );
}
