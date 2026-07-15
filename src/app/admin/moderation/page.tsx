import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ADMIN_COOKIE, verifyAdminCookie } from '@/lib/admin-auth'

const card = 'min-w-0 rounded-lg border border-gray-200 bg-white p-4 transition hover:border-blue-300 hover:bg-blue-50/40'

export default async function Page() {
  if (!verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)) redirect('/admin')
  return <main className="min-h-screen bg-gray-50 px-3 py-5 text-gray-800"><div className="mx-auto max-w-5xl">
    <nav className="mb-2 text-xs text-gray-500"><Link href="/admin" className="text-blue-700 hover:underline">管理TOP</Link><span className="mx-2">/</span><span>運営・モデレーション</span></nav>
    <h1 className="text-2xl font-black">運営・モデレーション</h1><p className="mt-1 text-sm text-gray-600">通報、受付停止、削除済みデータを管理します。</p>
    <div className="mt-5 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Link href="/admin/reports" className={card}><b className="block">通報</b><span className="mt-1 block text-xs text-gray-500">受け付けた通報を確認・対応</span></Link>
      <Link href="/admin/report-mutes" className={card}><b className="block">受付停止</b><span className="mt-1 block text-xs text-gray-500">通報受付を停止した対象を確認</span></Link>
      <Link href="/admin/deleted-posts" className={card}><b className="block">削除済み</b><span className="mt-1 block text-xs text-gray-500">削除済みレスの確認・復元</span></Link>
    </div>
    <details className="mt-5 overflow-hidden rounded-lg border border-orange-200 bg-white"><summary className="cursor-pointer px-4 py-3 text-sm font-bold text-orange-800 hover:bg-orange-50">詳細な管理機能</summary><div className="grid min-w-0 grid-cols-1 gap-3 border-t border-orange-100 p-3 sm:grid-cols-2">
      <Link href="/admin/revival" className={card}><b className="block">リバイバル</b><span className="mt-1 block text-xs text-gray-500">既存の安全確認を維持して再掲を管理</span></Link>
      <Link href="/admin/cleanup" className={card}><b className="block">データ整理</b><span className="mt-1 block text-xs text-gray-500">保守・整理機能を実行</span></Link>
    </div></details>
  </div></main>
}
