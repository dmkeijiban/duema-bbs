import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { addCategory, deleteCategory, moveCategory } from './actions'
import { ConfirmDeleteButton } from '@/components/admin/ConfirmDeleteButton'

export const dynamic = 'force-dynamic'

const ADMIN_COOKIE = 'admin_auth'

async function isAdmin() {
  const cookieStore = await cookies()
  return cookieStore.get(ADMIN_COOKIE)?.value === process.env.ADMIN_PASSWORD
}

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  if (!(await isAdmin())) redirect('/admin')

  const { error } = await searchParams
  const supabase = await createClient()
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order')

  return (
    <div className="max-w-2xl mx-auto px-3 py-4 text-sm">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">🗂 カテゴリ管理</h1>
        <a href="/admin" className="text-xs text-gray-500 hover:underline">← 管理画面に戻る</a>
      </div>

      {error && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>
      )}

      {/* 現在のカテゴリ一覧 */}
      <section className="mb-6">
        <h2 className="font-bold text-gray-700 mb-2 pb-1 border-b border-gray-200">現在のカテゴリ</h2>
        {!categories || categories.length === 0 ? (
          <p className="text-xs text-gray-400 py-3">カテゴリがありません</p>
        ) : (
          <div className="space-y-1">
            {categories.map((cat, idx) => (
              <div key={cat.id} className="bg-white border border-gray-200 px-3 py-2 flex items-center gap-2">
                {/* 並び順ボタン */}
                <div className="flex flex-col gap-0.5 shrink-0">
                  <form action={moveCategory}>
                    <input type="hidden" name="id" value={cat.id} />
                    <input type="hidden" name="direction" value="up" />
                    <button
                      type="submit"
                      disabled={idx === 0}
                      className="px-1.5 py-0.5 text-[11px] border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed block"
                    >▲</button>
                  </form>
                  <form action={moveCategory}>
                    <input type="hidden" name="id" value={cat.id} />
                    <input type="hidden" name="direction" value="down" />
                    <button
                      type="submit"
                      disabled={idx === categories.length - 1}
                      className="px-1.5 py-0.5 text-[11px] border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed block"
                    >▼</button>
                  </form>
                </div>

                {/* カラー + 名前 */}
                <span className="inline-block w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: cat.color }} />
                <span className="font-medium text-gray-800 flex-1 min-w-0">{cat.name}</span>
                <span className="text-[10px] text-gray-400 shrink-0">/{cat.slug}</span>

                {/* 削除 */}
                <form action={deleteCategory}>
                  <input type="hidden" name="id" value={cat.id} />
                  <ConfirmDeleteButton
                    message={`「${cat.name}」を削除しますか？`}
                    className="text-[10px] px-2 py-0.5 text-white hover:opacity-80"
                    style={{ background: '#dc3545' }}
                  >
                    削除
                  </ConfirmDeleteButton>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 新規追加フォーム */}
      <section>
        <h2 className="font-bold text-gray-700 mb-2 pb-1 border-b border-gray-200">カテゴリを追加</h2>
        <form action={addCategory} className="bg-white border border-gray-200 p-3 space-y-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              カテゴリ名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              required
              placeholder="例：ルール・裁定関連"
              className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              スラッグ（URL用・英数字とハイフンのみ）<span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="slug"
              required
              placeholder="例：rules"
              pattern="[a-z0-9\-]+"
              className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-600 mb-1">カラー</label>
              <input
                type="color"
                name="color"
                defaultValue="#6c757d"
                className="h-9 w-full border border-gray-300 cursor-pointer p-0.5"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">追加位置（並び順）</label>
              <input
                type="number"
                name="sort_order"
                defaultValue={10}
                className="w-24 border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full py-2 text-white text-sm font-medium"
            style={{ background: '#0d6efd' }}
          >
            追加する
          </button>
        </form>
      </section>
    </div>
  )
}
