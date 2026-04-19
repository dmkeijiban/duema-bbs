'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase-server'

const ADMIN_COOKIE = 'admin_auth'

async function requireAdmin() {
  const cookieStore = await cookies()
  if (cookieStore.get(ADMIN_COOKIE)?.value !== process.env.ADMIN_PASSWORD) {
    redirect('/admin')
  }
}

export async function addCategory(formData: FormData) {
  await requireAdmin()
  const supabase = await createClient()

  const name = (formData.get('name') as string)?.trim()
  const slug = (formData.get('slug') as string)?.trim()
  const color = (formData.get('color') as string)?.trim() || '#6c757d'
  const sortOrder = parseInt(formData.get('sort_order') as string) || 10

  if (!name || !slug) redirect('/admin/categories?error=名前とスラッグは必須です')

  const { error } = await supabase
    .from('categories')
    .insert({ name, slug, color, sort_order: sortOrder })

  if (error) redirect(`/admin/categories?error=${encodeURIComponent(error.message)}`)

  revalidateTag('categories', { expire: 0 })
  revalidatePath('/')
  redirect('/admin/categories')
}

export async function deleteCategory(formData: FormData) {
  await requireAdmin()
  const supabase = await createClient()
  const id = parseInt(formData.get('id') as string)
  await supabase.from('categories').delete().eq('id', id)
  revalidateTag('categories', { expire: 0 })
  revalidatePath('/')
  redirect('/admin/categories')
}

export async function moveCategory(formData: FormData) {
  await requireAdmin()
  const supabase = await createClient()
  const id = parseInt(formData.get('id') as string)
  const direction = formData.get('direction') as 'up' | 'down'

  const { data: all } = await supabase
    .from('categories')
    .select('id, sort_order')
    .order('sort_order')

  if (!all) redirect('/admin/categories')

  const idx = all.findIndex(c => c.id === id)
  if (idx < 0) redirect('/admin/categories')

  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= all.length) redirect('/admin/categories')

  const current = all[idx]
  const neighbor = all[swapIdx]

  // sort_orderを互いに交換
  await Promise.all([
    supabase.from('categories').update({ sort_order: neighbor.sort_order }).eq('id', current.id),
    supabase.from('categories').update({ sort_order: current.sort_order }).eq('id', neighbor.id),
  ])

  revalidateTag('categories', { expire: 0 })
  revalidatePath('/')
  redirect('/admin/categories')
}
