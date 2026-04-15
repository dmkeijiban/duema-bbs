import { Suspense } from 'react'
import { createClient } from '@/lib/supabase-server'
import { ThreadRow } from '@/components/ThreadRow'
import { RecommendSection } from '@/components/RecommendSection'
import { withFallbackThumbnails } from '@/lib/thumbnail'
import { Thread, Category } from '@/types'
import Link from 'next/link'

export const NAV_LINKS = [
  { label: '↺ 更新順一覧', href: '/update' },
  { label: '⏱ 新着一覧',   href: '/new' },
  { label: '📊 ランキング', href: '/ranking' },
  { label: '🎲 ランダム',   href: '/random' },
]

interface Props {
  sort: 'recent' | 'new' | 'archived' | 'random'
  title: string
  icon: string
}

async function ThreadList({ sort }: { sort: string }) {
  const supabase = await createClient()
  const isArchived = sort === 'archived'

  let query = supabase
    .from('threads')
    .select('*, categories(id,name,slug,color,description,sort_order)')
    .eq('is_archived', isArchived)

  if (sort === 'new') {
    query = query.order('created_at', { ascending: false })
  } else if (sort !== 'random') {
    query = query.order('last_posted_at', { ascending: false })
  }

  query = query.limit(sort === 'random' ? 500 : 100)
  const { data: rawThreads } = await query
  let threads = rawThreads ? await withFallbackThumbnails(supabase, rawThreads) : []

  // ランダムシャッフル
  if (sort === 'random') {
    for (let i = threads.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [threads[i], threads[j]] = [threads[j], threads[i]]
    }
  }

  if (threads.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500 bg-white border border-gray-300">
        スレッドがまだありません
      </div>
    )
  }

  // 過去ログはグリッド、それ以外は横長リスト
  if (sort === 'archived') {
    const { ThreadCard } = await import('@/components/ThreadCard')
    return (
      <div className="grid grid-cols-3 md:grid-cols-5 border-l border-t border-gray-300">
        {(threads as (Thread & { categories: Category | null })[]).map((thread) => (
          <ThreadCard key={thread.id} thread={thread} />
        ))}
      </div>
    )
  }

  return (
    <div className="border border-gray-300 bg-white">
      {(threads as (Thread & { categories: Category | null })[]).map((thread) => (
        <ThreadRow key={thread.id} thread={thread} />
      ))}
    </div>
  )
}

function SkeletonList() {
  return (
    <div className="border border-gray-300 bg-white animate-pulse">
      {[...Array(12)].map((_, i) => (
        <div key={i} className="flex items-center border-b border-gray-200 gap-2 pr-3" style={{ height: 52 }}>
          <div className="bg-gray-200 shrink-0" style={{ width: 52, height: 52 }} />
          <div className="flex-1 space-y-1.5">
            <div className="h-2.5 bg-gray-200 rounded w-3/4" />
            <div className="h-2 bg-gray-100 rounded w-1/2" />
          </div>
          <div className="bg-gray-100 rounded h-2 w-10 shrink-0" />
        </div>
      ))}
    </div>
  )
}

export function BottomNav({ current }: { current?: string }) {
  return (
    <div className="flex mt-3 text-sm border border-gray-300">
      {NAV_LINKS.map((btn) => (
        <Link
          key={btn.href}
          href={btn.href}
          className="flex-1 text-center py-2 border-r border-gray-300 last:border-r-0 text-xs md:text-sm"
          style={
            current === btn.href
              ? { background: '#0d6efd', color: '#fff' }
              : { color: '#0d6efd' }
          }
        >
          {btn.label}
        </Link>
      ))}
    </div>
  )
}

export async function ThreadSortPage({ sort, title, icon }: Props) {
  const href = sort === 'recent' ? '/update' : sort === 'new' ? '/new' : sort === 'random' ? '/random' : '/archived'

  return (
    <div className="w-full px-0 py-0">
      <div className="max-w-screen-xl mx-auto px-2 pt-2">
        <Suspense fallback={null}>
          <RecommendSection />
        </Suspense>

        <nav className="text-xs text-gray-500 mb-2 flex items-center gap-x-1">
          <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
          <span>{'>'}</span>
          <span>{title}</span>
        </nav>

        <div className="mb-2 px-3 py-1.5 border border-gray-300 bg-white flex items-baseline gap-2">
          <span className="font-bold text-sm text-gray-800">{icon} {title}</span>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-2">
        <Suspense fallback={<SkeletonList />}>
          <ThreadList sort={sort} />
        </Suspense>

        <BottomNav current={href} />
        <div className="mb-6" />
      </div>
    </div>
  )
}
