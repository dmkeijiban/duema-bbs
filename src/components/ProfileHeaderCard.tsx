import Link from 'next/link'
import type { ReactNode } from 'react'
import { ProfileAvatar } from './ProfileAvatar'
import { HonorBadge } from './HonorBadge'
import type { HonorTitle } from '@/lib/honor-title'

type ProfileHeaderCardProps = {
  displayName: string
  slug: string
  bio: string | null
  avatarUrl: string | null
  xUrl: string | null
  youtubeUrl: string | null
  createdAtLabel: string
  threadCountLabel: string
  postCountLabel: string
  monthlyRank: number | null
  totalRank: number | null
  honorTitle?: HonorTitle | null
  campaignTitle?: string | null
  campaignRank?: number | null
  campaignPoints?: number | null
  actions?: ReactNode
  mobileCompact?: boolean
  mobileEditHref?: string
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
      <svg
        className="text-gray-400"
        style={{ width: '45%', height: '45%' }}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
      </svg>
    </div>
  )
}

function compactCountLabel(value: string) {
  return value.replace(/件$/, '')
}

export function ProfileHeaderCard({
  displayName,
  slug,
  bio,
  avatarUrl,
  xUrl,
  youtubeUrl,
  createdAtLabel,
  threadCountLabel,
  postCountLabel,
  monthlyRank,
  totalRank,
  honorTitle,
  campaignTitle,
  campaignRank,
  campaignPoints,
  actions,
  mobileCompact = false,
  mobileEditHref,
}: ProfileHeaderCardProps) {
  const avatarSize = mobileCompact ? 'lg' : 'xl'
  const defaultAvatarSize = mobileCompact ? 'h-14 w-14 sm:h-20 sm:w-20' : 'h-20 w-20'
  const titleClassName = mobileCompact
    ? 'text-base font-bold text-gray-900 break-words leading-tight sm:text-2xl'
    : 'text-2xl font-bold text-gray-900 break-words leading-tight'
  const subtleTextClassName = mobileCompact
    ? 'text-xs text-gray-500 mt-0.5 sm:text-sm'
    : 'text-sm text-gray-500 mt-0.5'

  const socialLinks = (xUrl || youtubeUrl) ? (
    <div className="flex flex-wrap gap-2">
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
  ) : null

  return (
    <section className="bg-white border border-gray-300 rounded-sm overflow-hidden">
      <div className={mobileCompact ? 'relative px-3 py-3 sm:px-4 sm:pt-5 sm:pb-4' : 'relative px-4 pt-5 pb-4'}>
        {socialLinks && (
          <>
            {!mobileCompact && (
              <div className="absolute right-3 top-3 z-10 sm:hidden">
                {socialLinks}
              </div>
            )}
            <div className="absolute right-4 top-5 z-10 hidden max-w-[calc(100%-9rem)] sm:block">
              {socialLinks}
            </div>
          </>
        )}

        <div className={mobileCompact ? 'flex flex-row gap-3 sm:gap-4' : 'flex flex-col sm:flex-row gap-4'}>
          {avatarUrl ? (
            <ProfileAvatar src={avatarUrl} alt={`${displayName}のアイコン`} size={avatarSize} />
          ) : (
            <DefaultAvatarIcon size={defaultAvatarSize} />
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-2">
                  <h1 className={titleClassName}>{displayName}</h1>
                  {honorTitle && (
                    <HonorBadge title={honorTitle} className="text-lg" />
                  )}
                  {(monthlyRank === 1 || totalRank === 1) && (
                    <span className={mobileCompact ? 'hidden text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-300 sm:inline-block' : 'inline-block text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-300'}>
                      🏆 1位
                    </span>
                  )}
                  {campaignTitle && (
                    <span className={mobileCompact ? 'hidden text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-300 sm:inline-block' : 'inline-block text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-300'}>
                      {campaignRank != null
                        ? `🏆 ${campaignTitle} ${campaignRank}位 / ${campaignPoints}pt`
                        : `🏆 キャンペーン参加中 / ${campaignPoints ?? 0}pt`}
                    </span>
                  )}
                </div>
                <p className={subtleTextClassName}>@{slug}（{createdAtLabel} 登録）</p>
              </div>

              {mobileCompact && mobileEditHref && (
                <Link
                  href={mobileEditHref}
                  className="shrink-0 rounded border border-blue-300 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50 sm:hidden"
                >
                  編集
                </Link>
              )}
            </div>

            <div className={mobileCompact ? 'mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold text-gray-700 sm:hidden' : 'hidden'}>
              <span>{compactCountLabel(threadCountLabel)}スレッド</span>
              <span>{compactCountLabel(postCountLabel)}コメント</span>
            </div>

            {bio ? (
              <>
                <p className={mobileCompact ? 'hidden text-sm text-gray-700 mt-2 whitespace-pre-wrap leading-6 sm:block' : 'text-sm text-gray-700 mt-2 whitespace-pre-wrap leading-6'}>
                  {bio}
                </p>
              </>
            ) : (
              <div className={mobileCompact ? 'hidden items-center gap-3 mt-2 sm:flex' : 'flex flex-wrap items-center gap-3 mt-2'}>
                <p className="text-sm text-gray-400 italic">
                  自己紹介はまだありません。
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={mobileCompact ? 'hidden border-t border-gray-200 bg-gray-50 text-center sm:grid sm:grid-cols-4 sm:divide-x sm:divide-gray-200' : 'border-t border-gray-200 grid grid-cols-2 bg-gray-50 text-center sm:grid-cols-4 sm:divide-x sm:divide-gray-200'}>
        <div className="border-b border-gray-200 px-3 py-2.5 sm:border-b-0">
          <p className="text-lg font-bold text-gray-900 leading-none">{threadCountLabel}</p>
          <p className="text-xs text-gray-500 mt-1">スレッド</p>
        </div>
        <div className="border-b border-gray-200 px-3 py-2.5 sm:border-b-0">
          <p className="text-lg font-bold text-gray-900 leading-none">{postCountLabel}</p>
          <p className="text-xs text-gray-500 mt-1">コメント</p>
        </div>
        <Link
          href="/ranking?type=users&period=monthly"
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-2.5 hover:bg-blue-50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"
        >
          <p className="text-lg font-bold text-blue-600 leading-none">
            {monthlyRank ? `${monthlyRank}位` : '—'}
          </p>
          <p className="text-xs text-gray-500 mt-1">今月</p>
        </Link>
        <Link
          href="/ranking?type=users&period=total"
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-2.5 hover:bg-indigo-50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400"
        >
          <p className="text-lg font-bold text-indigo-600 leading-none">
            {totalRank ? `${totalRank}位` : '—'}
          </p>
          <p className="text-xs text-gray-500 mt-1">総合</p>
        </Link>
      </div>

      {actions && (
        <div className={mobileCompact ? 'hidden border-t border-gray-100 px-4 py-3 sm:block' : 'border-t border-gray-100 px-4 py-3'}>
          {actions}
        </div>
      )}
    </section>
  )
}

export function ProfileHeaderActionLink({
  href,
  children,
  variant = 'secondary',
}: {
  href: string
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'neutral'
}) {
  const className =
    variant === 'primary'
      ? 'rounded bg-blue-600 px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-blue-700'
      : variant === 'secondary'
        ? 'rounded border border-blue-300 px-4 py-2.5 text-center text-sm font-bold text-blue-700 hover:bg-blue-50'
        : 'rounded border border-gray-300 px-4 py-2.5 text-center text-sm text-gray-700 hover:bg-gray-50'

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  )
}
