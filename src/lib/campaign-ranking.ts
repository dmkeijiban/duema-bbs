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

export async function fetchCampaignRankingPublic(
  startIso: string,
  endIso: string,
): Promise<CampaignRankingPublicResult> {
  const supabase = createAdminClient()

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
  if ([threadRes, postRes, ratingRes, cardRevRes, packRevRes].some(r => r.overflow)) {
    return { entries: [], error: '対象データが多すぎるため集計できませんでした', overflow: true }
  }

  type UserActivity = {
    threadCount: number
    postCount: number
    reviewCount: number
    ratingDays: number
    totalPoints: number
    lastActivity: string
  }

  const activityMap = new Map<string, UserActivity>()
  const getOrCreate = (uid: string): UserActivity => {
    if (!activityMap.has(uid)) {
      activityMap.set(uid, { threadCount: 0, postCount: 0, reviewCount: 0, ratingDays: 0, totalPoints: 0, lastActivity: '' })
    }
    return activityMap.get(uid)!
  }
  const updateLast = (a: UserActivity, createdAt: string) => {
    if (createdAt > a.lastActivity) a.lastActivity = createdAt
  }

  // Threads: earliest first, cap per user per JST day
  const sortedThreads = threadRes.rows.filter(r => r.user_id && r.created_at).sort((a, b) => a.created_at! < b.created_at! ? -1 : 1)
  const dailyThreads = new Map<string, number>()
  for (const row of sortedThreads) {
    const a = getOrCreate(row.user_id!)
    const key = `${row.user_id}|${toJstDate(row.created_at!)}`
    const n = (dailyThreads.get(key) ?? 0) + 1
    dailyThreads.set(key, n)
    if (n <= CAMPAIGN_THREAD_DAILY_LIMIT) { a.threadCount++; updateLast(a, row.created_at!) }
  }

  // Posts
  const sortedPosts = postRes.rows.filter(r => r.user_id && r.created_at).sort((a, b) => a.created_at! < b.created_at! ? -1 : 1)
  const dailyPosts = new Map<string, number>()
  for (const row of sortedPosts) {
    const a = getOrCreate(row.user_id!)
    const key = `${row.user_id}|${toJstDate(row.created_at!)}`
    const n = (dailyPosts.get(key) ?? 0) + 1
    dailyPosts.set(key, n)
    if (n <= CAMPAIGN_POST_DAILY_LIMIT) { a.postCount++; updateLast(a, row.created_at!) }
  }

  // Reviews: card + pack combined, earliest first
  const allReviews = [
    ...cardRevRes.rows.filter(r => r.user_id && r.created_at),
    ...packRevRes.rows.filter(r => r.user_id && r.created_at),
  ].sort((a, b) => a.created_at! < b.created_at! ? -1 : 1)
  const dailyReviews = new Map<string, number>()
  for (const row of allReviews) {
    const a = getOrCreate(row.user_id!)
    const key = `${row.user_id}|${toJstDate(row.created_at!)}`
    const n = (dailyReviews.get(key) ?? 0) + 1
    dailyReviews.set(key, n)
    if (n <= CAMPAIGN_REVIEW_DAILY_LIMIT) { a.reviewCount++; updateLast(a, row.created_at!) }
  }

  // Ratings: ≥ threshold per JST day → 1 pt
  type DayInfo = { count: number; maxAt: string }
  const dailyRatings = new Map<string, DayInfo>()
  for (const row of ratingRes.rows) {
    if (!row.user_id || !row.created_at) continue
    getOrCreate(row.user_id)
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

  // Calculate total points and sort
  for (const [, a] of activityMap) {
    a.totalPoints =
      a.threadCount * CAMPAIGN_THREAD_POINT +
      a.postCount * CAMPAIGN_POST_POINT +
      a.reviewCount * CAMPAIGN_REVIEW_POINT +
      a.ratingDays * CAMPAIGN_RATING_DAILY_POINT
  }

  const sorted = Array.from(activityMap.entries()).sort(([uidA, a], [uidB, b]) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
    if (b.postCount !== a.postCount) return b.postCount - a.postCount
    if (b.reviewCount !== a.reviewCount) return b.reviewCount - a.reviewCount
    if (b.threadCount !== a.threadCount) return b.threadCount - a.threadCount
    if (a.lastActivity !== b.lastActivity) return a.lastActivity < b.lastActivity ? -1 : 1
    return uidA < uidB ? -1 : 1
  })

  // Fetch profiles (no x_url, no admin-only fields)
  const userIds = sorted.map(([uid]) => uid)
  type ProfileRow = {
    id: string
    display_name: string | null
    profile_slug: string | null
    avatar_url: string | null
    profile_hidden: boolean | null
    ranking_enabled: boolean | null
    rank_excluded: boolean | null
    account_suspended: boolean | null
    withdrawn_at: string | null
  }
  const profileMap = new Map<string, ProfileRow>()
  for (let i = 0; i < userIds.length; i += 500) {
    const chunk = userIds.slice(i, i + 500)
    const { data: pRows } = await supabase
      .from('profiles')
      .select('id, display_name, profile_slug, avatar_url, profile_hidden, ranking_enabled, rank_excluded, account_suspended, withdrawn_at')
      .in('id', chunk)
    for (const p of pRows ?? []) profileMap.set(p.id, p as ProfileRow)
  }

  // Filter eligible users, assign public ranks, take top 30
  const entries: PublicCampaignEntry[] = []
  let rank = 0
  for (const [uid, a] of sorted) {
    const p = profileMap.get(uid)
    if (!p) continue
    if (!p.profile_slug) continue
    if (p.withdrawn_at != null) continue
    if (p.account_suspended) continue
    if (p.profile_hidden) continue
    if (!p.ranking_enabled) continue
    if (p.rank_excluded) continue
    rank++
    entries.push({
      rank,
      displayName: p.display_name ?? p.profile_slug,
      profileSlug: p.profile_slug,
      avatarUrl: p.avatar_url,
      totalPoints: a.totalPoints,
      threadCount: a.threadCount,
      postCount: a.postCount,
      reviewCount: a.reviewCount,
      ratingDays: a.ratingDays,
    })
    if (rank >= MAX_PUBLIC_DISPLAY) break
  }

  return { entries, error: null, overflow: false }
}
