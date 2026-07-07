import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAdminCookie } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { fetchCardBySlug, fetchCardsByIdentifiers, fetchPack } from '@/lib/zukan'
import type { ZukanPack } from '@/lib/zukan'
import {
  getZukanArticleCardIdentifiers,
  parseZukanArticleJson,
  type ZukanArticle,
  type ZukanArticleStatus,
  type ZukanArticleTargetType,
} from '@/lib/zukan-articles'
import { ZukanArticleRenderer } from '@/components/ZukanArticleRenderer'
import { ZukanArticleEditorForm } from './ZukanArticleEditorForm'

export const dynamic = 'force-dynamic'

type ArticleRow = {
  id: string
  slug: string
  article_type: ZukanArticleTargetType
  target_id: string
  title: string
  description: string | null
  status: ZukanArticleStatus
  blocks: unknown
  updated_at: string
  published_at: string | null
}

const HALL_PREVIEW_PACK: ZukanPack = {
  id: '',
  slug: 'hall-of-fame',
  code: '殿堂',
  name: '殿堂・プレミアム殿堂図鑑',
  released_year: null,
  card_count: null,
  description: null,
  is_published: true,
  sort_order: 0,
  image_url: null,
}

type PackOption = {
  slug: string
  code: string
  name: string
}

type CardOption = {
  slug: string
  name: string
}

async function requireAdmin() {
  const cookieStore = await cookies()
  if (!verifyAdminCookie(cookieStore.get('admin_auth')?.value)) redirect('/admin')
}

function formatDate(value: string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function articleFromRow(row: ArticleRow): ZukanArticle | null {
  return parseZukanArticleJson({
    id: row.id,
    slug: row.slug,
    targetType: row.article_type,
    targetSlug: row.target_id,
    title: row.title,
    description: row.description,
    status: row.status,
    blocks: row.blocks,
  })
}

function statusBadge(status: ZukanArticleStatus) {
  if (status === 'published') return 'bg-green-50 text-green-700 border-green-200'
  if (status === 'archived') return 'bg-gray-100 text-gray-500 border-gray-200'
  return 'bg-amber-50 text-amber-700 border-amber-200'
}

function statusLabel(status: ZukanArticleStatus) {
  if (status === 'published') return '公開中'
  if (status === 'archived') return '非公開 / 保管'
  return '下書き'
}

function articleTypeLabel(articleType: ZukanArticleTargetType) {
  if (articleType === 'pack_article') return 'パック紹介記事'
  if (articleType === 'card_article') return 'カード紹介記事'
  return '殿堂図鑑記事'
}

function targetLabel(row: ArticleRow, packsBySlug: Map<string, PackOption>, cardsBySlug: Map<string, CardOption>) {
  if (row.article_type === 'pack_article') {
    const pack = packsBySlug.get(row.target_id)
    return pack ? `${pack.code} ${pack.name}` : row.target_id
  }
  if (row.article_type === 'card_article') {
    const card = cardsBySlug.get(row.target_id)
    return card ? card.name : row.target_id
  }
  return row.target_id
}

function fallbackPack(slug: string): ZukanPack {
  return {
    ...HALL_PREVIEW_PACK,
    slug,
    code: slug.toUpperCase(),
    name: slug,
  }
}

async function ArticlePreview({ article }: { article: ZukanArticle }) {
  const targetCardResult = article.targetType === 'card_article'
    ? await fetchCardBySlug(article.targetSlug)
    : null
  const pack = article.targetType === 'pack_article'
    ? (await fetchPack(article.targetSlug)) ?? fallbackPack(article.targetSlug)
    : targetCardResult?.status === 'found' && targetCardResult.card.zukan_packs
      ? {
        ...HALL_PREVIEW_PACK,
        slug: targetCardResult.card.zukan_packs.slug,
        code: targetCardResult.card.zukan_packs.code,
        name: targetCardResult.card.zukan_packs.name,
      }
      : HALL_PREVIEW_PACK
  const cards = await fetchCardsByIdentifiers(getZukanArticleCardIdentifiers(article))

  return (
    <section className="mt-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-800">プレビュー</h2>
        <Link
          href={`/zukan/articles/${article.slug}`}
          className="text-xs text-blue-700 hover:underline"
        >
          記事ページを開く →
        </Link>
      </div>
      <ZukanArticleRenderer article={article} pack={pack} cards={cards ?? []} />
    </section>
  )
}

export default async function AdminZukanArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; saved?: string; preview?: string; error?: string }>
}) {
  await requireAdmin()
  const sp = await searchParams
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('zukan_articles')
    .select('id, slug, article_type, target_id, title, description, status, blocks, updated_at, published_at')
    .order('updated_at', { ascending: false })
    .limit(100)

  const tableMissing = error?.code === '42P01' || error?.code === 'PGRST205'
  const rows = tableMissing ? [] : ((data ?? []) as ArticleRow[])
  const selected = rows.find(row => row.id === sp.edit) ?? null
  const selectedArticle = selected ? articleFromRow(selected) : null
  const [{ data: packsData }, { data: cardsData }] = tableMissing
    ? [{ data: [] as PackOption[] }, { data: [] as CardOption[] }]
    : await Promise.all([
      supabase
        .from('zukan_packs')
        .select('slug, code, name')
        .order('sort_order', { ascending: true })
        .limit(500),
      supabase
        .from('zukan_cards')
        .select('slug, name')
        .eq('is_published', true)
        .order('name', { ascending: true })
        .limit(2000),
    ])
  const packOptions = (packsData ?? []) as PackOption[]
  const cardOptions = (cardsData ?? []) as CardOption[]
  const packsBySlug = new Map(packOptions.map(pack => [pack.slug, pack]))
  const cardsBySlug = new Map(cardOptions.map(card => [card.slug, card]))

  return (
    <div className="mx-auto max-w-6xl px-3 py-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href="/admin/zukan" className="text-sm text-blue-700 hover:underline">← 図鑑管理へ戻る</Link>
          <h1 className="mt-1 text-xl font-bold text-gray-900">図鑑記事管理</h1>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">
            思い出図鑑のパックページやカードページに表示する読み物記事を作成・編集できます。
          </p>
        </div>
        <Link href="/admin" className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50">
          管理トップ
        </Link>
      </div>

      {tableMissing && (
        <div className="mb-4 border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
          zukan_articles テーブルがまだありません。マイグレーション適用後に保存できます。
        </div>
      )}
      {sp.saved && (
        <div className="mb-4 border border-green-200 bg-green-50 px-3 py-2 text-xs font-bold text-green-700">
          保存しました。下のプレビューで表示を確認できます。
        </div>
      )}
      {sp.error && (
        <div className="mb-4 border border-red-200 bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-700">
          保存できませんでした: {sp.error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="rounded border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-3 py-2">
            <h2 className="text-sm font-bold text-gray-800">{selected ? '記事を編集' : '新規記事を作成'}</h2>
          </div>
          <ZukanArticleEditorForm
            selected={selected ? {
              id: selected.id,
              slug: selected.slug,
              article_type: selected.article_type,
              target_id: selected.target_id,
              title: selected.title,
              description: selected.description ?? '',
              status: selected.status,
              blocks: selected.blocks,
            } : null}
            packOptions={packOptions}
            cardOptions={cardOptions}
          />
        </section>

        <aside className="rounded border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-3 py-2">
            <h2 className="text-sm font-bold text-gray-800">記事一覧</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {rows.length > 0 ? rows.map(row => (
              <Link key={row.id} href={`/admin/zukan/articles?edit=${row.id}&preview=1`} className="block px-3 py-2 text-xs hover:bg-blue-50">
                <div className="flex items-center justify-between gap-2">
                  <span className="line-clamp-1 font-bold text-blue-700">{row.title}</span>
                  <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold ${statusBadge(row.status)}`}>{statusLabel(row.status)}</span>
                </div>
                <div className="mt-1 text-[10px] text-gray-500">
                  {articleTypeLabel(row.article_type)} / {targetLabel(row, packsBySlug, cardsBySlug)} / {row.slug}
                </div>
                <div className="mt-0.5 text-[10px] text-gray-400">更新 {formatDate(row.updated_at)}</div>
              </Link>
            )) : (
              <p className="px-3 py-4 text-xs text-gray-500">記事はまだありません。</p>
            )}
          </div>
        </aside>
      </div>

      {sp.preview && selectedArticle && <ArticlePreview article={selectedArticle} />}
    </div>
  )
}
