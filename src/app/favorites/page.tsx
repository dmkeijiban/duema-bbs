import { createClient } from '@/lib/supabase-server'
import { ThreadCard } from '@/components/ThreadCard'
import { Thread, Category } from '@/types'
import { Star, ArrowLeft } from '@/components/Icons'
import Link from 'next/link'
import { cookies } from 'next/headers'

export const metadata = {
  title: 'お気に入りスレッド | デュエルBBS',
}

export default async function FavoritesPage() {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('bbs_session')?.value

  if (!sessionId) {
    return (
      <div className="max-w-screen-xl mx-auto px-4 py-8">
        <EmptyFavorites />
      </div>
    )
  }

  const supabase = await createClient()

  const { data: favorites } = await supabase
    .from('favorites')
    .select('thread_id, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })

  if (!favorites || favorites.length === 0) {
    return (
      <div className="max-w-screen-xl mx-auto px-4 py-8">
        <EmptyFavorites />
      </div>
    )
  }

  const threadIds = favorites.map(f => f.thread_id)

  const { data: threads } = await supabase
    .from('threads')
    .select('*, categories(id,name,slug,color,description,sort_order)')
    .in('id', threadIds)

  // お気に入り順に並べ替え
  const sortedThreads = threadIds
    .map(id => threads?.find(t => t.id === id))
    .filter(Boolean) as (Thread & { categories: Category | null })[]

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6">
      <div className="mb-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          スレッド一覧に戻る
        </Link>
      </div>

      <div className="flex items-center gap-2 mb-6">
        <Star className="w-6 h-6 fill-yellow-400 text-yellow-400" />
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          お気に入りスレッド
        </h1>
        <span className="text-sm text-gray-400">({sortedThreads.length}件)</span>
      </div>

      <div className="space-y-2">
        {sortedThreads.map(thread => (
          <ThreadCard key={thread.id} thread={thread} />
        ))}
      </div>
    </div>
  )
}

function EmptyFavorites() {
  return (
    <div className="text-center py-20">
      <Star className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
      <h1 className="text-xl font-bold text-gray-700 dark:text-gray-300 mb-2">
        お気に入りスレッドなし
      </h1>
      <p className="text-sm text-gray-400 dark:text-gray-500 mb-6">
        スレッド詳細ページの「お気に入り」ボタンで登録できます
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-sm font-medium transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        スレッド一覧へ
      </Link>
    </div>
  )
}
