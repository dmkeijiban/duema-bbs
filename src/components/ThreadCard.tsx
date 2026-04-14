import Link from 'next/link'
import { Thread } from '@/types'
import { formatRelativeTime } from '@/lib/utils'

// グレーのプレースホルダー SVG（画像なしスレ用）
const PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 4 3'%3E%3Crect fill='%23d1d5db' width='4' height='3'/%3E%3Ctext x='2' y='2.1' font-size='1.2' text-anchor='middle' fill='%239ca3af'%3E%F0%9F%83%8F%3C/text%3E%3C/svg%3E"

interface Props {
  thread: Thread
  rank?: number
}

export function ThreadCard({ thread, rank }: Props) {
  const category = thread.categories

  return (
    <article className="group rounded overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)' }}>
      <Link href={`/thread/${thread.id}`} className="block">
        {/* サムネイル */}
        <div className="relative overflow-hidden bg-gray-100" style={{ aspectRatio: '4/3' }}>
          <img
            src={thread.image_url ?? PLACEHOLDER}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />

          {/* レス数バッジ（右上・赤） */}
          <span
            className="absolute top-1 right-1 text-white text-xs font-bold px-1.5 py-0.5 rounded leading-none min-w-[1.6rem] text-center"
            style={{ backgroundColor: 'var(--badge-red)' }}
            title="レス数"
          >
            {thread.post_count}
          </span>

          {/* ランクバッジ（左上） */}
          {rank !== undefined && (
            <span
              className="absolute top-1 left-1 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded"
              style={{ backgroundColor: 'var(--header-bg)' }}
            >
              {rank}
            </span>
          )}

          {/* カテゴリラベル（左下） */}
          {category && (
            <span
              className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-xs font-medium text-white leading-none"
              style={{ backgroundColor: category.color }}
            >
              {category.name}
            </span>
          )}

          {/* 過去ログ */}
          {thread.is_archived && (
            <span className="absolute top-1 left-1 bg-gray-600 text-white text-xs px-1.5 py-0.5 rounded leading-none">
              過去ログ
            </span>
          )}
        </div>

        {/* テキスト情報 */}
        <div className="p-2">
          <h2
            className="text-sm font-medium leading-snug line-clamp-2 min-h-[2.6rem] group-hover:text-blue-700 transition-colors"
            style={{ color: 'var(--foreground)' }}
          >
            {thread.title}
          </h2>
          <div className="flex items-center justify-between mt-1 text-xs text-gray-400">
            <span>{formatRelativeTime(thread.last_posted_at)}</span>
            <span>{thread.view_count.toLocaleString()}view</span>
          </div>
        </div>
      </Link>
    </article>
  )
}
