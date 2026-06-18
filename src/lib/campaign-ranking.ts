import { createAdminClient } from './supabase-admin'
import {
  CAMPAIGN_THREAD_POINT,
  CAMPAIGN_THREAD_DAILY_LIMIT,
  CAMPAIGN_POST_POINT,
  CAMPAIGN_POST_DAILY_LIMIT,
  CAMPAIGN_REVIEW_POINT,
  CAMPAIGN_REVIEW_DAILY_LIMIT,
  CAMPAIGN_RATING_DAILY_THRESHOLD,
  CAMPAIGN_RATING_DAILY_POINT,
} from './ranking-points'

const PAGE_SIZE = 1000
const MAX_PAGES = 10
const MAX_PUBLIC_DISPLAY = 30

// ---- Public types ----

export type CampaignSettings = {
  status: string
  title: string
  startIso: string
  endIso: string
  prize: string
  rulesUrl: string
}

export type PublicCampaignEntry = {
  rank: number
  displayName: string
  profileSlug: string
  avatarUrl: string | null
  totalPoints: number
  threadCount: number
  postCount: number
  reviewCount: number
  ratingDays: number
}

export type CampaignRankingPublicResult = {
  entries: PublicCampaignEntry[]
  error: string | null
  overflow: boolean
}

// ---- Admin types ----

export type AdminProfileRow = {
  id: string
  display_name: string | null
  profile_slug: string | null
  avatar_url: string | null
  profile_hidden: boolean | null
  ranking_enabled: boolean | null
  rank_excluded: boolean | null
  account_suspended: boolean | null
  withdrawn_at: string | null
  x_url: string | null
}

export type AdminCampaignEntry = {
  userId: string
  totalPoints: number
  threadCount: number
  postCount: number
  reviewCount: number
  ratingDays: number
  threadRawCount: number
  postRawCount: number
  cardReviewRawCount: number
  packReviewRawCount: number
  ratingRawCount: number
  lastActivity: string
  profile: AdminProfileRow | null
  excludeReasons: string[]
}

export type CampaignRankingAdminResult = {
  entries: AdminCampaignEntry[]
  error: string | null
  overflow: boolean
}

// ---- Helpers ----

type ActivityRow = { user_id: string | null; created_at: string | null }

type PageFetcher = (from: number, to: number) => PromiseLike<{
  data: ActivityRow[] | null
  error: { message: string } | null
}>

export function toJstDate(utcIso: string): string {
  const jstMs = new Date(utcIso).getTime() + 9 * 60 * 60 * 1000
  return new Date(jstMs).toISOString().slice(0, 10)
}

export function toDisplayJst(isoJst: string): string {
  if (!isoJst) return ''
  const m = isoJst.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!m) return isoJst
  return `${m[1]}/${m[2]}/${m[3]} ${m[4]}:${m[5]}`
}

async function fetchAllRows(fetcher: PageFetcher): Promise<{
  rows: ActivityRow[]
  overflow: boolean
  errorMsg: string | null
}> {
  const rows: ActivityRow[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    const { data, error } = await fetcher(from, to)
    if (error) return { rows: [], overflow: false, errorMsg: error.message }
    const chunk = (data ?? []) as ActivityRow[]
    rows.push(...chunk)
    if (chunk.length < PAGE_SIZE) break
    if (page === MAX_PAGES - 1) return { rows, overflow: true, errorMsg: null }
  }
  return { rows, overflow: false, errorMsg: null }
}

export async function fetchCampaignSettings(): Promise<CampaignSettings> {
  const supabase = createAdminClient()
  const { data: rows } = await supabase
    .from('site_settings')
    .select('key, value')
    .in('key', ['campaign_status', 'campaign_title', 'campaign_start', 'campaign_end', 'campaign_prize', 'campaign_rules_url'])
  const s: Record<string, string> = {}
  for (const row of rows ?? []) s[row.key] = row.value
  return {
    status: s['campaign_status'] ?? 'draft',
    title: s['campaign_title'] ?? '',
    startIso: s['campaign_start'] ?? '',
    endIso: s['campaign_end'] ?? '',
    prize: s['campaign_prize'] ?? '',
    rulesUrl: s['campaign_rules_url'] ?? '',
  }
}

// ---- Core shared calculation (returns all users with full admin data) ----

export async function fetchCampaignRankingFull(
  startIso: string,
  endIso: string,
): Promise<CampaignRankingAdminResult> {
  const supabase = createAdminClient()

  // zukan_card_ratings has NO is_hidden column — only is_deleted.
  // DB UNIQUE (card_id, user_id) prevents duplicate logged-in ratings per card.
  // zukan_pack_ratings does not exist; only zukan_card_ratings is used.
  const [threadRes, postRes, ratingRes, cardRevRes, packRevRes] = await Promise.all([
    fetchAllRows((from, to) =>
      supabase
        .from('threads')
        .select('user_id, created_at')
        .gte('created_at', startIso)
        .lte('created_at', endIso)
        .eq('is_archived', false)
        .not('user_id', 'is', null)
        .range(from, to) as PromiseLike<{ data: ActivityRow[] | null; error: { message: string } | null }>
    ),
    fetchAllRows((from, to) =>
      supabase
        .from('posts')
        .select('user_id, created_at')
        .gte('created_at', startIso)
        .lte('created_at', endIso)
        .eq('is_deleted', false)
        .not('user_id', 'is', null)
        .range(from, to) as PromiseLike<{ data: ActivityRow[] | null; error: { message: string } | null }>
    ),
    fetchAllRows((from, to) =>
      supabase
        .from('zukan_card_ratings')
        .select('user_id, created_at')
        .gte('created_at', startIso)
        .lte('created_at', endIso)
        .eq('is_deleted', false)
        .not('user_id', 'is', null)
        .range(from, to) as PromiseLike<{ data: ActivityRow[] | null; error: { message: string } | null }>
    ),
    fetchAllRows((from, to) =>
      supabase
        .from('zukan_card_reviews')
        .select('user_id, created_at')
        .gte('created_at', startIso)
        .lte('created_at', endIso)
        .eq('is_deleted', false)
        .eq('is_hidden', false)
        .not('user_id', 'is', null)
        .range(from, to) as PromiseLike<{ data: ActivityRow[] | null; error: { message: string } | null }>
    ),
    fetchAllRows((from, to) =>
      supabase
        .from('zukan_pack_reviews')
        .select('user_id, created_at')
        .gte('created_at', startIso)
        .lte('created_at', endIso)
        .eq('is_deleted', false)
        .eq('is_hidden', false)
        .not('user_id', 'is', null)
        .range(from, to) as PromiseLike<{ data: ActivityRow[] | null; error: { message: string } | null }>
    ),
  ])

  for (const r of [threadRes, postRes, ratingRes, cardRevRes, packRevRes]) {
    if (r.errorMsg) return { entries: [], error: r.errorMsg, overflow: false }
  }
  const overflow = [threadRes, postRes, ratingRes, cardRevRes, packRevRes].some(r => r.overflow)
  if (overflow) {
    return { entries: [], error: '対象データが多すぎるため集計できませんでした（1万件超）', overflow: true }
  }

  type InternalActivity = {
    threadRawCount: number
    postRawCount: number
    cardReviewRawCount: number
    packReviewRawCount: number
    ratingRawCount: number
    threadCount: number
    postCount: number
    reviewCount: number
    ratingDays: number
    lastActivity: string
  }

  const activityMap = new Map<string, InternalActivity>()
  const getOrCreate = (uid: string): InternalActivity => {
    if (!activityMap.has(uid)) {
      activityMap.set(uid, {
        threadRawCount: 0, postRawCount: 0, cardReviewRawCount: 0,
        packReviewRawCount: 0, ratingRawCount: 0,
        threadCount: 0, postCount: 0, reviewCount: 0, ratingDays: 0,
        lastActivity: '',
      })
    }
    return activityMap.get(uid)!
  }
  const updateLast = (a: InternalActivity, createdAt: string) => {
    if (createdAt > a.lastActivity) a.lastActivity = createdAt
  }

  // Threads: 3pt each, max CAMPAIGN_THREAD_DAILY_LIMIT per user per JST day (earliest first)
  const sortedThreads = threadRes.rows
    .filter(r => r.user_id && r.created_at)
    .sort((a, b) => (a.created_at! < b.created_at! ? -1 : 1))
  const dailyThreads = new Map<string, number>()
  for (const row of sortedThreads) {
    const a = getOrCreate(row.user_id!)
    a.threadRawCount++
    const key = `${row.user_id}|${toJstDate(row.created_at!)}`
    const n = (dailyThreads.get(key) ?? 0) + 1
    dailyThreads.set(key, n)
    if (n <= CAMPAIGN_THREAD_DAILY_LIMIT) { a.threadCount++; updateLast(a, row.created_at!) }
  }

  // Posts: 1pt each, max CAMPAIGN_POST_DAILY_LIMIT per user per JST day (earliest first)
  const sortedPosts = postRes.rows
    .filter(r => r.user_id && r.created_at)
    .sort((a, b) => (a.created_at! < b.created_at! ? -1 : 1))
  const dailyPosts = new Map<string, number>()
  for (const row of sortedPosts) {
    const a = getOrCreate(row.user_id!)
    a.postRawCount++
    const key = `${row.user_id}|${toJstDate(row.created_at!)}`
    const n = (dailyPosts.get(key) ?? 0) + 1
    dailyPosts.set(key, n)
    if (n <= CAMPAIGN_POST_DAILY_LIMIT) { a.postCount++; updateLast(a, row.created_at!) }
  }

  // Reviews: card + pack combined, 3pt each, max CAMPAIGN_REVIEW_DAILY_LIMIT per user per JST day (earliest first)
  const allReviews = [
    ...cardRevRes.rows.filter(r => r.user_id && r.created_at).map(r => ({ ...r, isCard: true })),
    ...packRevRes.rows.filter(r => r.user_id && r.created_at).map(r => ({ ...r, isCard: false })),
  ].sort((a, b) => (a.created_at! < b.created_at! ? -1 : 1))
  const dailyReviews = new Map<string, number>()
  for (const row of allReviews) {
    const a = getOrCreate(row.user_id!)
    if (row.isCard) a.cardReviewRawCount++
    else a.packReviewRawCount++
    const key = `${row.user_id}|${toJstDate(row.created_at!)}`
    const n = (dailyReviews.get(key) ?? 0) + 1
    dailyReviews.set(key, n)
    if (n <= CAMPAIGN_REVIEW_DAILY_LIMIT) { a.reviewCount++; updateLast(a, row.created_at!) }
  }

  // Ratings: ≥ CAMPAIGN_RATING_DAILY_THRESHOLD valid ratings in a JST day → 1pt for that day.
  // DB UNIQUE (card_id, user_id) ensures no duplicate card per logged-in user — no JS dedup needed.
  type DayInfo = { count: number; maxAt: string }
  const dailyRatings = new Map<string, DayInfo>()
  for (const row of ratingRes.rows) {
    if (!row.user_id || !row.created_at) continue
    getOrCreate(row.user_id).ratingRawCount++
    const key = `${row.user_id}|${toJstDate(row.created_at)}`
    const existing = dailyRatings.get(key)
    if (!existing) {
      dailyRatings.set(key, { count: 1, maxAt: row.created_at })
    } else {
      existing.count++
      if (row.created_at > existing.maxAt) existing.maxAt = row.created_at
    }
  }
  for (const [key, info] of dailyRatings) {
    if (info.count >= CAMPAIGN_RATING_DAILY_THRESHOLD) {
      const uid = key.split('|')[0]
      const a = activityMap.get(uid)
      if (a) { a.ratingDays++; updateLast(a, info.maxAt) }
    }
  }

  // Build entries with total points
  const entries: AdminCampaignEntry[] = []
  for (const [userId, activity] of activityMap) {
    const totalPoints =
      activity.threadCount * CAMPAIGN_THREAD_POINT +
      activity.postCount * CAMPAIGN_POST_POINT +
      activity.reviewCount * CAMPAIGN_REVIEW_POINT +
      activity.ratingDays * CAMPAIGN_RATING_DAILY_POINT
    entries.push({ userId, totalPoints, profile: null, excludeReasons: [], ...activity })
  }

  // Fetch profiles in chunks of 500 (includes avatar_url for public use, x_url for admin)
  const userIds = entries.map(e => e.userId)
  const profileMap = new Map<string, AdminProfileRow>()
  for (let i = 0; i < userIds.length; i += 500) {
    const chunk = userIds.slice(i, i + 500)
    const { data: pRows } = await supabase
      .from('profiles')
      .select('id, display_name, profile_slug, avatar_url, profile_hidden, ranking_enabled, rank_excluded, account_suspended, withdrawn_at, x_url')
      .in('id', chunk)
    for (const p of pRows ?? []) profileMap.set(p.id, p as AdminProfileRow)
  }

  // Attach profile and compute exclude reasons for admin display
  for (const entry of entries) {
    const p = profileMap.get(entry.userId) ?? null
    entry.profile = p
    const reasons: string[] = []
    if (!p) {
      reasons.push('プロフィールなし')
    } else {
      if (p.withdrawn_at != null) reasons.push('退会済み')
      if (p.account_suspended) reasons.push('アカウント停止')
      if (p.profile_hidden) reasons.push('プロフィール非公開')
      if (!p.ranking_enabled) reasons.push('ランキング無効')
      if (p.rank_excluded) reasons.push('除外設定')
    }
    entry.excludeReasons = reasons
  }

  // Sort: totalPoints↓ → postCount↓ → reviewCount↓ → threadCount↓ → lastActivity↑ → userId↑
  entries.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
    if (b.postCount !== a.postCount) return b.postCount - a.postCount
    if (b.reviewCount !== a.reviewCount) return b.reviewCount - a.reviewCount
    if (b.threadCount !== a.threadCount) return b.threadCount - a.threadCount
    if (a.lastActivity !== b.lastActivity) return a.lastActivity < b.lastActivity ? -1 : 1
    return a.userId < b.userId ? -1 : 1
  })

  return { entries, error: null, overflow: false }
}

// ---- Public wrapper (strips admin-only fields, returns eligible users only) ----

export async function fetchCampaignRankingPublic(
  startIso: string,
  endIso: string,
): Promise<CampaignRankingPublicResult> {
  const full = await fetchCampaignRankingFull(startIso, endIso)
  if (full.error) return { entries: [], error: full.error, overflow: full.overflow }

  const entries: PublicCampaignEntry[] = []
  let rank = 0
  for (const e of full.entries) {
    if (e.excludeReasons.length > 0) continue
    if (!e.profile?.profile_slug) continue
    rank++
    entries.push({
      rank,
      displayName: e.profile.display_name ?? e.profile.profile_slug,
      profileSlug: e.profile.profile_slug,
      avatarUrl: e.profile.avatar_url,
      totalPoints: e.totalPoints,
      threadCount: e.threadCount,
      postCount: e.postCount,
      reviewCount: e.reviewCount,
      ratingDays: e.ratingDays,
    })
    if (rank >= MAX_PUBLIC_DISPLAY) break
  }

  return { entries, error: null, overflow: false }
}
