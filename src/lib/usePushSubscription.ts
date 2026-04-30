'use client';
/**
 * usePushSubscription
 * Call this hook in the agent page and restaurant dashboard to register
 * for Web Push notifications (works on locked screen).
 *
 * Usage:
 *   const { subscribed, subscribe } = usePushSubscription(token);
 */

import { useState, useEffect } from 'react';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushSubscription(token: string | null) {
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  // Auto-subscribe on mount if token is available
  useEffect(() => {
    if (token && VAPID_PUBLIC_KEY) {
      subscribe();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function subscribe() {
    if (!token) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setError('Push notifications not supported in this browser.');
      return;
    }
    if (!VAPID_PUBLIC_KEY) {
      console.warn('[usePushSubscription] NEXT_PUBLIC_VAPID_PUBLIC_KEY not set.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Register service worker
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;

      // 2. Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setError('Notification permission denied.');
        setLoading(false);
        return;
      }

      // 3. Check existing subscription
      let sub = await reg.pushManager.getSubscription();

      // 4. If none, create one
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
        });
      }

      // 5. Send to server
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(sub.toJSON()),
      });

      if (res.ok) {
        setSubscribed(true);
      } else {
        setError('Failed to register push subscription.');
      }
    } catch (err: any) {
      console.error('[usePushSubscription]', err);
      setError(err.message || 'Unknown error.');
    }

    setLoading(false);
  }

  async function unsubscribe() {
    if (!token) return;
    try {
      const reg = await navigator.serviceWorker.getRegistration('/');
      if (!reg) return;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return;
      await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
      setSubscribed(false);
    } catch (err) {
      console.error('[usePushSubscription] unsubscribe error:', err);
    }
  }

  return { subscribed, loading, error, subscribe, unsubscribe };
}
