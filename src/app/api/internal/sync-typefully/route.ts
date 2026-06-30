/**
 * GET /api/internal/sync-typefully
 *
 * Typefully API だけを見て、今日分の予約投稿を x_posts に保存する。
 * 掲示板スレ化は x_posts.scheduled_at が到来した行だけを処理する。
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { notifyNewThread } from '@/lib/discord'
import {
  generateTitleFromXPost,
  hashText,
} from '@/lib/x-post-to-thread'

export const runtime = 'nodejs'
export const maxDuration = 60

const TYPEFULLY_API = 'https://api.typefully.com/v2'
const TYPEFULLY_DRAFT_LIMIT = 50
const DEFAULT_MAX_NEW_PER_RUN = 5
const DUE_LOOKBACK_HOURS = 24
const ERROR_MAX_LENGTH = 500
const CANCELLED_SOURCE_STATUSES = new Set(['cancelled', 'canceled', 'deleted'])
const ELIGIBLE_X_POST_STATUSES = ['scheduled', 'posted', 'published', 'sent', 'typefully_drafted']

type SupabaseAdmin = ReturnType<typeof createAdminClient>
type SyncMode = 'fetch_today' | 'sync_due' | 'fetch_and_sync'

interface TypefullyDraft {
  id?: number | string | null
  preview?: string | null
  content?: string | null
  status?: string | null
  scheduled_at?: string | null
  scheduled_date?: string | null
  schedule_date?: string | null
  typefully_url?: string | null
  share_url?: string | null
}

interface TypefullyDraftDetail {
  content?: string | null
  preview?: string | null
  scheduled_at?: string | null
  scheduled_date?: string | null
  schedule_date?: string | null
  platforms?: {
    x?: {
      posts?: Array<{ text?: string | null }>
    }
  }
}

interface TodayTypefullyPost {
  typefullyId: string
  sourceStatus: string
  scheduledAt: string
  body: string
  shareUrl: string | null
}

interface ExistingXPost {
  id: number
  typefully_id: string | null
  thread_id: number | null
  meta: Record<string, unknown> | null
}

interface XPostDueRow {
  id: number
  typefully_id: string | null
  scheduled_at: string | null
  thread_lines: string[] | null
  status: string
  source_status: string | null
  source_ref: string | null
  retry_count: number | null
  thread_id: number | null
  meta: Record<string, unknown> | null
}

interface ThreadSyncResult {
  xPostId: number
  typefullyId: string | null
  status: 'created' | 'duplicate' | 'skipped' | 'error'
  threadId?: number
  threadUrl?: string
  error?: string
}

interface TypefullyPostSummary {
  typefullyId: string
  scheduledAt: string
  scheduledAtJst: string
  sourceStatus: string
  bodyPreview: string
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

function parseMode(value: string | null): SyncMode {
  if (value === 'fetch_today' || value === 'sync_due' || value === 'fetch_and_sync') return value
  return 'fetch_and_sync'
}

function formatJstDate(date: Date): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function isTodayInJst(isoDate: string, now = new Date()): boolean {
  const date = new Date(isoDate)
  return !Number.isNaN(date.getTime()) && formatJstDate(date) === formatJstDate(now)
}

function formatJstDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getDraftScheduledAt(draft: TypefullyDraft | TypefullyDraftDetail): string | null {
  return draft.scheduled_at ?? draft.scheduled_date ?? draft.schedule_date ?? null
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
  ).trim()
}

function textToThreadLines(text: string): string[] {
  return text
    .split(/\n{2,}---\n{2,}/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function getPrimaryText(lines: string[] | null): string {
  return (lines ?? []).join('\n\n').trim()
}

function summarizeTypefullyPosts(posts: TodayTypefullyPost[]): TypefullyPostSummary[] {
  return posts.map((post) => ({
    typefullyId: post.typefullyId,
    scheduledAt: post.scheduledAt,
    scheduledAtJst: formatJstDateTime(post.scheduledAt),
    sourceStatus: post.sourceStatus,
    bodyPreview: post.body.slice(0, 80),
  }))
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

async function fetchTodayTypefullyPosts(
  apiKey: string,
  socialSetId: string,
): Promise<{ posts: TodayTypefullyPost[]; fetched: number; error?: string; status?: number }> {
  const endpoint =
    `${TYPEFULLY_API}/social-sets/${socialSetId}/drafts?status=scheduled&order_by=scheduled_date&limit=${TYPEFULLY_DRAFT_LIMIT}`

  const res = await fetch(endpoint, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
    next: { revalidate: 0 },
  })

  if (!res.ok) {
    const body = await res.text()
    console.error('[sync-typefully] Typefully scheduled drafts API error:', res.status, body.slice(0, 300))
    return { posts: [], fetched: 0, error: 'Typefully API error', status: res.status }
  }

  const json = await res.json()
  const errField = json.detail ?? json.error ?? json.errors ?? json.message
  if (errField) {
    const message = String(errField).slice(0, 200)
    console.error('[sync-typefully] Typefully scheduled drafts response error:', message)
    return { posts: [], fetched: 0, error: message, status: 502 }
  }
  if (!Array.isArray(json.results)) {
    console.error('[sync-typefully] Typefully scheduled drafts unexpected response:', JSON.stringify(json).slice(0, 300))
    return { posts: [], fetched: 0, error: 'Typefully API unexpected response', status: 502 }
  }

  const posts: TodayTypefullyPost[] = []
  for (const draft of json.results as TypefullyDraft[]) {
    const draftId = draft.id != null ? String(draft.id) : ''
    const detail = draftId ? await fetchDraftDetail(apiKey, socialSetId, draftId) : null
    const scheduledAt = getDraftScheduledAt(draft) ?? (detail ? getDraftScheduledAt(detail) : null)
    const body = getDraftText(draft, detail)
    if (!scheduledAt || !isTodayInJst(scheduledAt)) continue

    const typefullyId = draftId || `scheduled:${scheduledAt}:${hashText(body)}`
    posts.push({
      typefullyId,
      sourceStatus: draft.status ?? 'scheduled',
      scheduledAt,
      body,
      shareUrl: draft.share_url ?? draft.typefully_url ?? null,
    })
  }

  return { posts, fetched: json.results.length }
}

async function upsertTodayTypefullyPosts(
  supabase: SupabaseAdmin,
  posts: TodayTypefullyPost[],
  dryRun: boolean,
): Promise<{ saved: number; updated: number; locked: number; errors: number; duplicate: number }> {
  if (posts.length === 0) return { saved: 0, updated: 0, locked: 0, errors: 0, duplicate: 0 }

  const fetchedAt = new Date().toISOString()
  const typefullyIds = posts.map((post) => post.typefullyId)
  const { data, error } = await supabase
    .from('x_posts')
    .select('id, typefully_id, thread_id, meta')
    .in('typefully_id', typefullyIds)

  if (error) {
    console.error('[sync-typefully] x_posts existing check error:', error.message)
    return { saved: 0, updated: 0, locked: 0, errors: posts.length, duplicate: 0 }
  }

  const existingByTypefullyId = new Map(
    ((data ?? []) as ExistingXPost[]).map((row) => [String(row.typefully_id), row]),
  )

  let saved = 0
  let updated = 0
  let locked = 0
  let errors = 0
  let duplicate = 0

  for (const post of posts) {
    const existing = existingByTypefullyId.get(post.typefullyId)
    const threadLines = textToThreadLines(post.body)
    const nextMeta = {
      ...(existing?.meta ?? {}),
      fetched_from_typefully_at: fetchedAt,
    }

    if (dryRun) {
      if (!existing) saved++
      else if (existing.thread_id == null) updated++
      else locked++
      continue
    }

    if (!existing) {
      const { error: insertError } = await supabase
        .from('x_posts')
        .insert({
          post_type: 'custom',
          status: 'scheduled',
          title: generateTitleFromXPost(post.body) || 'デュエマ掲示板投稿',
          thread_lines: threadLines,
          image_urls: [],
          typefully_id: post.typefullyId,
          typefully_share_url: post.shareUrl,
          scheduled_at: post.scheduledAt,
          source_ref: `typefully:${post.typefullyId}`,
          source_status: post.sourceStatus,
          sync_error: null,
          retry_count: 0,
          meta: nextMeta,
        })
      if (insertError) {
        errors++
        console.error('[sync-typefully] x_posts insert error:', insertError.message)
      } else {
        saved++
      }
      continue
    }

    duplicate++
    if (existing.thread_id != null) {
      locked++
      const { error: updateMetaError } = await supabase
        .from('x_posts')
        .update({
          source_status: post.sourceStatus,
          meta: nextMeta,
        })
        .eq('id', existing.id)
      if (updateMetaError) {
        errors++
        console.error('[sync-typefully] x_posts locked meta update error:', updateMetaError.message)
      }
      continue
    }

    const { error: updateError } = await supabase
      .from('x_posts')
      .update({
        status: 'scheduled',
        title: generateTitleFromXPost(post.body) || 'デュエマ掲示板投稿',
        thread_lines: threadLines,
        image_urls: [],
        typefully_share_url: post.shareUrl,
        scheduled_at: post.scheduledAt,
        source_ref: `typefully:${post.typefullyId}`,
        source_status: post.sourceStatus,
        sync_error: null,
        meta: nextMeta,
      })
      .eq('id', existing.id)
      .is('thread_id', null)

    if (updateError) {
      errors++
      console.error('[sync-typefully] x_posts update error:', updateError.message)
    } else {
      updated++
    }
  }

  return { saved, updated, locked, errors, duplicate }
}

async function findDueXPosts(
  supabase: SupabaseAdmin,
  limit: number,
): Promise<{ rows: XPostDueRow[]; error?: string }> {
  const now = new Date()
  const minScheduledAt = new Date(now.getTime() - DUE_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('x_posts')
    .select('id, typefully_id, scheduled_at, thread_lines, status, source_status, source_ref, retry_count, thread_id, meta')
    .is('thread_id', null)
    .not('scheduled_at', 'is', null)
    .gte('scheduled_at', minScheduledAt)
    .lte('scheduled_at', now.toISOString())
    .in('status', ELIGIBLE_X_POST_STATUSES)
    .order('scheduled_at', { ascending: true })
    .limit(limit)

  if (error) return { rows: [], error: error.message }

  const rows = ((data ?? []) as XPostDueRow[]).filter((row) => {
    const sourceStatus = row.source_status?.toLowerCase()
    const isTypefullySource = Boolean(row.typefully_id) || row.source_ref?.startsWith('typefully:')
    return isTypefullySource && (!sourceStatus || !CANCELLED_SOURCE_STATUSES.has(sourceStatus))
  })
  return { rows }
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
  row: XPostDueRow,
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
      meta: {
        ...(row.meta ?? {}),
        thread_created_at: now,
      },
    })
    .eq('id', row.id)
    .is('thread_id', null)

  if (error) {
    const message = `mark_synced_failed: ${error.message}`
    console.error('[sync-typefully] x_posts mark synced error:', { xPostId: row.id, threadId, error: error.message })
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
    .is('thread_id', null)
}

async function createThreadFromXPost(
  supabase: SupabaseAdmin,
  row: XPostDueRow,
  categoryId: number | null,
  categoryName: string | null,
  dryRun: boolean,
): Promise<ThreadSyncResult> {
  const rawBody = getPrimaryText(row.thread_lines)
  const body = rawBody.trim()
  if (!body) {
    if (!dryRun) await markXPostError(supabase, row, 'empty_body')
    return { xPostId: row.id, typefullyId: row.typefully_id, status: 'skipped', error: 'empty_body' }
  }

  const { data: latestRow, error: latestError } = await supabase
    .from('x_posts')
    .select('thread_id')
    .eq('id', row.id)
    .maybeSingle()
  if (latestError) {
    if (!dryRun) await markXPostError(supabase, row, latestError.message)
    return { xPostId: row.id, typefullyId: row.typefully_id, status: 'error', error: latestError.message }
  }
  if (latestRow?.thread_id) {
    return { xPostId: row.id, typefullyId: row.typefully_id, status: 'duplicate', threadId: latestRow.thread_id }
  }

  const textHash = hashText(body)
  const sourceId = row.typefully_id ? String(row.typefully_id) : `x_post:${row.id}`

  const { data: existingById } = await supabase
    .from('threads')
    .select('id')
    .eq('source_id', sourceId)
    .maybeSingle()
  if (existingById) {
    const markError = dryRun ? null : await markXPostSynced(supabase, row, existingById.id)
    if (markError) return { xPostId: row.id, typefullyId: row.typefully_id, status: 'error', error: markError }
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
    const markError = dryRun ? null : await markXPostSynced(supabase, row, existingByHash.id)
    if (markError) return { xPostId: row.id, typefullyId: row.typefully_id, status: 'error', error: markError }
    return {
      xPostId: row.id,
      typefullyId: row.typefully_id,
      status: 'duplicate',
      threadId: existingByHash.id,
      threadUrl: `https://www.duema-bbs.com/thread/${existingByHash.id}`,
    }
  }

  const title = generateTitleFromXPost(body) || 'デュエマ掲示板投稿'
  if (dryRun) {
    return { xPostId: row.id, typefullyId: row.typefully_id, status: 'created', threadId: -1, threadUrl: '(dry-run)' }
  }

  const { data: thread, error } = await supabase
    .from('threads')
    .insert({
      title,
      body,
      category_id: categoryId,
      author_name: '名無しのデュエリスト',
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

  const markError = await markXPostSynced(supabase, row, thread.id)
  if (markError) return { xPostId: row.id, typefullyId: row.typefully_id, status: 'error', threadId: thread.id, error: markError }
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

  const mode = parseMode(req.nextUrl.searchParams.get('mode'))
  const dryRun = req.nextUrl.searchParams.get('dry_run') === '1'
  const maxNewPerRun = parseMaxNew(req.nextUrl.searchParams.get('max_new'))
  const supabase = createAdminClient()

  let fetchedTodayPosts = 0
  let normalizedTodayPosts = 0
  let savedTodayPosts = 0
  let updatedTodayPosts = 0
  let lockedThreadedPosts = 0
  let duplicateTodayPosts = 0
  let saveErrors = 0
  let todayTypefullyPosts: TypefullyPostSummary[] = []

  if (mode === 'fetch_today' || mode === 'fetch_and_sync') {
    const apiKey = sanitizeSecretValue(process.env.TYPEFULLY_API_KEY)
    const socialSetId = sanitizeSecretValue(process.env.TYPEFULLY_SOCIAL_SET_ID)
    if (!apiKey || !socialSetId) {
      console.error('[sync-typefully] TYPEFULLY_API_KEY または TYPEFULLY_SOCIAL_SET_ID が未設定')
      return NextResponse.json({ error: 'Missing Typefully config', mode, dryRun }, { status: 500 })
    }

    const fetched = await fetchTodayTypefullyPosts(apiKey, socialSetId)
    if (fetched.error) {
      return NextResponse.json(
        { error: fetched.error, status: fetched.status ?? 502, mode, dryRun },
        { status: fetched.status ?? 502 },
      )
    }

    fetchedTodayPosts = fetched.fetched
    normalizedTodayPosts = fetched.posts.length
    todayTypefullyPosts = summarizeTypefullyPosts(fetched.posts)
    const saveResult = await upsertTodayTypefullyPosts(supabase, fetched.posts, dryRun)
    savedTodayPosts = saveResult.saved
    updatedTodayPosts = saveResult.updated
    lockedThreadedPosts = saveResult.locked
    duplicateTodayPosts = saveResult.duplicate
    saveErrors = saveResult.errors
  }

  let dueRows: XPostDueRow[] = []
  let created = 0
  let duplicate = 0
  let errors = 0
  let skipped = 0
  const results: ThreadSyncResult[] = []

  if (mode === 'sync_due' || mode === 'fetch_and_sync') {
    const due = await findDueXPosts(supabase, maxNewPerRun * 5)
    if (due.error) {
      return NextResponse.json({ error: due.error, mode, dryRun }, { status: 500 })
    }
    dueRows = due.rows

    const { id: categoryId, name: categoryName } = await getChatCategory(supabase)
    for (const row of dueRows.slice(0, maxNewPerRun)) {
      const result = await createThreadFromXPost(supabase, row, categoryId, categoryName, dryRun)
      results.push(result)
    }

    created = results.filter((result) => result.status === 'created').length
    duplicate = results.filter((result) => result.status === 'duplicate').length
    errors = results.filter((result) => result.status === 'error').length
    skipped = results.filter((result) => result.status === 'skipped').length
  }

  console.log(
    `[sync-typefully] mode=${mode} dryRun=${dryRun}` +
    ` fetchedToday=${fetchedTodayPosts} normalizedToday=${normalizedTodayPosts}` +
    ` saved=${savedTodayPosts} updated=${updatedTodayPosts} duplicateToday=${duplicateTodayPosts}` +
    ` lockedThreaded=${lockedThreadedPosts} saveErrors=${saveErrors}` +
    ` duePosts=${dueRows.length} created=${created} duplicate=${duplicate} skipped=${skipped} errors=${errors}`,
  )

  return NextResponse.json({
    mode,
    dryRun,
    fetchedTodayTypefullyPosts: fetchedTodayPosts,
    normalizedTodayTypefullyPosts: normalizedTodayPosts,
    savedTodayTypefullyPosts: savedTodayPosts,
    updatedTodayTypefullyPosts: updatedTodayPosts,
    duplicateTodayTypefullyPosts: duplicateTodayPosts,
    todayTypefullyPosts,
    lockedThreadedPosts,
    saveErrors,
    duePosts: dueRows.length,
    dueLookbackHours: DUE_LOOKBACK_HOURS,
    eligibleDueStatuses: ELIGIBLE_X_POST_STATUSES,
    cancelledSourceStatuses: Array.from(CANCELLED_SOURCE_STATUSES),
    created,
    duplicate,
    errors,
    skipped,
    results,
  })
}
