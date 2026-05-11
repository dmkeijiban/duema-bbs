'use server'

import { cookies } from 'next/headers'
import { revalidatePath, revalidateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase-admin'
import { verifyAdminCookie } from '@/lib/admin-auth'
import { COMMENT_IMPORT_LIMIT } from '@/lib/comment-import'
import { THREAD_POSTS_PER_PAGE } from '@/lib/cached-queries'

const ADMIN_COOKIE = 'admin_auth'

async function checkAdmin() {
  const cookieStore = await cookies()
  if (!verifyAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value)) {
    throw new Error('Unauthorized')
  }
}

export interface BulkImportResult {
  ok: boolean
  message: string
  inserted?: number
}

export async function bulkImportThreadComments(formData: FormData): Promise<BulkImportResult> {
  await checkAdmin()

  const threadId = parseInt(String(formData.get('threadId') ?? ''))
  const comments = formData
    .getAll('comments')
    .map(value => String(value).trim())
    .filter(Boolean)
    .slice(0, COMMENT_IMPORT_LIMIT)

  if (!threadId || Number.isNaN(threadId)) {
    return { ok: false, message: 'スレッドIDが不正です。' }
  }
  if (comments.length === 0) {
    return { ok: false, message: '投稿するコメントがありません。' }
  }

  const supabase = createAdminClient()
  const { data: thread } = await supabase
    .from('threads')
    .select('id')
    .eq('id', threadId)
    .single()

  if (!thread) return { ok: false, message: '指定したスレッドが見つかりません。' }

  const { data: maxPost } = await supabase
    .from('posts')
    .select('post_number')
    .eq('thread_id', threadId)
    .order('post_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  const startPostNumber = (maxPost?.post_number ?? 0) + 1
  const now = new Date().toISOString()
  const rows = comments.map((body, index) => ({
    thread_id: threadId,
    post_number: startPostNumber + index,
    body,
    created_at: now,
  }))

  const { error } = await supabase.from('posts').insert(rows)
  if (error) return { ok: false, message: `投稿に失敗しました: ${error.message}` }

  const { count } = await supabase
    .from('posts')
    .select('id', { count: 'exact', head: true })
    .eq('thread_id', threadId)
    .eq('is_deleted', false)

  const totalPostCount = (count ?? 0) + 1
  await supabase
    .from('threads')
    .update({ post_count: totalPostCount, last_posted_at: now })
    .eq('id', threadId)

  const totalPages = Math.max(1, Math.ceil(totalPostCount / THREAD_POSTS_PER_PAGE))
  revalidateTag(`thread-${threadId}`, { expire: 0 })
  revalidateTag('threads', { expire: 0 })
  revalidatePath('/')
  revalidatePath(`/thread/${threadId}`)
  for (let page = 2; page <= totalPages; page++) {
    revalidatePath(`/thread/${threadId}/p/${page}`)
  }
  revalidatePath('/admin')
  revalidatePath('/admin/comment-import')

  return { ok: true, message: `${comments.length}件のコメントを投稿しました。`, inserted: comments.length }
}
