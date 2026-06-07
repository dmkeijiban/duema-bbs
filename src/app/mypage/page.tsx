import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { logout } from '@/app/auth/actions'
import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'

type Profile = {
  display_name: string
  profile_slug: string
  bio: string | null
  x_url: string | null
  youtube_url: string | null
  created_at: string
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Tokyo',
  }).format(new Date(value))
}

function safeExternalLink(value: string | null, allowedHosts: string[]) {
  if (!value) return null

  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return null
    if (!allowedHosts.includes(url.hostname)) return null
    return url.toString()
  } catch {
    return null
  }
}

async function getMyProfile(userId: string): Promise<Profile | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('profiles')
    .select('display_name, profile_slug, bio, x_url, youtube_url, created_at')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.error('Failed to fetch my profile:', error.message)
    return null
  }

  return data
}

export default async function MyPage() {
  let user: User | null = null

  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    redirect('/login?next=/mypage')
  }

  if (!user) {
    redirect('/login?next=/mypage')
  }

  const profile = await getMyProfile(user.id)

  if (!profile) {
    redirect('/profile/new')
  }

  const profilePath = `/u/${profile.profile_slug}`
  const xUrl = safeExternalLink(profile.x_url, ['x.com', 'twitter.com'])
  const youtubeUrl = safeExternalLink(profile.youtube_url, [
    'youtube.com',
    'www.youtube.com',
    'youtu.be',
  ])

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="border border-gray-300 bg-white">
        <div className="border-b border-gray-300 bg-gray-100 px-4 py-3">
          <h1 className="text-lg font-bold text-gray-900">マイページ</h1>
          <p className="mt-1 text-sm leading-relaxed text-gray-600">
            ログイン中の投稿者ページ情報を確認できます。プロフィール編集や投稿履歴は次の段階で追加予定です。
          </p>
        </div>

        <div className="space-y-5 p-4">
          <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            ログイン中です。
          </div>

          <section className="rounded border border-gray-200">
            <div className="border-b border-gray-200 px-4 py-3">
              <p className="text-xs text-gray-500">投稿者プロフィール</p>
              <h2 className="mt-1 text-xl font-bold text-gray-900 break-words">
                {profile.display_name}
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                URL ID: <span className="font-mono">{profile.profile_slug}</span>
              </p>
            </div>

            <div className="space-y-4 px-4 py-4">
              <div>
                <h3 className="mb-2 text-sm font-bold text-gray-800">自己紹介</h3>
                {profile.bio ? (
                  <p className="text-sm leading-6 text-gray-800 whitespace-pre-wrap">
                    {profile.bio}
                  </p>
                ) : (
                  <p className="text-sm text-gray-500">自己紹介はまだありません。</p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div className="border border-gray-200 bg-gray-50 px-3 py-2">
                  <p className="text-xs text-gray-500">作成日</p>
                  <p className="font-medium">{formatDate(profile.created_at)}</p>
                </div>
                <div className="border border-gray-200 bg-gray-50 px-3 py-2">
                  <p className="text-xs text-gray-500">SNS</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {xUrl && (
                      <a
                        href={xUrl}
                        target="_blank"
                        rel="nofollow noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        X
                      </a>
                    )}
                    {youtubeUrl && (
                      <a
                        href={youtubeUrl}
                        target="_blank"
                        rel="nofollow noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        YouTube
                      </a>
                    )}
                    {!xUrl && !youtubeUrl && (
                      <span className="text-gray-500">登録されていません</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Link
                  href={profilePath}
                  className="rounded bg-blue-600 px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-blue-700"
                >
                  投稿者ページを見る
                </Link>
                <Link
                  href="/"
                  className="rounded border border-gray-300 px-4 py-2.5 text-center text-sm text-gray-700 hover:bg-gray-50"
                >
                  掲示板へ戻る
                </Link>
              </div>
            </div>
          </section>

          <section className="rounded border border-gray-200 bg-gray-50 px-4 py-4">
            <h2 className="text-sm font-bold text-gray-800">投稿履歴</h2>
            <p className="mt-2 text-sm text-gray-600">
              投稿履歴は次の段階で表示予定です。今は投稿者ページ情報だけ確認できます。
            </p>
          </section>

          <form action={logout}>
            <button
              type="submit"
              className="rounded border border-gray-300 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              ログアウト
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
