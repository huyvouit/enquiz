import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { seo } from './seo.plugin.ts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), seo(loadEnv(mode, process.cwd(), 'VITE_').VITE_SITE_URL)],
  // Resolves the "@/*" alias declared in tsconfig.app.json.
  resolve: { tsconfigPaths: true },
  server: {
    port: 5173,
    // In dev the frontend calls /api/... on its own origin and Vite forwards it,
    // so no CORS setup is needed locally.
    proxy: {
      '/api': 'http://localhost:3000',
      // Live quiz socket (plan 5): WebSocket upgrade forwarded to the API.
      '/socket.io': { target: 'http://localhost:3000', ws: true },
    },
  },
}))
