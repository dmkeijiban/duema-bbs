import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { NoticeEditClient } from '../NoticeEditClient'
import { verifyAdminCookie } from '@/lib/admin-auth'

const ADMIN_COOKIE = 'admin_auth'

async function isAdmin() {
  const cookieStore = await cookies()
  return verifyAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value)
}

export default async function NoticeEditPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) redirect('/admin')

  const { id } = await params
  const noticeId = parseInt(id)
  if (isNaN(noticeId)) notFound()

  const supabase = await createClient()
  const { data: notice } = await supabase
    .from('notices')
    .select('*')
    .eq('id', noticeId)
    .single()

  if (!notice) notFound()

  return (
    <div className="max-w-4xl mx-auto px-3 py-4 text-sm">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">✏️ お知らせ編集</h1>
        <a href="/admin/notices" className="text-xs text-gray-500 hover:underline">← 一覧に戻る</a>
      </div>
      <div className="bg-white border border-gray-200 p-4">
        <NoticeEditClient notice={{
          id: notice.id,
          position: notice.position ?? 'mid',
          sort_order: notice.sort_order ?? 0,
          is_active: notice.is_active ?? false,
          header_text: notice.header_text ?? '',
          columns: notice.columns ?? 3,
          show_in_thread: notice.show_in_thread ?? false,
          items: notice.items ?? [],
        }} />
      </div>
    </div>
  )
}
