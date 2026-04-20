import { getCachedTopThreads } from '@/lib/cached-queries'
import Link from 'next/link'
import Image from 'next/image'

// 30分ごとに変わるseedで安定シャッフル（タブ切り替えでは変わらない）
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr]
  let s = seed
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    const j = Math.abs(s) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export async function RecommendSection() {
  const raw = await getCachedTopThreads()
  if (raw.length === 0) return null

  const seed = Math.floor(Date.now() / (1000 * 60 * 30)) // 30分ごとに変化
  const threads = seededShuffle(raw, seed).slice(0, 8)

  return (
    <div className="mb-2 border border-gray-300 bg-white">
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-gray-300" style={{ background: '#fff' }}>
        <span style={{ color: '#004085', fontSize: 13 }}>🔖</span>
        <span className="font-bold text-sm" style={{ color: '#004085' }}>オススメ</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 border-l border-t border-gray-300">
        {threads.map((thread, idx) => (
          <Link
            key={thread.id}
            href={`/thread/${thread.id}`}
            className="flex bg-white hover:bg-gray-50 border-b border-r border-gray-300 overflow-hidden"
          >
            <div className="relative shrink-0 bg-gray-100 overflow-hidden w-11 h-11 md:w-16 md:h-16">
              {thread.image_url && (
                <Image src={thread.image_url} alt="" fill className="object-cover" sizes="(min-width: 768px) 64px, 44px" priority={idx === 0} />
              )}
            </div>
            <div className="px-1 py-0.5 flex-1 min-w-0">
              <p className="text-[10px] md:text-[13px] leading-snug text-gray-800 line-clamp-3 break-all">
                {thread.title}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
