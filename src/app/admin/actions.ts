'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase-server'
import { NoticeItem } from '@/components/NoticeBlock'

const ADMIN_COOKIE = 'admin_auth'

async function checkAdmin() {
  const cookieStore = await cookies()
  const val = cookieStore.get(ADMIN_COOKIE)?.value
  if (val !== process.env.ADMIN_PASSWORD) {
    throw new Error('Unauthorized')
  }
}

export async function adminLogin(formData: FormData) {
  const pw = formData.get('password') as string
  if (pw && pw === process.env.ADMIN_PASSWORD) {
    const cookieStore = await cookies()
    cookieStore.set(ADMIN_COOKIE, pw, {
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 7日間
    })
    redirect('/admin')
  }
  redirect('/admin?error=パスワードが違います')
}

export async function adminDeleteThread(formData: FormData) {
  await checkAdmin()
  const threadId = parseInt(formData.get('threadId') as string)
  const supabase = await createClient()

  // 関連する posts を先に削除（外部キー制約）
  await supabase.from('posts').delete().eq('thread_id', threadId)
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
  const supabase = await createClient()

  await supabase.from('posts').delete().eq('id', postId)
  await supabase.rpc('recalculate_post_count', { p_thread_id: threadId })

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
  const supabase = await createClient()

  await supabase.from('threads').update({
    title: title.trim(),
    body: body.trim(),
    ...(categoryId ? { category_id: parseInt(categoryId) } : {}),
  }).eq('id', threadId)

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
  const supabase = await createClient()

  await supabase.from('posts').update({ body: body.trim() }).eq('id', postId)

  revalidatePath(`/thread/${threadId}`)
  revalidatePath('/admin')
  redirect(`/admin?thread=${threadId}`)
}

export async function adminToggleArchive(formData: FormData) {
  await checkAdmin()
  const threadId = parseInt(formData.get('threadId') as string)
  const current = formData.get('isArchived') === 'true'
  const supabase = await createClient()

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
