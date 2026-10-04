import { createContext, useContext } from 'react';

export const ToastContext = createContext(null);

/**
 * @returns {{
 *   show: (message: string, options?: { tone?: 'success'|'error'|'info', duration?: number }) => void,
 *   success: (message: string) => void,
 *   error: (message: string) => void,
 * }}
 */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast harus dipakai di dalam <ToastProvider>');
  return ctx;
}
