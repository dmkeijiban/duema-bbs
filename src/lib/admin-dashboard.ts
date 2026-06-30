import { createSign } from 'crypto'
import { unstable_cache } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'

export const ADMIN_DASHBOARD_CACHE_SECONDS = 21600

export type DashboardThread = {
  id: number
  title: string
  viewCount: number
  postCount: number
  lastPostedAt: string | null
  createdAt: string | null
}

export type RecentThreadActivity = DashboardThread & {
  recentComments: number
  latestCommentAt: string | null
}

export type InternalDashboardData = {
  totals: {
    threadCount: number
    commentCount: number
    totalViews: number
    avgViews: number
  }
  topViewedThreads: DashboardThread[]
  topCommentedThreads: DashboardThread[]
  recentCommentThreads: RecentThreadActivity[]
  zeroCommentThreads: DashboardThread[]
  highViewLowCommentThreads: DashboardThread[]
  riskThreads: RecentThreadActivity[]
}

export type Ga4MetricSummary = {
  todayViews: number
  yesterdayViews: number
  sevenDayViews: number
  twentyEightDayViews: number
  todayUsers: number
  sevenDayUsers: number
}

export type Ga4DailyPoint = {
  date: string
  views: number
  users: number
}

export type Ga4PageRow = {
  path: string
  views: number
  users: number
}

export type Ga4DashboardData = {
  ok: true
  propertyId: string
  trendDays: 7 | 28 | 90
  trendSummary: {
    totalViews: number
    totalUsers: number
    viewsPerUser: number
  }
  dailyTrend: Ga4DailyPoint[]
  summary: Ga4MetricSummary
  topPages: Ga4PageRow[]
  topThreadPages: Ga4PageRow[]
  topZukanPages: Ga4PageRow[]
} | {
  ok: false
  error: string
  missing?: string[]
}

type Ga4Config = {
  propertyId: string
  clientEmail: string
  privateKey: string
}

function toNumber(value: unknown) {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value) || 0
  return 0
}

function toStringOrNull(value: unknown) {
  return typeof value === 'string' ? value : null
}

function normalizeAnalyticsDays(value: number): 7 | 28 | 90 {
  if (value === 7) return 7
  if (value === 90) return 90
  return 28
}

function mapThread(row: Record<string, unknown>): DashboardThread {
  return {
    id: toNumber(row.id),
    title: typeof row.title === 'string' ? row.title : '（タイトルなし）',
    viewCount: toNumber(row.view_count),
    postCount: toNumber(row.post_count),
    lastPostedAt: toStringOrNull(row.last_posted_at),
    createdAt: toStringOrNull(row.created_at),
  }
}

function getThreadFromPost(row: Record<string, unknown>) {
  const thread = row.threads
  if (!thread || Array.isArray(thread) || typeof thread !== 'object') return null
  return mapThread(thread as Record<string, unknown>)
}

function buildRecentActivity(posts: Record<string, unknown>[], limit: number) {
  const grouped = new Map<number, RecentThreadActivity>()

  posts.forEach(row => {
    const thread = getThreadFromPost(row)
    if (!thread) return

    const createdAt = toStringOrNull(row.created_at)
    const current = grouped.get(thread.id)
    if (!current) {
      grouped.set(thread.id, {
        ...thread,
        recentComments: 1,
        latestCommentAt: createdAt,
      })
      return
    }

    current.recentComments += 1
    if (createdAt && (!current.latestCommentAt || createdAt > current.latestCommentAt)) {
      current.latestCommentAt = createdAt
    }
  })

  return [...grouped.values()]
    .sort((a, b) => {
      if (b.recentComments !== a.recentComments) return b.recentComments - a.recentComments
      return (b.latestCommentAt ?? '').localeCompare(a.latestCommentAt ?? '')
    })
    .slice(0, limit)
}

export async function getInternalDashboardData(adminSupabase: SupabaseClient): Promise<InternalDashboardData> {
  const yesterdayIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [
    threadCountRes,
    commentCountRes,
    topViewedRes,
    topCommentedRes,
    zeroCommentRes,
    recentPostsRes,
    highViewCandidatesRes,
  ] = await Promise.all([
    adminSupabase.from('threads').select('id', { count: 'exact', head: true }),
    adminSupabase.from('posts').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
    adminSupabase
      .from('threads')
      .select('id, title, view_count, post_count, created_at, last_posted_at')
      .eq('is_archived', false)
      .order('view_count', { ascending: false, nullsFirst: false })
      .limit(8),
    adminSupabase
      .from('threads')
      .select('id, title, view_count, post_count, created_at, last_posted_at')
      .eq('is_archived', false)
      .order('post_count', { ascending: false, nullsFirst: false })
      .limit(8),
    adminSupabase
      .from('threads')
      .select('id, title, view_count, post_count, created_at, last_posted_at')
      .eq('is_archived', false)
      .eq('post_count', 0)
      .order('view_count', { ascending: false, nullsFirst: false })
      .limit(8),
    adminSupabase
      .from('posts')
      .select('id, thread_id, created_at, threads!inner(id, title, view_count, post_count, created_at, last_posted_at, is_archived)')
      .eq('is_deleted', false)
      .eq('threads.is_archived', false)
      .gte('created_at', yesterdayIso)
      .order('created_at', { ascending: false })
      .limit(300),
    adminSupabase
      .from('threads')
      .select('id, title, view_count, post_count, created_at, last_posted_at')
      .eq('is_archived', false)
      .order('view_count', { ascending: false, nullsFirst: false })
      .limit(80),
  ])

  const topViewedThreads = ((topViewedRes.data ?? []) as Record<string, unknown>[]).map(mapThread)
  const topCommentedThreads = ((topCommentedRes.data ?? []) as Record<string, unknown>[]).map(mapThread)
  const zeroCommentThreads = ((zeroCommentRes.data ?? []) as Record<string, unknown>[]).map(mapThread)
  const recentCommentThreads = buildRecentActivity((recentPostsRes.data ?? []) as Record<string, unknown>[], 8)
  const highViewLowCommentThreads = ((highViewCandidatesRes.data ?? []) as Record<string, unknown>[])
    .map(mapThread)
    .filter(thread => thread.postCount <= 2 && thread.viewCount >= 20)
    .slice(0, 8)
  const riskThreads = recentCommentThreads
    .filter(thread => thread.recentComments >= 3 || thread.postCount >= 10)
    .slice(0, 8)

  const STAT_PAGE = 1000
  let totalViews = 0
  for (let offset = 0; offset < 5_000_000; offset += STAT_PAGE) {
    const { data: viewRows } = await adminSupabase
      .from('threads')
      .select('view_count')
      .range(offset, offset + STAT_PAGE - 1)

    if (!viewRows || viewRows.length === 0) break
    totalViews += (viewRows as Record<string, unknown>[]).reduce((sum, row) => sum + toNumber(row.view_count), 0)
    if (viewRows.length < STAT_PAGE) break
  }

  const threadCount = threadCountRes.count ?? 0
  const commentCount = commentCountRes.count ?? 0

  return {
    totals: {
      threadCount,
      commentCount,
      totalViews,
      avgViews: threadCount > 0 ? Math.round(totalViews / threadCount) : 0,
    },
    topViewedThreads,
    topCommentedThreads,
    recentCommentThreads,
    zeroCommentThreads,
    highViewLowCommentThreads,
    riskThreads,
  }
}

function getGa4Config(): { config?: Ga4Config; missing: string[] } {
  const json = process.env.GA4_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  let jsonConfig: Partial<Ga4Config> = {}

  if (json) {
    try {
      const parsed = JSON.parse(json) as {
        client_email?: string
        private_key?: string
        property_id?: string
      }
      jsonConfig = {
        propertyId: parsed.property_id,
        clientEmail: parsed.client_email,
        privateKey: parsed.private_key,
      }
    } catch {
      return { missing: ['GA4_SERVICE_ACCOUNT_JSON parse failed'] }
    }
  }

  const propertyId = process.env.GA4_PROPERTY_ID
    || process.env.GOOGLE_ANALYTICS_PROPERTY_ID
    || jsonConfig.propertyId
  const clientEmail = process.env.GA4_CLIENT_EMAIL
    || process.env.GOOGLE_CLIENT_EMAIL
    || jsonConfig.clientEmail
  const privateKey = process.env.GA4_PRIVATE_KEY
    || process.env.GOOGLE_PRIVATE_KEY
    || jsonConfig.privateKey

  const missing = [
    ['GA4_PROPERTY_ID', propertyId],
    ['GA4_CLIENT_EMAIL', clientEmail],
    ['GA4_PRIVATE_KEY', privateKey],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name)
    .filter((name): name is string => Boolean(name))

  if (missing.length > 0 || !propertyId || !clientEmail || !privateKey) {
    return { missing }
  }

  return {
    config: {
      propertyId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    },
    missing: [],
  }
}

function base64Url(input: string | Buffer) {
  return Buffer.from(input).toString('base64url')
}

async function getGa4AccessToken(config: Ga4Config) {
  const now = Math.floor(Date.now() / 1000)
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = base64Url(JSON.stringify({
    iss: config.clientEmail,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }))
  const unsigned = `${header}.${payload}`
  const signature = createSign('RSA-SHA256').update(unsigned).sign(config.privateKey)
  const assertion = `${unsigned}.${base64Url(signature)}`

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
    signal: AbortSignal.timeout(8000),
  })

  if (!response.ok) {
    throw new Error(`GA4 auth failed: ${response.status}`)
  }

  const json = await response.json() as { access_token?: string }
  if (!json.access_token) throw new Error('GA4 auth failed: access token missing')
  return json.access_token
}

async function runGa4Report(config: Ga4Config, token: string, body: Record<string, unknown>) {
  const response = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${config.propertyId}:runReport`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    },
  )

  if (!response.ok) {
    throw new Error(`GA4 report failed: ${response.status}`)
  }

  return response.json() as Promise<{
    rows?: Array<{
      dimensionValues?: Array<{ value?: string }>
      metricValues?: Array<{ value?: string }>
    }>
  }>
}

async function getRangeMetrics(config: Ga4Config, token: string, startDate: string, endDate: string) {
  const json = await runGa4Report(config, token, {
    dateRanges: [{ startDate, endDate }],
    metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
  })
  const row = json.rows?.[0]
  return {
    views: toNumber(row?.metricValues?.[0]?.value),
    users: toNumber(row?.metricValues?.[1]?.value),
  }
}

function formatGaDate(value: string) {
  if (!/^\d{8}$/.test(value)) return value
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
}

function ymd(date: Date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function fillDailyTrend(points: Ga4DailyPoint[], days: 7 | 28 | 90) {
  const byDate = new Map(points.map(point => [point.date, point]))
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  start.setUTCDate(start.getUTCDate() - (days - 1))

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start)
    date.setUTCDate(start.getUTCDate() + index)
    const key = ymd(date)
    return byDate.get(key) ?? { date: key, views: 0, users: 0 }
  })
}

async function getDailyTrend(config: Ga4Config, token: string, days: 7 | 28 | 90) {
  const json = await runGa4Report(config, token, {
    dateRanges: [{ startDate: `${days - 1}daysAgo`, endDate: 'today' }],
    dimensions: [{ name: 'date' }],
    metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
    orderBys: [{ dimension: { dimensionName: 'date' } }],
    limit: days,
  })

  const points = (json.rows ?? []).map(row => ({
    date: formatGaDate(row.dimensionValues?.[0]?.value ?? ''),
    views: toNumber(row.metricValues?.[0]?.value),
    users: toNumber(row.metricValues?.[1]?.value),
  })).filter(point => point.date)

  return fillDailyTrend(points, days)
}

async function getPageRows(
  config: Ga4Config,
  token: string,
  limit: number,
  pathPrefix?: string,
): Promise<Ga4PageRow[]> {
  const body: Record<string, unknown> = {
    dateRanges: [{ startDate: '6daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'pagePath' }],
    metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit,
  }

  if (pathPrefix) {
    body.dimensionFilter = {
      filter: {
        fieldName: 'pagePath',
        stringFilter: {
          matchType: 'BEGINS_WITH',
          value: pathPrefix,
        },
      },
    }
  }

  const json = await runGa4Report(config, token, body)
  return (json.rows ?? []).map(row => ({
    path: row.dimensionValues?.[0]?.value ?? '(not set)',
    views: toNumber(row.metricValues?.[0]?.value),
    users: toNumber(row.metricValues?.[1]?.value),
  }))
}

async function fetchGa4DashboardData(daysValue = 28): Promise<Ga4DashboardData> {
  const trendDays = normalizeAnalyticsDays(daysValue)
  const { config, missing } = getGa4Config()
  if (!config) {
    return {
      ok: false,
      error: 'GA4 Data API の環境変数が未設定です。',
      missing,
    }
  }

  try {
    const token = await getGa4AccessToken(config)
    const [
      today,
      yesterday,
      sevenDays,
      twentyEightDays,
      trendRange,
      dailyTrend,
      topPages,
      topThreadPages,
      topZukanPages,
    ] = await Promise.all([
      getRangeMetrics(config, token, 'today', 'today'),
      getRangeMetrics(config, token, 'yesterday', 'yesterday'),
      getRangeMetrics(config, token, '6daysAgo', 'today'),
      getRangeMetrics(config, token, '27daysAgo', 'today'),
      trendDays === 7
        ? getRangeMetrics(config, token, '6daysAgo', 'today')
        : trendDays === 28
          ? getRangeMetrics(config, token, '27daysAgo', 'today')
          : getRangeMetrics(config, token, '89daysAgo', 'today'),
      getDailyTrend(config, token, trendDays),
      getPageRows(config, token, 10),
      getPageRows(config, token, 10, '/thread/'),
      getPageRows(config, token, 10, '/zukan'),
    ])

    return {
      ok: true,
      propertyId: config.propertyId,
      trendDays,
      trendSummary: {
        totalViews: trendRange.views,
        totalUsers: trendRange.users,
        viewsPerUser: trendRange.users > 0 ? trendRange.views / trendRange.users : 0,
      },
      dailyTrend,
      summary: {
        todayViews: today.views,
        yesterdayViews: yesterday.views,
        sevenDayViews: sevenDays.views,
        twentyEightDayViews: twentyEightDays.views,
        todayUsers: today.users,
        sevenDayUsers: sevenDays.users,
      },
      topPages,
      topThreadPages,
      topZukanPages,
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'GA4 Data API の取得に失敗しました。',
    }
  }
}

export const getGa4DashboardData = unstable_cache(
  fetchGa4DashboardData,
  ['admin-ga4-dashboard'],
  { revalidate: ADMIN_DASHBOARD_CACHE_SECONDS, tags: ['admin-ga4-dashboard'] },
)
