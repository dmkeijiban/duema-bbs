import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { verifyAdminCookie } from '@/lib/admin-auth'
import { XRepliesClient } from './XRepliesClient'

export const dynamic = 'force-dynamic'

export default async function XRepliesPage() {
  const cookieStore = await cookies()
  if (!verifyAdminCookie(cookieStore.get('admin_auth')?.value)) redirect('/admin')

  return (
    <div className="max-w-screen-xl mx-auto px-3 py-4 text-sm">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">Xリプライ取得</h1>
        <Link href="/admin" className="text-xs text-blue-600 hover:underline">管理画面に戻る</Link>
      </div>
      <XRepliesClient />
    </div>
  )
}
