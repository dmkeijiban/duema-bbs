import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import {
  adminDeleteThread, adminDeletePost,
  adminUpdateThread, adminUpdatePost,
  adminBanSession,
  adminToggleArchive,
  adminBanIpHash,
  adminHidePostsByIpHash,
  adminHidePostsBySession,
  adminToggleAutoLockExempt,
  adminToggleThreadCommentLock,
} from './actions'
import { verifyAdminCookie } from '@/lib/admin-auth'
import { AdminSubmitButton } from './AdminSubmitButton'
import { AdminScrollManager } from './AdminScrollManager'
import { AdminLoginView } from './AdminLoginView'
import { PersistentDetails } from './PersistentDetails'

const ADMIN_COOKIE = 'admin_auth'
const THREADS_PER_PAGE = 30

const ADMIN_PARENT_MENU_CLASS =
  'group min-w-0 rounded-lg border border-gray-200 bg-white p-3 transition hover:border-blue-300 hover:bg-blue-50/40'

type SortKey = 'last_posted_at' | 'created_at' | 'post_count' | 'view_count'
type SortOrder = 'asc' | 'desc'

function normalizeSort(v: string | undefined): SortKey {
  if (v === 'post_count' || v === 'view_count' || v === 'created_at' || v === 'last_posted_at') return v
  return 'last_posted_at'
}
function normalizeOrder(v: string | undefined): SortOrder {
  return v === 'asc' ? 'asc' : 'desc'
}
function adminThreadsUrl({ page, q, sort, order }: { page?: number; q: string; sort: SortKey; order: SortOrder }) {
  const p = new URLSearchParams()
  if (q) p.set('q', q)
  if (page && page > 1) p.set('threadPage', String(page))
  if (sort !== 'last_posted_at' || order !== 'desc') { p.set('sort', sort); p.set('order', order) }
  return `/admin${p.toString() ? '?' + p.toString() : ''}`
}

type AdminPostRow = {
  id: number
  post_number: number
  author_name: string
  body: string
  session_id: string | null
  user_id?: string | null
  ip_hash?: string | null
}

type SelectedThreadRow = {
  id: number
  title: string
  is_archived?: boolean
  comment_locked?: boolean
  auto_lock_exempt?: boolean
  archived_at?: string | null
}

type AdminThreadRow = {
  id: number
  title: string
  body: string
  post_count: number
  view_count?: number
  is_archived: boolean
  comment_locked?: boolean
  auto_lock_exempt?: boolean
  archived_at?: string | null
  category_id: number | null
  session_id: string | null
  user_id?: string | null
  created_at?: string
  last_posted_at?: string | null
  categories: { name: string }[] | { name: string } | null
}

async function isAdmin() {
  const cookieStore = await cookies()
  return verifyAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value)
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    thread?: string
    error?: string
    editThread?: string
    editPost?: string
    threadPage?: string
    ban?: string
    adminError?: string
    q?: string
    sort?: string
    order?: string
    hidden?: string
    unhidden?: string
  }>
}) {
  const sp = await searchParams
  if (!(await isAdmin())) return <AdminLoginView error={sp.error} />

  const supabase = await createClient()
  const adminSupabase = createAdminClient()
  const { data: categories } = await supabase.from('categories').select('id,name').order('sort_order')

  // スレッド検索
  const searchQ = (sp.q ?? '').trim()
  const isSearching = searchQ.length > 0
  const sort = normalizeSort(sp.sort)
  const order = normalizeOrder(sp.order)

  const threadPage = isSearching ? 1 : Math.max(1, parseInt(sp.threadPage ?? '1') || 1)
  const threadOffset = (threadPage - 1) * THREADS_PER_PAGE

  let threadsQuery = supabase
    .from('threads')
    .select('id, title, body, post_count, view_count, is_archived, comment_locked, auto_lock_exempt, archived_at, category_id, session_id, user_id, created_at, last_posted_at, categories(name)', { count: 'exact' })
    .order(sort, { ascending: order === 'asc', nullsFirst: false })

  if (sort !== 'created_at') {
    threadsQuery = threadsQuery.order('created_at', { ascending: false })
  }

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

  const threadQueryResult = await threadsQuery
  let threads = threadQueryResult.data as AdminThreadRow[] | null
  let threadCount = threadQueryResult.count
  const threadsError = threadQueryResult.error

  if (threadsError && (threadsError.code === '42703' || threadsError.message?.includes('comment_locked') || threadsError.message?.includes('auto_lock_exempt') || threadsError.message?.includes('archived_at'))) {
    let fallbackThreadsQuery = supabase
      .from('threads')
      .select('id, title, body, post_count, view_count, is_archived, category_id, session_id, user_id, created_at, last_posted_at, categories(name)', { count: 'exact' })
      .order(sort, { ascending: order === 'asc', nullsFirst: false })

    if (sort !== 'created_at') {
      fallbackThreadsQuery = fallbackThreadsQuery.order('created_at', { ascending: false })
    }

    if (isSearching) {
      const numericId = parseInt(searchQ)
      if (!isNaN(numericId) && String(numericId) === searchQ) {
        fallbackThreadsQuery = fallbackThreadsQuery.eq('id', numericId)
      } else {
        fallbackThreadsQuery = fallbackThreadsQuery.ilike('title', `%${searchQ}%`)
      }
      fallbackThreadsQuery = fallbackThreadsQuery.limit(50)
    } else {
      fallbackThreadsQuery = fallbackThreadsQuery.range(threadOffset, threadOffset + THREADS_PER_PAGE - 1)
    }

    const retry = await fallbackThreadsQuery
    threads = retry.data as AdminThreadRow[] | null
    threadCount = retry.count
  }

  const threadTotalPages = isSearching ? 1 : Math.max(1, Math.ceil((threadCount ?? 0) / THREADS_PER_PAGE))

  const threadPageList: (number | '...')[] = []
  for (let i = 1; i <= threadTotalPages; i++) {
    if (i === 1 || i === threadTotalPages || Math.abs(i - threadPage) <= 2) {
      threadPageList.push(i)
    } else if (threadPageList[threadPageList.length - 1] !== '...') {
      threadPageList.push('...')
    }
  }


  // 特定スレのレス / 詳細パネル
  let posts: AdminPostRow[] | null = null
  let selectedThread: SelectedThreadRow | null = null
  const activeThreadIdParam = sp.thread ?? sp.editThread
  if (activeThreadIdParam) {
    const threadId = parseInt(activeThreadIdParam)
    let selectedThreadResult = await supabase.from('threads').select('id, title, is_archived, comment_locked, auto_lock_exempt, archived_at').eq('id', threadId).single()
    if (selectedThreadResult.error && (selectedThreadResult.error.code === '42703' || selectedThreadResult.error.message?.includes('comment_locked') || selectedThreadResult.error.message?.includes('auto_lock_exempt') || selectedThreadResult.error.message?.includes('archived_at'))) {
      selectedThreadResult = await supabase.from('threads').select('id, title, is_archived').eq('id', threadId).single()
    }

    const postsWithIp = await supabase.from('posts').select('id, post_number, author_name, body, session_id, user_id, ip_hash')
      .eq('thread_id', threadId)
      .eq('is_deleted', false)
      .order('post_number', { ascending: true })
    let postsData = postsWithIp.data as AdminPostRow[] | null
    let postsError = postsWithIp.error

    if (postsError && (postsError.code === '42703' || postsError.message?.includes('ip_hash'))) {
      const postsWithoutIp = await supabase.from('posts').select('id, post_number, author_name, body, session_id, user_id')
        .eq('thread_id', threadId)
        .eq('is_deleted', false)
        .order('post_number', { ascending: true })
      postsData = postsWithoutIp.data as AdminPostRow[] | null
      postsError = postsWithoutIp.error
    }

    selectedThread = selectedThreadResult.data as SelectedThreadRow | null
    posts = postsError ? [] : (postsData ?? [])
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


  return (
    <div className="mx-auto w-full max-w-screen-xl min-w-0 overflow-x-hidden px-2 py-4 text-sm sm:px-3">
      <AdminScrollManager />

      {/* ヘッダー */}
      <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-gray-800">🛠 管理画面</h1>
        <div className="flex flex-wrap gap-3">
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
          session_id / user_id がないためBANできませんでした。
        </div>
      )}
      {sp.hidden === '1' && (
        <div className="mb-3 border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
          スレッドを非公開にしました。一般公開ページには表示されません。
        </div>
      )}
      {sp.unhidden === '1' && (
        <div className="mb-3 border border-green-300 bg-green-50 px-3 py-2 text-xs text-green-800">
          スレッドを再公開しました。
        </div>
      )}
      {sp.error && (
        <div className="mb-4 border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
          {sp.error}
        </div>
      )}

      {/* ─── 管理メニュー（折り畳み・開閉状態はlocalStorageに保存） ─── */}
      <PersistentDetails storageKey="admin-menu" defaultOpen className="mb-4 min-w-0 overflow-hidden rounded border border-gray-200 bg-white">
        <summary className="flex cursor-pointer select-none items-center gap-2 px-3 py-2 font-bold text-gray-700 hover:bg-gray-50">
          <span className="text-gray-400 text-xs">▶</span>
          <span>管理メニュー</span>
        </summary>
        <div className="min-w-0 border-t border-gray-100 px-3 py-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">主要操作</p>
          <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['/admin/x', '🐦 X運用', '投稿、予約、話題URLを管理'],
              ['/admin/site', '🗂 サイト管理', 'カテゴリ、固定ページ、SEOなどを管理'],
              ['/admin/content-tools', '📝 コンテンツ作成・取り込み', 'スレ作成、記事・コメントの取り込み'],
              ['/admin/zukan', '🃏 図鑑管理', '図鑑記事と自動生成を管理'],
              ['/admin/users', '👤 ユーザー管理', '登録ユーザーとプロフィールを確認'],
              ['/admin/moderation', '🚨 運営・モデレーション', '通報、停止、削除済みデータを管理'],
              ['/admin/analytics', '📊 分析ダッシュボード', 'アクセス、企画、キャンペーンを分析'],
            ].map(([href, title, description]) => (
              <Link key={href} href={href} className={ADMIN_PARENT_MENU_CLASS}>
                <span className="block text-sm font-bold text-gray-800 group-hover:text-blue-700">{title}</span>
                <span className="mt-1 block text-[11px] leading-relaxed text-gray-500">{description}</span>
              </Link>
            ))}
          </div>
        </div>
      </PersistentDetails>

      {editPost && sp.thread && (
        <div className="mb-4 border-2 border-green-400 bg-green-50 p-4 rounded">
          <h2 className="font-bold text-green-800 mb-3">✏️ レス編集（#{editPost.post_number + 1} {editPost.author_name}）</h2>
          <form action={adminUpdatePost} className="space-y-2" data-admin-scroll="preserve">
            <input type="hidden" name="postId" value={editPost.id} />
            <input type="hidden" name="threadId" value={sp.thread} />
            <input type="hidden" name="threadPage" value={threadPage} />
            <textarea name="body" rows={4} defaultValue={editPost.body}
              className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-green-400 resize-y" required />
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-1.5 text-white text-xs font-medium rounded" style={{ background: '#28a745' }}>保存</button>
              <a href={`/admin?thread=${sp.thread}${threadPage > 1 ? `&threadPage=${threadPage}` : ''}`} data-admin-scroll="preserve" className="px-4 py-1.5 text-xs border border-gray-300 text-gray-600 rounded">キャンセル</a>
            </div>
          </form>
        </div>
      )}

      {/* ─── スレッド管理 ─── */}
      <div className={selectedThread ? 'grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,0.9fr)]' : 'grid min-w-0 grid-cols-1 gap-4'}>

        <div className="min-w-0">
          <div data-admin-thread-list-start className="mb-2 flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-1 scroll-mt-3">
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
          <form method="GET" action="/admin" className="mb-3 flex gap-2" data-admin-scroll="thread-list">
            <input
              type="text"
              name="q"
              defaultValue={searchQ}
              placeholder="スレッドIDまたはタイトルで検索..."
              className="flex-1 border border-gray-300 px-2.5 py-1.5 text-xs rounded focus:outline-none focus:border-blue-400"
            />
            <input type="hidden" name="sort" value={sort} />
            <input type="hidden" name="order" value={order} />
            <button type="submit" className="px-3 py-1.5 text-xs text-white rounded" style={{ background: '#0d6efd' }}>
              検索
            </button>
            {isSearching && (
              <a href={adminThreadsUrl({ q: '', sort, order })} data-admin-scroll="thread-list" className="px-3 py-1.5 text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 rounded">
                クリア
              </a>
            )}
          </form>

          {/* ソートボタン */}
          <div className="mb-2 flex flex-wrap gap-1.5">
            {(['last_posted_at', 'created_at', 'post_count', 'view_count'] as SortKey[]).map(key => {
              const labels: Record<SortKey, string> = { last_posted_at: '更新順', created_at: '日付順', post_count: 'コメント順', view_count: '閲覧数順' }
              const nextOrder: SortOrder = sort === key && order === 'desc' ? 'asc' : 'desc'
              return (
                <a key={key} href={adminThreadsUrl({ q: searchQ, sort: key, order: nextOrder })} data-admin-scroll="thread-list"
                  className="rounded border px-2.5 py-1 text-xs"
                  style={sort === key ? { borderColor: '#0d6efd', color: '#0d6efd', background: '#eff6ff' } : { borderColor: '#d1d5db', color: '#4b5563', background: '#fff' }}>
                  {labels[key]}{sort === key ? (order === 'desc' ? ' ↓' : ' ↑') : ''}
                </a>
              )
            })}
            {/*
                <div className="text-gray-400 text-[10px] mb-1">
                  💬{t.post_count}{t.is_archived && ' 📂'}{t.comment_locked && ' 🔒'}
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
                  <form action={adminToggleThreadCommentLock} className="inline-flex">
                    <input type="hidden" name="threadId" value={t.id} />
                    <input type="hidden" name="commentLocked" value={String(Boolean(t.comment_locked))} />
                    <button type="submit" className="px-1.5 py-0.5 text-[10px] text-orange-700 border border-orange-400 hover:bg-orange-50 leading-none">
                      {t.comment_locked ? '解除' : 'ロック'}
                    </button>
                  </form>
                  <form action={adminDeleteThread} className="inline-flex">
                    <input type="hidden" name="threadId" value={t.id} />
                    <button type="submit" className="px-1.5 py-0.5 text-[10px] text-white hover:opacity-75 transition-opacity leading-none" style={{ background: '#dc3545' }}>
                      削除
                    </button>
                  </form>
                </div>
              </div>
            ))}
            */}
          </div>

          {/* スレッド一覧テーブル */}
          <div className="max-w-full overflow-x-auto rounded border border-gray-200 bg-white">
            {(!threads || threads.length === 0) ? (
              <p className="px-4 py-8 text-center text-xs text-gray-400">
                {isSearching ? '該当するスレッドがありません' : 'スレッドがありません'}
              </p>
            ) : (
              <table className="w-full table-fixed text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-[11px]">
                    <th className="px-2 py-2.5 text-left whitespace-nowrap font-semibold w-12">ID</th>
                    <th className="px-2 py-2.5 text-left font-semibold w-56 md:w-72">タイトル</th>
                    <th className="px-2 py-2.5 text-left whitespace-nowrap font-semibold hidden sm:table-cell w-24">カテゴリ</th>
                    <th className="px-2 py-2.5 text-right whitespace-nowrap font-semibold w-20">コメント数</th>
                    <th className="px-2 py-2.5 text-right whitespace-nowrap font-semibold w-20">閲覧数</th>
                    <th className="px-2 py-2.5 text-right whitespace-nowrap font-semibold hidden md:table-cell w-24">更新日</th>
                    <th className="px-2 py-2.5 text-right whitespace-nowrap font-semibold w-36">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {threads?.map(t => {
                    const cat = (t as typeof t & { categories?: { name: string } | null }).categories
                    const createdAt = (t as typeof t & { created_at?: string }).created_at
                    const lastPostedAt = (t as typeof t & { last_posted_at?: string | null }).last_posted_at
                    const isSelectedThread = selectedThread?.id === t.id || editThread?.id === t.id
                    const isPastLog = t.is_archived || Boolean(t.archived_at)
                    const toDateStr = (iso: string | null | undefined) =>
                      iso ? new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'
                    const dateStr = toDateStr(lastPostedAt ?? createdAt)
                    return (
                      <tr key={t.id} className={isSelectedThread ? 'bg-blue-50 ring-1 ring-inset ring-blue-200 hover:bg-blue-50' : 'hover:bg-gray-50'}>
                        <td className="px-2 py-2.5 font-mono text-[10px] text-gray-400 whitespace-nowrap w-12">{t.id}</td>
                        <td className="px-2 py-2.5 overflow-hidden">
                          <a
                            href={isPastLog ? `/admin?thread=${t.id}${searchQ ? `&q=${encodeURIComponent(searchQ)}` : ''}` : `/thread/${t.id}`}
                            target={isPastLog ? undefined : '_blank'}
                            className={`${isPastLog ? 'text-gray-500' : 'text-blue-600'} hover:underline line-clamp-2 block text-xs leading-snug`}
                          >
                            {isPastLog && (
                              <span className="mr-1 inline-flex rounded border border-yellow-300 bg-yellow-50 px-1.5 py-0.5 align-middle text-[10px] font-bold leading-none text-yellow-700">
                                過去ログ
                              </span>
                            )}
                            {t.auto_lock_exempt && (
                              <span className="mr-1 inline-flex rounded border border-sky-300 bg-sky-50 px-1.5 py-0.5 align-middle text-[10px] font-bold leading-none text-sky-700">
                                自動除外
                              </span>
                            )}
                            {t.title}
                          </a>
                        </td>
                        <td className="px-2 py-2.5 w-24 max-w-[6rem] overflow-hidden truncate text-gray-500 hidden sm:table-cell text-xs">
                          {cat?.name ?? <span className="text-gray-300">-</span>}
                        </td>
                        <td className="px-2 py-2.5 w-20 text-right text-gray-600 whitespace-nowrap tabular-nums">{t.post_count}</td>
                        <td className="px-2 py-2.5 w-20 text-right text-blue-700 whitespace-nowrap tabular-nums font-bold">{(t as typeof t & { view_count?: number | null }).view_count ?? 0}</td>
                        <td className="px-2 py-2.5 w-24 text-right text-gray-400 whitespace-nowrap hidden md:table-cell text-[10px]">{dateStr}</td>
                        <td className="px-2 py-2.5 whitespace-nowrap">
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            <a href={`/admin?thread=${t.id}&editThread=${t.id}&threadPage=${threadPage}${searchQ ? `&q=${encodeURIComponent(searchQ)}` : ''}`}
                              data-admin-scroll="preserve"
                              className="px-2 py-1 text-[10px] text-green-700 border border-green-400 hover:bg-green-50 rounded leading-none">
                              編集
                            </a>
                            <form action={adminToggleArchive} className="inline-flex" data-admin-scroll="preserve">
                              <input type="hidden" name="threadId" value={t.id} />
                              <input type="hidden" name="isArchived" value={String(isPastLog)} />
                              <input type="hidden" name="threadPage" value={threadPage} />
                              <input type="hidden" name="q" value={searchQ} />
                              <AdminSubmitButton
                                pendingText={isPastLog ? '公開中...' : '非公開中...'}
                                confirmMessage={isPastLog
                                  ? 'このスレッドを公開に戻しますか？'
                                  : 'このスレッドを非公開にしますか？&#10;通常一覧には表示されなくなります。'}
                                className="px-2 py-1 text-[10px] rounded border transition-colors leading-none disabled:opacity-60 disabled:cursor-wait"
                                style={isPastLog
                                  ? { color: '#047857', borderColor: '#34d399', background: '#ecfdf5' }
                                  : { color: '#a16207', borderColor: '#facc15', background: '#fefce8' }}
                              >
                                {isPastLog ? '公開に戻す' : '非公開'}
                              </AdminSubmitButton>
                            </form>
                            <form action={adminDeleteThread} className="inline-flex" data-admin-scroll="preserve">
                              <input type="hidden" name="threadId" value={t.id} />
                              <input type="hidden" name="threadPage" value={threadPage} />
                              <AdminSubmitButton
                                pendingText="削除中..."
                                confirmMessage="このスレッドを削除しますか？&#10;掲示板上には表示されなくなります。"
                                className="px-2 py-1 text-[10px] text-white rounded hover:opacity-75 transition-opacity leading-none disabled:opacity-60 disabled:cursor-wait"
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
                <a href={adminThreadsUrl({ page: threadPage - 1, q: searchQ, sort, order })} data-admin-scroll="thread-list"
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
                    href={adminThreadsUrl({ page: p as number, q: searchQ, sort, order })}
                    data-admin-scroll="thread-list"
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
                <a href={adminThreadsUrl({ page: threadPage + 1, q: searchQ, sort, order })} data-admin-scroll="thread-list"
                  className="min-w-[1.75rem] h-6 px-1.5 text-[11px] font-medium border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 rounded flex items-center justify-center">
                  »
                </a>
              )}
            </div>
          )}
        </div>

        {/* レス一覧パネル */}
        {selectedThread && (
          <div className="min-w-0">
            <div className="mb-2 rounded border border-gray-200 bg-white p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <h2 className="min-w-0 font-bold text-gray-700 break-words">
                  🧰 スレッド詳細「{selectedThread.title}」
                  {(selectedThread.is_archived || selectedThread.archived_at) && (
                    <span className="ml-2 rounded border border-yellow-300 bg-yellow-50 px-1.5 py-0.5 text-[10px] text-yellow-700">
                      非公開
                    </span>
                  )}
                  {selectedThread.comment_locked && <span className="ml-2 text-[10px] text-orange-700">コメント停止中</span>}
                  {selectedThread.auto_lock_exempt && <span className="ml-2 text-[10px] text-sky-700">自動ロック除外</span>}
                </h2>
                <div className="flex shrink-0 flex-wrap gap-1 sm:justify-end">
                  <a
                    href={adminThreadsUrl({ page: threadPage, q: searchQ, sort, order })}
                    data-admin-scroll="preserve"
                    className="px-2.5 py-1 text-[11px] text-gray-700 border border-gray-400 bg-white hover:bg-gray-50 rounded"
                  >
                    閉じる
                  </a>
                </div>
              </div>
            </div>

            {editThread && (
              <div className="mb-3 space-y-3">
                <section className="rounded border border-gray-200 bg-white p-3">
                  <h3 className="mb-2 text-xs font-bold text-gray-700">A. スレッド概要</h3>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] text-gray-600">
                    <dt className="text-gray-400">ID</dt>
                    <dd className="font-mono">{editThread.id}</dd>
                    <dt className="text-gray-400">カテゴリ</dt>
                    <dd>{Array.isArray(editThread.categories) ? editThread.categories[0]?.name ?? '-' : editThread.categories?.name ?? '-'}</dd>
                    <dt className="text-gray-400">コメント数</dt>
                    <dd>{editThread.post_count}</dd>
                    <dt className="text-gray-400">閲覧数</dt>
                    <dd>{editThread.view_count ?? 0}</dd>
                    <dt className="text-gray-400">作成日時</dt>
                    <dd>{editThread.created_at ? new Date(editThread.created_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '-'}</dd>
                    <dt className="text-gray-400">更新日時</dt>
                    <dd>{editThread.last_posted_at ? new Date(editThread.last_posted_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '-'}</dd>
                    <dt className="text-gray-400">公開状態</dt>
                    <dd>{editThread.is_archived || editThread.archived_at ? '非公開' : '公開中'}</dd>
                    <dt className="text-gray-400">自動除外</dt>
                    <dd>{editThread.auto_lock_exempt ? 'ON' : 'OFF'}</dd>
                    <dt className="text-gray-400">過去ログ状態</dt>
                    <dd>{editThread.is_archived || editThread.archived_at ? '対象' : '通常'}</dd>
                  </dl>
                </section>

                <section className="rounded border border-blue-200 bg-blue-50 p-3">
                  <h3 className="mb-2 text-xs font-bold text-blue-800">B. 基本編集</h3>
                  <form action={adminUpdateThread} className="space-y-2" data-admin-scroll="preserve">
                    <input type="hidden" name="threadId" value={editThread.id} />
                    <input type="hidden" name="threadPage" value={threadPage} />
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
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button type="submit" className="px-4 py-1.5 text-white text-xs font-medium rounded" style={{ background: '#0d6efd' }}>保存</button>
                      <Link href={adminThreadsUrl({ page: threadPage, q: searchQ, sort, order })} scroll={false} data-admin-scroll="preserve" className="px-4 py-1.5 text-xs border border-gray-300 text-gray-600 rounded">キャンセル</Link>
                    </div>
                  </form>
                </section>

                <section className="rounded border border-gray-200 bg-white p-3">
                  <h3 className="mb-2 text-xs font-bold text-gray-700">C. 状態変更</h3>
                  <div className="flex flex-wrap gap-1.5">
                    <form action={adminToggleArchive} data-admin-scroll="preserve">
                      <input type="hidden" name="threadId" value={editThread.id} />
                      <input type="hidden" name="isArchived" value={String(Boolean(editThread.is_archived || editThread.archived_at))} />
                      <input type="hidden" name="threadPage" value={threadPage} />
                      <input type="hidden" name="q" value={searchQ} />
                      <AdminSubmitButton
                        pendingText={editThread.is_archived || editThread.archived_at ? '公開中...' : '非公開中...'}
                        confirmMessage={editThread.is_archived || editThread.archived_at
                          ? 'このスレッドを公開に戻しますか？'
                          : 'このスレッドを非公開にしますか？&#10;通常一覧には表示されなくなります。'}
                        className="px-2.5 py-1 text-[11px] rounded border leading-none disabled:opacity-60 disabled:cursor-wait"
                        style={editThread.is_archived || editThread.archived_at
                          ? { color: '#047857', borderColor: '#34d399', background: '#ecfdf5' }
                          : { color: '#a16207', borderColor: '#facc15', background: '#fefce8' }}
                      >
                        {editThread.is_archived || editThread.archived_at ? '公開に戻す' : '非公開'}
                      </AdminSubmitButton>
                    </form>
                    <form action={adminToggleAutoLockExempt} data-admin-scroll="preserve">
                      <input type="hidden" name="threadId" value={editThread.id} />
                      <input type="hidden" name="autoLockExempt" value={String(Boolean(editThread.auto_lock_exempt))} />
                      <input type="hidden" name="returnToThread" value="true" />
                      <input type="hidden" name="threadPage" value={threadPage} />
                      <input type="hidden" name="q" value={searchQ} />
                      <button type="submit" className="px-2.5 py-1 text-[11px] text-sky-700 border border-sky-300 hover:bg-sky-50 rounded">
                        {editThread.auto_lock_exempt ? '自動除外を解除' : '自動除外'}
                      </button>
                    </form>
                    <form action={adminToggleThreadCommentLock} data-admin-scroll="preserve">
                      <input type="hidden" name="threadId" value={editThread.id} />
                      <input type="hidden" name="commentLocked" value={String(Boolean(editThread.comment_locked))} />
                      <input type="hidden" name="returnToThread" value="true" />
                      <input type="hidden" name="threadPage" value={threadPage} />
                      <button type="submit" className="px-2.5 py-1 text-[11px] text-orange-700 border border-orange-400 hover:bg-orange-50 rounded">
                        {editThread.comment_locked ? 'コメント停止を解除' : 'コメント停止'}
                      </button>
                    </form>
                  </div>
                </section>

                <section className="rounded border border-red-200 bg-red-50 p-3">
                  <h3 className="mb-2 text-xs font-bold text-red-800">E. 危険操作</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {(editThread.session_id || (editThread as typeof editThread & { user_id?: string | null }).user_id) && (
                      <form action={adminBanSession} className="inline-flex" data-admin-scroll="preserve">
                        <input type="hidden" name="sessionId" value={editThread.session_id ?? ''} />
                        <input type="hidden" name="userId" value={(editThread as typeof editThread & { user_id?: string | null }).user_id ?? ''} />
                        <input type="hidden" name="reason" value={`thread:${editThread.id}`} />
                        <input type="hidden" name="returnToThread" value={editThread.id} />
                        <input type="hidden" name="threadPage" value={threadPage} />
                        <AdminSubmitButton
                          pendingText="BAN中..."
                          confirmMessage="この投稿者をBANしますか？&#10;今後の投稿が制限されます。"
                          className="px-2.5 py-1 text-[11px] text-white rounded hover:opacity-75 transition-opacity leading-none disabled:opacity-60 disabled:cursor-wait"
                          style={{ background: '#111827' }}
                        >
                          BAN
                        </AdminSubmitButton>
                      </form>
                    )}
                    <form action={adminDeleteThread} className="inline-flex" data-admin-scroll="preserve">
                      <input type="hidden" name="threadId" value={editThread.id} />
                      <input type="hidden" name="threadPage" value={threadPage} />
                      <AdminSubmitButton
                        pendingText="削除中..."
                        confirmMessage="このスレッドを削除しますか？&#10;掲示板上には表示されなくなります。"
                        className="px-2.5 py-1 text-[11px] text-white rounded hover:opacity-75 transition-opacity leading-none disabled:opacity-60 disabled:cursor-wait"
                        style={{ background: '#dc3545' }}
                      >
                        スレッド削除
                      </AdminSubmitButton>
                    </form>
                  </div>
                </section>
              </div>
            )}

            <div className="mb-2 rounded border border-gray-200 bg-white p-3">
              <h3 className="mb-1 text-xs font-bold text-gray-700">D. レス管理</h3>
              <p className="text-[10px] text-gray-500">
                レスごとに同一端末/IPハッシュのBANと一括非表示ができます。本文は上書きせず `is_deleted=true` にします。
              </p>
            </div>
            <div className="max-h-[80vh] space-y-2 overflow-y-auto overflow-x-hidden pr-1">
              {posts?.map(p => (
                <div key={p.id} className="min-w-0 rounded border border-gray-200 bg-white p-3 shadow-sm">
                  <div className="space-y-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-bold text-[11px] text-gray-500">
                        #{p.post_number + 1}{' '}
                        {(p as typeof p & { user_id?: string }).user_id && postAuthorProfiles[(p as typeof p & { user_id?: string }).user_id!] ? (
                          <a href={`/admin/users/${(p as typeof p & { user_id?: string }).user_id}`} className="text-blue-600 hover:underline">
                            {postAuthorProfiles[(p as typeof p & { user_id?: string }).user_id!].display_name}
                          </a>
                        ) : p.author_name}
                        </span>
                      </div>
                    </div>

                    <p className="whitespace-pre-wrap break-words rounded bg-gray-50 px-2.5 py-2 text-xs leading-relaxed text-gray-800">
                      {p.body}
                    </p>

                    {(p.session_id || p.ip_hash) && (
                      <div className="space-y-1 rounded border border-gray-100 bg-gray-50 px-2.5 py-2 text-[10px] text-gray-500">
                        {p.session_id && (
                          <div className="overflow-x-auto whitespace-nowrap font-mono" title={p.session_id}>
                            <span className="font-sans font-semibold text-gray-600">session:</span> {p.session_id}
                          </div>
                        )}
                        {p.ip_hash && (
                          <div className="overflow-x-auto whitespace-nowrap font-mono" title={p.ip_hash}>
                            <span className="font-sans font-semibold text-gray-600">ip:</span> {p.ip_hash}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-1.5 border-t border-gray-100 pt-2">
                      <a href={`/admin?thread=${selectedThread.id}&editThread=${selectedThread.id}&editPost=${p.id}${threadPage > 1 ? `&threadPage=${threadPage}` : ''}`}
                        data-admin-scroll="preserve"
                        className="px-2 py-1 text-[10px] text-green-700 border border-green-400 hover:bg-green-50 rounded leading-none">
                        編集
                      </a>
                      <form action={adminDeletePost} className="inline-flex" data-admin-scroll="preserve">
                        <input type="hidden" name="postId" value={p.id} />
                        <input type="hidden" name="threadId" value={selectedThread.id} />
                        <input type="hidden" name="threadPage" value={threadPage} />
                        <AdminSubmitButton
                          pendingText="削除中..."
                          confirmMessage={"このコメントを削除しますか？&#10;掲示板上には表示されなくなります。"}
                          className="px-2 py-1 text-[10px] text-white rounded hover:opacity-75 transition-opacity leading-none disabled:opacity-60 disabled:cursor-wait"
                          style={{ background: '#dc3545' }}
                        >
                          削除
                        </AdminSubmitButton>
                      </form>
                      {(p.session_id || (p as typeof p & { user_id?: string | null }).user_id) && (
                        <form action={adminBanSession} className="inline-flex" data-admin-scroll="preserve">
                          <input type="hidden" name="sessionId" value={p.session_id ?? ''} />
                          <input type="hidden" name="userId" value={(p as typeof p & { user_id?: string | null }).user_id ?? ''} />
                          <input type="hidden" name="reason" value={`post:${p.id}`} />
                          <input type="hidden" name="returnToThread" value={selectedThread.id} />
                          <input type="hidden" name="threadPage" value={threadPage} />
                          <AdminSubmitButton
                            pendingText="BAN中..."
                            confirmMessage={"この投稿者をBANしますか？&#10;今後の投稿が制限されます。"}
                            className="px-2 py-1 text-[10px] text-white rounded hover:opacity-75 transition-opacity leading-none disabled:opacity-60 disabled:cursor-wait"
                            style={{ background: '#111827' }}
                          >
                            BAN
                          </AdminSubmitButton>
                        </form>
                      )}
                      {p.session_id && (
                        <form action={adminHidePostsBySession} className="inline-flex" data-admin-scroll="preserve">
                          <input type="hidden" name="threadId" value={selectedThread.id} />
                          <input type="hidden" name="sessionId" value={p.session_id} />
                          <input type="hidden" name="threadPage" value={threadPage} />
                          <button type="submit" className="px-2 py-0.5 text-[10px] text-red-700 border border-red-300 hover:bg-red-50">
                            端末一括非表示
                          </button>
                        </form>
                      )}
                      {p.ip_hash && (
                        <form action={adminBanIpHash} className="inline-flex" data-admin-scroll="preserve">
                          <input type="hidden" name="ipHash" value={p.ip_hash} />
                          <input type="hidden" name="reason" value={`post:${p.id}`} />
                          <input type="hidden" name="returnToThread" value={selectedThread.id} />
                          <input type="hidden" name="threadPage" value={threadPage} />
                          <button type="submit" className="px-2 py-0.5 text-[10px] text-white hover:opacity-75 transition-opacity leading-none" style={{ background: '#7f1d1d' }}>
                            IP BAN
                          </button>
                        </form>
                      )}
                      {p.ip_hash && (
                        <form action={adminHidePostsByIpHash} className="inline-flex" data-admin-scroll="preserve">
                          <input type="hidden" name="threadId" value={selectedThread.id} />
                          <input type="hidden" name="ipHash" value={p.ip_hash} />
                          <input type="hidden" name="threadPage" value={threadPage} />
                          <button type="submit" className="px-2 py-0.5 text-[10px] text-red-700 border border-red-300 hover:bg-red-50">
                            IP一括非表示
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
