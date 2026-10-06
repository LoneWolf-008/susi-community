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
    build: {
      // Chunk peta MapLibre (MapView, ± 1,05 MB) memang besar dan hanya dimuat saat peta tampil;
      // batas dinaikkan untuk chunk itu agar peringatan tidak menyesatkan. Chunk lain jauh di bawahnya.
      chunkSizeWarningLimit: 1100,
      rolldownOptions: {
        output: {
          // Pustaka besar yang jarang berubah dipisah dari bundle utama (cache peramban tetap awet).
          codeSplitting: {
            groups: [
              { name: 'gsap', test: /node_modules[\\/]gsap[\\/]/ },
              { name: 'react-icons', test: /node_modules[\\/]react-icons[\\/]/ },
            ],
          },
        },
      },
    },
  }
})
