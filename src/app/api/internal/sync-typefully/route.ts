/**
 * GET /api/internal/sync-typefully
 *
 * Typefully API だけを見て、今日分の予約投稿を x_posts に保存する。
 * 掲示板スレ化は x_posts.scheduled_at が到来した行だけを処理する。
 * 手動実行: Authorization: Bearer ${INTERNAL_POST_SECRET}
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { notifyNewThread, notifySyncSummary } from '@/lib/discord'
import {
  generateTitleFromXPost,
  hashText,
} from '@/lib/x-post-to-thread'
import {
  extensionForImageContentType,
  extractTypefullyMedia,
  shouldBlockThreadForMissingMedia,
} from '@/lib/typefully-media'

export const runtime = 'nodejs'
export const maxDuration = 60

const TYPEFULLY_API = 'https://api.typefully.com/v2'
const TYPEFULLY_DRAFT_LIMIT = 50
const DEFAULT_MAX_NEW_PER_RUN = 5
const DUE_LOOKBACK_HOURS = 24
const IMAGE_RECOVERY_LOOKBACK_DAYS = 7
const ERROR_MAX_LENGTH = 500
const FIXED_POST_JST_HOURS = [7, 12, 19, 22]
const FIXED_SLOT_TOLERANCE_MINUTES = 45
const PUBLISHED_FALLBACK_GRACE_MINUTES = 0
const CANCELLED_SOURCE_STATUSES = new Set(['cancelled', 'canceled', 'deleted', 'daily_zukan_skipped'])
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
  published_at?: string | null
  typefully_url?: string | null
  share_url?: string | null
  x_published_url?: string | null
  media_ids?: unknown
  media_urls?: unknown
  image_urls?: unknown
  images?: unknown
  media?: unknown
  attachments?: unknown
}

interface TypefullyDraftDetail {
  content?: string | null
  preview?: string | null
  scheduled_at?: string | null
  scheduled_date?: string | null
  schedule_date?: string | null
  published_at?: string | null
  platforms?: {
    x?: {
      posts?: Array<{
        text?: string | null
        media_ids?: unknown
        media_urls?: unknown
        image_urls?: unknown
        images?: unknown
        media?: unknown
        attachments?: unknown
      }>
    }
  }
  media_ids?: unknown
  media_urls?: unknown
  image_urls?: unknown
  images?: unknown
  media?: unknown
  attachments?: unknown
}

interface TodayTypefullyPost {
  typefullyId: string
  sourceStatus: string
  scheduledAt: string
  body: string
  imageUrls: string[]
  expectsMedia: boolean
  mediaPaths: string[]
  shareUrl: string | null
}

interface ExistingXPost {
  id: number
  typefully_id: string | null
  thread_id: number | null
  image_urls: string[] | null
  typefully_share_url: string | null
  scheduled_at: string | null
  thread_lines: string[] | null
  source_ref: string | null
  meta: Record<string, unknown> | null
}

interface XPostDueRow {
  id: number
  typefully_id: string | null
  scheduled_at: string | null
  thread_lines: string[] | null
  image_urls: string[] | null
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
  status: 'created' | 'duplicate' | 'skipped' | 'skipped_daily_zukan' | 'error'
  threadId?: number
  threadUrl?: string
  imageUrl?: string
  error?: string
}

interface TypefullyPostSummary {
  typefullyId: string
  scheduledAt: string
  scheduledAtJst: string
  sourceStatus: string
  bodyPreview: string
  imageUrls: string[]
  expectsMedia: boolean
  mediaPaths: string[]
}

type PublishedFallbackSkipReasons = Record<string, number>

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

function getDraftPublishedAt(draft: TypefullyDraft | TypefullyDraftDetail): string | null {
  return draft.published_at ?? null
}

function getJstDayWindow(now = new Date()): { start: Date; end: Date } {
  const jstDate = formatJstDate(now)
  const start = new Date(`${jstDate}T00:00:00+09:00`)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { start, end }
}

function getJstMinutesOfDay(dateStr: string): number | null {
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return null

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const hour = Number(parts.find((part) => part.type === 'hour')?.value)
  const minute = Number(parts.find((part) => part.type === 'minute')?.value)
  return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : null
}

function distanceToFixedSlotMinutes(dateStr: string): number {
  const minutes = getJstMinutesOfDay(dateStr)
  if (minutes == null) return Number.MAX_SAFE_INTEGER
  return Math.min(
    ...FIXED_POST_JST_HOURS.map((hour) => Math.abs(minutes - hour * 60)),
  )
}

function hasPostNearFixedSlot(posts: TodayTypefullyPost[], hour: number): boolean {
  const target = hour * 60
  return posts.some((post) => {
    const minutes = getJstMinutesOfDay(post.scheduledAt)
    return minutes != null && Math.abs(minutes - target) <= FIXED_SLOT_TOLERANCE_MINUTES
  })
}

function shouldCheckPublishedFallback(posts: TodayTypefullyPost[], now = new Date()): boolean {
  if (posts.length === 0) return true

  const nowMinutes = getJstMinutesOfDay(now.toISOString())
  if (nowMinutes == null) return false

  return FIXED_POST_JST_HOURS.some((hour) => (
    nowMinutes >= hour * 60 + PUBLISHED_FALLBACK_GRACE_MINUTES &&
    !hasPostNearFixedSlot(posts, hour)
  ))
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

function isHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim())
}

function collectImageUrls(value: unknown, urls = new Set<string>()): Set<string> {
  if (!value) return urls

  if (isHttpUrl(value)) {
    urls.add(value.trim())
    return urls
  }

  if (Array.isArray(value)) {
    for (const item of value) collectImageUrls(item, urls)
    return urls
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of ['url', 'src', 'href', 'media_url', 'mediaUrl', 'image_url', 'imageUrl']) {
      collectImageUrls(record[key], urls)
    }
    for (const key of ['media_urls', 'mediaUrls', 'image_urls', 'imageUrls', 'images', 'media', 'attachments']) {
      collectImageUrls(record[key], urls)
    }
    // Typefullyのレスポンスは媒体・公開状態によってURLのキー名が変わる。
    // media配下に渡された未知のキーも再帰的に確認し、temporary_url等を取りこぼさない。
    for (const nested of Object.values(record)) {
      collectImageUrls(nested, urls)
    }
  }

  return urls
}

function getDraftImageUrls(draft: TypefullyDraft, detail: TypefullyDraftDetail | null): string[] {
  const urls = new Set<string>()
  collectImageUrls(draft.media_urls, urls)
  collectImageUrls(draft.image_urls, urls)
  collectImageUrls(draft.images, urls)
  collectImageUrls(draft.media, urls)
  collectImageUrls(draft.attachments, urls)
  collectImageUrls(detail?.media_urls, urls)
  collectImageUrls(detail?.image_urls, urls)
  collectImageUrls(detail?.images, urls)
  collectImageUrls(detail?.media, urls)
  collectImageUrls(detail?.attachments, urls)
  for (const post of detail?.platforms?.x?.posts ?? []) {
    collectImageUrls(post.media_urls, urls)
    collectImageUrls(post.image_urls, urls)
    collectImageUrls(post.images, urls)
    collectImageUrls(post.media, urls)
    collectImageUrls(post.attachments, urls)
  }
  return Array.from(urls)
}

function collectMediaIds(value: unknown, ids = new Set<string>()): Set<string> {
  if (typeof value === 'string' || typeof value === 'number') {
    const id = String(value).trim()
    if (id) ids.add(id)
    return ids
  }
  if (Array.isArray(value)) {
    for (const item of value) collectMediaIds(item, ids)
    return ids
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of ['id', 'media_id', 'mediaId']) collectMediaIds(record[key], ids)
  }
  return ids
}

function getDraftMediaIds(draft: TypefullyDraft, detail: TypefullyDraftDetail | null): string[] {
  const ids = new Set<string>()
  collectMediaIds(draft.media_ids, ids)
  collectMediaIds(detail?.media_ids, ids)
  for (const post of detail?.platforms?.x?.posts ?? []) collectMediaIds(post.media_ids, ids)
  return Array.from(ids)
}

async function resolveDraftMedia(
  apiKey: string,
  socialSetId: string,
  draft: TypefullyDraft,
  detail: TypefullyDraftDetail | null,
): Promise<{ imageUrls: string[]; expectsMedia: boolean; mediaPaths: string[] }> {
  const extracted = extractTypefullyMedia(draft, detail)
  const urls = new Set([...getDraftImageUrls(draft, detail), ...extracted.imageUrls])
  const mediaIds = Array.from(new Set([...getDraftMediaIds(draft, detail), ...extracted.mediaIds]))

  for (const mediaId of mediaIds) {
    try {
      const res = await fetch(
        `${TYPEFULLY_API}/social-sets/${socialSetId}/media/${encodeURIComponent(mediaId)}`,
        {
          headers: { 'Authorization': `Bearer ${apiKey}` },
          next: { revalidate: 0 },
        },
      )
      if (!res.ok) {
        console.warn('[sync-typefully] Typefully media API error:', {
          mediaId,
          status: res.status,
        })
        continue
      }
      collectImageUrls(await res.json(), urls)
    } catch (error) {
      console.warn('[sync-typefully] Typefully media fetch failed:', {
        mediaId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return {
    imageUrls: Array.from(urls),
    expectsMedia: extracted.expectsMedia || mediaIds.length > 0 || urls.size > 0,
    mediaPaths: extracted.mediaPaths,
  }
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

function getPrimaryImageUrl(urls: string[] | null): string | null {
  return (urls ?? []).find((url) => isHttpUrl(url))?.trim() ?? null
}

function safeLogUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl)
    return `${url.origin}${url.pathname}`
  } catch {
    return rawUrl.slice(0, 300)
  }
}

async function persistTypefullyThreadImage(
  supabase: SupabaseAdmin,
  sourceId: string,
  externalUrl: string,
): Promise<{ url?: string; error?: string }> {
  if (externalUrl.includes('/storage/v1/object/public/bbs-images/typefully/')) {
    return { url: externalUrl }
  }

  let response: Response
  try {
    response = await fetch(externalUrl, { redirect: 'follow', cache: 'no-store' })
  } catch (error) {
    const message = `image_fetch_failed url=${safeLogUrl(externalUrl)} error=${error instanceof Error ? error.message : String(error)}`
    console.error('[sync-typefully]', message)
    return { error: message }
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (!response.ok) {
    const message = `image_fetch_failed url=${safeLogUrl(externalUrl)} status=${response.status} content_type=${contentType || 'missing'}`
    console.error('[sync-typefully]', message)
    return { error: message }
  }
  const extension = extensionForImageContentType(contentType)
  if (!extension) {
    const message = `image_fetch_invalid_content_type url=${safeLogUrl(externalUrl)} status=${response.status} content_type=${contentType || 'missing'}`
    console.error('[sync-typefully]', message)
    return { error: message }
  }

  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength === 0 || bytes.byteLength > 10 * 1024 * 1024) {
    const message = `image_fetch_invalid_size url=${safeLogUrl(externalUrl)} status=${response.status} content_type=${contentType} bytes=${bytes.byteLength}`
    console.error('[sync-typefully]', message)
    return { error: message }
  }

  const safeSourceId = sourceId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100)
  const storagePath = `typefully/${safeSourceId}/primary.${extension}`
  const { data, error } = await supabase.storage.from('bbs-images').upload(storagePath, bytes, {
    contentType: contentType.split(';', 1)[0],
    cacheControl: '31536000',
    upsert: true,
  })
  if (error || !data) {
    const message = `image_storage_failed url=${safeLogUrl(externalUrl)} status=${response.status} content_type=${contentType} path=${storagePath} error=${error?.message ?? 'missing_data'}`
    console.error('[sync-typefully]', message)
    return { error: message }
  }

  const { data: publicData } = supabase.storage.from('bbs-images').getPublicUrl(data.path)
  return { url: publicData.publicUrl }
}

function isDailyZukanTypefullyPost(text: string): boolean {
  const normalized = text.replace(/\s+/g, '')
  const hasThreadLink = /https?:\/\/(?:www\.)?duema-bbs\.com\/thread\/\d+/i.test(text)
  const hasZukanCardLink = /(?:https?:\/\/(?:www\.)?duema-bbs\.com)?\/zukan\/card\//i.test(text)

  const hasOldMarker = normalized.includes('本日の思い出図鑑スレ')
  const hasThreadPostMarker =
    normalized.includes('思い出を募集中') &&
    normalized.includes('今の評価でもOK') &&
    normalized.includes('思い出図鑑ページ') &&
    hasZukanCardLink

  const hasCurrentXMarker =
    normalized.includes('思い出を募集中') &&
    normalized.includes('今の評価でもOK') &&
    normalized.includes('掲示板')

  return hasOldMarker || hasThreadPostMarker || ((hasThreadLink || hasZukanCardLink) && hasCurrentXMarker)
}

function summarizeTypefullyPosts(posts: TodayTypefullyPost[]): TypefullyPostSummary[] {
  return posts.map((post) => ({
    typefullyId: post.typefullyId,
    scheduledAt: post.scheduledAt,
    scheduledAtJst: formatJstDateTime(post.scheduledAt),
    sourceStatus: post.sourceStatus,
    bodyPreview: post.body.slice(0, 80),
    imageUrls: post.imageUrls,
    expectsMedia: post.expectsMedia,
    mediaPaths: post.mediaPaths,
  }))
}

function incrementSkipReason(reasons: PublishedFallbackSkipReasons, reason: string): void {
  reasons[reason] = (reasons[reason] ?? 0) + 1
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
    const { imageUrls, expectsMedia, mediaPaths } = await resolveDraftMedia(apiKey, socialSetId, draft, detail)
    if (!scheduledAt || !isTodayInJst(scheduledAt)) continue
    if (isDailyZukanTypefullyPost(body)) continue

    const typefullyId = draftId || `scheduled:${scheduledAt}:${hashText(body)}`
    posts.push({
      typefullyId,
      sourceStatus: draft.status ?? 'scheduled',
      scheduledAt,
      body,
      imageUrls,
      expectsMedia,
      mediaPaths,
      shareUrl: draft.share_url ?? draft.typefully_url ?? null,
    })
  }

  return { posts, fetched: json.results.length }
}

async function fetchTodayPublishedFallbackPosts(
  apiKey: string,
  socialSetId: string,
): Promise<{
  posts: TodayTypefullyPost[]
  fetched: number
  skipReasons: PublishedFallbackSkipReasons
  error?: string
  status?: number
}> {
  const endpoint =
    `${TYPEFULLY_API}/social-sets/${socialSetId}/drafts?status=published&order_by=-published_at&limit=${TYPEFULLY_DRAFT_LIMIT}`

  const res = await fetch(endpoint, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
    next: { revalidate: 0 },
  })

  if (!res.ok) {
    const body = await res.text()
    console.error('[sync-typefully] Typefully published drafts API error:', res.status, body.slice(0, 300))
    return { posts: [], fetched: 0, skipReasons: {}, error: 'Typefully API error', status: res.status }
  }

  const json = await res.json()
  const errField = json.detail ?? json.error ?? json.errors ?? json.message
  if (errField) {
    const message = String(errField).slice(0, 200)
    console.error('[sync-typefully] Typefully published drafts response error:', message)
    return { posts: [], fetched: 0, skipReasons: {}, error: message, status: 502 }
  }
  if (!Array.isArray(json.results)) {
    console.error('[sync-typefully] Typefully published drafts unexpected response:', JSON.stringify(json).slice(0, 300))
    return { posts: [], fetched: 0, skipReasons: {}, error: 'Typefully API unexpected response', status: 502 }
  }

  const posts: TodayTypefullyPost[] = []
  const skipReasons: PublishedFallbackSkipReasons = {}
  for (const draft of json.results as TypefullyDraft[]) {
    const draftId = draft.id != null ? String(draft.id) : ''
    const detail = draftId ? await fetchDraftDetail(apiKey, socialSetId, draftId) : null
    const publishedAt = getDraftPublishedAt(draft) ?? (detail ? getDraftPublishedAt(detail) : null)
    if (!publishedAt) {
      incrementSkipReason(skipReasons, 'missing_published_at')
      continue
    }
    if (!isTodayInJst(publishedAt)) {
      incrementSkipReason(skipReasons, 'not_today_jst')
      continue
    }

    const body = getDraftText(draft, detail)
    if (!body) {
      incrementSkipReason(skipReasons, 'empty_body')
      continue
    }
    if (isDailyZukanTypefullyPost(body)) {
      incrementSkipReason(skipReasons, 'daily_zukan')
      continue
    }

    const { imageUrls, expectsMedia, mediaPaths } = await resolveDraftMedia(apiKey, socialSetId, draft, detail)
    const typefullyId = draftId || `published:${publishedAt}:${hashText(body)}`
    posts.push({
      typefullyId,
      sourceStatus: draft.status ?? 'published',
      scheduledAt: publishedAt,
      body,
      imageUrls,
      expectsMedia,
      mediaPaths,
      shareUrl: draft.x_published_url ?? draft.share_url ?? draft.typefully_url ?? null,
    })
  }

  posts.sort((a, b) => {
    const slotDiff = distanceToFixedSlotMinutes(a.scheduledAt) - distanceToFixedSlotMinutes(b.scheduledAt)
    if (slotDiff !== 0) return slotDiff
    return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
  })

  return { posts, fetched: json.results.length, skipReasons }
}

async function filterExistingPublishedFallbackPosts(
  supabase: SupabaseAdmin,
  posts: TodayTypefullyPost[],
): Promise<{ posts: TodayTypefullyPost[]; skipReasons: PublishedFallbackSkipReasons; error?: string }> {
  if (posts.length === 0) return { posts, skipReasons: {} }

  const { start, end } = getJstDayWindow()
  const typefullyIds = posts.map((post) => post.typefullyId)
  const { data: existingById, error: idError } = await supabase
    .from('x_posts')
    .select('id, typefully_id, thread_id, image_urls, typefully_share_url, scheduled_at, thread_lines, source_ref, meta')
    .in('typefully_id', typefullyIds)

  if (idError) return { posts: [], skipReasons: {}, error: idError.message }

  const { data: existingToday, error: todayError } = await supabase
    .from('x_posts')
    .select('id, typefully_id, thread_id, image_urls, typefully_share_url, scheduled_at, thread_lines, source_ref, meta')
    .gte('scheduled_at', start.toISOString())
    .lt('scheduled_at', end.toISOString())

  if (todayError) return { posts: [], skipReasons: {}, error: todayError.message }

  const existingRowsById = (existingById ?? []) as ExistingXPost[]
  const existingRows = [
    ...existingRowsById,
    ...((existingToday ?? []) as ExistingXPost[]).filter((row) => (
      !existingRowsById.some((existing) => existing.id === row.id)
    )),
  ]
  const existingTypefullyIds = new Set(
    existingRows
      .map((row) => row.typefully_id)
      .filter((id): id is string => Boolean(id)),
  )
  const existingUrls = new Set(
    existingRows
      .flatMap((row) => [row.typefully_share_url, row.source_ref?.replace(/^typefully:/, '')])
      .filter((url): url is string => Boolean(url)),
  )
  const existingBodies = existingRows.map((row) => ({
    scheduledAt: row.scheduled_at,
    bodyHash: hashText(getPrimaryText(row.thread_lines)),
  }))

  const skipReasons: PublishedFallbackSkipReasons = {}
  const filtered = posts.filter((post) => {
    const existing = existingRows.find((row) => row.typefully_id === post.typefullyId)
    const canEnrichMissingImages = Boolean(
      existing &&
      (existing.image_urls?.length ?? 0) === 0 &&
      post.imageUrls.length > 0
    )
    // 予約時点では画像URLがまだ返らず、公開後に初めて取得できる場合がある。
    // 画像なしの既存行だけは重複扱いにせず、公開済みデータで補完する。
    if (canEnrichMissingImages) return true

    if (existingTypefullyIds.has(post.typefullyId)) {
      incrementSkipReason(skipReasons, 'existing_typefully_id')
      return false
    }
    if (post.shareUrl && existingUrls.has(post.shareUrl)) {
      incrementSkipReason(skipReasons, 'existing_url')
      return false
    }

    const postTime = new Date(post.scheduledAt).getTime()
    const postHash = hashText(post.body)
    const hasNearbyBodyMatch = existingBodies.some((existing) => {
      if (!existing.scheduledAt || !existing.bodyHash) return false
      const existingTime = new Date(existing.scheduledAt).getTime()
      return existing.bodyHash === postHash &&
        Math.abs(existingTime - postTime) <= FIXED_SLOT_TOLERANCE_MINUTES * 60 * 1000
    })
    if (hasNearbyBodyMatch) {
      incrementSkipReason(skipReasons, 'existing_body_near_time')
      return false
    }
    return true
  })

  return { posts: filtered, skipReasons }
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
    .select('id, typefully_id, thread_id, image_urls, meta')
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
    const imageUrls = post.imageUrls.length > 0
      ? post.imageUrls
      : ((existing?.image_urls ?? []) as string[])
    const nextMeta = {
      ...(existing?.meta ?? {}),
      fetched_from_typefully_at: fetchedAt,
      typefully_image_urls_count: imageUrls.length,
      typefully_media_expected: post.expectsMedia,
      typefully_media_paths: post.mediaPaths,
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
          image_urls: imageUrls,
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
          image_urls: imageUrls,
          meta: nextMeta,
        })
        .eq('id', existing.id)
      if (updateMetaError) {
        errors++
        console.error('[sync-typefully] x_posts locked meta update error:', updateMetaError.message)
      }

      // スレ作成後にTypefullyから画像URLを取得できた場合も、画像未設定のスレへ後付けする。
      const primaryImageUrl = getPrimaryImageUrl(imageUrls)
      if (primaryImageUrl) {
        const storedImage = await persistTypefullyThreadImage(
          supabase,
          post.typefullyId,
          primaryImageUrl,
        )
        if (!storedImage.url) {
          errors++
          await supabase.from('x_posts').update({
            status: 'error',
            sync_error: normalizeError(storedImage.error ?? 'image_storage_failed'),
            last_attempt_at: new Date().toISOString(),
          }).eq('id', existing.id)
          continue
        }
        const { error: threadImageError } = await supabase
          .from('threads')
          .update({ image_url: storedImage.url })
          .eq('id', existing.thread_id)
          .is('image_url', null)
        if (threadImageError) {
          errors++
          console.error('[sync-typefully] thread image backfill error:', threadImageError.message)
        }
      }
      continue
    }

    const { error: updateError } = await supabase
      .from('x_posts')
      .update({
        status: 'scheduled',
        title: generateTitleFromXPost(post.body) || 'デュエマ掲示板投稿',
        thread_lines: threadLines,
        image_urls: imageUrls,
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

async function recoverMissingTypefullyThreadImages(
  supabase: SupabaseAdmin,
  apiKey: string,
  socialSetId: string,
  dryRun: boolean,
): Promise<{ candidates: number; recovered: number; errors: number; results: Array<Record<string, unknown>> }> {
  const since = new Date(Date.now() - IMAGE_RECOVERY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { data: xPosts, error: xPostsError } = await supabase
    .from('x_posts')
    .select('id, typefully_id, thread_id, image_urls, meta')
    .not('typefully_id', 'is', null)
    .not('thread_id', 'is', null)
    .gte('scheduled_at', since)
    .order('scheduled_at', { ascending: false })
    .limit(50)
  if (xPostsError) return { candidates: 0, recovered: 0, errors: 1, results: [{ error: xPostsError.message }] }

  const rows = (xPosts ?? []).filter((row) => row.thread_id != null && row.typefully_id)
  if (rows.length === 0) return { candidates: 0, recovered: 0, errors: 0, results: [] }
  const { data: threads, error: threadsError } = await supabase
    .from('threads')
    .select('id, image_url')
    .in('id', rows.map((row) => row.thread_id))
  if (threadsError) return { candidates: 0, recovered: 0, errors: 1, results: [{ error: threadsError.message }] }

  const missingThreadIds = new Set((threads ?? []).filter((thread) => !thread.image_url).map((thread) => thread.id))
  const candidates = rows.filter((row) => (
    missingThreadIds.has(row.thread_id) &&
    !(row.meta && typeof row.meta === 'object' && row.meta.media_checked_no_image_at)
  )).slice(0, 20)
  let recovered = 0
  let errors = 0
  const results: Array<Record<string, unknown>> = []

  for (const row of candidates) {
    const detail = await fetchDraftDetail(apiKey, socialSetId, String(row.typefully_id))
    if (!detail) {
      errors++
      results.push({ xPostId: row.id, threadId: row.thread_id, error: 'typefully_detail_fetch_failed' })
      continue
    }
    const media = await resolveDraftMedia(apiKey, socialSetId, { id: row.typefully_id }, detail)
    const externalImageUrl = getPrimaryImageUrl(media.imageUrls)
    if (!externalImageUrl) {
      if (media.expectsMedia) {
        errors++
        if (!dryRun) await supabase.from('x_posts').update({
          status: 'error',
          sync_error: 'waiting_for_typefully_media',
          last_attempt_at: new Date().toISOString(),
        }).eq('id', row.id)
      }
      if (!media.expectsMedia && !dryRun) {
        await supabase.from('x_posts').update({
          meta: {
            ...(row.meta ?? {}),
            media_checked_no_image_at: new Date().toISOString(),
            typefully_media_paths: media.mediaPaths,
          },
        }).eq('id', row.id)
      }
      results.push({ xPostId: row.id, threadId: row.thread_id, expectsMedia: media.expectsMedia, error: media.expectsMedia ? 'waiting_for_typefully_media' : 'no_media' })
      continue
    }
    if (dryRun) {
      recovered++
      results.push({ xPostId: row.id, threadId: row.thread_id, mediaPaths: media.mediaPaths, wouldRecover: true })
      continue
    }
    const stored = await persistTypefullyThreadImage(supabase, String(row.typefully_id), externalImageUrl)
    if (!stored.url) {
      errors++
      await supabase.from('x_posts').update({
        status: 'error',
        sync_error: normalizeError(stored.error ?? 'image_storage_failed'),
        last_attempt_at: new Date().toISOString(),
      }).eq('id', row.id)
      results.push({ xPostId: row.id, threadId: row.thread_id, error: stored.error })
      continue
    }
    const { error: updateThreadError } = await supabase
      .from('threads')
      .update({ image_url: stored.url })
      .eq('id', row.thread_id)
      .is('image_url', null)
    if (updateThreadError) {
      errors++
      results.push({ xPostId: row.id, threadId: row.thread_id, error: updateThreadError.message })
      continue
    }
    await supabase.from('x_posts').update({
      status: 'posted',
      image_urls: media.imageUrls,
      sync_error: null,
      last_attempt_at: new Date().toISOString(),
      meta: {
        ...(row.meta ?? {}),
        typefully_media_expected: media.expectsMedia,
        typefully_media_paths: media.mediaPaths,
        image_recovered_at: new Date().toISOString(),
        storage_image_url: stored.url,
      },
    }).eq('id', row.id)
    recovered++
    results.push({ xPostId: row.id, threadId: row.thread_id, imageUrl: stored.url, mediaPaths: media.mediaPaths })
  }
  return { candidates: candidates.length, recovered, errors, results }
}

async function findDueXPosts(
  supabase: SupabaseAdmin,
  limit: number,
): Promise<{ rows: XPostDueRow[]; error?: string }> {
  const now = new Date()
  const minScheduledAt = new Date(now.getTime() - DUE_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('x_posts')
    .select('id, typefully_id, scheduled_at, thread_lines, image_urls, status, source_status, source_ref, retry_count, thread_id, meta')
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

async function markXPostSkippedDailyZukan(
  supabase: SupabaseAdmin,
  row: XPostDueRow,
): Promise<void> {
  await supabase
    .from('x_posts')
    .update({
      source_status: 'daily_zukan_skipped',
      sync_error: null,
      last_attempt_at: new Date().toISOString(),
      meta: {
        ...(row.meta ?? {}),
        skipped_reason: 'daily_zukan_typefully_post',
      },
    })
    .eq('id', row.id)
    .is('thread_id', null)
}

async function markXPostWaitingForMedia(
  supabase: SupabaseAdmin,
  row: XPostDueRow,
): Promise<void> {
  await supabase
    .from('x_posts')
    .update({
      status: 'scheduled',
      sync_error: 'waiting_for_typefully_media',
      last_attempt_at: new Date().toISOString(),
      meta: {
        ...(row.meta ?? {}),
        waiting_for_typefully_media: true,
      },
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
  if (isDailyZukanTypefullyPost(body)) {
    if (!dryRun) await markXPostSkippedDailyZukan(supabase, row)
    return {
      xPostId: row.id,
      typefullyId: row.typefully_id,
      status: 'skipped_daily_zukan',
      error: 'daily_zukan_typefully_post',
    }
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
  const externalImageUrl = getPrimaryImageUrl(row.image_urls)
  const expectsMedia = row.meta?.typefully_media_expected === true
  if (shouldBlockThreadForMissingMedia(expectsMedia, externalImageUrl)) {
    if (!dryRun) await markXPostWaitingForMedia(supabase, row)
    return {
      xPostId: row.id,
      typefullyId: row.typefully_id,
      status: 'skipped',
      error: 'waiting_for_typefully_media',
    }
  }
  let imageUrl: string | null = null
  if (externalImageUrl && !dryRun) {
    const storedImage = await persistTypefullyThreadImage(
      supabase,
      row.typefully_id ? String(row.typefully_id) : `x-post-${row.id}`,
      externalImageUrl,
    )
    if (!storedImage.url) {
      await markXPostError(supabase, row, storedImage.error ?? 'image_storage_failed')
      return {
        xPostId: row.id,
        typefullyId: row.typefully_id,
        status: 'error',
        error: storedImage.error ?? 'image_storage_failed',
      }
    }
    imageUrl = storedImage.url
  } else if (externalImageUrl) {
    imageUrl = externalImageUrl
  }
  if (dryRun) {
    return {
      xPostId: row.id,
      typefullyId: row.typefully_id,
      status: 'created',
      threadId: -1,
      threadUrl: '(dry-run)',
      ...(imageUrl ? { imageUrl } : {}),
    }
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
      ...(imageUrl ? { image_url: imageUrl } : {}),
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
    ...(imageUrl ? { imageUrl } : {}),
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
  const apiKey = sanitizeSecretValue(process.env.TYPEFULLY_API_KEY)
  const socialSetId = sanitizeSecretValue(process.env.TYPEFULLY_SOCIAL_SET_ID)

  let fetchedTodayPosts = 0
  let normalizedTodayPosts = 0
  let savedTodayPosts = 0
  let updatedTodayPosts = 0
  let lockedThreadedPosts = 0
  let duplicateTodayPosts = 0
  let saveErrors = 0
  let todayTypefullyPosts: TypefullyPostSummary[] = []
  let publishedFallbackFetched = 0
  let publishedFallbackNormalized = 0
  let publishedFallbackSaved = 0
  let publishedFallbackSkipped = 0
  let publishedFallbackSkipReasons: PublishedFallbackSkipReasons = {}
  let publishedFallbackPosts: TypefullyPostSummary[] = []
  let imageRecovery: Awaited<ReturnType<typeof recoverMissingTypefullyThreadImages>> = {
    candidates: 0,
    recovered: 0,
    errors: 0,
    results: [],
  }

  if (mode === 'fetch_today' || mode === 'fetch_and_sync') {
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

    if (shouldCheckPublishedFallback(fetched.posts)) {
      const fallback = await fetchTodayPublishedFallbackPosts(apiKey, socialSetId)
      if (fallback.error) {
        return NextResponse.json(
          { error: fallback.error, status: fallback.status ?? 502, mode, dryRun },
          { status: fallback.status ?? 502 },
        )
      }

      publishedFallbackFetched = fallback.fetched
      publishedFallbackSkipReasons = { ...fallback.skipReasons }

      const filtered = await filterExistingPublishedFallbackPosts(supabase, fallback.posts)
      if (filtered.error) {
        return NextResponse.json({ error: filtered.error, mode, dryRun }, { status: 500 })
      }
      for (const [reason, count] of Object.entries(filtered.skipReasons)) {
        publishedFallbackSkipReasons[reason] = (publishedFallbackSkipReasons[reason] ?? 0) + count
      }

      publishedFallbackNormalized = filtered.posts.length
      publishedFallbackSkipped = Math.max(0, fallback.fetched - publishedFallbackNormalized)
      publishedFallbackPosts = summarizeTypefullyPosts(filtered.posts)

      const fallbackSaveResult = await upsertTodayTypefullyPosts(supabase, filtered.posts, dryRun)
      publishedFallbackSaved = fallbackSaveResult.saved
      updatedTodayPosts += fallbackSaveResult.updated
      lockedThreadedPosts += fallbackSaveResult.locked
      duplicateTodayPosts += fallbackSaveResult.duplicate
      saveErrors += fallbackSaveResult.errors
    } else {
      publishedFallbackSkipReasons = { not_needed: 1 }
    }

    imageRecovery = await recoverMissingTypefullyThreadImages(
      supabase,
      apiKey,
      socialSetId,
      dryRun,
    )
    saveErrors += imageRecovery.errors
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
  const skippedDailyZukan = results.filter((result) => result.status === 'skipped_daily_zukan').length

  console.log(
    `[sync-typefully] mode=${mode} dryRun=${dryRun}` +
    ` fetchedToday=${fetchedTodayPosts} normalizedToday=${normalizedTodayPosts}` +
    ` saved=${savedTodayPosts} updated=${updatedTodayPosts} duplicateToday=${duplicateTodayPosts}` +
    ` publishedFallbackFetched=${publishedFallbackFetched} publishedFallbackNormalized=${publishedFallbackNormalized}` +
    ` publishedFallbackSaved=${publishedFallbackSaved} publishedFallbackSkipped=${publishedFallbackSkipped}` +
    ` lockedThreaded=${lockedThreadedPosts} saveErrors=${saveErrors}` +
    ` imageRecoveryCandidates=${imageRecovery.candidates} imageRecovered=${imageRecovery.recovered}` +
    ` duePosts=${dueRows.length} created=${created} duplicate=${duplicate}` +
    ` skipped=${skipped} skippedDailyZukan=${skippedDailyZukan} errors=${errors}`,
  )

  const summaryErrors = errors + saveErrors
  await notifySyncSummary({
    created,
    duplicate,
    errors: summaryErrors,
    totalDrafts: fetchedTodayPosts + publishedFallbackFetched + dueRows.length,
    skippedByLimit: Math.max(0, dueRows.length - maxNewPerRun),
    dryRun,
    executedAt: formatJstDateTime(new Date().toISOString()),
  })

  return NextResponse.json({
    mode,
    dryRun,
    fetchedTodayTypefullyPosts: fetchedTodayPosts,
    normalizedTodayTypefullyPosts: normalizedTodayPosts,
    savedTodayTypefullyPosts: savedTodayPosts,
    updatedTodayTypefullyPosts: updatedTodayPosts,
    duplicateTodayTypefullyPosts: duplicateTodayPosts,
    todayTypefullyPosts,
    publishedFallbackFetched,
    publishedFallbackNormalized,
    publishedFallbackSaved,
    publishedFallbackSkipped,
    publishedFallbackSkipReasons,
    publishedFallbackPosts,
    lockedThreadedPosts,
    saveErrors,
    imageRecoveryLookbackDays: IMAGE_RECOVERY_LOOKBACK_DAYS,
    imageRecovery,
    duePosts: dueRows.length,
    dueLookbackHours: DUE_LOOKBACK_HOURS,
    eligibleDueStatuses: ELIGIBLE_X_POST_STATUSES,
    cancelledSourceStatuses: Array.from(CANCELLED_SOURCE_STATUSES),
    created,
    duplicate,
    errors,
    skipped,
    skippedDailyZukan,
    results,
  })
}
