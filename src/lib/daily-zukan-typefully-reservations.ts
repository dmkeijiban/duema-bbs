import { createAdminClient } from '@/lib/supabase-admin'
import { SITE_URL } from '@/lib/site-config'
import { fillDailyZukanThreadSchedule, getJstDateKey } from '@/lib/daily-zukan-thread'

const TYPEFULLY_API_BASE = 'https://api.typefully.com/v2'
const TYPEFULLY_MEDIA_POLL_ATTEMPTS = 10
const TYPEFULLY_MEDIA_POLL_DELAY_MS = 1000
const MAX_RESERVATION_DAYS = 14

type ScheduleRow = {
  scheduled_date: string
  card_slug: string
  typefully_status: 'processing' | 'scheduled' | 'error' | null
  typefully_id: string | null
}

type ZukanCard = {
  slug: string
  name: string
  official_image_url: string | null
}

type ImageSource = 'card_image' | 'card_page_og_fallback' | 'default_og_fallback'

type ImageCandidate = {
  imageUrl: string
  imageSource: ImageSource
}

type PreparedImage = ImageCandidate & {
  bytes: ArrayBuffer
  contentType: string
  finalUrl: string
  fileName: string
}

type TypefullyDraftResponse = {
  id?: string | number
  private_url?: string | null
  share_url?: string | null
  url?: string | null
}

type TypefullyMediaUploadResponse = {
  media_id?: string
  upload_url?: string
}

type TypefullyMediaStatusResponse = {
  status?: string
  error_reason?: string | null
}

export type DailyZukanReservationResult =
  | {
      status: 'scheduled'
      scheduledDate: string
      publishAt: string
      cardSlug: string
      cardName: string
      cardPageUrl: string
      imageUrl: string
      imageSource: ImageSource
      typefullyId: string
      typefullyUrl: string
      mediaId: string
    }
  | {
      status: 'skipped'
      scheduledDate: string
      cardSlug: string
      reason: string
      typefullyId?: string | null
    }
  | {
      status: 'error'
      scheduledDate: string
      cardSlug: string
      cardName?: string
      cardPageUrl?: string
      error: string
    }
  | {
      status: 'preview'
      scheduledDate: string
      publishAt: string
      cardSlug: string
      cardName: string
      cardPageUrl: string
      imageUrl: string
      imageSource: ImageSource
      text: string
    }

export type ReserveDailyZukanTypefullyParams = {
  startDate?: string
  days?: number
  dryRun?: boolean
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function buildDateKeys(startDate: string, days: number): string[] {
  return Array.from({ length: days }, (_, index) => addDaysToDateKey(startDate, index))
}

function normalizeApiKey(apiKey: string): string {
  return apiKey
    .replace(/\uFEFF/g, '')
    .replace(/^Bearer\s+/i, '')
    .trim()
}

function cleanEnvValue(value: string | undefined): string {
  return value?.replace(/\uFEFF/g, '').trim() ?? ''
}

function truncateLogBody(text: string, maxLength = 2000): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text
}

function shortenError(error: string): string {
  return error.length > 1000 ? `${error.slice(0, 1000)}...` : error
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function buildTypefullyText(cardName: string, cardPageUrl: string): string {
  return [
    'みんなの',
    `「${cardName}」に対する`,
    '思い出を募集中‼️',
    '',
    '当時じゃなくて',
    '今の評価でもOKです🙆‍♀️',
    '',
    'リプでも掲示板でも',
    '気軽にコメント下さい‼️',
    '',
    cardPageUrl,
  ].join('\n')
}

function getJstMidnightIso(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00+09:00`).toISOString()
}

function formatTypefullyError(status: number, text: string): string {
  if (!text) return `Typefully API error ${status}`

  try {
    const data = JSON.parse(text) as {
      error?: { code?: unknown; message?: unknown; details?: unknown }
      message?: unknown
      detail?: unknown
    }
    if (typeof data.message === 'string') return `Typefully API error ${status}: ${data.message}`
    if (typeof data.detail === 'string') return `Typefully API error ${status}: ${data.detail}`
    if (data.error && typeof data.error === 'object') {
      const message = typeof data.error.message === 'string' ? data.error.message : JSON.stringify(data.error)
      const code = typeof data.error.code === 'string' ? ` (${data.error.code})` : ''
      const details = data.error.details ? ` details=${JSON.stringify(data.error.details).slice(0, 500)}` : ''
      return `Typefully API error ${status}${code}: ${message}${details}`
    }
  } catch {
    // JSONではないレスポンスは下で短く返す。
  }

  return `Typefully API error ${status}: ${text.slice(0, 500)}`
}

function getImageExtension(contentType: string, imageUrl: string): string {
  const normalizedType = contentType.split(';')[0]?.trim().toLowerCase()
  if (normalizedType === 'image/jpeg') return 'jpg'
  if (normalizedType === 'image/png') return 'png'
  if (normalizedType === 'image/webp') return 'webp'
  if (normalizedType === 'image/gif') return 'gif'

  try {
    const ext = new URL(imageUrl).pathname.split('.').pop()?.toLowerCase()
    if (ext && ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return ext === 'jpeg' ? 'jpg' : ext
  } catch {
    // URLとして解釈できない場合は既定値を使う。
  }

  return 'jpg'
}

function buildTypefullyFileName(scheduledDate: string, cardSlug: string, imageSource: string, extension: string): string {
  return `daily-zukan-${scheduledDate}-${cardSlug}-${imageSource}.${extension}`.replace(/[^a-zA-Z0-9_.()-]/g, '-')
}

function parseOgImage(html: string): string | null {
  const match =
    html.match(/<meta\b[^>]*\bproperty=['"]og:image['"][^>]*\bcontent=['"]([^'"]+)['"]/i) ??
    html.match(/<meta\b[^>]*\bcontent=['"]([^'"]+)['"][^>]*\bproperty=['"]og:image['"]/i)
  return match?.[1]?.replace(/&amp;/g, '&') ?? null
}

async function fetchCardPageOgImage(cardPageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(cardPageUrl)
    if (!res.ok) return null
    return parseOgImage(await res.text())
  } catch {
    return null
  }
}

async function prepareImageCandidate({
  candidate,
  scheduledDate,
  cardSlug,
  cardName,
  cardPageUrl,
}: {
  candidate: ImageCandidate
  scheduledDate: string
  cardSlug: string
  cardName: string
  cardPageUrl: string
}): Promise<PreparedImage | { error: string }> {
  if (!/^https?:\/\//i.test(candidate.imageUrl)) {
    return { error: `画像URLがhttp(s)ではありません: ${candidate.imageUrl}` }
  }

  try {
    const res = await fetch(candidate.imageUrl, { redirect: 'follow' })
    const contentType = res.headers.get('content-type') ?? ''

    console.log('[daily-zukan-typefully-reservations] image fetch result', {
      scheduledDate,
      cardName,
      cardPageUrl,
      imageUrl: candidate.imageUrl,
      imageSource: candidate.imageSource,
      status: res.status,
      contentType,
      finalUrl: res.url,
    })

    if (!res.ok) {
      return { error: `画像取得失敗: status=${res.status}` }
    }
    if (!contentType.toLowerCase().startsWith('image/')) {
      return { error: `画像のcontent-typeではありません: ${contentType || 'unknown'}` }
    }

    const bytes = await res.arrayBuffer()
    if (bytes.byteLength === 0) {
      return { error: '画像取得結果が0バイトです' }
    }

    const extension = getImageExtension(contentType, res.url || candidate.imageUrl)
    return {
      ...candidate,
      bytes,
      contentType,
      finalUrl: res.url || candidate.imageUrl,
      fileName: buildTypefullyFileName(scheduledDate, cardSlug, candidate.imageSource, extension),
    }
  } catch (e) {
    return { error: `画像取得リクエスト失敗: ${String(e)}` }
  }
}

async function prepareRequiredImage({
  card,
  scheduledDate,
  cardPageUrl,
}: {
  card: ZukanCard
  scheduledDate: string
  cardPageUrl: string
}): Promise<PreparedImage | { error: string }> {
  const errors: string[] = []
  const tried = new Set<string>()
  const candidates: ImageCandidate[] = []

  if (card.official_image_url?.trim()) {
    candidates.push({ imageUrl: card.official_image_url.trim(), imageSource: 'card_image' })
  }

  const ogImageUrl = await fetchCardPageOgImage(cardPageUrl)
  if (ogImageUrl?.trim() && !tried.has(ogImageUrl.trim())) {
    candidates.push({ imageUrl: ogImageUrl.trim(), imageSource: 'card_page_og_fallback' })
  }

  candidates.push({ imageUrl: `${SITE_URL}/default-thumbnail.jpg`, imageSource: 'default_og_fallback' })

  for (const candidate of candidates) {
    if (tried.has(candidate.imageUrl)) continue
    tried.add(candidate.imageUrl)

    const prepared = await prepareImageCandidate({
      candidate,
      scheduledDate,
      cardSlug: card.slug,
      cardName: card.name,
      cardPageUrl,
    })
    if (!('error' in prepared)) return prepared
    errors.push(`${candidate.imageSource}: ${prepared.error}`)
  }

  return { error: `Typefully予約用の画像を1枚も用意できませんでした: ${errors.join(' | ')}` }
}

async function createTypefullyMediaUpload({
  image,
  apiKey,
  socialSetId,
  scheduledDate,
  cardName,
  cardPageUrl,
}: {
  image: PreparedImage
  apiKey: string
  socialSetId: string
  scheduledDate: string
  cardName: string
  cardPageUrl: string
}): Promise<TypefullyMediaUploadResponse | { error: string }> {
  const requestPayloadImagePart = { file_name: image.fileName }
  const res = await fetch(`${TYPEFULLY_API_BASE}/social-sets/${socialSetId}/media/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestPayloadImagePart),
  })
  const responseBody = await res.text()

  console.log('[daily-zukan-typefully-reservations] typefully media upload response', {
    scheduledDate,
    cardName,
    cardPageUrl,
    imageUrl: image.imageUrl,
    imageSource: image.imageSource,
    typefullyStatus: res.status,
    typefullyResponseBody: truncateLogBody(responseBody),
    typefullyRequestPayloadImagePart: requestPayloadImagePart,
  })

  if (!res.ok) {
    return { error: formatTypefullyError(res.status, responseBody) }
  }

  try {
    return JSON.parse(responseBody) as TypefullyMediaUploadResponse
  } catch {
    return { error: 'Typefully media upload response is not JSON' }
  }
}

async function putTypefullyMediaBytes({
  uploadUrl,
  image,
  scheduledDate,
  cardName,
  cardPageUrl,
}: {
  uploadUrl: string
  image: PreparedImage
  scheduledDate: string
  cardName: string
  cardPageUrl: string
}): Promise<{ ok: true } | { error: string }> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    body: image.bytes,
  })
  const responseBody = await res.text().catch(() => '')

  console.log('[daily-zukan-typefully-reservations] typefully media bytes upload response', {
    scheduledDate,
    cardName,
    cardPageUrl,
    imageUrl: image.imageUrl,
    imageSource: image.imageSource,
    typefullyStatus: res.status,
    typefullyResponseBody: truncateLogBody(responseBody),
    byteLength: image.bytes.byteLength,
  })

  if (!res.ok) {
    return { error: `Typefully media bytes upload failed ${res.status}: ${responseBody.slice(0, 500)}` }
  }

  return { ok: true }
}

async function waitForTypefullyMediaReady({
  mediaId,
  image,
  apiKey,
  socialSetId,
  scheduledDate,
  cardName,
  cardPageUrl,
}: {
  mediaId: string
  image: PreparedImage
  apiKey: string
  socialSetId: string
  scheduledDate: string
  cardName: string
  cardPageUrl: string
}): Promise<{ ok: true } | { error: string }> {
  for (let attempt = 1; attempt <= TYPEFULLY_MEDIA_POLL_ATTEMPTS; attempt += 1) {
    const res = await fetch(`${TYPEFULLY_API_BASE}/social-sets/${socialSetId}/media/${mediaId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    const responseBody = await res.text()

    console.log('[daily-zukan-typefully-reservations] typefully media status response', {
      scheduledDate,
      cardName,
      cardPageUrl,
      imageUrl: image.imageUrl,
      imageSource: image.imageSource,
      mediaId,
      attempt,
      typefullyStatus: res.status,
      typefullyResponseBody: truncateLogBody(responseBody),
    })

    if (!res.ok) {
      return { error: formatTypefullyError(res.status, responseBody) }
    }

    let data: TypefullyMediaStatusResponse
    try {
      data = JSON.parse(responseBody) as TypefullyMediaStatusResponse
    } catch {
      return { error: 'Typefully media status response is not JSON' }
    }

    if (data.status === 'ready') return { ok: true }
    if (data.status === 'failed') return { error: data.error_reason || 'Typefully media processing failed' }

    if (attempt < TYPEFULLY_MEDIA_POLL_ATTEMPTS) {
      await delay(TYPEFULLY_MEDIA_POLL_DELAY_MS)
    }
  }

  return { error: 'Typefully media processing did not become ready in time' }
}

async function createTypefullyDraftWithMediaId({
  text,
  mediaId,
  image,
  apiKey,
  socialSetId,
  publishAt,
  scheduledDate,
  cardName,
  cardPageUrl,
}: {
  text: string
  mediaId: string
  image: PreparedImage
  apiKey: string
  socialSetId: string
  publishAt: string
  scheduledDate: string
  cardName: string
  cardPageUrl: string
}): Promise<TypefullyDraftResponse | { error: string }> {
  const requestPayloadImagePart = {
    platforms: {
      x: {
        posts: [{ media_ids: [mediaId] }],
      },
    },
  }
  const body = {
    platforms: {
      x: {
        enabled: true,
        posts: [{ text, media_ids: [mediaId] }],
      },
    },
    publish_at: publishAt,
  }

  console.log('[daily-zukan-typefully-reservations] typefully draft request', {
    scheduledDate,
    cardName,
    cardPageUrl,
    imageUrl: image.imageUrl,
    imageSource: image.imageSource,
    mediaId,
    publishAt,
    typefullyRequestPayloadImagePart: requestPayloadImagePart,
  })

  const res = await fetch(`${TYPEFULLY_API_BASE}/social-sets/${socialSetId}/drafts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const responseBody = await res.text()

  console.log('[daily-zukan-typefully-reservations] typefully draft response', {
    scheduledDate,
    cardName,
    cardPageUrl,
    imageUrl: image.imageUrl,
    imageSource: image.imageSource,
    mediaId,
    typefullyStatus: res.status,
    typefullyResponseBody: truncateLogBody(responseBody),
  })

  if (!res.ok) {
    return { error: formatTypefullyError(res.status, responseBody) }
  }

  try {
    return JSON.parse(responseBody) as TypefullyDraftResponse
  } catch {
    return { error: 'Typefully draft response is not JSON' }
  }
}

async function markReservationError(scheduledDate: string, error: string): Promise<void> {
  const admin = createAdminClient()
  await admin
    .from('daily_zukan_thread_schedule')
    .update({
      typefully_status: 'error',
      typefully_error: shortenError(error),
    })
    .eq('scheduled_date', scheduledDate)
}

async function claimReservationRow(row: ScheduleRow): Promise<boolean> {
  const admin = createAdminClient()
  let query = admin
    .from('daily_zukan_thread_schedule')
    .update({
      typefully_status: 'processing',
      typefully_error: null,
    })
    .eq('scheduled_date', row.scheduled_date)
    .is('typefully_id', null)

  query = row.typefully_status === 'error' ? query.eq('typefully_status', 'error') : query.is('typefully_status', null)

  const { data, error } = await query
    .select('scheduled_date')

  if (error) {
    console.error('[daily-zukan-typefully-reservations] reservation claim failed', {
      scheduledDate: row.scheduled_date,
      cardSlug: row.card_slug,
      error: error.message,
    })
    return false
  }

  return (data ?? []).length > 0
}

async function saveReservationSuccess({
  row,
  draft,
  publishAt,
  mediaId,
  image,
}: {
  row: ScheduleRow
  draft: TypefullyDraftResponse
  publishAt: string
  mediaId: string
  image: PreparedImage
}): Promise<void> {
  const admin = createAdminClient()
  await admin
    .from('daily_zukan_thread_schedule')
    .update({
      typefully_status: 'scheduled',
      typefully_id: String(draft.id ?? ''),
      typefully_url: String(draft.private_url ?? draft.share_url ?? draft.url ?? ''),
      typefully_scheduled_at: publishAt,
      typefully_reserved_at: new Date().toISOString(),
      typefully_media_id: mediaId,
      typefully_image_url: image.imageUrl,
      typefully_image_source: image.imageSource,
      typefully_error: null,
    })
    .eq('scheduled_date', row.scheduled_date)
}

async function reserveOne({
  row,
  card,
  apiKey,
  socialSetId,
  dryRun,
}: {
  row: ScheduleRow
  card: ZukanCard
  apiKey: string
  socialSetId: string
  dryRun: boolean
}): Promise<DailyZukanReservationResult> {
  if (row.typefully_id || row.typefully_status === 'scheduled') {
    return {
      status: 'skipped',
      scheduledDate: row.scheduled_date,
      cardSlug: row.card_slug,
      reason: 'already_reserved',
      typefullyId: row.typefully_id,
    }
  }
  if (row.typefully_status === 'processing') {
    return {
      status: 'skipped',
      scheduledDate: row.scheduled_date,
      cardSlug: row.card_slug,
      reason: 'reservation_in_progress',
      typefullyId: row.typefully_id,
    }
  }

  const cardPageUrl = `${SITE_URL}/zukan/card/${card.slug}`
  const publishAt = getJstMidnightIso(row.scheduled_date)
  const text = buildTypefullyText(card.name, cardPageUrl)
  const image = await prepareRequiredImage({ card, scheduledDate: row.scheduled_date, cardPageUrl })

  if ('error' in image) {
    if (!dryRun) await markReservationError(row.scheduled_date, image.error)
    return {
      status: 'error',
      scheduledDate: row.scheduled_date,
      cardSlug: row.card_slug,
      cardName: card.name,
      cardPageUrl,
      error: image.error,
    }
  }

  if (dryRun) {
    return {
      status: 'preview',
      scheduledDate: row.scheduled_date,
      publishAt,
      cardSlug: card.slug,
      cardName: card.name,
      cardPageUrl,
      imageUrl: image.imageUrl,
      imageSource: image.imageSource,
      text,
    }
  }

  const claimed = await claimReservationRow(row)
  if (!claimed) {
    return {
      status: 'skipped',
      scheduledDate: row.scheduled_date,
      cardSlug: row.card_slug,
      reason: 'already_reserved_or_claimed',
      typefullyId: row.typefully_id,
    }
  }

  const upload = await createTypefullyMediaUpload({
    image,
    apiKey,
    socialSetId,
    scheduledDate: row.scheduled_date,
    cardName: card.name,
    cardPageUrl,
  })
  if ('error' in upload || !upload.media_id || !upload.upload_url) {
    const error = 'error' in upload ? upload.error : 'Typefully media upload response missing media_id or upload_url'
    await markReservationError(row.scheduled_date, error)
    return {
      status: 'error',
      scheduledDate: row.scheduled_date,
      cardSlug: row.card_slug,
      cardName: card.name,
      cardPageUrl,
      error,
    }
  }

  const putResult = await putTypefullyMediaBytes({
    uploadUrl: upload.upload_url,
    image,
    scheduledDate: row.scheduled_date,
    cardName: card.name,
    cardPageUrl,
  })
  if ('error' in putResult) {
    await markReservationError(row.scheduled_date, putResult.error)
    return {
      status: 'error',
      scheduledDate: row.scheduled_date,
      cardSlug: row.card_slug,
      cardName: card.name,
      cardPageUrl,
      error: putResult.error,
    }
  }

  const ready = await waitForTypefullyMediaReady({
    mediaId: upload.media_id,
    image,
    apiKey,
    socialSetId,
    scheduledDate: row.scheduled_date,
    cardName: card.name,
    cardPageUrl,
  })
  if ('error' in ready) {
    await markReservationError(row.scheduled_date, ready.error)
    return {
      status: 'error',
      scheduledDate: row.scheduled_date,
      cardSlug: row.card_slug,
      cardName: card.name,
      cardPageUrl,
      error: ready.error,
    }
  }

  const draft = await createTypefullyDraftWithMediaId({
    text,
    mediaId: upload.media_id,
    image,
    apiKey,
    socialSetId,
    publishAt,
    scheduledDate: row.scheduled_date,
    cardName: card.name,
    cardPageUrl,
  })
  if ('error' in draft) {
    await markReservationError(row.scheduled_date, draft.error)
    return {
      status: 'error',
      scheduledDate: row.scheduled_date,
      cardSlug: row.card_slug,
      cardName: card.name,
      cardPageUrl,
      error: draft.error,
    }
  }

  const typefullyId = String(draft.id ?? '')
  if (!typefullyId) {
    const error = 'Typefully API response missing draft id'
    await markReservationError(row.scheduled_date, error)
    return {
      status: 'error',
      scheduledDate: row.scheduled_date,
      cardSlug: row.card_slug,
      cardName: card.name,
      cardPageUrl,
      error,
    }
  }

  await saveReservationSuccess({ row, draft, publishAt, mediaId: upload.media_id, image })

  return {
    status: 'scheduled',
    scheduledDate: row.scheduled_date,
    publishAt,
    cardSlug: card.slug,
    cardName: card.name,
    cardPageUrl,
    imageUrl: image.imageUrl,
    imageSource: image.imageSource,
    typefullyId,
    typefullyUrl: String(draft.private_url ?? draft.share_url ?? draft.url ?? ''),
    mediaId: upload.media_id,
  }
}

export async function reserveUpcomingDailyZukanTypefully({
  startDate = getJstDateKey(),
  days = 7,
  dryRun = false,
}: ReserveDailyZukanTypefullyParams = {}) {
  const normalizedDays = Math.max(1, Math.min(days, MAX_RESERVATION_DAYS))
  const dateKeys = buildDateKeys(startDate, normalizedDays)
  const endDate = dateKeys[dateKeys.length - 1] ?? startDate
  const admin = createAdminClient()

  const scheduleFill = await fillDailyZukanThreadSchedule(admin, startDate, normalizedDays)
  if (scheduleFill.reason) {
    return {
      ok: false,
      startDate,
      endDate,
      days: normalizedDays,
      dryRun,
      scheduleFill,
      error: scheduleFill.reason,
      results: [] as DailyZukanReservationResult[],
    }
  }

  const { data: scheduleRows, error: scheduleError } = await admin
    .from('daily_zukan_thread_schedule')
    .select('scheduled_date, card_slug, typefully_status, typefully_id')
    .gte('scheduled_date', startDate)
    .lte('scheduled_date', endDate)
    .order('scheduled_date', { ascending: true })

  if (scheduleError) {
    return {
      ok: false,
      startDate,
      endDate,
      days: normalizedDays,
      dryRun,
      scheduleFill,
      error: `schedule: ${scheduleError.message}`,
      results: [] as DailyZukanReservationResult[],
    }
  }

  const rows = (scheduleRows ?? []) as ScheduleRow[]
  const slugs = Array.from(new Set(rows.map((row) => row.card_slug)))
  const { data: cards, error: cardsError } = await admin
    .from('zukan_cards')
    .select('slug, name, official_image_url')
    .in('slug', slugs)

  if (cardsError) {
    return {
      ok: false,
      startDate,
      endDate,
      days: normalizedDays,
      dryRun,
      scheduleFill,
      error: `cards: ${cardsError.message}`,
      results: [] as DailyZukanReservationResult[],
    }
  }

  const cardMap = new Map(((cards ?? []) as ZukanCard[]).map((card) => [card.slug, card]))
  const apiKey = normalizeApiKey(process.env.TYPEFULLY_API_KEY ?? '')
  const socialSetId = cleanEnvValue(process.env.TYPEFULLY_SOCIAL_SET_ID)
  const results: DailyZukanReservationResult[] = []

  if (!dryRun && !apiKey) {
    return {
      ok: false,
      startDate,
      endDate,
      days: normalizedDays,
      dryRun,
      scheduleFill,
      error: 'TYPEFULLY_API_KEY が設定されていません',
      results,
    }
  }
  if (!dryRun && !socialSetId) {
    return {
      ok: false,
      startDate,
      endDate,
      days: normalizedDays,
      dryRun,
      scheduleFill,
      error: 'TYPEFULLY_SOCIAL_SET_ID が設定されていません',
      results,
    }
  }

  for (const row of rows) {
    const card = cardMap.get(row.card_slug)
    if (!card) {
      const error = `scheduled_card_not_found: ${row.card_slug}`
      if (!dryRun) await markReservationError(row.scheduled_date, error)
      results.push({
        status: 'error',
        scheduledDate: row.scheduled_date,
        cardSlug: row.card_slug,
        error,
      })
      continue
    }

    results.push(
      await reserveOne({
        row,
        card,
        apiKey,
        socialSetId,
        dryRun,
      }),
    )
  }

  const summary = {
    scheduled: results.filter((result) => result.status === 'scheduled').length,
    preview: results.filter((result) => result.status === 'preview').length,
    skipped: results.filter((result) => result.status === 'skipped').length,
    errors: results.filter((result) => result.status === 'error').length,
  }

  return {
    ok: summary.errors === 0,
    startDate,
    endDate,
    days: normalizedDays,
    dryRun,
    scheduleFill,
    summary,
    results,
  }
}
