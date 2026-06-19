import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { logout } from '@/app/auth/actions'
import { ProfileHeaderActionLink, ProfileHeaderCard } from '@/components/ProfileHeaderCard'
import { getCachedUserRankings } from '@/lib/cached-queries'
import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'

type Profile = {
  display_name: string
  profile_slug: string
  bio: string | null
  x_url: string | null
  youtube_url: string | null
  avatar_url: string | null
  created_at: string
}

type MyThreadRow = {
  id: number
  title: string
  post_count: number | null
  created_at: string | null
}

type MyPostRow = {
  id: number
  thread_id: number
  post_number: number | null
  body: string | null
  created_at: string | null
  threads: { title: string | null } | null
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

async function getMyThreads(userId: string): Promise<MyThreadRow[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('threads')
    .select('id, title, post_count, created_at')
    .eq('user_id', userId)
    .eq('is_archived', false)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error('Failed to fetch my threads:', error.message)
    return []
  }
  return (data ?? []) as MyThreadRow[]
}

async function getMyPosts(userId: string): Promise<MyPostRow[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('posts')
    .select('id, thread_id, post_number, body, created_at, threads(title)')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error('Failed to fetch my posts:', error.message)
    return []
  }
  return (data ?? []) as unknown as MyPostRow[]
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
    .select('display_name, profile_slug, bio, x_url, youtube_url, avatar_url, created_at')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    if (error.message.includes('avatar_url')) {
      const { data: fallback, error: fallbackError } = await admin
        .from('profiles')
        .select('display_name, profile_slug, bio, x_url, youtube_url, created_at')
        .eq('id', userId)
        .maybeSingle()

      if (fallbackError) {
        console.error('Failed to fetch my profile:', fallbackError.message)
        return null
      }

      return fallback ? { ...fallback, avatar_url: null } : null
    }
    console.error('Failed to fetch my profile:', error.message)
    return null
  }

  return data
}

async function getAnonThreads(sessionId: string): Promise<MyThreadRow[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('threads')
    .select('id, title, post_count, created_at')
    .eq('session_id', sessionId)
    .eq('is_archived', false)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error('Failed to fetch anon threads:', error.message)
    return []
  }
  return (data ?? []) as MyThreadRow[]
}

async function getAnonPosts(sessionId: string): Promise<MyPostRow[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('posts')
    .select('id, thread_id, post_number, body, created_at, threads!inner(title, is_archived)')
    .eq('session_id', sessionId)
    .eq('is_deleted', false)
    .eq('threads.is_archived', false)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error('Failed to fetch anon posts:', error.message)
    return []
  }
  return (data ?? []) as unknown as MyPostRow[]
}

async function getMyActivityCounts(userId: string) {
  const admin = createAdminClient()
  const [threadsResult, postsResult] = await Promise.all([
    admin
      .from('threads')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_archived', false),
    admin
      .from('posts')
      .select('id, threads!inner(is_archived)', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .eq('threads.is_archived', false),
  ])

  if (threadsResult.error) {
    console.error('Failed to count my threads:', threadsResult.error.message)
  }
  if (postsResult.error) {
    console.error('Failed to count my posts:', postsResult.error.message)
  }

  return {
    threadCount: threadsResult.count ?? 0,
    postCount: postsResult.count ?? 0,
  }
}

function SignupBanner() {
  return (
    <div className="rounded border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-blue-800">
      <p>アカウントを作ると、投稿履歴やプロフィールをまとめて管理できます。</p>
      <Link
        href="/login"
        className="mt-2 inline-flex items-center justify-center rounded bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
      >
        アカウントを作る
      </Link>
    </div>
  )
}

async function AnonMyPage() {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('bbs_session')?.value ?? null

  const [anonThreads, anonPosts] = sessionId
    ? await Promise.all([getAnonThreads(sessionId), getAnonPosts(sessionId)])
    : [[], []]

  const hasHistory = anonThreads.length > 0 || anonPosts.length > 0

  return (
    <main className="mx-auto w-full max-w-screen-xl px-3 py-4">
      <div className="w-full border border-gray-300 bg-white">
        <div className="border-b border-gray-300 bg-gray-100 px-4 py-3">
          <h1 className="text-lg font-bold text-gray-900">マイページ</h1>
          <p className="mt-1 text-sm leading-relaxed text-gray-600">
            このブラウザから投稿したスレッドとコメントを確認できます。
          </p>
        </div>

        <div className="space-y-5 p-4">
          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            未登録の投稿履歴は、このブラウザのCookieに保存された情報をもとに表示されます。Cookie削除や端末変更後は確認できません。
          </div>

          <SignupBanner />

          {hasHistory ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded border border-gray-200">
                <div className="border-b border-gray-200 px-4 py-3">
                  <h2 className="text-sm font-bold text-gray-800">最近のスレッド</h2>
                </div>
                {anonThreads.length > 0 ? (
                  <ul className="divide-y divide-gray-100">
                    {anonThreads.map((thread) => (
                      <li key={thread.id} className="px-4 py-3">
                        <Link
                          href={`/thread/${thread.id}`}
                          className="text-sm text-blue-600 hover:underline break-words"
                        >
                          {thread.title}
                        </Link>
                        <p className="mt-1 text-xs text-gray-500">
                          {formatDateTime(thread.created_at)}
                          {typeof thread.post_count === 'number' && (
                            <span className="ml-2">レス{thread.post_count}</span>
                          )}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-4 py-5 text-sm text-gray-600">
                    まだスレッドはありません。
                  </p>
                )}
              </section>

              <section className="rounded border border-gray-200">
                <div className="border-b border-gray-200 px-4 py-3">
                  <h2 className="text-sm font-bold text-gray-800">最近のコメント</h2>
                </div>
                {anonPosts.length > 0 ? (
                  <ul className="divide-y divide-gray-100">
                    {anonPosts.map((post) => (
                      <li key={post.id} className="px-4 py-3">
                        <Link
                          href={
                            post.post_number
                              ? `/thread/${post.thread_id}#${post.post_number}`
                              : `/thread/${post.thread_id}`
                          }
                          className="text-sm text-gray-800 hover:underline break-words"
                        >
                          {excerpt(post.body)}
                        </Link>
                        <p className="mt-1 text-xs text-gray-500 break-words">
                          {post.threads?.title && (
                            <span className="text-gray-600">{post.threads.title}</span>
                          )}
                          <span className="ml-2">{formatDateTime(post.created_at)}</span>
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-4 py-5 text-sm text-gray-600">
                    まだコメントはありません。
                  </p>
                )}
              </section>
            </div>
          ) : (
            <div className="rounded border border-gray-200 px-4 py-8 text-center">
              <h2 className="text-base font-bold text-gray-800">まだ投稿履歴はありません</h2>
              <p className="mt-2 text-sm text-gray-600">
                スレッドやコメントを投稿すると、ここから確認できます。
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

export default async function MyPage({
  searchParams,
}: {
  searchParams?: Promise<{ profile_hidden?: string }>
}) {
  const params = searchParams ? await searchParams : {}
  let user: User | null = null

  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    user = null
  }

  if (!user) {
    return <AnonMyPage />
  }

  const profile = await getMyProfile(user.id)

  if (!profile) {
    redirect('/profile/new')
  }

  const [myThreads, myPosts, rankings, activityCounts] = await Promise.all([
    getMyThreads(user.id),
    getMyPosts(user.id),
    getCachedUserRankings(),
    getMyActivityCounts(user.id),
  ])

  const profilePath = `/u/${profile.profile_slug}`
  const xUrl = safeExternalLink(profile.x_url, ['x.com', 'twitter.com'])
  const youtubeUrl = safeExternalLink(profile.youtube_url, [
    'youtube.com',
    'www.youtube.com',
    'youtu.be',
  ])
  const monthlyRankIndex = rankings.monthly.findIndex(
    (r) => r.profile_slug === profile.profile_slug
  )
  const totalRankIndex = rankings.total.findIndex(
    (r) => r.profile_slug === profile.profile_slug
  )
  const monthlyRank = monthlyRankIndex >= 0 ? monthlyRankIndex + 1 : null
  const totalRank = totalRankIndex >= 0 ? totalRankIndex + 1 : null

  return (
    <main className="mx-auto w-full max-w-screen-xl px-3 py-4">
      <div className="w-full border border-gray-300 bg-white">
        <div className="border-b border-gray-300 bg-gray-100 px-4 py-3">
          <h1 className="text-lg font-bold text-gray-900">マイページ</h1>
          <p className="mt-1 text-sm leading-relaxed text-gray-600">
            ログイン中の投稿者ページ情報を確認できます。
          </p>
        </div>

        <div className="space-y-5 p-4">
          <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            ログイン中です。
          </div>

          {params.profile_hidden === '1' && (
            <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
              プロフィールを非公開にしました。公開投稿者ページは本人にのみ表示されます。
            </div>
          )}

          <ProfileHeaderCard
            displayName={profile.display_name}
            slug={profile.profile_slug}
            bio={profile.bio}
            avatarUrl={profile.avatar_url}
            xUrl={xUrl}
            youtubeUrl={youtubeUrl}
            createdAtLabel={formatDate(profile.created_at)}
            threadCountLabel={formatCount(activityCounts.threadCount)}
            postCountLabel={formatCount(activityCounts.postCount)}
            monthlyRank={monthlyRank}
            totalRank={totalRank}
            actions={
              <div className="flex flex-col gap-2 sm:flex-row">
                <ProfileHeaderActionLink href={profilePath} variant="primary">
                  投稿者ページを見る
                </ProfileHeaderActionLink>
                <ProfileHeaderActionLink href="/mypage/edit">
                  プロフィールを編集
                </ProfileHeaderActionLink>
                <ProfileHeaderActionLink href="/" variant="neutral">
                  掲示板へ戻る
                </ProfileHeaderActionLink>
              </div>
            }
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded border border-gray-200">
              <div className="border-b border-gray-200 px-4 py-3">
                <h2 className="text-sm font-bold text-gray-800">最近のスレッド</h2>
              </div>
              {myThreads.length > 0 ? (
                <ul className="divide-y divide-gray-100">
                  {myThreads.map((thread) => (
                    <li key={thread.id} className="px-4 py-3">
                      <Link
                        href={`/thread/${thread.id}`}
                        className="text-sm text-blue-600 hover:underline break-words"
                      >
                        {thread.title}
                      </Link>
                      <p className="mt-1 text-xs text-gray-500">
                        {formatDateTime(thread.created_at)}
                        {typeof thread.post_count === 'number' && (
                          <span className="ml-2">レス{thread.post_count}</span>
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-5 text-sm text-gray-600">
                  まだスレッドはありません。
                </p>
              )}
            </section>

            <section className="rounded border border-gray-200">
              <div className="border-b border-gray-200 px-4 py-3">
                <h2 className="text-sm font-bold text-gray-800">最近のコメント</h2>
              </div>
              {myPosts.length > 0 ? (
                <ul className="divide-y divide-gray-100">
                  {myPosts.map((post) => (
                    <li key={post.id} className="px-4 py-3">
                      <Link
                        href={
                          post.post_number
                            ? `/thread/${post.thread_id}#${post.post_number}`
                            : `/thread/${post.thread_id}`
                        }
                        className="text-sm text-gray-800 hover:underline break-words"
                      >
                        {excerpt(post.body)}
                      </Link>
                      <p className="mt-1 text-xs text-gray-500 break-words">
                        {post.threads?.title && (
                          <span className="text-gray-600">{post.threads.title}</span>
                        )}
                        <span className="ml-2">{formatDateTime(post.created_at)}</span>
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-5 text-sm text-gray-600">
                  まだコメントはありません。
                </p>
              )}
            </section>
          </div>

          <form action={logout}>
            <button
              type="submit"
              className="rounded border border-gray-300 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              ログアウト
            </button>
          </form>

          <Link
            href="/mypage/withdraw"
            className="mt-4 inline-block rounded border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            退会する
          </Link>
        </div>
      </div>
    </main>
  )
}
