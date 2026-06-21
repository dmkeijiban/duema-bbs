import { getCachedCampaignRanking, getCachedUserRankings } from '@/lib/cached-queries'
import { resolveCampaignState } from '@/lib/campaign-ranking'
import { ProfileAvatar } from '@/components/ProfileAvatar'
import Link from 'next/link'

const MEDALS = ['🥇', '🥈', '🥉']

type ShowcaseEntry = {
  rank: number
  displayName: string
  profileSlug: string
  avatarUrl: string | null
  points: number
}

const AVATAR_RING_COLORS = [
  'bg-yellow-50 text-yellow-700 ring-yellow-200',
  'bg-gray-100 text-gray-600 ring-gray-200',
  'bg-orange-50 text-orange-700 ring-orange-200',
  'bg-blue-50 text-blue-700 ring-blue-100',
  'bg-green-50 text-green-700 ring-green-100',
]

function ShowcaseAvatar({ avatarUrl, displayName, rank }: { avatarUrl: string | null; displayName: string; rank: number }) {
  if (avatarUrl) {
    return <ProfileAvatar src={avatarUrl} alt={`${displayName}のアイコン`} size="md" />
  }
  const ringColor = AVATAR_RING_COLORS[(rank - 1) % AVATAR_RING_COLORS.length]
  return (
    <span
      className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ring-1 ${ringColor}`}
      aria-hidden="true"
    >
      {displayName.trim().charAt(0) || '?'}
    </span>
  )
}

function RankingCard({ entry }: { entry: ShowcaseEntry }) {
  return (
    <Link
      href={`/u/${entry.profileSlug}`}
      className="flex flex-1 shrink-0 flex-col items-center gap-1.5 px-2 py-3 text-center hover:bg-gray-50 transition-colors min-w-[5rem]"
    >
      <span className="text-base leading-none">
        {MEDALS[entry.rank - 1] ?? `${entry.rank}位`}
      </span>
      <ShowcaseAvatar avatarUrl={entry.avatarUrl} displayName={entry.displayName} rank={entry.rank} />
      <div className="w-full min-w-0">
        <p className="text-xs font-bold text-gray-800 truncate">{entry.displayName}</p>
        <p className="text-xs font-mono font-black text-indigo-600">{entry.points}pt</p>
      </div>
    </Link>
  )
}

function ShowcaseContainer({ title, subtitle, entries }: { title: string; subtitle?: string; entries: ShowcaseEntry[] }) {
  return (
    <div className="mb-2 border border-gray-300 bg-white">
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-gray-300">
        <span className="font-bold text-sm" style={{ color: '#004085' }}>{title}</span>
        {subtitle && <span className="text-xs text-gray-500 font-normal">{subtitle}</span>}
      </div>
      <div className="overflow-x-auto">
        <div className="flex min-w-full divide-x divide-gray-200">
          {entries.map(entry => (
            <RankingCard key={entry.profileSlug} entry={entry} />
          ))}
        </div>
      </div>
    </div>
  )
}

export async function TopRankingShowcase() {
  try {
    const { settings, ranking: campaignResult } = await getCachedCampaignRanking()
    const state = resolveCampaignState(settings)

    if (state === 'active') {
      const entries: ShowcaseEntry[] = campaignResult.entries.slice(0, 5).map(e => ({
        rank: e.rank,
        displayName: e.displayName,
        profileSlug: e.profileSlug,
        avatarUrl: e.avatarUrl,
        points: e.totalPoints,
      }))
      if (entries.length === 0) return null
      return (
        <ShowcaseContainer
          title="🏆 キャンペーンランキング TOP5"
          subtitle="（1日1回更新）"
          entries={entries}
        />
      )
    }

    const { monthly } = await getCachedUserRankings()
    const entries: ShowcaseEntry[] = monthly.slice(0, 5).map((row, i) => ({
      rank: i + 1,
      displayName: row.display_name,
      profileSlug: row.profile_slug,
      avatarUrl: row.avatar_url,
      points: row.points,
    }))
    if (entries.length === 0) return null
    return (
      <ShowcaseContainer
        title="👑 今月の投稿者ランキング TOP5"
        entries={entries}
      />
    )
  } catch (error) {
    console.warn('TopRankingShowcase fetch failed:', error)
    return null
  }
}

export function TopRankingShowcaseSkeleton() {
  return (
    <div className="mb-2 border border-gray-300 bg-white animate-pulse">
      <div className="px-3 py-1.5 border-b border-gray-300 flex items-center gap-1.5">
        <div className="h-5 bg-gray-200 rounded w-48" />
      </div>
      <div className="flex divide-x divide-gray-200">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5 px-2 py-3 min-w-[5rem]">
            <div className="h-5 w-5 bg-gray-200 rounded" />
            <div className="h-10 w-10 bg-gray-200 rounded-full" />
            <div className="h-3 w-12 bg-gray-200 rounded" />
            <div className="h-3 w-8 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
