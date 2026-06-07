import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createPublicClient } from '@/lib/supabase-public'

export const revalidate = 300

type Profile = {
  display_name: string
  profile_slug: string
  bio: string | null
  x_url: string | null
  youtube_url: string | null
  created_at: string
  profile_hidden: boolean | null
  account_suspended: boolean | null
  withdrawn_at: string | null
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

async function getProfile(slug: string): Promise<Profile | null> {
  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'display_name, profile_slug, bio, x_url, youtube_url, created_at, profile_hidden, account_suspended, withdrawn_at'
    )
    .eq('profile_slug', slug)
    .maybeSingle()

  if (error) {
    console.error('Failed to fetch public profile:', error.message)
    return null
  }

  return data
}

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const profile = await getProfile(slug)

  if (
    !profile ||
    profile.profile_hidden ||
    profile.account_suspended ||
    profile.withdrawn_at
  ) {
    notFound()
  }

  const xUrl = safeExternalLink(profile.x_url, ['x.com', 'twitter.com'])
  const youtubeUrl = safeExternalLink(profile.youtube_url, [
    'youtube.com',
    'www.youtube.com',
    'youtu.be',
  ])

  return (
    <main className="max-w-screen-md mx-auto px-3 py-4">
      <div className="text-xs text-gray-500 mb-3">
        <Link href="/" className="text-blue-600 hover:underline">
          TOP
        </Link>
        <span className="mx-1">/</span>
        <span>投稿者ページ</span>
      </div>

      <section className="bg-white border border-gray-300 rounded-sm">
        <div className="border-b border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-500 mb-1">投稿者ページ</p>
          <h1 className="text-xl font-bold text-gray-900 break-words">
            {profile.display_name}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            URL ID: <span className="font-mono">{profile.profile_slug}</span>
          </p>
        </div>

        <div className="px-4 py-4 space-y-4">
          <div>
            <h2 className="font-bold text-sm text-gray-800 mb-2">自己紹介</h2>
            {profile.bio ? (
              <p className="text-sm text-gray-800 whitespace-pre-wrap leading-6">
                {profile.bio}
              </p>
            ) : (
              <p className="text-sm text-gray-500">自己紹介はまだありません。</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
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
        </div>
      </section>

      <section className="bg-white border border-gray-300 rounded-sm mt-4">
        <div className="border-b border-gray-200 px-4 py-2">
          <h2 className="font-bold text-sm text-gray-800">最近の投稿</h2>
        </div>
        <div className="px-4 py-5 text-sm text-gray-600">
          まだ投稿履歴はありません。
        </div>
      </section>
    </main>
  )
}
