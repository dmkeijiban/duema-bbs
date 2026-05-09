'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath, revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { NoticeItem } from '@/components/NoticeBlock'
import { createAdminCookieValue, isAdminPassword, verifyAdminCookie } from '@/lib/admin-auth'

const ADMIN_COOKIE = 'admin_auth'

async function checkAdmin() {
  const cookieStore = await cookies()
  const val = cookieStore.get(ADMIN_COOKIE)?.value
  if (!verifyAdminCookie(val)) {
    throw new Error('Unauthorized')
  }
}

export async function adminLogin(formData: FormData) {
  const pw = formData.get('password') as string
  if (isAdminPassword(pw)) {
    const cookieStore = await cookies()
    cookieStore.set(ADMIN_COOKIE, createAdminCookieValue(), {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 7日間
    })
    redirect('/admin')
  }
  redirect('/admin?error=パスワードが違います')
}

export async function adminDeleteThread(formData: FormData) {
  await checkAdmin()
  const threadId = parseInt(formData.get('threadId') as string)
  const supabase = createAdminClient()

  // 関連する posts をソフト削除してからスレッド本体を削除
  await supabase.from('posts').update({
    is_deleted: true,
    deleted_at: new Date().toISOString(),
    deleted_by: 'admin_thread_delete',
  }).eq('thread_id', threadId).eq('is_deleted', false)
  await supabase.from('favorites').delete().eq('thread_id', threadId)
  await supabase.from('threads').delete().eq('id', threadId)

  revalidatePath('/')
  revalidatePath('/admin')
  redirect('/admin')
}

export async function adminDeletePost(formData: FormData) {
  await checkAdmin()
  const postId = parseInt(formData.get('postId') as string)
  const threadId = parseInt(formData.get('threadId') as string)
  const supabase = createAdminClient()

  await supabase.from('posts').update({
    is_deleted: true,
    deleted_at: new Date().toISOString(),
    deleted_by: 'admin',
  }).eq('id', postId)
  await supabase.rpc('recalculate_post_count', { p_thread_id: threadId })

  revalidateTag(`thread-${threadId}`, { expire: 0 })
  revalidatePath(`/thread/${threadId}`)
  revalidatePath('/admin')
  redirect(`/admin?thread=${threadId}`)
}

export async function adminUpdateThread(formData: FormData) {
  await checkAdmin()
  const threadId = parseInt(formData.get('threadId') as string)
  const title = formData.get('title') as string
  const body = formData.get('body') as string
  const categoryId = formData.get('category_id') as string
  const supabase = createAdminClient()

  const { error } = await supabase.from('threads').update({
    title: title.trim(),
    body: body.trim(),
    ...(categoryId ? { category_id: parseInt(categoryId) } : {}),
  }).eq('id', threadId)

  if (error) throw new Error(`スレッド更新失敗: ${error.message}`)

  revalidatePath(`/thread/${threadId}`)
  revalidatePath('/')
  revalidatePath('/admin')
  redirect('/admin')
}

export async function adminUpdatePost(formData: FormData) {
  await checkAdmin()
  const postId = parseInt(formData.get('postId') as string)
  const threadId = parseInt(formData.get('threadId') as string)
  const body = formData.get('body') as string
  const supabase = createAdminClient()

  const { error } = await supabase.from('posts').update({ body: body.trim() }).eq('id', postId)

  if (error) throw new Error(`投稿更新失敗: ${error.message}`)

  revalidatePath(`/thread/${threadId}`)
  revalidatePath('/admin')
  redirect(`/admin?thread=${threadId}`)
}

export async function adminToggleArchive(formData: FormData) {
  await checkAdmin()
  const threadId = parseInt(formData.get('threadId') as string)
  const current = formData.get('isArchived') === 'true'
  const supabase = createAdminClient()

  await supabase.from('threads').update({ is_archived: !current }).eq('id', threadId)

  revalidatePath('/')
  revalidatePath('/admin')
  redirect('/admin')
}

export async function saveNotice(data: {
  id?: number
  position: string
  sort_order: number
  header_text: string
  columns: number
  items: NoticeItem[]
  is_active: boolean
  show_in_thread: boolean
}): Promise<{ error?: string }> {
  try {
    await checkAdmin()
  } catch {
    return { error: 'Unauthorized' }
  }
  const supabase = await createClient()
  const payload = {
    position: data.position,
    sort_order: data.sort_order,
    header_text: data.header_text,
    columns: data.columns,
    items: data.items,
    is_active: data.is_active,
    show_in_thread: data.show_in_thread,
  }
  if (data.id) {
    const { error } = await supabase.from('notices').update(payload).eq('id', data.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('notices').insert(payload)
    if (error) return { error: error.message }
  }
  revalidatePath('/')
  return {}
}

export async function deleteNotice(id: number): Promise<{ error?: string }> {
  try {
    await checkAdmin()
  } catch {
    return { error: 'Unauthorized' }
  }
  const supabase = await createClient()
  const { error } = await supabase.from('notices').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/')
  return {}
}

export async function moveNotice(id: number, direction: 'up' | 'down'): Promise<{ error?: string }> {
  try {
    await checkAdmin()
  } catch {
    return { error: 'Unauthorized' }
  }
  const supabase = await createClient()

  // 対象 notice を取得
  const { data: target, error: fetchError } = await supabase
    .from('notices')
    .select('id, sort_order, position')
    .eq('id', id)
    .single()
  if (fetchError || !target) return { error: fetchError?.message ?? 'Not found' }

  // 同じ position の notices を sort_order 順で取得
  const { data: siblings, error: siblingsError } = await supabase
    .from('notices')
    .select('id, sort_order')
    .eq('position', target.position)
    .order('sort_order', { ascending: true })
  if (siblingsError || !siblings) return { error: siblingsError?.message ?? 'Failed to fetch' }

  const idx = siblings.findIndex(n => n.id === id)
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= siblings.length) return {}

  const swapTarget = siblings[swapIdx]
  const targetOrder = target.sort_order
  const swapOrder = swapTarget.sort_order

  await supabase.from('notices').update({ sort_order: swapOrder }).eq('id', id)
  await supabase.from('notices').update({ sort_order: targetOrder }).eq('id', swapTarget.id)

  revalidatePath('/')
  return {}
}

export async function updateSettingAction(formData: FormData) {
  await checkAdmin()
  const key = formData.get('key') as string
  const value = formData.get('value') as string
  const supabase = await createClient()
  await supabase
    .from('site_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  revalidatePath('/', 'layout')
  revalidatePath('/terms')
  redirect('/admin')
}
