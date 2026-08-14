import type { MetadataRoute } from 'next'
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/capture', '/api/'] },
      // Bulk crawlers that train on the data: we sell an API instead.
      // See /llms.txt for the licensing position.
      { userAgent: ['CCBot', 'ClaudeBot', 'GPTBot', 'Google-Extended', 'Bytespider'], disallow: '/' },
    ],
    sitemap: `${SITE}/sitemap.xml`,
  }
}
