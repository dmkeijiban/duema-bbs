import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { PostItem } from '@/components/PostItem'
import { NewPostForm } from '@/components/NewPostForm'
import { FavoriteButton } from '@/components/FavoriteButton'
import { incrementViewCount } from '@/app/actions/thread'
import { formatDateTime, formatRelativeTime } from '@/lib/utils'
import { Thread, Post, Category } from '@/types'
import { ArrowLeft, MessageSquare, Eye, Clock, Tag } from 'lucide-react'
import Link from 'next/link'
import { cookies } from 'next/headers'

const POSTS_PER_PAGE = 50

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ page?: string }>
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: thread } = await supabase
    .from('threads')
    .select('title, body')
    .eq('id', parseInt(id))
    .single()

  if (!thread) return { title: 'スレッドが見つかりません' }

  return {
    title: `${thread.title} | デュエルBBS`,
    description: thread.body.slice(0, 150),
  }
}

export default async function ThreadPage({ params, searchParams }: Props) {
  const { id } = await params
  const { page: pageStr } = await searchParams
  const threadId = parseInt(id)

  if (isNaN(threadId)) notFound()

  const supabase = await createClient()

  // スレッド取得
  const { data: thread } = await supabase
    .from('threads')
    .select('*, categories(id,name,slug,color,description,sort_order)')
    .eq('id', threadId)
    .single()

  if (!thread) notFound()

  // ビュー数増加（await不要）
  incrementViewCount(threadId)

  // ページネーション
  const page = Math.max(1, parseInt(pageStr ?? '1') || 1)
  const offset = (page - 1) * POSTS_PER_PAGE

  const { data: posts, count } = await supabase
    .from('posts')
    .select('*', { count: 'exact' })
    .eq('thread_id', threadId)
    .order('post_number', { ascending: true })
    .range(offset, offset + POSTS_PER_PAGE - 1)

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / POSTS_PER_PAGE))

  // お気に入り状態
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('bbs_session')?.value ?? ''
  let isFavorited = false
  if (sessionId) {
    const { data: fav } = await supabase
      .from('favorites')
      .select('id')
      .eq('session_id', sessionId)
      .eq('thread_id', threadId)
      .single()
    isFavorited = !!fav
  }

  const typedThread = thread as Thread & { categories: Category | null }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* パンくず */}
      <div className="flex items-center gap-2 mb-4 text-sm text-gray-500 dark:text-gray-400">
        <Link href="/" className="flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          スレッド一覧
        </Link>
        {typedThread.categories && (
          <>
            <span>/</span>
            <Link
              href={`/?category=${typedThread.categories.slug}`}
              className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              {typedThread.categories.name}
            </Link>
          </>
        )}
      </div>

      {/* スレッドヘッダー */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden mb-4">
        <div className="px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {typedThread.categories && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-white mb-2"
                  style={{ backgroundColor: typedThread.categories.color }}
                >
                  <Tag className="w-3 h-3" />
                  {typedThread.categories.name}
                </span>
              )}
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 leading-snug">
                {typedThread.title}
              </h1>
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 dark:text-gray-500">
                <span>{typedThread.author_name}</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {formatDateTime(typedThread.created_at)}
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5" />
                  {typedThread.post_count}レス
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5" />
                  {typedThread.view_count}閲覧
                </span>
              </div>
            </div>
            <FavoriteButton threadId={threadId} initialFavorited={isFavorited} />
          </div>
        </div>

        {/* OP投稿 */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 bg-indigo-50/50 dark:bg-indigo-900/10">
          <div className="flex items-center gap-2 mb-2 text-xs text-gray-400 dark:text-gray-500">
            <span className="font-bold text-indigo-600 dark:text-indigo-400">1</span>
            <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded font-bold text-xs">OP</span>
            <span className="font-medium text-gray-700 dark:text-gray-300">{typedThread.author_name}</span>
            <span>{formatDateTime(typedThread.created_at)}</span>
          </div>
          <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words leading-relaxed">
            {typedThread.body}
          </div>
          {typedThread.image_url && (
            <div className="mt-3">
              <a href={typedThread.image_url} target="_blank" rel="noopener noreferrer">
                <img
                  src={typedThread.image_url}
                  alt="添付画像"
                  className="max-h-80 max-w-full rounded-lg border border-gray-200 dark:border-gray-600 object-contain hover:opacity-90 transition-opacity cursor-zoom-in"
                />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* ページネーション（上） */}
      {totalPages > 1 && (
        <PostPagination page={page} totalPages={totalPages} threadId={threadId} />
      )}

      {/* レス一覧 */}
      {posts && posts.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-6 my-4">
          {(posts as Post[]).map(post => (
            <PostItem key={post.id} post={post} isOp={post.post_number === 1} />
          ))}
        </div>
      )}

      {/* ページネーション（下） */}
      {totalPages > 1 && (
        <div className="my-4">
          <PostPagination page={page} totalPages={totalPages} threadId={threadId} />
        </div>
      )}

      {/* レスフォーム */}
      {!typedThread.is_archived ? (
        <NewPostForm threadId={threadId} />
      ) : (
        <div className="text-center py-8 text-gray-400 dark:text-gray-600 border border-gray-200 dark:border-gray-700 rounded-xl">
          このスレッドは過去ログです。レスできません。
        </div>
      )}
    </div>
  )
}

function PostPagination({ page, totalPages, threadId }: { page: number; totalPages: number; threadId: number }) {
  const pages: (number | '...')[] = []
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 2) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...')
    }
  }

  return (
    <div className="flex items-center justify-center gap-1 py-2">
      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`e${i}`} className="px-2 text-gray-400">…</span>
        ) : (
          <Link
            key={p}
            href={p === 1 ? `/thread/${threadId}` : `/thread/${threadId}?page=${p}`}
            className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
              p === page
                ? 'bg-indigo-600 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {p}
          </Link>
        )
      )}
    </div>
  )
}
