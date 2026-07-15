import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { deletePage, togglePublished, toggleMainNav, movePage, createDefaultStaticPages } from './actions'
import { ConfirmDeleteButton } from '@/components/admin/ConfirmDeleteButton'
import { verifyAdminCookie } from '@/lib/admin-auth'
import { ADSENSE_REVIEW_MODE } from '@/lib/adsense-review-mode'
import { buildPrimaryNavigationItems, primarySystemNavigation } from '@/lib/primary-navigation'

export const dynamic = 'force-dynamic'

async function isAdmin() {
  const cookieStore = await cookies()
  return verifyAdminCookie(cookieStore.get('admin_auth')?.value)
}

export default async function AdminPagesPage() {
  if (!(await isAdmin())) redirect('/admin')

  const supabase = await createClient()
  const { data: pages } = await supabase
    .from('fixed_pages')
    .select('*')
    .order('sort_order')
  const mainNavigation = buildPrimaryNavigationItems(
    (pages ?? []).filter(page => page.is_published && page.show_in_nav),
    ADSENSE_REVIEW_MODE,
  )
  const systemNavigationKeys = new Set(primarySystemNavigation.map(item => item.key))

  return (
    <div className="max-w-3xl mx-auto px-3 py-4 text-sm">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">📄 固定ページ管理</h1>
        <div className="flex items-center gap-2">
          <Link href="/admin/article-drafts" className="px-3 py-1.5 text-xs text-white font-medium" style={{ background: '#6f42c1' }}>
            記事下書き取り込み
          </Link>
          <Link href="/admin/pages/new" className="px-3 py-1.5 text-xs text-white font-medium" style={{ background: '#0d6efd' }}>
            ＋ 新規作成
          </Link>
          <Link href="/admin" className="text-xs text-gray-500 hover:underline">← 管理画面に戻る</Link>
        </div>
      </div>

      <section className="mb-5">
        <div className="mb-2">
          <h2 className="font-bold text-gray-800">現在のメインナビ（TOPヘッダー）</h2>
          <p className="text-xs text-gray-500">実際のTOPヘッダーと同じ8項目・同じ順番です。</p>
        </div>
        <div className="space-y-1">
          {mainNavigation.map((item, index) => {
            const isSystemPage = systemNavigationKeys.has(item.key)
            return (
              <div key={item.key} className="flex items-center gap-3 border border-blue-200 bg-blue-50 px-3 py-2">
                <span className="w-5 shrink-0 text-center text-xs font-bold text-blue-700">{index + 1}</span>
                <span className={`shrink-0 px-2 py-0.5 text-[10px] ${isSystemPage ? 'bg-slate-200 text-slate-700' : 'bg-blue-100 text-blue-700'}`}>
                  {isSystemPage ? '機能ページ' : '固定ページ'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-gray-800">{item.label}</p>
                  <p className="truncate text-[10px] text-gray-500">{item.href}</p>
                </div>
                <a href={item.href} target="_blank" rel="noopener noreferrer"
                  className="shrink-0 border border-gray-300 bg-white px-2 py-0.5 text-[10px] hover:bg-gray-50">表示</a>
              </div>
            )
          })}
        </div>
      </section>

      <div className="text-xs text-gray-500 mb-3 bg-gray-50 border border-gray-200 px-3 py-2 flex items-center justify-between gap-3 flex-wrap">
        <span>以下は固定ページ自体の公開・メインナビ表示設定です。規約やプライバシーなど、メインナビに出さない公開ページもここで管理します。</span>
        <form action={createDefaultStaticPages}>
          <button type="submit"
            className="text-[11px] px-2.5 py-1 border border-blue-400 text-blue-700 bg-white hover:bg-blue-50 shrink-0 whitespace-nowrap">
            初期ページ作成（利用規約・プライバシー・使い方）
          </button>
        </form>
      </div>

      <h2 className="mb-2 font-bold text-gray-800">固定ページ設定</h2>

      {!pages || pages.length === 0 ? (
        <p className="text-xs text-gray-400 py-4">ページがありません。「新規作成」から追加してください。</p>
      ) : (
        <div className="space-y-1">
          {pages.map((page, idx) => (
            <div key={page.id} className="bg-white border border-gray-200 px-3 py-2 flex flex-wrap items-center gap-2">
              {/* 並び替え */}
              <div className="flex flex-col gap-0.5 shrink-0">
                <form action={movePage}>
                  <input type="hidden" name="id" value={page.id} />
                  <input type="hidden" name="direction" value="up" />
                  <button type="submit" disabled={idx === 0}
                    className="px-1.5 py-0.5 text-[10px] border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-30 block">▲</button>
                </form>
                <form action={movePage}>
                  <input type="hidden" name="id" value={page.id} />
                  <input type="hidden" name="direction" value="down" />
                  <button type="submit" disabled={idx === pages.length - 1}
                    className="px-1.5 py-0.5 text-[10px] border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-30 block">▼</button>
                </form>
              </div>

              {/* ステータスバッジ */}
              <div className="flex flex-col gap-0.5 shrink-0 w-24">
                <span className={`text-[9px] px-1 py-0.5 text-center font-medium ${page.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {page.is_published ? '公開' : '非公開'}
                </span>
                <span className={`text-[9px] px-1 py-0.5 text-center ${page.show_in_nav ? 'bg-blue-100 text-blue-700' : 'bg-gray-50 text-gray-400'}`}>
                  {page.show_in_nav ? 'メインナビ表示' : 'メインナビ非表示'}
                </span>
              </div>

              {/* タイトル・スラッグ */}
              <div className="flex-1 min-w-40">
                <p className="font-medium text-gray-800 text-xs truncate">{page.title}</p>
                <p className="text-[10px] text-gray-400">
                  {page.external_url ? `→ ${page.external_url}` : `/${page.slug}`}
                </p>
              </div>

              {/* 操作 */}
              <div className="flex flex-wrap items-center justify-end gap-1 shrink-0 max-sm:w-full">
                <form action={togglePublished}>
                  <input type="hidden" name="id" value={page.id} />
                  <input type="hidden" name="current" value={String(page.is_published)} />
                  <button type="submit"
                    className="text-[10px] px-2 py-0.5 border border-gray-300 bg-white hover:bg-gray-50">
                    {page.is_published ? '非公開に' : '公開に'}
                  </button>
                </form>
                <form action={toggleMainNav}>
                  <input type="hidden" name="id" value={page.id} />
                  <input type="hidden" name="current" value={String(page.show_in_nav)} />
                  <button type="submit"
                    className="text-[10px] px-2 py-0.5 border border-gray-300 bg-white hover:bg-gray-50">
                    {page.show_in_nav ? 'メインナビから外す' : 'メインナビに表示'}
                  </button>
                </form>
                <a href={`/admin/pages/${page.id}`}
                  className="text-[10px] px-2 py-0.5 border border-gray-300 bg-white hover:bg-gray-50">
                  編集
                </a>
                {!page.external_url && page.is_published && (
                  <a href={`/${page.slug}`} target="_blank" rel="noopener noreferrer"
                    className="text-[10px] px-2 py-0.5 border border-gray-300 bg-white hover:bg-gray-50">
                    表示
                  </a>
                )}
                <form action={deletePage}>
                  <input type="hidden" name="id" value={page.id} />
                  <ConfirmDeleteButton message={`「${page.title}」を削除しますか？`}
                    className="text-[10px] px-2 py-0.5 text-white hover:opacity-80"
                    style={{ background: '#dc3545' }}>削除</ConfirmDeleteButton>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
