import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { verifyAdminCookie } from '@/lib/admin-auth'
import { createXPost } from '../actions'
import { XPostGenerator } from './XPostGenerator'

export const dynamic = 'force-dynamic'

async function isAdmin() {
  const cookieStore = await cookies()
  return verifyAdminCookie(cookieStore.get('admin_auth')?.value)
}

export default async function NewXPostPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  if (!(await isAdmin())) redirect('/admin')
  const sp = await searchParams

  return (
    <div className="max-w-3xl mx-auto px-3 py-4 text-sm">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">🐦 X投稿 新規作成</h1>
        <Link href="/admin/x-posts" className="text-xs text-gray-500 hover:underline">
          ← 一覧に戻る
        </Link>
      </div>

      {sp.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-xs mb-4">
          {decodeURIComponent(sp.error)}
        </div>
      )}

      <XPostGenerator action={createXPost} />
    </div>
  )
}
