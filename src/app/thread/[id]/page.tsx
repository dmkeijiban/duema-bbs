import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ThreadContent } from '@/components/ThreadContent'
import { ShareXButton } from '@/components/ShareXButton'
import { RecommendSection, RecommendSectionSkeleton } from '@/components/RecommendSection'
import { Thread, Post, Category } from '@/types'
import Link from 'next/link'
import { DEFAULT_PUBLIC_AUTHOR_NAME, getCachedSetting, getCachedThreadNotices, getCachedThread, getCachedThreadPosts, getCachedThreadStarterImageUrl, getCachedRelatedThreads, getCachedPublicAuthorProfiles, getCachedRestrictedAuthorNames, getCachedHonorTitleEnabled, getCachedHonorPointsMap, THREAD_POSTS_PER_PAGE } from '@/lib/cached-queries'
import { getHonorTitle, type HonorTitle } from '@/lib/honor-title'
import { NoticeBlock, Notice } from '@/components/NoticeBlock'
import { SnsCtaCard } from '@/components/SnsCtaCard'
import { SITE_URL } from '@/lib/site-config'
import { createPublicClient } from '@/lib/supabase-public'
import { NextReadNav } from '@/components/NextReadNav'
import { ThreadFloatingActions } from '@/components/ThreadFloatingActions'
import { AdBanner } from '@/components/AdBanner'
import { getDisplayCategory } from '@/lib/categories'
import { isThinThreadForAdSenseReview, isPrNoticeForAdSenseReview } from '@/lib/adsense-review-mode'
import { getThreadCommentClosedMessage } from '@/lib/thread-auto-close'
import { getCachedPublicHiddenUserIds, isPublicVisibleUserContent } from '@/lib/public-visibility'

const POSTS_PER_PAGE = THREAD_POSTS_PER_PAGE

export const revalidate = 21600

export async function generateStaticParams() {
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('threads')
    .select('id')
    .eq('is_archived', false)
    .order('post_count', { ascending: false })
    .limit(100)
  return (data ?? []).map(t => ({ id: String(t.id) }))
}

const DEFAULT_AUTHOR_NAME = DEFAULT_PUBLIC_AUTHOR_NAME

const THREAD_RULES_DEFAULT = `1.アンカーはレス番号をクリックで自動入力できます。
2.誹謗中傷・暴言・煽り・スレッドと無関係な投稿は削除・規制対象です。
他サイト・特定個人への中傷・暴言は禁止です。
※規約違反は各レスの「報告」からお知らせください。削除依頼は「お問い合わせ」からお願いします。
3.二次創作画像は、作者本人でない場合はURLで貼ってください。サムネとリンク先が表示されます。
4.巻き返し規制を受けている方や荒らしを反省した方はお問い合わせから連絡ください。`

interface Props {
  params: Promise<{ id: string }>
}

function cleanStructuredText(value: string | null | undefined, fallback = '') {
  const cleaned = (value ?? '')
    .replace(/>>?\d+/g, '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
  return cleaned || fallback
}

function cleanAuthorName(value: string | null | undefined) {
  return (value ?? '').trim() || DEFAULT_AUTHOR_NAME
}

function buildThreadDescription(thread: Thread, fallbackText?: string) {
  const text = cleanStructuredText(fallbackText ?? thread.body, thread.title).slice(0, 120)
  const count = thread.post_count ?? 0
  const suffix = count > 0 ? ` コメント${count}件。` : ''
  return `${text}｜デュエマ掲示板のスレッド。${suffix}`.slice(0, 160)
}

function isReviewModeHiddenNotice(notice: Notice) {
  return isPrNoticeForAdSenseReview(notice.header_text)
}

function removeEmptyStructuredData<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .map(item => removeEmptyStructuredData(item))
      .filter(item => item !== undefined && item !== null && item !== '') as T
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, item]) => [key, removeEmptyStructuredData(item)])
        .filter(([, item]) => {
          if (item === undefined || item === null || item === '') return false
          if (Array.isArray(item) && item.length === 0) return false
          return !(typeof item === 'object' && !Array.isArray(item) && Object.keys(item).length === 0)
        }),
    ) as T
  }

  return value
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const thread = await getCachedThread(parseInt(id))

  const hiddenUserIds = await getCachedPublicHiddenUserIds()
  if (!thread || !isPublicVisibleUserContent(thread, hiddenUserIds)) {
    return {
      title: 'スレッドが見つかりません',
      robots: { index: false, follow: false },
    }
  }

  const baseUrl = SITE_URL
  const canonicalUrl = `${baseUrl}/thread/${id}`
  const typedThread = thread as unknown as Thread
  const metadataDescription = buildThreadDescription(typedThread)
  // Use a stable, query-free image URL for X cards. Twitterbot can be picky
  // with long query-string image URLs, even when the endpoint returns 200.
  const ogImageUrl = thread.image_url
    ? `${baseUrl}/og/thread/${id}.jpg`
    : `${baseUrl}/default-thumbnail.jpg`

  const meta = {
    title: `${thread.title}｜デュエマ掲示板`,
    description: metadataDescription,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `${thread.title}｜デュエマ掲示板`,
      description: metadataDescription,
      url: canonicalUrl,
      type: 'article' as const,
      publishedTime: thread.created_at,
      modifiedTime: thread.last_posted_at ?? thread.created_at,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: `${thread.title}のスレッド画像` }],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title: `${thread.title}｜デュエマ掲示板`,
      description: metadataDescription,
      images: [ogImageUrl],
    },
  }

  const ageDays = (Date.now() - new Date(thread.created_at).getTime()) / 86400000
  if (ageDays >= 14 && isThinThreadForAdSenseReview(thread)) {
    return { ...meta, robots: { index: false, follow: true } }
  }
  return meta
}

export default async function ThreadPage({ params }: Props) {
  const { id } = await params
  const threadId = parseInt(id)
  if (isNaN(threadId)) notFound()

  return renderThreadPage(threadId, 1)
}

export async function renderThreadPage(threadId: number, page: number) {
  const [threadRules, threadNotices] = await Promise.all([
    getCachedSetting('thread_rules', THREAD_RULES_DEFAULT),
    getCachedThreadNotices(),
  ])

  // スレ・レスはキャッシュ済みクエリで取得（30秒TTL）
  const [thread, postsResult] = await Promise.all([
    getCachedThread(threadId),
    getCachedThreadPosts(threadId, page),
  ])
  const hiddenUserIds = await getCachedPublicHiddenUserIds()
  if (!thread || !isPublicVisibleUserContent(thread, hiddenUserIds)) notFound()

  const posts = postsResult.data
  const typedThread = thread as unknown as Thread & { categories: Category | null }
  const displayCategory = getDisplayCategory(typedThread.categories)
  const starterImageUrl = await getCachedThreadStarterImageUrl(threadId, typedThread.image_url)
  const threadParticipantUserIds = [
    typedThread.user_id ?? '',
    ...(posts ?? []).map(post => (post as Post).user_id ?? ''),
  ]
  const authorProfiles = await getCachedPublicAuthorProfiles(threadParticipantUserIds)
  const honorTitleEnabled = await getCachedHonorTitleEnabled()
  const honorPointsMap = honorTitleEnabled ? await getCachedHonorPointsMap(threadParticipantUserIds) : {}
  const honorTitles: Record<string, HonorTitle> = honorTitleEnabled
    ? Object.fromEntries(Object.entries(honorPointsMap).map(([userId, points]) => [userId, getHonorTitle(points)]))
    : {}
  const restrictedAuthorNames = await getCachedRestrictedAuthorNames([
    typedThread.author_name,
    ...(posts ?? []).map(post => (post as Post).author_name),
  ])
  const restrictedAuthorNameSet = new Set(restrictedAuthorNames)
  const shouldMaskAuthor = (item: { author_name: string; user_id?: string | null }) => {
    const profile = item.user_id ? authorProfiles[item.user_id] : undefined
    if (profile?.profile_slug === '' && profile.display_name === DEFAULT_AUTHOR_NAME) return true
    return restrictedAuthorNameSet.has(cleanAuthorName(item.author_name))
  }
  const publicThread = shouldMaskAuthor(typedThread)
    ? { ...typedThread, author_name: DEFAULT_AUTHOR_NAME }
    : typedThread
  const publicPosts = (posts ?? []).map(post => {
    const typedPost = post as Post
    return shouldMaskAuthor(typedPost)
      ? { ...typedPost, author_name: DEFAULT_AUTHOR_NAME }
      : typedPost
  })
  const commentClosedMessage = getThreadCommentClosedMessage(typedThread)
  const isArchivedForDisplay = typedThread.is_archived || Boolean(typedThread.archived_at)
  const totalPages = Math.max(1, Math.ceil((typedThread.post_count ?? 0) / POSTS_PER_PAGE))
  const visibleThreadNotices = (threadNotices as Notice[]).filter(notice => !isReviewModeHiddenNotice(notice))

  const baseUrl = SITE_URL

  // JSON-LD relatedLink 用（RecommendSection と同じキャッシュキーなので追加DBクエリなし）
  const relatedForLD = await getCachedRelatedThreads(threadId, typedThread.title, typedThread.category_id)
  const canonicalUrl = `${baseUrl}/thread/${threadId}`
  const currentPageUrl = page <= 1 ? canonicalUrl : `${canonicalUrl}/p/${page}`
  const structuredText = cleanStructuredText(typedThread.body, typedThread.title)
  const structuredDescription = buildThreadDescription(typedThread, structuredText)
  const structuredImage = typedThread.image_url ? `${baseUrl}/og/thread/${threadId}.jpg` : undefined
  const categoryForumId = typedThread.categories
    ? `${baseUrl}/category/${typedThread.categories.slug}#forum`
    : `${baseUrl}/#forum`

  // レスが1件以上ある場合のみ DiscussionForumPosting を生成する。
  // レス0件で comment プロパティが存在しないと Google が警告するため、
  // 表示可能なレスがないページでは構造化データを出力しない。
  const visiblePosts = publicPosts
  const discussionStructuredData = visiblePosts.length > 0
    ? removeEmptyStructuredData({
        "@context": "https://schema.org",
        "@type": "DiscussionForumPosting",
        "@id": `${canonicalUrl}#discussion`,
        "headline": typedThread.title,
        "url": canonicalUrl,
        "mainEntityOfPage": { "@id": `${canonicalUrl}#webpage` },
        "datePublished": typedThread.created_at,
        "dateModified": typedThread.last_posted_at ?? typedThread.created_at,
        "isPartOf": { "@id": categoryForumId },
        "publisher": {
          "@type": "Organization",
          "@id": `${baseUrl}/#organization`,
          "name": "デュエマ掲示板",
        },
        "author": {
          "@type": "Person",
          "name": cleanAuthorName(publicThread.author_name),
          "url": `${canonicalUrl}#post-1`,
        },
        "text": structuredText,
        "description": structuredDescription,
        "relatedLink": relatedForLD.slice(0, 5).map(t => `${baseUrl}/thread/${t.id}`),
        "image": structuredImage ? [structuredImage] : undefined,
        "interactionStatistic": [
          {
            "@type": "InteractionCounter",
            "interactionType": { "@type": "CommentAction" },
            "userInteractionCount": typedThread.post_count ?? 0,
          },
        ],
        "comment": visiblePosts.map(post => {
          const displayNumber = post.post_number + 1
          const postUrl = currentPageUrl + '#post-' + displayNumber

          return {
            "@type": "Comment",
            "url": postUrl,
            "datePublished": post.created_at,
            "text": cleanStructuredText(post.body, 'Comment'),
            "author": {
              "@type": "Person",
              "name": cleanAuthorName((post as Post).author_name),
              "url": postUrl,
            },
          }
        }),
      })
    : null

  return (
    <div className="max-w-screen-xl mx-auto px-2 py-2 text-sm overflow-x-hidden">
      {/* SEO: DiscussionForumPosting構造化データ（JSON-LD）
          レスが1件以上ある場合のみ出力。レス0件では comment が存在しないため
          Google Search Console の警告を避けるため出力しない。 */}
      {discussionStructuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(discussionStructuredData)
          }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              "@id": `${canonicalUrl}#breadcrumb`,
              "itemListElement": [
                { "@type": "ListItem", "position": 1, "name": "TOP", "item": baseUrl },
                ...(typedThread.categories ? [
                  {
                    "@type": "ListItem",
                    "position": 2,
                    "name": `カテゴリ『${typedThread.categories.name}』`,
                    "item": `${baseUrl}/category/${typedThread.categories.slug}`,
                  },
                  { "@type": "ListItem", "position": 3, "name": typedThread.title, "item": canonicalUrl },
                ] : [
                  { "@type": "ListItem", "position": 2, "name": typedThread.title, "item": canonicalUrl },
                ]),
              ],
            },
            {
              "@context": "https://schema.org",
              "@type": "WebPage",
              "@id": `${canonicalUrl}#webpage`,
              "url": canonicalUrl,
              "name": `${typedThread.title} | デュエマ掲示板`,
              "description": structuredDescription,
              "isPartOf": { "@id": `${baseUrl}/#website` },
              "publisher": { "@id": `${baseUrl}/#organization` },
              "breadcrumb": { "@id": `${canonicalUrl}#breadcrumb` },
              "inLanguage": "ja",
            },
          ])
        }}
      />

      <nav className="text-xs text-gray-500 mb-2 flex items-center flex-wrap gap-x-1">
        <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
        {displayCategory && (
          <>
            <span>{'>'}</span>
            <Link
              href={`/category/${displayCategory.slug}`}
              className="text-blue-600 hover:underline"
            >
              カテゴリ『{displayCategory.name}』
            </Link>
          </>
        )}
        <span>{'>'}</span>
        <span className="text-gray-600 break-all">{typedThread.title}</span>
      </nav>

      <div className="border border-gray-300 bg-white mb-3 px-3 py-2">
        <div className="sm:flex sm:items-start sm:justify-between sm:gap-2">
          <h1 className="inline min-w-0 font-bold text-gray-800 leading-snug text-base break-words sm:block sm:flex-1">
            {typedThread.title}
          </h1>
          <span className="ml-[0.5em] inline-block align-middle sm:hidden">
            <ShareXButton title={typedThread.title} />
          </span>
          <div className="hidden shrink-0 sm:block">
            <ShareXButton title={typedThread.title} />
          </div>
        </div>
      </div>

      {visibleThreadNotices.map(n => (
        <NoticeBlock key={n.id} notice={n} />
      ))}

      {/* AdSense 記事内広告（スレッドタイトル直下・1ページ目のみ） */}
      {page === 1 && (
        <AdBanner slot="7587904140" format="fluid" layout="in-article" style={{ margin: '8px 0' }} minHeight={0} />
      )}

      <ThreadContent
        posts={publicPosts}
        threadId={threadId}
        thread={publicThread}
        starterImageUrl={starterImageUrl}
        authorProfiles={authorProfiles}
        honorTitles={honorTitles}
        isArchived={isArchivedForDisplay}
        commentClosedMessage={commentClosedMessage}
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
      {page >= totalPages && (
        <Suspense fallback={null}>
          <SnsCtaCard />
        </Suspense>
      )}

      {/* ── 1C: スレッド下部ナビゲーション ──────────────────────────────
          スレ読了後に「次の行動」を迷わせないための底面固定ナビ。
          モバイルタップ最適化（min-h-[44px]）。全ページに表示。
          GA4 next_read_click イベント計測 + prefetch={true} 付き。 */}
      <NextReadNav threadId={threadId} />
      <ThreadFloatingActions />
    </div>
  )
}
