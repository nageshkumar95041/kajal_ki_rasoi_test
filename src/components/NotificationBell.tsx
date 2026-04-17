'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

interface Notification {
  _id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track which token we last fetched for.
  // If it changes (login / logout / user switch), we wipe state immediately
  // so no user ever sees another user's notifications.
  const lastTokenRef = useRef<string | null>(null);

  const getToken = () =>
    typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

  const clearState = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
    setShowDropdown(false);
  }, []);

  const fetchNotifications = useCallback(async () => {
    const token = getToken();

    // Token changed (logout, user switch, expiry) — wipe immediately
    if (token !== lastTokenRef.current) {
      lastTokenRef.current = token;
      clearState();
      if (!token) return;
    }

    if (!token) return;

    try {
      const res = await fetch('/api/notifications?limit=10', {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Token rejected server-side — clear and bail
      if (res.status === 401 || res.status === 403) {
        lastTokenRef.current = null;
        clearState();
        return;
      }

      if (res.ok) {
        const data = await res.json();
        // Guard: if the token changed while we were awaiting, discard the result
        if (getToken() !== token) { clearState(); return; }
        setNotifications(data.notifications ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch {
      // Network error — leave existing state, retry on next interval
    }
  }, [clearState]);

  // Re-fetch immediately when localStorage changes (login / logout in same tab)
  useEffect(() => {
    const onStorage = () => fetchNotifications();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [fetchNotifications]);

  // Initial fetch + 30 s polling
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAsRead = async (id: string) => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isRead: true }),
      });
      if (res.ok) {
        setNotifications(n => n.map(notif => notif._id === id ? { ...notif, isRead: true } : notif));
        setUnreadCount(c => Math.max(0, c - 1));
      }
    } catch { /* ignore */ }
  };

  const deleteNotification = async (id: string) => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const notif = notifications.find(n => n._id === id);
        if (notif && !notif.isRead) setUnreadCount(c => Math.max(0, c - 1));
        setNotifications(n => n.filter(notif => notif._id !== id));
      }
    } catch { /* ignore */ }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'order_placed':     return '🛒';
      case 'order_status':     return '📦';
      case 'order_completed':  return '✅';
      case 'new_order':        return '📬';
      case 'payment_received': return '💰';
      default:                 return '🔔';
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        style={{
          position: 'relative',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '1.5rem',
          padding: '0.5rem',
        }}
      >
        🔔
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              background: '#e74c3c',
              color: 'white',
              borderRadius: '50%',
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 'bold',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <div
          style={{
            position: 'absolute',
            top: '40px',
            right: 0,
            background: 'white',
            border: '1px solid #ddd',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            width: '350px',
            maxHeight: '400px',
            overflowY: 'auto',
            zIndex: 1000,
          }}
        >
          <div style={{ padding: '1rem', borderBottom: '1px solid #eee' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 'bold' }}>Notifications</h3>
          </div>

          {notifications.length === 0 ? (
            <div style={{ padding: '1rem', textAlign: 'center', color: '#999' }}>
              No notifications
            </div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {notifications.map((notif) => (
                <li
                  key={notif._id}
                  style={{
                    padding: '0.75rem 1rem',
                    borderBottom: '1px solid #eee',
                    backgroundColor: notif.isRead ? 'transparent' : '#f0f7ff',
                    cursor: 'pointer',
                  }}
                  onClick={() => !notif.isRead && markAsRead(notif._id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: '0 0 0.25rem 0', fontWeight: 'bold', fontSize: '0.9rem' }}>
                        {getNotificationIcon(notif.type)} {notif.title}
                      </p>
                      <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.85rem', color: '#666' }}>
                        {notif.message}
                      </p>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: '#999' }}>
                        {new Date(notif.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notif._id);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        padding: 0,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}