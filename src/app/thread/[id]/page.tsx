import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase-server'
import { ThreadContent } from '@/components/ThreadContent'
import { FavoriteButton } from '@/components/FavoriteButton'
import { ShareXButton } from '@/components/ShareXButton'
import { RecommendSection } from '@/components/RecommendSection'
import { incrementViewCount } from '@/app/actions/thread'
import { Thread, Post, Category } from '@/types'
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
    title: `${thread.title} | デュエマ掲示板`,
    description: thread.body.slice(0, 150),
  }
}

export default async function ThreadPage({ params, searchParams }: Props) {
  const { id } = await params
  const { page: pageStr } = await searchParams
  const threadId = parseInt(id)

  if (isNaN(threadId)) notFound()

  const supabase = await createClient()

  const { data: thread } = await supabase
    .from('threads')
    .select('*, categories(id,name,slug,color,description,sort_order)')
    .eq('id', threadId)
    .single()

  if (!thread) notFound()

  incrementViewCount(threadId)

  const page = Math.max(1, parseInt(pageStr ?? '1') || 1)
  const offset = (page - 1) * POSTS_PER_PAGE

  const { data: posts, count } = await supabase
    .from('posts')
    .select('*', { count: 'exact' })
    .eq('thread_id', threadId)
    .order('post_number', { ascending: true })
    .range(offset, offset + POSTS_PER_PAGE - 1)

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / POSTS_PER_PAGE))

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
    <div className="max-w-screen-xl mx-auto px-2 py-2 text-sm">
      {/* パンくず */}
      <nav className="text-xs text-gray-500 mb-2 flex items-center flex-wrap gap-x-1">
        <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
        {typedThread.categories && (
          <>
            <span>{'>'}</span>
            <Link
              href={`/?category=${typedThread.categories.slug}`}
              className="text-blue-600 hover:underline"
            >
              カテゴリ『{typedThread.categories.name}』
            </Link>
          </>
        )}
        <span>{'>'}</span>
        <span className="text-gray-600 break-all">{typedThread.title}</span>
      </nav>

      {/* スレタイバー */}
      <div className="border border-gray-300 bg-white mb-3 px-3 py-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <h1 className="font-bold text-gray-800 leading-snug text-base">{typedThread.title}</h1>
          <FavoriteButton threadId={threadId} initialFavorited={isFavorited} />
          <ShareXButton title={typedThread.title} />
        </div>
        <div className="text-xs text-gray-500 mt-0.5">
          {typedThread.post_count}件 ／ 閲覧 {typedThread.view_count}
        </div>
      </div>

      {/* スレ本文・レス一覧・フォーム（クライアント側） */}
      <ThreadContent
        posts={(posts ?? []) as Post[]}
        threadId={threadId}
        thread={typedThread}
        isArchived={typedThread.is_archived}
        page={page}
        totalPages={totalPages}
        sessionId={sessionId}
        recommendSlot={
          <Suspense fallback={null}>
            <RecommendSection />
          </Suspense>
        }
      />
    </div>
  )
}
