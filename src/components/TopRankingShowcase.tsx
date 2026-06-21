import { getCachedCampaignRanking, getCachedUserRankings } from '@/lib/cached-queries'
import { resolveCampaignState } from '@/lib/campaign-ranking'
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

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    return (
      <span className="absolute top-0.5 left-0.5 z-10 text-sm md:text-base leading-none" aria-label={`${rank}位`}>
        {MEDALS[rank - 1]}
      </span>
    )
  }
  return (
    <span className="absolute top-0.5 left-0.5 z-10 text-[9px] md:text-[10px] font-bold text-gray-500 bg-gray-100 rounded px-0.5 py-0.5 leading-none">
      {rank}位
    </span>
  )
}

function PtBadge({ points }: { points: number }) {
  return (
    <span className="absolute top-0.5 right-0.5 z-10 text-[8px] md:text-[9px] font-bold text-white bg-gray-700 rounded px-0.5 py-0.5 leading-none whitespace-nowrap">
      {points}pt
    </span>
  )
}

function ShowcaseAvatar({ avatarUrl, displayName, rank }: { avatarUrl: string | null; displayName: string; rank: number }) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={`${displayName}のアイコン`}
        loading="lazy"
        decoding="async"
        className="h-10 w-10 md:h-20 md:w-20 shrink-0 rounded-full border border-gray-200 bg-gray-100 object-cover"
      />
    )
  }
  const ringColor = AVATAR_RING_COLORS[(rank - 1) % AVATAR_RING_COLORS.length]
  return (
    <span
      className={`flex h-10 w-10 md:h-20 md:w-20 items-center justify-center rounded-full text-sm md:text-xl font-bold ring-1 ${ringColor}`}
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
      title={entry.displayName}
      className="relative flex flex-col items-center justify-center bg-white px-0.5 py-2 md:px-1 md:py-1 text-center hover:bg-gray-50 transition-colors"
    >
      <RankBadge rank={entry.rank} />
      <PtBadge points={entry.points} />
      <ShowcaseAvatar avatarUrl={entry.avatarUrl} displayName={entry.displayName} rank={entry.rank} />
    </Link>
  )
}

function ShowcaseContainer({
  title,
  subtitle,
  entries,
  variant = 'monthly',
}: {
  title: string
  subtitle?: string
  entries: ShowcaseEntry[]
  variant?: 'campaign' | 'monthly'
}) {
  const isCampaign = variant === 'campaign'
  return (
    <div className={`mb-2 border bg-white ${isCampaign ? 'border-yellow-300' : 'border-gray-300'}`}>
      <Link
        href="/ranking"
        className={`flex items-center gap-1.5 px-3 py-1.5 border-b transition-colors ${
          isCampaign
            ? 'bg-yellow-50 border-yellow-300 hover:bg-yellow-100'
            : 'border-gray-300 hover:bg-gray-50'
        }`}
      >
        <span
          className="font-bold text-sm"
          style={{ color: isCampaign ? '#78350f' : '#004085' }}
        >
          {title}
        </span>
        {subtitle && (
          <span className={`text-xs font-normal ${isCampaign ? 'text-yellow-700' : 'text-gray-500'}`}>
            {subtitle}
          </span>
        )}
      </Link>
      <div className="grid grid-cols-5 md:grid-cols-10 gap-px bg-gray-200">
        {entries.map(entry => (
          <RankingCard key={entry.profileSlug} entry={entry} />
        ))}
      </div>
    </div>
  )
}

export async function TopRankingShowcase() {
  try {
    const { settings, ranking: campaignResult } = await getCachedCampaignRanking()
    const state = resolveCampaignState(settings)

    if (state === 'active') {
      const entries: ShowcaseEntry[] = campaignResult.entries.slice(0, 10).map(e => ({
        rank: e.rank,
        displayName: e.displayName,
        profileSlug: e.profileSlug,
        avatarUrl: e.avatarUrl,
        points: e.totalPoints,
      }))
      if (entries.length === 0) return null
      return (
        <ShowcaseContainer
          title="🏆 キャンペーンランキング TOP10"
          subtitle="（1日1回更新）"
          entries={entries}
          variant="campaign"
        />
      )
    }

    const { monthly } = await getCachedUserRankings()
    const entries: ShowcaseEntry[] = monthly.slice(0, 10).map((row, i) => ({
      rank: i + 1,
      displayName: row.display_name,
      profileSlug: row.profile_slug,
      avatarUrl: row.avatar_url,
      points: row.points,
    }))
    if (entries.length === 0) return null
    return (
      <ShowcaseContainer
        title="👑 今月の投稿者ランキング TOP10"
        entries={entries}
        variant="monthly"
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
        <div className="h-5 bg-gray-200 rounded w-52" />
      </div>
      <div className="grid grid-cols-5 md:grid-cols-10 gap-px bg-gray-200">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="relative flex flex-col items-center justify-center bg-white px-0.5 py-2 md:px-1 md:py-1">
            <div className="absolute top-0.5 left-0.5 h-3.5 w-5 bg-gray-200 rounded" />
            <div className="absolute top-0.5 right-0.5 h-3 w-4 md:w-5 bg-gray-200 rounded" />
            <div className="h-10 w-10 md:h-20 md:w-20 bg-gray-200 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
