import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site-config'

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
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
