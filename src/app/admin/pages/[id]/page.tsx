import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { parseBlocks } from '@/types/fixed-pages'
import { PageEditor } from '../PageEditor'
import { DEFAULT_BLOCKS } from '../page-defaults'

async function isAdmin() {
  const cookieStore = await cookies()
  return cookieStore.get('admin_auth')?.value === process.env.ADMIN_PASSWORD
}

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) redirect('/admin')

  const { id } = await params
  const supabase = await createClient()
  const { data: page } = await supabase.from('fixed_pages').select('*').eq('id', parseInt(id)).single()
  if (!page) notFound()

  const parsed = parseBlocks(page.content)
  // コンテンツが空の場合、既知スラッグのデフォルト文章を初期値として使う
  const content = parsed.length > 0 ? parsed : (DEFAULT_BLOCKS[page.slug] ?? [])

  return (
    <div className="max-w-3xl mx-auto px-3 py-4 text-sm">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">📄 ページ編集</h1>
        <a href="/admin/pages" className="text-xs text-gray-500 hover:underline">← 一覧に戻る</a>
      </div>
      <PageEditor initial={{
        id: page.id,
        title: page.title,
        slug: page.slug,
        nav_label: page.nav_label,
        content,
        is_published: page.is_published,
        show_in_nav: page.show_in_nav,
        sort_order: page.sort_order,
        external_url: page.external_url ?? '',
      }} />
    </div>
  )
}
