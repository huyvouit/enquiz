/// <reference lib="webworker" />
/**
 * EnQuiz service worker (plan 6.3, D24). Built by vite-plugin-pwa
 * (injectManifest), which fills `self.__WB_MANIFEST` with the app files.
 *
 * - App shell (JS, CSS, HTML, icons): precached per build, so the app opens
 *   fast and offline; a new build waits until the user accepts the update
 *   (D25, src/app/pwa/UpdatePrompt.tsx).
 * - Question images and audio on Cloud Storage: CacheFirst, 300 files, 30
 *   days. Their names are content hashes, so a cached file never goes stale.
 * - API: never cached (no route matches /api), for correct data and privacy
 *   on shared tablets.
 */
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { clientsClaim, type WorkboxPlugin } from 'workbox-core'
import { ExpirationPlugin } from 'workbox-expiration'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { RangeRequestsPlugin } from 'workbox-range-requests'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'

declare const self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Every page of the SPA is index.html; API calls and the socket are not pages.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/api\//, /^\/socket\.io\//, /^\/version\.json$/],
  }),
)

const MEDIA = /^https:\/\/storage\.googleapis\.com\/[^/]+\/(images|audio)\//

/**
 * <img> and new Audio() ask in no-cors mode, and an opaque answer would cost
 * megabytes of quota each in Chrome. Ask in CORS mode instead, so only real
 * 200 responses are kept. If the bucket has no CORS rule (yet), load the file
 * the normal way, uncached.
 */
const corsUpgrade: WorkboxPlugin = {
  requestWillFetch: async ({ request }) => new Request(request.url, { mode: 'cors', credentials: 'omit' }),
  handlerDidError: async ({ request }) => fetch(request),
}

registerRoute(
  ({ url }) => MEDIA.test(url.href),
  new CacheFirst({
    cacheName: 'enquiz-media',
    plugins: [
      corsUpgrade,
      new CacheableResponsePlugin({ statuses: [200] }),
      // Audio elements ask for byte ranges: answer them from the cached file.
      new RangeRequestsPlugin(),
      new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 30 * 24 * 60 * 60, purgeOnQuotaError: true }),
    ],
  }),
)

// The update bar (D25) sends this when the user taps "Cập nhật".
self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') void self.skipWaiting()
})
// The very first install takes control at once; later ones wait for the user.
clientsClaim()
