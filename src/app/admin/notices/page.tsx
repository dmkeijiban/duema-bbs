import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { createNotice, toggleNoticeActive, moveNotice, deleteNotice } from './actions'
import { Notice } from '@/components/NoticeBlock'
import { ConfirmDeleteButton } from '@/components/admin/ConfirmDeleteButton'

const ADMIN_COOKIE = 'admin_auth'

async function isAdmin() {
  const cookieStore = await cookies()
  return cookieStore.get(ADMIN_COOKIE)?.value === process.env.ADMIN_PASSWORD
}

const posLabel: Record<string, string> = { top: 'スレ上', mid: 'タブ下', bot: 'スレ下' }

export default async function NoticesAdminPage() {
  if (!(await isAdmin())) redirect('/admin')

  const supabase = await createClient()
  const { data: notices } = await supabase
    .from('notices')
    .select('*')
    .order('position')
    .order('sort_order')

  return (
    <div className="max-w-4xl mx-auto px-3 py-4 text-sm">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">📢 お知らせ管理</h1>
        <div className="flex gap-3">
          <a href="/admin" className="text-xs text-gray-500 hover:underline">← 管理画面に戻る</a>
          <form action={createNotice}>
            <button type="submit"
              className="px-4 py-1.5 text-white text-xs font-medium"
              style={{ background: '#2563eb' }}>
              ＋ 新規作成
            </button>
          </form>
        </div>
      </div>

      {/* 凡例 */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 text-xs text-blue-700 space-y-1">
        <p><strong>使い方：</strong>「＋ 新規作成」で枠を作り、「編集」で内容を入力、「表示ON」で公開。</p>
        <p>バナー項目は編集画面で追加・削除・並び替えできます。画像はURLを貼るかファイルをアップロード。</p>
        <p>列数は1〜4で指定（例：バナー3枚なら列数3）。並び順は数値が小さい方が上に表示。</p>
      </div>

      {(!notices || notices.length === 0) ? (
        <div className="text-center py-12 text-gray-400 border border-dashed border-gray-300">
          お知らせはまだありません。「＋ 新規作成」から追加してください。
        </div>
      ) : (
        <div className="space-y-2">
          {(notices as Notice[]).map(n => (
            <div key={n.id} className="bg-white border border-gray-200 p-3">
              <div className="flex items-start gap-3">
                {/* 位置バッジ */}
                <span className="shrink-0 text-xs px-2 py-0.5 border border-gray-300 text-gray-600 bg-gray-50 font-mono">
                  {posLabel[n.position] ?? n.position}
                </span>

                {/* 内容 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-800 text-sm">
                      {n.header_text || '（タイトルなし）'}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {n.columns}列 / {n.items?.length ?? 0}件 / 順:{n.sort_order}
                    </span>
                    {n.show_in_thread && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 border border-purple-300">
                        スレにも表示
                      </span>
                    )}
                  </div>

                  {/* バナーのサムネプレビュー */}
                  {n.items && n.items.length > 0 && (
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {n.items.slice(0, 6).map((item, i) => (
                        <div key={i} className="relative w-12 h-8 bg-gray-100 border border-gray-200 overflow-hidden shrink-0">
                          {item.image_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.image_url} alt={item.title || ''} className="w-full h-full object-cover" />
                          )}
                        </div>
                      ))}
                      {n.items.length > 6 && (
                        <span className="text-[10px] text-gray-400 self-center">+{n.items.length - 6}件</span>
                      )}
                    </div>
                  )}
                </div>

                {/* アクションボタン群 */}
                <div className="flex flex-col gap-1 shrink-0">
                  {/* 表示切り替え */}
                  <form action={toggleNoticeActive} className="flex">
                    <input type="hidden" name="id" value={n.id} />
                    <input type="hidden" name="current" value={String(n.is_active)} />
                    <button type="submit"
                      className="w-full px-2 py-0.5 text-[11px] border font-medium leading-none"
                      style={n.is_active
                        ? { color: '#155724', borderColor: '#28a745', background: '#d4edda' }
                        : { color: '#6c757d', borderColor: '#adb5bd', background: '#f8f9fa' }}>
                      {n.is_active ? '表示中' : '非表示'}
                    </button>
                  </form>

                  {/* 編集 */}
                  <a href={`/admin/notices/${n.id}`}
                    className="px-2 py-0.5 text-[11px] text-center border border-blue-400 text-blue-700 hover:bg-blue-50 leading-none">
                    編集
                  </a>

                  {/* 並び順 */}
                  <div className="flex gap-0.5">
                    <form action={moveNotice}>
                      <input type="hidden" name="id" value={n.id} />
                      <input type="hidden" name="direction" value="up" />
                      <button type="submit" className="px-1.5 py-0.5 text-[11px] border border-gray-300 bg-white hover:bg-gray-50">▲</button>
                    </form>
                    <form action={moveNotice}>
                      <input type="hidden" name="id" value={n.id} />
                      <input type="hidden" name="direction" value="down" />
                      <button type="submit" className="px-1.5 py-0.5 text-[11px] border border-gray-300 bg-white hover:bg-gray-50">▼</button>
                    </form>
                  </div>

                  {/* 削除 */}
                  <form action={deleteNotice}>
                    <input type="hidden" name="id" value={n.id} />
                    <ConfirmDeleteButton
                      message="このお知らせを削除しますか？"
                      className="w-full px-2 py-0.5 text-[11px] text-white hover:opacity-80 leading-none"
                      style={{ background: '#dc3545' }}
                    >
                      削除
                    </ConfirmDeleteButton>
                  </form>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
