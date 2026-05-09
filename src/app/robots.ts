import type { MetadataRoute } from 'next'

const siteUrl = 'https://www.duema-bbs.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: 'Twitterbot',
        allow: ['/', '/api/og', '/api/og/', '/og/', '/og/thread/'],
      },
      {
        userAgent: '*',
        allow: ['/', '/api/og', '/api/og/', '/og/', '/og/thread/'],
        disallow: [
          '/admin/',
          '/api/',
          '/settings',
          '/favorites',
          '/unsubscribe/',
          '/thread/new',
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
