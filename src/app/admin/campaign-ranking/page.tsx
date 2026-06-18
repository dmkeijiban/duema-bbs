import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase-admin'
import { verifyAdminCookie } from '@/lib/admin-auth'
import { saveCampaignRankingAction, clearCampaignRankingAction } from './actions'
import {
  CAMPAIGN_THREAD_POINT,
  CAMPAIGN_THREAD_DAILY_LIMIT,
  CAMPAIGN_POST_POINT,
  CAMPAIGN_POST_DAILY_LIMIT,
  CAMPAIGN_REVIEW_POINT,
  CAMPAIGN_REVIEW_DAILY_LIMIT,
  CAMPAIGN_RATING_DAILY_THRESHOLD,
  CAMPAIGN_RATING_DAILY_POINT,
} from '@/lib/ranking-points'

const ADMIN_COOKIE = 'admin_auth'
const PAGE_SIZE = 1000
const MAX_PAGES = 10
const MAX_DISPLAY = 100

// ---- Types ----

type ActivityRow = { user_id: string | null; created_at: string | null }

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
  lastActivity: string
}

type ProfileRow = {
  id: string
  display_name: string | null
  profile_slug: string | null
  profile_hidden: boolean | null
  ranking_enabled: boolean | null
  rank_excluded: boolean | null
  account_suspended: boolean | null
  withdrawn_at: string | null
  x_url: string | null
}

type CampaignRankingEntry = UserActivity & {
  userId: string
  totalPoints: number
  profile: ProfileRow | null
  excludeReasons: string[]
}

type RankingResult = {
  entries: CampaignRankingEntry[]
  error: string | null
  overflow: boolean
}

// ---- Admin helpers ----

async function requireAdmin() {
  const cookieStore = await cookies()
  if (!verifyAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value)) {
    redirect('/admin')
  }
}

function toDatetimeLocal(isoJst: string): string {
  if (!isoJst) return ''
  const m = isoJst.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/)
  return m ? m[1] : ''
}

function toDisplayJst(isoJst: string): string {
  if (!isoJst) return ''
  const m = isoJst.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!m) return isoJst
  return `${m[1]}/${m[2]}/${m[3]} ${m[4]}:${m[5]}`
}

// ---- Campaign ranking helpers ----

function toJstDate(utcIso: string): string {
  const jstMs = new Date(utcIso).getTime() + 9 * 60 * 60 * 1000
  return new Date(jstMs).toISOString().slice(0, 10)
}

type PageFetcher = (from: number, to: number) => PromiseLike<{
  data: ActivityRow[] | null
  error: { message: string } | null
}>

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

async function fetchCampaignRanking(
  startIso: string,
  endIso: string,
): Promise<RankingResult> {
  const supabase = createAdminClient()

  // Fetch all activity tables in parallel.
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
    // Ratings: is_deleted only (no is_hidden column), user_id IS NOT NULL
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

  const activityMap = new Map<string, UserActivity>()
  const getOrCreate = (uid: string): UserActivity => {
    if (!activityMap.has(uid)) {
      activityMap.set(uid, {
        threadRawCount: 0,
        postRawCount: 0,
        cardReviewRawCount: 0,
        packReviewRawCount: 0,
        ratingRawCount: 0,
        threadCount: 0,
        postCount: 0,
        reviewCount: 0,
        ratingDays: 0,
        lastActivity: '',
      })
    }
    return activityMap.get(uid)!
  }
  const updateLast = (a: UserActivity, createdAt: string) => {
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
    if (n <= CAMPAIGN_THREAD_DAILY_LIMIT) {
      a.threadCount++
      updateLast(a, row.created_at!)
    }
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
    if (n <= CAMPAIGN_POST_DAILY_LIMIT) {
      a.postCount++
      updateLast(a, row.created_at!)
    }
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
    if (n <= CAMPAIGN_REVIEW_DAILY_LIMIT) {
      a.reviewCount++
      updateLast(a, row.created_at!)
    }
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
      if (a) {
        a.ratingDays++
        updateLast(a, info.maxAt)
      }
    }
  }

  // Build entries with total points
  const entries: CampaignRankingEntry[] = []
  for (const [userId, activity] of activityMap) {
    const totalPoints =
      activity.threadCount * CAMPAIGN_THREAD_POINT +
      activity.postCount * CAMPAIGN_POST_POINT +
      activity.reviewCount * CAMPAIGN_REVIEW_POINT +
      activity.ratingDays * CAMPAIGN_RATING_DAILY_POINT
    entries.push({ userId, totalPoints, profile: null, excludeReasons: [], ...activity })
  }

  // Fetch profiles in chunks of 500
  const userIds = Array.from(activityMap.keys())
  const profileMap = new Map<string, ProfileRow>()
  for (let i = 0; i < userIds.length; i += 500) {
    const chunk = userIds.slice(i, i + 500)
    const { data: pRows } = await supabase
      .from('profiles')
      .select('id, display_name, profile_slug, profile_hidden, ranking_enabled, rank_excluded, account_suspended, withdrawn_at, x_url')
      .in('id', chunk)
    for (const p of pRows ?? []) profileMap.set(p.id, p as ProfileRow)
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

// ---- Page ----

export default async function CampaignRankingPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; cleared?: string; error?: string }>
}) {
  await requireAdmin()
  const sp = await searchParams

  const supabase = createAdminClient()
  const { data: rows } = await supabase
    .from('site_settings')
    .select('key, value')
    .in('key', ['campaign_status', 'campaign_title', 'campaign_start', 'campaign_end', 'campaign_prize', 'campaign_rules_url'])

  const settings: Record<string, string> = {}
  for (const row of rows ?? []) settings[row.key] = row.value

  const status = settings['campaign_status'] ?? 'draft'
  const title = settings['campaign_title'] ?? ''
  const startIso = settings['campaign_start'] ?? ''
  const endIso = settings['campaign_end'] ?? ''
  const prize = settings['campaign_prize'] ?? ''
  const rulesUrl = settings['campaign_rules_url'] ?? ''

  const STATUS_LABELS: Record<string, string> = {
    draft: '下書き（非公開）',
    active: '開催中',
    ended: '終了',
    finalized: '確定済み',
  }

  const ERROR_MESSAGES: Record<string, string> = {
    unauthorized: '認証エラーです。再ログインしてください',
    invalid_status: 'ステータスが不正です',
    required: '必須項目を入力してください',
    invalid_datetime: '日時の形式が正しくありません',
    invalid_range: '終了日時は開始日時より後にしてください',
    invalid_rules_url: 'ルールスレッドURLを確認してください（/thread/数字 または https://www.duema-bbs.com/thread/数字）',
    save_failed: 'キャンペーン設定の保存に失敗しました',
  }

  // Fetch ranking preview only when campaign period is configured
  let rankingResult: RankingResult | null = null
  if (startIso && endIso) {
    rankingResult = await fetchCampaignRanking(startIso, endIso)
  }

  const displayed = rankingResult?.entries.slice(0, MAX_DISPLAY) ?? []
  const totalEntrants = rankingResult?.entries.length ?? 0

  return (
    <div className="max-w-screen-xl mx-auto px-3 py-4 text-sm">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">🏆 キャンペーンランキング設定</h1>
        <Link href="/admin" className="text-xs text-blue-600 hover:underline">← 管理画面に戻る</Link>
      </div>

      {sp.saved === '1' && (
        <div className="mb-4 border border-green-300 bg-green-50 px-3 py-2 text-xs text-green-800">
          キャンペーン設定を保存しました
        </div>
      )}
      {sp.cleared === '1' && (
        <div className="mb-4 border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
          キャンペーン設定をクリアしました
        </div>
      )}
      {sp.error && (
        <div className="mb-4 border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
          {ERROR_MESSAGES[sp.error] ?? 'キャンペーン設定の保存に失敗しました'}
        </div>
      )}

      <p className="text-xs text-gray-500 mb-4">
        投稿者ランキング企画の開催期間や公開状態を設定します。設定を保存しても、公開ランキング機能が実装されるまでは一般画面には表示されません。
      </p>

      {/* Settings display */}
      <div className="bg-white border border-gray-200 p-4 mb-4">
        <h2 className="font-bold text-blue-700 mb-3 text-xs uppercase tracking-wide">現在の設定</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
          <dt className="text-gray-500 whitespace-nowrap">ステータス</dt>
          <dd className="text-gray-800 font-medium">{STATUS_LABELS[status] ?? status}</dd>
          <dt className="text-gray-500 whitespace-nowrap">タイトル</dt>
          <dd className="text-gray-800">{title || '（未設定）'}</dd>
          <dt className="text-gray-500 whitespace-nowrap">開始日時 (JST)</dt>
          <dd className="text-gray-800">{toDisplayJst(startIso) || '（未設定）'}</dd>
          <dt className="text-gray-500 whitespace-nowrap">終了日時 (JST)</dt>
          <dd className="text-gray-800">{toDisplayJst(endIso) || '（未設定）'}</dd>
          <dt className="text-gray-500 whitespace-nowrap">賞品</dt>
          <dd className="text-gray-800">{prize || '（未設定）'}</dd>
          <dt className="text-gray-500 whitespace-nowrap">ルールURL</dt>
          <dd className="text-gray-800 break-all">{rulesUrl || '（未設定）'}</dd>
        </dl>
      </div>

      {/* Edit form */}
      <div className="bg-white border border-gray-200 p-4 mb-6">
        <h2 className="font-bold text-blue-700 mb-3 text-xs uppercase tracking-wide">設定を編集</h2>
        <form action={saveCampaignRankingAction} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-600 mb-0.5">
              ステータス <span className="text-red-500">*</span>
            </label>
            <select
              name="campaign_status"
              defaultValue={status}
              className="border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400 w-48"
              required
            >
              <option value="draft">下書き（非公開）</option>
              <option value="active">開催中</option>
              <option value="ended">終了</option>
              <option value="finalized">確定済み</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-0.5">
              タイトル <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="campaign_title"
              defaultValue={title}
              placeholder="例: 6月投稿者ランキング企画"
              className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-0.5">
                開始日時（日本時間）<span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                name="campaign_start"
                defaultValue={toDatetimeLocal(startIso)}
                className="border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400 w-full"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-0.5">
                終了日時（日本時間）<span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                name="campaign_end"
                defaultValue={toDatetimeLocal(endIso)}
                className="border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400 w-full"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-0.5">賞品</label>
            <input
              type="text"
              name="campaign_prize"
              defaultValue={prize}
              placeholder="例: Amazonギフト券1000円分"
              className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-0.5">ルールURL</label>
            <input
              type="text"
              name="campaign_rules_url"
              defaultValue={rulesUrl}
              placeholder="/thread/123 または https://www.duema-bbs.com/thread/123"
              className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>

          <div className="pt-1">
            <button
              type="submit"
              className="px-4 py-1.5 text-white text-xs font-medium"
              style={{ background: '#0d6efd' }}
            >
              保存する
            </button>
          </div>
        </form>

        <form action={clearCampaignRankingAction} className="mt-4 pt-4 border-t border-gray-100">
          <button
            type="submit"
            className="px-3 py-1 text-xs text-red-600 border border-red-300 hover:bg-red-50"
            onClick={(e) => { if (!confirm('キャンペーン設定をすべてクリアしますか？')) e.preventDefault() }}
          >
            設定をクリアする
          </button>
          <p className="mt-1 text-xs text-gray-400">ステータスを「下書き」に戻し、すべての項目を空にします</p>
        </form>
      </div>

      {/* Ranking preview */}
      <div className="bg-white border border-gray-200 p-4">
        <h2 className="font-bold text-blue-700 mb-1 text-xs uppercase tracking-wide">
          ランキング集計プレビュー
        </h2>
        <p className="text-xs text-gray-400 mb-3">
          スレ {CAMPAIGN_THREAD_POINT}pt（{CAMPAIGN_THREAD_DAILY_LIMIT}件/日上限）
          コメント {CAMPAIGN_POST_POINT}pt（{CAMPAIGN_POST_DAILY_LIMIT}件/日上限）
          レビュー {CAMPAIGN_REVIEW_POINT}pt（{CAMPAIGN_REVIEW_DAILY_LIMIT}件/日上限・カード+パック合算）
          評価 {CAMPAIGN_RATING_DAILY_THRESHOLD}件/日達成で{CAMPAIGN_RATING_DAILY_POINT}pt（ログインのみ）
        </p>

        {!startIso || !endIso ? (
          <p className="text-xs text-gray-400">キャンペーン期間を設定すると集計結果が表示されます。</p>
        ) : rankingResult?.error ? (
          <div className="border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            集計エラー: {rankingResult.error}
          </div>
        ) : totalEntrants === 0 ? (
          <p className="text-xs text-gray-400">対象期間のアクティビティがありません。</p>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-2">
              参加者 {totalEntrants}人
              {totalEntrants > MAX_DISPLAY && `（上位${MAX_DISPLAY}人を表示）`}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-600">
                    <th className="border border-gray-200 px-2 py-1 text-center whitespace-nowrap">#</th>
                    <th className="border border-gray-200 px-2 py-1 text-left whitespace-nowrap">ユーザー</th>
                    <th className="border border-gray-200 px-2 py-1 text-center whitespace-nowrap">合計P</th>
                    <th className="border border-gray-200 px-2 py-1 text-center whitespace-nowrap">コメント</th>
                    <th className="border border-gray-200 px-2 py-1 text-center whitespace-nowrap">レビュー</th>
                    <th className="border border-gray-200 px-2 py-1 text-center whitespace-nowrap">スレ</th>
                    <th className="border border-gray-200 px-2 py-1 text-center whitespace-nowrap">評価達成日</th>
                    <th className="border border-gray-200 px-2 py-1 text-left whitespace-nowrap">最終加点</th>
                    <th className="border border-gray-200 px-2 py-1 text-center whitespace-nowrap">X</th>
                    <th className="border border-gray-200 px-2 py-1 text-left whitespace-nowrap">備考</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((entry, idx) => {
                    const isExcluded = entry.excludeReasons.length > 0
                    const name = entry.profile?.display_name ?? '（名前なし）'
                    const slug = entry.profile?.profile_slug
                    const lastAt = entry.lastActivity
                      ? toDisplayJst(new Date(entry.lastActivity).toISOString().replace('Z', '+00:00').replace(/\.\d+/, '').replace('T', 'T'))
                      : '—'
                    return (
                      <tr
                        key={entry.userId}
                        className={isExcluded ? 'bg-gray-50 text-gray-400' : 'hover:bg-blue-50'}
                      >
                        <td className="border border-gray-200 px-2 py-1 text-center font-mono">
                          {isExcluded ? '—' : idx + 1}
                        </td>
                        <td className="border border-gray-200 px-2 py-1 max-w-[12rem] truncate">
                          {slug ? (
                            <Link
                              href={`/profile/${slug}`}
                              target="_blank"
                              className="text-blue-600 hover:underline"
                            >
                              {name}
                            </Link>
                          ) : (
                            <span>{name}</span>
                          )}
                          <span className="ml-1 font-mono text-gray-300 text-[10px]">
                            {entry.userId.slice(0, 8)}
                          </span>
                        </td>
                        <td className="border border-gray-200 px-2 py-1 text-center font-bold">
                          {entry.totalPoints}
                        </td>
                        <td className="border border-gray-200 px-2 py-1 text-center">
                          {entry.postCount}
                          <span className="text-gray-300">/{entry.postRawCount}</span>
                        </td>
                        <td className="border border-gray-200 px-2 py-1 text-center">
                          {entry.reviewCount}
                          <span className="text-gray-300">/{entry.cardReviewRawCount + entry.packReviewRawCount}</span>
                        </td>
                        <td className="border border-gray-200 px-2 py-1 text-center">
                          {entry.threadCount}
                          <span className="text-gray-300">/{entry.threadRawCount}</span>
                        </td>
                        <td className="border border-gray-200 px-2 py-1 text-center">
                          {entry.ratingDays}日
                          <span className="text-gray-300">/{entry.ratingRawCount}件</span>
                        </td>
                        <td className="border border-gray-200 px-2 py-1 text-[10px] whitespace-nowrap">
                          {lastAt}
                        </td>
                        <td className="border border-gray-200 px-2 py-1 text-center text-[10px]">
                          {(() => {
                            const u = entry.profile?.x_url ?? null
                            const safe = u && /^https:\/\/(x\.com|twitter\.com)\//.test(u)
                            return safe ? (
                              <a href={u} target="_blank" rel="nofollow noopener noreferrer" className="text-blue-500 hover:underline">X</a>
                            ) : '—'}
                          )()}
                        </td>
                        <td className="border border-gray-200 px-2 py-1 text-[10px] text-red-500">
                          {entry.excludeReasons.join(' / ')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
