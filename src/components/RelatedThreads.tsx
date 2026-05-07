import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase-public'
import Link from 'next/link'

const getCachedRelatedThreads = unstable_cache(
  async (categoryId: number, currentThreadId: number) => {
    const supabase = createPublicClient()
    const { data } = await supabase
      .from('threads')
      .select('id, title, post_count')
      .eq('category_id', categoryId)
      .eq('is_archived', false)
      .neq('id', currentThreadId)
      .order('post_count', { ascending: false })
      .limit(6)
    return data ?? []
  },
  ['related-threads'],
  { revalidate: 600 }
)

interface Props {
  categoryId: number
  categoryName: string
  categorySlug: string
  currentThreadId: number
}

export async function RelatedThreads({ categoryId, categoryName, categorySlug, currentThreadId }: Props) {
  const threads = await getCachedRelatedThreads(categoryId, currentThreadId)
  if (threads.length === 0) return null

  return (
    <div className="mt-3 border border-gray-300 bg-white">
      <div className="px-3 py-1.5 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <span className="text-xs font-bold text-gray-700">
          📋 「{categoryName}」の人気スレッド
        </span>
        <Link
          href={`/category/${categorySlug}`}
          className="text-xs text-blue-600 hover:underline"
        >
          一覧へ
        </Link>
      </div>
      <ul className="divide-y divide-gray-100">
        {threads.map(t => (
          <li key={t.id}>
            <Link
              href={`/thread/${t.id}`}
              className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors"
            >
              <span className="text-xs text-gray-800 line-clamp-1 flex-1 mr-2">{t.title}</span>
              <span className="text-[11px] text-gray-400 shrink-0">{t.post_count}件</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
