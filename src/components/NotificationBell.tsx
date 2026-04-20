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
    
    // Optimistic update: remove immediately from UI
    const notif = notifications.find(n => n._id === id);
    if (notif && !notif.isRead) setUnreadCount(c => Math.max(0, c - 1));
    setNotifications(n => n.filter(notif => notif._id !== id));
    
    // API call in background
    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
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

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
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
          transition: 'transform 0.2s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.1)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        🔔
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              background: '#FF9500',
              color: 'white',
              borderRadius: '50%',
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 'bold',
              animation: 'pulse 2s infinite',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <>
          <div
            onClick={() => setShowDropdown(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999,
              cursor: 'pointer',
            }}
          />
          <div
            style={{
              position: 'fixed',
              top: '50px',
              right: '8px',
              background: 'white',
              borderRadius: '12px',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
              width: 'calc(100vw - 16px)',
              maxWidth: '380px',
              maxHeight: '500px',
              overflowY: 'auto',
              zIndex: 1000,
              animation: 'slideDown 0.3s ease',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '1.2rem',
                borderBottom: '1px solid #f0f0f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'linear-gradient(135deg, #FF9500 0%, #FF8C00 100%)',
                borderRadius: '12px 12px 0 0',
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: '1.1rem',
                  fontWeight: '600',
                  color: 'white',
                }}
              >
                Notifications
              </h3>
              <button
                onClick={() => setShowDropdown(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)')}
              >
                ✕
              </button>
            </div>

            {/* Content */}
            {notifications.length === 0 ? (
              <div
                style={{
                  padding: '3rem 1.5rem',
                  textAlign: 'center',
                  color: '#999',
                  fontSize: '0.95rem',
                }}
              >
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔔</div>
                <p>No notifications yet</p>
                <p style={{ fontSize: '0.85rem', color: '#bbb' }}>
                  Check back soon for updates
                </p>
              </div>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {notifications.map((notif) => (
                  <li
                    key={notif._id}
                    style={{
                      padding: '1rem 1.2rem',
                      borderBottom: '1px solid #f5f5f5',
                      backgroundColor: notif.isRead ? '#fafafa' : '#fff9f0',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = notif.isRead ? '#f5f5f5' : '#ffe8cc';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = notif.isRead ? '#fafafa' : '#fff9f0';
                    }}
                    onClick={() => !notif.isRead && markAsRead(notif._id)}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '0.75rem',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            margin: '0 0 0.35rem 0',
                            fontWeight: '600',
                            fontSize: '0.95rem',
                            color: '#222',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                          }}
                        >
                          <span style={{ fontSize: '1.2rem' }}>
                            {getNotificationIcon(notif.type)}
                          </span>
                          {notif.title}
                        </p>
                        <p
                          style={{
                            margin: '0 0 0.5rem 0',
                            fontSize: '0.9rem',
                            color: '#555',
                            lineHeight: '1.4',
                          }}
                        >
                          {notif.message}
                        </p>
                        <p
                          style={{
                            margin: 0,
                            fontSize: '0.8rem',
                            color: '#999',
                          }}
                        >
                          {formatTime(notif.createdAt)}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notif._id);
                        }}
                        style={{
                          background: '#ff4444',
                          border: 'none',
                          color: 'white',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          padding: '0.4rem 0.8rem',
                          borderRadius: '6px',
                          fontWeight: '500',
                          transition: 'all 0.2s ease',
                          flexShrink: 0,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#cc0000')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = '#ff4444')}
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes pulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(255, 149, 0, 0.7);
          }
          50% {
            box-shadow: 0 0 0 8px rgba(255, 149, 0, 0);
          }
        }
      `}</style>
    </div>
  );
}