'use server'

import { revalidatePath } from 'next/cache'
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

  const { error } = await supabase.from('threads').delete().eq('id', threadId)
  if (error) return { error: '削除に失敗しました' }

  revalidatePath('/')
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
    .select('session_id')
    .eq('id', postId)
    .single()

  if (!post) return { error: 'レスが見つかりません' }

  const isPostAuthor = post.session_id === sessionId

  // スレ主チェック
  const { data: thread } = await supabase
    .from('threads')
    .select('session_id')
    .eq('id', threadId)
    .single()

  const isThreadOwner = thread?.session_id === sessionId

  if (!isPostAuthor && !isThreadOwner) return { error: '削除権限がありません' }

  const { error } = await supabase.from('posts').delete().eq('id', postId)
  if (error) return { error: '削除に失敗しました' }

  await supabase.rpc('recalculate_post_count', { p_thread_id: threadId })

  revalidatePath(`/thread/${threadId}`)
  revalidatePath('/')
  revalidatePath('/settings')
  return { success: true }
}
