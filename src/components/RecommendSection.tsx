import { createClient } from '@/lib/supabase-server'
import { withFallbackThumbnails } from '@/lib/thumbnail'
import Link from 'next/link'

const PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3Crect fill='%23e9ecef' width='1' height='1'/%3E%3C/svg%3E"

type Row = { id: number; title: string; image_url: string | null; post_count: number }

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export async function RecommendSection() {
  const supabase = await createClient()
  const { data: raw } = await supabase
    .from('threads')
    .select('id, title, image_url, post_count')
    .eq('is_archived', false)
    .order('post_count', { ascending: false })
    .limit(20)

  if (!raw || raw.length === 0) return null

  const withImages = await withFallbackThumbnails(supabase, raw as Row[])
  const threads = shuffle(withImages).slice(0, 8)

  return (
    <div className="mb-2 border border-gray-300 bg-white">
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-gray-300" style={{ background: '#fff' }}>
        <span style={{ color: '#004085', fontSize: 13 }}>🔖</span>
        <span className="font-bold text-sm" style={{ color: '#004085' }}>オススメ</span>
      </div>
      <div className="grid grid-cols-4 border-l border-t border-gray-300">
        {threads.map(thread => (
          <Link
            key={thread.id}
            href={`/thread/${thread.id}`}
            className="flex bg-white hover:bg-gray-50 border-b border-r border-gray-300 overflow-hidden"
          >
            <div className="shrink-0 bg-gray-100 overflow-hidden" style={{ width: 55, height: 55 }}>
              <img src={thread.image_url ?? PLACEHOLDER} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="p-1 flex-1 min-w-0">
              <p className="text-[10px] leading-snug text-gray-800 line-clamp-4 break-all">
                {thread.title}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
