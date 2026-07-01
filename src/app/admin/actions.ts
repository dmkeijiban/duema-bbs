'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath, revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { NoticeItem } from '@/components/NoticeBlock'
import { createAdminCookieValue, isAdminPassword, verifyAdminCookie } from '@/lib/admin-auth'

const ADMIN_COOKIE = 'admin_auth'
type AdminClient = ReturnType<typeof createAdminClient>
type BanType = 'session' | 'user'
const POSTING_BAN_REASON_PREFIX = 'posting_ban:'

async function checkAdmin() {
  const cookieStore = await cookies()
  const val = cookieStore.get(ADMIN_COOKIE)?.value
  if (!verifyAdminCookie(val)) {
    throw new Error('Unauthorized')
  }
}

function appendAdminStatus(returnPath: string, key: string, value: string) {
  return `${returnPath}${returnPath.includes('?') ? '&' : '?'}${key}=${value}`
}

function logBanError(context: string, error: {
  code?: string
  message?: string
  details?: string
  hint?: string
} | null, banType: BanType) {
  console.error(`[adminBanSession] ${context}`, {
    code: error?.code,
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
    banType,
  })
}

function isMissingColumn(error: { code?: string; message?: string } | null, column: string) {
  return error?.code === '42703' || error?.message?.includes(column)
}

function isMissingTable(error: { code?: string; message?: string } | null, table: string) {
  return error?.code === '42P01' || error?.code === 'PGRST205' || error?.message?.includes(table)
}

function isMissingBanKeyColumn(error: { code?: string; message?: string } | null) {
  return isMissingColumn(error, 'ban_type') || isMissingColumn(error, 'ban_value')
}

async function upsertModerationBan(
  supabase: AdminClient,
  banType: BanType,
  banValue: string,
  reason: string,
) {
  const { data: existing, error: fetchError } = await supabase
    .from('moderation_bans')
    .select('id')
    .eq('ban_type', banType)
    .eq('ban_value', banValue)
    .limit(1)

  if (fetchError) {
    if (isMissingTable(fetchError, 'moderation_bans')) {
      return upsertPostingBanMute(supabase, banType, banValue, reason)
    }
    if (banType === 'session' && isMissingBanKeyColumn(fetchError)) {
      return upsertLegacySessionBan(supabase, banValue, reason)
    }
    logBanError('fetch failed', fetchError, banType)
    return { error: fetchError }
  }

  const payload = {
    reason,
    is_active: true,
    expires_at: null,
  }
  const fallbackPayload = {
    reason,
    is_active: true,
  }

  const existingId = Array.isArray(existing) ? existing[0]?.id : null

  let result = existingId
    ? await supabase
      .from('moderation_bans')
      .update(payload)
      .eq('id', existingId)
    : await supabase
      .from('moderation_bans')
      .insert({
        ban_type: banType,
        ban_value: banValue,
        ...payload,
      })

  if (result.error && isMissingColumn(result.error, 'expires_at')) {
    result = existingId
      ? await supabase
        .from('moderation_bans')
        .update(fallbackPayload)
        .eq('id', existingId)
      : await supabase
        .from('moderation_bans')
        .insert({
          ban_type: banType,
          ban_value: banValue,
          ...fallbackPayload,
        })
  }

  if (result.error) {
    if (isMissingTable(result.error, 'moderation_bans')) {
      return upsertPostingBanMute(supabase, banType, banValue, reason)
    }
    logBanError('write failed', result.error, banType)
  }

  return { error: result.error }
}

async function upsertPostingBanMute(
  supabase: AdminClient,
  banType: BanType,
  banValue: string,
  reason: string,
) {
  const prefixedReason = `${POSTING_BAN_REASON_PREFIX}${reason}`
  let query = supabase
    .from('report_mutes')
    .select('id')
    .eq('is_active', true)
    .like('reason', `${POSTING_BAN_REASON_PREFIX}%`)
    .limit(1)

  query = banType === 'user'
    ? query.eq('user_id', banValue)
    : query.eq('session_id', banValue)

  const { data: existing, error: fetchError } = await query

  if (fetchError) {
    logBanError('report_mutes fallback fetch failed', fetchError, banType)
    return { error: fetchError }
  }

  const existingId = Array.isArray(existing) ? existing[0]?.id : null
  const payload = banType === 'user'
    ? { user_id: banValue, session_id: null, reason: prefixedReason, is_active: true }
    : { user_id: null, session_id: banValue, reason: prefixedReason, is_active: true }

  const result = existingId
    ? await supabase
      .from('report_mutes')
      .update(payload)
      .eq('id', existingId)
    : await supabase
      .from('report_mutes')
      .insert(payload)

  if (result.error) {
    logBanError('report_mutes fallback write failed', result.error, banType)
  }

  return { error: result.error }
}

async function upsertLegacySessionBan(
  supabase: AdminClient,
  sessionId: string,
  reason: string,
) {
  const { data: existing, error: fetchError } = await supabase
    .from('moderation_bans')
    .select('id')
    .eq('session_id', sessionId)
    .limit(1)

  if (fetchError) {
    logBanError('legacy fetch failed', fetchError, 'session')
    return { error: fetchError }
  }

  const existingId = Array.isArray(existing) ? existing[0]?.id : null
  const payload = { reason, is_active: true }
  const result = existingId
    ? await supabase
      .from('moderation_bans')
      .update(payload)
      .eq('id', existingId)
    : await supabase
      .from('moderation_bans')
      .insert({
        session_id: sessionId,
        ...payload,
      })

  if (result.error) {
    logBanError('legacy write failed', result.error, 'session')
  }

  return { error: result.error }
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
  const threadPage = Math.max(1, parseInt(formData.get('threadPage') as string) || 1)
  const supabase = createAdminClient()

  await supabase.from('threads').update({ is_archived: true }).eq('id', threadId)

  revalidatePath('/')
  revalidatePath('/admin')
  revalidateTag('threads', { expire: 0 })
  redirect(threadPage > 1 ? `/admin?threadPage=${threadPage}` : '/admin')
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

  revalidateTag(`thread-${threadId}`, { expire: 0 })
  revalidateTag('threads', { expire: 0 })
  revalidatePath(`/thread/${threadId}`)
  revalidatePath('/')
  revalidatePath('/admin')
  redirect('/admin')
}

/**
 * ⚠️⚠️⚠️  絶対ルール：既存投稿本文の上書き禁止  ⚠️⚠️⚠️
 *
 * この関数は「誤字修正などごくまれな例外」のみを想定した管理者専用操作です。
 * 以下の用途での使用は厳禁です：
 *
 *   ❌ リバイバル・復旧・補完目的での本文上書き
 *   ❌ AI 生成コンテンツによる既存コメントの置き換え
 *   ❌ スクリプト・自動化・バッチからの呼び出し
 *   ❌ 複数投稿への一括適用
 *
 * 許可されるのは以下のみ：
 *   ✅ 管理者が手動で、特定の1件の誤字・不正コンテンツを修正する場合
 *   ✅ 事前に対象ID・変更前本文・変更後本文・差分をユーザーに提示して確認を得た場合
 *
 * 実行前後の本文差分は Vercel ログに記録されます（監査証跡）。
 * dry-run なし・差分未確認での実行は禁止です。
 */
export async function adminUpdatePost(formData: FormData) {
  await checkAdmin()
  const postId = parseInt(formData.get('postId') as string)
  const threadId = parseInt(formData.get('threadId') as string)
  const newBody = formData.get('body') as string
  const supabase = createAdminClient()

  // 変更前の本文を取得（監査証跡用）
  const { data: existing, error: fetchError } = await supabase
    .from('posts')
    .select('id, body, created_at')
    .eq('id', postId)
    .single()

  if (fetchError || !existing) {
    throw new Error(`投稿取得失敗 (id=${postId}): ${fetchError?.message ?? 'Not found'}`)
  }

  // 監査ログ：変更前後の本文を記録（Vercel Functions ログに残る）
  console.warn(
    `[adminUpdatePost] AUDIT: post_id=${postId} thread_id=${threadId}\n` +
    `  BEFORE: ${JSON.stringify(existing.body)}\n` +
    `  AFTER:  ${JSON.stringify(newBody.trim())}\n` +
    `  created_at: ${existing.created_at}`
  )

  const { error } = await supabase.from('posts').update({ body: newBody.trim() }).eq('id', postId)

  if (error) throw new Error(`投稿更新失敗: ${error.message}`)

  revalidateTag(`thread-${threadId}`, { expire: 0 })
  revalidatePath(`/thread/${threadId}`)
  revalidatePath('/admin')
  redirect(`/admin?thread=${threadId}`)
}

export async function adminAddNgWord(formData: FormData) {
  await checkAdmin()
  const word = (formData.get('word') as string)?.trim()
  const note = (formData.get('note') as string)?.trim() || null
  if (!word) redirect('/admin')

  const supabase = createAdminClient()
  await supabase
    .from('moderation_ng_words')
    .upsert({ word, note, is_active: true }, { onConflict: 'word' })

  revalidatePath('/admin')
  redirect('/admin')
}

export async function adminDisableNgWord(formData: FormData) {
  await checkAdmin()
  const id = parseInt(formData.get('id') as string)
  const supabase = createAdminClient()
  await supabase.from('moderation_ng_words').update({ is_active: false }).eq('id', id)

  revalidatePath('/admin')
  redirect('/admin')
}

export async function adminBanSession(formData: FormData) {
  await checkAdmin()
  const sessionId = (formData.get('sessionId') as string)?.trim()
  const userId = (formData.get('userId') as string)?.trim()
  const reason = (formData.get('reason') as string)?.trim() || 'admin'
  const returnToThread = formData.get('returnToThread') as string | null
  const threadPage = Math.max(1, parseInt(formData.get('threadPage') as string) || 1)
  const returnPath = returnToThread
    ? `/admin?thread=${returnToThread}`
    : threadPage > 1
      ? `/admin?threadPage=${threadPage}`
      : '/admin'

  if (!sessionId && !userId) redirect(appendAdminStatus(returnPath, 'adminError', 'missing_session'))

  const supabase = createAdminClient()
  const results = []
  if (sessionId) {
    results.push(await upsertModerationBan(supabase, 'session', sessionId, reason))
  }
  if (userId) {
    results.push(await upsertModerationBan(supabase, 'user', userId, reason))
  }

  if (results.some(result => result.error)) {
    redirect(appendAdminStatus(returnPath, 'adminError', 'ban_failed'))
  }

  revalidatePath('/admin')
  redirect(appendAdminStatus(returnPath, 'ban', '1'))
}

export async function adminBanIpHash(formData: FormData) {
  await checkAdmin()
  const ipHash = (formData.get('ipHash') as string)?.trim()
  const reason = (formData.get('reason') as string)?.trim() || 'admin'
  const returnToThread = formData.get('returnToThread') as string | null
  if (!ipHash) redirect(returnToThread ? `/admin?thread=${returnToThread}` : '/admin')

  const supabase = createAdminClient()
  await supabase
    .from('moderation_bans')
    .upsert({
      ban_type: 'ip_hash',
      ban_value: ipHash,
      reason,
      is_active: true,
      expires_at: null,
    }, { onConflict: 'ban_type,ban_value' })

  revalidatePath('/admin')
  redirect(returnToThread ? `/admin?thread=${returnToThread}` : '/admin')
}

export async function adminUnbanSession(formData: FormData) {
  await checkAdmin()
  const id = parseInt(formData.get('id') as string)
  const supabase = createAdminClient()
  await supabase.from('moderation_bans').update({ is_active: false }).eq('id', id)

  revalidatePath('/admin')
  redirect('/admin')
}

export async function adminToggleThreadCommentLock(formData: FormData) {
  await checkAdmin()
  const threadId = parseInt(formData.get('threadId') as string)
  const current = formData.get('commentLocked') === 'true'
  const returnToThread = formData.get('returnToThread') === 'true'
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('threads')
    .update({ comment_locked: !current })
    .eq('id', threadId)

  if (error) {
    const message = error.code === '42703'
      ? 'comment_lockedカラムが未適用です。20260701_comment_spam_controls.sql を適用してください。'
      : error.message
    redirect(`/admin?error=${encodeURIComponent(message)}`)
  }

  revalidateTag(`thread-${threadId}`, { expire: 0 })
  revalidatePath(`/thread/${threadId}`)
  revalidatePath('/admin')
  redirect(returnToThread ? `/admin?thread=${threadId}` : '/admin')
}

export async function adminHidePostsBySession(formData: FormData) {
  await checkAdmin()
  const threadId = parseInt(formData.get('threadId') as string)
  const sessionId = (formData.get('sessionId') as string)?.trim()
  if (!threadId || !sessionId) redirect(threadId ? `/admin?thread=${threadId}` : '/admin')

  const supabase = createAdminClient()
  await supabase
    .from('posts')
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: 'admin-session-bulk',
    })
    .eq('thread_id', threadId)
    .eq('session_id', sessionId)
    .eq('is_deleted', false)
  await supabase.rpc('recalculate_post_count', { p_thread_id: threadId })

  revalidateTag(`thread-${threadId}`, { expire: 0 })
  revalidatePath(`/thread/${threadId}`)
  revalidatePath('/admin')
  redirect(`/admin?thread=${threadId}`)
}

export async function adminHidePostsByIpHash(formData: FormData) {
  await checkAdmin()
  const threadId = parseInt(formData.get('threadId') as string)
  const ipHash = (formData.get('ipHash') as string)?.trim()
  if (!threadId || !ipHash) redirect(threadId ? `/admin?thread=${threadId}` : '/admin')

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('posts')
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: 'admin-ip-bulk',
    })
    .eq('thread_id', threadId)
    .eq('ip_hash', ipHash)
    .eq('is_deleted', false)

  if (error) {
    const message = error.code === '42703'
      ? 'ip_hashカラムが未適用です。20260701_comment_spam_controls.sql を適用してください。'
      : error.message
    redirect(`/admin?thread=${threadId}&error=${encodeURIComponent(message)}`)
  }

  await supabase.rpc('recalculate_post_count', { p_thread_id: threadId })

  revalidateTag(`thread-${threadId}`, { expire: 0 })
  revalidatePath(`/thread/${threadId}`)
  revalidatePath('/admin')
  redirect(`/admin?thread=${threadId}`)
}

export async function adminToggleArchive(formData: FormData) {
  await checkAdmin()
  const threadId = parseInt(formData.get('threadId') as string)
  const current = formData.get('isArchived') === 'true'
  const threadPage = Math.max(1, parseInt(formData.get('threadPage') as string) || 1)
  const q = (formData.get('q') as string | null)?.trim()
  const supabase = createAdminClient()

  await supabase.from('threads').update({ is_archived: !current }).eq('id', threadId)

  revalidateTag(`thread-${threadId}`, { expire: 0 })
  revalidateTag('threads', { expire: 0 })
  revalidatePath(`/thread/${threadId}`)
  revalidatePath('/')
  revalidatePath('/category', 'layout')
  revalidatePath('/ranking')
  revalidatePath('/summary', 'layout')
  revalidatePath('/feed.xml')
  revalidatePath('/sitemap.xml')
  revalidatePath('/admin')

  const params = new URLSearchParams()
  if (threadPage > 1) params.set('threadPage', String(threadPage))
  if (q) params.set('q', q)
  params.set(current ? 'unhidden' : 'hidden', '1')
  redirect(`/admin?${params.toString()}`)
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
  // site_settings の書き込みはサービスロールクライアント経由（RLS で anon/authenticated の書き込みを禁止するため）
  const supabase = createAdminClient()
  await supabase
    .from('site_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  revalidatePath('/', 'layout')
  revalidatePath('/terms')
  redirect('/admin')
}
