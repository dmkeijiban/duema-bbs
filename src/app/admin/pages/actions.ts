'use server'

import { revalidateTag } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import type { Block } from '@/types/fixed-pages'

const ADMIN_COOKIE = 'admin_auth'
const OPT = { expire: 0 } as const

async function requireAdmin() {
  const cookieStore = await cookies()
  if (cookieStore.get(ADMIN_COOKIE)?.value !== process.env.ADMIN_PASSWORD) {
    redirect('/admin')
  }
}

export interface PageInput {
  id?: number
  title: string
  slug: string
  nav_label: string
  content: Block[]
  is_published: boolean
  show_in_nav: boolean
  sort_order: number
  external_url: string
}

export async function savePage(input: PageInput): Promise<{ error?: string }> {
  await requireAdmin()
  const supabase = await createClient()

  const { title, slug, nav_label, content, is_published, show_in_nav, sort_order, external_url } = input

  if (!title.trim()) return { error: 'タイトルは必須です' }
  if (!slug.trim()) return { error: 'スラッグは必須です' }
  if (!/^[a-z0-9-]+$/.test(slug)) return { error: 'スラッグは英小文字・数字・ハイフンのみ使用できます' }

  const payload = {
    title: title.trim(),
    slug: slug.trim(),
    nav_label: nav_label.trim() || title.trim(),
    content: content as unknown as Record<string, unknown>[],
    is_published,
    show_in_nav,
    sort_order: Number(sort_order) || 10,
    external_url: external_url.trim() || null,
  }

  if (input.id) {
    const { error } = await supabase.from('fixed_pages').update(payload).eq('id', input.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('fixed_pages').insert(payload)
    if (error) return { error: error.message }
  }

  revalidateTag('fixed_pages', OPT)
  revalidateTag(`fixed-page-${slug}`, OPT)
  revalidateTag('nav-pages', OPT)
  return {}
}

export async function deletePage(formData: FormData) {
  await requireAdmin()
  const supabase = await createClient()
  const id = parseInt(formData.get('id') as string)
  await supabase.from('fixed_pages').delete().eq('id', id)
  revalidateTag('fixed_pages', OPT)
  revalidateTag('nav-pages', OPT)
  redirect('/admin/pages')
}

export async function togglePublished(formData: FormData) {
  await requireAdmin()
  const supabase = await createClient()
  const id = parseInt(formData.get('id') as string)
  const current = formData.get('current') === 'true'
  await supabase.from('fixed_pages').update({ is_published: !current }).eq('id', id)
  revalidateTag('fixed_pages', OPT)
  revalidateTag('nav-pages', OPT)
  redirect('/admin/pages')
}

export async function movePage(formData: FormData) {
  await requireAdmin()
  const supabase = await createClient()
  const id = parseInt(formData.get('id') as string)
  const direction = formData.get('direction') as 'up' | 'down'

  const { data: all } = await supabase.from('fixed_pages').select('id, sort_order').order('sort_order')
  if (!all) redirect('/admin/pages')

  const idx = all.findIndex(p => p.id === id)
  if (idx < 0) redirect('/admin/pages')
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= all.length) redirect('/admin/pages')

  await Promise.all([
    supabase.from('fixed_pages').update({ sort_order: all[swapIdx].sort_order }).eq('id', all[idx].id),
    supabase.from('fixed_pages').update({ sort_order: all[idx].sort_order }).eq('id', all[swapIdx].id),
  ])

  revalidateTag('fixed_pages', OPT)
  revalidateTag('nav-pages', OPT)
  redirect('/admin/pages')
}
