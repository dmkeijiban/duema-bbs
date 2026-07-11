'use server'

import { cookies } from 'next/headers'
import { revalidatePath, revalidateTag } from 'next/cache'
import { v4 as uuidv4 } from 'uuid'
import { verifyAdminCookie } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { DEFAULT_PUBLIC_AUTHOR_NAME } from '@/lib/cached-queries'
import { uploadImage, validateImageFile } from '@/lib/upload'
import { BULK_THREAD_BODY_MAX, BULK_THREAD_COMMENT_LIMIT, BULK_THREAD_COMMENT_MAX, BULK_THREAD_TITLE_MAX } from '@/lib/thread-bulk-create'

type CommentInput = { body: string; internalMemo: string; permissionConfirmedOn: string; textState: 'original' | 'lightly_edited' }
export type BulkCreateResult = { ok: boolean; message: string; threadId?: number }

async function requireAdmin() {
  const store = await cookies()
  if (!verifyAdminCookie(store.get('admin_auth')?.value)) throw new Error('Unauthorized')
}

export async function createConsentedBulkThread(formData: FormData): Promise<BulkCreateResult> {
  await requireAdmin()
  const title = String(formData.get('title') ?? '').trim()
  const body = String(formData.get('body') ?? '').trim()
  let comments: CommentInput[]
  try { comments = JSON.parse(String(formData.get('comments') ?? '[]')) as CommentInput[] } catch { return { ok: false, message: 'コメント形式が不正です。' } }
  comments = comments.filter(item => item.body?.trim()).slice(0, BULK_THREAD_COMMENT_LIMIT)
  if (!title) return { ok: false, message: 'タイトルは必須です。' }
  if (title.length > BULK_THREAD_TITLE_MAX || body.length > BULK_THREAD_BODY_MAX) return { ok: false, message: 'タイトルまたは本文が文字数上限を超えています。' }
  if (comments.some(item => item.body.trim().length > BULK_THREAD_COMMENT_MAX)) return { ok: false, message: '文字数上限を超えたコメントがあります。' }
  if (comments.some(item => !/^\d{4}-\d{2}-\d{2}$/.test(item.permissionConfirmedOn))) return { ok: false, message: '全コメントの許可確認日を入力してください。' }

  const supabase = createAdminClient()
  const image = formData.get('image') as File | null
  let uploaded: { url: string; thumbnailUrl: string | null; width: number; height: number } | null = null
  if (image?.size) {
    const invalid = validateImageFile(image)
    if (invalid) return { ok: false, message: invalid }
    const result = await uploadImage(image, supabase, `threads/${uuidv4()}`, 'post', { createListThumbnail: true })
    if (!result.data) return { ok: false, message: result.error ?? '画像アップロードに失敗しました。' }
    uploaded = result.data
  }

  const { data, error } = await supabase.rpc('admin_create_consented_thread', {
    p_title: title, p_body: body || '', p_author_name: DEFAULT_PUBLIC_AUTHOR_NAME,
    p_image_url: uploaded?.url ?? null, p_thumbnail_url: uploaded?.thumbnailUrl ?? null,
    p_image_width: uploaded?.width ?? null, p_image_height: uploaded?.height ?? null,
    p_comments: comments.map(item => ({ body: item.body.trim(), internal_memo: item.internalMemo.trim(), permission_confirmed_on: item.permissionConfirmedOn, text_state: item.textState })),
    p_registered_by: 'admin-cookie',
  })
  if (error || !data) return { ok: false, message: `登録に失敗しました: ${error?.message ?? 'unknown error'}` }
  const threadId = Number(data)
  revalidateTag('threads', { expire: 0 }); revalidateTag(`thread-${threadId}`, { expire: 0 })
  revalidatePath('/'); revalidatePath('/category', 'layout'); revalidatePath('/ranking'); revalidatePath(`/thread/${threadId}`); revalidatePath('/admin')
  return { ok: true, message: `スレッド1件とコメント${comments.length}件を登録しました。`, threadId }
}
