import { unstable_cache } from 'next/cache'
import { createPublicClient } from './supabase-public'
import { createAdminClient } from './supabase-admin'
import { withFallbackThumbnails } from './thumbnail'
import {
  applyActiveThreadFilter,
  applyKakologThreadFilter,
  applyLegacyActiveThreadFilter,
  applyLegacyKakologThreadFilter,
  isArchiveSchemaMissing,
} from './thread-archive'
import {
  USER_RANKING_CARD_RATING_POINT,
  USER_RANKING_CARD_REVIEW_POINT,
  USER_RANKING_PACK_REVIEW_POINT,
  USER_RANKING_POST_POINT,
  USER_RANKING_THREAD_POINT,
} from './ranking-points'
import {
  fetchCampaignSettings,
  fetchCampaignRankingPublic,
  resolveCampaignState,
  getJstTodayCutoffUtcIso,
  type CampaignSettings,
  type CampaignRankingPublicResult,
} from './campaign-ranking'
import { normalizeTopShowcaseMode, type TopShowcaseMode } from './top-showcase'
import type { NavPage, FixedPage } from '@/types/fixed-pages'
import { parseBlocks } from '@/types/fixed-pages'
import type { PublicAuthorProfile } from '@/types'
import { seededShuffle } from './stable-shuffle'
import {
  filterPublicVisibleUserContent,
  getCachedPublicHiddenUserIds,
  getPublicVisibleUserContentOrFilter,
} from './public-visibility'

export type { NavPage, FixedPage }

export const DEFAULT_PUBLIC_AUTHOR_NAME = '名無しのデュエリスト'

const STANDARD_CACHE_SECONDS = 3600
const NOTICE_CACHE_SECONDS = 1800
const THREAD_CACHE_SECONDS = 21600

export const THREAD_PAGE_SIZE = 60
export const POPULAR_PAGE_SIZE = 100
const THREAD_POSTS_PER_PAGE = 100
export { THREAD_POSTS_PER_PAGE }

export const getCachedNavPages = unstable_cache(
  async (): Promise<NavPage[]> => {
    try {
      const supabase = createPublicClient()
      const { data } = await supabase
        .from('fixed_pages')
        .select('id, title, slug, nav_label, sort_order, external_url, is_published, show_in_nav')
        .order('sort_order')
      return (data ?? []) as NavPage[]
    } catch {
      return []
    }
  },
  ['nav-pages'],
  { revalidate: STANDARD_CACHE_SECONDS, tags: ['fixed_pages'] }
)

export const getCachedFixedPage = (slug: string): Promise<FixedPage | null> =>
  unstable_cache(
    async () => {
      try {
        const supabase = createPublicClient()
        const { data } = await supabase
          .from('fixed_pages')
          .select('*')
          .eq('slug', slug)
          .eq('is_published', true)
          .single()
        if (!data) return null
        return { ...data, content: parseBlocks(data.content) } as FixedPage
      } catch {
        return null
      }
    },
    [`fixed-page-${slug}`],
    { revalidate: STANDARD_CACHE_SECONDS, tags: ['fixed_pages', `fixed-page-${slug}`] }
  )()

export const getCachedCategories = unstable_cache(
  async () => {
    try {
      const supabase = createPublicClient()
      const { data } = await supabase.from('categories').select('*').order('sort_order')
      return data ?? []
    } catch (error) {
      console.warn('categories fetch failed:', error)
      return []
    }
  },
  ['categories'],
  { revalidate: STANDARD_CACHE_SECONDS, tags: ['categories'] }
)

export const getCachedActiveNotices = unstable_cache(
  async () => {
    try {
      const supabase = createPublicClient()
      const { data } = await supabase
        .from('notices')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
      return data ?? []
    } catch (error) {
      console.warn('active notices fetch failed:', error)
      return []
    }
  },
  ['notices-active'],
  { revalidate: NOTICE_CACHE_SECONDS, tags: ['notices'] }
)

export const getCachedThreadNotices = unstable_cache(
  async () => {
    try {
      const supabase = createPublicClient()
      const { data } = await supabase
        .from('notices')
        .select('*')
        .eq('is_active', true)
        .eq('show_in_thread', true)
        .order('sort_order')
      return data ?? []
    } catch (error) {
      console.warn('thread notices fetch failed:', error)
      return []
    }
  },
  ['notices-thread'],
  { revalidate: NOTICE_CACHE_SECONDS, tags: ['notices'] }
)

export const getCachedSetting = unstable_cache(
  async (key: string, fallback = '') => {
    try {
      const supabase = createPublicClient()
      const { data } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', key)
        .single()
      return data?.value ?? fallback
    } catch (error) {
      console.warn(`setting fetch failed for ${key}:`, error)
      return fallback
    }
  },
  ['setting'],
  { revalidate: STANDARD_CACHE_SECONDS, tags: ['settings'] }
)

// 称号機能のON/OFF。管理画面のトグルが即反映されるよう、他の一般設定より
// 短いrevalidateと専用タグ（honor-title-enabled）を使う。
// トグル操作は src/app/actions/honor-title.ts の toggleHonorTitleEnabled から。
export const getCachedHonorTitleEnabled = unstable_cache(
  async (): Promise<boolean> => {
    try {
      const supabase = createPublicClient()
      const { data } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'honor_title_enabled')
        .maybeSingle()
      return data?.value === 'true'
    } catch (error) {
      console.warn('honor title enabled flag fetch failed:', error)
      return false
    }
  },
  ['honor-title-enabled-v1'],
  { revalidate: 60, tags: ['honor-title-enabled'] }
)

export type PostGuidanceSettings = {
  showThreadFormHint: boolean
  showAfterCommentThreadPrompt: boolean
  showCommentFormHint: boolean
}

const POST_GUIDANCE_KEYS = [
  'show_thread_form_hint',
  'show_after_comment_thread_prompt',
  'show_comment_form_hint',
] as const

// スレッド投稿フォーム・コメント投稿後・コメント投稿フォームの案内文
// ON/OFF設定。honor_title_enabledと同様、管理画面のトグルが即反映される
// よう専用タグ（post-guidance-settings）を使う。行が無いキーはON扱い
// （既存表示を初期値ONのまま維持するため）。
// トグル操作は src/app/actions/post-guidance.ts から。
export const getCachedPostGuidanceSettings = unstable_cache(
  async (): Promise<PostGuidanceSettings> => {
    try {
      const supabase = createPublicClient()
      const { data } = await supabase
        .from('site_settings')
        .select('key, value')
        .in('key', POST_GUIDANCE_KEYS)
      const map = Object.fromEntries((data ?? []).map(row => [row.key, row.value]))
      return {
        showThreadFormHint: map.show_thread_form_hint !== 'false',
        showAfterCommentThreadPrompt: map.show_after_comment_thread_prompt !== 'false',
        showCommentFormHint: map.show_comment_form_hint !== 'false',
      }
    } catch (error) {
      console.warn('post guidance settings fetch failed:', error)
      return { showThreadFormHint: true, showAfterCommentThreadPrompt: true, showCommentFormHint: true }
    }
  },
  ['post-guidance-settings-v1'],
  { revalidate: 60, tags: ['post-guidance-settings'] }
)

export type HonorPointsMap = Record<string, number>

// 称号用の累計ポイント一括取得（任意のuserId群）。ランキングの日次上限や
// 直近100件プロフィール制限は適用しない、純粋な全期間累計。
// ポイント単価は既存ランキング計算（ranking-points.ts）をそのまま流用する。
export function getCachedHonorPointsMap(userIds: string[]): Promise<HonorPointsMap> {
  const ids = Array.from(new Set(userIds.filter(Boolean))).sort()
  if (ids.length === 0) return Promise.resolve({})
  const key = ids.join(',')

  return unstable_cache(
    async (): Promise<HonorPointsMap> => {
      try {
        const supabase = createAdminClient()
        const [threads, posts, cardRatings, cardReviews, packReviews] = await Promise.all([
          supabase.from('threads').select('user_id').in('user_id', ids).eq('is_archived', false).limit(USER_RANKING_FETCH_LIMIT),
          supabase.from('posts').select('user_id, threads!inner(is_archived)').in('user_id', ids).eq('is_deleted', false).eq('threads.is_archived', false).limit(USER_RANKING_FETCH_LIMIT),
          supabase.from('zukan_card_ratings').select('user_id').in('user_id', ids).eq('is_deleted', false).limit(USER_RANKING_FETCH_LIMIT),
          supabase.from('zukan_card_reviews').select('user_id').in('user_id', ids).eq('is_deleted', false).eq('is_hidden', false).limit(USER_RANKING_FETCH_LIMIT),
          supabase.from('zukan_pack_reviews').select('user_id').in('user_id', ids).eq('is_deleted', false).eq('is_hidden', false).limit(USER_RANKING_FETCH_LIMIT),
        ])

        const totals = new Map<string, number>()
        const add = (rows: Array<{ user_id: string | null }> | null, pts: number) => {
          for (const row of rows ?? []) {
            if (!row.user_id) continue
            totals.set(row.user_id, (totals.get(row.user_id) ?? 0) + pts)
          }
        }
        add(threads.data, USER_RANKING_THREAD_POINT)
        add(posts.data, USER_RANKING_POST_POINT)
        add(cardRatings.data, USER_RANKING_CARD_RATING_POINT)
        add(cardReviews.data, USER_RANKING_CARD_REVIEW_POINT)
        add(packReviews.data, USER_RANKING_PACK_REVIEW_POINT)

        return Object.fromEntries(totals)
      } catch (error) {
        console.warn('honor points map fetch failed:', error)
        return {}
      }
    },
    [`honor-points-v1-${key}`],
    { revalidate: 3600, tags: ['honor-points'] }
  )()
}

type ThreadRow = { id: number; title: string; user_id?: string | null; image_url: string | null; thumbnail_url?: string | null; post_count: number }
type RelatedThreadRow = ThreadRow & {
  category_id: number | null
  created_at: string | null
  last_posted_at: string | null
}

type CachedThreadRow = {
  id: number
  title: string
  body: string
  author_name: string
  user_id?: string | null
  image_url: string | null
  thumbnail_url?: string | null
  view_count: number
  post_count: number
  is_archived: boolean
  comment_locked?: boolean
  auto_lock_exempt?: boolean
  archived_at?: string | null
  created_at: string
  last_posted_at: string | null
  session_id?: string | null
  category_id: number | null
  categories: unknown
}

export const getCachedTopThreads = unstable_cache(
  async () => {
    try {
      const supabase = createPublicClient()
      const hiddenUserIds = await getCachedPublicHiddenUserIds()
      const publicUserFilter = getPublicVisibleUserContentOrFilter(hiddenUserIds)
      let query = applyActiveThreadFilter(supabase
        .from('threads')
        .select('id, title, user_id, image_url, thumbnail_url, post_count')
      )

      if (publicUserFilter) query = query.or(publicUserFilter)

      const result = await query
        .order('post_count', { ascending: false })
        .limit(20)
      let raw = result.data
      if (isArchiveSchemaMissing(result.error)) {
        let retry = applyLegacyActiveThreadFilter(supabase
          .from('threads')
          .select('id, title, user_id, image_url, thumbnail_url, post_count')
        )
        if (publicUserFilter) retry = retry.or(publicUserFilter)
        const retryResult = await retry
          .order('post_count', { ascending: false })
          .limit(20)
        raw = retryResult.data
      }
      if (!raw || raw.length === 0) return []
      return withFallbackThumbnails(supabase, filterPublicVisibleUserContent(raw as ThreadRow[], hiddenUserIds))
    } catch (error) {
      console.warn('top threads fetch failed:', error)
      return []
    }
  },
  ['top-threads'],
  { revalidate: STANDARD_CACHE_SECONDS, tags: ['threads'] }
)

const COMMON_RECOMMEND_WORDS = new Set([
  'デュエマ',
  'デュエルマスターズ',
  '新カード',
  'カード',
  '公開',
  '判明',
  'これ',
  'それ',
  'どう',
  'スレ',
  'まとめ',
])

function extractRecommendKeywords(title: string) {
  const keywords = new Set<string>()

  for (const match of title.matchAll(/[《『「](.*?)[》』」]/g)) {
    const value = match[1]?.trim()
    if (value && value.length >= 2) keywords.add(value)
  }

  const normalized = title
    .replace(/[【】《》『』「」（）()[\]！？!?、。・／/｜|:：]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  for (const token of normalized.match(/[A-Za-z0-9一-龠ぁ-んァ-ヶー]{2,}/g) ?? []) {
    if (!COMMON_RECOMMEND_WORDS.has(token)) keywords.add(token)
  }

  return [...keywords].slice(0, 8)
}

function scoreRelatedThread(
  thread: RelatedThreadRow,
  keywords: string[],
  categoryId: number | null,
) {
  let score = Math.min(thread.post_count ?? 0, 30)
  if (categoryId !== null && thread.category_id === categoryId) score += 40
  for (const keyword of keywords) {
    if (thread.title.includes(keyword)) score += keyword.length >= 5 ? 35 : 22
  }
  const lastPostedAt = thread.last_posted_at ?? thread.created_at
  if (lastPostedAt) {
    const ageHours = (new Date().getTime() - new Date(lastPostedAt).getTime()) / 36e5
    if (ageHours <= 72) score += 12
    else if (ageHours <= 168) score += 6
  }
  return score
}

export function getCachedRelatedThreads(
  threadId: number,
  title: string,
  categoryId: number | null,
) {
  return unstable_cache(
    async () => {
      const supabase = createPublicClient()
      const hiddenUserIds = await getCachedPublicHiddenUserIds()
      const publicUserFilter = getPublicVisibleUserContentOrFilter(hiddenUserIds)
      const keywords = extractRecommendKeywords(title)
      const select = 'id, title, user_id, image_url, thumbnail_url, post_count, category_id, created_at, last_posted_at'

      let sameCategoryQuery: PromiseLike<{ data: unknown[] | null }>
      if (categoryId === null) {
        sameCategoryQuery = Promise.resolve({ data: [] })
      } else {
        let query = applyActiveThreadFilter(supabase
          .from('threads')
          .select(select)
        )
          .eq('category_id', categoryId)
          .neq('id', threadId)

        if (publicUserFilter) query = query.or(publicUserFilter)

        sameCategoryQuery = query
          .order('last_posted_at', { ascending: false })
          .limit(80)
      }

      let popularQuery = applyActiveThreadFilter(supabase
        .from('threads')
        .select(select)
      )
        .neq('id', threadId)

      if (publicUserFilter) popularQuery = popularQuery.or(publicUserFilter)

      popularQuery = popularQuery
        .order('post_count', { ascending: false })
        .limit(40)

      const [{ data: sameCategory }, { data: popular }] = await Promise.all([
        sameCategoryQuery,
        popularQuery,
      ])

      const byId = new Map<number, RelatedThreadRow>()
      for (const thread of filterPublicVisibleUserContent([...(sameCategory ?? []), ...(popular ?? [])] as RelatedThreadRow[], hiddenUserIds)) {
        byId.set(thread.id, thread)
      }

      const ranked = [...byId.values()]
        .map(thread => ({ thread, score: scoreRelatedThread(thread, keywords, categoryId) }))
        .sort((a, b) => b.score - a.score || b.thread.post_count - a.thread.post_count)
        .slice(0, 8)
        .map(item => item.thread)

      if (ranked.length === 0) return getCachedTopThreads()
      return withFallbackThumbnails(supabase, ranked)
    },
    [`related-threads-${threadId}-${categoryId ?? 'none'}`],
    { revalidate: THREAD_CACHE_SECONDS, tags: [`related-threads-${threadId}`, `thread-${threadId}`] }
  )()
}

export const getCachedThread = (threadId: number) =>
  unstable_cache(
    async () => {
      const supabase = createPublicClient()
      const result = await supabase
        .from('threads')
        .select('id, title, body, author_name, user_id, image_url, view_count, post_count, is_archived, comment_locked, auto_lock_exempt, archived_at, created_at, last_posted_at, session_id, category_id, categories(id,name,slug,color,description,sort_order)')
        .eq('id', threadId)
        .single()
      let data = result.data as CachedThreadRow | null

      if (
        result.error &&
        (
          result.error.code === '42703' ||
          result.error.message?.includes('comment_locked') ||
          result.error.message?.includes('auto_lock_exempt') ||
          result.error.message?.includes('archived_at')
        )
      ) {
        const retry = await supabase
          .from('threads')
          .select('id, title, body, author_name, user_id, image_url, view_count, post_count, is_archived, created_at, last_posted_at, session_id, category_id, categories(id,name,slug,color,description,sort_order)')
          .eq('id', threadId)
          .single()
        data = retry.data as CachedThreadRow | null
      }

      return data
    },
    [`thread-${threadId}`],
    { revalidate: THREAD_CACHE_SECONDS, tags: [`thread-${threadId}`] }
  )()

export const getCachedThreadStarterImageUrl = (threadId: number, threadImageUrl: string | null) =>
  unstable_cache(
    async () => {
      if (!threadImageUrl) return null

      const supabase = createPublicClient()
      const { data } = await supabase
        .from('posts')
        .select('id')
        .eq('thread_id', threadId)
        .eq('image_url', threadImageUrl)
        .limit(1)

      return data && data.length > 0 ? null : threadImageUrl
    },
    [`thread-starter-image-${threadId}-${threadImageUrl ?? 'none'}`],
    { revalidate: THREAD_CACHE_SECONDS, tags: [`thread-${threadId}`] }
  )()

export const getCachedThreadPosts = (threadId: number, page: number) =>
  unstable_cache(
    async () => {
      const supabase = createPublicClient()
      const offset = (page - 1) * THREAD_POSTS_PER_PAGE
      const { data } = await supabase
        .from('posts')
        .select('id, thread_id, post_number, body, author_name, user_id, session_id, image_url, created_at, is_deleted, deleted_by, deleted_at')
        .eq('thread_id', threadId)
        .eq('is_deleted', false)
        .order('post_number', { ascending: true })
        .range(offset, offset + THREAD_POSTS_PER_PAGE - 1)
      const hiddenUserIds = await getCachedPublicHiddenUserIds()
      return { data: filterPublicVisibleUserContent(data ?? [], hiddenUserIds) }
    },
    [`thread-posts-${threadId}-p${page}`],
    { revalidate: THREAD_CACHE_SECONDS, tags: [`thread-${threadId}`] }
  )()

export const getCachedPublicAuthorProfiles = (userIds: string[]) => {
  const ids = Array.from(new Set(userIds.filter(Boolean))).sort()
  const key = ids.join(',')

  return unstable_cache(
    async (): Promise<Record<string, PublicAuthorProfile>> => {
      if (ids.length === 0) return {}
      try {
        const supabase = createAdminClient()
        const { data, error } = await supabase
          .from('profiles')
          .select('id, display_name, profile_slug, avatar_url, profile_hidden, account_suspended, withdrawn_at')
          .in('id', ids)
        if (error) return {}
        return Object.fromEntries(
          (data ?? [])
            .map(profile => {
              const id = String(profile.id)
              const isRestricted =
                profile.profile_hidden === true ||
                profile.account_suspended === true ||
                Boolean(profile.withdrawn_at)

              if (isRestricted) {
                return [
                  id,
                  { id, display_name: DEFAULT_PUBLIC_AUTHOR_NAME, profile_slug: '', avatar_url: null },
                ] as const
              }

              if (!profile.profile_slug || !profile.display_name) return null

              return [
                id,
                {
                  id,
                  display_name: String(profile.display_name),
                  profile_slug: String(profile.profile_slug),
                  avatar_url: typeof profile.avatar_url === 'string' ? profile.avatar_url : null,
                },
              ] as const
            })
            .filter((entry): entry is readonly [string, PublicAuthorProfile] => entry !== null)
        )
      } catch {
        return {}
      }
    },
    [`public-author-profiles-${key || 'none'}`],
    { revalidate: STANDARD_CACHE_SECONDS, tags: ['profiles'] }
  )()
}

export const getCachedRestrictedAuthorNames = (authorNames: string[]) => {
  const names = Array.from(
    new Set(
      authorNames
        .map(name => name.trim())
        .filter(name => name && name !== DEFAULT_PUBLIC_AUTHOR_NAME)
    )
  ).sort()
  const key = names.join(',')

  return unstable_cache(
    async (): Promise<string[]> => {
      if (names.length === 0) return []
      try {
        const supabase = createAdminClient()
        const { data, error } = await supabase
          .from('profiles')
          .select('display_name, profile_hidden, account_suspended, withdrawn_at')
          .in('display_name', names)
        if (error) return []

        return Array.from(new Set(
          (data ?? [])
            .filter(profile =>
              profile.profile_hidden === true ||
              profile.account_suspended === true ||
              Boolean(profile.withdrawn_at)
            )
            .map(profile => String(profile.display_name ?? '').trim())
            .filter(Boolean)
        ))
      } catch {
        return []
      }
    },
    [`restricted-author-names-${key || 'none'}`],
    { revalidate: STANDARD_CACHE_SECONDS, tags: ['profiles'] }
  )()
}

export type UserThreadRow = {
  id: number
  title: string
  post_count: number | null
  created_at: string | null
}

export type UserPostRow = {
  id: number
  thread_id: number
  post_number: number | null
  body: string | null
  created_at: string | null
  threads: { title: string | null } | null
}

export const getCachedUserThreads = (userId: string): Promise<UserThreadRow[]> =>
  unstable_cache(
    async () => {
      try {
        const supabase = createPublicClient()
        const { data } = await supabase
          .from('threads')
          .select('id, title, post_count, created_at')
          .eq('user_id', userId)
          .eq('is_archived', false)
          .order('created_at', { ascending: false })
          .limit(10)
        return (data ?? []) as UserThreadRow[]
      } catch (error) {
        console.warn('user threads fetch failed:', error)
        return []
      }
    },
    [`user-threads-${userId}`],
    { revalidate: STANDARD_CACHE_SECONDS, tags: ['threads'] }
  )()

export const getCachedUserPosts = (userId: string): Promise<UserPostRow[]> =>
  unstable_cache(
    async () => {
      try {
        const supabase = createPublicClient()
        const { data } = await supabase
          .from('posts')
          .select('id, thread_id, post_number, body, created_at, threads(title)')
          .eq('user_id', userId)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })
          .limit(10)
        return (data ?? []) as unknown as UserPostRow[]
      } catch (error) {
        console.warn('user posts fetch failed:', error)
        return []
      }
    },
    [`user-posts-${userId}`],
    { revalidate: STANDARD_CACHE_SECONDS, tags: ['posts'] }
  )()

type UserRankingProfile = {
  id: string
  display_name: string | null
  profile_slug: string | null
  avatar_url: string | null
  x_url: string | null
  youtube_url: string | null
}

type UserRankingActivity = { user_id: string | null; created_at: string | null }

export type UserRankingRow = {
  display_name: string
  profile_slug: string
  avatar_url: string | null
  x_url: string | null
  youtube_url: string | null
  thread_count: number
  post_count: number
  card_rating_count: number
  card_review_count: number
  pack_review_count: number
  points: number
}

export type UserRankingResult = {
  monthly: UserRankingRow[]
  total: UserRankingRow[]
}

export type ProfileShowcaseUser = {
  display_name: string
  profile_slug: string
  avatar_url: string | null
}

export function getCachedTopShowcaseMode(): Promise<TopShowcaseMode> {
  return unstable_cache(
    async (): Promise<TopShowcaseMode> => {
      try {
        const supabase = createPublicClient()
        const { data } = await supabase
          .from('site_settings')
          .select('value')
          .eq('key', 'top_showcase_mode')
          .maybeSingle()

        return normalizeTopShowcaseMode(data?.value)
      } catch (error) {
        console.warn('top showcase mode fetch failed:', error)
        return 'profiles'
      }
    },
    ['top-showcase-mode-v1'],
    { revalidate: STANDARD_CACHE_SECONDS, tags: ['site_settings', 'top-showcase-mode'] }
  )()
}

const USER_RANKING_PROFILE_LIMIT = 100
const USER_RANKING_LIMIT = 10
const USER_RANKING_FETCH_LIMIT = 10000
const USER_RANKING_DAILY_CAP = 24
const USER_RANKING_CAP_START_DATE_JST = '2026-06-26'
const PROFILE_SHOWCASE_POOL_LIMIT = 100
const PROFILE_SHOWCASE_LIMIT = 10
const PROFILE_SHOWCASE_BUCKET_HOURS = 12

function getJstMonthStartIso() {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(now)
  const year = Number(parts.find(part => part.type === 'year')?.value ?? now.getUTCFullYear())
  const month = Number(parts.find(part => part.type === 'month')?.value ?? now.getUTCMonth() + 1)
  return new Date(Date.UTC(year, month - 1, 1, -9, 0, 0)).toISOString()
}

function getJstDateKey(): string {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return jst.toISOString().slice(0, 10)
}

function getJstHalfDaySeed(): number {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return Math.floor(jst.getTime() / (1000 * 60 * 60 * PROFILE_SHOWCASE_BUCKET_HOURS))
}

function toJstDateKey(isoString: string): string {
  return new Date(new Date(isoString).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export function getCachedProfileShowcaseUsers(): Promise<ProfileShowcaseUser[]> {
  const seed = getJstHalfDaySeed()

  return unstable_cache(
    async (): Promise<ProfileShowcaseUser[]> => {
      try {
        const supabase = createPublicClient()
        const baseSelect = 'display_name, profile_slug, avatar_url'
        const { data } = await supabase
          .from('profiles')
          .select(baseSelect)
          .eq('profile_hidden', false)
          .eq('rank_excluded', false)
          .eq('account_suspended', false)
          .is('withdrawn_at', null)
          .not('display_name', 'is', null)
          .not('profile_slug', 'is', null)
          .neq('display_name', '')
          .neq('profile_slug', '')
          .order('created_at', { ascending: false })
          .limit(PROFILE_SHOWCASE_POOL_LIMIT)

        const profiles = ((data ?? []) as Array<{
          display_name: string | null
          profile_slug: string | null
          avatar_url: string | null
        }>)
          .map(profile => ({
            display_name: String(profile.display_name ?? '').trim(),
            profile_slug: String(profile.profile_slug ?? '').trim(),
            avatar_url: typeof profile.avatar_url === 'string' && profile.avatar_url ? profile.avatar_url : null,
          }))
          .filter(profile => profile.display_name.length > 0 && profile.profile_slug.length > 0)

        return seededShuffle(profiles, seed).slice(0, PROFILE_SHOWCASE_LIMIT)
      } catch (error) {
        console.warn('profile showcase fetch failed:', error)
        return []
      }
    },
    [`profile-showcase-v1-${seed}`],
    { revalidate: PROFILE_SHOWCASE_BUCKET_HOURS * 60 * 60, tags: ['profiles'] }
  )()
}

function buildDailyPointsMap(
  ...activitySets: Array<{ rows: UserRankingActivity[]; pts: number }>
): Map<string, number> {
  // cap開始日以降: userId → dateKey → 日別ポイント合計
  const dailyMap = new Map<string, Map<string, number>>()
  // cap開始日より前: userId → 旧計算ポイント合計（上限なし）
  const legacyTotals = new Map<string, number>()

  for (const { rows, pts } of activitySets) {
    for (const row of rows) {
      if (!row.user_id || !row.created_at) continue
      const dateKey = toJstDateKey(row.created_at)
      if (dateKey < USER_RANKING_CAP_START_DATE_JST) {
        legacyTotals.set(row.user_id, (legacyTotals.get(row.user_id) ?? 0) + pts)
      } else {
        let userMap = dailyMap.get(row.user_id)
        if (!userMap) {
          userMap = new Map()
          dailyMap.set(row.user_id, userMap)
        }
        userMap.set(dateKey, (userMap.get(dateKey) ?? 0) + pts)
      }
    }
  }

  const totals = new Map<string, number>()
  for (const [userId, pts] of legacyTotals) {
    totals.set(userId, pts)
  }
  for (const [userId, userMap] of dailyMap) {
    let cappedTotal = 0
    for (const dayPts of userMap.values()) {
      cappedTotal += Math.min(dayPts, USER_RANKING_DAILY_CAP)
    }
    totals.set(userId, (totals.get(userId) ?? 0) + cappedTotal)
  }
  return totals
}

function countUserActivity(rows: UserRankingActivity[]) {
  const counts = new Map<string, number>()
  for (const row of rows) {
    if (!row.user_id) continue
    counts.set(row.user_id, (counts.get(row.user_id) ?? 0) + 1)
  }
  return counts
}

function buildUserRanking(
  profiles: UserRankingProfile[],
  threadRows: UserRankingActivity[],
  postRows: UserRankingActivity[],
  cardRatingRows: UserRankingActivity[],
  cardReviewRows: UserRankingActivity[],
  packReviewRows: UserRankingActivity[]
) {
  const threadCounts = countUserActivity(threadRows)
  const postCounts = countUserActivity(postRows)
  const cardRatingCounts = countUserActivity(cardRatingRows)
  const cardReviewCounts = countUserActivity(cardReviewRows)
  const packReviewCounts = countUserActivity(packReviewRows)

  const pointsMap = buildDailyPointsMap(
    { rows: threadRows, pts: USER_RANKING_THREAD_POINT },
    { rows: postRows, pts: USER_RANKING_POST_POINT },
    { rows: cardRatingRows, pts: USER_RANKING_CARD_RATING_POINT },
    { rows: cardReviewRows, pts: USER_RANKING_CARD_REVIEW_POINT },
    { rows: packReviewRows, pts: USER_RANKING_PACK_REVIEW_POINT },
  )

  return profiles
    .map((profile): UserRankingRow => {
      const threadCount = threadCounts.get(profile.id) ?? 0
      const postCount = postCounts.get(profile.id) ?? 0
      const cardRatingCount = cardRatingCounts.get(profile.id) ?? 0
      const cardReviewCount = cardReviewCounts.get(profile.id) ?? 0
      const packReviewCount = packReviewCounts.get(profile.id) ?? 0

      return {
        display_name: profile.display_name || '(未設定)',
        profile_slug: profile.profile_slug || '',
        avatar_url: profile.avatar_url || null,
        x_url: profile.x_url || null,
        youtube_url: profile.youtube_url || null,
        thread_count: threadCount,
        post_count: postCount,
        card_rating_count: cardRatingCount,
        card_review_count: cardReviewCount,
        pack_review_count: packReviewCount,
        points: pointsMap.get(profile.id) ?? 0,
      }
    })
    .filter(row => !!row.profile_slug)
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.thread_count !== a.thread_count) return b.thread_count - a.thread_count
      return b.post_count - a.post_count
    })
    .slice(0, USER_RANKING_LIMIT)
}

export function getCachedUserRankings(): Promise<UserRankingResult> {
  const dateKey = getJstDateKey()
  return unstable_cache(
    async (): Promise<UserRankingResult> => {
      try {
        const supabase = createPublicClient()
        const monthStartIso = getJstMonthStartIso()
        const cutoffIso = getJstTodayCutoffUtcIso()

        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, display_name, profile_slug, avatar_url, x_url, youtube_url')
          .eq('profile_hidden', false)
          .eq('ranking_enabled', true)
          .eq('rank_excluded', false)
          .eq('account_suspended', false)
          .is('withdrawn_at', null)
          .lt('created_at', cutoffIso)
          .order('created_at', { ascending: false })
          .limit(USER_RANKING_PROFILE_LIMIT)

        const profiles = (profilesData ?? []) as UserRankingProfile[]
        const userIds = profiles.map(profile => profile.id)
        if (userIds.length === 0) return { monthly: [], total: [] }

        const [
          monthlyThreads,
          monthlyPosts,
          totalThreads,
          totalPosts,
          monthlyCardRatings,
          monthlyCardReviews,
          monthlyPackReviews,
          totalCardRatings,
          totalCardReviews,
          totalPackReviews,
        ] = await Promise.all([
          supabase.from('threads').select('user_id, created_at').in('user_id', userIds).eq('is_archived', false).gte('created_at', monthStartIso).lt('created_at', cutoffIso).limit(USER_RANKING_FETCH_LIMIT),
          supabase.from('posts').select('user_id, created_at, threads!inner(is_archived)').in('user_id', userIds).eq('is_deleted', false).eq('threads.is_archived', false).gte('created_at', monthStartIso).lt('created_at', cutoffIso).limit(USER_RANKING_FETCH_LIMIT),
          supabase.from('threads').select('user_id, created_at').in('user_id', userIds).eq('is_archived', false).lt('created_at', cutoffIso).limit(USER_RANKING_FETCH_LIMIT),
          supabase.from('posts').select('user_id, created_at, threads!inner(is_archived)').in('user_id', userIds).eq('is_deleted', false).eq('threads.is_archived', false).lt('created_at', cutoffIso).limit(USER_RANKING_FETCH_LIMIT),
          supabase.from('zukan_card_ratings').select('user_id, created_at').in('user_id', userIds).eq('is_deleted', false).gte('created_at', monthStartIso).lt('created_at', cutoffIso).limit(USER_RANKING_FETCH_LIMIT),
          supabase.from('zukan_card_reviews').select('user_id, created_at').in('user_id', userIds).eq('is_deleted', false).eq('is_hidden', false).gte('created_at', monthStartIso).lt('created_at', cutoffIso).limit(USER_RANKING_FETCH_LIMIT),
          supabase.from('zukan_pack_reviews').select('user_id, created_at').in('user_id', userIds).eq('is_deleted', false).eq('is_hidden', false).gte('created_at', monthStartIso).lt('created_at', cutoffIso).limit(USER_RANKING_FETCH_LIMIT),
          supabase.from('zukan_card_ratings').select('user_id, created_at').in('user_id', userIds).eq('is_deleted', false).lt('created_at', cutoffIso).limit(USER_RANKING_FETCH_LIMIT),
          supabase.from('zukan_card_reviews').select('user_id, created_at').in('user_id', userIds).eq('is_deleted', false).eq('is_hidden', false).lt('created_at', cutoffIso).limit(USER_RANKING_FETCH_LIMIT),
          supabase.from('zukan_pack_reviews').select('user_id, created_at').in('user_id', userIds).eq('is_deleted', false).eq('is_hidden', false).lt('created_at', cutoffIso).limit(USER_RANKING_FETCH_LIMIT),
        ])

        return {
          monthly: buildUserRanking(
            profiles,
            (monthlyThreads.data ?? []) as UserRankingActivity[],
            (monthlyPosts.data ?? []) as UserRankingActivity[],
            (monthlyCardRatings.data ?? []) as UserRankingActivity[],
            (monthlyCardReviews.data ?? []) as UserRankingActivity[],
            (monthlyPackReviews.data ?? []) as UserRankingActivity[]
          ),
          total: buildUserRanking(
            profiles,
            (totalThreads.data ?? []) as UserRankingActivity[],
            (totalPosts.data ?? []) as UserRankingActivity[],
            (totalCardRatings.data ?? []) as UserRankingActivity[],
            (totalCardReviews.data ?? []) as UserRankingActivity[],
            (totalPackReviews.data ?? []) as UserRankingActivity[]
          ),
        }
      } catch (error) {
        console.warn('user rankings fetch failed:', error)
        return { monthly: [], total: [] }
      }
    },
    [`user-rankings-public-v10-${dateKey}`],
    { revalidate: 86400, tags: ['user-rankings'] }
  )()
}

export type CachedCampaignRankingResult = {
  settings: CampaignSettings
  ranking: CampaignRankingPublicResult
  cachedDateJst: string
}

export function getCachedCampaignRanking(): Promise<CachedCampaignRankingResult> {
  const dateKey = getJstDateKey()
  return unstable_cache(
    async (): Promise<CachedCampaignRankingResult> => {
      const settings = await fetchCampaignSettings()
      const state = resolveCampaignState(settings)
      if (state === 'disabled' || state === 'scheduled') {
        return { settings, ranking: { entries: [], error: null, overflow: false }, cachedDateJst: getJstDateKey() }
      }
      const cutoffIso = getJstTodayCutoffUtcIso()
      const ranking = await fetchCampaignRankingPublic(settings.startIso, settings.endIso, state === 'active', cutoffIso)
      return { settings, ranking, cachedDateJst: getJstDateKey() }
    },
    [`campaign-ranking-public-v3-${dateKey}`],
    { revalidate: 86400, tags: ['campaign-ranking'] }
  )()
}

export interface CachedThreadListResult {
  threads: unknown[]
  count: number
  totalPages: number
}

export function getCachedThreadList(
  sort: string,
  page: number,
  categoryId: number | number[] | null,
  isArchived: boolean,
  pageSizeOverride?: number
): Promise<CachedThreadListResult> {
  const pageSize = sort === 'popular' ? POPULAR_PAGE_SIZE : (pageSizeOverride ?? THREAD_PAGE_SIZE)
  const categoryKey = Array.isArray(categoryId) ? categoryId.slice().sort((a, b) => a - b).join('-') : String(categoryId)
  const cacheKey = `tl-v2-${sort}-ps${pageSize}-p${page}-c${categoryKey}-a${String(isArchived)}`

  return unstable_cache(
    async () => {
      const supabase = createPublicClient()
      const offset = (page - 1) * pageSize
      const hiddenUserIds = await getCachedPublicHiddenUserIds()
      const publicUserFilter = getPublicVisibleUserContentOrFilter(hiddenUserIds)

      let countQuery = supabase
        .from('threads')
        .select('id', { count: 'exact', head: true })
      countQuery = isArchived
        ? applyKakologThreadFilter(countQuery)
        : applyActiveThreadFilter(countQuery)
      let dataQuery = supabase
        .from('threads')
        .select('id, title, user_id, image_url, thumbnail_url, post_count, is_archived, auto_lock_exempt, archived_at, created_at, last_posted_at, category_id, categories(id,name,slug,color)')
      dataQuery = isArchived
        ? applyKakologThreadFilter(dataQuery)
        : applyActiveThreadFilter(dataQuery)

      if (publicUserFilter) {
        countQuery = countQuery.or(publicUserFilter)
        dataQuery = dataQuery.or(publicUserFilter)
      }

      if (categoryId !== null) {
        const categoryIds = Array.isArray(categoryId) ? categoryId : [categoryId]
        if (categoryIds.length === 1) {
          countQuery = countQuery.eq('category_id', categoryIds[0])
          dataQuery = dataQuery.eq('category_id', categoryIds[0])
        } else if (categoryIds.length > 1) {
          countQuery = countQuery.in('category_id', categoryIds)
          dataQuery = dataQuery.in('category_id', categoryIds)
        }
      }

      if (sort === 'popular') {
        dataQuery = dataQuery.order('post_count', { ascending: false })
      } else if (sort === 'new') {
        dataQuery = dataQuery.order('created_at', { ascending: false })
      } else {
        dataQuery = dataQuery.order('last_posted_at', { ascending: false })
      }

      dataQuery = dataQuery.range(offset, offset + pageSize - 1)

      const [countResult, dataResult] = await Promise.all([countQuery, dataQuery])
      let count = countResult.count
      let raw = dataResult.data
      if (isArchiveSchemaMissing(countResult.error) || isArchiveSchemaMissing(dataResult.error)) {
        let legacyCountQuery = supabase
          .from('threads')
          .select('id', { count: 'exact', head: true })
        legacyCountQuery = isArchived
          ? applyLegacyKakologThreadFilter(legacyCountQuery)
          : applyLegacyActiveThreadFilter(legacyCountQuery)
        let legacyDataQuery = supabase
          .from('threads')
          .select('id, title, user_id, image_url, thumbnail_url, post_count, is_archived, created_at, last_posted_at, category_id, categories(id,name,slug,color)')
        legacyDataQuery = isArchived
          ? applyLegacyKakologThreadFilter(legacyDataQuery)
          : applyLegacyActiveThreadFilter(legacyDataQuery)

        if (publicUserFilter) {
          legacyCountQuery = legacyCountQuery.or(publicUserFilter)
          legacyDataQuery = legacyDataQuery.or(publicUserFilter)
        }

        if (categoryId !== null) {
          const categoryIds = Array.isArray(categoryId) ? categoryId : [categoryId]
          if (categoryIds.length === 1) {
            legacyCountQuery = legacyCountQuery.eq('category_id', categoryIds[0])
            legacyDataQuery = legacyDataQuery.eq('category_id', categoryIds[0])
          } else if (categoryIds.length > 1) {
            legacyCountQuery = legacyCountQuery.in('category_id', categoryIds)
            legacyDataQuery = legacyDataQuery.in('category_id', categoryIds)
          }
        }

        if (sort === 'popular') {
          legacyDataQuery = legacyDataQuery.order('post_count', { ascending: false })
        } else if (sort === 'new') {
          legacyDataQuery = legacyDataQuery.order('created_at', { ascending: false })
        } else {
          legacyDataQuery = legacyDataQuery.order('last_posted_at', { ascending: false })
        }

        legacyDataQuery = legacyDataQuery.range(offset, offset + pageSize - 1)
        const [legacyCount, legacyData] = await Promise.all([legacyCountQuery, legacyDataQuery])
        count = legacyCount.count
        raw = legacyData.data as unknown as typeof raw
      }
      const normalizedRaw = isArchived
        ? (raw ?? []).map(thread => ({ ...thread, is_archived: true }))
        : raw
      const visibleRaw = filterPublicVisibleUserContent(normalizedRaw as ThreadRow[] | null, hiddenUserIds)
      const threads = visibleRaw.length > 0 ? await withFallbackThumbnails(supabase, visibleRaw) : []

      return {
        threads,
        count: count ?? 0,
        totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
      }
    },
    [cacheKey],
    { revalidate: STANDARD_CACHE_SECONDS, tags: ['threads'] }
  )()
}
