import { MetadataRoute } from 'next'
import { getConsolidatedCategoryBySlug } from '@/lib/categories'
import { createPublicClient } from '@/lib/supabase-public'
import {
  applyKakologThreadFilter,
  applyLegacyKakologThreadFilter,
  isArchiveSchemaMissing,
} from '@/lib/thread-archive'
import { SITE_URL } from '@/lib/site-config'

export const revalidate = 3600

const BASE_URL = SITE_URL
const POSTS_PER_PAGE = 100
const KAKOLOG_SITEMAP_LIMIT = 1000

type KakologSitemapThread = {
  created_at: string | null
  last_posted_at: string | null
  category_id: number | null
}

function toJstDateKey(value: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value))
  const map = new Map(parts.map(part => [part.type, part.value]))
  return `${map.get('year')}-${map.get('month')}-${map.get('day')}`
}

async function fetchKakologSitemapThreads(
  supabase: ReturnType<typeof createPublicClient>
): Promise<KakologSitemapThread[]> {
  const selectColumns = 'created_at, last_posted_at, category_id'
  const query = applyKakologThreadFilter(
    supabase.from('threads').select(selectColumns)
  )

  const result = await query
    .order('created_at', { ascending: false })
    .limit(KAKOLOG_SITEMAP_LIMIT)

  if (isArchiveSchemaMissing(result.error)) {
    const fallbackQuery = applyLegacyKakologThreadFilter(
      supabase.from('threads').select(selectColumns)
    )
    const fallbackResult = await fallbackQuery
      .order('created_at', { ascending: false })
      .limit(KAKOLOG_SITEMAP_LIMIT)
    return (fallbackResult.data ?? []) as KakologSitemapThread[]
  }

  if (result.error) return []
  return (result.data ?? []) as KakologSitemapThread[]
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'hourly', priority: 1.0 },
    { url: `${BASE_URL}/guide`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/terms`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE_URL}/privacy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE_URL}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE_URL}/ranking`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.6 },
    { url: `${BASE_URL}/update`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.7 },
    { url: `${BASE_URL}/new`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.7 },
    { url: `${BASE_URL}/summary`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE_URL}/kakolog`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.6 },
    { url: `${BASE_URL}/random`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.5 },
    { url: `${BASE_URL}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE_URL}/zukan`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/zukan/dm-01`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/zukan/card/bolshack-dragon`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
  ]

  try {
    const supabase = createPublicClient()
    const [threadsResult, categoriesResult, summariesResult, fixedPagesResult, kakologThreadsResult] = await Promise.allSettled([
      supabase.from('threads').select('id, last_posted_at, post_count, view_count, category_id').eq('is_archived', false).order('last_posted_at', { ascending: false }).limit(5000),
      supabase.from('categories').select('id, slug').order('sort_order'),
      supabase.from('summaries').select('slug, created_at').eq('published', true).order('created_at', { ascending: false }).limit(100),
      supabase.from('fixed_pages').select('slug').eq('is_published', true).order('sort_order'),
      fetchKakologSitemapThreads(supabase),
    ])

    const threads = threadsResult.status === 'fulfilled' ? (threadsResult.value.data ?? []) : []
    const categories = categoriesResult.status === 'fulfilled' ? (categoriesResult.value.data ?? []) : []
    const summaries = summariesResult.status === 'fulfilled' ? (summariesResult.value.data ?? []) : []
    const fixedPages = fixedPagesResult.status === 'fulfilled' ? (fixedPagesResult.value.data ?? []) : []
    const kakologThreads = kakologThreadsResult.status === 'fulfilled' ? kakologThreadsResult.value : []
    const staticSlugs = new Set(['terms', 'privacy', 'contact', 'guide', 'settings'])

    const categoryLastPosted = new Map<number, Date>()
    for (const thread of threads) {
      if (thread.category_id == null || !thread.last_posted_at) continue
      const date = new Date(thread.last_posted_at)
      const existing = categoryLastPosted.get(thread.category_id)
      if (!existing || date > existing) categoryLastPosted.set(thread.category_id, date)
    }

    const categoryPages: MetadataRoute.Sitemap = categories.map(category => ({
      url: `${BASE_URL}/category/${category.slug}`,
      lastModified: categoryLastPosted.get(category.id) ?? new Date(),
      changeFrequency: 'hourly' as const,
      priority: 0.9,
    }))

    const rawCategoryById = new Map(categories.map(category => [category.id, category]))
    const kakologDateLastPosted = new Map<string, Date>()
    const kakologCategoryLastPosted = new Map<string, Date>()
    for (const thread of kakologThreads) {
      if (!thread.created_at) continue
      const lastModified = thread.last_posted_at ? new Date(thread.last_posted_at) : new Date(thread.created_at)
      const dateKey = toJstDateKey(thread.created_at)
      const existingDate = kakologDateLastPosted.get(dateKey)
      if (!existingDate || lastModified > existingDate) kakologDateLastPosted.set(dateKey, lastModified)

      if (thread.category_id == null) continue
      const rawCategory = rawCategoryById.get(thread.category_id)
      if (!rawCategory) continue
      const slug = getConsolidatedCategoryBySlug(rawCategory.slug)?.slug ?? rawCategory.slug
      const existingCategory = kakologCategoryLastPosted.get(slug)
      if (!existingCategory || lastModified > existingCategory) kakologCategoryLastPosted.set(slug, lastModified)
    }

    const kakologDatePages: MetadataRoute.Sitemap = Array.from(kakologDateLastPosted, ([date, lastModified]) => ({
      url: `${BASE_URL}/kakolog/${date}`,
      lastModified,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    }))

    const kakologCategorySlugs = Array.from(new Set(
      categories.map(category => getConsolidatedCategoryBySlug(category.slug)?.slug ?? category.slug)
    ))
    const kakologCategoryPages: MetadataRoute.Sitemap = kakologCategorySlugs.map(slug => ({
      url: `${BASE_URL}/kakolog/category/${slug}`,
      lastModified: kakologCategoryLastPosted.get(slug) ?? new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    }))

    const now = Date.now()
    const threadPages: MetadataRoute.Sitemap = threads.map(thread => {
      const count = thread.post_count ?? 0
      const views = thread.view_count ?? 0
      let priority = count >= 50 ? 0.9 : count >= 20 ? 0.85 : count >= 10 ? 0.8 : count >= 3 ? 0.7 : 0.5
      if (views >= 500) priority = Math.min(0.95, priority + 0.05)
      else if (views >= 100) priority = Math.min(0.95, priority + 0.03)
      const lastPosted = thread.last_posted_at ? new Date(thread.last_posted_at).getTime() : 0
      if (now - lastPosted < 3 * 86400 * 1000) priority = Math.min(0.95, priority + 0.02)
      return {
        url: `${BASE_URL}/thread/${thread.id}`,
        lastModified: thread.last_posted_at ? new Date(thread.last_posted_at) : new Date(),
        changeFrequency: 'daily' as const,
        priority: Math.round(priority * 100) / 100,
      }
    })

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
          priority: basePriority - 0.1,
        })
      }
    }

    const summaryPages: MetadataRoute.Sitemap = summaries.map(summary => ({
      url: `${BASE_URL}/summary/${summary.slug}`,
      lastModified: summary.created_at ? new Date(summary.created_at) : new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }))

    const fixedPageEntries: MetadataRoute.Sitemap = fixedPages
      .filter(page => !staticSlugs.has(page.slug))
      .map(page => ({
        url: `${BASE_URL}/${page.slug}`,
        lastModified: new Date(),
        changeFrequency: 'monthly' as const,
        priority: 0.5,
      }))

    return [...staticPages, ...fixedPageEntries, ...categoryPages, ...kakologDatePages, ...kakologCategoryPages, ...threadPages, ...paginatedThreadPages, ...summaryPages]
  } catch {
    return staticPages
  }
}
