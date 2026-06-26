import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase-admin'
import { verifyAdminCookie } from '@/lib/admin-auth'
import {
  USER_RANKING_CARD_RATING_POINT,
  USER_RANKING_CARD_REVIEW_POINT,
  USER_RANKING_PACK_REVIEW_POINT,
  USER_RANKING_POST_POINT,
  USER_RANKING_THREAD_POINT,
} from '@/lib/ranking-points'

const PROFILE_LIMIT = 100
const RANKING_LIMIT = 50
const ACTIVITY_FETCH_LIMIT = 10000
const DAILY_CAP = 24
const CAP_START_DATE_JST = '2026-06-26'

type ProfileRow = {
  id: string
  display_name: string | null
  profile_slug: string | null
  profile_hidden: boolean | null
  ranking_enabled: boolean | null
  rank_excluded: boolean | null
  account_suspended: boolean | null
  withdrawn_at: string | null
}

type ActivityRow = {
  user_id: string | null
  created_at: string | null
}

type RankingRow = {
  profile: ProfileRow
  threadCount: number
  postCount: number
  cardRatingCount: number
  cardReviewCount: number
  packReviewCount: number
  points: number
}

async function requireAdmin() {
  const cookieStore = await cookies()
  const adminCookie = cookieStore.get('admin_auth')?.value
  if (!verifyAdminCookie(adminCookie)) {
    redirect('/admin')
  }
}

function getMonthStartIso() {
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

function toJstDateKey(isoString: string): string {
  return new Date(new Date(isoString).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function buildDailyPointsMap(
  ...activitySets: Array<{ rows: ActivityRow[]; pts: number }>
): Map<string, number> {
  // cap開始日以降: userId → dateKey → 日別ポイント合計
  const dailyMap = new Map<string, Map<string, number>>()
  // cap開始日より前: userId → 旧計算ポイント合計（上限なし）
  const legacyTotals = new Map<string, number>()

  for (const { rows, pts } of activitySets) {
    for (const row of rows) {
      if (!row.user_id || !row.created_at) continue
      const dateKey = toJstDateKey(row.created_at)
      if (dateKey < CAP_START_DATE_JST) {
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
      cappedTotal += Math.min(dayPts, DAILY_CAP)
    }
    totals.set(userId, (totals.get(userId) ?? 0) + cappedTotal)
  }
  return totals
}

function countByUser(rows: ActivityRow[]) {
  const counts = new Map<string, number>()

  for (const row of rows) {
    if (!row.user_id) continue
    counts.set(row.user_id, (counts.get(row.user_id) ?? 0) + 1)
  }

  return counts
}

function buildRanking(
  profiles: ProfileRow[],
  threadRows: ActivityRow[],
  postRows: ActivityRow[],
  cardRatingRows: ActivityRow[],
  cardReviewRows: ActivityRow[],
  packReviewRows: ActivityRow[]
) {
  const threadCounts = countByUser(threadRows)
  const postCounts = countByUser(postRows)
  const cardRatingCounts = countByUser(cardRatingRows)
  const cardReviewCounts = countByUser(cardReviewRows)
  const packReviewCounts = countByUser(packReviewRows)

  const pointsMap = buildDailyPointsMap(
    { rows: threadRows, pts: USER_RANKING_THREAD_POINT },
    { rows: postRows, pts: USER_RANKING_POST_POINT },
    { rows: cardRatingRows, pts: USER_RANKING_CARD_RATING_POINT },
    { rows: cardReviewRows, pts: USER_RANKING_CARD_REVIEW_POINT },
    { rows: packReviewRows, pts: USER_RANKING_PACK_REVIEW_POINT },
  )

  return profiles
    .map((profile): RankingRow => {
      const threadCount = threadCounts.get(profile.id) ?? 0
      const postCount = postCounts.get(profile.id) ?? 0
      const cardRatingCount = cardRatingCounts.get(profile.id) ?? 0
      const cardReviewCount = cardReviewCounts.get(profile.id) ?? 0
      const packReviewCount = packReviewCounts.get(profile.id) ?? 0
      return {
        profile,
        threadCount,
        postCount,
        cardRatingCount,
        cardReviewCount,
        packReviewCount,
        points: pointsMap.get(profile.id) ?? 0,
      }
    })
    .filter(row => row.points > 0)
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.threadCount !== a.threadCount) return b.threadCount - a.threadCount
      return b.postCount - a.postCount
    })
    .slice(0, RANKING_LIMIT)
}

function RankingTable({
  title,
  rows,
}: {
  title: string
  rows: RankingRow[]
}) {
  return (
    <section className="border border-gray-300 bg-white">
      <div className="border-b border-gray-200 bg-gray-50 px-3 py-2">
        <h2 className="font-bold text-gray-800">{title}</h2>
      </div>

      {rows.length === 0 ? (
        <div className="px-3 py-8 text-center text-sm text-gray-500">
          対象になる投稿者はまだありません。
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-xs">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="whitespace-nowrap border-b border-gray-200 px-3 py-2 font-semibold">
                  順位
                </th>
                <th className="whitespace-nowrap border-b border-gray-200 px-3 py-2 font-semibold">
                  表示名
                </th>
                <th className="whitespace-nowrap border-b border-gray-200 px-3 py-2 font-semibold">
                  slug
                </th>
                <th className="whitespace-nowrap border-b border-gray-200 px-3 py-2 font-semibold">
                  投稿者ページ
                </th>
                <th className="whitespace-nowrap border-b border-gray-200 px-3 py-2 text-right font-semibold">
                  スレ
                </th>
                <th className="whitespace-nowrap border-b border-gray-200 px-3 py-2 text-right font-semibold">
                  コメント
                </th>
                <th className="whitespace-nowrap border-b border-gray-200 px-3 py-2 text-right font-semibold">
                  評価
                </th>
                <th className="whitespace-nowrap border-b border-gray-200 px-3 py-2 text-right font-semibold">
                  カードレビュー
                </th>
                <th className="whitespace-nowrap border-b border-gray-200 px-3 py-2 text-right font-semibold">
                  パックレビュー
                </th>
                <th className="whitespace-nowrap border-b border-gray-200 px-3 py-2 text-right font-semibold">
                  pt
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const slug = row.profile.profile_slug ?? ''

                return (
                  <tr key={row.profile.id} className="border-b border-gray-100 last:border-b-0">
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-gray-600">
                      {index + 1}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-medium text-gray-800">
                      {row.profile.display_name || '(未設定)'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-gray-700">
                      {slug || '-'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {slug ? (
                        <Link
                          href={`/u/${slug}`}
                          className="text-blue-600 hover:underline"
                          target="_blank"
                        >
                          /u/{slug}
                        </Link>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-gray-700">
                      {row.threadCount}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-gray-700">
                      {row.postCount}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-gray-700">
                      {row.cardRatingCount}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-gray-700">
                      {row.cardReviewCount}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-gray-700">
                      {row.packReviewCount}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono font-bold text-gray-900">
                      {row.points}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default async function AdminRankingPreviewPage() {
  await requireAdmin()

  const supabase = createAdminClient()
  const monthStartIso = getMonthStartIso()

  const { data: profilesData, error: profilesError } = await supabase
    .from('profiles')
    .select(
      'id, display_name, profile_slug, profile_hidden, ranking_enabled, rank_excluded, account_suspended, withdrawn_at'
    )
    .eq('profile_hidden', false)
    .eq('ranking_enabled', true)
    .eq('rank_excluded', false)
    .eq('account_suspended', false)
    .is('withdrawn_at', null)
    .order('created_at', { ascending: false })
    .limit(PROFILE_LIMIT)

  const profiles = (profilesData ?? []) as ProfileRow[]
  const userIds = profiles.map(profile => profile.id)

  const emptyActivity = { data: [] as ActivityRow[], error: null }
  const [
    monthThreads,
    monthPosts,
    monthCardRatings,
    monthCardReviews,
    monthPackReviews,
    totalThreads,
    totalPosts,
    totalCardRatings,
    totalCardReviews,
    totalPackReviews,
  ] =
    userIds.length === 0
      ? [
          emptyActivity,
          emptyActivity,
          emptyActivity,
          emptyActivity,
          emptyActivity,
          emptyActivity,
          emptyActivity,
          emptyActivity,
          emptyActivity,
          emptyActivity,
        ]
      : await Promise.all([
          supabase
            .from('threads')
            .select('user_id, created_at')
            .in('user_id', userIds)
            .eq('is_archived', false)
            .gte('created_at', monthStartIso)
            .limit(ACTIVITY_FETCH_LIMIT),
          supabase
            .from('posts')
            .select('user_id, created_at, threads!inner(is_archived)')
            .in('user_id', userIds)
            .eq('is_deleted', false)
            .eq('threads.is_archived', false)
            .gte('created_at', monthStartIso)
            .limit(ACTIVITY_FETCH_LIMIT),
          supabase
            .from('zukan_card_ratings')
            .select('user_id, created_at')
            .in('user_id', userIds)
            .eq('is_deleted', false)
            .eq('is_hidden', false)
            .gte('created_at', monthStartIso)
            .limit(ACTIVITY_FETCH_LIMIT),
          supabase
            .from('zukan_card_reviews')
            .select('user_id, created_at')
            .in('user_id', userIds)
            .eq('is_deleted', false)
            .eq('is_hidden', false)
            .gte('created_at', monthStartIso)
            .limit(ACTIVITY_FETCH_LIMIT),
          supabase
            .from('zukan_pack_reviews')
            .select('user_id, created_at')
            .in('user_id', userIds)
            .eq('is_deleted', false)
            .eq('is_hidden', false)
            .gte('created_at', monthStartIso)
            .limit(ACTIVITY_FETCH_LIMIT),
          supabase
            .from('threads')
            .select('user_id, created_at')
            .in('user_id', userIds)
            .eq('is_archived', false)
            .limit(ACTIVITY_FETCH_LIMIT),
          supabase
            .from('posts')
            .select('user_id, created_at, threads!inner(is_archived)')
            .in('user_id', userIds)
            .eq('is_deleted', false)
            .eq('threads.is_archived', false)
            .limit(ACTIVITY_FETCH_LIMIT),
          supabase
            .from('zukan_card_ratings')
            .select('user_id, created_at')
            .in('user_id', userIds)
            .eq('is_deleted', false)
            .eq('is_hidden', false)
            .limit(ACTIVITY_FETCH_LIMIT),
          supabase
            .from('zukan_card_reviews')
            .select('user_id, created_at')
            .in('user_id', userIds)
            .eq('is_deleted', false)
            .eq('is_hidden', false)
            .limit(ACTIVITY_FETCH_LIMIT),
          supabase
            .from('zukan_pack_reviews')
            .select('user_id, created_at')
            .in('user_id', userIds)
            .eq('is_deleted', false)
            .eq('is_hidden', false)
            .limit(ACTIVITY_FETCH_LIMIT),
        ])

  const monthRanking = buildRanking(
    profiles,
    (monthThreads.data ?? []) as ActivityRow[],
    (monthPosts.data ?? []) as ActivityRow[],
    (monthCardRatings.data ?? []) as ActivityRow[],
    (monthCardReviews.data ?? []) as ActivityRow[],
    (monthPackReviews.data ?? []) as ActivityRow[]
  )
  const totalRanking = buildRanking(
    profiles,
    (totalThreads.data ?? []) as ActivityRow[],
    (totalPosts.data ?? []) as ActivityRow[],
    (totalCardRatings.data ?? []) as ActivityRow[],
    (totalCardReviews.data ?? []) as ActivityRow[],
    (totalPackReviews.data ?? []) as ActivityRow[]
  )

  const queryError =
    profilesError ||
    monthThreads.error ||
    monthPosts.error ||
    monthCardRatings.error ||
    monthCardReviews.error ||
    monthPackReviews.error ||
    totalThreads.error ||
    totalPosts.error ||
    totalCardRatings.error ||
    totalCardReviews.error ||
    totalPackReviews.error

  return (
    <div className="mx-auto max-w-screen-xl px-3 py-4 text-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="mb-1 text-xs text-gray-500">
            <Link href="/admin" className="text-blue-600 hover:underline">
              管理TOP
            </Link>
            <span className="mx-2 text-gray-300">/</span>
            <span>ランキングプレビュー</span>
          </div>
          <h1 className="text-xl font-bold text-gray-800">投稿者ランキングプレビュー</h1>
        </div>
        <Link href="/admin/users" className="text-xs text-blue-600 hover:underline">
          登録ユーザー一覧
        </Link>
      </div>

      <div className="mb-4 space-y-2 border border-blue-200 bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-800">
        <p>
          管理者確認用の集計プレビューです。公開投稿者ランキングと同じく、スレ作成
          {USER_RANKING_THREAD_POINT}pt、コメント投稿{USER_RANKING_POST_POINT}pt、図鑑評価
          {USER_RANKING_CARD_RATING_POINT}pt、カードレビュー{USER_RANKING_CARD_REVIEW_POINT}pt、
          パックレビュー{USER_RANKING_PACK_REVIEW_POINT}ptで、その場計算しています。
        </p>
        <p>
          対象profilesは最新{PROFILE_LIMIT}件、各activityは最大{ACTIVITY_FETCH_LIMIT}件まで取得します。
          pt保存、定期集計は行っていません。
        </p>
        <p className="text-blue-700">
          【内部仕様・非公開】連投対策として、{CAP_START_DATE_JST}（JST）以降の活動は
          1ユーザー1日あたり最大{DAILY_CAP}ptまでに丸めて加算しています。
          {CAP_START_DATE_JST}より前の活動は従来どおり上限なしで計算しています。
          この上限ルールはユーザー向け画面には表示していません。
        </p>
      </div>

      {queryError && (
        <div className="mb-4 border border-red-300 bg-red-50 px-3 py-3 text-sm text-red-700">
          ランキング集計データの取得に失敗しました。
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <RankingTable title="今月ランキング" rows={monthRanking} />
        <RankingTable title="総合ランキング" rows={totalRanking} />
      </div>
    </div>
  )
}
