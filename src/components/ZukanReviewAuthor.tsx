import Link from 'next/link'
import { ProfileAvatar } from './ProfileAvatar'

type ZukanReviewAuthorProps = {
  displayName: string
  avatarUrl: string | null
  profileSlug: string | null
  isWithdrawn?: boolean
}

export function ZukanReviewAuthor({
  displayName,
  avatarUrl,
  profileSlug,
  isWithdrawn,
}: ZukanReviewAuthorProps) {
  if (isWithdrawn) {
    return <span className="text-xs text-gray-500">退会済みユーザー</span>
  }

  const avatar = avatarUrl ? (
    <ProfileAvatar src={avatarUrl} alt={`${displayName}のアイコン`} size="sm" />
  ) : null

  if (!profileSlug) {
    return (
      <>
        {avatar}
        <span className="font-bold text-gray-700">{displayName}</span>
      </>
    )
  }

  return (
    <>
      {avatar && (
        <Link
          href={`/u/${profileSlug}`}
          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          aria-label={`${displayName}の投稿者ページ`}
        >
          {avatar}
        </Link>
      )}
      <Link
        href={`/u/${profileSlug}`}
        className="font-bold text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        {displayName}
      </Link>
    </>
  )
}
