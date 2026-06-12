import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ProfileAvatar } from '@/components/ProfileAvatar'
import { createPublicClient } from '@/lib/supabase-public'
import { getCachedUserThreads, getCachedUserPosts, getCachedUserRankings } from '@/lib/cached-queries'

export const revalidate = 300

type Profile = {
  id: string
  display_name: string
  profile_slug: string
  bio: string | null
  x_url: string | null
  youtube_url: string | null
  avatar_url: string | null
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

function formatDateTime(value: string | null) {
  if (!value) return ''
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  }).format(new Date(value))
}

function excerpt(value: string | null, max = 80) {
  if (!value) return ''
  const oneLine = value.replace(/\s+/g, ' ').trim()
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine
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
      'id, display_name, profile_slug, bio, x_url, youtube_url, avatar_url, created_at, profile_hidden, account_suspended, withdrawn_at'
    )
    .eq('profile_slug', slug)
    .maybeSingle()

  if (error) {
    if (error.message.includes('avatar_url')) {
      const { data: fallback, error: fallbackError } = await supabase
        .from('profiles')
        .select(
          'id, display_name, profile_slug, bio, x_url, youtube_url, created_at, profile_hidden, account_suspended, withdrawn_at'
        )
        .eq('profile_slug', slug)
        .maybeSingle()

      if (fallbackError) {
        console.error('Failed to fetch public profile:', fallbackError.message)
        return null
      }

      return fallback ? { ...fallback, avatar_url: null } : null
    }
    console.error('Failed to fetch public profile:', error.message)
    return null
  }

  return data
}

function XIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function YouTubeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  )
}

function DefaultAvatarIcon({ size }: { size: string }) {
  return (
    <div className={`${size} rounded-full bg-gray-200 border border-gray-300 flex items-center justify-center shrink-0`}>
      <svg className="text-gray-400" style={{ width: '45%', height: '45%' }} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
      </svg>
    </div>
  )
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

  const [recentThreads, recentPosts, rankings] = await Promise.all([
    getCachedUserThreads(profile.id),
    getCachedUserPosts(profile.id),
    getCachedUserRankings(),
  ])

  const monthlyRankIndex = rankings.monthly.findIndex(
    (r) => r.profile_slug === profile.profile_slug
  )
  const totalRankIndex = rankings.total.findIndex(
    (r) => r.profile_slug === profile.profile_slug
  )
  const monthlyRank = monthlyRankIndex >= 0 ? monthlyRankIndex + 1 : null
  const totalRank = totalRankIndex >= 0 ? totalRankIndex + 1 : null

  const threadDisplayCount =
    recentThreads.length === 10 ? '10+' : String(recentThreads.length)
  const postDisplayCount =
    recentPosts.length === 10 ? '10+' : String(recentPosts.length)

  return (
    <main className="mx-auto w-full max-w-[1100px] px-3 py-4">
      {/* breadcrumb */}
      <div className="text-xs text-gray-500 mb-3">
        <Link href="/" className="text-blue-600 hover:underline">
          TOP
        </Link>
        <span className="mx-1">/</span>
        <span>投稿者ページ</span>
      </div>

      {/* Profile card */}
      <section className="bg-white border border-gray-300 rounded-sm overflow-hidden">
        {/* Header area */}
        <div className="px-4 pt-5 pb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Avatar */}
            {profile.avatar_url ? (
              <ProfileAvatar
                src={profile.avatar_url}
                alt={`${profile.display_name}のアイコン`}
                size="xl"
              />
            ) : (
              <DefaultAvatarIcon size="h-20 w-20" />
            )}

            {/* Name / slug / bio / SNS */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <h1 className="text-2xl font-bold text-gray-900 break-words leading-tight">
                  {profile.display_name}
                </h1>
                {(monthlyRank === 1 || totalRank === 1) && (
                  <span className="inline-block text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-300">
                    🏆 1位
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-0.5">@{profile.profile_slug}</p>

              {profile.bio ? (
                <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap leading-6">
                  {profile.bio}
                </p>
              ) : (
                <p className="text-sm text-gray-400 mt-2 italic">自己紹介はまだありません。</p>
              )}

              {/* SNS buttons */}
              {(xUrl || youtubeUrl) && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {xUrl && (
                    <a
                      href={xUrl}
                      target="_blank"
                      rel="nofollow noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black text-white text-xs font-medium hover:bg-gray-800 transition-colors"
                    >
                      <XIcon />
                      Xを見る
                    </a>
                  )}
                  {youtubeUrl && (
                    <a
                      href={youtubeUrl}
                      target="_blank"
                      rel="nofollow noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition-colors"
                    >
                      <YouTubeIcon />
                      YouTubeを見る
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="border-t border-gray-200 flex divide-x divide-gray-200 text-center bg-gray-50">
          <div className="flex-1 px-3 py-3">
            <p className="text-lg font-bold text-gray-900 leading-none">{threadDisplayCount}</p>
            <p className="text-xs text-gray-500 mt-1">スレッド</p>
          </div>
          <div className="flex-1 px-3 py-3">
            <p className="text-lg font-bold text-gray-900 leading-none">{postDisplayCount}</p>
            <p className="text-xs text-gray-500 mt-1">コメント</p>
          </div>
          {monthlyRank && (
            <div className="flex-1 px-3 py-3">
              <p className="text-lg font-bold text-blue-600 leading-none">{monthlyRank}位</p>
              <p className="text-xs text-gray-500 mt-1">今月</p>
            </div>
          )}
          {totalRank && (
            <div className="flex-1 px-3 py-3">
              <p className="text-lg font-bold text-indigo-600 leading-none">{totalRank}位</p>
              <p className="text-xs text-gray-500 mt-1">総合</p>
            </div>
          )}
        </div>

        {/* Join date — bottom meta */}
        <div className="border-t border-gray-100 px-4 py-2 text-xs text-gray-400">
          {formatDate(profile.created_at)} 登録
        </div>
      </section>

      {/* Recent activity */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Recent threads */}
        <section className="bg-white border border-gray-300 rounded-sm overflow-hidden">
          <div className="border-b border-gray-200 px-4 py-2.5 bg-gray-50">
            <h2 className="font-bold text-sm text-gray-800">最近のスレッド</h2>
          </div>
          {recentThreads.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {recentThreads.map((thread) => (
                <li key={thread.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                  <Link
                    href={`/thread/${thread.id}`}
                    className="text-sm font-medium text-blue-600 hover:underline break-words leading-snug block"
                  >
                    {thread.title}
                  </Link>
                  <p className="mt-1 text-xs text-gray-400 flex items-center gap-2">
                    <span>{formatDateTime(thread.created_at)}</span>
                    {typeof thread.post_count === 'number' && (
                      <span className="inline-flex items-center gap-0.5">
                        <span className="text-gray-300">·</span>
                        レス {thread.post_count}
                      </span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-6 text-sm text-gray-500 text-center">
              まだスレッドはありません。
            </div>
          )}
        </section>

        {/* Recent comments */}
        <section className="bg-white border border-gray-300 rounded-sm overflow-hidden">
          <div className="border-b border-gray-200 px-4 py-2.5 bg-gray-50">
            <h2 className="font-bold text-sm text-gray-800">最近のコメント</h2>
          </div>
          {recentPosts.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {recentPosts.map((post) => (
                <li key={post.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                  <Link
                    href={
                      post.post_number
                        ? `/thread/${post.thread_id}#${post.post_number}`
                        : `/thread/${post.thread_id}`
                    }
                    className="block"
                  >
                    {post.threads?.title && (
                      <p className="text-xs text-gray-500 truncate mb-1">
                        {post.threads.title}
                      </p>
                    )}
                    <p className="text-sm text-gray-800 break-words leading-relaxed hover:underline">
                      {excerpt(post.body)}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      {formatDateTime(post.created_at)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-6 text-sm text-gray-500 text-center">
              まだコメントはありません。
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
