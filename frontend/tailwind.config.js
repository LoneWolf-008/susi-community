/** @type {import('tailwindcss').Config} */
// Dipindahkan dari blok `tailwind.config` CDN di index.html (T4). Tailwind kini di-build
// lokal sehingga halaman tetap tampil tanpa internet.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        coral: '#FF5733',
      },
      fontFamily: {
        sans: ['Inter', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
