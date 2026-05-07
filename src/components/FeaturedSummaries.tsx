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
    <section className="mb-2">
      <h2 className="text-sm font-bold text-gray-700 px-2 py-1.5 border border-gray-300 bg-orange-50 mb-0 flex items-center justify-between">
        <span>📝 人気記事まとめ</span>
        <Link href="/summary" className="text-xs font-normal text-blue-600 hover:underline">一覧へ</Link>
      </h2>
      <div className="border border-t-0 border-gray-300 divide-y divide-gray-200 bg-white">
        {summaries.map(s => (
          <Link
            key={s.id}
            href={`/summary/${s.slug}`}
            className="flex items-center justify-between px-3 py-2.5 hover:bg-blue-50 transition-colors"
          >
            <p className="text-sm text-blue-700 font-medium line-clamp-1">{s.title}</p>
            <span className="text-xs text-blue-400 ml-2 shrink-0">▶</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
