'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'

import { verifyAdminCookie } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'

export type AdminActionState = { status: 'idle' | 'success' | 'error'; message?: string }

const TABLE_BY_TYPE: Record<string, string> = {
  pack_review: 'zukan_pack_reviews',
  card_review: 'zukan_card_reviews',
  rating: 'zukan_card_ratings',
}

async function requireAdmin() {
  const cookieStore = await cookies()
  const token = cookieStore.get('admin_auth')?.value
  if (!verifyAdminCookie(token)) throw new Error('Unauthorized')
}

export async function toggleZukanHidden(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  try {
    await requireAdmin()
    const type = String(formData.get('type') || '')
    const id = String(formData.get('id') || '')
    const hidden = String(formData.get('hidden') || '') === 'true'
    const table = TABLE_BY_TYPE[type]
    if (!table || !id) return { status: 'error', message: '不正なリクエストです' }

    const supabase = createAdminClient()
    const { error } = await supabase.from(table).update({ is_hidden: hidden }).eq('id', id)
    if (error) return { status: 'error', message: error.message }

    revalidatePath('/admin/zukan')
    revalidatePath('/zukan/dm-01')
    return { status: 'success', message: hidden ? '非表示にしました' : '再表示しました' }
  } catch {
    return { status: 'error', message: 'エラーが発生しました' }
  }
}

export async function saveAdminNote(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  try {
    await requireAdmin()
    const postType = String(formData.get('post_type') || '')
    const postId = Number(formData.get('post_id') || 0)
    const note = String(formData.get('note') || '').trim()

    if (!TABLE_BY_TYPE[postType] || !postId) {
      return { status: 'error', message: '不正なリクエストです' }
    }

    const supabase = createAdminClient()
    const { error } = await supabase
      .from('zukan_admin_notes')
      .upsert(
        { post_type: postType, post_id: postId, note, updated_at: new Date().toISOString() },
        { onConflict: 'post_type,post_id' }
      )
    if (error) return { status: 'error', message: error.message }

    revalidatePath('/admin/zukan')
    return { status: 'success', message: '保存しました' }
  } catch {
    return { status: 'error', message: 'エラーが発生しました' }
  }
}

export async function saveCardMemo(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  try {
    await requireAdmin()
    const cardId = String(formData.get('card_id') || '')
    const body = String(formData.get('body') || '').trim().slice(0, 200)

    if (!cardId) return { status: 'error', message: '不正なリクエストです' }

    const supabase = createAdminClient()
    const { error } = await supabase
      .from('zukan_card_memos')
      .upsert(
        { card_id: cardId, body, updated_at: new Date().toISOString() },
        { onConflict: 'card_id' }
      )
    if (error) return { status: 'error', message: error.message }

    revalidatePath('/zukan/card/[slug]', 'page')
    revalidatePath('/admin/zukan/cards')
    return { status: 'success', message: '保存しました' }
  } catch {
    return { status: 'error', message: 'エラーが発生しました' }
  }
}

export async function addRelatedThread(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  try {
    await requireAdmin()
    const cardId = String(formData.get('card_id') || '')
    const threadId = String(formData.get('thread_id') || '').trim()

    if (!cardId || !threadId) return { status: 'error', message: 'スレッドIDを入力してください' }

    const supabase = createAdminClient()

    // Check thread exists
    const { data: thread } = await supabase
      .from('threads')
      .select('id, title')
      .eq('id', threadId)
      .single()
    if (!thread) return { status: 'error', message: 'スレッドが見つかりません' }

    // Check max 5
    const { count } = await supabase
      .from('zukan_related_threads')
      .select('id', { count: 'exact', head: true })
      .eq('card_id', cardId)
    if ((count ?? 0) >= 5) return { status: 'error', message: '最大5件まで登録できます' }

    const { error } = await supabase
      .from('zukan_related_threads')
      .insert({ card_id: cardId, thread_id: threadId, sort_order: count ?? 0 })
    if (error) {
      if (error.code === '23505') return { status: 'error', message: 'すでに登録済みです' }
      return { status: 'error', message: error.message }
    }

    revalidatePath('/zukan/card/[slug]', 'page')
    revalidatePath('/admin/zukan/cards')
    return { status: 'success', message: `「${thread.title}」を追加しました` }
  } catch {
    return { status: 'error', message: 'エラーが発生しました' }
  }
}

export async function removeRelatedThread(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  try {
    await requireAdmin()
    const linkId = Number(formData.get('link_id') || 0)
    const cardId = String(formData.get('card_id') || '')
    if (!linkId) return { status: 'error', message: '不正なリクエストです' }

    const supabase = createAdminClient()
    const { error } = await supabase
      .from('zukan_related_threads')
      .delete()
      .eq('id', linkId)
    if (error) return { status: 'error', message: error.message }

    revalidatePath('/zukan/card/[slug]', 'page')
    revalidatePath('/admin/zukan/cards')
    return { status: 'success', message: '削除しました' }
  } catch {
    return { status: 'error', message: 'エラーが発生しました' }
  }
}
