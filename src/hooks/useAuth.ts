'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthToken, getLoggedInUser, isTokenExpired, type LoggedInUser } from '@/lib/utils';

type User = LoggedInUser;

export function useAuth(requireLogin = false, requireAdmin = false) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  // Use a ref to track if redirect has already happened — prevents infinite loops
  const redirected = useRef(false);

  useEffect(() => {
    const t = getAuthToken();
    const u = getLoggedInUser();

    if (t && u && !isTokenExpired(t)) {
      setToken(t);
      setUser(u);

      if (requireAdmin && u.role !== 'admin' && !redirected.current) {
        redirected.current = true;
        router.replace('/login');
      }
    } else {
      setToken(null);
      setUser(null);

      if (requireLogin && !redirected.current) {
        redirected.current = true;
        router.replace('/login');
      }
    }

    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ← empty array: run once on mount only

  const logout = useCallback(async () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('loggedInUser');
    await fetch('/api/logout', { method: 'POST' });
    setUser(null);
    setToken(null);
    router.push('/login');
  }, [router]);

  const refresh = useCallback(() => {
    const t = getAuthToken();
    const u = getLoggedInUser();
    if (t && u && !isTokenExpired(t)) {
      setToken(t);
      setUser(u);
    } else {
      setToken(null);
      setUser(null);
    }
  }, []);

  return { user, token, loading, logout, refresh };
}
