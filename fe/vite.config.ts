import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig, loadEnv, type Plugin } from 'vite'
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

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), seo(loadEnv(mode, process.cwd(), 'VITE_').VITE_SITE_URL), versionFile],
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
