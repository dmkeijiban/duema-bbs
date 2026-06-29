/**
 * GET /api/internal/sync-typefully
 * Typefully の予約済み投稿を x_posts に保存し、scheduled_at 到来後に掲示板スレ化する。
 * GitHub Actions から呼ばれる（既存 schedule は維持）。
 * 手動実行: Authorization: Bearer ${INTERNAL_POST_SECRET}
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { notifyNewThread } from '@/lib/discord'
import {
  generateTitleFromXPost,
  hashText,
  sanitizeXPostForForumBody,
} from '@/lib/x-post-to-thread'

export const runtime = 'nodejs'
export const maxDuration = 60

const DEFAULT_MAX_NEW_PER_RUN = 5
const TYPEFULLY_API = 'https://api.typefully.com/v2'
const SCHEDULED_DRAFT_LIMIT = 50
const SCHEDULED_DRAFT_LOOKAHEAD_DAYS = 30
const PUBLISHED_DRAFT_LIMIT = 50
const PUBLISHED_DRAFT_LOOKBACK_HOURS = 48
const ERROR_MAX_LENGTH = 500
const DUE_SCAN_MIN_LIMIT = 50
const ELIGIBLE_DUE_STATUSES = [
  'scheduled',
  'posted',
  'published',
  'sent',
  'typefully_drafted',
]

type SupabaseAdmin = ReturnType<typeof createAdminClient>

interface TypefullyDraft {
  id: number | string
  preview?: string | null
  content?: string | null
  status?: string | null
  scheduled_at?: string | null
  scheduled_date?: string | null
  schedule_date?: string | null
  published_at?: string | null
  published_date?: string | null
  typefully_url?: string | null
  share_url?: string | null
}

interface TypefullyDraftDetail {
  content?: string | null
  preview?: string | null
  scheduled_at?: string | null
  scheduled_date?: string | null
  schedule_date?: string | null
  published_at?: string | null
  published_date?: string | null
  platforms?: {
    x?: {
      posts?: Array<{ text?: string | null; media_ids?: string[] | null }>
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

interface ScheduledDraftRecord {
  typefullyId: string
  sourceStatus: string
  scheduledAt: string
  threadLines: string[]
  imageUrls: string[]
  shareUrl: string | null
}

interface XPostDueRow {
  id: number
  typefully_id: string | null
  scheduled_at: string | null
  thread_lines: string[] | null
  image_urls: string[] | null
  status: string
  retry_count: number | null
}

interface ThreadSyncResult {
  xPostId: number
  typefullyId: string | null
  status: 'created' | 'duplicate' | 'skipped' | 'error'
  threadId?: number
  threadUrl?: string
  error?: string
}

function sanitizeSecretValue(value: string | undefined): string | undefined {
  return value?.replace(/^﻿/, '')
}

function normalizeError(error: string): string {
  return error.length > ERROR_MAX_LENGTH ? `${error.slice(0, ERROR_MAX_LENGTH)}...` : error
}

function parseMaxNew(value: string | null): number {
  if (!value) return DEFAULT_MAX_NEW_PER_RUN
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_MAX_NEW_PER_RUN
  return parsed
}

function getDraftScheduledAt(draft: TypefullyDraft | TypefullyDraftDetail): string | null {
  return draft.scheduled_at ?? draft.scheduled_date ?? draft.schedule_date ?? null
}

function getDraftPublishedAt(draft: TypefullyDraft | TypefullyDraftDetail): string | null {
  return draft.published_at ?? draft.published_date ?? null
}

function getDraftText(draft: TypefullyDraft, detail: TypefullyDraftDetail | null): string {
  const platformText = detail?.platforms?.x?.posts
    ?.map((post) => post.text?.trim())
    .filter((text): text is string => Boolean(text))
    .join('\n\n')

  return (
    platformText ??
    detail?.content?.trim() ??
    detail?.preview?.trim() ??
    draft.content?.trim() ??
    draft.preview?.trim() ??
    ''
  )
}

function textToThreadLines(text: string): string[] {
  return text
    .split(/\n{2,}---\n{2,}/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function isDue(isoDate: string): boolean {
  const date = new Date(isoDate)
  return !Number.isNaN(date.getTime()) && date.getTime() <= Date.now()
}

function isWithinLookahead(isoDate: string): boolean {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return false
  const maxTime = Date.now() + SCHEDULED_DRAFT_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000
  return date.getTime() <= maxTime
}

function isWithinLookback(isoDate: string): boolean {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return false
  const minTime = Date.now() - PUBLISHED_DRAFT_LOOKBACK_HOURS * 60 * 60 * 1000
  return date.getTime() >= minTime && date.getTime() <= Date.now()
}

function getPrimaryText(lines: string[] | null): string {
  return (lines ?? []).join('\n\n').trim()
}

async function fetchDraftDetail(
  apiKey: string,
  socialSetId: string,
  draftId: string,
): Promise<TypefullyDraftDetail | null> {
  try {
    const res = await fetch(`${TYPEFULLY_API}/social-sets/${socialSetId}/drafts/${draftId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      next: { revalidate: 0 },
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function fetchMediaUrl(
  apiKey: string,
  socialSetId: string,
  mediaId: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${TYPEFULLY_API}/social-sets/${socialSetId}/media/${mediaId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      next: { revalidate: 0 },
    })
    if (!res.ok) return null
    const media: TypefullyMediaStatus = await res.json()
    return media.media_urls?.medium ?? media.media_urls?.large ?? media.media_urls?.original ?? null
  } catch {
    return null
  }
}

async function fetchImageUrlsFromDetail(
  apiKey: string,
  socialSetId: string,
  detail: TypefullyDraftDetail | null,
): Promise<string[]> {
  const mediaIds = detail?.platforms?.x?.posts
    ?.flatMap((post) => post.media_ids ?? [])
    .filter((id): id is string => Boolean(id)) ?? []
  const uniqueMediaIds = Array.from(new Set(mediaIds))
  const urls = await Promise.all(
    uniqueMediaIds.map((mediaId) => fetchMediaUrl(apiKey, socialSetId, mediaId)),
  )
  return urls.filter((url): url is string => Boolean(url))
}

async function fetchScheduledDrafts(
  apiKey: string,
  socialSetId: string,
): Promise<{ drafts: ScheduledDraftRecord[]; fetched: number; error?: string; status?: number }> {
  const endpoint =
    `${TYPEFULLY_API}/social-sets/${socialSetId}/drafts?status=scheduled&order_by=scheduled_date&limit=${SCHEDULED_DRAFT_LIMIT}`

  const res = await fetch(endpoint, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
    next: { revalidate: 0 },
  })

  if (!res.ok) {
    const body = await res.text()
    console.error('[sync-typefully] Typefully scheduled drafts API error:', res.status, body.slice(0, 300))
    return { drafts: [], fetched: 0, error: 'Typefully API error', status: res.status }
  }

  const json = await res.json()
  const errField = json.detail ?? json.error ?? json.errors ?? json.message
  if (errField) {
    const message = String(errField).slice(0, 200)
    console.error('[sync-typefully] Typefully scheduled drafts response error:', message)
    return { drafts: [], fetched: 0, error: message, status: 502 }
  }
  if (!Array.isArray(json.results)) {
    console.error('[sync-typefully] Typefully scheduled drafts unexpected response:', JSON.stringify(json).slice(0, 300))
    return { drafts: [], fetched: 0, error: 'Typefully API unexpected response', status: 502 }
  }

  const records: ScheduledDraftRecord[] = []
  for (const draft of json.results as TypefullyDraft[]) {
    const typefullyId = String(draft.id ?? '')
    if (!typefullyId) continue

    const detail = await fetchDraftDetail(apiKey, socialSetId, typefullyId)
    const scheduledAt = getDraftScheduledAt(draft) ?? (detail ? getDraftScheduledAt(detail) : null)
    const text = getDraftText(draft, detail)
    if (!scheduledAt || !text.trim() || !isWithinLookahead(scheduledAt)) continue

    records.push({
      typefullyId,
      sourceStatus: draft.status ?? 'scheduled',
      scheduledAt,
      threadLines: textToThreadLines(text),
      imageUrls: await fetchImageUrlsFromDetail(apiKey, socialSetId, detail),
      shareUrl: draft.share_url ?? draft.typefully_url ?? null,
    })
  }

  return { drafts: records, fetched: json.results.length }
}

async function fetchPublishedDrafts(
  apiKey: string,
  socialSetId: string,
): Promise<{ drafts: ScheduledDraftRecord[]; fetched: number; error?: string; status?: number }> {
  const endpoint =
    `${TYPEFULLY_API}/social-sets/${socialSetId}/drafts?status=published&order_by=-published_at&limit=${PUBLISHED_DRAFT_LIMIT}`

  const res = await fetch(endpoint, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
    next: { revalidate: 0 },
  })

  if (!res.ok) {
    const body = await res.text()
    console.error('[sync-typefully] Typefully published drafts API error:', res.status, body.slice(0, 300))
    return { drafts: [], fetched: 0, error: 'Typefully published API error', status: res.status }
  }

  const json = await res.json()
  const errField = json.detail ?? json.error ?? json.errors ?? json.message
  if (errField) {
    const message = String(errField).slice(0, 200)
    console.error('[sync-typefully] Typefully published drafts response error:', message)
    return { drafts: [], fetched: 0, error: message, status: 502 }
  }
  if (!Array.isArray(json.results)) {
    console.error('[sync-typefully] Typefully published drafts unexpected response:', JSON.stringify(json).slice(0, 300))
    return { drafts: [], fetched: 0, error: 'Typefully published API unexpected response', status: 502 }
  }

  const records: ScheduledDraftRecord[] = []
  for (const draft of json.results as TypefullyDraft[]) {
    const typefullyId = String(draft.id ?? '')
    if (!typefullyId) continue

    const detail = await fetchDraftDetail(apiKey, socialSetId, typefullyId)
    const publishedAt = getDraftPublishedAt(draft) ?? (detail ? getDraftPublishedAt(detail) : null)
    const text = getDraftText(draft, detail)
    if (!publishedAt || !text.trim() || !isWithinLookback(publishedAt)) continue

    records.push({
      typefullyId,
      sourceStatus: draft.status ?? 'published',
      scheduledAt: publishedAt,
      threadLines: textToThreadLines(text),
      imageUrls: await fetchImageUrlsFromDetail(apiKey, socialSetId, detail),
      shareUrl: draft.share_url ?? draft.typefully_url ?? null,
    })
  }

  return { drafts: records, fetched: json.results.length }
}

async function saveScheduledDrafts(
  supabase: SupabaseAdmin,
  drafts: ScheduledDraftRecord[],
  dryRun: boolean,
  logLabel = 'scheduled draft',
): Promise<{ saved: number; duplicates: number; errors: number }> {
  if (drafts.length === 0) return { saved: 0, duplicates: 0, errors: 0 }

  const typefullyIds = drafts.map((draft) => draft.typefullyId)
  const { data: existingRows, error: existingError } = await supabase
    .from('x_posts')
    .select('typefully_id')
    .in('typefully_id', typefullyIds)
  if (existingError) {
    console.error('[sync-typefully] x_posts existing check error:', existingError.message)
    return { saved: 0, duplicates: 0, errors: drafts.length }
  }

  const existingIds = new Set((existingRows ?? []).map((row) => String(row.typefully_id)))
  const inserts = drafts
    .filter((draft) => !existingIds.has(draft.typefullyId))
    .map((draft) => ({
      post_type: 'custom',
      status: 'scheduled',
      title: generateTitleFromXPost(draft.threadLines.join('\n\n')),
      thread_lines: draft.threadLines,
      image_urls: draft.imageUrls,
      typefully_id: draft.typefullyId,
      typefully_share_url: draft.shareUrl,
      scheduled_at: draft.scheduledAt,
      source_ref: `typefully:${draft.typefullyId}`,
      source_status: draft.sourceStatus,
      sync_error: null,
      retry_count: 0,
    }))

  if (dryRun || inserts.length === 0) {
    return { saved: dryRun ? inserts.length : 0, duplicates: existingIds.size, errors: 0 }
  }

  const { error } = await supabase
    .from('x_posts')
    .insert(inserts)
  if (error) {
    console.error(`[sync-typefully] x_posts ${logLabel} save error:`, error.message)
    return { saved: 0, duplicates: existingIds.size, errors: inserts.length }
  }

  return { saved: inserts.length, duplicates: existingIds.size, errors: 0 }
}

async function findDueXPosts(
  supabase: SupabaseAdmin,
  limit: number,
): Promise<{ rows: XPostDueRow[]; error?: string }> {
  const { data, error } = await supabase
    .from('x_posts')
    .select('id, typefully_id, scheduled_at, thread_lines, image_urls, status, retry_count')
    .is('thread_id', null)
    .is('synced_at', null)
    .not('scheduled_at', 'is', null)
    .lte('scheduled_at', new Date().toISOString())
    .in('status', ELIGIBLE_DUE_STATUSES)
    .order('scheduled_at', { ascending: true })
    .limit(limit)

  if (error) {
    return { rows: [], error: error.message }
  }
  return { rows: (data ?? []) as XPostDueRow[] }
}

async function getChatCategory(supabase: SupabaseAdmin): Promise<{ id: number | null; name: string | null }> {
  const { data } = await supabase
    .from('categories')
    .select('id, name')
    .eq('slug', 'chat')
    .maybeSingle()

  return { id: data?.id ?? null, name: data?.name ?? null }
}

async function markXPostSynced(
  supabase: SupabaseAdmin,
  xPostId: number,
  threadId: number,
): Promise<string | null> {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('x_posts')
    .update({
      status: 'posted',
      thread_id: threadId,
      synced_at: now,
      last_attempt_at: now,
      sync_error: null,
    })
    .eq('id', xPostId)

  if (error) {
    const message = `mark_synced_failed: ${error.message}`
    console.error('[sync-typefully] x_posts mark synced error:', {
      xPostId,
      threadId,
      error: error.message,
    })
    return message
  }

  return null
}

async function markXPostError(
  supabase: SupabaseAdmin,
  row: XPostDueRow,
  error: string,
): Promise<void> {
  await supabase
    .from('x_posts')
    .update({
      status: 'error',
      sync_error: normalizeError(error),
      last_attempt_at: new Date().toISOString(),
      retry_count: (row.retry_count ?? 0) + 1,
    })
    .eq('id', row.id)
}

async function createThreadFromXPost(
  supabase: SupabaseAdmin,
  row: XPostDueRow,
  categoryId: number | null,
  categoryName: string | null,
  dryRun: boolean,
): Promise<ThreadSyncResult> {
  const rawText = getPrimaryText(row.thread_lines)
  const body = sanitizeXPostForForumBody(rawText)
  if (!body) {
    if (!dryRun) await markXPostError(supabase, row, 'empty_body')
    return { xPostId: row.id, typefullyId: row.typefully_id, status: 'skipped', error: 'empty_body' }
  }

  const textHash = hashText(body)
  const sourceId = row.typefully_id ? String(row.typefully_id) : `x_post:${row.id}`

  const { data: existingById } = await supabase
    .from('threads')
    .select('id')
    .eq('source_id', sourceId)
    .maybeSingle()
  if (existingById) {
    const markError = dryRun ? null : await markXPostSynced(supabase, row.id, existingById.id)
    if (markError) {
      return { xPostId: row.id, typefullyId: row.typefully_id, status: 'error', error: markError }
    }
    return {
      xPostId: row.id,
      typefullyId: row.typefully_id,
      status: 'duplicate',
      threadId: existingById.id,
      threadUrl: `https://www.duema-bbs.com/thread/${existingById.id}`,
    }
  }

  const { data: existingByHash } = await supabase
    .from('threads')
    .select('id')
    .eq('source_text_hash', textHash)
    .maybeSingle()
  if (existingByHash) {
    const markError = dryRun ? null : await markXPostSynced(supabase, row.id, existingByHash.id)
    if (markError) {
      return { xPostId: row.id, typefullyId: row.typefully_id, status: 'error', error: markError }
    }
    return {
      xPostId: row.id,
      typefullyId: row.typefully_id,
      status: 'duplicate',
      threadId: existingByHash.id,
      threadUrl: `https://www.duema-bbs.com/thread/${existingByHash.id}`,
    }
  }

  const title = generateTitleFromXPost(body)
  const imageUrl = row.image_urls?.[0] ?? null

  if (dryRun) {
    return {
      xPostId: row.id,
      typefullyId: row.typefully_id,
      status: 'created',
      threadId: -1,
      threadUrl: '(dry-run)',
    }
  }

  const { data: thread, error } = await supabase
    .from('threads')
    .insert({
      title,
      body,
      category_id: categoryId,
      author_name: '名無しのデュエリスト',
      ...(imageUrl ? { image_url: imageUrl } : {}),
      source: 'typefully',
      source_id: sourceId,
      source_text_hash: textHash,
    })
    .select('id')
    .single()

  if (error || !thread) {
    const message = error?.message ?? 'thread_insert_failed'
    await markXPostError(supabase, row, message)
    return { xPostId: row.id, typefullyId: row.typefully_id, status: 'error', error: message }
  }

  const markError = await markXPostSynced(supabase, row.id, thread.id)
  if (markError) {
    return { xPostId: row.id, typefullyId: row.typefully_id, status: 'error', threadId: thread.id, error: markError }
  }
  await notifyNewThread({ threadId: thread.id, title, categoryName })

  return {
    xPostId: row.id,
    typefullyId: row.typefully_id,
    status: 'created',
    threadId: thread.id,
    threadUrl: `https://www.duema-bbs.com/thread/${thread.id}`,
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const internalSecret = process.env.INTERNAL_POST_SECRET
  const isValidCron = cronSecret && authHeader === `Bearer ${cronSecret}`
  const isValidManual = internalSecret && authHeader === `Bearer ${internalSecret}`
  if (!isValidCron && !isValidManual) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = sanitizeSecretValue(process.env.TYPEFULLY_API_KEY)
  const socialSetId = sanitizeSecretValue(process.env.TYPEFULLY_SOCIAL_SET_ID)
  if (!apiKey || !socialSetId) {
    console.error('[sync-typefully] TYPEFULLY_API_KEY または TYPEFULLY_SOCIAL_SET_ID が未設定')
    return NextResponse.json({ error: 'Missing Typefully config' }, { status: 500 })
  }

  const dryRun = req.nextUrl.searchParams.get('dry_run') === '1'
  const maxNewPerRun = parseMaxNew(req.nextUrl.searchParams.get('max_new'))
  const supabase = createAdminClient()

  const fetchedScheduled = await fetchScheduledDrafts(apiKey, socialSetId)
  if (fetchedScheduled.error) {
    return NextResponse.json(
      { error: fetchedScheduled.error, status: fetchedScheduled.status ?? 502, dryRun },
      { status: fetchedScheduled.status ?? 502 },
    )
  }

  const fetchedPublished = await fetchPublishedDrafts(apiKey, socialSetId)
  if (fetchedPublished.error) {
    return NextResponse.json(
      { error: fetchedPublished.error, status: fetchedPublished.status ?? 502, dryRun },
      { status: fetchedPublished.status ?? 502 },
    )
  }

  const saveScheduledResult = await saveScheduledDrafts(supabase, fetchedScheduled.drafts, dryRun, 'scheduled draft')
  const savePublishedResult = await saveScheduledDrafts(supabase, fetchedPublished.drafts, dryRun, 'published draft')
  const dueScanLimit = Math.max(DUE_SCAN_MIN_LIMIT, maxNewPerRun * 10)
  const dueFromSaved = await findDueXPosts(supabase, dueScanLimit)
  if (dueFromSaved.error) {
    return NextResponse.json({ error: dueFromSaved.error, dryRun }, { status: 500 })
  }

  const dryRunFetchedDrafts = [...fetchedScheduled.drafts, ...fetchedPublished.drafts]
  const dryRunSeenTypefullyIds = new Set<string>()
  const dueFromFetchedDryRun: XPostDueRow[] = dryRun
    ? dryRunFetchedDrafts
        .filter((draft) => {
          if (dryRunSeenTypefullyIds.has(draft.typefullyId)) return false
          dryRunSeenTypefullyIds.add(draft.typefullyId)
          return true
        })
        .filter((draft) => isDue(draft.scheduledAt))
        .slice(0, maxNewPerRun)
        .map((draft, index) => ({
          id: -1 - index,
          typefully_id: draft.typefullyId,
          scheduled_at: draft.scheduledAt,
          thread_lines: draft.threadLines,
          image_urls: draft.imageUrls,
          status: 'scheduled',
          retry_count: 0,
        }))
    : []

  const dueRows = dryRun
    ? [...dueFromSaved.rows, ...dueFromFetchedDryRun]
    : dueFromSaved.rows

  const { id: categoryId, name: categoryName } = await getChatCategory(supabase)
  const results: ThreadSyncResult[] = []

  for (const row of dueRows.slice(0, maxNewPerRun)) {
    const createdSoFar = results.filter((result) => result.status === 'created').length
    if (createdSoFar >= maxNewPerRun) break
    results.push(await createThreadFromXPost(supabase, row, categoryId, categoryName, dryRun))
  }

  const created = results.filter((result) => result.status === 'created').length
  const duplicate = results.filter((result) => result.status === 'duplicate').length
  const errors = results.filter((result) => result.status === 'error').length
  const skipped = results.filter((result) => result.status === 'skipped').length

  console.log(
    `[sync-typefully] 完了: scheduled取得${fetchedScheduled.fetched}件 / scheduled保存予定${saveScheduledResult.saved}件` +
    ` / published取得${fetchedPublished.fetched}件 / published保存予定${savePublishedResult.saved}件` +
    ` / 保存済み重複${saveScheduledResult.duplicates + savePublishedResult.duplicates}件 / 期限到来${dueRows.length}件` +
    ` / dueScanLimit${dueScanLimit}` +
    ` / 作成${created}件 / 重複${duplicate}件 / エラー${errors}件 / スキップ${skipped}件` +
    (dryRun ? ' [DRY RUN]' : ''),
  )

  return NextResponse.json({
    dryRun,
    fetchedScheduledDrafts: fetchedScheduled.fetched,
    normalizedScheduledDrafts: fetchedScheduled.drafts.length,
    savedScheduledDrafts: saveScheduledResult.saved,
    duplicateScheduledDrafts: saveScheduledResult.duplicates,
    fetchedPublishedDrafts: fetchedPublished.fetched,
    normalizedPublishedDrafts: fetchedPublished.drafts.length,
    savedPublishedDrafts: savePublishedResult.saved,
    duplicatePublishedDrafts: savePublishedResult.duplicates,
    saveErrors: saveScheduledResult.errors + savePublishedResult.errors,
    duePosts: dueRows.length,
    dueScanLimit,
    eligibleDueStatuses: ELIGIBLE_DUE_STATUSES,
    created,
    duplicate,
    errors,
    skipped,
    results,
  })
}
