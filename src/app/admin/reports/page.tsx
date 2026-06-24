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

function formatDateTime(value: string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

function shortId(value: string | null) {
  if (!value) return '-'
  return value.length <= 16 ? value : `${value.slice(0, 8)}…${value.slice(-4)}`
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
                <td className="px-3 py-2 whitespace-nowrap">{r.item_type === 'thread' ? <a href={`/thread/${r.item_id}`} target="_blank" className="text-blue-600 hover:underline">スレ #{r.item_id}</a> : <span>コメント #{r.item_id}</span>}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-gray-600">{r.reporter_user_id ? `user:${shortId(r.reporter_user_id)}` : r.reporter_session_id ? `session:${shortId(r.reporter_session_id)}` : '-'}</td>
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
