import type { Plugin } from 'vite'

/** Pages anyone may open without logging in: the only ones worth indexing. */
const PUBLIC_PAGES = ['/', '/login', '/register', '/live']
/** Pages behind login (or a game in progress): never indexed. */
const PRIVATE_PREFIXES = [
  '/home',
  '/assignments',
  '/history',
  '/leaderboard',
  '/play/',
  '/attempts/',
  '/exam/',
  '/live/play',
  '/teacher',
  '/admin',
]

/**
 * SEO for a single-page app (launch B3). The site's address is given at build
 * time (VITE_SITE_URL, see docs/deploy.md step 5) because the repo is public
 * and does not hold it:
 * - index.html: `__SITE_URL__` becomes the address (Open Graph needs absolute
 *   URLs); without it the share image stays relative and og:url is dropped.
 * - robots.txt: keeps crawlers out of private pages; sitemap.xml lists the
 *   public ones (only when the address is known).
 */
export function seo(siteUrl: string | undefined): Plugin {
  const base = (siteUrl ?? '').trim().replace(/\/+$/, '')
  return {
    name: 'enquiz-seo',
    transformIndexHtml(html) {
      if (base) return html.replaceAll('__SITE_URL__', base)
      return html.replace(/\s*<meta property="og:url"[^>]*>/, '').replaceAll('__SITE_URL__', '')
    },
    generateBundle() {
      const robots = [
        'User-agent: *',
        ...PRIVATE_PREFIXES.map((p) => `Disallow: ${p}`),
        ...(base ? ['', `Sitemap: ${base}/sitemap.xml`] : []),
        '',
      ].join('\n')
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots })
      if (!base) return
      const urls = PUBLIC_PAGES.map((p) => `  <url><loc>${base}${p}</loc></url>`).join('\n')
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
      })
    },
  }
}
