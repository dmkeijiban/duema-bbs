'use server'

import { revalidateTag } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase-admin'
import { verifyAdminCookie } from '@/lib/admin-auth'
import { createTypefullyDraft } from '@/lib/typefully'
import { buildWeeklyPosts } from '@/lib/weekly-schedule'

const ADMIN_COOKIE = 'admin_auth'
const OPT = { expire: 0 } as const

async function requireAdmin() {
  const cookieStore = await cookies()
  if (!verifyAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value)) {
    redirect('/admin')
  }
}

function invalidateXPosts() {
  revalidateTag('x_posts', OPT)
}

/** datetime-local 入力値（YYYY-MM-DDTHH:MM）をJSTとして解釈しUTC ISOに変換 */
function jstDatetimeLocalToISO(raw: string): string {
  // raw は "YYYY-MM-DDTHH:MM" 形式（秒なし）
  return new Date(raw + ':00+09:00').toISOString()
}

/** 改行区切りの画像URL文字列を配列に変換 */
function parseImageUrls(raw: string): string[] {
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('http'))
}

/** JSON 文字列を安全にパース（失敗時は空オブジェクト） */
function parseMeta(raw: string): Record<string, unknown> {
  const trimmed = raw.trim()
  if (!trimmed) return {}
  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    // ignore
  }
  return {}
}

// ----------------------------------------------------------------
// createXPost — 新規投稿作成
// ----------------------------------------------------------------
export async function createXPost(formData: FormData) {
  await requireAdmin()
  const supabase = createAdminClient()

  const post_type = formData.get('post_type') as string
  const title = (formData.get('title') as string | null)?.trim() || null
  const rawLines = formData.get('thread_lines') as string
  const thread_lines = rawLines
    .split(/\n---\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  const status = (formData.get('status') as string) || 'draft'
  const scheduledAtRaw = (formData.get('scheduled_at') as string | null) || null
  const scheduled_at = scheduledAtRaw ? jstDatetimeLocalToISO(scheduledAtRaw) : null
  const source_ref = (formData.get('source_ref') as string | null)?.trim() || null
  const image_urls = parseImageUrls((formData.get('image_urls') as string) || '')
  const meta = parseMeta((formData.get('meta') as string) || '')

  if (!post_type) redirect('/admin/x-posts?error=post_type+is+required')
  if (thread_lines.length === 0) redirect('/admin/x-posts?error=thread_lines+is+empty')

  // 優勝🏆は1日1回まで
  if (post_type === 'win' && scheduled_at) {
    const jstDateStr = new Date(new Date(scheduled_at).getTime() + 9 * 3600 * 1000)
      .toISOString()
      .slice(0, 10)
    const dayStart = new Date(jstDateStr + 'T00:00:00+09:00').toISOString()
    const dayEnd   = new Date(jstDateStr + 'T23:59:59+09:00').toISOString()
    const { data: existingWin } = await supabase
      .from('x_posts')
      .select('id')
      .eq('post_type', 'win')
      .gte('scheduled_at', dayStart)
      .lte('scheduled_at', dayEnd)
      .limit(1)
    if (existingWin && existingWin.length > 0) {
      redirect(
        `/admin/x-posts?error=${encodeURIComponent('同日に優勝🏆投稿が既に存在します（1日1回まで）')}`,
      )
    }
  }

  const { data, error } = await supabase
    .from('x_posts')
    .insert({
      post_type,
      title,
      thread_lines,
      image_urls,
      meta,
      status,
      scheduled_at: scheduled_at || null,
      source_ref,
    })
    .select('id')
    .single()

  if (error || !data) {
    redirect(`/admin/x-posts?error=${encodeURIComponent(error?.message ?? '作成失敗')}`)
  }

  invalidateXPosts()
  redirect(`/admin/x-posts/${data.id}`)
}

// ----------------------------------------------------------------
// updateXPost — 投稿編集
// ----------------------------------------------------------------
export async function updateXPost(formData: FormData) {
  await requireAdmin()
  const supabase = createAdminClient()

  const id = parseInt(formData.get('id') as string)
  const post_type = formData.get('post_type') as string
  const title = (formData.get('title') as string | null)?.trim() || null
  const rawLines = formData.get('thread_lines') as string
  const thread_lines = rawLines
    .split(/\n---\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  const status = (formData.get('status') as string) || 'draft'
  const scheduledAtRaw = (formData.get('scheduled_at') as string | null) || null
  const scheduled_at = scheduledAtRaw ? jstDatetimeLocalToISO(scheduledAtRaw) : null
  const source_ref = (formData.get('source_ref') as string | null)?.trim() || null
  const image_urls = parseImageUrls((formData.get('image_urls') as string) || '')
  const meta = parseMeta((formData.get('meta') as string) || '')

  if (!id) redirect('/admin/x-posts?error=id+missing')
  if (thread_lines.length === 0) redirect(`/admin/x-posts/${id}?error=thread_lines+is+empty`)

  const { error } = await supabase
    .from('x_posts')
    .update({
      post_type,
      title,
      thread_lines,
      image_urls,
      meta,
      status,
      scheduled_at: scheduled_at || null,
      source_ref,
    })
    .eq('id', id)

  if (error) {
    redirect(`/admin/x-posts/${id}?error=${encodeURIComponent(error.message)}`)
  }

  invalidateXPosts()
  redirect(`/admin/x-posts/${id}?saved=1`)
}

// ----------------------------------------------------------------
// deleteXPost — 投稿削除
// ----------------------------------------------------------------
export async function deleteXPost(formData: FormData) {
  await requireAdmin()
  const supabase = createAdminClient()

  const id = parseInt(formData.get('id') as string)
  await supabase.from('x_posts').delete().eq('id', id)

  invalidateXPosts()
  redirect('/admin/x-posts')
}

// ----------------------------------------------------------------
// sendToTypefully — Typefully に下書き送信
// ----------------------------------------------------------------
export async function sendToTypefully(formData: FormData) {
  await requireAdmin()
  const supabase = createAdminClient()

  const id = parseInt(formData.get('id') as string)

  const { data: post, error: fetchErr } = await supabase
    .from('x_posts')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchErr || !post) {
    redirect(`/admin/x-posts/${id}?error=${encodeURIComponent('投稿が見つかりません')}`)
  }

  // 画像URLがあれば最後のツイートの末尾に追記
  const imageUrls = (post.image_urls as string[]) ?? []
  const threadLines = [...(post.thread_lines as string[])]
  if (imageUrls.length > 0 && threadLines.length > 0) {
    threadLines[threadLines.length - 1] =
      threadLines[threadLines.length - 1] + '\n\n' + imageUrls.join('\n')
  }

  if (threadLines.length === 0) {
    redirect(`/admin/x-posts/${id}?error=${encodeURIComponent('本文が空です')}`)
  }

  const scheduleDate = post.scheduled_at ?? undefined

  const result = await createTypefullyDraft({
    threadLines,
    scheduleDate: scheduleDate ?? undefined,
  })

  if ('error' in result) {
    // エラー時はステータスを error に更新
    await supabase.from('x_posts').update({ status: 'error' }).eq('id', id)
    invalidateXPosts()
    redirect(`/admin/x-posts/${id}?error=${encodeURIComponent(result.error)}`)
  }

  // 成功：Typefully情報を保存 + ステータス更新
  const newStatus = scheduleDate ? 'scheduled' : 'typefully_drafted'
  await supabase
    .from('x_posts')
    .update({
      typefully_id: result.id,
      typefully_share_url: result.share_url,
      status: newStatus,
    })
    .eq('id', id)

  invalidateXPosts()
  redirect(`/admin/x-posts/${id}?typefully=1`)
}

// ----------------------------------------------------------------
// generateWeeklyPosts — 1週間分を一括生成（28件・draft）
// ----------------------------------------------------------------
export async function generateWeeklyPosts(formData: FormData) {
  await requireAdmin()
  const supabase = createAdminClient()

  const startDateStr = (formData.get('start_date') as string | null)?.trim()
  if (!startDateStr) {
    redirect('/admin/x-posts?error=' + encodeURIComponent('開始日を選択してください'))
  }

  // 既存タイトルを取得して重複回避
  const { data: existing } = await supabase.from('x_posts').select('title')
  const existingTitles = (existing ?? [])
    .map((p) => p.title as string | null)
    .filter((t): t is string => typeof t === 'string')

  const posts = buildWeeklyPosts(startDateStr, existingTitles)

  const { error } = await supabase.from('x_posts').insert(posts)
  if (error) {
    redirect(`/admin/x-posts?error=${encodeURIComponent(error.message)}`)
  }

  invalidateXPosts()
  redirect(`/admin/x-posts?generated=${posts.length}`)
}

// ----------------------------------------------------------------
// markAsPosted — 投稿済みにする（手動マーク）
// ----------------------------------------------------------------
export async function markAsPosted(formData: FormData) {
  await requireAdmin()
  const supabase = createAdminClient()

  const id = parseInt(formData.get('id') as string)
  await supabase
    .from('x_posts')
    .update({ status: 'posted', sent_at: new Date().toISOString() })
    .eq('id', id)

  invalidateXPosts()
  redirect(`/admin/x-posts/${id}?saved=1`)
}

// ----------------------------------------------------------------
// bulkDeleteXPosts — 一括削除
// ----------------------------------------------------------------
export async function bulkDeleteXPosts(formData: FormData) {
  await requireAdmin()
  const supabase = createAdminClient()

  const ids: number[] = JSON.parse(formData.get('ids') as string)
  if (ids.length === 0) redirect('/admin/x-posts')

  const { error: delErr } = await supabase.from('x_posts').delete().in('id', ids)
  if (delErr) {
    redirect(`/admin/x-posts?error=${encodeURIComponent(delErr.message)}`)
  }

  invalidateXPosts()
  redirect(`/admin/x-posts?deleted=${ids.length}`)
}

// ----------------------------------------------------------------
// bulkSendToTypefully — 一括Typefully送信
// ----------------------------------------------------------------
export async function bulkSendToTypefully(formData: FormData) {
  await requireAdmin()
  const supabase = createAdminClient()

  const ids: number[] = JSON.parse(formData.get('ids') as string)
  if (ids.length === 0) redirect('/admin/x-posts')

  // N+1解消: 対象IDを一括取得
  const { data: allPosts, error: fetchErr } = await supabase
    .from('x_posts')
    .select('*')
    .in('id', ids)
  if (fetchErr || !allPosts) {
    redirect(`/admin/x-posts?error=${encodeURIComponent(fetchErr?.message ?? '取得失敗')}`)
  }

  let ok = 0
  let ng = 0
  let scheduled = 0

  for (const post of allPosts) {

    const imageUrls = (post.image_urls as string[]) ?? []
    const threadLines = [...(post.thread_lines as string[])]
    if (imageUrls.length > 0 && threadLines.length > 0) {
      threadLines[threadLines.length - 1] += '\n\n' + imageUrls.join('\n')
    }
    if (threadLines.length === 0) { ng++; continue }

    const result = await createTypefullyDraft({
      threadLines,
      scheduleDate: post.scheduled_at ?? undefined,
    })

    if ('error' in result) {
      await supabase.from('x_posts').update({ status: 'error' }).eq('id', post.id)
      ng++
    } else {
      const newStatus = post.scheduled_at ? 'scheduled' : 'typefully_drafted'
      if (newStatus === 'scheduled') scheduled++
      await supabase
        .from('x_posts')
        .update({
          typefully_id: result.id,
          typefully_share_url: result.share_url,
          status: newStatus,
        })
        .eq('id', post.id)
      ok++
    }
  }

  invalidateXPosts()
  redirect(`/admin/x-posts?bulk_typefully=${ok}&bulk_scheduled=${scheduled}&bulk_errors=${ng}`)
}

// ----------------------------------------------------------------
// bulkUpdateStatus — 一括ステータス変更
// ----------------------------------------------------------------
export async function bulkUpdateStatus(formData: FormData) {
  await requireAdmin()
  const supabase = createAdminClient()

  const ids: number[] = JSON.parse(formData.get('ids') as string)
  const status = formData.get('status') as string
  if (ids.length === 0 || !status) redirect('/admin/x-posts')

  const { error: updateErr } = await supabase.from('x_posts').update({ status }).in('id', ids)
  if (updateErr) {
    redirect(`/admin/x-posts?error=${encodeURIComponent(updateErr.message)}`)
  }

  invalidateXPosts()
  redirect(`/admin/x-posts?status_updated=${ids.length}`)
}
