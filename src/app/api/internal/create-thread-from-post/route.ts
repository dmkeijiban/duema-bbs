/**
 * POST /api/internal/create-thread-from-post
 * X投稿テキストからスレッドを自動作成する内部API
 * Auth: Authorization: Bearer ${INTERNAL_POST_SECRET}
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { notifyNewThread } from '@/lib/discord'
import {
  generateTitleFromXPost,
  detectCategorySlugFromXPost,
  hashText,
} from '@/lib/x-post-to-thread'

interface CreateThreadFromPostBody {
  text: string
  imageUrl?: string
  source?: string
  sourceId?: string
  scheduledAt?: string
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── 認証 ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization')
  const secret = process.env.INTERNAL_POST_SECRET
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── リクエストボディ ───────────────────────────────────────────────────────
  let body: CreateThreadFromPostBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { text, imageUrl, source, sourceId, scheduledAt } = body

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 })
  }

  const trimmedText = text.trim()
  const textHash = hashText(trimmedText)

  const supabase = createAdminClient()

  // ── 重複チェック ──────────────────────────────────────────────────────────
  const { data: existing } = await supabase
    .from('threads')
    .select('id')
    .eq('source_text_hash', textHash)
    .maybeSingle()

  if (existing) {
    const threadUrl = `https://www.duema-bbs.com/thread/${existing.id}`
    return NextResponse.json(
      { error: 'duplicate', threadId: existing.id, threadUrl },
      { status: 409 }
    )
  }

  // ── タイトル生成 ──────────────────────────────────────────────────────────
  const title = generateTitleFromXPost(trimmedText)

  // ── カテゴリ解決 ──────────────────────────────────────────────────────────
  const categorySlug = detectCategorySlugFromXPost(trimmedText)
  const { data: categoryRow } = await supabase
    .from('categories')
    .select('id, name')
    .eq('slug', categorySlug)
    .maybeSingle()

  const categoryId: number | null = categoryRow?.id ?? null
  const categoryName: string | null = categoryRow?.name ?? null

  // ── スレッド作成 ──────────────────────────────────────────────────────────
  const insertData: Record<string, unknown> = {
    title,
    body: trimmedText,
    category_id: categoryId,
    author_name: 'X自動投稿',
    source_text_hash: textHash,
  }

  if (imageUrl && imageUrl.trim()) {
    insertData.image_url = imageUrl.trim()
  }
  if (source) {
    insertData.source = source
  }
  if (sourceId) {
    insertData.source_id = sourceId
  }

  const { data: thread, error: insertError } = await supabase
    .from('threads')
    .insert(insertData)
    .select('id')
    .single()

  if (insertError) {
    // unique 制約違反（競合）
    if (insertError.code === '23505') {
      return NextResponse.json({ error: 'duplicate' }, { status: 409 })
    }
    console.error('[create-thread-from-post] insert error:', insertError)
    return NextResponse.json(
      { error: 'Database error', detail: insertError.message },
      { status: 500 }
    )
  }

  const threadId = thread.id
  const threadUrl = `https://www.duema-bbs.com/thread/${threadId}`

  // ── Discord 通知（失敗してもスレッド作成は成功扱い）────────────────────
  await notifyNewThread({ threadId, title, categoryName })

  return NextResponse.json({ threadId, threadUrl }, { status: 201 })
}
