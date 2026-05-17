import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import {
  adminDeleteThread, adminDeletePost,
  adminUpdateThread, adminUpdatePost,
  adminLogin,
  adminAddNgWord, adminDisableNgWord,
  adminBanSession, adminUnbanSession,
} from './actions'
import { SettingEditFormClient } from './SettingEditFormClient'
import { getAllSettings } from '@/lib/settings'
import { Notice } from '@/components/NoticeBlock'
import { verifyAdminCookie } from '@/lib/admin-auth'
import { TypefullyQueueWidget } from './TypefullyQueueWidget'

const ADMIN_COOKIE = 'admin_auth'
const THREADS_PER_PAGE = 60

type ModerationNgWord = {
  id: number
  word: string
  note: string | null
  created_at: string
}

type ModerationBan = {
  id: number
  ban_value: string
  reason: string | null
  created_at: string
  expires_at: string | null
}

async function isAdmin() {
  const cookieStore = await cookies()
  return verifyAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value)
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
  const adminSupabase = createAdminClient()
  const { data: categories } = await supabase.from('categories').select('id,name').order('sort_order')

  // スレッド一覧（ページネーション）
  const threadPage = Math.max(1, parseInt(sp.threadPage ?? '1') || 1)
  const threadOffset = (threadPage - 1) * THREADS_PER_PAGE

  const { data: threads, count: threadCount } = await supabase
    .from('threads')
    .select('id, title, body, post_count, is_archived, category_id, session_id, categories(name)', { count: 'exact' })
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
  const [{ data: ngWords }, { data: sessionBans }] = await Promise.all([
    adminSupabase
      .from('moderation_ng_words')
      .select('id, word, note, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(result => result.error ? { data: [] as ModerationNgWord[] } : result),
    adminSupabase
      .from('moderation_bans')
      .select('id, ban_value, reason, created_at, expires_at')
      .eq('ban_type', 'session')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(result => result.error ? { data: [] as ModerationBan[] } : result),
  ])

  const SETTING_LABELS: Record<string, string> = {
    thread_rules: 'スレッド内ルール',
    new_thread_rules: '新規スレッド作成ルール',
    home_banner: 'ホーム緑バナー',
    sns_x: 'X（Twitter）URL',
    sns_youtube: 'YouTube URL',
    sns_discord: 'Discord URL',
  }
  const editSetting = sp.editSetting ?? null

  // 特定スレのレス
  let posts = null
  let selectedThread = null
  if (sp.thread) {
    const threadId = parseInt(sp.thread)
    const [{ data: t }, { data: p }] = await Promise.all([
      supabase.from('threads').select('id, title').eq('id', threadId).single(),
      supabase.from('posts').select('id, post_number, author_name, body, session_id')
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
          <Link href="/" className="text-xs text-blue-600 hover:underline">サイトに戻る</Link>
          <form action={logout}>
            <button type="submit" className="text-xs text-gray-500 hover:underline">ログアウト</button>
          </form>
        </div>
      </div>

      {/* スレッド編集モーダル */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <section className="border border-gray-300 bg-white p-3">
          <h2 className="font-bold text-gray-800 mb-2">NGワード</h2>
          <form action={adminAddNgWord} className="flex gap-1 mb-2">
            <input name="word" placeholder="禁止したい言葉" className="border border-gray-300 px-2 py-1 text-xs flex-1" required />
            <input name="note" placeholder="メモ" className="border border-gray-300 px-2 py-1 text-xs flex-1" />
            <button type="submit" className="px-2 py-1 text-xs text-white" style={{ background: '#0d6efd' }}>追加</button>
          </form>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {(ngWords as ModerationNgWord[]).length === 0 ? (
              <p className="text-xs text-gray-400">まだ登録なし</p>
            ) : (
              (ngWords as ModerationNgWord[]).map(word => (
                <div key={word.id} className="flex items-center gap-2 border border-gray-200 px-2 py-1">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold text-gray-700">{word.word}</span>
                    {word.note && <span className="text-[10px] text-gray-400 ml-2">{word.note}</span>}
                  </div>
                  <form action={adminDisableNgWord}>
                    <input type="hidden" name="id" value={word.id} />
                    <button type="submit" className="text-[10px] text-red-600 border border-red-300 px-1.5 py-0.5">無効</button>
                  </form>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="border border-gray-300 bg-white p-3">
          <h2 className="font-bold text-gray-800 mb-2">BAN中の投稿者</h2>
          <div className="space-y-1 max-h-44 overflow-y-auto">
            {(sessionBans as ModerationBan[]).length === 0 ? (
              <p className="text-xs text-gray-400">BAN中のセッションなし</p>
            ) : (
              (sessionBans as ModerationBan[]).map(ban => (
                <div key={ban.id} className="flex items-center gap-2 border border-gray-200 px-2 py-1">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-gray-500 break-all">{ban.ban_value}</p>
                    {ban.reason && <p className="text-[10px] text-gray-400">理由: {ban.reason}</p>}
                  </div>
                  <form action={adminUnbanSession}>
                    <input type="hidden" name="id" value={ban.id} />
                    <button type="submit" className="text-[10px] text-blue-600 border border-blue-300 px-1.5 py-0.5">解除</button>
                  </form>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

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
              <Link href="/admin" className="px-4 py-1.5 text-xs border border-gray-300 text-gray-600">
                キャンセル
              </Link>
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
        <SettingEditFormClient
          settingKey={editSetting}
          initialValue={settings[editSetting] ?? ''}
          label={SETTING_LABELS[editSetting]}
        />
      )}

      {/* ② お知らせ管理 */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2 pb-1 border-b border-gray-200">
          <h2 className="font-bold text-gray-700">📢 お知らせ管理</h2>
          <div className="flex gap-2 flex-wrap">
            <Link href="/admin/cleanup" className="px-3 py-1 text-xs border border-gray-400 text-gray-600 hover:bg-gray-50">
              🧹 データ整理
            </Link>
            <Link href="/admin/categories" className="px-3 py-1 text-xs border border-gray-400 text-gray-600 hover:bg-gray-50">
              🗂 カテゴリ管理
            </Link>
            <Link href="/admin/article-drafts" className="px-3 py-1 text-xs border border-gray-400 text-gray-600 hover:bg-gray-50">
              記事下書き取り込み
            </Link>
            <Link href="/admin/summary" className="px-3 py-1 text-xs border border-gray-400 text-gray-600 hover:bg-gray-50">
              📊 まとめ生成
            </Link>
            <Link href="/admin/comment-import" className="px-3 py-1 text-xs border border-gray-400 text-gray-600 hover:bg-gray-50">
              コメント一括取り込み
            </Link>
            <Link href="/admin/x-replies" className="px-3 py-1 text-xs border border-gray-400 text-gray-600 hover:bg-gray-50">
              Xリプライ取得
            </Link>
            <Link href="/admin/deleted-posts" className="px-3 py-1 text-xs border border-orange-400 text-orange-600 hover:bg-orange-50">
              🗑️ 削除済みレス
            </Link>
            <Link href="/admin/x-posts" className="px-3 py-1 text-xs text-white font-medium" style={{ background: '#1da1f2' }}>
              🐦 X投稿管理
            </Link>
            <Link href="/admin/x-schedule" className="px-3 py-1 text-xs text-white font-medium" style={{ background: '#0f766e' }}>
              📅 スケジュール
            </Link>
            <Link href="/admin/pages" className="px-3 py-1 text-xs text-white font-medium" style={{ background: '#198754' }}>
              📄 固定ページ管理
            </Link>
            <Link href="/admin/notices" className="px-3 py-1 text-xs text-white font-medium" style={{ background: '#2563eb' }}>
              お知らせ管理画面へ
            </Link>
          </div>
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

      {/* ② Typefully 予約キュー */}
      <TypefullyQueueWidget />

      {/* ③ サイトテキスト設定 */}
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

      {/* ④ スレッド一覧 + レス一覧 */}
      <div className={selectedThread ? 'grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(22rem,1fr)] gap-4' : 'grid grid-cols-1 gap-4'}>
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
          <div className={selectedThread ? 'grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-1.5' : 'grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-1.5'}>
            {threads?.map(t => (
              <div key={t.id} className="bg-white border border-gray-200 p-1.5">
                <a href={`/thread/${t.id}`} target="_blank" className="text-blue-600 hover:underline line-clamp-1 text-[11px] block mb-0.5">
                  {t.title}
                </a>
                <div className="text-gray-400 text-[10px] mb-1">
                  💬{t.post_count}{t.is_archived && ' 📂'}
                </div>
                <div className="flex gap-1 flex-wrap">
                  {t.session_id && (
                    <form action={adminBanSession} className="inline-flex">
                      <input type="hidden" name="sessionId" value={t.session_id} />
                      <input type="hidden" name="reason" value={`thread:${t.id}`} />
                      <button type="submit" className="px-1.5 py-0.5 text-[10px] text-white hover:opacity-75 transition-opacity leading-none" style={{ background: '#111827' }}>
                        BAN
                      </button>
                    </form>
                  )}
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
                      {p.session_id && (
                        <form action={adminBanSession} className="inline-flex">
                          <input type="hidden" name="sessionId" value={p.session_id} />
                          <input type="hidden" name="reason" value={`post:${p.id}`} />
                          <input type="hidden" name="returnToThread" value={selectedThread.id} />
                          <button type="submit" className="px-2 py-0.5 text-[10px] text-white hover:opacity-75 transition-opacity leading-none" style={{ background: '#111827' }}>
                            BAN
                          </button>
                        </form>
                      )}
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
