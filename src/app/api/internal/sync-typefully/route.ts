/**
 * GET /api/internal/sync-typefully
 * Typefully の公開済み投稿を掲示板スレッドに自動同期する
 * Vercel Cron から呼ばれる（7:20 / 10:20 / 12:20 / 22:20 JST）
 * 手動実行: Authorization: Bearer ${INTERNAL_POST_SECRET}
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { notifyNewThread, notifySyncSummary } from '@/lib/discord'
import {
  generateTitleFromXPost,
  hashText,
} from '@/lib/x-post-to-thread'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * 1回のCron実行で新規作成できるスレッド数の上限。
 * 長期間失敗していた場合にバックフィルで大量作成→掲示板が溢れるのを防ぐ。
 * 手動実行（INTERNAL_POST_SECRET）ではこの制限を外せる（limit クエリパラメータで上書き可能）。
 */
const DEFAULT_MAX_NEW_PER_RUN = 5

const TYPEFULLY_API = 'https://api.typefully.com/v2'

interface TypefullyDraft {
  id: number
  preview: string
  published_at: string | null
  status: string
  x_published_url: string | null
}

interface TypefullyDraftDetail {
  platforms?: {
    x?: {
      posts?: Array<{ media_ids?: string[] }>
    }
  }
}

interface TypefullyMediaStatus {
  media_urls?: {
    medium?: string
    large?: string
    original?: string
  }
}

interface SyncResult {
  draftId: number
  status: 'created' | 'duplicate' | 'skipped' | 'error'
  threadId?: number
  threadUrl?: string
  error?: string
}

/**
 * Typefully の下書き詳細から1枚目の画像 URL を取得する
 * 画像がない・取得失敗の場合は null を返す
 */
async function fetchFirstImageUrl(
  apiKey: string,
  socialSetId: string,
  draftId: number,
): Promise<string | null> {
  try {
    const detailRes = await fetch(
      `${TYPEFULLY_API}/social-sets/${socialSetId}/drafts/${draftId}`,
      { headers: { 'Authorization': `Bearer ${apiKey}` }, next: { revalidate: 0 } },
    )
    if (!detailRes.ok) return null
    const detail: TypefullyDraftDetail = await detailRes.json()
    const mediaId = detail.platforms?.x?.posts?.[0]?.media_ids?.[0]
    if (!mediaId) return null

    const mediaRes = await fetch(
      `${TYPEFULLY_API}/social-sets/${socialSetId}/media/${mediaId}`,
      { headers: { 'Authorization': `Bearer ${apiKey}` }, next: { revalidate: 0 } },
    )
    if (!mediaRes.ok) return null
    const media: TypefullyMediaStatus = await mediaRes.json()
    return media.media_urls?.medium ?? media.media_urls?.original ?? null
  } catch {
    return null
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // 認証チェック
  // Vercel Cron は Authorization: Bearer {CRON_SECRET} を自動付与
  // 手動実行は Authorization: Bearer {INTERNAL_POST_SECRET} を使用
  const authHeader = req.headers.get('authorization')
  if (authHeader) {
    const cronSecret = process.env.CRON_SECRET
    const internalSecret = process.env.INTERNAL_POST_SECRET
    const isValidCron = cronSecret && authHeader === `Bearer ${cronSecret}`
    const isValidManual = internalSecret && authHeader === `Bearer ${internalSecret}`
    if (!isValidCron && !isValidManual) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // BOM (U+FEFF) が混入した場合に備えて除去
  const apiKey = process.env.TYPEFULLY_API_KEY?.replace(/^﻿/, '')
  const socialSetId = process.env.TYPEFULLY_SOCIAL_SET_ID?.replace(/^﻿/, '')

  if (!apiKey || !socialSetId) {
    console.error('[sync-typefully] TYPEFULLY_API_KEY または TYPEFULLY_SOCIAL_SET_ID が未設定')
    return NextResponse.json({ error: 'Missing Typefully config' }, { status: 500 })
  }

  // 手動実行時は max_new クエリパラメータで上限を変更可能（例: ?max_new=50 で一括バックフィル）
  const maxNewRaw = req.nextUrl.searchParams.get('max_new')
  const maxNewPerRun = maxNewRaw ? parseInt(maxNewRaw, 10) : DEFAULT_MAX_NEW_PER_RUN

  // ── Typefully から公開済み投稿を取得 ────────────────────────────────────────
  // limit=50 で過去2週間程度の投稿を拾い、長期失敗後のバックフィルに対応する
  const url = `${TYPEFULLY_API}/social-sets/${socialSetId}/drafts?status=published&order_by=-published_at&limit=50`
  let drafts: TypefullyDraft[] = []

  try {
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      next: { revalidate: 0 },
    })
    if (!res.ok) {
      const body = await res.text()
      console.error('[sync-typefully] Typefully API error:', res.status, body)
      return NextResponse.json({ error: 'Typefully API error', status: res.status }, { status: 502 })
    }
    const json = await res.json()
    if (!Array.isArray(json.results)) {
      console.error('[sync-typefully] Typefully API unexpected response:', JSON.stringify(json).slice(0, 200))
      return NextResponse.json({ error: 'Typefully API unexpected response', body: json }, { status: 502 })
    }
    drafts = json.results
  } catch (err) {
    console.error('[sync-typefully] fetch error:', err)
    return NextResponse.json({ error: 'Fetch failed' }, { status: 500 })
  }

  const supabase = createAdminClient()
  const results: SyncResult[] = []

  for (const draft of drafts) {
    // 1回のCronで新規作成できるスレッド数の上限チェック
    const newSoFar = results.filter(r => r.status === 'created').length
    if (newSoFar >= maxNewPerRun) {
      console.log(`[sync-typefully] 新規上限(${maxNewPerRun}件)に達したため残りをスキップ`)
      break
    }

    const text = draft.preview?.trim()
    if (!text) {
      results.push({ draftId: draft.id, status: 'skipped' })
      continue
    }

    const textHash = hashText(text)

    // ── 重複チェック ──────────────────────────────────────────────────────────
    const { data: existing } = await supabase
      .from('threads')
      .select('id')
      .eq('source_text_hash', textHash)
      .maybeSingle()

    if (existing) {
      results.push({ draftId: draft.id, status: 'duplicate', threadId: existing.id })
      continue
    }

    // ── タイトル・カテゴリ・画像取得 ──────────────────────────────────────────
    const title = generateTitleFromXPost(text)
    // X自動投稿はすべて「雑談」カテゴリに固定
    const { data: categoryRow } = await supabase
      .from('categories')
      .select('id, name')
      .eq('slug', 'chat')
      .maybeSingle()

    const categoryId: number | null = categoryRow?.id ?? null
    const categoryName: string | null = categoryRow?.name ?? null

    // 画像が設定されていれば1枚目を取得（なければ null のまま）
    const imageUrl = await fetchFirstImageUrl(apiKey, socialSetId, draft.id)

    // ── スレッド作成 ──────────────────────────────────────────────────────────
    const { data: thread, error: insertError } = await supabase
      .from('threads')
      .insert({
        title,
        body: title,
        category_id: categoryId,
        author_name: '名無しのデュエリスト',
        ...(imageUrl ? { image_url: imageUrl } : {}),
        source: 'typefully',
        source_id: String(draft.id),
        source_text_hash: textHash,
      })
      .select('id')
      .single()

    if (insertError) {
      if (insertError.code === '23505') {
        results.push({ draftId: draft.id, status: 'duplicate' })
      } else {
        console.error('[sync-typefully] insert error:', insertError)
        results.push({ draftId: draft.id, status: 'error', error: insertError.message })
      }
      continue
    }

    const threadId = thread.id
    const threadUrl = `https://www.duema-bbs.com/thread/${threadId}`

    await notifyNewThread({ threadId, title, categoryName })

    results.push({ draftId: draft.id, status: 'created', threadId, threadUrl })
    console.log(`[sync-typefully] ✅ created: threadId=${threadId} title="${title}"`)
  }

  const created = results.filter(r => r.status === 'created').length
  const duplicate = results.filter(r => r.status === 'duplicate').length
  const errors = results.filter(r => r.status === 'error').length

  console.log(`[sync-typefully] 完了: 作成${created}件 / 重複スキップ${duplicate}件 / エラー${errors}件 / 取得${drafts.length}件`)

  // ── Discord サマリー通知 ──────────────────────────────────────────────────
  // 毎回送ることで「Cronが動いたか」を Discord で確認できる。
  // 公開済みがあるのに0件作成ならアラート付きで通知。
  await notifySyncSummary({ created, duplicate, errors, totalDrafts: drafts.length })

  return NextResponse.json({ created, duplicate, errors, totalDrafts: drafts.length, results })
}
