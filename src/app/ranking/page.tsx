import { Suspense } from 'react'
import { createClient } from '@/lib/supabase-server'
import { ThreadCard } from '@/components/ThreadCard'
import { RecommendSection } from '@/components/RecommendSection'
import { withFallbackThumbnails } from '@/lib/thumbnail'
import { Thread, Category } from '@/types'
import Link from 'next/link'

const LIMIT = 100

async function RankingList() {
  const supabase = await createClient()

  // 過去3日間でpost_countが多い順
  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

  // まず過去3日間に更新があったスレッドをpost_count順で取得
  const { data: rawThreads } = await supabase
    .from('threads')
    .select('*, categories(id,name,slug,color,description,sort_order)')
    .eq('is_archived', false)
    .gte('last_posted_at', since)
    .order('post_count', { ascending: false })
    .limit(LIMIT)

  // 足りない場合は全体からpost_count順で補完
  const threads = rawThreads && rawThreads.length >= 20
    ? rawThreads
    : await (async () => {
        const { data } = await supabase
          .from('threads')
          .select('*, categories(id,name,slug,color,description,sort_order)')
          .eq('is_archived', false)
          .order('post_count', { ascending: false })
          .limit(LIMIT)
        return data ?? []
      })()

  const withImages = threads.length > 0
    ? await withFallbackThumbnails(supabase, threads)
    : []

  if (withImages.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500 bg-white border border-gray-300">
        <p>スレッドがまだありません</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 md:grid-cols-5 border-l border-t border-gray-300">
      {(withImages as (Thread & { categories: Category | null })[]).map((thread, i) => (
        <ThreadCard key={thread.id} thread={thread} rank={i + 1} />
      ))}
    </div>
  )
}

export default async function RankingPage() {
  const supabase = await createClient()
  const { data: categories } = await supabase.from('categories').select('*').order('sort_order')

  return (
    <div className="w-full px-0 py-0">
      <div className="max-w-screen-xl mx-auto px-2 pt-2">
        {/* オススメ */}
        <Suspense fallback={null}>
          <RecommendSection />
        </Suspense>

        {/* パンくず */}
        <nav className="text-xs text-gray-500 mb-2 flex items-center gap-x-1">
          <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
          <span>{'>'}</span>
          <span>人気スレッドランキング</span>
        </nav>

        {/* ランキングヘッダー */}
        <div className="mb-2 px-3 py-2 border border-gray-300 bg-white flex items-baseline gap-2">
          <span className="font-bold text-sm text-gray-800">📊 人気スレッド</span>
          <span className="text-xs text-gray-500">（過去3日間 / {LIMIT}位まで）</span>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-2">
        <Suspense fallback={
          <div className="grid grid-cols-3 md:grid-cols-5 border-l border-t border-gray-300 animate-pulse">
            {[...Array(15)].map((_, i) => (
              <div key={i} className="flex border-b border-r border-gray-300 bg-white" style={{ minHeight: 52 }}>
                <div className="bg-gray-200 shrink-0" style={{ width: 52, height: 52 }} />
                <div className="p-1.5 flex-1 space-y-1.5 pt-2">
                  <div className="h-2 bg-gray-200 rounded w-full" />
                  <div className="h-2 bg-gray-200 rounded w-4/5" />
                </div>
              </div>
            ))}
          </div>
        }>
          <RankingList />
        </Suspense>

        {/* 下部ナビ */}
        <div className="flex mt-3 text-sm border border-gray-300">
          {[
            { label: '↺ 更新順一覧', href: '/?sort=recent' },
            { label: '⏱ 新着一覧',   href: '/?sort=new' },
            { label: '📊 ランキング', href: '/ranking' },
            { label: '📂 過去ログ',   href: '/?sort=archived' },
          ].map((btn) => (
            <Link
              key={btn.href}
              href={btn.href}
              className="flex-1 text-center py-2 hover:bg-gray-50 text-blue-600 border-r border-gray-300 last:border-r-0 text-xs md:text-sm"
            >
              {btn.label}
            </Link>
          ))}
        </div>

        <div className="mb-6" />
      </div>
    </div>
  )
}
