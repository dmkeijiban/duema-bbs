import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ADMIN_COOKIE, verifyAdminCookie } from '@/lib/admin-auth'

export default async function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  if (!verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)) redirect('/admin')
  return <main className="min-h-screen bg-gray-50 px-3 py-5 text-gray-800"><div className="mx-auto max-w-7xl">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-bold text-blue-700">管理者限定</p><h1 className="text-2xl font-black">📊 分析ダッシュボード</h1></div><Link href="/admin" className="text-xs text-blue-700 hover:underline">管理画面へ戻る</Link></div>
    {children}
  </div></main>
}
