import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase-admin'
import { verifyAdminCookie } from '@/lib/admin-auth'

const PROFILE_LIMIT = 100
const RANKING_LIMIT = 50
const THREAD_FETCH_LIMIT = 10000
const POST_FETCH_LIMIT = 10000
const THREAD_POINT = 3
const POST_POINT = 1

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
}

type RankingRow = {
  profile: ProfileRow
  threadCount: number
  postCount: number
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
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0)).toISOString()
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
  postRows: ActivityRow[]
) {
  const threadCounts = countByUser(threadRows)
  const postCounts = countByUser(postRows)

  return profiles
    .map((profile): RankingRow => {
      const threadCount = threadCounts.get(profile.id) ?? 0
      const postCount = postCounts.get(profile.id) ?? 0
      return {
        profile,
        threadCount,
        postCount,
        points: threadCount * THREAD_POINT + postCount * POST_POINT,
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
                  仮pt
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
  const [monthThreads, monthPosts, totalThreads, totalPosts] =
    userIds.length === 0
      ? [emptyActivity, emptyActivity, emptyActivity, emptyActivity]
      : await Promise.all([
          supabase
            .from('threads')
            .select('user_id')
            .in('user_id', userIds)
            .eq('is_archived', false)
            .gte('created_at', monthStartIso)
            .limit(THREAD_FETCH_LIMIT),
          supabase
            .from('posts')
            .select('user_id, threads!inner(is_archived)')
            .in('user_id', userIds)
            .eq('is_deleted', false)
            .eq('threads.is_archived', false)
            .gte('created_at', monthStartIso)
            .limit(POST_FETCH_LIMIT),
          supabase
            .from('threads')
            .select('user_id')
            .in('user_id', userIds)
            .eq('is_archived', false)
            .limit(THREAD_FETCH_LIMIT),
          supabase
            .from('posts')
            .select('user_id, threads!inner(is_archived)')
            .in('user_id', userIds)
            .eq('is_deleted', false)
            .eq('threads.is_archived', false)
            .limit(POST_FETCH_LIMIT),
        ])

  const monthRanking = buildRanking(
    profiles,
    (monthThreads.data ?? []) as ActivityRow[],
    (monthPosts.data ?? []) as ActivityRow[]
  )
  const totalRanking = buildRanking(
    profiles,
    (totalThreads.data ?? []) as ActivityRow[],
    (totalPosts.data ?? []) as ActivityRow[]
  )

  const queryError =
    profilesError ||
    monthThreads.error ||
    monthPosts.error ||
    totalThreads.error ||
    totalPosts.error

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
          管理者確認用の仮集計です。スレ作成 {THREAD_POINT}pt、コメント投稿 {POST_POINT}
          ptで、その場計算しています。公開ランキング、pt保存、定期集計はまだ行っていません。
        </p>
        <p>
          対象profilesは最新{PROFILE_LIMIT}件、threadsは最大{THREAD_FETCH_LIMIT}件、postsは最大
          {POST_FETCH_LIMIT}件まで取得します。公開時は集計済みテーブル方式に切り替える想定です。
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
