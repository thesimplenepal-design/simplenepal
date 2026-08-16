import type { MetadataRoute } from 'next'
import { SITE_URL as SITE } from '@/lib/site'
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/capture', '/rates/entry', '/prices/entry', '/api/'] },
      // Bulk crawlers that train on the data: we sell an API instead.
      // See /llms.txt for the licensing position.
      { userAgent: ['CCBot', 'ClaudeBot', 'GPTBot', 'Google-Extended', 'Bytespider'], disallow: '/' },
    ],
    sitemap: `${SITE}/sitemap.xml`,
  }
}
