import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ProfileHeaderCard } from '@/components/ProfileHeaderCard'
import { ShareButtons } from '@/components/ShareButtons'
import { createPublicClient } from '@/lib/supabase-public'
import { getCachedUserThreads, getCachedUserPosts, getCachedUserRankings } from '@/lib/cached-queries'

export const revalidate = 3600

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

function formatCount(value: number) {
  return `${new Intl.NumberFormat('ja-JP').format(value)}件`
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

async function getUserActivityCounts(userId: string) {
  const supabase = createPublicClient()
  const [threadsResult, postsResult] = await Promise.all([
    supabase
      .from('threads')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_archived', false),
    supabase
      .from('posts')
      .select('id, threads!inner(is_archived)', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .eq('threads.is_archived', false),
  ])

  return {
    threadCount: threadsResult.count ?? 0,
    postCount: postsResult.count ?? 0,
  }
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

  const [recentThreads, recentPosts, rankings, activityCounts] = await Promise.all([
    getCachedUserThreads(profile.id),
    getCachedUserPosts(profile.id),
    getCachedUserRankings(),
    getUserActivityCounts(profile.id),
  ])

  const monthlyRankIndex = rankings.monthly.findIndex(
    (r) => r.profile_slug === profile.profile_slug
  )
  const totalRankIndex = rankings.total.findIndex(
    (r) => r.profile_slug === profile.profile_slug
  )
  const monthlyRank = monthlyRankIndex >= 0 ? monthlyRankIndex + 1 : null
  const totalRank = totalRankIndex >= 0 ? totalRankIndex + 1 : null

  const threadDisplayCount = formatCount(activityCounts.threadCount)
  const postDisplayCount = formatCount(activityCounts.postCount)

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

      <ProfileHeaderCard
        displayName={profile.display_name}
        slug={profile.profile_slug}
        bio={profile.bio}
        avatarUrl={profile.avatar_url}
        xUrl={xUrl}
        youtubeUrl={youtubeUrl}
        createdAtLabel={formatDate(profile.created_at)}
        threadCountLabel={threadDisplayCount}
        postCountLabel={postDisplayCount}
        monthlyRank={monthlyRank}
        totalRank={totalRank}
      />

      <ShareButtons slug={profile.profile_slug} displayName={profile.display_name} />

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
