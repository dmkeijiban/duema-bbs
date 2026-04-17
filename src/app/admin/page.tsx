import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import {
  adminDeleteThread, adminDeletePost,
  adminUpdateThread, adminUpdatePost,
  adminToggleArchive, adminLogin,
  updateSettingAction,
} from './actions'
import { getAllSettings } from '@/lib/settings'
import { Notice } from '@/components/NoticeBlock'

const ADMIN_COOKIE = 'admin_auth'
const THREADS_PER_PAGE = 60

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
  searchParams: Promise<{ thread?: string; error?: string; editThread?: string; editPost?: string; editSetting?: string; threadPage?: string }>
}) {
  const sp = await searchParams
  if (!(await isAdmin())) return <LoginPage error={sp.error} />

  const supabase = await createClient()
  const { data: categories } = await supabase.from('categories').select('id,name').order('sort_order')

  // スレッド一覧（ページネーション）
  const threadPage = Math.max(1, parseInt(sp.threadPage ?? '1') || 1)
  const threadOffset = (threadPage - 1) * THREADS_PER_PAGE

  const { data: threads, count: threadCount } = await supabase
    .from('threads')
    .select('id, title, body, post_count, is_archived, category_id, categories(name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(threadOffset, threadOffset + THREADS_PER_PAGE - 1)

  const threadTotalPages = Math.max(1, Math.ceil((threadCount ?? 0) / THREADS_PER_PAGE))

  // ページ番号リスト生成
  const threadPageList: (number | '...')[] = []
  for (let i = 1; i <= threadTotalPages; i++) {
    if (i === 1 || i === threadTotalPages || Math.abs(i - threadPage) <= 2) {
      threadPageList.push(i)
    } else if (threadPageList[threadPageList.length - 1] !== '...') {
      threadPageList.push('...')
    }
  }

  // お知らせ一覧（is_active問わず全件）
  const { data: notices } = await supabase.from('notices').select('*').order('position').order('sort_order')

  // サイト設定
  const settings = await getAllSettings()
  const SETTING_LABELS: Record<string, string> = {
    thread_rules: 'スレッド内ルール',
    new_thread_rules: '新規スレッド作成ルール',
    home_banner: 'ホーム緑バナー',
    terms: '利用規約',
  }
  const editSetting = sp.editSetting ?? null

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

  const positionLabel: Record<string, string> = { top: 'スレ上', mid: 'タブ下', bot: 'スレ下' }

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

      {/* サイトテキスト設定（編集フォーム） */}
      {editSetting && SETTING_LABELS[editSetting] && (
        <div className="mb-4 border-2 border-purple-400 bg-purple-50 p-4">
          <h2 className="font-bold text-purple-800 mb-3">📝 {SETTING_LABELS[editSetting]} の編集</h2>
          <form action={updateSettingAction} className="space-y-2">
            <input type="hidden" name="key" value={editSetting} />
            <textarea
              name="value"
              rows={editSetting === 'terms' ? 20 : 8}
              defaultValue={settings[editSetting] ?? ''}
              className="w-full border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:border-purple-400 resize-y font-mono"
            />
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-1.5 text-white text-xs font-medium" style={{ background: '#6f42c1' }}>
                保存
              </button>
              <a href="/admin" className="px-4 py-1.5 text-xs border border-gray-300 text-gray-600">
                キャンセル
              </a>
            </div>
          </form>
        </div>
      )}

      {/* ① お知らせ管理 */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2 pb-1 border-b border-gray-200">
          <h2 className="font-bold text-gray-700">📢 お知らせ管理</h2>
          <a href="/" className="px-3 py-1 text-xs text-white font-medium" style={{ background: '#fd7e14' }}>
            ホームで編集
          </a>
        </div>
        {notices && notices.length > 0 ? (
          <div className="space-y-1">
            {(notices as Notice[]).map(n => (
              <div key={n.id} className="bg-white border border-gray-200 p-2 flex items-center gap-2">
                <span className="shrink-0 text-[10px] px-1.5 py-0.5 border border-gray-300 text-gray-600 bg-gray-50">
                  {positionLabel[n.position] ?? n.position}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-gray-800 line-clamp-1">
                    {n.header_text || '（タイトルなし）'}
                  </span>
                  <span className="text-[10px] text-gray-400 ml-1">{n.columns}列 / {n.items?.length ?? 0}件</span>
                </div>
                <span className="px-2 py-0.5 text-[10px] border leading-none"
                  style={n.is_active
                    ? { color: '#155724', borderColor: '#28a745', background: '#d4edda' }
                    : { color: '#6c757d', borderColor: '#6c757d', background: '#f8f9fa' }}>
                  {n.is_active ? '表示中' : '非表示'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 py-2">お知らせはまだありません</p>
        )}
      </div>

      {/* ② サイトテキスト設定 */}
      <div className="mb-4">
        <h2 className="font-bold text-gray-700 mb-2 pb-1 border-b border-gray-200">📝 サイトテキスト設定</h2>
        <div className="space-y-1">
          {Object.entries(SETTING_LABELS).map(([key, label]) => (
            <div key={key} className="bg-white border border-gray-200 p-2 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium text-gray-800">{label}</span>
                <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">{(settings[key] ?? '（未設定）').slice(0, 60)}</p>
              </div>
              <a href={`/admin?editSetting=${key}`}
                className="shrink-0 px-2 py-0.5 text-[10px] text-purple-700 border border-purple-400 hover:bg-purple-50">
                編集
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* ③ スレッド一覧 + レス一覧 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* スレッド一覧（2列グリッド） */}
        <div>
          <div className="flex items-center justify-between mb-2 pb-1 border-b border-gray-200">
            <h2 className="font-bold text-gray-700">
              📋 スレッド一覧
              <span className="text-[10px] text-gray-400 ml-1 font-normal">
                （全{threadCount ?? 0}件 / {threadPage}ページ目）
              </span>
            </h2>
          </div>

          {/* 2列グリッド表示 */}
          <div className="grid grid-cols-2 gap-1">
            {threads?.map(t => (
              <div key={t.id} className="bg-white border border-gray-200 p-1.5">
                <a href={`/thread/${t.id}`} target="_blank" className="text-blue-600 hover:underline line-clamp-1 text-[11px] block mb-0.5">
                  {t.title}
                </a>
                <div className="text-gray-400 text-[10px] mb-1">
                  💬{t.post_count}{t.is_archived && ' 📂'}
                </div>
                <div className="flex gap-1 flex-wrap">
                  <a href={`/admin?thread=${t.id}`}
                    className="px-1.5 py-0.5 text-[10px] text-blue-600 border border-blue-300 hover:bg-blue-50 leading-none">
                    レス
                  </a>
                  <a href={`/admin?editThread=${t.id}&threadPage=${threadPage}`}
                    className="px-1.5 py-0.5 text-[10px] text-green-700 border border-green-400 hover:bg-green-50 leading-none">
                    編集
                  </a>
                  <form action={adminDeleteThread} className="inline-flex">
                    <input type="hidden" name="threadId" value={t.id} />
                    <button type="submit" className="px-1.5 py-0.5 text-[10px] text-white hover:opacity-75 transition-opacity leading-none" style={{ background: '#dc3545' }}>
                      削除
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>

          {/* ページネーション */}
          {threadTotalPages > 1 && (
            <div className="flex items-center gap-1 flex-wrap mt-2">
              {threadPage > 1 && (
                <a href={`/admin?threadPage=${threadPage - 1}`}
                  className="min-w-[1.75rem] h-6 px-1.5 text-[11px] font-medium border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 flex items-center justify-center">
                  «
                </a>
              )}
              {threadPageList.map((p, i) =>
                p === '...' ? (
                  <span key={`e-${i}`} className="px-1 text-gray-400 text-[11px]">…</span>
                ) : (
                  <a
                    key={p}
                    href={`/admin?threadPage=${p}`}
                    className="min-w-[1.75rem] h-6 px-1.5 text-[11px] font-medium border flex items-center justify-center"
                    style={p === threadPage
                      ? { background: '#0d6efd', color: '#fff', borderColor: '#0d6efd' }
                      : { background: '#fff', color: '#0d6efd', borderColor: '#dee2e6' }}
                  >
                    {p}
                  </a>
                )
              )}
              {threadPage < threadTotalPages && (
                <a href={`/admin?threadPage=${threadPage + 1}`}
                  className="min-w-[1.75rem] h-6 px-1.5 text-[11px] font-medium border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 flex items-center justify-center">
                  »
                </a>
              )}
            </div>
          )}
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
                      <form action={adminDeletePost} className="inline-flex">
                        <input type="hidden" name="postId" value={p.id} />
                        <input type="hidden" name="threadId" value={selectedThread.id} />
                        <button type="submit" className="px-2 py-0.5 text-[10px] text-white hover:opacity-75 transition-opacity leading-none" style={{ background: '#dc3545' }}>
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
