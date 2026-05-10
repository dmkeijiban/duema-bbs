import { getCachedRelatedThreads, getCachedTopThreads } from '@/lib/cached-queries'
import Link from 'next/link'
import Image from 'next/image'
import { seededShuffle } from '@/lib/stable-shuffle'

/** CLS防止用スケルトン — fallback={null}の代わりに使う */
export function RecommendSectionSkeleton() {
  return (
    <div className="mb-2 border border-gray-300 bg-white animate-pulse">
      <div className="px-3 py-1.5 border-b border-gray-300 flex items-center gap-1.5">
        <div className="h-5 bg-gray-200 rounded w-16" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 border-l border-t border-gray-300">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex border-b border-r border-gray-300 overflow-hidden">
            <div className="shrink-0 bg-gray-200 w-11 h-11 md:w-16 md:h-16" />
            <div className="flex-1 px-1 py-0.5 flex flex-col gap-1 justify-center">
              <div className="h-2 bg-gray-200 rounded w-full" />
              <div className="h-2 bg-gray-200 rounded w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// 30分ごとに変わるseedで安定シャッフル（タブ切り替えでは変わらない）
interface Props {
  threadId?: number
  title?: string
  categoryId?: number | null
}

export async function RecommendSection({ threadId, title, categoryId = null }: Props = {}) {
  const raw = threadId && title
    ? await getCachedRelatedThreads(threadId, title, categoryId)
    : await getCachedTopThreads()
  if (raw.length === 0) return null

  const threads = seededShuffle(raw).slice(0, 8)

  return (
    <div className="mb-2 border border-gray-300 bg-white">
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-gray-300" style={{ background: '#fff' }}>
        <span style={{ color: '#004085', fontSize: 13 }}>🔖</span>
        <span className="font-bold text-sm" style={{ color: '#004085' }}>オススメ</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 border-l border-t border-gray-300">
        {threads.map((thread, idx) => {
          const imgSrc = thread.image_url ?? '/default-thumbnail.jpg'
          return (
            <Link
              key={thread.id}
              href={`/thread/${thread.id}`}
              className="flex bg-white hover:bg-gray-50 border-b border-r border-gray-300 overflow-hidden"
            >
              <div className="relative shrink-0 bg-gray-100 overflow-hidden w-11 h-11 md:w-16 md:h-16">
                <Image
                  src={imgSrc}
                  alt=""
                  fill
                  className={thread.image_url ? 'object-cover' : 'object-contain'}
                  sizes="256px"
                  quality={85}
                  priority={idx === 0}
                />
              </div>
              <div className="px-1 py-0.5 flex-1 min-w-0">
                <p className="text-[10px] md:text-[13px] leading-snug text-gray-800 line-clamp-3 break-all">
                  {thread.title}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
