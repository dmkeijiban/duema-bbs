'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase-server'

async function getSessionId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get('bbs_session')?.value ?? null
}

export async function deleteOwnThread(threadId: number) {
  const sessionId = await getSessionId()
  if (!sessionId) return { error: 'セッションが見つかりません' }

  const supabase = await createClient()
  const { data: thread } = await supabase
    .from('threads')
    .select('session_id')
    .eq('id', threadId)
    .single()

  if (!thread) return { error: 'スレッドが見つかりません' }
  if (thread.session_id !== sessionId) return { error: '削除権限がありません' }

  const { error } = await supabase
    .from('threads')
    .update({ is_archived: true })
    .eq('id', threadId)
  if (error) return { error: '削除に失敗しました' }

  revalidatePath('/')
  revalidateTag('threads', { expire: 0 })
  revalidatePath('/settings')
  return { success: true }
}

export async function removeFavorite(threadId: number) {
  const sessionId = await getSessionId()
  if (!sessionId) return { error: 'セッションが見つかりません' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('session_id', sessionId)
    .eq('thread_id', threadId)

  if (error) return { error: '削除に失敗しました' }

  revalidatePath('/settings')
  return { success: true }
}

export async function deleteOwnPost(postId: number, threadId: number) {
  const sessionId = await getSessionId()
  if (!sessionId) return { error: 'セッションが見つかりません' }

  const supabase = await createClient()

  // 投稿者本人 or スレ主どちらでも削除可
  const { data: post } = await supabase
    .from('posts')
    .select('session_id, user_id')
    .eq('id', postId)
    .eq('thread_id', threadId)
    .single()

  if (!post) return { error: 'レスが見つかりません' }

  const { data: userData } = await supabase.auth.getUser()
  const currentUserId = userData.user?.id ?? null
  const isPostAuthor = post.session_id === sessionId
  const isRegisteredAuthor = !!currentUserId && post.user_id === currentUserId

  // スレ主チェック
  const { data: thread } = await supabase
    .from('threads')
    .select('session_id')
    .eq('id', threadId)
    .single()

  const isThreadOwner = thread?.session_id === sessionId

  if (isRegisteredAuthor) {
    const { error } = await supabase.from('posts').update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: 'registered_user',
    }).eq('id', postId).eq('thread_id', threadId)
    if (error) return { error: '削除に失敗しました' }

    revalidateTag(`thread-${threadId}`, { expire: 0 })
    revalidateTag('threads', { expire: 0 })
    revalidateTag('posts', { expire: 0 })
    revalidatePath(`/thread/${threadId}`)
    revalidatePath('/')
    revalidatePath('/mypage')
    return { success: true }
  }

  if (!isPostAuthor && !isThreadOwner) return { error: '削除権限がありません' }

  const deletedBy = isPostAuthor ? 'user' : 'thread_owner'
  const { error } = await supabase.from('posts').update({
    is_deleted: true,
    deleted_at: new Date().toISOString(),
    deleted_by: deletedBy,
  }).eq('id', postId)
  if (error) return { error: '削除に失敗しました' }

  await supabase.rpc('recalculate_post_count', { p_thread_id: threadId })

  revalidateTag(`thread-${threadId}`, { expire: 0 })
  revalidateTag('threads', { expire: 0 })
  revalidateTag('posts', { expire: 0 })
  revalidatePath(`/thread/${threadId}`)
  revalidatePath('/')
  revalidatePath('/settings')
  return { success: true }
}
