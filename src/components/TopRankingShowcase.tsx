import {
  getCachedCampaignRanking,
  getCachedProfileShowcaseUsers,
  getCachedTopShowcaseMode,
  getCachedUserRankings,
  type ProfileShowcaseUser,
  type UserRankingRow,
} from '@/lib/cached-queries'
import Link from 'next/link'
import type { ReactNode } from 'react'

const AVATAR_RING_COLORS = [
  'bg-blue-50 text-blue-700 ring-blue-100',
  'bg-green-50 text-green-700 ring-green-100',
  'bg-yellow-50 text-yellow-700 ring-yellow-200',
  'bg-pink-50 text-pink-700 ring-pink-100',
  'bg-gray-100 text-gray-600 ring-gray-200',
]

const RANK_MEDALS = ['🥇', '🥈', '🥉']

type ShowcaseRankingUser = {
  displayName: string
  profileSlug: string
  avatarUrl: string | null
  points: number
  rank?: number
}

function ProfileAvatar({ user, index }: { user: ProfileShowcaseUser; index: number }) {
  if (user.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatar_url}
        alt={`${user.display_name}のプロフィール`}
        loading="lazy"
        decoding="async"
        className="h-12 w-12 shrink-0 rounded-full border border-gray-200 bg-gray-100 object-cover md:h-20 md:w-20"
      />
    )
  }

  const ringColor = AVATAR_RING_COLORS[index % AVATAR_RING_COLORS.length]
  return (
    <span
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ring-1 md:h-20 md:w-20 ${ringColor}`}
      aria-hidden="true"
    />
  )
}

function RankingAvatar({ user, index }: { user: ShowcaseRankingUser; index: number }) {
  if (user.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatarUrl}
        alt={`${user.displayName}のプロフィール`}
        loading="lazy"
        decoding="async"
        className="h-10 w-10 shrink-0 rounded-full border border-gray-200 bg-gray-100 object-cover md:h-12 md:w-12"
      />
    )
  }

  const ringColor = AVATAR_RING_COLORS[index % AVATAR_RING_COLORS.length]
  const initial = user.displayName.trim().charAt(0) || '?'
  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ring-1 md:h-12 md:w-12 ${ringColor}`}
      aria-hidden="true"
    >
      {initial}
    </span>
  )
}

function ProfileIconLink({ user, index }: { user: ProfileShowcaseUser; index: number }) {
  return (
    <Link
      href={`/u/${user.profile_slug}`}
      title={user.display_name}
      aria-label={`${user.display_name}のプロフィール`}
      prefetch={false}
      className="flex h-20 min-w-0 items-center justify-center bg-white transition-colors hover:bg-gray-50 md:h-24"
    >
      <ProfileAvatar user={user} index={index} />
    </Link>
  )
}

function RankingUserLink({ user, index }: { user: ShowcaseRankingUser; index: number }) {
  const rank = user.rank ?? index + 1
  const medal = RANK_MEDALS[rank - 1]

  return (
    <Link
      href={`/u/${user.profileSlug}`}
      title={`${rank}位 ${user.displayName} ${user.points}pt`}
      aria-label={`${rank}位 ${user.displayName}のプロフィール`}
      prefetch={false}
      className="flex h-20 min-w-0 flex-col items-center justify-center gap-0.5 bg-white px-1 text-center transition-colors hover:bg-gray-50 md:h-24"
    >
      <div className="flex h-4 items-center justify-center text-[11px] font-black leading-none text-gray-700 md:text-xs">
        <span>{medal ?? `${rank}位`}</span>
      </div>
      <RankingAvatar user={user} index={index} />
      <div className="w-full truncate text-[10px] font-bold leading-tight text-gray-700 md:text-xs">
        {user.displayName}
      </div>
      <div className="font-mono text-[10px] font-black leading-none text-blue-700 md:text-xs">
        {user.points}pt
      </div>
    </Link>
  )
}

function ShowcaseShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-2 border border-gray-300 bg-white">
      <div className="flex items-center gap-1.5 border-b border-gray-300 px-3 py-1.5">
        <span className="font-bold text-sm" style={{ color: '#004085' }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  )
}

function ProfileShowcase({ users }: { users: ProfileShowcaseUser[] }) {
  if (users.length === 0) return null

  return (
    <ShowcaseShell title="👤 みんなのプロフィール">
      <div className="grid grid-cols-5 gap-px bg-gray-200 md:grid-cols-10">
        {users.map((user, index) => (
          <ProfileIconLink key={user.profile_slug} user={user} index={index} />
        ))}
      </div>
    </ShowcaseShell>
  )
}

function RankingShowcase({ title, users }: { title: string; users: ShowcaseRankingUser[] }) {
  if (users.length === 0) return null

  return (
    <ShowcaseShell title={title}>
      <div className="grid grid-cols-5 gap-px bg-gray-200 md:grid-cols-10">
        {users.slice(0, 10).map((user, index) => (
          <RankingUserLink key={user.profileSlug} user={user} index={index} />
        ))}
      </div>
    </ShowcaseShell>
  )
}

function toRankingUsers(rows: UserRankingRow[]): ShowcaseRankingUser[] {
  return rows.map((row, index) => ({
    displayName: row.display_name,
    profileSlug: row.profile_slug,
    avatarUrl: row.avatar_url,
    points: row.points,
    rank: index + 1,
  }))
}

export async function TopRankingShowcase() {
  const mode = await getCachedTopShowcaseMode()
  if (mode === 'hidden') return null

  if (mode === 'monthly_ranking' || mode === 'overall_ranking') {
    const rankings = await getCachedUserRankings()
    const rankingUsers = toRankingUsers(mode === 'monthly_ranking' ? rankings.monthly : rankings.total)
    return (
      <RankingShowcase
        title={mode === 'monthly_ranking' ? '🏆 今月の投稿者ランキング TOP10' : '🏆 総合投稿者ランキング TOP10'}
        users={rankingUsers}
      />
    )
  }

  if (mode === 'campaign_ranking') {
    const { ranking } = await getCachedCampaignRanking()
    if (!ranking.error && ranking.entries.length > 0) {
      return (
        <RankingShowcase
          title="🏆 キャンペーンランキング"
          users={ranking.entries.slice(0, 10).map(entry => ({
            displayName: entry.displayName,
            profileSlug: entry.profileSlug,
            avatarUrl: entry.avatarUrl,
            points: entry.totalPoints,
            rank: entry.rank,
          }))}
        />
      )
    }
  }

  const users = await getCachedProfileShowcaseUsers()
  return <ProfileShowcase users={users} />
}

export function TopRankingShowcaseSkeleton() {
  return (
    <div className="mb-2 border border-gray-300 bg-white animate-pulse">
      <div className="px-3 py-1.5 border-b border-gray-300 flex items-center gap-1.5">
        <div className="h-5 bg-gray-200 rounded w-44" />
      </div>
      <div className="grid grid-cols-5 gap-px bg-gray-200 md:grid-cols-10">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="flex h-20 min-w-0 items-center justify-center bg-white md:h-24">
            <div className="h-12 w-12 rounded-full bg-gray-200 md:h-20 md:w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}
