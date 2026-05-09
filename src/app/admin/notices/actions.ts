'use server'

import { revalidateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase-server'
import { uploadImage, validateImageFile } from '@/lib/upload'
import { v4 as uuidv4 } from 'uuid'
import { verifyAdminCookie } from '@/lib/admin-auth'

const ADMIN_COOKIE = 'admin_auth'

async function requireAdmin() {
  const cookieStore = await cookies()
  if (!verifyAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value)) {
    redirect('/admin')
  }
}

// バナー画像をSupabaseにアップロードして公開URLを返す
export async function uploadNoticeImage(formData: FormData): Promise<{ url?: string; error?: string }> {
  await requireAdmin()
  const file = formData.get('image') as File | null
  if (!file) return { error: '画像が選択されていません' }

  const validErr = validateImageFile(file)
  if (validErr) return { error: validErr }

  const supabase = await createClient()
  const result = await uploadImage(file, supabase, `banners/${uuidv4()}`, 'banner')
  if (result.error || !result.data) return { error: result.error ?? '画像のアップロードに失敗しました' }
  return { url: result.data.url }
}

// お知らせ新規作成（空の状態で作成してから編集へ）
export async function createNotice() {
  await requireAdmin()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('notices')
    .insert({
      position: 'mid',
      sort_order: 0,
      header_text: '',
      columns: 3,
      is_active: false,
      show_in_thread: false,
      items: [],
    })
    .select('id')
    .single()

  if (error || !data) redirect('/admin/notices')
  redirect(`/admin/notices/${data.id}`)
}

// お知らせ更新（メタデータ + items）
export async function saveNotice(formData: FormData) {
  await requireAdmin()
  const supabase = await createClient()

  const id = parseInt(formData.get('id') as string)
  const position = formData.get('position') as string
  const sortOrder = parseInt(formData.get('sort_order') as string) || 0
  const headerText = (formData.get('header_text') as string)?.trim() ?? ''
  const columns = Math.min(4, Math.max(1, parseInt(formData.get('columns') as string) || 3))
  const isActive = formData.get('is_active') === 'on'
  const showInThread = formData.get('show_in_thread') === 'on'

  let items = []
  try {
    items = JSON.parse(formData.get('items') as string || '[]')
  } catch { /* 無視 */ }

  const { error } = await supabase
    .from('notices')
    .update({ position, sort_order: sortOrder, header_text: headerText, columns, is_active: isActive, show_in_thread: showInThread, items })
    .eq('id', id)

  if (error) return { error: '保存に失敗しました: ' + error.message }

  revalidateTag('notices', { expire: 0 })
  redirect('/admin/notices')
}

// 表示ON/OFF切り替え
export async function toggleNoticeActive(formData: FormData) {
  await requireAdmin()
  const supabase = await createClient()

  const id = parseInt(formData.get('id') as string)
  const current = formData.get('current') === 'true'

  await supabase.from('notices').update({ is_active: !current }).eq('id', id)
  revalidateTag('notices', { expire: 0 })
  redirect('/admin/notices')
}

// 並び順を上下に移動
export async function moveNotice(formData: FormData) {
  await requireAdmin()
  const supabase = await createClient()

  const id = parseInt(formData.get('id') as string)
  const direction = formData.get('direction') as 'up' | 'down'

  const { data: notice } = await supabase.from('notices').select('sort_order, position').eq('id', id).single()
  if (!notice) redirect('/admin/notices')

  const newOrder = direction === 'up' ? notice.sort_order - 1 : notice.sort_order + 1
  await supabase.from('notices').update({ sort_order: newOrder }).eq('id', id)

  revalidateTag('notices', { expire: 0 })
  redirect('/admin/notices')
}

// お知らせ削除
export async function deleteNotice(formData: FormData) {
  await requireAdmin()
  const supabase = await createClient()

  const id = parseInt(formData.get('id') as string)
  await supabase.from('notices').delete().eq('id', id)

  revalidateTag('notices', { expire: 0 })
  redirect('/admin/notices')
}
