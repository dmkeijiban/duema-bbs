import { getCachedProfileShowcaseUsers, type ProfileShowcaseUser } from '@/lib/cached-queries'
import Link from 'next/link'

const AVATAR_RING_COLORS = [
  'bg-blue-50 text-blue-700 ring-blue-100',
  'bg-green-50 text-green-700 ring-green-100',
  'bg-yellow-50 text-yellow-700 ring-yellow-200',
  'bg-pink-50 text-pink-700 ring-pink-100',
  'bg-gray-100 text-gray-600 ring-gray-200',
]

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

function ProfileIconLink({ user, index }: { user: ProfileShowcaseUser; index: number }) {
  return (
    <Link
      href={`/u/${user.profile_slug}`}
      title={user.display_name}
      aria-label={`${user.display_name}のプロフィール`}
      prefetch={false}
      className="flex h-20 w-20 shrink-0 items-center justify-center bg-white transition-colors hover:bg-gray-50 md:h-24 md:w-auto md:min-w-0"
    >
      <ProfileAvatar user={user} index={index} />
    </Link>
  )
}

export async function TopRankingShowcase() {
  const users = await getCachedProfileShowcaseUsers()
  if (users.length === 0) return null

  return (
    <div className="mb-2 border border-gray-300 bg-white">
      <div className="flex items-center gap-1.5 border-b border-gray-300 px-3 py-1.5">
        <span className="font-bold text-sm" style={{ color: '#004085' }}>
          👤 みんなのプロフィール
        </span>
      </div>
      <div className="overflow-x-auto">
        <div className="flex min-w-max gap-px bg-gray-200 md:grid md:min-w-0 md:grid-cols-10">
          {users.map((user, index) => (
            <ProfileIconLink key={user.profile_slug} user={user} index={index} />
          ))}
        </div>
      </div>
    </div>
  )
}

export function TopRankingShowcaseSkeleton() {
  return (
    <div className="mb-2 border border-gray-300 bg-white animate-pulse">
      <div className="px-3 py-1.5 border-b border-gray-300 flex items-center gap-1.5">
        <div className="h-5 bg-gray-200 rounded w-44" />
      </div>
      <div className="overflow-x-auto">
        <div className="flex min-w-max gap-px bg-gray-200 md:grid md:min-w-0 md:grid-cols-10">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="flex h-20 w-20 shrink-0 items-center justify-center bg-white md:h-24 md:w-auto">
              <div className="h-12 w-12 rounded-full bg-gray-200 md:h-20 md:w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
