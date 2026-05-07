import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase-public'
import Link from 'next/link'

const getCachedFeaturedSummaries = unstable_cache(
  async () => {
    const supabase = createPublicClient()
    const { data } = await supabase
      .from('summaries')
      .select('id, slug, title, type')
      .eq('published', true)
      .eq('type', 'manual')
      .order('created_at', { ascending: false })
      .limit(3)
    return data ?? []
  },
  ['featured-summaries'],
  { revalidate: 3600, tags: ['summaries'] }
)

export async function FeaturedSummaries() {
  const summaries = await getCachedFeaturedSummaries()
  if (summaries.length === 0) return null

  return (
    <div className="mb-2 border border-gray-300 bg-white">
      <div className="px-3 py-1.5 border-b border-gray-200 flex items-center justify-between">
        <span className="text-xs font-bold text-gray-700">注目まとめ</span>
        <Link href="/summary" className="text-xs text-blue-600 hover:underline">一覧へ</Link>
      </div>
      <ul className="divide-y divide-gray-100">
        {summaries.map(s => (
          <li key={s.id}>
            <Link
              href={`/summary/${s.slug}`}
              className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors"
            >
              <span className="text-xs text-gray-800 flex-1 line-clamp-1">{s.title}</span>
              <span className="text-[11px] text-gray-400 shrink-0 ml-2">▶</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
