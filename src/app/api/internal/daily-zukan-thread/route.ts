/**
 * GET /api/internal/daily-zukan-thread
 * 思い出図鑑の当日予定カードから、通常スレを自動作成する。
 * Vercel Cron から毎日 JST 0:00（UTC 15:00）に呼ばれる。
 * 手動実行: Authorization: Bearer ${CRON_SECRET}
 */

import { NextRequest, NextResponse } from 'next/server'
import { runDailyZukanThread, getDailyZukanThreadForRetry } from '@/lib/daily-zukan-thread'
import { createAdminClient } from '@/lib/supabase-admin'
import { createTypefullyDraft } from '@/lib/typefully'
import { SITE_URL } from '@/lib/site-config'

export const runtime = 'nodejs'
export const maxDuration = 60

// Typefully投稿の結果（APIレスポンス・ログ用）。
type TypefullyOutcome =
  | { status: 'posted'; id: string; shareUrl: string; postedAt: string; scheduledAt: string; text: string; mediaUrls: string[]; imageFallback?: string; persistError?: string }
  | { status: 'error'; error: string; persistError?: string }
  | { status: 'skipped'; reason: string; typefullyId?: string | null }

type TypefullyGuard = {
  status: string | null
  id: string | null
}

function summarizeDailyZukanResult(
  result: Awaited<ReturnType<typeof runDailyZukanThread>>,
  typefully?: TypefullyOutcome,
) {
  const isDuplicateSkip =
    result.status === 'skipped' &&
    ['already_posted_today', 'schedule_already_completed', 'race_already_posted'].includes(result.reason)
  const typefullyError = typefully?.status === 'error' ? 1 : 0

  return {
    created: result.status === 'created' ? 1 : 0,
    duplicate: isDuplicateSkip ? 1 : 0,
    skipped: result.status === 'skipped' ? 1 : 0,
    errors: (result.status === 'error' ? 1 : 0) + typefullyError,
    results: [typefully ? { ...result, typefully } : result],
  }
}

// 作成済み思い出図鑑スレを X/Typefully へ投稿する文面を組み立てる。
function buildTypefullyText(cardName: string, threadUrl: string): string {
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
    threadUrl,
  ].join('\n')
}

function assertCronAuth(req: NextRequest): NextResponse | null {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

function shortenError(error: string): string {
  return error.length > 1000 ? `${error.slice(0, 1000)}...` : error
}

const TYPEFULLY_SCHEDULE_DELAY_MINUTES = 5

function getTypefullyScheduleDate(now = new Date()): string {
  return new Date(now.getTime() + TYPEFULLY_SCHEDULE_DELAY_MINUTES * 60 * 1000).toISOString()
}

async function getTypefullyGuard(postedDate: string): Promise<TypefullyGuard | { error: string }> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('daily_zukan_thread_logs')
    .select('typefully_status, typefully_id')
    .eq('posted_date', postedDate)
    .maybeSingle()

  if (error) return { error: error.message }
  return {
    status: data?.typefully_status ?? null,
    id: data?.typefully_id ?? null,
  }
}

async function saveTypefullySuccess(
  postedDate: string,
  typefullyId: string,
  shareUrl: string,
  scheduledAt: string,
): Promise<string | undefined> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('daily_zukan_thread_logs')
    .update({
      typefully_status: 'success',
      typefully_id: typefullyId,
      typefully_url: shareUrl || null,
      typefully_scheduled_at: scheduledAt,
      typefully_error: null,
    })
    .eq('posted_date', postedDate)

  return error?.message
}

async function saveTypefullyError(postedDate: string, errorMessage: string): Promise<string | undefined> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('daily_zukan_thread_logs')
    .update({
      typefully_status: 'error',
      typefully_error: shortenError(errorMessage),
    })
    .eq('posted_date', postedDate)

  return error?.message
}

function isTypefullyValidationError(error: string): boolean {
  return /Typefully API error 422|VALIDATION_ERROR/i.test(error)
}

async function createTypefullyPost({
  postedDate,
  threadId,
  cardName,
  imageUrl,
}: {
  postedDate: string
  threadId: number
  cardName: string
  imageUrl: string
}): Promise<TypefullyOutcome> {
  const text = buildTypefullyText(cardName, `${SITE_URL}/thread/${threadId}`)
  const mediaUrls = imageUrl ? [imageUrl] : []
  const typefullyScheduleDate = getTypefullyScheduleDate()

  let tf = await createTypefullyDraft({
    threadLines: [text],
    imageUrls: mediaUrls,
    scheduleDate: typefullyScheduleDate,
  })
  let usedMediaUrls = mediaUrls
  let imageFallback: string | undefined

  if ('error' in tf && mediaUrls.length > 0 && isTypefullyValidationError(tf.error)) {
    console.error('[daily-zukan-thread] typefully image payload rejected; retrying text-only', {
      postedDate,
      threadId,
      error: tf.error,
    })
    imageFallback = tf.error
    tf = await createTypefullyDraft({
      threadLines: [text],
      scheduleDate: typefullyScheduleDate,
    })
    usedMediaUrls = []
  }

  if ('error' in tf) {
    console.error('[daily-zukan-thread] typefully error', {
      postedDate,
      threadId,
      error: tf.error,
    })
    const persistError = await saveTypefullyError(postedDate, tf.error)
    if (persistError) {
      console.error('[daily-zukan-thread] typefully error persistence failed', {
        postedDate,
        threadId,
        error: persistError,
      })
    }
    return { status: 'error', error: tf.error, ...(persistError ? { persistError } : {}) }
  }

  console.log('[daily-zukan-thread] typefully posted', {
    postedDate,
    threadId,
    id: tf.id,
    shareUrl: tf.share_url,
    scheduledAt: typefullyScheduleDate,
    mediaCount: usedMediaUrls.length,
  })
  const persistError = await saveTypefullySuccess(postedDate, tf.id, tf.share_url, typefullyScheduleDate)
  if (persistError) {
    console.error('[daily-zukan-thread] typefully success persistence failed', {
      postedDate,
      threadId,
      error: persistError,
    })
  }
  return {
    status: 'posted',
    id: tf.id,
    shareUrl: tf.share_url,
    postedAt: typefullyScheduleDate,
    scheduledAt: typefullyScheduleDate,
    text,
    mediaUrls: usedMediaUrls,
    ...(imageFallback ? { imageFallback } : {}),
    ...(persistError ? { persistError } : {}),
  }
}

async function createTypefullyForPostedDate(postedDate: string): Promise<{
  threadId?: number
  typefully: TypefullyOutcome
  httpStatus: number
}> {
  const guard = await getTypefullyGuard(postedDate)
  if ('error' in guard) {
    console.error('[daily-zukan-thread] typefully guard lookup error', {
      postedDate,
      error: guard.error,
    })
    return { typefully: { status: 'error', error: guard.error }, httpStatus: 500 }
  }
  if (guard.status === 'success' || guard.id) {
    return {
      typefully: { status: 'skipped', reason: 'already_success', typefullyId: guard.id },
      httpStatus: 200,
    }
  }

  const lookup = await getDailyZukanThreadForRetry(postedDate)
  if (lookup.status === 'error') {
    console.error('[daily-zukan-thread] typefully lookup error', {
      postedDate,
      error: lookup.error,
    })
    return { typefully: { status: 'error', error: lookup.error }, httpStatus: 500 }
  }
  if (lookup.status === 'not_found') {
    return { typefully: { status: 'error', error: lookup.reason }, httpStatus: 404 }
  }

  const typefully = await createTypefullyPost({
    postedDate,
    threadId: lookup.threadId,
    cardName: lookup.cardName,
    imageUrl: lookup.imageUrl,
  })

  return {
    threadId: lookup.threadId,
    typefully,
    httpStatus: typefully.status === 'posted' || typefully.status === 'skipped' ? 200 : 502,
  }
}

// 手動再試行モード（?retry_typefully=YYYY-MM-DD）。
// 「スレは作れたが Typefully 投稿だけ失敗した日」を救済する。
// - 通常のスレ作成は実行しない（既存スレを使い回す）
// - 新しいログ行も作らない・スレも作り直さない
// - DBに Typefully 成功記録がある場合は再投稿しない
async function handleRetryTypefully(postedDate: string): Promise<NextResponse> {
  // 日付形式チェック（YYYY-MM-DD かつ実在する日付）。
  if (!/^\d{4}-\d{2}-\d{2}$/.test(postedDate) || Number.isNaN(Date.parse(postedDate))) {
    return NextResponse.json(
      {
        ok: false,
        mode: 'retry_typefully',
        error: 'invalid_date_format',
        detail: 'YYYY-MM-DD 形式で指定してください',
      },
      { status: 400 },
    )
  }

  const { threadId, typefully, httpStatus } = await createTypefullyForPostedDate(postedDate)
  return NextResponse.json({
    ok: typefully.status === 'posted' || typefully.status === 'skipped',
    mode: 'retry_typefully',
    postedDate,
    threadId,
    typefully,
  }, { status: httpStatus })
}

// 安全確認用（?preview_typefully=YYYY-MM-DD）。
// Typefully API は呼ばず、既存スレから投稿予定文面と画像候補だけ返す。
async function handlePreviewTypefully(postedDate: string): Promise<NextResponse> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(postedDate) || Number.isNaN(Date.parse(postedDate))) {
    return NextResponse.json(
      {
        ok: false,
        mode: 'preview_typefully',
        error: 'invalid_date_format',
        detail: 'YYYY-MM-DD 形式で指定してください',
      },
      { status: 400 },
    )
  }

  const lookup = await getDailyZukanThreadForRetry(postedDate)
  if (lookup.status === 'error') {
    return NextResponse.json(
      { ok: false, mode: 'preview_typefully', postedDate, error: lookup.error },
      { status: 500 },
    )
  }
  if (lookup.status === 'not_found') {
    return NextResponse.json(
      { ok: false, mode: 'preview_typefully', postedDate, error: lookup.reason },
      { status: 404 },
    )
  }

  const guard = await getTypefullyGuard(postedDate)
  return NextResponse.json({
    ok: true,
    mode: 'preview_typefully',
    postedDate,
    threadId: lookup.threadId,
    text: buildTypefullyText(lookup.cardName, `${SITE_URL}/thread/${lookup.threadId}`),
    mediaUrls: lookup.imageUrl ? [lookup.imageUrl] : [],
    typefully: 'error' in guard ? { guardError: guard.error } : guard,
  })
}

export async function GET(req: NextRequest) {
  const authError = assertCronAuth(req)
  if (authError) return authError

  // 安全確認モード。Typefully API・DB更新・スレ作成は実行しない。
  const previewDate = req.nextUrl.searchParams.get('preview_typefully')
  if (previewDate) {
    return handlePreviewTypefully(previewDate)
  }

  // 手動再試行モード。通常のスレ作成より先に分岐する。
  const retryDate = req.nextUrl.searchParams.get('retry_typefully')
  if (retryDate) {
    return handleRetryTypefully(retryDate)
  }

  try {
    const result = await runDailyZukanThread()

    // Typefully投稿は created 直後に実行する。既に同日スレがある場合も、
    // Typefully成功記録が無いときだけ同じスレに対して再試行する。
    let typefully: TypefullyOutcome | undefined

    if (result.status === 'created') {
      console.log('[daily-zukan-thread] created', {
        postedDate: result.postedDate,
        cardName: result.cardName,
        cardSlug: result.cardSlug,
        threadId: result.threadId,
        cycleNo: result.cycleNo,
      })

      typefully = await createTypefullyPost({
        postedDate: result.postedDate,
        threadId: result.threadId,
        cardName: result.cardName,
        imageUrl: result.imageUrl,
      })
    } else if (result.status === 'skipped') {
      console.log('[daily-zukan-thread] skipped', {
        postedDate: result.postedDate,
        reason: result.reason,
      })
      if (['already_posted_today', 'schedule_already_completed', 'race_already_posted'].includes(result.reason)) {
        const retry = await createTypefullyForPostedDate(result.postedDate)
        typefully = retry.typefully
      }
    } else {
      console.error('[daily-zukan-thread] error', result)
    }

    // HTTPステータスはスレ作成結果のみで決める。Typefully投稿の失敗は
    // body の typefully フィールドで知らせるだけで、200のまま（スレ作成は成功している）。
    const httpStatus = result.status === 'error' ? 500 : 200
    return NextResponse.json(
      {
        ...(typefully ? { ...result, typefully } : result),
        dryRun: false,
        ...summarizeDailyZukanResult(result, typefully),
      },
      { status: httpStatus },
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error'
    console.error('[daily-zukan-thread] unexpected error:', message)
    return NextResponse.json({ status: 'error', error: message }, { status: 500 })
  }
}
