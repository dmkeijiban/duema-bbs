import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase-admin'
import { verifyAdminCookie } from '@/lib/admin-auth'

const ADMIN_COOKIE = 'admin_auth'

export default async function ReportMutesPage() {
  const cookieStore = await cookies()
  if (!verifyAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value)) redirect('/admin')

  const admin = createAdminClient()
  const { data } = await admin
    .from('report_mutes')
    .select('id, user_id, session_id, reason, is_active, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 text-sm">
      <div className="mb-4 flex items-center gap-2 text-xs text-gray-500">
        <Link href="/admin" className="text-blue-600 hover:underline">管理画面</Link>
        <span>/</span>
        <span>通報受付停止一覧</span>
      </div>
      <h1 className="mb-4 text-lg font-bold text-gray-800">通報受付停止一覧</h1>
      <div className="overflow-x-auto rounded border border-gray-200 bg-white">
        <table className="w-full text-xs">
          <thead className="border-b border-gray-100 bg-gray-50 text-gray-500">
            <tr><th className="px-3 py-2 text-left">ID</th><th className="px-3 py-2 text-left">対象</th><th className="px-3 py-2 text-left">理由</th><th className="px-3 py-2 text-left">状態</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(data ?? []).length === 0 ? <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-400">なし</td></tr> : (data ?? []).map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-2 font-mono text-gray-500">{row.id}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-gray-700">{row.user_id ? `user:${row.user_id}` : `session:${row.session_id}`}</td>
                <td className="px-3 py-2 text-gray-700">{row.reason ?? '-'}</td>
                <td className="px-3 py-2 text-gray-700">{row.is_active ? '有効' : '解除済み'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
