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

function getActivityBadge(thread: Thread) {
  if (thread.is_archived) return null

  const lastPostedAt = new Date(thread.last_posted_at).getTime()
  const hoursSinceLastPost = Number.isFinite(lastPostedAt)
    ? (Date.now() - lastPostedAt) / (1000 * 60 * 60)
    : Infinity

  if (thread.post_count >= 20) {
    return { label: '盛況', className: 'bg-red-600 text-white' }
  }

  if (thread.post_count >= 5 && hoursSinceLastPost <= 24) {
    return { label: '急上昇', className: 'bg-orange-500 text-white' }
  }

  return null
}

export function ThreadCard({ thread, rank, priority }: Props) {
  const category = getDisplayCategory(thread.categories)
  const imgSrc = resolveImageUrl(thread.image_url) ?? DEFAULT_THREAD_THUMBNAIL
  const activityBadge = getActivityBadge(thread)

  return (
    <Link
      href={`/thread/${thread.id}`}
      prefetch={false}
      className="thread-card bg-white hover:bg-gray-50 overflow-hidden border-b border-r border-gray-300 block"
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
          <div className="mb-0.5 flex min-w-0 items-center gap-1">
            {activityBadge && (
              <span className={`thread-card-activity-badge shrink-0 rounded-sm px-1.5 text-[10px] font-black leading-4 shadow-sm ${activityBadge.className}`}>
                {activityBadge.label}
              </span>
            )}
            {category && (
              <span className="truncate text-[9px] font-bold leading-4 text-gray-500">
                {category.name}
              </span>
            )}
          </div>
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
        <div className="p-1.5 flex-1 min-w-0 relative">
          <div className="mb-0.5 flex min-w-0 items-center gap-1">
            {category && (
              <span className="inline-block shrink-0 text-[9px] font-bold text-white px-1 leading-4" style={{ backgroundColor: category.color }}>
                {category.name}
              </span>
            )}
            {activityBadge && (
              <span className={`thread-card-activity-badge inline-block shrink-0 rounded-sm px-1.5 text-[10px] font-black leading-4 shadow-sm ${activityBadge.className}`}>
                {activityBadge.label}
              </span>
            )}
          </div>
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
