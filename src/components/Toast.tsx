'use client';
import { useEffect } from 'react';
import { escapeHTML } from '@/lib/utils';

declare global {
  interface Window {
    showToast: (name: string, price: number) => void;
    showSystemToast: (title: string, message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  }
}

/* ── Config ─────────────────────────────────────────────────────────────── */
const MAX_TOASTS  = 4;
const DURATION_MS = 4500;

/* ── Type map ───────────────────────────────────────────────────────────── */
const TYPE_MAP = {
  success: { color: '#22c55e', bg: '#f0fdf4', border: '#bbf7d0', icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>` },
  error:   { color: '#ef4444', bg: '#fef2f2', border: '#fecaca', icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>` },
  info:    { color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe', icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>` },
  warning: { color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>` },
  cart:    { color: '#f97316', bg: '#fff7ed', border: '#fed7aa', icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>` },
};

/* ── Core ───────────────────────────────────────────────────────────────── */
export function initToasts() {
  if (typeof window === 'undefined') return;

  function getContainer(): HTMLElement {
    let c = document.getElementById('toast-container');
    if (!c) {
      c = document.createElement('div');
      c.id = 'toast-container';
      c.className = 'toast-container';
      document.body.appendChild(c);
    }
    return c;
  }

  function removeToast(toast: HTMLElement, timer: ReturnType<typeof setTimeout>) {
    clearTimeout(timer);
    if (toast.dataset.removing) return;
    toast.dataset.removing = '1';
    toast.style.animation = 'toastOut 0.3s cubic-bezier(0.4,0,1,1) forwards';
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }

  function createToast(html: string, duration = DURATION_MS): HTMLElement {
    const container = getContainer();

    // Cap max toasts — remove oldest if over limit
    const existing = container.querySelectorAll('.toast-item');
    if (existing.length >= MAX_TOASTS) {
      const oldest = existing[0] as HTMLElement;
      removeToast(oldest, (oldest as any).__timer);
    }

    const wrap = document.createElement('div');
    wrap.className = 'toast-item';
    wrap.innerHTML = html;
    container.appendChild(wrap);

    // Slide in
    requestAnimationFrame(() => wrap.classList.add('toast-item--visible'));

    const timer = setTimeout(() => removeToast(wrap, timer), duration);
    (wrap as any).__timer = timer;

    // Pause progress on hover
    wrap.addEventListener('mouseenter', () => {
      const bar = wrap.querySelector('.toast-bar') as HTMLElement | null;
      if (bar) bar.style.animationPlayState = 'paused';
    });
    wrap.addEventListener('mouseleave', () => {
      const bar = wrap.querySelector('.toast-bar') as HTMLElement | null;
      if (bar) bar.style.animationPlayState = 'running';
    });

    // Close button
    wrap.querySelector('.toast-x')?.addEventListener('click', () => removeToast(wrap, timer));

    return wrap;
  }

  /* ── Cart toast ──────────────────────────────────────────────────────── */
  window.showToast = (itemName: string, price: number) => {
    const clean = escapeHTML(itemName.replace(/\s*\([^)]*\)/g, ''));
    const t     = TYPE_MAP.cart;

    // If a cart toast already exists — update it instead of stacking
    const existing = document.querySelector('.toast-cart-item') as HTMLElement | null;
    if (existing) {
      // Reset the auto-dismiss timer
      clearTimeout((existing as any).__timer);
      const newTimer = setTimeout(() => removeToast(existing, newTimer), DURATION_MS);
      (existing as any).__timer = newTimer;

      // Update content
      const titleEl = existing.querySelector('.toast-title');
      const subEl   = existing.querySelector('.toast-sub');
      if (titleEl) titleEl.textContent = 'Added to cart!';
      if (subEl)   subEl.innerHTML = `<strong style="color:#1a1a1a">${clean}</strong> &nbsp;·&nbsp; <span style="color:${t.color};font-weight:700">₹${price}</span>`;

      // Restart progress bar
      const bar = existing.querySelector('.toast-bar') as HTMLElement | null;
      if (bar) {
        bar.style.animation = 'none';
        requestAnimationFrame(() => {
          if (bar) bar.style.animation = '';
        });
      }

      // Bump animation to draw attention
      existing.style.animation = 'none';
      requestAnimationFrame(() => { existing.style.animation = ''; });
      return;
    }

    const wrap = createToast(`
      <div class="toast-card" style="--t-color:${t.color};--t-bg:${t.bg};--t-border:${t.border}">
        <div class="toast-top">
          <span class="toast-icon-wrap">${t.icon}</span>
          <div class="toast-body">
            <p class="toast-title">Added to cart!</p>
            <p class="toast-sub"><strong style="color:#1a1a1a">${clean}</strong> &nbsp;·&nbsp; <span style="color:${t.color};font-weight:700">₹${price}</span></p>
          </div>
          <button class="toast-x" aria-label="Close">✕</button>
        </div>
        <div class="toast-actions">
          <a href="/cart" class="toast-action-btn toast-action-primary">View Cart →</a>
          <button class="toast-action-btn toast-action-secondary toast-dismiss">Keep Browsing</button>
        </div>
        <div class="toast-progress-track"><div class="toast-bar" style="--dur:${DURATION_MS}ms;background:${t.color}"></div></div>
      </div>`, DURATION_MS);

    // Mark this toast as the cart toast so we can find it later
    wrap.classList.add('toast-cart-item');

    // "Keep Browsing" dismisses
    wrap.querySelector('.toast-dismiss')?.addEventListener('click', () => {
      removeToast(wrap, (wrap as any).__timer);
    });

    // Clean up the cart marker when removed so next add creates fresh
    wrap.addEventListener('animationend', () => {
      wrap.classList.remove('toast-cart-item');
    }, { once: true });
  };

  /* ── System toast ────────────────────────────────────────────────────── */
  window.showSystemToast = (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    const t = TYPE_MAP[type] ?? TYPE_MAP.success;
    createToast(`
      <div class="toast-card" style="--t-color:${t.color};--t-bg:${t.bg};--t-border:${t.border}">
        <div class="toast-top">
          <span class="toast-icon-wrap">${t.icon}</span>
          <div class="toast-body">
            <p class="toast-title">${escapeHTML(title)}</p>
            ${message ? `<p class="toast-sub">${escapeHTML(message)}</p>` : ''}
          </div>
          <button class="toast-x" aria-label="Close">✕</button>
        </div>
        <div class="toast-progress-track"><div class="toast-bar" style="--dur:${DURATION_MS}ms;background:${t.color}"></div></div>
      </div>`, DURATION_MS);
  };
}

export default function ToastInit() {
  useEffect(() => { initToasts(); }, []);
  return null;
}