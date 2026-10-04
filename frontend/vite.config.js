import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Backend lokal untuk proxy /api saat dev & preview (sama-origin: cookie refresh tanpa CORS).
  const apiTarget = env.VITE_DEV_API_TARGET || 'http://localhost:3009'
  const proxy = {
    '/api': { target: apiTarget, changeOrigin: true },
  }

  return {
    plugins: [react()],
    server: {
      // Harus sama dengan FRONTEND_URL di backend/.env (CORS). strictPort mencegah Vite
      // pindah diam-diam ke 5174 saat 5173 terpakai, yang membuat CORS gagal.
      port: 5173,
      strictPort: true,
      proxy,
    },
    preview: {
      port: 4173,
      proxy,
    },
  }
})
