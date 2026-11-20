import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Resolves the "@/*" alias declared in tsconfig.app.json.
  resolve: { tsconfigPaths: true },
  server: {
    port: 5173,
    // In dev the frontend calls /api/... on its own origin and Vite forwards it,
    // so no CORS setup is needed locally.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
