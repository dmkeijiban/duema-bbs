import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase-admin'
import { verifyAdminCookie } from '@/lib/admin-auth'

type AdminProfile = {
  id: string
  display_name: string | null
  profile_slug: string | null
  created_at: string | null
  last_login_at: string | null
  profile_hidden: boolean | null
  ranking_enabled: boolean | null
  rank_excluded: boolean | null
  account_suspended: boolean | null
  withdrawn_at: string | null
}

async function requireAdmin() {
  const cookieStore = await cookies()
  const adminCookie = cookieStore.get('admin_auth')?.value
  if (!verifyAdminCookie(adminCookie)) {
    redirect('/admin')
  }
}

function formatDate(value: string | null) {
  if (!value) return '-'

  return new Date(value).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function StatusTag({
  active,
  children,
  tone = 'gray',
}: {
  active: boolean
  children: React.ReactNode
  tone?: 'gray' | 'yellow' | 'red' | 'blue'
}) {
  if (!active) return null

  const toneClass = {
    gray: 'border-gray-300 bg-gray-50 text-gray-600',
    yellow: 'border-yellow-300 bg-yellow-50 text-yellow-700',
    red: 'border-red-300 bg-red-50 text-red-700',
    blue: 'border-blue-300 bg-blue-50 text-blue-700',
  }[tone]

  return (
    <span className={`inline-flex items-center border px-2 py-0.5 text-[11px] ${toneClass}`}>
      {children}
    </span>
  )
}

export default async function AdminUsersPage() {
  await requireAdmin()

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, display_name, profile_slug, created_at, last_login_at, profile_hidden, ranking_enabled, rank_excluded, account_suspended, withdrawn_at'
    )
    .order('created_at', { ascending: false })
    .limit(50)

  const profiles = (data ?? []) as AdminProfile[]

  return (
    <div className="mx-auto max-w-screen-xl px-3 py-4 text-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="mb-1 text-xs text-gray-500">
            <Link href="/admin" className="text-blue-600 hover:underline">
              管理TOP
            </Link>
            <span className="mx-2 text-gray-300">/</span>
            <span>登録ユーザー</span>
          </div>
          <h1 className="text-xl font-bold text-gray-800">登録ユーザー一覧</h1>
        </div>
        <Link href="/" className="text-xs text-blue-600 hover:underline">
          サイトを見る
        </Link>
      </div>

      <div className="mb-4 border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
        最新50件のプロフィールを読み取り専用で表示しています。更新・削除・停止などの操作はこのページからは行いません。
      </div>

      {error ? (
        <div className="border border-red-300 bg-red-50 px-3 py-3 text-sm text-red-700">
          profiles の取得に失敗しました。
        </div>
      ) : profiles.length === 0 ? (
        <div className="border border-gray-300 bg-white px-3 py-10 text-center text-sm text-gray-500">
          登録ユーザーはまだありません。
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-300 bg-white">
          <table className="min-w-full border-collapse text-left text-xs">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="whitespace-nowrap border-b border-gray-200 px-3 py-2 font-semibold">
                  表示名
                </th>
                <th className="whitespace-nowrap border-b border-gray-200 px-3 py-2 font-semibold">
                  slug
                </th>
                <th className="whitespace-nowrap border-b border-gray-200 px-3 py-2 font-semibold">
                  投稿者ページ
                </th>
                <th className="whitespace-nowrap border-b border-gray-200 px-3 py-2 font-semibold">
                  作成日
                </th>
                <th className="whitespace-nowrap border-b border-gray-200 px-3 py-2 font-semibold">
                  最終ログイン
                </th>
                <th className="whitespace-nowrap border-b border-gray-200 px-3 py-2 font-semibold">
                  状態
                </th>
              </tr>
            </thead>
            <tbody>
              {profiles.map(profile => {
                const slug = profile.profile_slug ?? ''

                return (
                  <tr key={profile.id} className="border-b border-gray-100 last:border-b-0">
                    <td className="whitespace-nowrap px-3 py-2 font-medium text-gray-800">
                      <Link
                        href={`/admin/users/${profile.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {profile.display_name || '(未設定)'}
                      </Link>
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
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                      {formatDate(profile.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                      {formatDate(profile.last_login_at)}
                    </td>
                    <td className="min-w-52 px-3 py-2">
                      <div className="flex flex-wrap gap-1.5">
                        <StatusTag active={!!profile.profile_hidden} tone="yellow">
                          非公開
                        </StatusTag>
                        <StatusTag active={profile.ranking_enabled === false} tone="gray">
                          ランキングOFF
                        </StatusTag>
                        <StatusTag active={!!profile.rank_excluded} tone="yellow">
                          ランキング除外
                        </StatusTag>
                        <StatusTag active={!!profile.account_suspended} tone="red">
                          停止
                        </StatusTag>
                        <StatusTag active={!!profile.withdrawn_at} tone="gray">
                          退会済み
                        </StatusTag>
                        {!profile.profile_hidden &&
                          profile.ranking_enabled !== false &&
                          !profile.rank_excluded &&
                          !profile.account_suspended &&
                          !profile.withdrawn_at && (
                            <StatusTag active tone="blue">
                              通常
                            </StatusTag>
                          )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
