import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase-admin'
import { verifyAdminCookie } from '@/lib/admin-auth'
import { revokeReportMuteAction } from './actions'

const ADMIN_COOKIE = 'admin_auth'

function shortId(value: string | null) {
  if (!value) return '-'
  return value.length <= 24 ? value : `${value.slice(0, 10)}…${value.slice(-6)}`
}

export default async function ReportMutesPage({
  searchParams,
}: {
  searchParams: Promise<{ revoked?: string; error?: string }>
}) {
  const cookieStore = await cookies()
  if (!verifyAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value)) redirect('/admin')

  const sp = await searchParams
  const admin = createAdminClient()
  const { data } = await admin
    .from('report_mutes')
    .select('id, user_id, session_id, reason, is_active, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  const rows = (data ?? []) as {
    id: number
    user_id: string | null
    session_id: string | null
    reason: string | null
    is_active: boolean
    created_at: string
  }[]

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 text-sm">
      <div className="mb-4 flex items-center gap-2 text-xs text-gray-500">
        <Link href="/admin" className="text-blue-600 hover:underline">管理画面</Link>
        <span>/</span>
        <Link href="/admin/reports" className="text-blue-600 hover:underline">通報管理</Link>
        <span>/</span>
        <span>受付停止一覧</span>
      </div>
      <h1 className="mb-4 text-lg font-bold text-gray-800">通報受付停止一覧</h1>

      {sp.revoked === '1' && (
        <div className="mb-3 rounded border border-green-300 bg-green-50 px-3 py-2 text-xs text-green-800">
          停止を解除しました。
        </div>
      )}
      {sp.error && (
        <div className="mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
          エラー: {sp.error}
        </div>
      )}

      <div className="overflow-x-auto rounded border border-gray-200 bg-white">
        <table className="w-full text-xs">
          <thead className="border-b border-gray-100 bg-gray-50 text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left">ID</th>
              <th className="px-3 py-2 text-left">対象</th>
              <th className="px-3 py-2 text-left">理由</th>
              <th className="px-3 py-2 text-left">状態</th>
              <th className="px-3 py-2 text-left">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">なし</td></tr>
            ) : rows.map((row) => (
              <tr key={row.id} className="align-middle hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-gray-500">{row.id}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-gray-700">
                  {row.user_id ? `user:${shortId(row.user_id)}` : `session:${shortId(row.session_id)}`}
                </td>
                <td className="px-3 py-2 text-gray-700">{row.reason ?? '-'}</td>
                <td className="px-3 py-2">
                  {row.is_active ? (
                    <span className="rounded border border-red-300 bg-red-50 px-1.5 py-0.5 text-[11px] text-red-700">停止中</span>
                  ) : (
                    <span className="rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 text-[11px] text-gray-500">解除済み</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {row.is_active && (
                    <form action={revokeReportMuteAction} className="inline">
                      <input type="hidden" name="muteId" value={row.id} />
                      <button
                        type="submit"
                        className="rounded border border-gray-400 px-2 py-1 text-[10px] text-gray-600 hover:bg-gray-50"
                      >
                        解除
                      </button>
                    </form>
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
