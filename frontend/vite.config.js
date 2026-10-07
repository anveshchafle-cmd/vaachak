import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// In dev, /api calls go to the live backend unless VITE_PROXY points elsewhere
// (e.g. VITE_PROXY=http://localhost:3000 when running `npm run dev` in the repo root).
const target = process.env.VITE_PROXY || 'https://vaachak-zeta.vercel.app';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    // The rule engine and camera helper live in the repo's lib/ folder, shared with the backend.
    fs: { allow: ['..'] },
    proxy: { '/api': { target, changeOrigin: true } },
  },
});
