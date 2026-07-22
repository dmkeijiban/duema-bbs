import Link from 'next/link'
import { notFound } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { ProfileHeaderCard } from '@/components/ProfileHeaderCard'
import { UserProfileShareButtons } from '@/components/UserProfileShareButtons'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCachedUserThreads, getCachedUserPosts, getCachedUserRankings, getCachedCampaignRanking, getCachedHonorTitleEnabled } from '@/lib/cached-queries'
import { resolveCampaignState } from '@/lib/campaign-ranking'
import { getHonorTitle, getNextHonorTitle } from '@/lib/honor-title'
import { HonorTitleCard } from '@/components/HonorTitleCard'
import { HonorRankUpBanner } from '@/components/HonorRankUpBanner'
import { ResumeProfileCard } from '@/components/ResumeProfileCard'
import { getOwnResumeSubmission, getPublicResumeSubmission } from '@/lib/maker-resume-queries'
import {
  DUEMA_GENERATION_MAP,
  DUEMA_CIVILIZATION_MAP,
  DUEMA_PLAY_STYLE_MAP,
} from '@/lib/duema-profile'
import {
  USER_RANKING_THREAD_POINT,
  USER_RANKING_POST_POINT,
  USER_RANKING_CARD_RATING_POINT,
  USER_RANKING_CARD_REVIEW_POINT,
  USER_RANKING_PACK_REVIEW_POINT,
} from '@/lib/ranking-points'

export const dynamic = 'force-dynamic'

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
  ranking_enabled: boolean | null
  rank_excluded: boolean | null
  duema_generation: string | null
  favorite_card: string | null
  favorite_civilization: string | null
  play_style: string | null
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
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('profiles')
    .select(
      'id, display_name, profile_slug, bio, x_url, youtube_url, avatar_url, created_at, profile_hidden, account_suspended, withdrawn_at, ranking_enabled, rank_excluded, duema_generation, favorite_card, favorite_civilization, play_style'
    )
    .eq('profile_slug', slug)
    .maybeSingle()

  if (error) {
    if (error.message.includes('avatar_url')) {
      const { data: fallback, error: fallbackError } = await admin
        .from('profiles')
        .select(
          'id, display_name, profile_slug, bio, x_url, youtube_url, created_at, profile_hidden, account_suspended, withdrawn_at, ranking_enabled, rank_excluded, duema_generation, favorite_card, favorite_civilization, play_style'
        )
        .eq('profile_slug', slug)
        .maybeSingle()

      if (fallbackError) {
        console.error('Failed to fetch public profile:', fallbackError.message)
        return null
      }

      return fallback ? { ...fallback, avatar_url: null, ranking_enabled: null, rank_excluded: null } : null
    }
    console.error('Failed to fetch public profile:', error.message)
    return null
  }

  return data
}

async function getViewerUserId() {
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    return data.user?.id ?? null
  } catch {
    return null
  }
}

function getJstDateKey(): string {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return jst.toISOString().slice(0, 10)
}

function getUserActivityCounts(userId: string) {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient()
      const [threadsResult, postsResult, cardRatingsResult, cardReviewsResult, packReviewsResult] = await Promise.all([
        supabase.from('threads').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_archived', false),
        supabase.from('posts').select('id, threads!inner(is_archived)', { count: 'exact', head: true }).eq('user_id', userId).eq('is_deleted', false).eq('threads.is_archived', false),
        supabase.from('zukan_card_ratings').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_deleted', false),
        supabase.from('zukan_card_reviews').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_deleted', false).eq('is_hidden', false),
        supabase.from('zukan_pack_reviews').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_deleted', false).eq('is_hidden', false),
      ])
      return {
        threadCount: threadsResult.count ?? 0,
        postCount: postsResult.count ?? 0,
        cardRatingCount: cardRatingsResult.count ?? 0,
        cardReviewCount: cardReviewsResult.count ?? 0,
        packReviewCount: packReviewsResult.count ?? 0,
      }
    },
    [`user-activity-counts-${userId}-${getJstDateKey()}`],
    { revalidate: 86400 }
  )()
}

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const [profile, viewerUserId] = await Promise.all([
    getProfile(slug),
    getViewerUserId(),
  ])

  if (
    !profile ||
    profile.account_suspended ||
    profile.withdrawn_at
  ) {
    notFound()
  }

  const isOwner = viewerUserId === profile.id

  if (profile.profile_hidden && !isOwner) {
    notFound()
  }

  const resume = isOwner ? await getOwnResumeSubmission(profile.id) : await getPublicResumeSubmission(profile.id)

  const xUrl = safeExternalLink(profile.x_url, ['x.com', 'twitter.com'])
  const youtubeUrl = safeExternalLink(profile.youtube_url, [
    'youtube.com',
    'www.youtube.com',
    'youtu.be',
  ])

  const [recentThreads, recentPosts, rankings, activityCounts, cachedCampaign, honorTitleEnabled] = await Promise.all([
    getCachedUserThreads(profile.id),
    getCachedUserPosts(profile.id),
    getCachedUserRankings(),
    getUserActivityCounts(profile.id),
    getCachedCampaignRanking(),
    getCachedHonorTitleEnabled(),
  ])

  const campaignSettings = cachedCampaign.settings
  const campaignResult = cachedCampaign.ranking

  let campaignRank: number | null = null
  let campaignPoints: number | null = null
  let campaignTitle: string | null = null

  const campaignState = resolveCampaignState(campaignSettings)
  if (
    (campaignState === 'active' || campaignState === 'ended') &&
    profile.ranking_enabled !== false &&
    !profile.rank_excluded
  ) {
    const entry = campaignResult.entries.find((e) => e.profileSlug === profile.profile_slug)
    if (campaignState === 'active') {
      // 開催中: 圏外・0pt でも「参加中」バッジを表示（rank_excluded ユーザーは除く）
      campaignTitle = campaignSettings.title
      if (entry) {
        campaignRank = entry.rank
        campaignPoints = entry.totalPoints
      } else {
        campaignPoints = 0
      }
    } else {
      // 終了後: トップ30入りユーザーのみ最終順位バッジを表示
      if (entry) {
        campaignTitle = campaignSettings.title
        campaignRank = entry.rank
        campaignPoints = entry.totalPoints
      }
    }
  }

  const monthlyRankIndex = rankings.monthly.findIndex(
    (r) => r.profile_slug === profile.profile_slug
  )
  const totalRankIndex = rankings.total.findIndex(
    (r) => r.profile_slug === profile.profile_slug
  )
  const monthlyRank = monthlyRankIndex >= 0 ? monthlyRankIndex + 1 : null
  const totalRank = totalRankIndex >= 0 ? totalRankIndex + 1 : null

  const totalPoints =
    activityCounts.threadCount * USER_RANKING_THREAD_POINT +
    activityCounts.postCount * USER_RANKING_POST_POINT +
    activityCounts.cardRatingCount * USER_RANKING_CARD_RATING_POINT +
    activityCounts.cardReviewCount * USER_RANKING_CARD_REVIEW_POINT +
    activityCounts.packReviewCount * USER_RANKING_PACK_REVIEW_POINT
  const honorTitle = getHonorTitle(totalPoints)
  const nextHonorTitle = getNextHonorTitle(totalPoints)
  const showHonorTitle = honorTitleEnabled && !!honorTitle
  const hasDuemaFields = !!(
    profile.duema_generation ||
    profile.favorite_card ||
    profile.favorite_civilization ||
    profile.play_style
  )

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
        <span>プロフィール</span>
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
        honorTitle={honorTitleEnabled ? honorTitle : null}
        campaignTitle={campaignTitle}
        campaignRank={campaignRank}
        campaignPoints={campaignPoints}
      />

      {honorTitleEnabled && isOwner && <HonorRankUpBanner title={honorTitle} />}

      {profile.profile_hidden && isOwner && (
        <div className="mt-3 rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          このプロフィールは非公開です。現在は本人にのみ表示されています。
        </div>
      )}

      {(hasDuemaFields || showHonorTitle) && (
        <section className="mt-4 rounded-sm border border-gray-200 bg-white px-4 py-4">
          <h2 className="mb-3 text-sm font-bold text-gray-800">デュエマプロフィール</h2>
          <div className={hasDuemaFields && showHonorTitle ? 'flex flex-col gap-3 lg:flex-row lg:items-stretch' : ''}>
            {hasDuemaFields && (
              <dl className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
                {profile.duema_generation && (
                  <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3">
                    <dt className="text-xs text-gray-500">どの世代？</dt>
                    <dd className="mt-1 text-base font-bold text-gray-900 break-words">
                      {DUEMA_GENERATION_MAP[profile.duema_generation] ?? profile.duema_generation}
                    </dd>
                  </div>
                )}
                {profile.favorite_card && (
                  <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3">
                    <dt className="text-xs text-gray-500">一番好きなカード</dt>
                    <dd className="mt-1 text-base font-bold text-gray-900 break-words">
                      {profile.favorite_card}
                    </dd>
                  </div>
                )}
                {profile.favorite_civilization && (
                  <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3">
                    <dt className="text-xs text-gray-500">好きな文明</dt>
                    <dd className="mt-1 text-base font-bold text-gray-900 break-words">
                      {DUEMA_CIVILIZATION_MAP[profile.favorite_civilization] ?? profile.favorite_civilization}
                    </dd>
                  </div>
                )}
                {profile.play_style && (
                  <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3">
                    <dt className="text-xs text-gray-500">プレイスタイル</dt>
                    <dd className="mt-1 text-base font-bold text-gray-900 break-words">
                      {DUEMA_PLAY_STYLE_MAP[profile.play_style] ?? profile.play_style}
                    </dd>
                  </div>
                )}
              </dl>
            )}
            {showHonorTitle && (
              <HonorTitleCard
                title={honorTitle}
                points={totalPoints}
                nextTitle={nextHonorTitle}
                className={
                  hasDuemaFields
                    ? 'lg:w-[280px] lg:shrink-0'
                    : 'mx-auto w-full max-w-xs sm:max-w-sm'
                }
              />
            )}
          </div>
        </section>
      )}

      <section className="mt-4 rounded-sm border border-gray-200 bg-white px-4 py-3">
        <h2 className="text-sm font-bold text-gray-800">このプロフィールを共有</h2>
        <div className="mt-2">
          <UserProfileShareButtons displayName={profile.display_name} />
        </div>
      </section>

      {resume && <ResumeProfileCard data={resume.data} avatarUrl={profile.avatar_url} resumeDate={resume.updatedAt} isOwner={isOwner} isPublic={resume.isPublic} viewerLoggedIn={Boolean(viewerUserId)} />}

      {!isOwner && (
        <section className="mt-4 rounded-sm border border-blue-200 bg-blue-50 px-4 py-3">
          <h2 className="text-sm font-bold text-gray-800">
            あなたも自分専用のプロフィールを作成できます。
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-gray-600">
            登録すると、自分のスレッドやコメントの確認、プロフィール設定、X・YouTubeの掲載、投稿者ランキングへの参加ができます。
          </p>
          <Link
            href="/login"
            className="mt-3 inline-flex items-center justify-center rounded-sm bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700"
          >
            自分のプロフィールを作成する
          </Link>
        </section>
      )}

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
                        コメント {thread.post_count}
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
