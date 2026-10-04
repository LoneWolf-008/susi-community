import { createContext, useContext } from 'react';

export const AuthContext = createContext(null);

// Peran lama di UI ('agensusi') dinormalkan ke peran backend di satu tempat.
const ROLE_ALIASES = { agensusi: 'liaison' };
export const normalizeRole = (role) => ROLE_ALIASES[role] || role;
export const normalizeUser = (user) => (user ? { ...user, role: normalizeRole(user.role) } : null);

export const ROLE_LABELS = {
  requester: 'KOMUNITAS',
  talent: 'TALENTA',
  liaison: 'AGENSUSI',
  admin: 'ADMIN',
};

/**
 * @returns {{
 *   status: 'loading'|'authenticated'|'anonymous',
 *   user: object|null,
 *   isAuthenticated: boolean,
 *   login: (email: string, password: string) => Promise<object>,
 *   register: (payload: object) => Promise<object>,
 *   logout: () => Promise<void>,
 *   updateUser: (patch: object) => void,
 * }}
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider>');
  return ctx;
}
