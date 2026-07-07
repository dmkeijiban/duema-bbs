import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAdminCookie } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { fetchCardsByIdentifiers, fetchPack } from '@/lib/zukan'
import type { ZukanPack } from '@/lib/zukan'
import {
  getZukanArticleCardIdentifiers,
  parseZukanArticleJson,
  type ZukanArticle,
  type ZukanArticleStatus,
  type ZukanArticleTargetType,
} from '@/lib/zukan-articles'
import { ZukanArticleRenderer } from '@/components/ZukanArticleRenderer'
import { saveZukanArticle } from './actions'

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

const SAMPLE_BLOCKS = `[
  {
    "type": "heading",
    "level": 2,
    "text": "見出し"
  },
  {
    "type": "paragraph",
    "text": "本文をここに入れます。"
  },
  {
    "type": "card",
    "slug": "bolshack-dragon",
    "caption": "記事内ではcompact表示になります。"
  }
]`

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
  return status === 'published'
    ? 'bg-green-50 text-green-700 border-green-200'
    : 'bg-gray-50 text-gray-600 border-gray-200'
}

async function ArticlePreview({ article }: { article: ZukanArticle }) {
  const pack = article.targetType === 'pack_article'
    ? (await fetchPack(article.targetSlug)) ?? {
      ...HALL_PREVIEW_PACK,
      slug: article.targetSlug,
      code: article.targetSlug.toUpperCase(),
      name: article.targetSlug,
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

  return (
    <div className="mx-auto max-w-6xl px-3 py-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href="/admin/zukan" className="text-sm text-blue-700 hover:underline">← 図鑑管理へ戻る</Link>
          <h1 className="mt-1 text-xl font-bold text-gray-900">図鑑記事管理</h1>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">
            思い出図鑑/殿堂図鑑の記事をJSONブロックで保存し、draftで確認してからpublishedにできます。
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
          <form action={saveZukanArticle} className="space-y-3 px-3 py-3">
            <input type="hidden" name="id" value={selected?.id ?? ''} />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-bold text-gray-700">
                対象タイプ
                <select name="article_type" defaultValue={selected?.article_type ?? 'pack_article'} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-xs">
                  <option value="pack_article">pack_article</option>
                  <option value="hall_of_fame_article">hall_of_fame_article</option>
                </select>
              </label>
              <label className="block text-xs font-bold text-gray-700">
                対象ID
                <input name="target_id" defaultValue={selected?.target_id ?? 'dm-01'} placeholder="dm-01 / 2004" className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-xs" />
              </label>
            </div>
            <label className="block text-xs font-bold text-gray-700">
              記事URL slug
              <input name="slug" defaultValue={selected?.slug ?? 'dm-01'} placeholder="dm-01" className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-xs" />
            </label>
            <label className="block text-xs font-bold text-gray-700">
              タイトル
              <input name="title" defaultValue={selected?.title ?? ''} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-xs" />
            </label>
            <label className="block text-xs font-bold text-gray-700">
              説明文
              <textarea name="description" defaultValue={selected?.description ?? ''} rows={2} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-xs" />
            </label>
            <label className="block text-xs font-bold text-gray-700">
              状態
              <select name="status" defaultValue={selected?.status ?? 'draft'} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-xs">
                <option value="draft">draft</option>
                <option value="published">published</option>
              </select>
            </label>
            <label className="block text-xs font-bold text-gray-700">
              本文ブロックJSON
              <textarea
                name="blocks_json"
                defaultValue={selected ? JSON.stringify(selected.blocks, null, 2) : SAMPLE_BLOCKS}
                rows={20}
                spellCheck={false}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-2 font-mono text-[11px] leading-5"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button name="intent" value="draft" className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50">
                下書き保存
              </button>
              <button name="intent" value="publish" className="rounded border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700 hover:bg-green-100">
                公開保存
              </button>
            </div>
          </form>
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
                  <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold ${statusBadge(row.status)}`}>{row.status}</span>
                </div>
                <div className="mt-1 text-[10px] text-gray-500">
                  {row.article_type} / {row.target_id} / {row.slug}
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
