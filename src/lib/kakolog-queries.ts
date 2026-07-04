import { createPublicClient } from '@/lib/supabase-public'
import { withFallbackThumbnails } from '@/lib/thumbnail'
import { Category, Thread } from '@/types'
import {
  filterPublicVisibleUserContent,
  getCachedPublicHiddenUserIds,
  getPublicVisibleUserContentOrFilter,
} from '@/lib/public-visibility'
import {
  applyKakologThreadFilter,
  applyLegacyKakologThreadFilter,
  isArchiveSchemaMissing,
} from '@/lib/thread-archive'

export type KakologThread = Thread & { categories: Category | null }
export type KakologIndexThread = Pick<Thread, 'id' | 'user_id' | 'created_at' | 'category_id'> & {
  categories: Pick<Category, 'name' | 'slug'> | null
}

type KakologOptions = {
  startIso?: string
  endIso?: string
  categoryIds?: number[]
  limit?: number
  offset?: number
}

export async function getKakologThreads({
  startIso,
  endIso,
  categoryIds = [],
  limit = 120,
  offset = 0,
}: KakologOptions = {}): Promise<KakologThread[]> {
  const supabase = createPublicClient()
  const hiddenUserIds = await getCachedPublicHiddenUserIds()
  const publicUserFilter = getPublicVisibleUserContentOrFilter(hiddenUserIds)

  let query = supabase
    .from('threads')
    .select('id, title, user_id, image_url, thumbnail_url, post_count, is_archived, auto_lock_exempt, archived_at, created_at, last_posted_at, category_id, categories(id,name,slug,color)')
  query = applyKakologThreadFilter(query)
  if (publicUserFilter) query = query.or(publicUserFilter)
  if (startIso) query = query.gte('created_at', startIso)
  if (endIso) query = query.lt('created_at', endIso)
  if (categoryIds.length === 1) query = query.eq('category_id', categoryIds[0])
  if (categoryIds.length > 1) query = query.in('category_id', categoryIds)

  const result = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  let raw = result.data as unknown[] | null
  const error = result.error

  if (isArchiveSchemaMissing(error)) {
    let retry = applyLegacyKakologThreadFilter(supabase
      .from('threads')
      .select('id, title, user_id, image_url, thumbnail_url, post_count, is_archived, created_at, last_posted_at, category_id, categories(id,name,slug,color)')
    )
    if (publicUserFilter) retry = retry.or(publicUserFilter)
    if (startIso) retry = retry.gte('created_at', startIso)
    if (endIso) retry = retry.lt('created_at', endIso)
    if (categoryIds.length === 1) retry = retry.eq('category_id', categoryIds[0])
    if (categoryIds.length > 1) retry = retry.in('category_id', categoryIds)
    const retryResult = await retry
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    raw = retryResult.data as unknown[] | null
  }

  const visible = filterPublicVisibleUserContent((raw ?? []) as unknown as Thread[], hiddenUserIds)
  return withFallbackThumbnails(supabase, visible) as unknown as Promise<KakologThread[]>
}

export async function getKakologThreadCount({
  startIso,
  endIso,
  categoryIds = [],
}: Omit<KakologOptions, 'limit' | 'offset'> = {}): Promise<number> {
  const supabase = createPublicClient()
  const hiddenUserIds = await getCachedPublicHiddenUserIds()
  const publicUserFilter = getPublicVisibleUserContentOrFilter(hiddenUserIds)

  let query = supabase
    .from('threads')
    .select('id', { count: 'exact', head: true })
  query = applyKakologThreadFilter(query)
  if (publicUserFilter) query = query.or(publicUserFilter)
  if (startIso) query = query.gte('created_at', startIso)
  if (endIso) query = query.lt('created_at', endIso)
  if (categoryIds.length === 1) query = query.eq('category_id', categoryIds[0])
  if (categoryIds.length > 1) query = query.in('category_id', categoryIds)

  const result = await query
  if (!isArchiveSchemaMissing(result.error)) return result.count ?? 0

  let retry = applyLegacyKakologThreadFilter(supabase
    .from('threads')
    .select('id', { count: 'exact', head: true })
  )
  if (publicUserFilter) retry = retry.or(publicUserFilter)
  if (startIso) retry = retry.gte('created_at', startIso)
  if (endIso) retry = retry.lt('created_at', endIso)
  if (categoryIds.length === 1) retry = retry.eq('category_id', categoryIds[0])
  if (categoryIds.length > 1) retry = retry.in('category_id', categoryIds)

  const retryResult = await retry
  return retryResult.count ?? 0
}

export async function getKakologIndexThreads(): Promise<KakologIndexThread[]> {
  const supabase = createPublicClient()
  const hiddenUserIds = await getCachedPublicHiddenUserIds()
  const publicUserFilter = getPublicVisibleUserContentOrFilter(hiddenUserIds)
  const pageSize = 1000
  const rows: KakologIndexThread[] = []
  let offset = 0
  let useLegacyFilter = false

  while (true) {
    let query = supabase
      .from('threads')
      .select('id, user_id, created_at, category_id, categories(name,slug)')
    query = useLegacyFilter ? applyLegacyKakologThreadFilter(query) : applyKakologThreadFilter(query)
    if (publicUserFilter) query = query.or(publicUserFilter)

    const result = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (!useLegacyFilter && isArchiveSchemaMissing(result.error)) {
      rows.length = 0
      offset = 0
      useLegacyFilter = true
      continue
    }

    if (result.error) {
      console.warn('kakolog index fetch failed:', result.error.message)
      break
    }

    const visible = filterPublicVisibleUserContent(
      (result.data ?? []) as unknown as KakologIndexThread[],
      hiddenUserIds
    )
    rows.push(...visible)

    if ((result.data?.length ?? 0) < pageSize) break
    offset += pageSize
  }

  return rows
}

export function getJstDateRange(date: string) {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const utc = Date.UTC(year, month - 1, day)
  const check = new Date(utc)
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null
  }
  const start = new Date(utc - 9 * 60 * 60 * 1000)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  }
}

export function getJstMonthRange(month: string) {
  const match = month.match(/^(\d{4})-(\d{2})$/)
  if (!match) return null
  const year = Number(match[1])
  const monthNumber = Number(match[2])
  if (monthNumber < 1 || monthNumber > 12) return null

  const start = new Date(Date.UTC(year, monthNumber - 1, 1) - 9 * 60 * 60 * 1000)
  const end = new Date(Date.UTC(year, monthNumber, 1) - 9 * 60 * 60 * 1000)
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  }
}

export function formatJstDateLabel(date: string) {
  const range = getJstDateRange(date)
  if (!range) return date
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(range.startIso))
}

export function formatJstMonthLabel(month: string) {
  const range = getJstMonthRange(month)
  if (!range) return month
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'long',
  }).format(new Date(range.startIso))
}

export function toJstDateKey(value: string) {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value))
  const y = parts.find(part => part.type === 'year')?.value
  const m = parts.find(part => part.type === 'month')?.value
  const d = parts.find(part => part.type === 'day')?.value
  return y && m && d ? `${y}-${m}-${d}` : value.slice(0, 10)
}

export function toJstMonthKey(value: string) {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date(value))
  const y = parts.find(part => part.type === 'year')?.value
  const m = parts.find(part => part.type === 'month')?.value
  return y && m ? `${y}-${m}` : value.slice(0, 7)
}
