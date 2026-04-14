import { Suspense } from 'react'
import { createClient } from '@/lib/supabase-server'
import { ThreadCard } from '@/components/ThreadCard'
import { CategoryFilter } from '@/components/CategoryFilter'
import { Pagination } from '@/components/Pagination'
import { Thread, Category } from '@/types'
import { TrendingUp, Clock } from 'lucide-react'
import Link from 'next/link'

const PAGE_SIZE = 30

interface SearchParams {
  category?: string
  page?: string
  sort?: string
}

async function ThreadList({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient()

  const page = Math.max(1, parseInt(searchParams.page ?? '1') || 1)
  const categorySlug = searchParams.category
  const sort = searchParams.sort ?? 'recent'

  let categoryId: number | null = null
  if (categorySlug) {
    const { data: cat } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', categorySlug)
      .single()
    categoryId = cat?.id ?? null
  }

  let countQuery = supabase
    .from('threads')
    .select('id', { count: 'exact', head: true })
    .eq('is_archived', false)
  if (categoryId !== null) countQuery = countQuery.eq('category_id', categoryId)
  const { count } = await countQuery

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))
  const offset = (page - 1) * PAGE_SIZE

  let query = supabase
    .from('threads')
    .select('*, categories(id,name,slug,color,description,sort_order)')
    .eq('is_archived', false)

  if (categoryId !== null) query = query.eq('category_id', categoryId)

  if (sort === 'popular') {
    query = query.order('post_count', { ascending: false })
  } else {
    query = query.order('last_posted_at', { ascending: false })
  }

  query = query.range(offset, offset + PAGE_SIZE - 1)
  const { data: threads } = await query

  if (!threads || threads.length === 0) {
    return (
      <div className="col-span-full text-center py-20 text-gray-400">
        <p className="text-base">スレッドがまだありません</p>
        <Link
          href="/thread/new"
          className="mt-4 inline-block text-blue-600 hover:underline text-sm"
        >
          最初のスレッドを立てる →
        </Link>
      </div>
    )
  }

  return (
    <>
      {/* スレッドグリッド */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
        {(threads as (Thread & { categories: Category | null })[]).map((thread, i) => (
          <ThreadCard
            key={thread.id}
            thread={thread}
            rank={sort === 'popular' ? i + 1 + offset : undefined}
          />
        ))}
      </div>

      <div className="mt-6">
        <Pagination currentPage={page} totalPages={totalPages} />
      </div>
    </>
  )
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams

  const isConfigured =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('http') &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!isConfigured) {
    return <SetupGuide />
  }

  const supabase = await createClient()
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order')
  const sort = params.sort ?? 'recent'

  return (
    <div className="max-w-6xl mx-auto px-3 py-4">
      {/* カテゴリ＆ソートバー */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4 p-2.5 rounded" style={{ backgroundColor: '#fff', border: '1px solid #e0e0e0' }}>
        <Suspense fallback={<div className="h-7" />}>
          <CategoryFilter categories={categories ?? []} />
        </Suspense>
        <div className="sm:ml-auto shrink-0">
          <SortLinks currentSort={sort} categorySlug={params.category} />
        </div>
      </div>

      {/* スレッド一覧 */}
      <Suspense fallback={<ThreadListSkeleton />}>
        <ThreadList searchParams={params} />
      </Suspense>
    </div>
  )
}

function SortLinks({
  currentSort,
  categorySlug,
}: {
  currentSort: string
  categorySlug?: string
}) {
  const base = categorySlug ? `?category=${categorySlug}&` : '?'
  return (
    <div className="flex gap-1 border border-gray-200 rounded p-0.5 bg-gray-50">
      <Link
        href={`${base}sort=recent`}
        className="flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition-colors"
        style={
          currentSort !== 'popular'
            ? { backgroundColor: 'var(--header-bg)', color: '#fff' }
            : { color: '#555' }
        }
      >
        <Clock className="w-3 h-3" />
        新着順
      </Link>
      <Link
        href={`${base}sort=popular`}
        className="flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition-colors"
        style={
          currentSort === 'popular'
            ? { backgroundColor: 'var(--header-bg)', color: '#fff' }
            : { color: '#555' }
        }
      >
        <TrendingUp className="w-3 h-3" />
        人気順
      </Link>
    </div>
  )
}

function SetupGuide() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <div className="text-6xl mb-6">⚔️</div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">デュエルBBS</h1>
      <p className="text-gray-500 mb-8">Supabaseの設定が必要です</p>
      <div className="bg-white border border-gray-200 rounded-xl p-6 text-left space-y-4 text-sm">
        <h2 className="font-bold text-gray-800 text-base">セットアップ手順</h2>
        <ol className="space-y-3 text-gray-600 list-decimal list-inside">
          <li>
            <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">supabase.com</a> でプロジェクトを作成
          </li>
          <li>SQL Editor で <code className="bg-gray-100 px-1 rounded">supabase/schema.sql</code> を実行</li>
          <li>Storage → <code className="bg-gray-100 px-1 rounded">bbs-images</code> バケットをPublicで作成</li>
          <li>
            <code className="bg-gray-100 px-1 rounded">.env.local</code> に以下を設定してサーバーを再起動：
            <pre className="mt-2 bg-gray-50 border border-gray-200 rounded p-3 overflow-x-auto text-xs">
{`NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...`}
            </pre>
          </li>
        </ol>
        <p className="text-xs text-gray-400 pt-2">
          詳細は <code className="bg-gray-100 px-1 rounded">SETUP.md</code> を参照してください
        </p>
      </div>
    </div>
  )
}

function ThreadListSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
      {[...Array(10)].map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded overflow-hidden animate-pulse">
          <div className="bg-gray-200" style={{ aspectRatio: '4/3' }} />
          <div className="p-2 space-y-1.5">
            <div className="h-3 bg-gray-100 rounded w-full" />
            <div className="h-3 bg-gray-100 rounded w-2/3" />
          </div>
        </div>
      ))}
    </div>
  )
}
