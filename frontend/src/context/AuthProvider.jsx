import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, refreshSession, setAccessToken, onSessionExpired } from '../lib/api';
import { AuthContext, normalizeUser } from './authContext';

// Sesi: access token di memori + cookie refresh httpOnly. Saat aplikasi dimuat (termasuk
// setelah reload), POST /auth/refresh memulihkan sesi tanpa menyimpan token di storage.
export default function AuthProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', user: null });

  useEffect(() => {
    let cancelled = false;
    onSessionExpired(() => {
      setAccessToken(null);
      setState({ status: 'anonymous', user: null });
    });
    // StrictMode memanggil efek dua kali; refreshSession() single-flight sehingga cookie
    // refresh hanya diputar sekali.
    refreshSession().then(
      (data) => {
        if (!cancelled) setState({ status: 'authenticated', user: normalizeUser(data.user) });
      },
      () => {
        if (!cancelled) setState({ status: 'anonymous', user: null });
      },
    );
    return () => {
      cancelled = true;
      onSessionExpired(null);
    };
  }, []);

  const startSession = useCallback((data) => {
    setAccessToken(data.accessToken);
    const user = normalizeUser(data.user);
    setState({ status: 'authenticated', user });
    return user;
  }, []);

  const login = useCallback(
    async (email, password) => startSession(await api.post('/auth/login', { email, password })),
    [startSession],
  );

  const register = useCallback(
    async (payload) => startSession(await api.post('/auth/register', payload)),
    [startSession],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Tetap keluar secara lokal walau server tidak terjangkau.
    }
    setAccessToken(null);
    setState({ status: 'anonymous', user: null });
  }, []);

  const updateUser = useCallback((patch) => {
    setState((s) => (s.user ? { ...s, user: normalizeUser({ ...s.user, ...patch }) } : s));
  }, []);

  const value = useMemo(
    () => ({ ...state, isAuthenticated: state.status === 'authenticated', login, register, logout, updateUser }),
    [state, login, register, logout, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
