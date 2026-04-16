'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase-server'

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

export async function adminCreateNotice(formData: FormData) {
  await checkAdmin()
  const supabase = await createClient()

  await supabase.from('notices').insert({
    title: (formData.get('title') as string)?.trim() ?? '',
    body: (formData.get('body') as string)?.trim() ?? '',
    image_url: (formData.get('image_url') as string)?.trim() ?? '',
    link_url: (formData.get('link_url') as string)?.trim() ?? '',
    display_type: (formData.get('display_type') as string) ?? 'banner',
    position: (formData.get('position') as string) ?? 'mid',
    sort_order: parseInt((formData.get('sort_order') as string) ?? '0') || 0,
  })

  revalidatePath('/')
  revalidatePath('/admin')
  redirect('/admin')
}

export async function adminUpdateNotice(formData: FormData) {
  await checkAdmin()
  const noticeId = parseInt(formData.get('noticeId') as string)
  const supabase = await createClient()

  await supabase.from('notices').update({
    title: (formData.get('title') as string)?.trim() ?? '',
    body: (formData.get('body') as string)?.trim() ?? '',
    image_url: (formData.get('image_url') as string)?.trim() ?? '',
    link_url: (formData.get('link_url') as string)?.trim() ?? '',
    display_type: (formData.get('display_type') as string) ?? 'banner',
    position: (formData.get('position') as string) ?? 'mid',
    sort_order: parseInt((formData.get('sort_order') as string) ?? '0') || 0,
  }).eq('id', noticeId)

  revalidatePath('/')
  revalidatePath('/admin')
  redirect('/admin')
}

export async function adminDeleteNotice(formData: FormData) {
  await checkAdmin()
  const noticeId = parseInt(formData.get('noticeId') as string)
  const supabase = await createClient()

  await supabase.from('notices').delete().eq('id', noticeId)

  revalidatePath('/')
  revalidatePath('/admin')
  redirect('/admin')
}

export async function adminToggleNotice(formData: FormData) {
  await checkAdmin()
  const noticeId = parseInt(formData.get('noticeId') as string)
  const current = formData.get('current') === 'true'
  const supabase = await createClient()

  await supabase.from('notices').update({ is_active: !current }).eq('id', noticeId)

  revalidatePath('/')
  revalidatePath('/admin')
  redirect('/admin')
}

// ホーム画面インライン編集用（redirect なし）
export async function inlineCreateNotice(formData: FormData) {
  await checkAdmin()
  const supabase = await createClient()

  await supabase.from('notices').insert({
    title: (formData.get('title') as string)?.trim() ?? '',
    body: (formData.get('body') as string)?.trim() ?? '',
    image_url: (formData.get('image_url') as string)?.trim() ?? '',
    link_url: (formData.get('link_url') as string)?.trim() ?? '',
    display_type: (formData.get('display_type') as string) ?? 'banner',
    position: (formData.get('position') as string) ?? 'mid',
    sort_order: parseInt((formData.get('sort_order') as string) ?? '0') || 0,
    is_active: true,
  })

  revalidatePath('/')
}

export async function inlineUpdateNotice(formData: FormData) {
  await checkAdmin()
  const noticeId = parseInt(formData.get('noticeId') as string)
  const supabase = await createClient()

  await supabase.from('notices').update({
    title: (formData.get('title') as string)?.trim() ?? '',
    body: (formData.get('body') as string)?.trim() ?? '',
    image_url: (formData.get('image_url') as string)?.trim() ?? '',
    link_url: (formData.get('link_url') as string)?.trim() ?? '',
    display_type: (formData.get('display_type') as string) ?? 'banner',
    position: (formData.get('position') as string) ?? 'mid',
    sort_order: parseInt((formData.get('sort_order') as string) ?? '0') || 0,
  }).eq('id', noticeId)

  revalidatePath('/')
}

export async function inlineDeleteNotice(formData: FormData) {
  await checkAdmin()
  const noticeId = parseInt(formData.get('noticeId') as string)
  const supabase = await createClient()

  await supabase.from('notices').delete().eq('id', noticeId)

  revalidatePath('/')
}
