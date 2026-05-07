import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase-server'
import { ThreadContent } from '@/components/ThreadContent'
import { FavoriteButton } from '@/components/FavoriteButton'
import { ShareXButton } from '@/components/ShareXButton'
import { RecommendSection, RecommendSectionSkeleton } from '@/components/RecommendSection'
import { incrementViewCount } from '@/app/actions/thread'
import { Thread, Post, Category } from '@/types'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { getCachedSetting, getCachedThreadNotices, getCachedThread, getCachedThreadPosts, THREAD_POSTS_PER_PAGE } from '@/lib/cached-queries'
import { NoticeBlock, Notice } from '@/components/NoticeBlock'
import { SnsCtaCard } from '@/components/SnsCtaCard'
import { SITE_URL } from '@/lib/site-config'

const POSTS_PER_PAGE = THREAD_POSTS_PER_PAGE

const THREAD_RULES_DEFAULT = `1.アンカーはレス番号をクリックで自動入力できます。
2.誹謗中傷・暴言・煽り・スレッドと無関係な投稿は削除・規制対象です。
他サイト・特定個人への中傷・暴言は禁止です。
※規約違反は各レスの「報告」からお知らせください。削除依頼は「お問い合わせ」からお願いします。
3.二次創作画像は、作者本人でない場合はURLで貼ってください。サムネとリンク先が表示されます。
4.巻き返し規制を受けている方や荒らしを反省した方はお問い合わせから連絡ください。`

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

  const desc = thread.body
    .replace(/>>?\d+/g, '')      // >>123 アンカー除去
    .replace(/[\r\n]+/g, ' ')    // 改行をスペースに
    .replace(/\s{2,}/g, ' ')     // 連続スペース圧縮
    .trim()
    .slice(0, 150)
  const baseUrl = SITE_URL
  // OG画像はX共有用に /api/og で 1200×675 (16:9) に統一クロップ
  const ogImageUrl = ogImage
    ? `${baseUrl}/api/og?url=${encodeURIComponent(ogImage)}`
    : undefined

  return {
    title: `${thread.title} | デュエマ掲示板`,
    description: desc,
    alternates: {
      canonical: `${baseUrl}/thread/${id}`,
    },
    openGraph: {
      title: thread.title,
      description: desc,
      url: `${baseUrl}/thread/${id}`,
      type: 'article',
      images: ogImageUrl
        ? [{ url: ogImageUrl, width: 1200, height: 675, alt: thread.title }]
        : [],
    },
    twitter: {
      card: ogImageUrl ? 'summary_large_image' : 'summary',
      title: thread.title,
      description: desc,
      images: ogImageUrl ? [ogImageUrl] : [],
    },
  }
}

export default async function ThreadPage({ params, searchParams }: Props) {
  const t0 = Date.now()

  const [{ id }, { page: pageStr }] = await Promise.all([params, searchParams])
  const threadId = parseInt(id)
  if (isNaN(threadId)) notFound()

  const page = Math.max(1, parseInt(pageStr ?? '1') || 1)
  const offset = (page - 1) * POSTS_PER_PAGE

  // cookies + supabase client + キャッシュ済みデータを同時並列で取得
  const [cookieStore, supabase, threadRules, threadNotices] = await Promise.all([
    cookies(),
    createClient(),
    getCachedSetting('thread_rules', THREAD_RULES_DEFAULT),
    getCachedThreadNotices(),
  ])
  console.log(`[perf] thread/${threadId} init: ${Date.now() - t0}ms`)

  const sessionId = cookieStore.get('bbs_session')?.value ?? ''
  const isAdmin = cookieStore.get('admin_auth')?.value === process.env.ADMIN_PASSWORD

  // スレ・レスはキャッシュ済みクエリで取得（30秒TTL）、セッション依存データは直接取得
  // incrementViewCountは閲覧数を+1しつつ最新値を返す（awaitでfire-and-forget問題を解消）
  const tQ = Date.now()
  const [thread, postsResult, favResult, freshViewCount] = await Promise.all([
    getCachedThread(threadId),
    getCachedThreadPosts(threadId, page),
    sessionId
      ? supabase.from('favorites').select('id').eq('session_id', sessionId).eq('thread_id', threadId).single()
      : Promise.resolve({ data: null }),
    incrementViewCount(threadId),
  ])
  console.log(`[perf] thread/${threadId} queries: ${Date.now() - tQ}ms`)

  if (!thread) notFound()

  const isFavorited = !!favResult.data
  const posts = postsResult.data
  const count = postsResult.count
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / POSTS_PER_PAGE))

  console.log(`[perf] thread/${threadId} total: ${Date.now() - t0}ms, posts=${posts?.length}`)

  const typedThread = thread as unknown as Thread & { categories: Category | null }

  const baseUrl = SITE_URL

  return (
    <div className="max-w-screen-xl mx-auto px-2 py-2 text-sm overflow-x-hidden">
      {/* SEO: DiscussionForumPosting構造化データ（JSON-LD） */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "DiscussionForumPosting",
            "headline": typedThread.title,
            "url": `${baseUrl}/thread/${threadId}`,
            "datePublished": typedThread.created_at,
            "dateModified": typedThread.last_posted_at ?? typedThread.created_at,
            "description": typedThread.body.replace(/>>?\d+/g, '').replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, 100),
          })
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "TOP", "item": baseUrl },
              ...(typedThread.categories ? [
                {
                  "@type": "ListItem",
                  "position": 2,
                  "name": `カテゴリ『${typedThread.categories.name}』`,
                  "item": `${baseUrl}/category/${typedThread.categories.slug}`,
                },
                { "@type": "ListItem", "position": 3, "name": typedThread.title },
              ] : [
                { "@type": "ListItem", "position": 2, "name": typedThread.title },
              ]),
            ],
          })
        }}
      />

      <nav className="text-xs text-gray-500 mb-2 flex items-center flex-wrap gap-x-1">
        <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
        {typedThread.categories && (
          <>
            <span>{'>'}</span>
            <Link
              href={`/category/${typedThread.categories.slug}`}
              className="text-blue-600 hover:underline"
            >
              カテゴリ『{typedThread.categories.name}』
            </Link>
          </>
        )}
        <span>{'>'}</span>
        <span className="text-gray-600 break-all">{typedThread.title}</span>
      </nav>

      <div className="border border-gray-300 bg-white mb-3 px-3 py-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <h1 className="font-bold text-gray-800 leading-snug text-base">{typedThread.title}</h1>
          <FavoriteButton threadId={threadId} initialFavorited={isFavorited} />
          <ShareXButton title={typedThread.title} />
        </div>
        <div className="text-xs text-gray-500 mt-0.5">
          {typedThread.post_count}件 ／ 閲覧 {freshViewCount}
        </div>
      </div>

      {(threadNotices as Notice[]).map(n => (
        <NoticeBlock key={n.id} notice={n} />
      ))}

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
          <Suspense fallback={<RecommendSectionSkeleton />}>
            <RecommendSection />
          </Suspense>
        }
      />

      {/* SNS フォロー導線 — 最終ページのみ表示（読み終えた直後が最もコンバージョン高い） */}
      {page >= totalPages && <SnsCtaCard />}
    </div>
  )
}
