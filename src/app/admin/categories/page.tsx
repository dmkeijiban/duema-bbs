import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { addCategory, deleteCategory, updateCategoryOrder } from './actions'

const ADMIN_COOKIE = 'admin_auth'

async function isAdmin() {
  const cookieStore = await cookies()
  return cookieStore.get(ADMIN_COOKIE)?.value === process.env.ADMIN_PASSWORD
}

const PRESET_COLORS = [
  '#6c757d', '#0d6efd', '#198754', '#dc3545',
  '#fd7e14', '#6f42c1', '#20c997', '#0dcaf0',
]

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
            {categories.map(cat => (
              <div key={cat.id} className="bg-white border border-gray-200 px-3 py-2 flex items-center gap-2">
                <span
                  className="inline-block w-3 h-3 rounded-sm shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="font-medium text-gray-800 flex-1">{cat.name}</span>
                <span className="text-[10px] text-gray-400 w-28 shrink-0">/{cat.slug}</span>
                {/* 並び順変更 */}
                <form action={updateCategoryOrder} className="flex items-center gap-1">
                  <input type="hidden" name="id" value={cat.id} />
                  <input
                    type="number"
                    name="sort_order"
                    defaultValue={cat.sort_order}
                    className="w-14 border border-gray-300 px-1 py-0.5 text-[10px] text-center"
                  />
                  <button type="submit" className="text-[10px] px-1.5 py-0.5 border border-gray-300 text-gray-600 hover:bg-gray-50">
                    順番保存
                  </button>
                </form>
                {/* 削除 */}
                <form action={deleteCategory}>
                  <input type="hidden" name="id" value={cat.id} />
                  <button
                    type="submit"
                    onClick={e => { if (!confirm(`「${cat.name}」を削除しますか？`)) e.preventDefault() }}
                    className="text-[10px] px-2 py-0.5 text-white hover:opacity-80"
                    style={{ background: '#dc3545' }}
                  >
                    削除
                  </button>
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
            <label className="block text-xs text-gray-600 mb-1">カテゴリ名 <span className="text-red-500">*</span></label>
            <input
              type="text"
              name="name"
              required
              placeholder="例：ルール・裁定関連"
              className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">スラッグ（URL用・英数字とハイフン）<span className="text-red-500">*</span></label>
            <input
              type="text"
              name="slug"
              required
              placeholder="例：rules"
              pattern="[a-z0-9\-]+"
              className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">カラー</label>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map(c => (
                <label key={c} className="flex items-center gap-1 cursor-pointer">
                  <input type="radio" name="color" value={c} defaultChecked={c === '#6c757d'} className="sr-only" />
                  <span
                    className="block w-6 h-6 rounded border-2 border-transparent peer-checked:border-gray-800"
                    style={{ backgroundColor: c }}
                    onClick={e => {
                      const radio = (e.currentTarget.previousElementSibling as HTMLInputElement)
                      if (radio) radio.checked = true
                    }}
                  />
                </label>
              ))}
              <input type="color" name="color_custom" className="w-8 h-8 border border-gray-300 cursor-pointer p-0" />
              <span className="text-[10px] text-gray-400">カスタム色</span>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">表示順（小さいほど先頭）</label>
            <input
              type="number"
              name="sort_order"
              defaultValue={10}
              className="w-24 border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
            />
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
