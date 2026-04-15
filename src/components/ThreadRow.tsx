import Link from 'next/link'
import { Thread, Category } from '@/types'
import { formatRelativeTime } from '@/lib/utils'

const PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3Crect fill='%23e9ecef' width='1' height='1'/%3E%3C/svg%3E"

interface Props {
  thread: Thread & { categories: Category | null }
  rank?: number
}

export function ThreadRow({ thread, rank }: Props) {
  const category = thread.categories
  return (
    <Link
      href={`/thread/${thread.id}`}
      className="flex items-center bg-white hover:bg-gray-50 border-b border-gray-200 last:border-b-0"
    >
      {/* ランク */}
      {rank !== undefined && (
        <span className="shrink-0 w-7 text-center text-xs font-bold text-gray-500">{rank}</span>
      )}
      {/* サムネイル */}
      <div className="relative shrink-0 bg-gray-100 overflow-hidden" style={{ width: 52, height: 52 }}>
        <img src={thread.image_url ?? PLACEHOLDER} alt="" className="w-full h-full object-cover" />
        <span
          className="absolute bottom-0 left-0 right-0 text-[9px] text-white font-bold text-center leading-[14px]"
          style={{ background: 'rgba(0,0,0,0.55)' }}
        >
          💬{thread.post_count}
        </span>
      </div>
      {/* タイトル + カテゴリ */}
      <div className="flex-1 min-w-0 px-2 py-1.5">
        {category && (
          <span className="inline-block text-[9px] font-bold text-white px-1 leading-4 mb-0.5 mr-1" style={{ backgroundColor: category.color }}>
            {category.name}
          </span>
        )}
        <p className="text-sm text-gray-800 line-clamp-2 break-all leading-snug">{thread.title}</p>
      </div>
      {/* 最終更新 */}
      <div className="shrink-0 px-2 text-xs text-gray-400 whitespace-nowrap">
        {formatRelativeTime(thread.last_posted_at ?? thread.created_at)}
      </div>
    </Link>
  )
}
