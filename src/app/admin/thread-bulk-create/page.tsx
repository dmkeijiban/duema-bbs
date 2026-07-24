import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { verifyAdminCookie } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { getPostableConsolidatedCategories } from '@/lib/categories'
import type { Category } from '@/types'
import { ThreadBulkCreateClient } from './ThreadBulkCreateClient'

export const dynamic = 'force-dynamic'

export default async function ThreadBulkCreatePage() {
  const store = await cookies()
  if (!verifyAdminCookie(store.get('admin_auth')?.value)) redirect('/admin')

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('categories')
    .select('id, name, slug, color, description, sort_order')
    .order('sort_order', { ascending: true })
  const categories = getPostableConsolidatedCategories((data ?? []) as Category[])

  return <main className="mx-auto max-w-screen-lg px-3 py-4 text-sm">
    <div className="mb-4 flex items-center justify-between gap-3">
      <h1 className="text-xl font-bold text-gray-800">📝 スレ・コメント一括作成</h1>
      <Link href="/admin" className="text-xs text-blue-600 hover:underline">管理画面に戻る</Link>
    </div>
    <ThreadBulkCreateClient categories={categories.map(category => ({ id: category.id, name: category.name }))} />
  </main>
}
