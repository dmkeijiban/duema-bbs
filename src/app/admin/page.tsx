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
import { AdminSubmitButton } from './AdminSubmitButton'

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
  searchParams: Promise<{
    thread?: string
    error?: string
    editThread?: string
    editPost?: string
    editSetting?: string
    threadPage?: string
    ban?: string
    adminError?: string
    q?: string
  }>
}) {
  const sp = await searchParams
  if (!(await isAdmin())) return <LoginPage error={sp.error} />

  const supabase = await createClient()
  const adminSupabase = createAdminClient()
  const { data: categories } = await supabase.from('categories').select('id,name').order('sort_order')

  // スレッド検索
  const searchQ = (sp.q ?? '').trim()
  const isSearching = searchQ.length > 0

  const threadPage = isSearching ? 1 : Math.max(1, parseInt(sp.threadPage ?? '1') || 1)
  const threadOffset = (threadPage - 1) * THREADS_PER_PAGE

  let threadsQuery = supabase
    .from('threads')
    .select('id, title, body, post_count, is_archived, category_id, session_id, created_at, categories(name)', { count: 'exact' })
    .eq('is_archived', false)
    .order('created_at', { ascending: false })

  if (isSearching) {
    const numericId = parseInt(searchQ)
    if (!isNaN(numericId) && String(numericId) === searchQ) {
      threadsQuery = threadsQuery.eq('id', numericId)
    } else {
      threadsQuery = threadsQuery.ilike('title', `%${searchQ}%`)
    }
    threadsQuery = threadsQuery.limit(50)
  } else {
    threadsQuery = threadsQuery.range(threadOffset, threadOffset + THREADS_PER_PAGE - 1)
  }

  const { data: threads, count: threadCount } = await threadsQuery

  const threadTotalPages = isSearching ? 1 : Math.max(1, Math.ceil((threadCount ?? 0) / THREADS_PER_PAGE))

  const threadPageList: (number | '...')[] = []
  for (let i = 1; i <= threadTotalPages; i++) {
    if (i === 1 || i === threadTotalPages || Math.abs(i - threadPage) <= 2) {
      threadPageList.push(i)
    } else if (threadPageList[threadPageList.length - 1] !== '...') {
      threadPageList.push('...')
    }
  }

  // お知らせ一覧
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
      supabase.from('posts').select('id, post_number, author_name, body, session_id, user_id')
        .eq('thread_id', threadId).order('post_number', { ascending: true }),
    ])
    selectedThread = t
    posts = p
  }

  // 登録ユーザーのプロフィールをバッチ取得
  const postAuthorProfiles: Record<string, { display_name: string }> = {}
  if (posts) {
    const userIds = [...new Set(posts.map(p => (p as typeof p & { user_id?: string }).user_id).filter(Boolean))] as string[]
    if (userIds.length > 0) {
      const { data: profiles } = await adminSupabase
        .from('profiles')
        .select('id, display_name')
        .in('id', userIds)
      profiles?.forEach(pr => { postAuthorProfiles[pr.id] = { display_name: pr.display_name } })
    }
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

      {/* ステータスメッセージ */}
      {sp.ban === '1' && (
        <div className="mb-3 border border-green-300 bg-green-50 px-3 py-2 text-xs text-green-800">
          BANを登録しました。対象セッションからの新規投稿・レス投稿をブロックします。
        </div>
      )}
      {sp.adminError === 'ban_failed' && (
        <div className="mb-3 border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
          BAN登録に失敗しました。
        </div>
      )}
      {sp.adminError === 'missing_session' && (
        <div className="mb-3 border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
          session_id がないためBANできませんでした。
        </div>
      )}

      {/* ─── 管理メニュー（折り畳み） ─── */}
      <details open className="mb-4 border border-gray-200 bg-white rounded">
        <summary className="flex cursor-pointer select-none items-center gap-2 px-3 py-2 font-bold text-gray-700 hover:bg-gray-50">
          <span className="text-gray-400 text-xs">▶</span>
          <span>管理メニュー</span>
        </summary>
        <div className="border-t border-gray-100 px-3 py-3 space-y-3">

          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">コンテンツ</p>
            <div className="flex flex-wrap gap-1.5">
              <Link href="/admin/categories" className="px-2.5 py-1 text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 rounded">🗂 カテゴリ</Link>
              <Link href="/admin/pages" className="px-2.5 py-1 text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 rounded">📄 固定ページ</Link>
              <Link href="/admin/notices" className="px-2.5 py-1 text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 rounded">📢 お知らせ</Link>
              <Link href="/admin/summary" className="px-2.5 py-1 text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 rounded">📊 まとめ生成</Link>
              <Link href="/admin/article-drafts" className="px-2.5 py-1 text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 rounded">記事下書き取り込み</Link>
              <Link href="/admin/comment-import" className="px-2.5 py-1 text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 rounded">コメント一括取り込み</Link>
              <Link href="/admin/seo" className="px-2.5 py-1 text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 rounded">🔍 SEO管理</Link>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">X / SNS</p>
            <div className="flex flex-wrap gap-1.5">
              <Link href="/admin/x-posts" className="px-2.5 py-1 text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 rounded">🐦 X投稿管理</Link>
              <Link href="/admin/x-schedule" className="px-2.5 py-1 text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 rounded">📅 スケジュール</Link>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">ユーティリティ</p>
            <div className="flex flex-wrap gap-1.5">
              <Link href="/admin/cleanup" className="px-2.5 py-1 text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 rounded">🧹 データ整理</Link>
              <Link href="/admin/deleted-posts" className="px-2.5 py-1 text-xs border border-orange-300 text-orange-600 hover:bg-orange-50 rounded">🗑️ 削除済みレス</Link>
              <Link href="/admin/revival" className="px-2.5 py-1 text-xs border border-green-400 text-green-700 hover:bg-green-50 rounded">♻️ リバイバル</Link>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">ユーザー・ランキング</p>
            <div className="flex flex-wrap gap-1.5">
              <Link href="/admin/users" className="px-2.5 py-1 text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 rounded">👤 登録ユーザー</Link>
              <Link href="/admin/ranking-preview" className="px-2.5 py-1 text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 rounded">🏆 ランキングプレビュー</Link>
              <Link href="/admin/campaign-ranking" className="px-2.5 py-1 text-xs border border-yellow-300 text-yellow-700 hover:bg-yellow-50 rounded">🎯 キャンペーンランキング</Link>
            </div>
          </div>

        </div>
      </details>

      {/* ─── 編集フォーム（URL パラメータがある場合のみ表示） ─── */}
      {editThread && (
        <div className="mb-4 border-2 border-blue-400 bg-blue-50 p-4 rounded">
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
              <button type="submit" className="px-4 py-1.5 text-white text-xs font-medium rounded" style={{ background: '#0d6efd' }}>保存</button>
              <Link href="/admin" className="px-4 py-1.5 text-xs border border-gray-300 text-gray-600 rounded">キャンセル</Link>
            </div>
          </form>
        </div>
      )}

      {editPost && sp.thread && (
        <div className="mb-4 border-2 border-green-400 bg-green-50 p-4 rounded">
          <h2 className="font-bold text-green-800 mb-3">✏️ レス編集（#{editPost.post_number + 1} {editPost.author_name}）</h2>
          <form action={adminUpdatePost} className="space-y-2">
            <input type="hidden" name="postId" value={editPost.id} />
            <input type="hidden" name="threadId" value={sp.thread} />
            <textarea name="body" rows={4} defaultValue={editPost.body}
              className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-green-400 resize-y" required />
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-1.5 text-white text-xs font-medium rounded" style={{ background: '#28a745' }}>保存</button>
              <a href={`/admin?thread=${sp.thread}`} className="px-4 py-1.5 text-xs border border-gray-300 text-gray-600 rounded">キャンセル</a>
            </div>
          </form>
        </div>
      )}

      {editSetting && SETTING_LABELS[editSetting] && (
        <SettingEditFormClient
          settingKey={editSetting}
          initialValue={settings[editSetting] ?? ''}
          label={SETTING_LABELS[editSetting]}
        />
      )}

      {/* ─── モデレーション（NGワード・BAN）折り畳み ─── */}
      <details className="mb-4 border border-gray-200 bg-white rounded">
        <summary className="flex cursor-pointer select-none items-center gap-2 px-3 py-2 font-bold text-gray-700 hover:bg-gray-50">
          <span className="text-gray-400 text-xs">▶</span>
          <span>🛡️ モデレーション</span>
          <span className="ml-auto flex gap-2 text-[11px] font-normal text-gray-400">
            NGワード {(ngWords as ModerationNgWord[]).length}件 / BAN {(sessionBans as ModerationBan[]).length}件
          </span>
        </summary>
        <div className="border-t border-gray-100 p-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          <section>
            <h3 className="font-bold text-gray-700 mb-2 text-xs">NGワード</h3>
            <form action={adminAddNgWord} className="flex gap-1 mb-2">
              <input name="word" placeholder="禁止したい言葉" className="border border-gray-300 px-2 py-1 text-xs flex-1 rounded" required />
              <input name="note" placeholder="メモ" className="border border-gray-300 px-2 py-1 text-xs w-20 rounded" />
              <button type="submit" className="px-2 py-1 text-xs text-white rounded" style={{ background: '#0d6efd' }}>追加</button>
            </form>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {(ngWords as ModerationNgWord[]).length === 0 ? (
                <p className="text-xs text-gray-400">まだ登録なし</p>
              ) : (
                (ngWords as ModerationNgWord[]).map(word => (
                  <div key={word.id} className="flex items-center gap-2 border border-gray-200 px-2 py-1 rounded">
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold text-red-700">{word.word}</span>
                      {word.note && <span className="text-[10px] text-gray-400 ml-2">{word.note}</span>}
                    </div>
                    <form action={adminDisableNgWord}>
                      <input type="hidden" name="id" value={word.id} />
                      <button type="submit" className="text-[10px] text-gray-500 border border-gray-300 px-1.5 py-0.5 rounded hover:bg-gray-50">無効化</button>
                    </form>
                  </div>
                ))
              )}
            </div>
          </section>

          <section>
            <h3 className="font-bold text-gray-700 mb-2 text-xs">BAN中のセッション</h3>
            <div className="space-y-1 max-h-52 overflow-y-auto">
              {(sessionBans as ModerationBan[]).length === 0 ? (
                <p className="text-xs text-gray-400">BAN中のセッションなし</p>
              ) : (
                (sessionBans as ModerationBan[]).map(ban => (
                  <div key={ban.id} className="flex items-center gap-2 border border-red-100 bg-red-50/40 px-2 py-1 rounded">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-gray-600 break-all font-mono">{ban.ban_value}</p>
                      {ban.reason && <p className="text-[10px] text-gray-400">理由: {ban.reason}</p>}
                    </div>
                    <form action={adminUnbanSession}>
                      <input type="hidden" name="id" value={ban.id} />
                      <button type="submit" className="text-[10px] text-blue-600 border border-blue-300 px-1.5 py-0.5 rounded hover:bg-blue-50">解除</button>
                    </form>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </details>

      {/* ─── お知らせ（折り畳み） ─── */}
      <details className="mb-4 border border-gray-200 bg-white rounded">
        <summary className="flex cursor-pointer select-none items-center gap-2 px-3 py-2 font-bold text-gray-700 hover:bg-gray-50">
          <span className="text-gray-400 text-xs">▶</span>
          <span>📢 お知らせ</span>
          <span className="ml-auto text-[11px] font-normal text-gray-400">{notices?.length ?? 0}件</span>
        </summary>
        <div className="border-t border-gray-100 p-3">
          <div className="flex justify-end mb-2">
            <Link href="/admin/notices" className="px-2.5 py-1 text-xs border border-blue-400 text-blue-600 hover:bg-blue-50 rounded">編集する →</Link>
          </div>
          {notices && notices.length > 0 ? (
            <div className="space-y-1">
              {(notices as Notice[]).map(n => (
                <div key={n.id} className="bg-gray-50 border border-gray-200 p-2 flex items-center gap-2 rounded">
                  <span className="shrink-0 text-[10px] px-1.5 py-0.5 border border-gray-300 text-gray-600 bg-white rounded">
                    {positionLabel[n.position] ?? n.position}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-gray-800 line-clamp-1">
                      {n.header_text || '（タイトルなし）'}
                    </span>
                    <span className="text-[10px] text-gray-400 ml-1">{n.columns}列 / {n.items?.length ?? 0}件</span>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] border rounded leading-none"
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
      </details>

      {/* ─── サイトテキスト設定（折り畳み） ─── */}
      <details className="mb-4 border border-gray-200 bg-white rounded">
        <summary className="flex cursor-pointer select-none items-center gap-2 px-3 py-2 font-bold text-gray-700 hover:bg-gray-50">
          <span className="text-gray-400 text-xs">▶</span>
          <span>📝 サイトテキスト設定</span>
        </summary>
        <div className="border-t border-gray-100 p-3 space-y-3">

          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">ルール・バナー</p>
            <div className="space-y-1">
              {(['thread_rules', 'new_thread_rules', 'home_banner'] as const).map(key => (
                <div key={key} className="bg-gray-50 border border-gray-200 p-2 flex items-center gap-2 rounded">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-gray-800">{SETTING_LABELS[key]}</span>
                    <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">{(settings[key] ?? '（未設定）').slice(0, 60)}</p>
                  </div>
                  <a href={`/admin?editSetting=${key}`}
                    className="shrink-0 px-2 py-0.5 text-[10px] text-purple-700 border border-purple-400 hover:bg-purple-50 rounded">編集</a>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">SNS リンク</p>
            <div className="space-y-1">
              {(['sns_x', 'sns_youtube', 'sns_discord'] as const).map(key => (
                <div key={key} className="bg-gray-50 border border-gray-200 p-2 flex items-center gap-2 rounded">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-gray-800">{SETTING_LABELS[key]}</span>
                    <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">{(settings[key] ?? '（未設定）').slice(0, 80)}</p>
                  </div>
                  <a href={`/admin?editSetting=${key}`}
                    className="shrink-0 px-2 py-0.5 text-[10px] text-purple-700 border border-purple-400 hover:bg-purple-50 rounded">編集</a>
                </div>
              ))}
            </div>
          </div>

        </div>
      </details>

      {/* ─── スレッド管理 ─── */}
      <div className={selectedThread ? 'grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(22rem,1fr)] gap-4' : 'grid grid-cols-1 gap-4'}>

        <div>
          <div className="flex items-center justify-between mb-2 pb-1 border-b border-gray-200">
            <h2 className="font-bold text-gray-700">
              📋 スレッド管理
              {!isSearching && (
                <span className="text-[10px] text-gray-400 ml-1 font-normal">
                  （全{threadCount ?? 0}件 / {threadPage}ページ目）
                </span>
              )}
              {isSearching && (
                <span className="text-[10px] text-gray-400 ml-1 font-normal">
                  「{searchQ}」の検索結果 {threads?.length ?? 0}件
                </span>
              )}
            </h2>
          </div>

          {/* 検索フォーム */}
          <form method="GET" action="/admin" className="mb-3 flex gap-2">
            <input
              type="text"
              name="q"
              defaultValue={searchQ}
              placeholder="スレッドIDまたはタイトルで検索..."
              className="flex-1 border border-gray-300 px-2.5 py-1.5 text-xs rounded focus:outline-none focus:border-blue-400"
            />
            <button type="submit" className="px-3 py-1.5 text-xs text-white rounded" style={{ background: '#0d6efd' }}>
              検索
            </button>
            {isSearching && (
              <a href="/admin" className="px-3 py-1.5 text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 rounded">
                クリア
              </a>
            )}
          </form>

          {/* スレッド一覧テーブル */}
          <div className="overflow-x-auto border border-gray-200 rounded bg-white">
            {(!threads || threads.length === 0) ? (
              <p className="px-4 py-8 text-center text-xs text-gray-400">
                {isSearching ? '該当するスレッドがありません' : 'スレッドがありません'}
              </p>
            ) : (
              <table className="min-w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-[11px]">
                    <th className="px-2 py-2 text-left whitespace-nowrap font-semibold">ID</th>
                    <th className="px-2 py-2 text-left font-semibold">タイトル</th>
                    <th className="px-2 py-2 text-left whitespace-nowrap font-semibold hidden sm:table-cell">カテゴリ</th>
                    <th className="px-2 py-2 text-right whitespace-nowrap font-semibold">💬</th>
                    <th className="px-2 py-2 text-right whitespace-nowrap font-semibold hidden md:table-cell">作成日</th>
                    <th className="px-2 py-2 text-right whitespace-nowrap font-semibold">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {threads?.map(t => {
                    const cat = (t as typeof t & { categories?: { name: string } | null }).categories
                    const createdAt = (t as typeof t & { created_at?: string }).created_at
                    const dateStr = createdAt
                      ? new Date(createdAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                      : '-'
                    return (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-2 py-2 font-mono text-gray-400 whitespace-nowrap">{t.id}</td>
                        <td className="px-2 py-2 max-w-[12rem] md:max-w-xs">
                          <a href={`/thread/${t.id}`} target="_blank" className="text-blue-600 hover:underline line-clamp-2 block text-xs leading-snug">
                            {t.title}
                          </a>
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap text-gray-500 hidden sm:table-cell">
                          {cat?.name ?? <span className="text-gray-300">-</span>}
                        </td>
                        <td className="px-2 py-2 text-right text-gray-600 whitespace-nowrap">{t.post_count}</td>
                        <td className="px-2 py-2 text-right text-gray-400 whitespace-nowrap hidden md:table-cell text-[10px]">{dateStr}</td>
                        <td className="px-2 py-2 whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            {t.session_id && (
                              <form action={adminBanSession} className="inline-flex">
                                <input type="hidden" name="sessionId" value={t.session_id} />
                                <input type="hidden" name="reason" value={`thread:${t.id}`} />
                                <input type="hidden" name="threadPage" value={threadPage} />
                                <AdminSubmitButton
                                  pendingText="BAN中..."
                                  className="px-1.5 py-0.5 text-[10px] text-white rounded hover:opacity-75 transition-opacity leading-none disabled:opacity-60 disabled:cursor-wait"
                                  style={{ background: '#111827' }}
                                >
                                  BAN
                                </AdminSubmitButton>
                              </form>
                            )}
                            <a href={`/admin?thread=${t.id}${searchQ ? `&q=${encodeURIComponent(searchQ)}` : ''}`}
                              className="px-1.5 py-0.5 text-[10px] text-blue-600 border border-blue-300 hover:bg-blue-50 rounded leading-none">
                              レス
                            </a>
                            <a href={`/admin?editThread=${t.id}&threadPage=${threadPage}${searchQ ? `&q=${encodeURIComponent(searchQ)}` : ''}`}
                              className="px-1.5 py-0.5 text-[10px] text-green-700 border border-green-400 hover:bg-green-50 rounded leading-none">
                              編集
                            </a>
                            <form action={adminDeleteThread} className="inline-flex">
                              <input type="hidden" name="threadId" value={t.id} />
                              <input type="hidden" name="threadPage" value={threadPage} />
                              <AdminSubmitButton
                                pendingText="削除中..."
                                className="px-1.5 py-0.5 text-[10px] text-white rounded hover:opacity-75 transition-opacity leading-none disabled:opacity-60 disabled:cursor-wait"
                                style={{ background: '#dc3545' }}
                              >
                                削除
                              </AdminSubmitButton>
                            </form>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* ページネーション（検索中は非表示） */}
          {!isSearching && threadTotalPages > 1 && (
            <div className="flex items-center gap-1 flex-wrap mt-2">
              {threadPage > 1 && (
                <a href={`/admin?threadPage=${threadPage - 1}`}
                  className="min-w-[1.75rem] h-6 px-1.5 text-[11px] font-medium border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 rounded flex items-center justify-center">
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
                    className="min-w-[1.75rem] h-6 px-1.5 text-[11px] font-medium border rounded flex items-center justify-center"
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
                  className="min-w-[1.75rem] h-6 px-1.5 text-[11px] font-medium border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 rounded flex items-center justify-center">
                  »
                </a>
              )}
            </div>
          )}
        </div>

        {/* レス一覧パネル */}
        {selectedThread && (
          <div>
            <h2 className="font-bold text-gray-700 mb-2 pb-1 border-b border-gray-200 text-xs">
              💬 「{selectedThread.title}」のレス
            </h2>
            <div className="space-y-1 max-h-[80vh] overflow-y-auto pr-1">
              {posts?.map(p => (
                <div key={p.id} className="bg-white border border-gray-200 p-2 rounded">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="font-bold text-[10px] text-gray-500">
                        #{p.post_number + 1}{' '}
                        {(p as typeof p & { user_id?: string }).user_id && postAuthorProfiles[(p as typeof p & { user_id?: string }).user_id!] ? (
                          <a href={`/admin/users/${(p as typeof p & { user_id?: string }).user_id}`} className="text-blue-600 hover:underline">
                            {postAuthorProfiles[(p as typeof p & { user_id?: string }).user_id!].display_name}
                          </a>
                        ) : p.author_name}
                      </span>
                      <p className="text-xs text-gray-700 mt-0.5 line-clamp-2 break-all">{p.body}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <a href={`/admin?thread=${selectedThread.id}&editPost=${p.id}`}
                        className="px-2 py-0.5 text-[10px] text-green-700 border border-green-400 hover:bg-green-50 rounded">
                        編集
                      </a>
                      <form action={adminDeletePost} className="inline-flex">
                        <input type="hidden" name="postId" value={p.id} />
                        <input type="hidden" name="threadId" value={selectedThread.id} />
                        <AdminSubmitButton
                          pendingText="削除中..."
                          className="px-2 py-0.5 text-[10px] text-white rounded hover:opacity-75 transition-opacity leading-none disabled:opacity-60 disabled:cursor-wait"
                          style={{ background: '#dc3545' }}
                        >
                          削除
                        </AdminSubmitButton>
                      </form>
                      {p.session_id && (
                        <form action={adminBanSession} className="inline-flex">
                          <input type="hidden" name="sessionId" value={p.session_id} />
                          <input type="hidden" name="reason" value={`post:${p.id}`} />
                          <input type="hidden" name="returnToThread" value={selectedThread.id} />
                          <AdminSubmitButton
                            pendingText="BAN中..."
                            className="px-2 py-0.5 text-[10px] text-white rounded hover:opacity-75 transition-opacity leading-none disabled:opacity-60 disabled:cursor-wait"
                            style={{ background: '#111827' }}
                          >
                            BAN
                          </AdminSubmitButton>
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
