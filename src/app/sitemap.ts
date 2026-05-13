import { MetadataRoute } from 'next'
import { createPublicClient } from '@/lib/supabase-public'
import { SITE_URL } from '@/lib/site-config'

// 1時間ごとに再生成（force-dynamicはクロール毎にDBクエリが走るため廃止）
export const revalidate = 3600

const BASE_URL = SITE_URL

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
    {
      url: `${BASE_URL}/summary`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
  ]

  try {
    const supabase = createPublicClient()
    const [threadsResult, categoriesResult, summariesResult] = await Promise.allSettled([
      supabase
        .from('threads')
        .select('id, last_posted_at')
        .eq('is_archived', false)
        .order('last_posted_at', { ascending: false })
        .limit(2000),
      supabase
        .from('categories')
        .select('slug')
        .order('sort_order'),
      supabase
        .from('summaries')
        .select('slug, created_at')
        .eq('published', true)
        .order('created_at', { ascending: false })
        .limit(100),
    ])

    const threads = threadsResult.status === 'fulfilled' ? (threadsResult.value.data ?? []) : []
    const categories = categoriesResult.status === 'fulfilled' ? (categoriesResult.value.data ?? []) : []
    const summaries = summariesResult.status === 'fulfilled' ? (summariesResult.value.data ?? []) : []

    const categoryPages: MetadataRoute.Sitemap = categories.map(cat => ({
      url: `${BASE_URL}/category/${cat.slug}`,
      lastModified: new Date(),
      changeFrequency: 'hourly' as const,
      priority: 0.9,
    }))

    const threadPages: MetadataRoute.Sitemap = threads.map(thread => ({
      url: `${BASE_URL}/thread/${thread.id}`,
      lastModified: thread.last_posted_at ? new Date(thread.last_posted_at) : new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }))

    const summaryPages: MetadataRoute.Sitemap = summaries.map(s => ({
      url: `${BASE_URL}/summary/${s.slug}`,
      lastModified: s.created_at ? new Date(s.created_at) : new Date(),
      changeFrequency: 'never' as const,
      priority: 0.5,
    }))

    return [...staticPages, ...categoryPages, ...threadPages, ...summaryPages]
  } catch {
    return staticPages
  }
}
