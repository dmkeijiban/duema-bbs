import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase-admin'
import { verifyAdminCookie } from '@/lib/admin-auth'
import { StopButton } from './StopButton'

const ADMIN_COOKIE = 'admin_auth'

type ReportRow = {
  id: number
  item_type: string
  item_id: number
  reason: string | null
  item_body_excerpt: string | null
  reporter_user_id: string | null
  reporter_session_id: string | null
  created_at: string
}

type ReportedPostContext = {
  id: number
  thread_id: number | null
  post_number: number | null
  threads: { title: string | null } | { title: string | null }[] | null
}

type ReportTargetContext = {
  threadId: number
  threadTitle: string
  postNumber: number | null
}

type ReporterProfile = {
  id: string
  display_name: string | null
  profile_slug: string | null
  rank_excluded: boolean | null
  account_suspended: boolean | null
  profile_hidden: boolean | null
  ranking_enabled: boolean | null
  withdrawn_at: string | null
}

function formatDateTime(value: string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

function shortId(value: string | null) {
  if (!value) return '-'
  return value.length <= 16 ? value : `${value.slice(0, 8)}…${value.slice(-4)}`
}

// 通報送信元のステータスを ON/OFF バッジで表示する。
// onIsBad=true（除外・停止・非公開など）の ON は赤系、それ以外（参加中など）の ON は緑系。
function StatusBadge({ label, on, onIsBad = false }: { label: string; on: boolean | null; onIsBad?: boolean }) {
  const isOn = on === true
  const cls = isOn
    ? onIsBad
      ? 'border-red-300 bg-red-50 text-red-700'
      : 'border-green-300 bg-green-50 text-green-700'
    : 'border-gray-200 bg-gray-50 text-gray-400'
  return (
    <span className={`inline-block rounded border px-1 py-0.5 text-[10px] font-bold leading-none ${cls}`}>
      {label} {isOn ? 'ON' : 'OFF'}
    </span>
  )
}

// 通報一覧の「送信元」セル。profile が取れる場合は表示名・slug・状態・管理/公開リンクを出し、
// 取れない場合（退会・匿名化・session通報など）は従来通り省略ID表示にフォールバックする。
function ReporterCell({ report, profile }: { report: ReportRow; profile: ReporterProfile | undefined }) {
  // ユーザー通報で profile が取得できた場合：リッチ表示
  if (report.reporter_user_id && profile) {
    const slug = profile.profile_slug
    return (
      <div className="space-y-1">
        <div className="font-bold text-gray-800">{profile.display_name || '(表示名なし)'}</div>
        {slug && <div className="text-[11px] text-gray-500">@{slug}</div>}
        <div className="font-mono text-[10px] text-gray-400">id: {shortId(report.reporter_user_id)}</div>
        <div className="flex flex-wrap gap-1">
          <StatusBadge label="参加" on={profile.ranking_enabled} />
          <StatusBadge label="除外" on={profile.rank_excluded} onIsBad />
          <StatusBadge label="停止" on={profile.account_suspended} onIsBad />
          <StatusBadge label="非公開" on={profile.profile_hidden} onIsBad />
          {profile.withdrawn_at && (
            <span className="inline-block rounded border border-amber-300 bg-amber-50 px-1 py-0.5 text-[10px] font-bold leading-none text-amber-700">
              退会済み
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <Link href={`/admin/users/${report.reporter_user_id}`} className="text-blue-600 hover:underline">管理詳細</Link>
          {slug && (
            <a href={`/u/${slug}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">公開プロフィール</a>
          )}
        </div>
      </div>
    )
  }

  // ユーザー通報だが profile が取れない場合（退会・匿名化で profiles 行なし等）
  if (report.reporter_user_id) {
    return (
      <div className="space-y-0.5">
        <div className="font-mono text-[11px] text-gray-600">user:{shortId(report.reporter_user_id)}</div>
        <div className="text-[10px] text-gray-400">（プロフィール取得不可）</div>
        <Link href={`/admin/users/${report.reporter_user_id}`} className="text-[11px] text-blue-600 hover:underline">管理詳細</Link>
      </div>
    )
  }

  // 匿名（session）通報：従来通り
  if (report.reporter_session_id) {
    return <span className="font-mono text-[11px] text-gray-600">session:{shortId(report.reporter_session_id)}</span>
  }

  return <span className="text-gray-400">-</span>
}

function getThreadTitle(thread: ReportedPostContext['threads']) {
  if (Array.isArray(thread)) return thread[0]?.title ?? null
  return thread?.title ?? null
}

function ReportTargetCell({
  report,
  context,
}: {
  report: ReportRow
  context: ReportTargetContext | undefined
}) {
  const isCommentReport = report.item_type === 'post' || report.item_type === 'comment'

  if (report.item_type === 'thread') {
    return (
      <Link href={`/thread/${report.item_id}`} target="_blank" className="text-blue-600 hover:underline">
        スレ #{report.item_id}
      </Link>
    )
  }

  if (!isCommentReport) {
    return <span>{report.item_type} #{report.item_id}</span>
  }

  if (!context) {
    return (
      <div className="space-y-1">
        <div className="font-medium text-gray-700">コメント #{report.item_id}</div>
        <div className="text-[11px] text-gray-400">スレ情報を取得できませんでした</div>
      </div>
    )
  }

  const anchor = context.postNumber === null ? '' : `#post-${context.postNumber + 1}`
  const href = `/thread/${context.threadId}${anchor}`

  return (
    <div className="min-w-[12rem] max-w-xs space-y-1 whitespace-normal">
      <div className="font-medium text-gray-700">コメント #{report.item_id}</div>
      <div className="text-[11px] text-gray-500">スレ #{context.threadId}</div>
      <Link
        href={href}
        target="_blank"
        className="block break-words text-blue-600 hover:underline"
        title={context.threadTitle}
      >
        {context.threadTitle}
      </Link>
      <Link href={href} target="_blank" className="inline-block text-[11px] text-blue-600 hover:underline">
        スレを開く
      </Link>
      <div className="break-all font-mono text-[10px] text-gray-400">{href}</div>
    </div>
  )
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ blocked?: string; error?: string }>
}) {
  const cookieStore = await cookies()
  if (!verifyAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value)) redirect('/admin')

  const sp = await searchParams
  const admin = createAdminClient()
  const { data } = await admin
    .from('reports')
    .select('id, item_type, item_id, reason, item_body_excerpt, reporter_user_id, reporter_session_id, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  const reports = (data ?? []) as ReportRow[]

  const reportedPostIds = Array.from(
    new Set(
      reports
        .filter((r) => r.item_type === 'post' || r.item_type === 'comment')
        .map((r) => r.item_id)
        .filter((id) => Number.isFinite(id))
    )
  )
  const targetContextMap = new Map<number, ReportTargetContext>()
  if (reportedPostIds.length > 0) {
    const { data: postContextData } = await admin
      .from('posts')
      .select('id, thread_id, post_number, threads(title)')
      .in('id', reportedPostIds)

    for (const post of (postContextData ?? []) as unknown as ReportedPostContext[]) {
      if (!post.thread_id) continue
      targetContextMap.set(post.id, {
        threadId: post.thread_id,
        threadTitle: getThreadTitle(post.threads) || '（タイトル取得不可）',
        postNumber: post.post_number,
      })
    }
  }

  // 送信元ユーザーの profile をまとめて取得（表示改善のみ・データ変更はしない）。
  const reporterIds = Array.from(
    new Set(reports.map((r) => r.reporter_user_id).filter((id): id is string => !!id))
  )
  const profileMap = new Map<string, ReporterProfile>()
  if (reporterIds.length > 0) {
    const { data: profileData } = await admin
      .from('profiles')
      .select('id, display_name, profile_slug, rank_excluded, account_suspended, profile_hidden, ranking_enabled, withdrawn_at')
      .in('id', reporterIds)
    for (const p of (profileData ?? []) as ReporterProfile[]) {
      profileMap.set(p.id, p)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 text-sm">
      <div className="mb-4 flex items-center gap-2 text-xs text-gray-500">
        <Link href="/admin" className="text-blue-600 hover:underline">管理画面</Link>
        <span>/</span>
        <span>通報管理</span>
      </div>
      <h1 className="mb-4 text-lg font-bold text-gray-800">通報管理</h1>

      {sp.blocked === '1' && (
        <div className="mb-3 rounded border border-green-300 bg-green-50 px-3 py-2 text-xs text-green-800">
          通報受付を停止しました。
        </div>
      )}
      {sp.error && (
        <div className="mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
          エラー: {sp.error}
        </div>
      )}

      <div className="mb-3 flex justify-end">
        <Link href="/admin/report-mutes" className="rounded border border-gray-300 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50">
          受付停止一覧 →
        </Link>
      </div>

      <div className="overflow-x-auto rounded border border-gray-200 bg-white">
        <table className="w-full text-xs">
          <thead className="border-b border-gray-100 bg-gray-50 text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left">日時</th>
              <th className="px-3 py-2 text-left">対象</th>
              <th className="px-3 py-2 text-left">送信元</th>
              <th className="px-3 py-2 text-left">理由/内容</th>
              <th className="px-3 py-2 text-left">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {reports.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">まだありません</td></tr>
            ) : reports.map((r) => (
              <tr key={r.id} className="align-top hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{formatDateTime(r.created_at)}</td>
                <td className="px-3 py-2">
                  <ReportTargetCell report={r} context={targetContextMap.get(r.item_id)} />
                </td>
                <td className="px-3 py-2 text-[11px] text-gray-600"><ReporterCell report={r} profile={r.reporter_user_id ? profileMap.get(r.reporter_user_id) : undefined} /></td>
                <td className="px-3 py-2 text-gray-700"><p className="font-bold">{r.reason || '（理由なし）'}</p>{r.item_body_excerpt && <p className="mt-1 line-clamp-2 break-all text-[11px] text-gray-500">{r.item_body_excerpt}</p>}</td>
                <td className="px-3 py-2">
                  {(r.reporter_user_id || r.reporter_session_id) && (
                    <StopButton reportId={r.id} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
