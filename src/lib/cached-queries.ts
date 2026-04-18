import { unstable_cache } from 'next/cache'
import { createPublicClient } from './supabase-public'
import { withFallbackThumbnails } from './thumbnail'

type ThreadRow = { id: number; title: string; image_url: string | null; post_count: number }

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
