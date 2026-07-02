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
  adminToggleArchive,
  adminBanIpHash,
  adminHidePostsByIpHash,
  adminHidePostsBySession,
  adminToggleThreadCommentLock,
} from './actions'
import { SettingEditFormClient } from './SettingEditFormClient'
import { getAllSettings } from '@/lib/settings'
import { Notice } from '@/components/NoticeBlock'
import { verifyAdminCookie } from '@/lib/admin-auth'
import {
  ADMIN_DASHBOARD_CACHE_SECONDS,
  getGa4DashboardData,
  getInternalDashboardData,
  type Ga4PageRow,
  type RecentThreadActivity,
} from '@/lib/admin-dashboard'
import { AdminSubmitButton } from './AdminSubmitButton'
import { AccessTrendCard } from './AccessTrendCard'

const ADMIN_COOKIE = 'admin_auth'
const THREADS_PER_PAGE = 30

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

function normalizeAnalyticsDays(v: string | undefined): 7 | 28 | 90 {
  if (v === '7') return 7
  if (v === '90') return 90
  return 28
}

type ModerationNgWord = {
  id: number
  word: string
  note: string | null
  created_at: string
}

type ModerationBan = {
  id: number
  ban_type?: string
  ban_value: string
  reason: string | null
  created_at: string
  expires_at: string | null
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
}

type AdminThreadRow = {
  id: number
  title: string
  body: string
  post_count: number
  view_count?: number
  is_archived: boolean
  comment_locked?: boolean
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

function formatNumber(value: number) {
  return value.toLocaleString('ja-JP')
}

function formatDateTime(value: string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function MetricCard({ label, value, note }: { label: string; value: number | string; note?: string }) {
  return (
    <div className="rounded border border-gray-200 bg-white px-3 py-3">
      <p className="text-[11px] font-bold text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-gray-900">
        {typeof value === 'number' ? formatNumber(value) : value}
      </p>
      {note && <p className="mt-1 text-[10px] text-gray-400">{note}</p>}
    </div>
  )
}

function RecentRankingCard({
  title,
  rows,
  note,
}: {
  title: string
  rows: RecentThreadActivity[]
  note?: string
}) {
  return (
    <section className="rounded border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-3 py-2">
        <h3 className="text-xs font-bold text-gray-700">{title}</h3>
        {note && <p className="mt-0.5 text-[10px] text-gray-400">{note}</p>}
      </div>
      <ol className="divide-y divide-gray-100">
        {rows.length === 0 ? (
          <li className="px-3 py-4 text-xs text-gray-400">直近24時間のコメント増加はありません。</li>
        ) : rows.map((row, index) => (
          <li key={row.id} className="flex items-start gap-2 px-3 py-2 text-xs">
            <span className="mt-0.5 w-5 shrink-0 text-right tabular-nums text-gray-400">{index + 1}</span>
            <div className="min-w-0 flex-1">
              <Link href={`/thread/${row.id}`} className="line-clamp-2 font-bold text-blue-700 hover:underline">
                {row.title}
              </Link>
              <p className="mt-0.5 text-[10px] text-gray-400">
                最新 {formatDateTime(row.latestCommentAt)} / 累計コメント {formatNumber(row.postCount)}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-bold tabular-nums text-gray-800">{formatNumber(row.recentComments)}</p>
              <p className="text-[10px] text-gray-400">直近コメント</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

function Ga4PageRankingCard({
  title,
  rows,
  note,
}: {
  title: string
  rows: Ga4PageRow[]
  note?: string
}) {
  return (
    <section className="rounded border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-3 py-2">
        <h3 className="text-xs font-bold text-gray-700">{title}</h3>
        {note && <p className="mt-0.5 text-[10px] text-gray-400">{note}</p>}
      </div>
      <ol className="divide-y divide-gray-100">
        {rows.length === 0 ? (
          <li className="px-3 py-4 text-xs text-gray-400">GA4上の対象ページはありません。</li>
        ) : rows.map((row, index) => (
          <li key={`${row.path}-${index}`} className="flex items-start gap-2 px-3 py-2 text-xs">
            <span className="mt-0.5 w-5 shrink-0 text-right tabular-nums text-gray-400">{index + 1}</span>
            <Link href={row.path} className="min-w-0 flex-1 truncate font-bold text-blue-700 hover:underline">
              {row.path}
            </Link>
            <div className="shrink-0 text-right">
              <p className="font-bold tabular-nums text-gray-800">{formatNumber(row.views)}</p>
              <p className="text-[10px] text-gray-400">表示回数</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

function Ga4UnavailableCard({ title, note, message }: { title: string; note: string; message: string }) {
  return (
    <section className="rounded border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-3 py-2">
        <h3 className="text-xs font-bold text-gray-700">{title}</h3>
        <p className="mt-0.5 text-[10px] text-gray-400">{note}</p>
      </div>
      <div className="px-3 py-4 text-xs text-red-700">
        GA4から取得できませんでした: {message}
      </div>
    </section>
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
    sort?: string
    order?: string
    analyticsDays?: string
    hidden?: string
    unhidden?: string
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
  const sort = normalizeSort(sp.sort)
  const order = normalizeOrder(sp.order)
  const analyticsDays = normalizeAnalyticsDays(sp.analyticsDays)

  const threadPage = isSearching ? 1 : Math.max(1, parseInt(sp.threadPage ?? '1') || 1)
  const threadOffset = (threadPage - 1) * THREADS_PER_PAGE

  let threadsQuery = supabase
    .from('threads')
    .select('id, title, body, post_count, view_count, is_archived, comment_locked, category_id, session_id, user_id, created_at, last_posted_at, categories(name)', { count: 'exact' })
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

  if (threadsError && (threadsError.code === '42703' || threadsError.message?.includes('comment_locked'))) {
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

  // お知らせ一覧
  const { data: notices } = await supabase.from('notices').select('*').order('position').order('sort_order')

  const [ga4Dashboard, internalDashboard] = await Promise.all([
    getGa4DashboardData(analyticsDays),
    getInternalDashboardData(adminSupabase),
  ])

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
      .select('id, ban_type, ban_value, reason, created_at, expires_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(async result => {
        if (!result.error) return result
        if (result.error.code === 'PGRST205' || result.error.code === '42P01' || result.error.message?.includes('moderation_bans')) {
          const fallback = await adminSupabase
            .from('report_mutes')
            .select('id, user_id, session_id, reason, created_at, revoked_at')
            .eq('is_active', true)
            .like('reason', 'posting_ban:%')
            .order('created_at', { ascending: false })
            .limit(30)
          if (fallback.error) {
            console.error('[admin] Failed to load posting ban fallback:', {
              code: fallback.error.code,
              message: fallback.error.message,
            })
            return { data: [] as ModerationBan[] }
          }
          return {
            data: (fallback.data ?? []).map(row => ({
              id: row.id,
              ban_type: row.user_id ? 'user' : 'session',
              ban_value: row.user_id ?? row.session_id,
              reason: row.reason?.replace(/^posting_ban:/, '') ?? null,
              created_at: row.created_at,
              expires_at: null,
            })).filter(row => row.ban_value) as ModerationBan[],
          }
        }
        if (result.error.code !== '42703' && !result.error.message?.includes('ban_type') && !result.error.message?.includes('ban_value')) {
          console.error('[admin] Failed to load moderation_bans:', {
            code: result.error.code,
            message: result.error.message,
          })
          return { data: [] as ModerationBan[] }
        }
        const legacy = await adminSupabase
          .from('moderation_bans')
          .select('id, session_id, reason, created_at, expires_at')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(30)
        if (legacy.error) {
          console.error('[admin] Failed to load legacy moderation_bans:', {
            code: legacy.error.code,
            message: legacy.error.message,
          })
          return { data: [] as ModerationBan[] }
        }
        return {
          data: (legacy.data ?? []).map(row => ({
            id: row.id,
            ban_type: 'session',
            ban_value: row.session_id,
            reason: row.reason,
            created_at: row.created_at,
            expires_at: row.expires_at,
          })) as ModerationBan[],
        }
      }),
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
  let posts: AdminPostRow[] | null = null
  let selectedThread: SelectedThreadRow | null = null
  if (sp.thread) {
    const threadId = parseInt(sp.thread)
    let selectedThreadResult = await supabase.from('threads').select('id, title, is_archived, comment_locked').eq('id', threadId).single()
    if (selectedThreadResult.error && (selectedThreadResult.error.code === '42703' || selectedThreadResult.error.message?.includes('comment_locked'))) {
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

      {/* ─── 管理メニュー（折り畳み） ─── */}
      <details open className="mb-4 border border-gray-200 bg-white rounded">
        <summary className="flex cursor-pointer select-none items-center gap-2 px-3 py-2 font-bold text-gray-700 hover:bg-gray-50">
          <span className="text-gray-400 text-xs">▶</span>
          <span>管理メニュー</span>
        </summary>
        <div className="border-t border-gray-100 px-3 py-2 space-y-1.5">

          {/* 各カテゴリ：見出し＋ボタン群を横並び（PC=見出し左・ボタン右で1行寄せ／スマホ=見出し上・ボタン下に折り返し）。
              ボタンは flex-wrap で自然に折り返し、横スクロールは発生させない */}
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 sm:w-32 sm:shrink-0 sm:pt-1.5">コンテンツ</p>
            <div className="flex flex-wrap gap-1.5">
              <Link href="/admin/categories" className="px-2.5 py-1 text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 rounded">🗂 カテゴリ</Link>
              <Link href="/admin/pages" className="px-2.5 py-1 text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 rounded">📄 固定ページ</Link>
              <Link href="/admin/notices" className="px-2.5 py-1 text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 rounded">📢 お知らせ</Link>
              <Link href="/admin/summary" className="px-2.5 py-1 text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 rounded">📊 まとめ生成</Link>
              <Link href="/admin/daily-zukan" className="px-2.5 py-1 text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 rounded">🃏 図鑑カードスレ自動生成</Link>
              <Link href="/admin/article-drafts" className="px-2.5 py-1 text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 rounded">記事下書き取り込み</Link>
              <Link href="/admin/comment-import" className="px-2.5 py-1 text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 rounded">コメント一括取り込み</Link>
              <Link href="/admin/seo" className="px-2.5 py-1 text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 rounded">🔍 SEO管理</Link>
            </div>
          </div>

          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 sm:w-32 sm:shrink-0 sm:pt-1.5">X / SNS</p>
            <div className="flex flex-wrap gap-1.5">
              <Link href="/admin/x-posts" className="px-2.5 py-1 text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 rounded">🐦 X投稿管理</Link>
              <Link href="/admin/x-schedule" className="px-2.5 py-1 text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 rounded">📅 スケジュール</Link>
              <Link href="/admin/x-buzz" className="px-2.5 py-1 text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 rounded">X話題URLストック</Link>
            </div>
          </div>

          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 sm:w-32 sm:shrink-0 sm:pt-1.5">ユーティリティ</p>
            <div className="flex flex-wrap gap-1.5">
              <Link href="/admin/cleanup" className="px-2.5 py-1 text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 rounded">🧹 データ整理</Link>
              <Link href="/admin/deleted-posts" className="px-2.5 py-1 text-xs border border-orange-300 text-orange-600 hover:bg-orange-50 rounded">🗑️ 削除済みレス</Link>
              <Link href="/admin/revival" className="px-2.5 py-1 text-xs border border-green-400 text-green-700 hover:bg-green-50 rounded">♻️ リバイバル</Link>
            </div>
          </div>

          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 sm:w-32 sm:shrink-0 sm:pt-1.5">通報管理</p>
            <div className="flex flex-wrap gap-1.5">
              <Link href="/admin/reports" className="px-2.5 py-1 text-xs border border-orange-300 text-orange-700 hover:bg-orange-50 rounded">🚨 通報管理</Link>
              <Link href="/admin/report-mutes" className="px-2.5 py-1 text-xs border border-orange-300 text-orange-700 hover:bg-orange-50 rounded">🔇 受付停止一覧</Link>
            </div>
          </div>

          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 sm:w-32 sm:shrink-0 sm:pt-1.5">ユーザー・ランキング</p>
            <div className="flex flex-wrap gap-1.5">
              <Link href="/admin/users" className="px-2.5 py-1 text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 rounded">👤 登録ユーザー</Link>
              <Link href="/admin/ranking-preview" className="px-2.5 py-1 text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 rounded">🏆 ランキングプレビュー</Link>
              <Link href="/admin/campaign-ranking" className="px-2.5 py-1 text-xs border border-yellow-300 text-yellow-700 hover:bg-yellow-50 rounded">🎯 キャンペーンランキング</Link>
              <Link href="/admin/duema-stats" className="px-2.5 py-1 text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 rounded">📊 デュエマプロフィール統計</Link>
            </div>
          </div>

        </div>
      </details>

      <section className="mb-4 rounded border border-gray-200 bg-gray-50">
        <div className="border-b border-gray-200 px-3 py-2">
          <h2 className="font-bold text-gray-800">📊 アクセス・人気ダッシュボード</h2>
          <p className="mt-0.5 text-[11px] text-gray-500">
            GA4の表示回数（screenPageViews）と、掲示板内部のスレ閲覧数・コメント数を分けて確認します。
          </p>
        </div>

        <div className="space-y-4 p-3">
          <div>
            {ga4Dashboard.ok && (
              <div className="mb-4">
                <AccessTrendCard
                  days={ga4Dashboard.trendDays}
                  totalViews={ga4Dashboard.trendSummary.totalViews}
                  totalUsers={ga4Dashboard.trendSummary.totalUsers}
                  viewsPerUser={ga4Dashboard.trendSummary.viewsPerUser}
                  points={ga4Dashboard.dailyTrend}
                />
              </div>
            )}

            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-gray-700">サイト全体のアクセス概要</h3>
              <span className="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700">
                GA4 / screenPageViews
              </span>
            </div>
            {ga4Dashboard.ok ? (
              <>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
                  <MetricCard label="今日の表示回数" value={ga4Dashboard.summary.todayViews} />
                  <MetricCard label="昨日の表示回数" value={ga4Dashboard.summary.yesterdayViews} />
                  <MetricCard label="過去7日間の表示回数" value={ga4Dashboard.summary.sevenDayViews} />
                  <MetricCard label="過去28日間の表示回数" value={ga4Dashboard.summary.twentyEightDayViews} />
                  <MetricCard label="今日のユーザー数" value={ga4Dashboard.summary.todayUsers} />
                  <MetricCard label="過去7日間のユーザー数" value={ga4Dashboard.summary.sevenDayUsers} />
                </div>
                <p className="mt-2 text-[10px] text-gray-400">
                  GA4 property: {ga4Dashboard.propertyId} / イベント数はPVとして扱っていません。/ {ADMIN_DASHBOARD_CACHE_SECONDS / 3600}時間キャッシュ
                </p>
              </>
            ) : (
              <div className="rounded border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800">
                <p className="font-bold">GA4 Data API から取得できませんでした。</p>
                <p className="mt-1">{ga4Dashboard.error}</p>
                {ga4Dashboard.missing && ga4Dashboard.missing.length > 0 && (
                  <p className="mt-1">未設定: {ga4Dashboard.missing.join(', ')}</p>
                )}
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-gray-700">掲示板内部の累計指標</h3>
              <span className="rounded border border-gray-200 bg-white px-2 py-0.5 text-[10px] text-gray-500">
                threads.view_count / posts
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <MetricCard label="スレ総閲覧数" value={internalDashboard.totals.totalViews} note="内部累計" />
              <MetricCard label="スレ数" value={internalDashboard.totals.threadCount} />
              <MetricCard label="コメント数" value={internalDashboard.totals.commentCount} />
              <MetricCard label="平均閲覧数" value={internalDashboard.totals.avgViews} note="内部累計 ÷ スレ数" />
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-bold text-gray-700">伸びているコンテンツ</h3>
            <div className="grid gap-3 xl:grid-cols-3">
              {ga4Dashboard.ok ? (
                <Ga4PageRankingCard
                  title="GA4 直近7日のページ"
                  rows={ga4Dashboard.topPages}
                  note="サイト全体で今週よく見られているページ"
                />
              ) : (
                <Ga4UnavailableCard
                  title="GA4 直近7日のページ"
                  note="サイト全体で今週よく見られているページ"
                  message={ga4Dashboard.error}
                />
              )}
              <RecentRankingCard
                title="最近コメントが増えたスレ"
                rows={internalDashboard.recentCommentThreads}
                note="直近24時間のコメント増加"
              />
              {ga4Dashboard.ok ? (
                <Ga4PageRankingCard
                  title="直近24時間で急に伸びたページ"
                  rows={ga4Dashboard.risingPages}
                  note="前日〜今日の表示回数が多いページ"
                />
              ) : (
                <Ga4UnavailableCard
                  title="直近24時間で急に伸びたページ"
                  note="前日〜今日の表示回数が多いページ"
                  message={ga4Dashboard.error}
                />
              )}
            </div>
          </div>
        </div>
      </section>
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
            <h3 className="font-bold text-gray-700 mb-2 text-xs">BAN中の投稿者</h3>
            <div className="space-y-1 max-h-52 overflow-y-auto">
              {(sessionBans as ModerationBan[]).length === 0 ? (
                <p className="text-xs text-gray-400">BAN中の投稿者なし</p>
              ) : (
                (sessionBans as ModerationBan[]).map(ban => (
                  <div key={ban.id} className="flex items-center gap-2 border border-red-100 bg-red-50/40 px-2 py-1 rounded">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-red-700">
                        {ban.ban_type === 'user' ? 'user_id' : 'session_id'}
                      </p>
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
            <input type="hidden" name="sort" value={sort} />
            <input type="hidden" name="order" value={order} />
            <button type="submit" className="px-3 py-1.5 text-xs text-white rounded" style={{ background: '#0d6efd' }}>
              検索
            </button>
            {isSearching && (
              <a href={adminThreadsUrl({ q: '', sort, order })} className="px-3 py-1.5 text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 rounded">
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
                <a key={key} href={adminThreadsUrl({ q: searchQ, sort: key, order: nextOrder })}
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
          <div className="overflow-x-auto border border-gray-200 rounded bg-white">
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
                    <th className="px-2 py-2.5 text-right whitespace-nowrap font-semibold w-44">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {threads?.map(t => {
                    const cat = (t as typeof t & { categories?: { name: string } | null }).categories
                    const createdAt = (t as typeof t & { created_at?: string }).created_at
                    const lastPostedAt = (t as typeof t & { last_posted_at?: string | null }).last_posted_at
                    const toDateStr = (iso: string | null | undefined) =>
                      iso ? new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'
                    const dateStr = toDateStr(lastPostedAt ?? createdAt)
                    return (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-2 py-2.5 font-mono text-[10px] text-gray-400 whitespace-nowrap w-12">{t.id}</td>
                        <td className="px-2 py-2.5 overflow-hidden">
                          <a
                            href={t.is_archived ? `/admin?thread=${t.id}${searchQ ? `&q=${encodeURIComponent(searchQ)}` : ''}` : `/thread/${t.id}`}
                            target={t.is_archived ? undefined : '_blank'}
                            className={`${t.is_archived ? 'text-gray-500' : 'text-blue-600'} hover:underline line-clamp-2 block text-xs leading-snug`}
                          >
                            {t.is_archived && (
                              <span className="mr-1 inline-flex rounded border border-yellow-300 bg-yellow-50 px-1.5 py-0.5 align-middle text-[10px] font-bold leading-none text-yellow-700">
                                非公開
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
                          <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1.5">
                            <a href={`/admin?thread=${t.id}${searchQ ? `&q=${encodeURIComponent(searchQ)}` : ''}`}
                              className="px-2 py-1 text-[10px] text-blue-600 border border-blue-300 hover:bg-blue-50 rounded leading-none">
                              レス
                            </a>
                            <a href={`/admin?editThread=${t.id}&threadPage=${threadPage}${searchQ ? `&q=${encodeURIComponent(searchQ)}` : ''}`}
                              className="px-2 py-1 text-[10px] text-green-700 border border-green-400 hover:bg-green-50 rounded leading-none">
                              編集
                            </a>
                            {(t.session_id || (t as typeof t & { user_id?: string | null }).user_id) && (
                              <form action={adminBanSession} className="inline-flex">
                                <input type="hidden" name="sessionId" value={t.session_id ?? ''} />
                                <input type="hidden" name="userId" value={(t as typeof t & { user_id?: string | null }).user_id ?? ''} />
                                <input type="hidden" name="reason" value={`thread:${t.id}`} />
                                <input type="hidden" name="threadPage" value={threadPage} />
                                <AdminSubmitButton
                                  pendingText="BAN中..."
                                  confirmMessage="この投稿者をBANしますか？&#10;今後の投稿が制限されます。"
                                  className="px-2 py-1 text-[10px] text-white rounded hover:opacity-75 transition-opacity leading-none disabled:opacity-60 disabled:cursor-wait"
                                  style={{ background: '#111827' }}
                                >
                                  BAN
                                </AdminSubmitButton>
                              </form>
                            )}
                            <form action={adminToggleArchive} className="inline-flex">
                              <input type="hidden" name="threadId" value={t.id} />
                              <input type="hidden" name="isArchived" value={String(t.is_archived)} />
                              <input type="hidden" name="threadPage" value={threadPage} />
                              <input type="hidden" name="q" value={searchQ} />
                              <AdminSubmitButton
                                pendingText={t.is_archived ? '再公開中...' : '非公開中...'}
                                confirmMessage={t.is_archived
                                  ? 'このスレッドを再公開しますか？'
                                  : 'このスレッドを非公開にしますか？&#10;一般公開ページには表示されなくなります。'}
                                className="px-2 py-1 text-[10px] rounded border transition-colors leading-none disabled:opacity-60 disabled:cursor-wait"
                                style={t.is_archived
                                  ? { color: '#047857', borderColor: '#34d399', background: '#ecfdf5' }
                                  : { color: '#a16207', borderColor: '#facc15', background: '#fefce8' }}
                              >
                                {t.is_archived ? '再公開' : '非公開'}
                              </AdminSubmitButton>
                            </form>
                            <form action={adminDeleteThread} className="inline-flex">
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
                <a href={adminThreadsUrl({ page: threadPage - 1, q: searchQ, sort, order })}
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
                <a href={adminThreadsUrl({ page: threadPage + 1, q: searchQ, sort, order })}
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
            <div className="mb-2 pb-1 border-b border-gray-200">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-bold text-gray-700">
                  💬 「{selectedThread.title}」
                  {selectedThread.is_archived && (
                    <span className="ml-2 rounded border border-yellow-300 bg-yellow-50 px-1.5 py-0.5 text-[10px] text-yellow-700">
                      非公開
                    </span>
                  )}
                  {selectedThread.comment_locked && <span className="ml-2 text-[10px] text-orange-700">コメント停止中</span>}
                </h2>
                <form action={adminToggleThreadCommentLock}>
                  <input type="hidden" name="threadId" value={selectedThread.id} />
                  <input type="hidden" name="commentLocked" value={String(Boolean(selectedThread.comment_locked))} />
                  <input type="hidden" name="returnToThread" value="true" />
                  <button type="submit" className="px-2 py-0.5 text-[10px] text-orange-700 border border-orange-400 hover:bg-orange-50">
                    {selectedThread.comment_locked ? 'コメント停止を解除' : 'コメント停止'}
                  </button>
                </form>
              </div>
              <p className="mt-1 text-[10px] text-gray-500">
                レスごとに同一端末/IPハッシュのBANと一括非表示ができます。本文は上書きせず `is_deleted=true` にします。
              </p>
            </div>
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
                      <div className="mt-0.5 flex flex-wrap gap-1 text-[10px] text-gray-400">
                        {p.session_id && <span className="break-all">session: {p.session_id}</span>}
                        {p.ip_hash && <span className="break-all">ip: {p.ip_hash.slice(0, 12)}...</span>}
                      </div>
                      <p className="text-xs text-gray-700 mt-0.5 line-clamp-2 break-all">{p.body}</p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1.5 shrink-0">
                      <a href={`/admin?thread=${selectedThread.id}&editPost=${p.id}`}
                        className="px-2 py-1 text-[10px] text-green-700 border border-green-400 hover:bg-green-50 rounded leading-none">
                        編集
                      </a>
                      <form action={adminDeletePost} className="inline-flex">
                        <input type="hidden" name="postId" value={p.id} />
                        <input type="hidden" name="threadId" value={selectedThread.id} />
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
                        <form action={adminBanSession} className="inline-flex">
                          <input type="hidden" name="sessionId" value={p.session_id ?? ''} />
                          <input type="hidden" name="userId" value={(p as typeof p & { user_id?: string | null }).user_id ?? ''} />
                          <input type="hidden" name="reason" value={`post:${p.id}`} />
                          <input type="hidden" name="returnToThread" value={selectedThread.id} />
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
                        <form action={adminHidePostsBySession} className="inline-flex">
                          <input type="hidden" name="threadId" value={selectedThread.id} />
                          <input type="hidden" name="sessionId" value={p.session_id} />
                          <button type="submit" className="px-2 py-0.5 text-[10px] text-red-700 border border-red-300 hover:bg-red-50">
                            端末一括非表示
                          </button>
                        </form>
                      )}
                      {p.ip_hash && (
                        <form action={adminBanIpHash} className="inline-flex">
                          <input type="hidden" name="ipHash" value={p.ip_hash} />
                          <input type="hidden" name="reason" value={`post:${p.id}`} />
                          <input type="hidden" name="returnToThread" value={selectedThread.id} />
                          <button type="submit" className="px-2 py-0.5 text-[10px] text-white hover:opacity-75 transition-opacity leading-none" style={{ background: '#7f1d1d' }}>
                            IP BAN
                          </button>
                        </form>
                      )}
                      {p.ip_hash && (
                        <form action={adminHidePostsByIpHash} className="inline-flex">
                          <input type="hidden" name="threadId" value={selectedThread.id} />
                          <input type="hidden" name="ipHash" value={p.ip_hash} />
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
