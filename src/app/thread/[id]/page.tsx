import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ThreadContent } from '@/components/ThreadContent'
import { FavoriteButton } from '@/components/FavoriteButton'
import { ShareXButton } from '@/components/ShareXButton'
import { RecommendSection, RecommendSectionSkeleton } from '@/components/RecommendSection'
import { Thread, Post, Category } from '@/types'
import { ThreadViewPing } from '@/components/ThreadViewPing'
import Link from 'next/link'
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
  const thread = await getCachedThread(parseInt(id))

  if (!thread) return { title: 'スレッドが見つかりません' }

  const ogImage: string | undefined = thread.image_url ?? undefined
  const desc = thread.body
    .replace(/>>?\d+/g, '')      // >>123 アンカー除去
    .replace(/[\r\n]+/g, ' ')    // 改行をスペースに
    .replace(/\s{2,}/g, ' ')     // 連続スペース圧縮
    .trim()
    .slice(0, 150)
  const baseUrl = SITE_URL
  // Use a stable, query-free image URL for X cards. Twitterbot can be picky
  // with long query-string image URLs, even when the endpoint returns 200.
  const ogImageUrl = ogImage
    ? `${baseUrl}/og/thread/${id}.jpg`
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
  const [{ id }, { page: pageStr }] = await Promise.all([params, searchParams])
  const threadId = parseInt(id)
  if (isNaN(threadId)) notFound()

  const page = Math.max(1, parseInt(pageStr ?? '1') || 1)
  const [threadRules, threadNotices] = await Promise.all([
    getCachedSetting('thread_rules', THREAD_RULES_DEFAULT),
    getCachedThreadNotices(),
  ])

  // スレ・レスはキャッシュ済みクエリで取得（30秒TTL）
  const [thread, postsResult] = await Promise.all([
    getCachedThread(threadId),
    getCachedThreadPosts(threadId, page),
  ])
  if (!thread) notFound()

  const posts = postsResult.data
  const typedThread = thread as unknown as Thread & { categories: Category | null }
  const totalPages = Math.max(1, Math.ceil((typedThread.post_count ?? 0) / POSTS_PER_PAGE))

  const baseUrl = SITE_URL

  return (
    <div className="max-w-screen-xl mx-auto px-2 py-2 text-sm overflow-x-hidden">
      <ThreadViewPing threadId={threadId} />
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
          <FavoriteButton threadId={threadId} />
          <ShareXButton title={typedThread.title} />
        </div>
        <div className="text-xs text-gray-500 mt-0.5">
          {typedThread.post_count}件 ／ 閲覧 {typedThread.view_count}
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
        threadRules={threadRules}
        recommendSlot={
          <Suspense fallback={<RecommendSectionSkeleton />}>
            <RecommendSection
              threadId={threadId}
              title={typedThread.title}
              categoryId={typedThread.category_id}
            />
          </Suspense>
        }
      />

      {/* SNS フォロー導線 — 最終ページのみ表示（読み終えた直後が最もコンバージョン高い） */}
      {page >= totalPages && <SnsCtaCard />}
    </div>
  )
}
