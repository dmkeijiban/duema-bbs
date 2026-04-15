import Link from 'next/link'
import { Thread } from '@/types'

const PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3Crect fill='%23e9ecef' width='1' height='1'/%3E%3C/svg%3E"

interface Props {
  thread: Thread
  rank?: number
}

export function ThreadCard({ thread, rank }: Props) {
  const category = thread.categories

  return (
    <Link
      href={`/thread/${thread.id}`}
      className="thread-card bg-white hover:bg-gray-50 overflow-hidden border-b border-r border-gray-300 block"
    >
      {/* ── モバイル: 縦並び ── */}
      <div className="md:hidden flex flex-col">
        {/* 画像 */}
        <div className="relative w-full overflow-hidden bg-gray-100" style={{ height: 72 }}>
          <img src={thread.image_url ?? PLACEHOLDER} alt="" className="w-full h-full object-cover" />
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
        {/* コメント数バー（画像直下・横長） */}
        <div className="flex items-center gap-0.5 px-1 text-white text-[10px] font-bold leading-4" style={{ backgroundColor: '#dc3545' }}>
          💬{thread.post_count}
        </div>
        {/* タイトル（カテゴリなし） */}
        <div className="px-1 py-0.5">
          <p className="text-[11px] leading-snug text-gray-800 line-clamp-2 break-all">
            {thread.title}
          </p>
        </div>
      </div>

      {/* ── PC: 横並び ── */}
      <div className="hidden md:flex" style={{ minHeight: 80 }}>
        {/* 画像 */}
        <div className="relative shrink-0 overflow-hidden bg-gray-100" style={{ width: 80, height: 80 }}>
          <img src={thread.image_url ?? PLACEHOLDER} alt="" className="w-full h-full object-cover" />
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
        {/* テキスト */}
        <div className="p-1.5 flex-1 min-w-0 relative">
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
