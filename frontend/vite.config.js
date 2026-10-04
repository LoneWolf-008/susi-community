import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Harus sama dengan FRONTEND_URL di backend/.env (CORS). strictPort mencegah Vite
    // pindah diam-diam ke 5174 saat 5173 terpakai, yang membuat CORS gagal.
    port: 5173,
    strictPort: true,
  },
})
