import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { verifyAdminCookie } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { makeXPostDrafts, PopularThreadForDraft } from '@/lib/x-post-drafts'
import { XDraftsClient } from './XDraftsClient'

export const dynamic = 'force-dynamic'

export default async function XDraftsPage() {
  const cookieStore = await cookies()
  if (!verifyAdminCookie(cookieStore.get('admin_auth')?.value)) redirect('/admin')

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('threads')
    .select('id, title, body, post_count, view_count, created_at, last_posted_at, categories(name)')
    .eq('is_archived', false)
    .order('post_count', { ascending: false })
    .limit(30)

  const drafts = makeXPostDrafts((data ?? []) as PopularThreadForDraft[])

  return (
    <div className="max-w-screen-xl mx-auto px-3 py-4 text-sm">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">人気スレX投稿文</h1>
        <Link href="/admin" className="text-xs text-blue-600 hover:underline">管理画面に戻る</Link>
      </div>
      <XDraftsClient drafts={drafts} />
    </div>
  )
}
