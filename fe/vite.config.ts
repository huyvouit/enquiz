import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { seo } from './seo.plugin.ts'

/**
 * Release shown in the footer (plan D21): the repo's VERSION file and the git
 * commit, unless scripts/release.sh already set VITE_APP_VERSION/VITE_GIT_COMMIT.
 * Vite exposes VITE_* variables of process.env as import.meta.env.
 */
function readVersion(): string {
  try {
    return readFileSync(new URL('../VERSION', import.meta.url), 'utf8').trim()
  } catch {
    return 'dev'
  }
}
function readCommit(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'unknown'
  }
}
process.env.VITE_APP_VERSION ||= readVersion()
process.env.VITE_GIT_COMMIT ||= readCommit()

/** dist/version.json: what the release script checks after promoting (D21). */
const versionFile: Plugin = {
  name: 'enquiz-version-file',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: `${JSON.stringify({ version: process.env.VITE_APP_VERSION, commit: process.env.VITE_GIT_COMMIT })}
`,
    })
  },
}

/**
 * Installable app + service worker (plan 6.3, D24) with an update prompt
 * (6.4, D25). The worker is our own sw/sw.ts (injectManifest), registered by
 * src/app/pwa/UpdatePrompt.tsx.
 */
const pwa = VitePWA({
  strategies: 'injectManifest',
  srcDir: 'sw',
  filename: 'sw.ts',
  registerType: 'prompt',
  injectRegister: false,
  manifest: {
    name: 'EnQuiz – Vừa học vừa chơi tiếng Anh',
    short_name: 'EnQuiz',
    description: 'Học tiếng Anh tiểu học qua trò chơi, bài tập và Đấu trường cho cả lớp.',
    lang: 'vi',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#fffbeb',
    theme_color: '#4f46e5',
    icons: [
      { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  injectManifest: {
    globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
    // Only for link previews; never needed by the app.
    globIgnores: ['og-image.png'],
  },
})

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), seo(loadEnv(mode, process.cwd(), 'VITE_').VITE_SITE_URL), versionFile, pwa],
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
