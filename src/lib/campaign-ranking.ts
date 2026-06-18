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

export type CampaignRankingAdminProfile = {
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

export type CampaignRankingAdminEntry = {
  userId: string
  totalPoints: number
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
  profile: CampaignRankingAdminProfile | null
  excludeReasons: string[]
}

export type CampaignRankingAdminResult = {
  entries: CampaignRankingAdminEntry[]
  error: string | null
  overflow: boolean
}

type ActivityRow = { user_id: string | null; created_at: string | null }

type PageFetcher = (from: number, to: number) => PromiseLike<{
  data: ActivityRow[] | null
  error: { message: string } | null
}>

type UserActivity = {
  threadRawCount: number
  postRawCount: number
  cardReviewRawCount: number
  packReviewRawCount: number
  ratingRawCount: number
  threadCount: number
  postCount: number
  reviewCount: number
  ratingDays: number
  totalPoints: number
  lastActivity: string
}

type InternalCampaignEntry = UserActivity & {
  userId: string
  profile: CampaignRankingAdminProfile | null
  excludeReasons: string[]
  eligible: boolean
}

type InternalCampaignResult = {
  entries: InternalCampaignEntry[]
  error: string | null
  overflow: boolean
}

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

async function fetchCampaignRankingInternal(
  startIso: string,
  endIso: string,
): Promise<InternalCampaignResult> {
  const supabase = createAdminClient()
  const [threadRes, postRes, ratingRes, cardRevRes, packRevRes] = await Promise.all([
    fetchAllRows((from, to) =>
      supabase.from('threads').select('user_id, created_at').gte('created_at', startIso).lte('created_at', endIso)
        .eq('is_archived', false).not('user_id', 'is', null).range(from, to) as PromiseLike<{ data: ActivityRow[] | null; error: { message: string } | null }>
    ),
    fetchAllRows((from, to) =>
      supabase.from('posts').select('user_id, created_at').gte('created_at', startIso).lte('created_at', endIso)
        .eq('is_deleted', false).not('user_id', 'is', null).range(from, to) as PromiseLike<{ data: ActivityRow[] | null; error: { message: string } | null }>
    ),
    fetchAllRows((from, to) =>
      supabase.from('zukan_card_ratings').select('user_id, created_at').gte('created_at', startIso).lte('created_at', endIso)
        .eq('is_deleted', false).not('user_id', 'is', null).range(from, to) as PromiseLike<{ data: ActivityRow[] | null; error: { message: string } | null }>
    ),
    fetchAllRows((from, to) =>
      supabase.from('zukan_card_reviews').select('user_id, created_at').gte('created_at', startIso).lte('created_at', endIso)
        .eq('is_deleted', false).eq('is_hidden', false).not('user_id', 'is', null).range(from, to) as PromiseLike<{ data: ActivityRow[] | null; error: { message: string } | null }>
    ),
    fetchAllRows((from, to) =>
      supabase.from('zukan_pack_reviews').select('user_id, created_at').gte('created_at', startIso).lte('created_at', endIso)
        .eq('is_deleted', false).eq('is_hidden', false).not('user_id', 'is', null).range(from, to) as PromiseLike<{ data: ActivityRow[] | null; error: { message: string } | null }>
    ),
  ])

  const results = [threadRes, postRes, ratingRes, cardRevRes, packRevRes]
  const fetchError = results.find(result => result.errorMsg)?.errorMsg
  if (fetchError) return { entries: [], error: fetchError, overflow: false }
  if (results.some(result => result.overflow)) {
    return { entries: [], error: '対象データが多すぎるため集計できませんでした（1万件超）', overflow: true }
  }

  const activityMap = new Map<string, UserActivity>()
  const getOrCreate = (uid: string): UserActivity => {
    const existing = activityMap.get(uid)
    if (existing) return existing
    const created: UserActivity = {
      threadRawCount: 0,
      postRawCount: 0,
      cardReviewRawCount: 0,
      packReviewRawCount: 0,
      ratingRawCount: 0,
      threadCount: 0,
      postCount: 0,
      reviewCount: 0,
      ratingDays: 0,
      totalPoints: 0,
      lastActivity: '',
    }
    activityMap.set(uid, created)
    return created
  }
  const updateLast = (activity: UserActivity, createdAt: string) => {
    if (createdAt > activity.lastActivity) activity.lastActivity = createdAt
  }

  const sortedThreads = threadRes.rows.filter(row => row.user_id && row.created_at)
    .sort((a, b) => a.created_at! < b.created_at! ? -1 : 1)
  const dailyThreads = new Map<string, number>()
  for (const row of sortedThreads) {
    const activity = getOrCreate(row.user_id!)
    activity.threadRawCount++
    const key = `${row.user_id}|${toJstDate(row.created_at!)}`
    const count = (dailyThreads.get(key) ?? 0) + 1
    dailyThreads.set(key, count)
    if (count <= CAMPAIGN_THREAD_DAILY_LIMIT) {
      activity.threadCount++
      updateLast(activity, row.created_at!)
    }
  }

  const sortedPosts = postRes.rows.filter(row => row.user_id && row.created_at)
    .sort((a, b) => a.created_at! < b.created_at! ? -1 : 1)
  const dailyPosts = new Map<string, number>()
  for (const row of sortedPosts) {
    const activity = getOrCreate(row.user_id!)
    activity.postRawCount++
    const key = `${row.user_id}|${toJstDate(row.created_at!)}`
    const count = (dailyPosts.get(key) ?? 0) + 1
    dailyPosts.set(key, count)
    if (count <= CAMPAIGN_POST_DAILY_LIMIT) {
      activity.postCount++
      updateLast(activity, row.created_at!)
    }
  }

  const allReviews = [
    ...cardRevRes.rows.filter(row => row.user_id && row.created_at).map(row => ({ ...row, isCard: true })),
    ...packRevRes.rows.filter(row => row.user_id && row.created_at).map(row => ({ ...row, isCard: false })),
  ].sort((a, b) => a.created_at! < b.created_at! ? -1 : 1)
  const dailyReviews = new Map<string, number>()
  for (const row of allReviews) {
    const activity = getOrCreate(row.user_id!)
    if (row.isCard) activity.cardReviewRawCount++
    else activity.packReviewRawCount++
    const key = `${row.user_id}|${toJstDate(row.created_at!)}`
    const count = (dailyReviews.get(key) ?? 0) + 1
    dailyReviews.set(key, count)
    if (count <= CAMPAIGN_REVIEW_DAILY_LIMIT) {
      activity.reviewCount++
      updateLast(activity, row.created_at!)
    }
  }

  type DayInfo = { count: number; maxAt: string }
  const dailyRatings = new Map<string, DayInfo>()
  for (const row of ratingRes.rows) {
    if (!row.user_id || !row.created_at) continue
    getOrCreate(row.user_id).ratingRawCount++
    const key = `${row.user_id}|${toJstDate(row.created_at)}`
    const existing = dailyRatings.get(key)
    if (!existing) dailyRatings.set(key, { count: 1, maxAt: row.created_at })
    else {
      existing.count++
      if (row.created_at > existing.maxAt) existing.maxAt = row.created_at
    }
  }
  for (const [key, info] of dailyRatings) {
    if (info.count < CAMPAIGN_RATING_DAILY_THRESHOLD) continue
    const activity = activityMap.get(key.split('|')[0])
    if (activity) {
      activity.ratingDays++
      updateLast(activity, info.maxAt)
    }
  }

  for (const activity of activityMap.values()) {
    activity.totalPoints =
      activity.threadCount * CAMPAIGN_THREAD_POINT +
      activity.postCount * CAMPAIGN_POST_POINT +
      activity.reviewCount * CAMPAIGN_REVIEW_POINT +
      activity.ratingDays * CAMPAIGN_RATING_DAILY_POINT
  }

  const sortedActivities = Array.from(activityMap.entries()).sort(([uidA, a], [uidB, b]) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
    if (b.postCount !== a.postCount) return b.postCount - a.postCount
    if (b.reviewCount !== a.reviewCount) return b.reviewCount - a.reviewCount
    if (b.threadCount !== a.threadCount) return b.threadCount - a.threadCount
    if (a.lastActivity !== b.lastActivity) return a.lastActivity < b.lastActivity ? -1 : 1
    return uidA < uidB ? -1 : 1
  })

  const profileMap = new Map<string, CampaignRankingAdminProfile>()
  const userIds = sortedActivities.map(([uid]) => uid)
  for (let i = 0; i < userIds.length; i += 500) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, profile_slug, avatar_url, profile_hidden, ranking_enabled, rank_excluded, account_suspended, withdrawn_at, x_url')
      .in('id', userIds.slice(i, i + 500))
    if (error) return { entries: [], error: error.message, overflow: false }
    for (const profile of data ?? []) profileMap.set(profile.id, profile as CampaignRankingAdminProfile)
  }

  const entries = sortedActivities.map(([userId, activity]): InternalCampaignEntry => {
    const profile = profileMap.get(userId) ?? null
    const excludeReasons: string[] = []
    if (!profile) excludeReasons.push('プロフィールなし')
    else {
      if (!profile.profile_slug) excludeReasons.push('プロフィールURLなし')
      if (profile.withdrawn_at != null) excludeReasons.push('退会済み')
      if (profile.account_suspended) excludeReasons.push('アカウント停止')
      if (profile.profile_hidden) excludeReasons.push('プロフィール非公開')
      if (!profile.ranking_enabled) excludeReasons.push('ランキング無効')
      if (profile.rank_excluded) excludeReasons.push('除外設定')
    }
    return { userId, ...activity, profile, excludeReasons, eligible: excludeReasons.length === 0 }
  })

  return { entries, error: null, overflow: false }
}

export async function fetchCampaignRankingPublic(
  startIso: string,
  endIso: string,
): Promise<CampaignRankingPublicResult> {
  const result = await fetchCampaignRankingInternal(startIso, endIso)
  if (result.error) return { entries: [], error: result.error, overflow: result.overflow }

  const entries: PublicCampaignEntry[] = []
  for (const entry of result.entries) {
    if (!entry.eligible || !entry.profile?.profile_slug) continue
    entries.push({
      rank: entries.length + 1,
      displayName: entry.profile.display_name ?? entry.profile.profile_slug,
      profileSlug: entry.profile.profile_slug,
      avatarUrl: entry.profile.avatar_url,
      totalPoints: entry.totalPoints,
      threadCount: entry.threadCount,
      postCount: entry.postCount,
      reviewCount: entry.reviewCount,
      ratingDays: entry.ratingDays,
    })
    if (entries.length >= MAX_PUBLIC_DISPLAY) break
  }
  return { entries, error: null, overflow: false }
}

export async function fetchCampaignRankingAdmin(
  startIso: string,
  endIso: string,
): Promise<CampaignRankingAdminResult> {
  const result = await fetchCampaignRankingInternal(startIso, endIso)
  return {
    entries: result.entries.map(({ eligible: _eligible, ...entry }) => entry),
    error: result.error,
    overflow: result.overflow,
  }
}
