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
// スレ一覧（非同期・Suspense 内）
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
        {(all as unknown as (Thread & { categories: Category | null })[]).map((thread) => (
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
          {(threads as unknown as (Thread & { categories: Category | null })[]).map((thread) => (
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
// LCP要素のデフォルト表示
// Home が await を持たないため、このコンポーネントが最初の
// HTML バイトに含まれ、LCP が即座に確定する。
//
// 【重要】DB の home_banner 値と同じ内容・サイズにすること。
// Chrome は「より大きい要素」に LCP 候補を更新するため、
// fallback より DB 版が大きいと DB 版（1830ms）が LCP になる。
// fallback = DB 値 にすることで fallback が LCP 確定（ERD ≈ 0）。
// DB 値を変更したらここも合わせて更新する。
// ──────────────────────────────────────────────────
function HomeBannerFallback() {
  return (
    <div
      className="mb-2 px-3 py-2 text-sm border relative setting-content"
      style={{ color: '#155724', background: '#d4edda', borderColor: '#c3e6cb' }}
    >
      <div>
        <p>デュエルマスターズ専門の掲示板です。デッキ相談・カード評価・大会情報など何でもどうぞ。初めての方は<a target="_blank" rel="noopener noreferrer" href="https://duema-bbs.vercel.app/guide">スレッドの立て方</a>をご確認ください。</p>
      </div>
    </div>
  )
}

// ── 実バナーデータを取得して HomeBannerFallback と置き換える
const HOME_BANNER_DEFAULT = '<p>デュエルマスターズ専門の掲示板です。デッキ相談・カード評価・大会情報など何でもどうぞ。初めての方は<a target="_blank" rel="noopener noreferrer" href="https://duema-bbs.vercel.app/guide">スレッドの立て方</a>をご確認ください。</p>'

async function HomeBannerServer() {
  const banner = await getCachedSetting('home_banner', HOME_BANNER_DEFAULT)
  const text = banner || HOME_BANNER_DEFAULT
  const isHtml = text.trimStart().startsWith('<')
  return (
    <div
      className="mb-2 px-3 py-2 text-sm border relative setting-content"
      style={{ color: '#155724', background: '#d4edda', borderColor: '#c3e6cb', whiteSpace: isHtml ? undefined : 'pre-wrap' }}
    >
      {isHtml ? <div dangerouslySetInnerHTML={{ __html: text }} /> : text}
    </div>
  )
}

// ── お知らせブロック（position 別）
async function TopNoticesServer() {
  const notices = (await getCachedActiveNotices()) as Notice[]
  const top = notices.filter(n => n.position === 'top')
  if (top.length === 0) return null
  return <>{top.map(n => <NoticeBlock key={n.id} notice={n} />)}</>
}

async function MidNoticesServer() {
  const notices = (await getCachedActiveNotices()) as Notice[]
  const mid = notices.filter(n => n.position === 'mid')
  if (mid.length === 0) return null
  return <>{mid.map(n => <NoticeBlock key={n.id} notice={n} />)}</>
}

async function BotNoticesServer() {
  const notices = (await getCachedActiveNotices()) as Notice[]
  const bot = notices.filter(n => n.position === 'bot')
  if (bot.length === 0) return null
  return <>{bot.map(n => <NoticeBlock key={n.id} notice={n} />)}</>
}

// ── SortTabs（カテゴリ取得後に差し替え）
// パンくずリストも同じカテゴリデータを使うためここに含める。
async function SortTabsServer({ params }: { params: SearchParams }) {
  const categories = await getCachedCategories()
  const sort = params.sort ?? 'recent'
  return (
    <>
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
    </>
  )
}

// ── InlineNewThread（カテゴリ＋スレ作成ルール取得後に差し替え）
async function InlineNewThreadServer({ params }: { params: SearchParams }) {
  const [categories, newThreadRules] = await Promise.all([
    getCachedCategories(),
    getCachedSetting(
      'new_thread_rules',
      `1.似たスレッドがないか確認してください。
2.フライング・リーク情報は禁止です。
3.タイトルでのネタバレを避けてください。
4.画像は権利を侵害しない物を添付してください。
5.ミスで立てたスレは必ず削除を押してください。
6.他人が不快になるようなタイトルは避けてください。
7.スレッド作成は承認制とする場合があります。
8.不適切と判断した場合は削除・ブロックする事があります。`,
    ),
  ])
  return <InlineNewThread categories={categories} newThreadRules={newThreadRules} />
}

// ──────────────────────────────────────────────────
// ページ本体
// DB await を一切持たないため、最初の HTML バイトが
// 即座にストリームされ LCP 要素（HomeBannerFallback）が
// ブラウザに届く。
// ──────────────────────────────────────────────────
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams   // searchParams の解決のみ（DB なし・即時）

  const isConfigured =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('http') &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!isConfigured) return <SetupGuide />

  const sort = params.sort ?? 'recent'

  return (
    <div className="w-full px-0 py-0">
      {/* SEO: スクリーンリーダー・Googleのみ向けH1 */}
      <h1 className="sr-only">デュエマ掲示板 - デュエルマスターズ専門掲示板</h1>

      {/* SEO: WebSite構造化データ（JSON-LD） */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": "デュエマ掲示板",
            "alternateName": "デュエルマスターズ専門掲示板",
            "url": "https://duema-bbs.vercel.app",
            "description": "デュエルマスターズ専門の掲示板。デッキ相談・カード評価・大会情報など。",
            "potentialAction": {
              "@type": "SearchAction",
              "target": {
                "@type": "EntryPoint",
                "urlTemplate": "https://duema-bbs.vercel.app/?q={search_term_string}"
              },
              "query-input": "required name=search_term_string"
            }
          })
        }}
      />

      <div className="max-w-screen-xl mx-auto px-2 pt-2">
        <Suspense fallback={<RecommendSectionSkeleton />}>
          <RecommendSection />
        </Suspense>

        {/* ── LCP 対象テキスト ──────────────────────────────────────────
            HomeBannerFallback が初期 HTML シェルに含まれ、CSS のみで
            即座に描画される。HomeBannerServer の解決後に実データで置換。
            どちらもテキストのみ（画像なし）なので、LCP がページ表示直後に確定。 */}
        <Suspense fallback={<HomeBannerFallback />}>
          <HomeBannerServer />
        </Suspense>

        {/* topNotices: 現在アクティブなものがなければ null を返すため CLS ≈ 0 */}
        <Suspense fallback={null}>
          <TopNoticesServer />
        </Suspense>

        {/* まとめバナー（静的・即座に描画） */}
        <Link
          href="/summary"
          className="mb-2 flex items-center justify-between px-3 py-2 border border-blue-200 bg-blue-50 text-sm text-blue-700 hover:bg-blue-100 transition-colors"
        >
          <span>📊 先週の人気スレッドまとめ（TOP5）を見る</span>
          <span className="text-xs ml-2 shrink-0">→</span>
        </Link>
      </div>

      {/* SortTabs: カテゴリ一覧が必要。スケルトンで正確な高さを維持し CLS 防止 */}
      <Suspense fallback={<SortTabsSkeleton sort={sort} />}>
        <SortTabsServer params={params} />
      </Suspense>

      <div className="max-w-screen-xl mx-auto px-2">
        <Suspense fallback={null}>
          <MidNoticesServer />
        </Suspense>

        {/* スレ一覧: Suspense で包み、上位要素（LCP）のストリームを妨げない */}
        <Suspense fallback={<ThreadListSkeleton />}>
          <ThreadList searchParams={params} />
        </Suspense>

        <Suspense fallback={null}>
          <BotNoticesServer />
        </Suspense>

        <BottomNav />

        {/* スレ作成フォーム: 遅延ロードで可視領域外のレンダリングコストを下げる */}
        <Suspense fallback={null}>
          <InlineNewThreadServer params={params} />
        </Suspense>

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

// ──────────────────────────────────────────────────
// スケルトン
// ──────────────────────────────────────────────────

function ThreadListSkeleton() {
  return (
    <div className="grid grid-cols-3 md:grid-cols-5 border-l border-t border-gray-300 animate-pulse">
      {[...Array(15)].map((_, i) => (
        <div key={i} className="bg-white border-b border-r border-gray-300 overflow-hidden">
          {/* モバイル */}
          <div className="md:hidden flex" style={{ height: 52 }}>
            <div className="shrink-0 bg-gray-200" style={{ width: 52, height: 52 }} />
            <div className="px-1.5 py-1 flex-1 flex flex-col gap-1 justify-center">
              <div className="h-2 bg-gray-200 rounded w-full" />
              <div className="h-2 bg-gray-200 rounded w-3/4" />
            </div>
          </div>
          {/* PC */}
          <div className="hidden md:flex" style={{ height: 80 }}>
            <div className="shrink-0 bg-gray-200" style={{ width: 80, height: 80 }} />
            <div className="p-1.5 flex-1 flex flex-col gap-1 justify-center">
              <div className="h-2 bg-gray-200 rounded w-full" />
              <div className="h-2 bg-gray-200 rounded w-3/4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// SortTabs と同一の高さ・構造を維持し CLS を防ぐスケルトン。
// カテゴリ一覧が届く前の表示として使う。
// アクティブタブは sort が既知なので正確に描画できる。
const SORT_TABS_META = [
  { sort: 'recent',  short: '更新', label: '更新順', icon: '↺' },
  { sort: 'new',     short: '新着', label: '新着',   icon: '⏱' },
  { sort: 'popular', short: '人気', label: '人気',   icon: '📊' },
  { sort: 'random',  short: 'ランダ', label: 'ランダム', icon: '🎲' },
]

function SortTabsSkeleton({ sort }: { sort: string }) {
  return (
    <div className="max-w-screen-xl mx-auto px-2">
      <ul className="flex mb-3 mt-2" role="tablist" style={{ borderBottom: '1px solid #dee2e6' }}>
        {SORT_TABS_META.map(tab => {
          const active = sort === tab.sort
          return (
            <li key={tab.sort} className="flex-1 min-w-0" role="presentation">
              <div
                className="w-full text-center py-2 font-medium border border-transparent select-none overflow-hidden text-xs md:text-sm flex items-center justify-center gap-0.5"
                style={
                  active
                    ? { background: '#2563eb', color: '#fff', borderColor: '#2563eb', borderRadius: '4px 4px 0 0', marginBottom: -1 }
                    : { color: '#2563eb' }
                }
              >
                <span className="opacity-80">{tab.icon}</span>
                <span className="hidden md:inline">{tab.label}</span>
                <span className="md:hidden">{tab.short}</span>
              </div>
            </li>
          )
        })}
        {/* CategoryDropdown プレースホルダー */}
        <li className="flex-1 min-w-0 flex items-center justify-center px-1 py-2">
          <div className="h-4 bg-gray-100 rounded w-full animate-pulse" />
        </li>
      </ul>
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
