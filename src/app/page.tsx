import { Suspense } from 'react'
import { createPublicClient } from '@/lib/supabase-public'
import { ThreadCard } from '@/components/ThreadCard'
import { Pagination } from '@/components/Pagination'
import dynamic from 'next/dynamic'
const InlineNewThread = dynamic(
  () => import('@/components/InlineNewThread').then(m => m.InlineNewThread)
)
import { RecommendSection } from '@/components/RecommendSection'
import { SortTabs } from '@/components/SortTabs'
import { BottomNav } from '@/components/ThreadSortPage'
import { withFallbackThumbnails } from '@/lib/thumbnail'
import { Thread, Category } from '@/types'
import Link from 'next/link'
import { NoticeBlock, Notice } from '@/components/NoticeBlock'
import {
  getCachedCategories,
  getCachedActiveNotices,
  getCachedSetting,
  getCachedThreadList,
  THREAD_PAGE_SIZE,
} from '@/lib/cached-queries'

export const revalidate = 60

interface SearchParams {
  category?: string
  page?: string
  sort?: string
  q?: string
  archived?: string
  [key: string]: string | undefined
}

// ──────────────────────────────────────────────────
// スレ一覧（非同期）
// getCachedThreadList は <10ms で解決するため Suspense に入れず、
// 初期 HTML に含めて LCP をホームバナーで確定させる。
// ──────────────────────────────────────────────────
async function ThreadList({ searchParams }: { searchParams: SearchParams }) {
  const sort = searchParams.sort ?? 'recent'
  const searchQ = searchParams.q?.trim()
  const isArchived = sort === 'archived' || searchParams.archived === '1'
  const isRandom = sort === 'random'
  const page = Math.max(1, parseInt(searchParams.page ?? '1') || 1)
  const supabase = createPublicClient()

  // カテゴリIDはキャッシュ済み一覧から引く
  const cats = await getCachedCategories()
  const categoryId = searchParams.category
    ? (cats.find(c => c.slug === searchParams.category)?.id ?? null)
    : null

  // ── ランダム（キャッシュ不適）
  if (isRandom) {
    let q = supabase
      .from('threads')
      .select('id, title, image_url, post_count, is_archived, created_at, last_posted_at, category_id, categories(id,name,slug,color)')
      .eq('is_archived', false)
      .limit(100)
    if (categoryId !== null) q = q.eq('category_id', categoryId)
    const { data: raw } = await q
    const all = raw ? await withFallbackThumbnails(supabase, raw) : []
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]]
    }
    if (all.length === 0) return <ThreadEmpty searchQ={undefined} />
    return (
      <div className="grid grid-cols-3 md:grid-cols-5 border-l border-t border-gray-300">
        {(all as unknown as (Thread & { categories: Category | null })[]).map((thread, i) => (
          <ThreadCard key={thread.id} thread={thread} />
        ))}
      </div>
    )
  }

  // ── 検索（キャッシュ不適・クエリが多様）
  if (searchQ) {
    const offset = (page - 1) * THREAD_PAGE_SIZE
    let countQ = supabase
      .from('threads')
      .select('id', { count: 'exact', head: true })
      .eq('is_archived', isArchived)
      .ilike('title', `%${searchQ}%`)
    let dataQ = supabase
      .from('threads')
      .select('id, title, image_url, post_count, is_archived, created_at, last_posted_at, category_id, categories(id,name,slug,color)')
      .eq('is_archived', isArchived)
      .ilike('title', `%${searchQ}%`)
    if (categoryId !== null) {
      countQ = countQ.eq('category_id', categoryId)
      dataQ = dataQ.eq('category_id', categoryId)
    }
    dataQ = dataQ.order('last_posted_at', { ascending: false }).range(offset, offset + THREAD_PAGE_SIZE - 1)
    const [{ count }, { data: raw }] = await Promise.all([countQ, dataQ])
    const threads = raw ? await withFallbackThumbnails(supabase, raw) : []
    if (threads.length === 0) return <ThreadEmpty searchQ={searchQ} />
    const totalPages = Math.max(1, Math.ceil((count ?? 0) / THREAD_PAGE_SIZE))
    return (
      <>
        <div className="mb-2 px-3 py-1.5 text-xs border border-gray-300 bg-white text-gray-600">
          「{searchQ}」の検索結果：{count}件
        </div>
        <div className="grid grid-cols-3 md:grid-cols-5 border-l border-t border-gray-300">
          {(threads as unknown as (Thread & { categories: Category | null })[]).map((thread, i) => (
            <ThreadCard key={thread.id} thread={thread} />
          ))}
        </div>
        <div className="mt-3">
          <Pagination currentPage={page} totalPages={totalPages} searchParams={searchParams} />
        </div>
      </>
    )
  }

  // ── 標準クエリ（キャッシュ済み・60s）
  const result = await getCachedThreadList(sort, page, categoryId, isArchived)
  const threads = result.threads as unknown as (Thread & { categories: Category | null })[]

  if (threads.length === 0) return <ThreadEmpty searchQ={undefined} />

  return (
    <>
      {sort === 'popular' && (
        <div className="mb-2 px-3 py-1.5 border border-gray-300 bg-white flex items-baseline gap-2">
          <span className="font-bold text-sm text-gray-800">📊 人気スレッド</span>
          <span className="text-xs text-gray-600">（過去3日間 / 100位まで）</span>
        </div>
      )}
      <div className="grid grid-cols-3 md:grid-cols-5 border-l border-t border-gray-300">
        {threads.map((thread, i) => (
          <ThreadCard
            key={thread.id}
            thread={thread}
            rank={sort === 'popular' ? i + 1 + (page - 1) * THREAD_PAGE_SIZE : undefined}
            // 1枚目のみ eager + fetchpriority="high"、残りは lazy
            priority={i === 0}
          />
        ))}
      </div>
      <div className="mt-3">
        <Pagination currentPage={page} totalPages={result.totalPages} searchParams={searchParams} />
      </div>
    </>
  )
}

function ThreadEmpty({ searchQ }: { searchQ?: string }) {
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

// ──────────────────────────────────────────────────
// ページ本体
// homeBanner・topNotices・SortTabs を初期 HTML シェルに含める。
// これらが LCP 対象となり、スレ一覧ストリームを待たずに LCP が確定する。
// ──────────────────────────────────────────────────
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams

  const isConfigured =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('http') &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!isConfigured) return <SetupGuide />

  const sort = params.sort ?? 'recent'

  // 初期シェルに必要なデータをすべてキャッシュ済みで並列取得
  const [categories, notices, homeBanner, newThreadRules] = await Promise.all([
    getCachedCategories(),
    getCachedActiveNotices(),
    getCachedSetting('home_banner', 'デュエルマスターズ専門の掲示板です。デッキ相談・カード評価・大会情報など何でもどうぞ。'),
    getCachedSetting('new_thread_rules', `1.似たスレッドがないか確認してください。
2.フライング・リーク情報は禁止です。
3.タイトルでのネタバレを避けてください。
4.画像は権利を侵害しない物を添付してください。
5.ミスで立てたスレは必ず削除を押してください。
6.他人が不快になるようなタイトルは避けてください。
7.スレッド作成は承認制とする場合があります。
8.不適切と判断した場合は削除・ブロックする事があります。`),
  ])

  const typedNotices = notices as Notice[]
  const topNotices = typedNotices.filter(n => n.position === 'top')
  const midNotices = typedNotices.filter(n => n.position === 'mid')
  const botNotices = typedNotices.filter(n => n.position === 'bot')

  return (
    <div className="w-full px-0 py-0">
      <div className="max-w-screen-xl mx-auto px-2 pt-2">
        {/* RecommendSection: キャッシュ済み（300s）で高速解決、スケルトンでCLS防止 */}
        <Suspense fallback={<RecommendSectionSkeleton />}>
          <RecommendSection />
        </Suspense>

        {/* ── LCP 対象テキスト（常時表示・画像ダウンロード不要）──────────
            priority 画像をなくしたことでこのテキストブロックが
            最初に描画される最大要素となり、LCP を確定させる。
            homeBanner が空のときもフォールバック文言で必ず描画する。 */}
        {(() => {
          const banner = homeBanner || 'デュエルマスターズ専門の掲示板です。デッキ相談・カード評価・大会情報など何でもどうぞ。'
          const isHtml = banner.trimStart().startsWith('<')
          return (
            <div className="mb-2 px-3 py-2 text-sm border relative setting-content"
              style={{ color: '#155724', background: '#d4edda', borderColor: '#c3e6cb', whiteSpace: isHtml ? undefined : 'pre-wrap' }}>
              {isHtml
                ? <div dangerouslySetInnerHTML={{ __html: banner }} />
                : banner}
            </div>
          )
        })()}
        {/* topNotices: priority なし（lazy）→ 画像がLCPを更新しない */}
        {topNotices.map(n => <NoticeBlock key={n.id} notice={n} />)}
        {/* ─────────────────────────────────────────────────────────────── */}
      </div>

      {params.category && (
        <div className="max-w-screen-xl mx-auto px-2 mb-1">
          <nav className="text-xs text-gray-600 flex items-center gap-x-1" aria-label="パンくずリスト">
            <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
            <span>{'>'}</span>
            <span>カテゴリ：{categories.find(c => c.slug === params.category)?.name ?? params.category}</span>
          </nav>
        </div>
      )}

      <SortTabs currentSort={sort} currentCategory={params.category} categories={categories} />

      <div className="max-w-screen-xl mx-auto px-2">
        {midNotices.map(n => <NoticeBlock key={n.id} notice={n} />)}

        {/* スレ一覧: getCachedThreadList は <10ms で解決するため
            Suspense を外して初期 HTML に含める → LCP をホームバナーで確定させる */}
        <ThreadList searchParams={params} />

        {botNotices.map(n => <NoticeBlock key={n.id} notice={n} />)}

        <BottomNav />

        <InlineNewThread categories={categories} newThreadRules={newThreadRules} />

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

function RecommendSectionSkeleton() {
  return (
    <div className="mb-2 border border-gray-300 bg-white animate-pulse">
      {/* h-5(20px) + py-1.5(6px*2) = 32px → 実コンテンツのテキスト行高と一致させCLS防止 */}
      <div className="px-3 py-1.5 border-b border-gray-300 flex items-center gap-1.5">
        <div className="h-5 bg-gray-200 rounded w-16" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 border-l border-t border-gray-300">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex border-b border-r border-gray-300 overflow-hidden">
            <div className="shrink-0 bg-gray-200 w-11 h-11 md:w-16 md:h-16" />
            <div className="flex-1 px-1 py-0.5 flex flex-col gap-1 justify-center">
              <div className="h-2 bg-gray-200 rounded w-full" />
              <div className="h-2 bg-gray-200 rounded w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
