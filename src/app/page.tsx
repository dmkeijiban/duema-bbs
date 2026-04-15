import { Suspense } from 'react'
import { createClient } from '@/lib/supabase-server'
import { ThreadCard } from '@/components/ThreadCard'
import { Pagination } from '@/components/Pagination'
import { InlineNewThread } from '@/components/InlineNewThread'
import { RecommendSection } from '@/components/RecommendSection'
import { withFallbackThumbnails } from '@/lib/thumbnail'
import { Thread, Category } from '@/types'
import Link from 'next/link'

const PAGE_SIZE = 100

interface SearchParams {
  category?: string
  page?: string
  sort?: string
  q?: string
  archived?: string
}

async function ThreadList({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient()

  const page = Math.max(1, parseInt(searchParams.page ?? '1') || 1)
  const categorySlug = searchParams.category
  const sort = searchParams.sort ?? 'recent'
  const searchQ = searchParams.q?.trim()
  const forceArchived = searchParams.archived === '1'
  const isArchived = sort === 'archived' || forceArchived

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
    .eq('is_archived', isArchived)
  if (categoryId !== null) countQuery = countQuery.eq('category_id', categoryId)
  if (searchQ) countQuery = countQuery.ilike('title', `%${searchQ}%`)
  const { count } = await countQuery

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))
  const offset = (page - 1) * PAGE_SIZE

  let query = supabase
    .from('threads')
    .select('*, categories(id,name,slug,color,description,sort_order)')
    .eq('is_archived', isArchived)

  if (categoryId !== null) query = query.eq('category_id', categoryId)
  if (searchQ) query = query.ilike('title', `%${searchQ}%`)

  if (sort === 'popular') {
    query = query.order('post_count', { ascending: false })
  } else if (sort === 'new') {
    query = query.order('created_at', { ascending: false })
  } else {
    query = query.order('last_posted_at', { ascending: false })
  }

  query = query.range(offset, offset + PAGE_SIZE - 1)
  const { data: rawThreads } = await query
  const threads = rawThreads ? await withFallbackThumbnails(supabase, rawThreads) : null

  if (!threads || threads.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500 bg-white border border-gray-300">
        <p>{searchQ ? `「${searchQ}」の検索結果がありません` : 'スレッドがまだありません'}</p>
        {!searchQ && (
          <Link href="/thread/new" className="mt-3 inline-block text-blue-600 hover:underline text-sm">
            最初のスレッドを立てる →
          </Link>
        )}
      </div>
    )
  }

  return (
    <>
      {searchQ && (
        <div className="mb-2 px-3 py-1.5 text-xs border border-gray-300 bg-white text-gray-600">
          「{searchQ}」の検索結果：{count}件
        </div>
      )}
      <div className="grid grid-cols-3 md:grid-cols-5 border-l border-t border-gray-300">
        {(threads as (Thread & { categories: Category | null })[]).map((thread, i) => (
          <ThreadCard
            key={thread.id}
            thread={thread}
            rank={sort === 'popular' ? i + 1 + offset : undefined}
          />
        ))}
      </div>
      <div className="mt-3">
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
  const base = params.category ? `?category=${params.category}&` : '?'

  return (
    <div className="w-full px-0 py-0">
      <div className="max-w-screen-xl mx-auto px-2 pt-2">
        {/* オススメ */}
        <Suspense fallback={null}>
          <RecommendSection />
        </Suspense>


        {/* 緑のインフォアラート */}
        <div className="mb-2 px-3 py-2 text-sm border" style={{ color: '#155724', background: '#d4edda', borderColor: '#c3e6cb' }}>
          デュエルマスターズ専門の掲示板です。デッキ相談・カード評価・大会情報など何でもどうぞ。
          初めての方は<Link href="/thread/new" className="text-blue-600 hover:underline">スレッドの立て方</Link>をご確認ください。
        </div>
      </div>

      {/* タブ */}
      <div className="max-w-screen-xl mx-auto px-2">
        <ul className="flex mb-3 mt-2 text-sm" style={{ borderBottom: '1px solid #dee2e6' }}>
          {[
            { label: '更新順',   sort: 'recent',   icon: '↺' },
            { label: '新着',     sort: 'new',      icon: '⏱' },
            { label: '人気',     sort: 'popular',  icon: '📊' },
            { label: '過去ログ', sort: 'archived', icon: '📂' },
          ].map((tab) => {
            const active = sort === tab.sort
            return (
              <li key={tab.sort} className="flex-1">
                <Link
                  href={`${base}sort=${tab.sort}`}
                  className="block text-center py-2 font-medium transition-colors border border-transparent"
                  style={
                    active
                      ? { background: '#0d6efd', color: '#fff', borderColor: '#0d6efd', borderRadius: '4px 4px 0 0', marginBottom: -1 }
                      : { color: '#0d6efd' }
                  }
                >
                  <span className="mr-1 opacity-80">{tab.icon}</span>{tab.label}
                </Link>
              </li>
            )
          })}
          {/* カテゴリドロップダウン */}
          <li className="flex-1 relative group">
            <button className="w-full text-center py-2 font-medium" style={{ color: '#0d6efd' }}>
              📂 カテゴリ ▾
            </button>
            <div className="hidden group-hover:block absolute right-0 top-full bg-white border border-gray-300 shadow-lg z-50 min-w-max text-sm">
              <Link href={`/?sort=${sort}`} className="block px-4 py-1.5 hover:bg-gray-100 text-gray-700">すべて</Link>
              {categories?.map(c => (
                <Link key={c.slug} href={`/?category=${c.slug}&sort=${sort}`}
                  className="block px-4 py-1.5 hover:bg-gray-100 text-gray-700">
                  {c.name}
                </Link>
              ))}
            </div>
          </li>
        </ul>
      </div>

      {/* スレッド一覧 */}
      <div className="max-w-screen-xl mx-auto px-2">
        <Suspense fallback={<ThreadListSkeleton />}>
          <ThreadList searchParams={params} />
        </Suspense>

        {/* 下部ナビ（記号付き） */}
        <div className="flex mt-3 text-sm border border-gray-300">
          {[
            { label: '↺ 更新順一覧', sort: 'recent' },
            { label: '⏱ 新着一覧',   sort: 'new' },
            { label: '📊 ランキング', sort: 'popular' },
            { label: '📂 過去ログ',   sort: 'archived' },
          ].map((btn) => (
            <Link
              key={btn.sort}
              href={`/?sort=${btn.sort}`}
              className="flex-1 text-center py-2 hover:bg-gray-50 text-blue-600 border-r border-gray-300 last:border-r-0"
            >
              {btn.label}
            </Link>
          ))}
        </div>

        {/* 新規スレッド作成フォーム */}
        <InlineNewThread categories={categories ?? []} />

        <div className="mb-6" />
      </div>
    </div>
  )
}


function SetupGuide() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">デュエマ掲示板</h1>
      <p className="text-gray-500 mb-8">Supabaseの設定が必要です</p>
      <div className="bg-white border border-gray-200 p-6 text-left space-y-4 text-sm">
        <h2 className="font-bold text-gray-800 text-base">セットアップ手順</h2>
        <ol className="space-y-3 text-gray-600 list-decimal list-inside">
          <li><a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">supabase.com</a> でプロジェクトを作成</li>
          <li>SQL Editor で <code className="bg-gray-100 px-1">supabase/schema.sql</code> を実行</li>
          <li>Storage → <code className="bg-gray-100 px-1">bbs-images</code> バケットをPublicで作成</li>
          <li><code className="bg-gray-100 px-1">.env.local</code> にURLとANON KEYを設定</li>
        </ol>
      </div>
    </div>
  )
}

function ThreadListSkeleton() {
  return (
    <div className="grid grid-cols-3 md:grid-cols-5 border-l border-t border-gray-300 animate-pulse">
      {[...Array(15)].map((_, i) => (
        <div key={i} className="flex border-b border-r border-gray-300 bg-white" style={{ height: 80 }}>
          <div className="bg-gray-200 shrink-0" style={{ width: 80, height: 80 }} />
          <div className="p-1.5 flex-1 space-y-1.5">
            <div className="h-2 bg-gray-200 rounded w-full" />
            <div className="h-2 bg-gray-200 rounded w-4/5" />
            <div className="h-2 bg-gray-100 rounded w-1/3 mt-2" />
          </div>
        </div>
      ))}
    </div>
  )
}
