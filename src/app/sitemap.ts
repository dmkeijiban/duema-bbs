import { MetadataRoute } from 'next'
import { createPublicClient } from '@/lib/supabase-public'

const BASE_URL = 'https://duema-bbs.vercel.app'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/guide`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${BASE_URL}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${BASE_URL}/ranking`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.6,
    },
  ]

  try {
    const supabase = createPublicClient()
    const { data: threads } = await supabase
      .from('threads')
      .select('id, last_posted_at')
      .eq('is_archived', false)
      .order('last_posted_at', { ascending: false })
      .limit(5000)

    const threadPages: MetadataRoute.Sitemap = (threads ?? []).map(thread => ({
      url: `${BASE_URL}/thread/${thread.id}`,
      lastModified: thread.last_posted_at ? new Date(thread.last_posted_at) : new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }))

    return [...staticPages, ...threadPages]
  } catch {
    return staticPages
  }
}
