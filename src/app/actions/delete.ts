'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

async function getSessionId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get('bbs_session')?.value ?? null
}

async function isCurrentUserWithdrawn(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<boolean> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  const user = userData.user
  if (userError || !user) return false

  const { data: profile } = await supabase
    .from('profiles')
    .select('withdrawn_at')
    .eq('id', user.id)
    .maybeSingle()

  return Boolean(profile?.withdrawn_at)
}

export async function deleteOwnThread(threadId: number) {
  const sessionId = await getSessionId()
  if (!sessionId) return { error: 'セッションが見つかりません' }

  const supabase = await createClient()
  if (await isCurrentUserWithdrawn(supabase)) {
    return { error: '退会済みアカウントでは削除できません' }
  }

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
  const supabase = await createClient()
  if (await isCurrentUserWithdrawn(supabase)) {
    return { error: '退会済みアカウントでは削除できません' }
  }

  const { data: post } = await supabase
    .from('posts')
    .select('id, thread_id, user_id, session_id, is_deleted')
    .eq('id', postId)
    .eq('thread_id', threadId)
    .single()

  if (!post) return { error: 'レスが見つかりません' }
  if (post.is_deleted) return { error: 'このコメントはすでに削除されています' }

  if (post.user_id) {
    const { data: userData, error: authError } = await supabase.auth.getUser()
    const authUser = userData.user

    if (authError || !authUser) {
      return { error: 'ログイン状態を確認できませんでした。再読み込みしてお試しください' }
    }
    if (post.user_id !== authUser.id) {
      return { error: 'このコメントは削除できません' }
    }

    const adminClient = createAdminClient()
    const { data: updated, error: updateError } = await adminClient
      .from('posts')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: 'registered_user',
      })
      .eq('id', post.id)
      .eq('thread_id', post.thread_id)
      .eq('user_id', authUser.id)
      .eq('is_deleted', false)
      .select('id')

    if (updateError) {
      console.error('[deleteOwnPost] update error:', updateError.message)
      return { error: '削除に失敗しました' }
    }
    if (!updated || updated.length !== 1) {
      console.error('[deleteOwnPost] updated row count:', updated?.length ?? 0)
      return { error: '削除に失敗しました' }
    }

    await adminClient.rpc('recalculate_post_count', { p_thread_id: threadId })

    revalidateTag(`thread-${threadId}`, { expire: 0 })
    revalidateTag('threads', { expire: 0 })
    revalidateTag('posts', { expire: 0 })
    revalidatePath(`/thread/${threadId}`)
    revalidatePath('/')
    revalidatePath('/mypage')
    revalidatePath('/settings')
    return { success: true }
  }

  const sessionId = await getSessionId()
  if (!sessionId) return { error: 'セッションが見つかりません' }

  const isPostAuthor = post.session_id === sessionId

  const { data: thread } = await supabase
    .from('threads')
    .select('session_id')
    .eq('id', threadId)
    .single()

  const isThreadOwner = thread?.session_id === sessionId
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
