import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase-public'
import Link from 'next/link'

interface SummaryThread {
  id: number
  category_name: string | null
}

interface Summary {
  id: number
  slug: string
  title: string
  period_start: string
  period_end: string
  threads: SummaryThread[]
}

const getCachedRecentSummaries = unstable_cache(
  async () => {
    const supabase = createPublicClient()
    const { data } = await supabase
      .from('summaries')
      .select('id, slug, title, period_start, period_end, threads')
      .eq('published', true)
      .order('created_at', { ascending: false })
      .limit(10)
    return (data ?? []) as Summary[]
  },
  ['category-summaries'],
  { revalidate: 3600, tags: ['summaries'] }
)

interface Props {
  categoryName: string
}

export async function CategorySummarySection({ categoryName }: Props) {
  const summaries = await getCachedRecentSummaries()

  // カテゴリに合致するまとめを優先、なければ最新2件
  const matched = summaries.filter(s =>
    s.threads.some(t => t.category_name === categoryName)
  )
  const toShow = (matched.length > 0 ? matched : summaries).slice(0, 3)

  if (toShow.length === 0) return null

  return (
    <div className="mb-2 border border-gray-300 bg-white">
      <div className="px-3 py-1.5 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <span className="text-xs font-bold text-gray-700">📊 まとめ記事</span>
        <Link href="/summary" className="text-xs text-blue-600 hover:underline">
          一覧へ
        </Link>
      </div>
      <ul className="divide-y divide-gray-100">
        {toShow.map(s => (
          <li key={s.id}>
            <Link
              href={`/summary/${s.slug}`}
              className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors"
            >
              <span className="text-xs text-gray-800 line-clamp-1 flex-1 mr-2">{s.title}</span>
              <span className="text-[11px] text-gray-400 shrink-0 whitespace-nowrap">
                {s.period_start}〜{s.period_end}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
