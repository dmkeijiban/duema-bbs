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
      url: `${BASE_URL}/update`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/new`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/summary`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/random`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
  ]

  try {
    const supabase = createPublicClient()
    const [threadsResult, categoriesResult, summariesResult, fixedPagesResult] = await Promise.allSettled([
      supabase
        .from('threads')
        .select('id, last_posted_at, post_count, view_count, category_id')
        .eq('is_archived', false)
        .order('last_posted_at', { ascending: false })
        .limit(5000),
      supabase
        .from('categories')
        .select('id, slug')
        .order('sort_order'),
      supabase
        .from('summaries')
        .select('slug, created_at')
        .eq('published', true)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('fixed_pages')
        .select('slug')
        .eq('is_published', true)
        .order('sort_order'),
    ])

    const threads = threadsResult.status === 'fulfilled' ? (threadsResult.value.data ?? []) : []
    const categories = categoriesResult.status === 'fulfilled' ? (categoriesResult.value.data ?? []) : []
    const summaries = summariesResult.status === 'fulfilled' ? (summariesResult.value.data ?? []) : []
    const fixedPages = fixedPagesResult.status === 'fulfilled' ? (fixedPagesResult.value.data ?? []) : []

    // 静的ページと重複するスラッグは除外（terms, privacy, contact, guide など）
    const staticSlugs = new Set(['terms', 'privacy', 'contact', 'guide', 'settings'])

    // カテゴリごとの最終投稿日時マップを構築（正確な lastModified のため）
    const categoryLastPosted = new Map<number, Date>()
    for (const t of threads) {
      if (t.category_id == null) continue
      const existing = categoryLastPosted.get(t.category_id)
      const date = t.last_posted_at ? new Date(t.last_posted_at) : null
      if (date && (!existing || date > existing)) {
        categoryLastPosted.set(t.category_id, date)
      }
    }

    const categoryPages: MetadataRoute.Sitemap = categories.map(cat => ({
      url: `${BASE_URL}/category/${cat.slug}`,
      lastModified: categoryLastPosted.get(cat.id) ?? new Date(),
      changeFrequency: 'hourly' as const,
      priority: 0.9,
    }))

    const POSTS_PER_PAGE = 50
    const now = Date.now()
    const threadPages: MetadataRoute.Sitemap = threads.map(thread => {
      const count = thread.post_count ?? 0
      const views = thread.view_count ?? 0
      let priority = count >= 50 ? 0.9 : count >= 20 ? 0.85 : count >= 10 ? 0.8 : count >= 3 ? 0.7 : 0.5
      // view_count bonus
      if (views >= 500) priority = Math.min(0.95, priority + 0.05)
      else if (views >= 100) priority = Math.min(0.95, priority + 0.03)
      // recency bonus: active within 3 days
      const lastPosted = thread.last_posted_at ? new Date(thread.last_posted_at).getTime() : 0
      if (now - lastPosted < 3 * 86400 * 1000) priority = Math.min(0.95, priority + 0.02)
      return {
        url: `${BASE_URL}/thread/${thread.id}`,
        lastModified: thread.last_posted_at ? new Date(thread.last_posted_at) : new Date(),
        changeFrequency: 'daily' as const,
        priority: Math.round(priority * 100) / 100,
      }
    })

    // Paginated thread pages (p2, p3) for threads with enough posts.
    // These need their own sitemap entries so Googlebot discovers and indexes
    // unique per-page content (each page is ISR pre-rendered with its own canonical).
    const paginatedThreadPages: MetadataRoute.Sitemap = []
    for (const thread of threads) {
      const count = thread.post_count ?? 0
      if (count <= POSTS_PER_PAGE) continue
      const totalPages = Math.ceil(count / POSTS_PER_PAGE)
      const basePriority = count >= 50 ? 0.8 : 0.7
      for (let p = 2; p <= Math.min(totalPages, 10); p++) {
        paginatedThreadPages.push({
          url: `${BASE_URL}/thread/${thread.id}/p/${p}`,
          lastModified: thread.last_posted_at ? new Date(thread.last_posted_at) : new Date(),
          changeFrequency: 'daily' as const,
          priority: basePriority - 0.1, // slightly lower than page 1
        })
      }
    }

    const summaryPages: MetadataRoute.Sitemap = summaries.map(s => ({
      url: `${BASE_URL}/summary/${s.slug}`,
      lastModified: s.created_at ? new Date(s.created_at) : new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }))

    const fixedPageEntries: MetadataRoute.Sitemap = fixedPages
      .filter(p => !staticSlugs.has(p.slug))
      .map(p => ({
        url: `${BASE_URL}/${p.slug}`,
        lastModified: new Date(),
        changeFrequency: 'monthly' as const,
        priority: 0.5,
      }))

    return [...staticPages, ...fixedPageEntries, ...categoryPages, ...threadPages, ...paginatedThreadPages, ...summaryPages]
  } catch {
    return staticPages
  }
}
