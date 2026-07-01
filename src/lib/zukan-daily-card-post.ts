import { createAdminClient } from '@/lib/supabase-admin'
import { SITE_URL } from '@/lib/site-config'
import { notifyDiscordMessage, notifyNewThread } from '@/lib/discord'
import { createTypefullyDraft } from '@/lib/typefully'
import { hashText } from '@/lib/x-post-to-thread'

const ZUKAN_DAILY_SOURCE = 'zukan_daily_midnight'
const ZUKAN_CATEGORY_SLUG = 'classic'
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const IMAGE_CHECK_TIMEOUT_MS = 10_000

type ZukanDailyStatus = 'pending' | 'thread_created' | 'typefully_created' | 'posted' | 'failed'

type ZukanCardCandidate = {
  id: string
  slug: string | null
  name: string
  image_url: string | null
  official_image_url: string | null
}

type ZukanCardCandidateWithSlug = ZukanCardCandidate & {
  slug: string
}

type ZukanDailyRow = {
  id: string
  run_date: string
  card_id: string
  card_slug: string | null
  card_name: string
  card_image_url: string
  thread_id: number | null
  thread_created_at: string | null
  thread_url: string | null
  typefully_post_id: string | null
  typefully_created_at: string | null
  typefully_url: string | null
  typefully_image_attached: boolean
  image_checked_at: string | null
  status: ZukanDailyStatus
  error_message: string | null
  created_at: string
  updated_at: string
}

export type ZukanDailyCardPostResult = {
  ok: boolean
  mode: 'dry_run' | 'live'
  runDate: string
  created: number
  duplicate: number
  skipped: number
  errors: number
  selectedCard?: {
    id: string
    slug: string | null
    name: string
    imageUrl: string
  }
  thread?: {
    id: number
    url: string
    title: string
    body: string
  }
  typefully?: {
    id: string
    url: string
    scheduledAt: string
    text?: string
    mediaUrls?: string[]
  }
  reason?: string
  error?: string
  existing?: Partial<ZukanDailyRow>
  results: Array<Record<string, unknown>>
}

function getJstDateKey(date = new Date()): string {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000)
  return jst.toISOString().slice(0, 10)
}

function buildThreadTitle(cardName: string): string {
  return `【思い出図鑑】「${cardName}」の思い出を語ろう`
}

function buildThreadBody(cardName: string): string {
  return [
    'みんなの',
    `「${cardName}」に対する`,
    '思い出を募集中‼️',
    '',
    '当時じゃなくて',
    '今の評価でもOKです💁‍♀️',
    '',
    'リプでも掲示板でも',
    '気軽にコメント下さい‼️',
  ].join('\n')
}

function buildCardUrl(cardSlug: string): string {
  return `${SITE_URL}/zukan/card/${cardSlug}`
}

function buildTypefullyText(cardName: string, cardUrl: string): string {
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
    cardUrl,
  ].join('\n')
}

function getCardImageUrl(card: ZukanCardCandidate): string | null {
  const url = card.official_image_url?.trim() || card.image_url?.trim() || null
  return url && /^https?:\/\//i.test(url) ? url : null
}

function pickRandom<T>(items: T[]): T | null {
  if (items.length === 0) return null
  return items[Math.floor(Math.random() * items.length)] ?? null
}

function toSafeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 500)
  return String(error).slice(0, 500)
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), IMAGE_CHECK_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function validateImageUrl(url: string): Promise<{ ok: true } | { ok: false; error: string }> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { ok: false, error: 'invalid_image_url' }
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { ok: false, error: 'invalid_image_protocol' }
  }

  const checkResponse = async (res: Response) => {
    if (!res.ok) return { ok: false as const, error: `image_fetch_http_${res.status}` }
    const contentType = res.headers.get('content-type')?.toLowerCase() ?? ''
    if (!contentType.startsWith('image/')) {
      return { ok: false as const, error: `invalid_image_content_type:${contentType || 'unknown'}` }
    }
    const contentLength = Number(res.headers.get('content-length') ?? '0')
    if (contentLength > MAX_IMAGE_BYTES) {
      return { ok: false as const, error: `image_too_large:${contentLength}` }
    }
    return { ok: true as const }
  }

  try {
    const head = await fetchWithTimeout(url, { method: 'HEAD', redirect: 'follow', cache: 'no-store' })
    if (head.ok) return checkResponse(head)
    if (![403, 405].includes(head.status)) {
      return { ok: false, error: `image_head_http_${head.status}` }
    }

    const get = await fetchWithTimeout(url, {
      method: 'GET',
      redirect: 'follow',
      cache: 'no-store',
      headers: { Range: 'bytes=0-0' },
    })
    return checkResponse(get)
  } catch (error) {
    return { ok: false, error: `image_fetch_failed:${toSafeErrorMessage(error)}` }
  }
}

async function notifyZukanDaily(kind: 'success' | 'failure' | 'skip', lines: string[]): Promise<void> {
  const title =
    kind === 'success'
      ? '思い出図鑑0時投稿 成功'
      : kind === 'skip'
        ? '思い出図鑑0時投稿 スキップ'
        : '思い出図鑑0時投稿 失敗'
  await notifyDiscordMessage([title, ...lines].join('\n'))
}

async function markFailed(
  admin: ReturnType<typeof createAdminClient>,
  rowId: string,
  errorMessage: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await admin
    .from('zukan_daily_card_posts')
    .update({
      status: 'failed',
      error_message: errorMessage.slice(0, 1000),
      updated_at: new Date().toISOString(),
      ...extra,
    })
    .eq('id', rowId)

  if (error) {
    console.error('[zukan-daily-card-post] failed to mark row failed:', {
      code: error.code,
      message: error.message,
    })
  }
}

export async function runZukanDailyCardPost({
  dryRun = false,
}: {
  dryRun?: boolean
} = {}): Promise<ZukanDailyCardPostResult> {
  const mode = dryRun ? 'dry_run' : 'live'
  const runDate = getJstDateKey()
  const admin = createAdminClient()

  const baseResult: Omit<ZukanDailyCardPostResult, 'ok' | 'results'> = {
    mode,
    runDate,
    created: 0,
    duplicate: 0,
    skipped: 0,
    errors: 0,
  }

  const { data: existing, error: existingError } = await admin
    .from('zukan_daily_card_posts')
    .select('id, run_date, card_id, card_slug, card_name, card_image_url, thread_id, thread_created_at, thread_url, typefully_post_id, typefully_created_at, typefully_url, typefully_image_attached, image_checked_at, status, error_message, created_at, updated_at')
    .eq('run_date', runDate)
    .maybeSingle()

  if (existingError) {
    const message = `existing_lookup_failed:${existingError.message}`
    console.error('[zukan-daily-card-post] existing lookup error:', {
      code: existingError.code,
      message: existingError.message,
    })
    return { ...baseResult, ok: false, errors: 1, error: message, results: [{ status: 'error', error: message }] }
  }

  if (existing) {
    return {
      ...baseResult,
      ok: true,
      duplicate: 1,
      reason: 'already_has_run_date',
      existing: existing as Partial<ZukanDailyRow>,
      results: [{ status: 'duplicate', reason: 'already_has_run_date', existing }],
    }
  }

  const { data: usedRows, error: usedError } = await admin
    .from('zukan_daily_card_posts')
    .select('card_id')

  if (usedError) {
    const message = `used_cards_lookup_failed:${usedError.message}`
    console.error('[zukan-daily-card-post] used cards lookup error:', {
      code: usedError.code,
      message: usedError.message,
    })
    return { ...baseResult, ok: false, errors: 1, error: message, results: [{ status: 'error', error: message }] }
  }

  const usedCardIds = new Set((usedRows ?? []).map((row) => String(row.card_id)))

  const { data: cardsData, error: cardsError } = await admin
    .from('zukan_cards')
    .select('id, slug, name, image_url, official_image_url')
    .eq('is_published', true)

  if (cardsError) {
    const message = `cards_lookup_failed:${cardsError.message}`
    console.error('[zukan-daily-card-post] cards lookup error:', {
      code: cardsError.code,
      message: cardsError.message,
    })
    return { ...baseResult, ok: false, errors: 1, error: message, results: [{ status: 'error', error: message }] }
  }

  const candidates = ((cardsData ?? []) as ZukanCardCandidate[])
    .map(card => ({ card, imageUrl: getCardImageUrl(card) }))
    .filter((item): item is { card: ZukanCardCandidateWithSlug; imageUrl: string } =>
      Boolean(item.card.id && item.card.slug && item.card.name && item.imageUrl && !usedCardIds.has(item.card.id))
    )

  const selected = pickRandom(candidates)
  if (!selected) {
    await notifyZukanDaily('skip', ['未使用カードがありません'])
    return {
      ...baseResult,
      ok: true,
      skipped: 1,
      reason: 'no_unused_cards',
      results: [{ status: 'skipped', reason: 'no_unused_cards' }],
    }
  }

  const { card, imageUrl } = selected
  const title = buildThreadTitle(card.name)
  const threadBody = buildThreadBody(card.name)
  const dryRunThreadUrl = `${SITE_URL}/thread/(dry-run)`
  const cardUrl = buildCardUrl(card.slug)
  const typefullyText = buildTypefullyText(card.name, cardUrl)
  const selectedCard = { id: card.id, slug: card.slug, name: card.name, imageUrl }

  if (dryRun) {
    const imageCheck = await validateImageUrl(imageUrl)
    return {
      ...baseResult,
      ok: imageCheck.ok,
      errors: imageCheck.ok ? 0 : 1,
      selectedCard,
      thread: { id: -1, url: dryRunThreadUrl, title, body: threadBody },
      typefully: {
        id: '(dry-run)',
        url: '(dry-run)',
        scheduledAt: new Date(Date.now() + 120_000).toISOString(),
        text: typefullyText,
        mediaUrls: [imageUrl],
      },
      ...(imageCheck.ok ? {} : { error: imageCheck.error }),
      results: [{
        status: imageCheck.ok ? 'would_create' : 'error',
        card: selectedCard,
        imageCheck,
        threadTitle: title,
        threadBody,
        typefullyText,
        typefullyCardUrl: cardUrl,
        mediaUrls: [imageUrl],
      }],
    }
  }

  const { data: row, error: insertRowError } = await admin
    .from('zukan_daily_card_posts')
    .insert({
      run_date: runDate,
      card_id: card.id,
      card_slug: card.slug,
      card_name: card.name,
      card_image_url: imageUrl,
      status: 'pending',
    })
    .select('id')
    .single()

  if (insertRowError || !row) {
    if (insertRowError?.code === '23505') {
      return {
        ...baseResult,
        ok: true,
        duplicate: 1,
        reason: 'unique_guard_duplicate',
        results: [{ status: 'duplicate', reason: 'unique_guard_duplicate' }],
      }
    }
    const message = `pending_insert_failed:${insertRowError?.message ?? 'unknown'}`
    console.error('[zukan-daily-card-post] pending insert error:', {
      code: insertRowError?.code,
      message: insertRowError?.message,
    })
    return { ...baseResult, ok: false, errors: 1, error: message, selectedCard, results: [{ status: 'error', error: message }] }
  }

  const rowId = String(row.id)

  const imageCheck = await validateImageUrl(imageUrl)
  if (!imageCheck.ok) {
    await markFailed(admin, rowId, imageCheck.error, { image_checked_at: new Date().toISOString() })
    await notifyZukanDaily('failure', [
      `カード名: ${card.name}`,
      '失敗箇所: image_validation',
      `error_message: ${imageCheck.error}`,
    ])
    return {
      ...baseResult,
      ok: false,
      errors: 1,
      selectedCard,
      error: imageCheck.error,
      results: [{ status: 'error', stage: 'image_validation', error: imageCheck.error, card: selectedCard }],
    }
  }

  const { data: category } = await admin
    .from('categories')
    .select('id, name')
    .eq('slug', ZUKAN_CATEGORY_SLUG)
    .maybeSingle()

  const sourceId = `${ZUKAN_DAILY_SOURCE}:${runDate}:${card.id}`
  const textHash = hashText(`${title}\n\n${threadBody}\n\n${sourceId}`)

  const { data: thread, error: threadError } = await admin
    .from('threads')
    .insert({
      title,
      body: threadBody,
      category_id: category?.id ?? null,
      author_name: '思い出図鑑',
      image_url: imageUrl,
      source: ZUKAN_DAILY_SOURCE,
      source_id: sourceId,
      source_text_hash: textHash,
    })
    .select('id')
    .single()

  if (threadError || !thread) {
    const message = `thread_create_failed:${threadError?.message ?? 'unknown'}`
    console.error('[zukan-daily-card-post] thread insert error:', {
      code: threadError?.code,
      message: threadError?.message,
    })
    await markFailed(admin, rowId, message)
    await notifyZukanDaily('failure', [
      `カード名: ${card.name}`,
      '失敗箇所: thread_create',
      `error_message: ${message}`,
    ])
    return { ...baseResult, ok: false, errors: 1, selectedCard, error: message, results: [{ status: 'error', stage: 'thread_create', error: message }] }
  }

  const threadId = Number(thread.id)
  const threadUrl = `${SITE_URL}/thread/${threadId}`
  await admin
    .from('zukan_daily_card_posts')
    .update({
      thread_id: threadId,
      thread_created_at: new Date().toISOString(),
      thread_url: threadUrl,
      image_checked_at: new Date().toISOString(),
      status: 'thread_created',
      updated_at: new Date().toISOString(),
    })
    .eq('id', rowId)

  await notifyNewThread({ threadId, title, categoryName: category?.name ?? null })

  const scheduledAt = new Date(Date.now() + 120_000).toISOString()
  const tf = await createTypefullyDraft({
    threadLines: [typefullyText],
    imageUrls: [imageUrl],
    scheduleDate: scheduledAt,
  })

  if ('error' in tf) {
    const message = `typefully_create_failed:${tf.error}`
    console.error('[zukan-daily-card-post] typefully create error:', { message })
    await markFailed(admin, rowId, message)
    await notifyZukanDaily('failure', [
      `カード名: ${card.name}`,
      `スレURL: ${threadUrl}`,
      '失敗箇所: typefully_create',
      `error_message: ${message}`,
    ])
    return {
      ...baseResult,
      ok: false,
      errors: 1,
      selectedCard,
      thread: { id: threadId, url: threadUrl, title, body: threadBody },
      error: message,
      results: [{ status: 'error', stage: 'typefully_create', error: message, threadId, threadUrl }],
    }
  }

  await admin
    .from('zukan_daily_card_posts')
    .update({
      typefully_post_id: tf.id,
      typefully_created_at: new Date().toISOString(),
      typefully_url: tf.share_url,
      typefully_image_attached: true,
      image_checked_at: new Date().toISOString(),
      status: 'posted',
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', rowId)

  await notifyZukanDaily('success', [
    `カード名: ${card.name}`,
    `スレURL: ${threadUrl}`,
    `Typefully URL: ${tf.share_url || '-'}`,
  ])

  return {
    ...baseResult,
    ok: true,
    created: 1,
    selectedCard,
    thread: { id: threadId, url: threadUrl, title, body: threadBody },
    typefully: { id: tf.id, url: tf.share_url, scheduledAt, text: typefullyText, mediaUrls: [imageUrl] },
    results: [{
      status: 'posted',
      card: selectedCard,
      threadId,
      threadUrl,
      typefullyId: tf.id,
      typefullyUrl: tf.share_url,
      typefullyText,
      typefullyCardUrl: cardUrl,
      mediaUrls: [imageUrl],
      scheduledAt,
    }],
  }
}
