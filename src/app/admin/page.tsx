import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import {
  adminDeleteThread, adminDeletePost,
  adminUpdateThread, adminUpdatePost,
  adminToggleArchive, adminLogin,
} from './actions'

const ADMIN_COOKIE = 'admin_auth'

async function isAdmin() {
  const cookieStore = await cookies()
  return cookieStore.get(ADMIN_COOKIE)?.value === process.env.ADMIN_PASSWORD
}

function LoginPage({ error }: { error?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white border border-gray-300 p-8 w-full max-w-sm">
        <h1 className="text-lg font-bold mb-4 text-gray-800">🔐 管理者ログイン</h1>
        <form action={adminLogin}>
          <input type="password" name="password" placeholder="管理者パスワード"
            className="w-full border border-gray-300 px-3 py-2 text-sm mb-3 focus:outline-none focus:border-blue-400" required />
          {error && <p className="text-red-500 text-xs mb-3">{error}</p>}
          <button type="submit" className="w-full py-2 text-white text-sm font-medium" style={{ background: '#0d6efd' }}>
            ログイン
          </button>
        </form>
      </div>
    </div>
  )
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string; error?: string; editThread?: string; editPost?: string }>
}) {
  const sp = await searchParams
  if (!(await isAdmin())) return <LoginPage error={sp.error} />

  const supabase = await createClient()
  const { data: categories } = await supabase.from('categories').select('id,name').order('sort_order')

  // スレッド一覧
  const { data: threads } = await supabase
    .from('threads')
    .select('id, title, body, post_count, is_archived, category_id, categories(name)')
    .order('created_at', { ascending: false })
    .limit(60)

  // 特定スレのレス
  let posts = null
  let selectedThread = null
  if (sp.thread) {
    const threadId = parseInt(sp.thread)
    const [{ data: t }, { data: p }] = await Promise.all([
      supabase.from('threads').select('id, title').eq('id', threadId).single(),
      supabase.from('posts').select('id, post_number, author_name, body')
        .eq('thread_id', threadId).order('post_number', { ascending: true }),
    ])
    selectedThread = t
    posts = p
  }

  // 編集対象スレ
  const editThreadId = sp.editThread ? parseInt(sp.editThread) : null
  const editThread = editThreadId ? threads?.find(t => t.id === editThreadId) : null

  // 編集対象レス
  const editPostId = sp.editPost ? parseInt(sp.editPost) : null
  const editPost = posts?.find(p => p.id === editPostId)

  async function logout() {
    'use server'
    const cookieStore = await cookies()
    cookieStore.delete(ADMIN_COOKIE)
    redirect('/admin')
  }

  return (
    <div className="max-w-screen-xl mx-auto px-3 py-4 text-sm">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">🛠 管理画面</h1>
        <div className="flex gap-3">
          <a href="/" className="text-xs text-blue-600 hover:underline">サイトに戻る</a>
          <form action={logout}>
            <button type="submit" className="text-xs text-gray-500 hover:underline">ログアウト</button>
          </form>
        </div>
      </div>

      {/* スレッド編集モーダル */}
      {editThread && (
        <div className="mb-4 border-2 border-blue-400 bg-blue-50 p-4">
          <h2 className="font-bold text-blue-800 mb-3">✏️ スレッド編集</h2>
          <form action={adminUpdateThread} className="space-y-2">
            <input type="hidden" name="threadId" value={editThread.id} />
            <div>
              <label className="text-xs text-gray-600 block mb-0.5">タイトル</label>
              <input type="text" name="title" defaultValue={editThread.title}
                className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400" required />
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-0.5">本文</label>
              <textarea name="body" rows={5} defaultValue={editThread.body}
                className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400 resize-y" />
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-0.5">カテゴリ</label>
              <select name="category_id" defaultValue={editThread.category_id ?? ''}
                className="border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400">
                <option value="">未分類</option>
                {categories?.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" className="px-4 py-1.5 text-white text-xs font-medium" style={{ background: '#0d6efd' }}>
                保存
              </button>
              <a href="/admin" className="px-4 py-1.5 text-xs border border-gray-300 text-gray-600">
                キャンセル
              </a>
            </div>
          </form>
        </div>
      )}

      {/* レス編集モーダル */}
      {editPost && sp.thread && (
        <div className="mb-4 border-2 border-green-400 bg-green-50 p-4">
          <h2 className="font-bold text-green-800 mb-3">✏️ レス編集（#{editPost.post_number + 1} {editPost.author_name}）</h2>
          <form action={adminUpdatePost} className="space-y-2">
            <input type="hidden" name="postId" value={editPost.id} />
            <input type="hidden" name="threadId" value={sp.thread} />
            <textarea name="body" rows={4} defaultValue={editPost.body}
              className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-green-400 resize-y" required />
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-1.5 text-white text-xs font-medium" style={{ background: '#28a745' }}>
                保存
              </button>
              <a href={`/admin?thread=${sp.thread}`} className="px-4 py-1.5 text-xs border border-gray-300 text-gray-600">
                キャンセル
              </a>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* スレッド一覧 */}
        <div>
          <h2 className="font-bold text-gray-700 mb-2 pb-1 border-b border-gray-200">
            📋 スレッド一覧（最新60件）
          </h2>
          <div className="space-y-1">
            {threads?.map(t => (
              <div key={t.id} className="bg-white border border-gray-200 p-2">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <a href={`/thread/${t.id}`} target="_blank" className="text-blue-600 hover:underline line-clamp-1 text-xs">
                      {t.title}
                    </a>
                    <div className="text-gray-400 text-[10px] mt-0.5">
                      {(t.categories as unknown as { name: string } | null)?.name ?? '未分類'} ／ 💬{t.post_count}
                      {t.is_archived && ' ／ 📂過去ログ'}
                    </div>
                  </div>
                  {/* ボタン群 */}
                  <div className="flex flex-wrap gap-1 shrink-0">
                    <a href={`/admin?thread=${t.id}`}
                      className="px-2 py-0.5 text-[10px] text-blue-600 border border-blue-300 hover:bg-blue-50">
                      レス
                    </a>
                    <a href={`/admin?editThread=${t.id}`}
                      className="px-2 py-0.5 text-[10px] text-green-700 border border-green-400 hover:bg-green-50">
                      編集
                    </a>
                    <form action={adminToggleArchive} className="inline">
                      <input type="hidden" name="threadId" value={t.id} />
                      <input type="hidden" name="isArchived" value={String(t.is_archived)} />
                      <button type="submit" className="px-2 py-0.5 text-[10px] border"
                        style={t.is_archived
                          ? { color: '#155724', borderColor: '#28a745' }
                          : { color: '#856404', borderColor: '#ffc107' }}>
                        {t.is_archived ? '復活' : '過去ログ'}
                      </button>
                    </form>
                    <form action={adminDeleteThread} className="inline">
                      <input type="hidden" name="threadId" value={t.id} />
                      <button type="submit" className="px-2 py-0.5 text-[10px] text-white" style={{ background: '#dc3545' }}>
                        削除
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* レス一覧 */}
        {selectedThread && (
          <div>
            <h2 className="font-bold text-gray-700 mb-2 pb-1 border-b border-gray-200">
              💬 「{selectedThread.title}」
            </h2>
            <div className="space-y-1">
              {posts?.map(p => (
                <div key={p.id} className="bg-white border border-gray-200 p-2">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="font-bold text-[10px] text-gray-500">#{p.post_number + 1} {p.author_name}</span>
                      <p className="text-xs text-gray-700 mt-0.5 line-clamp-2 break-all">{p.body}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <a href={`/admin?thread=${selectedThread.id}&editPost=${p.id}`}
                        className="px-2 py-0.5 text-[10px] text-green-700 border border-green-400 hover:bg-green-50">
                        編集
                      </a>
                      <form action={adminDeletePost} className="inline">
                        <input type="hidden" name="postId" value={p.id} />
                        <input type="hidden" name="threadId" value={selectedThread.id} />
                        <button type="submit" className="px-2 py-0.5 text-[10px] text-white" style={{ background: '#dc3545' }}>
                          削除
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
