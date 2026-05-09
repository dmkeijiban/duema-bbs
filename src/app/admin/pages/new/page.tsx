import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { PageEditor } from '../PageEditor'
import { verifyAdminCookie } from '@/lib/admin-auth'

async function isAdmin() {
  const cookieStore = await cookies()
  return verifyAdminCookie(cookieStore.get('admin_auth')?.value)
}

export default async function NewPage() {
  if (!(await isAdmin())) redirect('/admin')

  return (
    <div className="max-w-3xl mx-auto px-3 py-4 text-sm">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">📄 新規ページ作成</h1>
        <a href="/admin/pages" className="text-xs text-gray-500 hover:underline">← 一覧に戻る</a>
      </div>
      <PageEditor initial={{
        title: '',
        slug: '',
        nav_label: '',
        content: [],
        is_published: true,
        show_in_nav: true,
        sort_order: 10,
        external_url: '',
      }} />
    </div>
  )
}
