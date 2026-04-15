import { Suspense } from 'react'
import { createClient } from '@/lib/supabase-server'
import { ThreadCard } from '@/components/ThreadCard'
import { Pagination } from '@/components/Pagination'
import { InlineNewThread } from '@/components/InlineNewThread'
import { RecommendSection } from '@/components/RecommendSection'
import { SortTabs } from '@/components/SortTabs'
import { BottomNav } from '@/components/ThreadSortPage'
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

  // ソート別ヘッダー
  const sortHeaders: Record<string, { label: string; sub?: string; icon: string }> = {
    recent:   { icon: '↺', label: '更新順一覧' },
    new:      { icon: '⏱', label: '新着スレッド一覧' },
    popular:  { icon: '📊', label: '人気スレッド', sub: '過去3日間 / 100位まで' },
    archived: { icon: '📂', label: '過去ログ一覧' },
  }
  const hd = sortHeaders[sort]

  return (
    <>
      {/* ソート別ヘッダー */}
      {hd && !searchQ && (
        <div className="mb-2 px-3 py-1.5 border border-gray-300 bg-white flex items-baseline gap-2">
          <span className="font-bold text-sm text-gray-800">{hd.icon} {hd.label}</span>
          {hd.sub && <span className="text-xs text-gray-500">（{hd.sub}）</span>}
        </div>
      )}

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

      {/* タブ（クライアント側で即時フィードバック） */}
      <SortTabs currentSort={sort} currentCategory={params.category} categories={categories ?? []} />

      {/* スレッド一覧 */}
      <div className="max-w-screen-xl mx-auto px-2">
        <Suspense fallback={<ThreadListSkeleton />}>
          <ThreadList searchParams={params} />
        </Suspense>

        {/* 下部ナビ（記号付き） */}
        <BottomNav />

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
      {[...Array(10)].map((_, i) => (
        <div key={i} className="flex border-b border-r border-gray-300 bg-white" style={{ minHeight: 64 }}>
          {/* モバイル: 64px画像 */}
          <div className="bg-gray-200 shrink-0" style={{ width: 64, height: 64 }} />
          <div className="p-1.5 flex-1 space-y-1.5 pt-2">
            <div className="h-2 bg-gray-200 rounded w-full" />
            <div className="h-2 bg-gray-200 rounded w-4/5" />
            <div className="h-2 bg-gray-100 rounded w-3/5" />
          </div>
        </div>
      ))}
    </div>
  )
}
