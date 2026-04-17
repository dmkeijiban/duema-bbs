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
import { getSetting } from '@/lib/settings'
import { NoticeBlock, Notice } from '@/components/NoticeBlock'

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
    .select('title, body, image_url')
    .eq('id', parseInt(id))
    .single()

  if (!thread) return { title: 'スレッドが見つかりません' }

  // OGP画像: スレ画像 → 最初の投稿添付画像 の順で探す
  let ogImage: string | undefined = thread.image_url ?? undefined
  if (!ogImage) {
    const { data: postImg } = await supabase
      .from('posts')
      .select('image_url')
      .eq('thread_id', parseInt(id))
      .not('image_url', 'is', null)
      .order('post_number', { ascending: true })
      .limit(1)
      .single()
    ogImage = postImg?.image_url ?? undefined
  }

  const desc = thread.body.slice(0, 150)

  return {
    title: `${thread.title} | デュエマ掲示板`,
    description: desc,
    openGraph: {
      title: thread.title,
      description: desc,
      url: `https://duema-bbs.vercel.app/thread/${id}`,
      type: 'article',
      images: ogImage ? [{ url: ogImage, width: 1200, height: 630, alt: thread.title }] : [],
    },
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title: thread.title,
      description: desc,
      images: ogImage ? [ogImage] : [],
    },
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

  const THREAD_RULES_DEFAULT = `1.アンカーはレス番号をクリックで自動入力できます。
2.誹謗中傷・暴言・煽り・スレッドと無関係な投稿は削除・規制対象です。
他サイト・特定個人への中傷・暴言は禁止です。
※規約違反は各レスの「報告」からお知らせください。削除依頼は「お問い合わせ」からお願いします。
3.二次創作画像は、作者本人でない場合はURLで貼ってください。サムネとリンク先が表示されます。
4.巻き返し規制を受けている方や荒らしを反省した方はお問い合わせから連絡ください。`

  const [cookieStore, threadRules, { data: threadNoticesRaw }] = await Promise.all([
    cookies(),
    getSetting('thread_rules', THREAD_RULES_DEFAULT),
    supabase.from('notices').select('*').eq('is_active', true).eq('show_in_thread', true).order('sort_order'),
  ])
  const threadNotices = (threadNoticesRaw as Notice[] | null) ?? []
  const sessionId = cookieStore.get('bbs_session')?.value ?? ''
  const isAdmin = cookieStore.get('admin_auth')?.value === process.env.ADMIN_PASSWORD
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

      {/* お知らせ（ホームと同期・show_in_thread=trueのもの） */}
      {threadNotices.map(n => (
        <NoticeBlock key={n.id} notice={n} />
      ))}

      {/* スレ本文・レス一覧・フォーム（クライアント側） */}
      <ThreadContent
        posts={(posts ?? []) as Post[]}
        threadId={threadId}
        thread={typedThread}
        isArchived={typedThread.is_archived}
        page={page}
        totalPages={totalPages}
        sessionId={sessionId}
        threadRules={threadRules}
        isAdmin={isAdmin}
        recommendSlot={
          <Suspense fallback={null}>
            <RecommendSection />
          </Suspense>
        }
      />
    </div>
  )
}
