import Link from 'next/link'
import { Thread } from '@/types'
import { resolveImageUrl } from '@/lib/utils'
import { DEFAULT_THREAD_THUMBNAIL } from '@/lib/thumbnail'
import { SafeThumbnail } from '@/components/SafeThumbnail'
import { getDisplayCategory } from '@/lib/categories'

interface Props {
  thread: Thread
  rank?: number
  priority?: boolean
}

function getActivityClass(thread: Thread) {
  if (thread.is_archived) return ''

  const lastPostedAt = new Date(thread.last_posted_at).getTime()
  const hoursSinceLastPost = Number.isFinite(lastPostedAt)
    ? (Date.now() - lastPostedAt) / (1000 * 60 * 60)
    : Infinity

  if (thread.post_count >= 20) return 'thread-card-highlight-hot'
  if (thread.post_count >= 5 && hoursSinceLastPost <= 24) return 'thread-card-highlight-rising'

  return ''
}

export function ThreadCard({ thread, rank, priority }: Props) {
  const category = getDisplayCategory(thread.categories)
  const imgSrc = resolveImageUrl(thread.image_url) ?? DEFAULT_THREAD_THUMBNAIL
  const activityClass = getActivityClass(thread)

  return (
    <Link
      href={`/thread/${thread.id}`}
      prefetch={false}
      className={`thread-card ${activityClass} bg-white hover:bg-gray-50 overflow-hidden border-b border-r border-gray-300 block`}
    >
      <div className="md:hidden flex" style={{ height: 52, overflow: 'hidden' }}>
        <div className="relative shrink-0 overflow-hidden bg-gray-100" style={{ width: 52, height: 52 }}>
          <SafeThumbnail src={imgSrc} alt={thread.title} priority={priority} />
          {rank !== undefined && (
            <span className="absolute top-0 left-0 bg-gray-800 bg-opacity-80 text-white text-[10px] font-bold px-1 leading-4">
              {rank}
            </span>
          )}
          {thread.is_archived && (
            <span className="absolute top-0 right-0 bg-gray-600 bg-opacity-80 text-white text-[9px] px-1 leading-4">
              過去
            </span>
          )}
          <span className="absolute bottom-0 left-0 right-0 text-white text-[9px] font-bold px-1 leading-[14px] flex items-center gap-0.5" style={{ background: 'rgba(0,0,0,0.52)' }}>
            💬{thread.post_count}
          </span>
        </div>
        <div className="px-1.5 py-1 flex-1 min-w-0">
          {category && (
            <span className="mb-0.5 inline-block max-w-full truncate text-[9px] font-bold leading-4 text-gray-500">
              {category.name}
            </span>
          )}
          <p className="text-[11px] leading-snug text-gray-800 line-clamp-2 break-all">
            {thread.title}
          </p>
        </div>
      </div>

      <div className="hidden md:flex" style={{ height: 80, overflow: 'hidden' }}>
        <div className="relative shrink-0 overflow-hidden bg-gray-100" style={{ width: 80, height: 80 }}>
          <SafeThumbnail src={imgSrc} alt={thread.title} priority={priority} />
          {rank !== undefined && (
            <span className="absolute top-0 left-0 bg-gray-800 bg-opacity-80 text-white text-[10px] font-bold px-1 leading-4">
              {rank}
            </span>
          )}
          {thread.is_archived && (
            <span className="absolute top-0 right-0 bg-gray-600 bg-opacity-80 text-white text-[9px] px-1 leading-4">
              過去
            </span>
          )}
        </div>
        <div className="p-1.5 pr-10 pb-5 flex-1 min-w-0 relative">
          {category && (
            <span className="inline-block text-[9px] font-bold text-white px-1 leading-4 mb-0.5" style={{ backgroundColor: category.color }}>
              {category.name}
            </span>
          )}
          <p className="text-[12px] leading-snug text-gray-800 line-clamp-2 break-all">
            {thread.title}
          </p>
          <span className="absolute bottom-1 right-1 text-white text-[10px] font-bold px-1 leading-4 flex items-center gap-0.5" style={{ backgroundColor: '#dc3545' }}>
            💬{thread.post_count}
          </span>
        </div>
      </div>
    </Link>
  )
}
