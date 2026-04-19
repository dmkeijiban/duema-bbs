import { unstable_cache } from 'next/cache'
import { createPublicClient } from './supabase-public'
import { withFallbackThumbnails } from './thumbnail'

type ThreadRow = { id: number; title: string; image_url: string | null; post_count: number }

export const THREAD_PAGE_SIZE = 60

export const getCachedCategories = unstable_cache(
  async () => {
    const supabase = createPublicClient()
    const { data } = await supabase.from('categories').select('*').order('sort_order')
    return data ?? []
  },
  ['categories'],
  { revalidate: 300, tags: ['categories'] }
)

export const getCachedActiveNotices = unstable_cache(
  async () => {
    const supabase = createPublicClient()
    const { data } = await supabase
      .from('notices')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
    return data ?? []
  },
  ['notices-active'],
  { revalidate: 60, tags: ['notices'] }
)

export const getCachedThreadNotices = unstable_cache(
  async () => {
    const supabase = createPublicClient()
    const { data } = await supabase
      .from('notices')
      .select('*')
      .eq('is_active', true)
      .eq('show_in_thread', true)
      .order('sort_order')
    return data ?? []
  },
  ['notices-thread'],
  { revalidate: 60, tags: ['notices'] }
)

export const getCachedSetting = unstable_cache(
  async (key: string, fallback = '') => {
    const supabase = createPublicClient()
    const { data } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', key)
      .single()
    return data?.value ?? fallback
  },
  ['setting'],
  { revalidate: 300, tags: ['settings'] }
)

export const getCachedTopThreads = unstable_cache(
  async () => {
    const supabase = createPublicClient()
    const { data: raw } = await supabase
      .from('threads')
      .select('id, title, image_url, post_count')
      .eq('is_archived', false)
      .order('post_count', { ascending: false })
      .limit(20)
    if (!raw || raw.length === 0) return []
    return withFallbackThumbnails(supabase, raw as ThreadRow[])
  },
  ['top-threads'],
  { revalidate: 300, tags: ['threads'] }
)

const THREAD_POSTS_PER_PAGE = 50

export const getCachedThread = (threadId: number) =>
  unstable_cache(
    async () => {
      const supabase = createPublicClient()
      const { data } = await supabase
        .from('threads')
        .select('id, title, body, author_name, image_url, view_count, post_count, is_archived, created_at, last_posted_at, session_id, category_id, categories(id,name,slug,color,description,sort_order)')
        .eq('id', threadId)
        .single()
      return data
    },
    [`thread-${threadId}`],
    { revalidate: 30, tags: [`thread-${threadId}`, 'threads'] }
  )()

export const getCachedThreadPosts = (threadId: number, page: number) =>
  unstable_cache(
    async () => {
      const supabase = createPublicClient()
      const offset = (page - 1) * THREAD_POSTS_PER_PAGE
      const { data, count } = await supabase
        .from('posts')
        .select('id, thread_id, post_number, body, author_name, image_url, created_at', { count: 'exact' })
        .eq('thread_id', threadId)
        .order('post_number', { ascending: true })
        .range(offset, offset + THREAD_POSTS_PER_PAGE - 1)
      return { data: data ?? [], count: count ?? 0 }
    },
    [`thread-posts-${threadId}-p${page}`],
    { revalidate: 30, tags: [`thread-${threadId}`, 'threads'] }
  )()

export { THREAD_POSTS_PER_PAGE }

export interface CachedThreadListResult {
  threads: unknown[]
  count: number
  totalPages: number
}

// 標準クエリ（検索・ランダム以外）をキャッシュ。
// キャッシュキーにsort/page/categoryId/isArchivedを含めて一意に管理。
export function getCachedThreadList(
  sort: string,
  page: number,
  categoryId: number | null,
  isArchived: boolean
): Promise<CachedThreadListResult> {
  const cacheKey = `tl-${sort}-p${page}-c${String(categoryId)}-a${String(isArchived)}`
  return unstable_cache(
    async () => {
      const supabase = createPublicClient()
      const offset = (page - 1) * THREAD_PAGE_SIZE

      let countQuery = supabase
        .from('threads')
        .select('id', { count: 'exact', head: true })
        .eq('is_archived', isArchived)
      let dataQuery = supabase
        .from('threads')
        .select('id, title, image_url, post_count, is_archived, created_at, last_posted_at, category_id, categories(id,name,slug,color)')
        .eq('is_archived', isArchived)

      if (categoryId !== null) {
        countQuery = countQuery.eq('category_id', categoryId)
        dataQuery = dataQuery.eq('category_id', categoryId)
      }

      if (sort === 'popular') {
        dataQuery = dataQuery.order('post_count', { ascending: false })
      } else if (sort === 'new') {
        dataQuery = dataQuery.order('created_at', { ascending: false })
      } else {
        dataQuery = dataQuery.order('last_posted_at', { ascending: false })
      }

      dataQuery = dataQuery.range(offset, offset + THREAD_PAGE_SIZE - 1)

      const [{ count }, { data: raw }] = await Promise.all([countQuery, dataQuery])
      const threads = raw ? await withFallbackThumbnails(supabase, raw as ThreadRow[]) : []

      return {
        threads,
        count: count ?? 0,
        totalPages: Math.max(1, Math.ceil((count ?? 0) / THREAD_PAGE_SIZE)),
      }
    },
    [cacheKey],
    { revalidate: 60, tags: ['threads'] }
  )()
}
