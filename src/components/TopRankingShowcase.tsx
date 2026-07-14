import {
  getCachedCampaignRanking,
  getCachedProfileShowcaseUsers,
  getCachedTopShowcaseMode,
  getCachedUserRankings,
  type ProfileShowcaseUser,
  type UserRankingRow,
} from '@/lib/cached-queries'
import { RecommendSection } from '@/components/RecommendSection'
import Link from 'next/link'
import Image from 'next/image'
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

function ProfileAvatar({ user }: { user: ProfileShowcaseUser }) {
  if (user.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatar_url}
        alt={`${user.display_name}のプロフィール`}
        loading="lazy"
        decoding="async"
        className="h-10 w-10 shrink-0 rounded-full border border-gray-200 bg-gray-100 object-cover md:h-20 md:w-20"
      />
    )
  }

  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-gray-200 md:h-20 md:w-20"
      aria-hidden="true"
    >
      <svg
        className="text-gray-400"
        style={{ width: '45%', height: '45%' }}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
      </svg>
    </span>
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
        className="h-10 w-10 shrink-0 rounded-full border border-gray-200 bg-gray-100 object-cover md:h-20 md:w-20"
      />
    )
  }

  const ringColor = AVATAR_RING_COLORS[index % AVATAR_RING_COLORS.length]
  const initial = user.displayName.trim().charAt(0) || '?'
  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ring-1 md:h-20 md:w-20 md:text-xl ${ringColor}`}
      aria-hidden="true"
    >
      {initial}
    </span>
  )
}

function RankBadge({ rank }: { rank: number }) {
  const medal = RANK_MEDALS[rank - 1]

  if (medal) {
    return (
      <span className="absolute left-0.5 top-0.5 z-10 text-sm leading-none md:text-base" aria-label={`${rank}位`}>
        {medal}
      </span>
    )
  }

  return (
    <span className="absolute left-0.5 top-0.5 z-10 rounded bg-gray-100 px-0.5 py-0.5 text-[9px] font-bold leading-none text-gray-500 md:text-[10px]">
      {rank}位
    </span>
  )
}

function PointsBadge({ points }: { points: number }) {
  return (
    <span className="absolute right-0.5 top-0.5 z-10 whitespace-nowrap rounded bg-gray-700 px-0.5 py-0.5 text-[8px] font-bold leading-none text-white md:text-[9px]">
      {points}pt
    </span>
  )
}

function ProfileIconLink({ user }: { user: ProfileShowcaseUser }) {
  return (
    <Link
      href={`/u/${user.profile_slug}`}
      title={user.display_name}
      aria-label={`${user.display_name}のプロフィール`}
      prefetch={false}
      className="relative flex h-12 min-w-0 items-center justify-center overflow-hidden bg-white transition-colors hover:bg-gray-50 md:h-24"
    >
      <ProfileAvatar user={user} />
      <span
        className="absolute inset-x-0 bottom-0 hidden h-5 min-w-0 items-center justify-center border-t border-gray-100 bg-gray-50/95 px-1.5 text-center text-[11px] font-bold leading-none text-slate-700 md:flex"
        title={user.display_name}
      >
        <span className="block w-full truncate">{user.display_name}</span>
      </span>
    </Link>
  )
}

function RankingUserLink({ user, index }: { user: ShowcaseRankingUser; index: number }) {
  const rank = user.rank ?? index + 1

  return (
    <Link
      href={`/u/${user.profileSlug}`}
      title={`${rank}位 ${user.displayName} ${user.points}pt`}
      aria-label={`${rank}位 ${user.displayName}のプロフィール`}
      prefetch={false}
      className="relative flex h-14 min-w-0 items-center justify-center bg-white px-0.5 py-2 text-center transition-colors hover:bg-gray-50 md:h-24 md:px-1 md:py-1"
    >
      <RankBadge rank={rank} />
      <PointsBadge points={user.points} />
      <RankingAvatar user={user} index={index} />
    </Link>
  )
}

function ShowcaseShell({
  title,
  children,
  action,
  titleHref,
  titlePaddingClassName = 'px-3',
}: {
  title: string
  children: ReactNode
  action?: ReactNode
  titleHref?: string
  titlePaddingClassName?: string
}) {
  return (
    <div className="mb-2 border border-gray-300 bg-white">
      <div className={`flex items-center justify-between gap-2 border-b border-gray-300 py-1.5 ${titlePaddingClassName}`}>
        {titleHref ? (
          <Link
            href={titleHref}
            prefetch={false}
            className="min-w-0 truncate font-bold text-sm hover:underline"
            style={{ color: '#004085' }}
          >
            {title}
          </Link>
        ) : (
          <span className="min-w-0 truncate font-bold text-sm" style={{ color: '#004085' }}>
            {title}
          </span>
        )}
        {action}
      </div>
      {children}
    </div>
  )
}

function ProfileShowcase({ users }: { users: ProfileShowcaseUser[] }) {
  if (users.length === 0) return null

  return (
    <ShowcaseShell
      title="👤 みんなのプロフィール"
      titlePaddingClassName="px-2"
      action={
        <Link
          href="/ranking"
          prefetch={false}
          className="shrink-0 rounded px-1.5 py-0.5 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-50 hover:text-blue-800"
          aria-label="ランキングページはこちら"
        >
          ランキングはこちら →
        </Link>
      }
    >
      <div className="grid grid-cols-5 gap-px bg-gray-200 md:grid-cols-10">
        {users.map(user => (
          <ProfileIconLink key={user.profile_slug} user={user} />
        ))}
      </div>
    </ShowcaseShell>
  )
}

function RankingShowcase({ title, users, titleHref }: { title: string; users: ShowcaseRankingUser[]; titleHref?: string }) {
  if (users.length === 0) return null

  return (
    <ShowcaseShell title={title} titleHref={titleHref}>
      <div className="grid grid-cols-5 gap-px bg-gray-200 md:grid-cols-10">
        {users.slice(0, 10).map((user, index) => (
          <RankingUserLink key={user.profileSlug} user={user} index={index} />
        ))}
      </div>
    </ShowcaseShell>
  )
}

function TierMakerShowcase() {
  const makerPath = '/makers/dm26-ex2-charisma-best-tier'

  return (
    <div className="mb-2 overflow-hidden border border-gray-300 bg-white">
      <div className="relative flex h-[112px] min-w-0 items-stretch overflow-hidden bg-slate-950 md:hidden">
        <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-center bg-gradient-to-r from-slate-950 via-slate-950 to-slate-900 px-3 py-2 text-white">
          <div className="mb-0.5 flex items-center gap-1.5">
            <span className="w-fit rounded bg-amber-300 px-1.5 py-0.5 text-[10px] font-black leading-none text-amber-950">
              NEW
            </span>
            <span className="text-[9px] font-bold tracking-wide text-amber-300">
              DM26-EX2 悪感謝祭
            </span>
          </div>
          <h2 className="w-full whitespace-nowrap text-[16px] font-black leading-tight tracking-[-0.055em] text-white">
            カリスマBEST Tier表メーカー
          </h2>
          <p className="mt-0.5 line-clamp-1 text-[11px] leading-tight text-slate-300">
            新弾カードを並べて、自分だけのTier表を作ろう！
          </p>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            <Link href={makerPath} prefetch={false} className="rounded bg-blue-600 px-2 py-1.5 text-center text-[11px] font-bold leading-none text-white">
              Tier表を作る
            </Link>
            <Link href={`${makerPath}/submissions`} prefetch={false} className="rounded border border-white/70 bg-white/10 px-2 py-1.5 text-center text-[11px] font-bold leading-none text-white">
              みんなのTierを見る
            </Link>
          </div>
        </div>
        <Link href={makerPath} prefetch={false} aria-label="Tier表を作る" className="relative w-24 shrink-0 overflow-hidden border-l border-slate-800 bg-stone-900 sm:w-52">
          <Image
            src="/images/makers/dm26-ex2-charisma-best-main.webp"
            alt="DM26-EX2 悪感謝祭 カリスマBEST"
            fill
            priority
            sizes="(max-width: 639px) 96px, 208px"
            className="object-cover object-center"
          />
          <span className="absolute inset-y-0 left-0 w-5 bg-gradient-to-r from-slate-950 to-transparent" aria-hidden="true" />
        </Link>
      </div>

      <div className="relative hidden h-[144px] overflow-hidden bg-slate-950 md:grid md:grid-cols-[56%_44%]">
        <div className="relative z-10 flex min-w-0 flex-col justify-center bg-gradient-to-r from-slate-950 via-slate-950 to-slate-900 px-7 text-white">
          <div className="flex items-center gap-2">
            <span className="rounded bg-amber-300 px-2 py-1 text-[11px] font-black leading-none text-amber-950">NEW</span>
            <span className="text-xs font-bold tracking-wide text-amber-300">DM26-EX2 悪感謝祭</span>
          </div>
          <h2 className="mt-2 text-[25px] font-black leading-none tracking-tight">
            カリスマBEST Tier表メーカー
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            新弾カードを自由に並べて、画像保存・X共有。みんなの評価もまとめて確認できます。
          </p>
          <div className="mt-3 flex gap-2">
            <Link href={makerPath} prefetch={false} className="rounded-md bg-blue-600 px-6 py-2 text-sm font-black leading-none text-white transition-colors hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              Tier表を作る
            </Link>
            <Link href={`${makerPath}/submissions`} prefetch={false} className="rounded-md border border-white/70 bg-white/10 px-5 py-2 text-sm font-bold leading-none text-white transition-colors hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              みんなのTierを見る
            </Link>
          </div>
        </div>
        <Link href={makerPath} prefetch={false} aria-label="Tier表を作る" className="relative block overflow-hidden bg-stone-900">
          <Image
            src="/images/makers/dm26-ex2-charisma-best-main.webp"
            alt="DM26-EX2 悪感謝祭 カリスマBEST"
            fill
            priority
            sizes="44vw"
            className="object-cover object-top transition-transform duration-300 hover:scale-[1.02]"
          />
          <span className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-slate-950 to-transparent" aria-hidden="true" />
        </Link>
      </div>
    </div>
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

  if (mode === 'recommended') {
    return <RecommendSection />
  }

  if (mode === 'tier_maker') {
    return <TierMakerShowcase />
  }

  if (mode === 'monthly_ranking' || mode === 'overall_ranking') {
    const rankings = await getCachedUserRankings()
    const rankingUsers = toRankingUsers(mode === 'monthly_ranking' ? rankings.monthly : rankings.total)
    return (
      <RankingShowcase
        title={mode === 'monthly_ranking' ? '🏆 今月の投稿者ランキング TOP10' : '🏆 総合投稿者ランキング TOP10'}
        titleHref={mode === 'monthly_ranking' ? '/ranking?type=users&period=monthly' : '/ranking?type=users&period=total'}
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
          <div key={i} className="relative flex h-12 min-w-0 items-center justify-center overflow-hidden bg-white md:h-24">
            <div className="h-10 w-10 rounded-full bg-gray-200 md:h-20 md:w-20" />
            <div className="absolute inset-x-0 bottom-0 hidden h-5 border-t border-gray-100 bg-gray-100 md:block" />
          </div>
        ))}
      </div>
    </div>
  )
}
