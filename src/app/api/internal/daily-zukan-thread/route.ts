/**
 * GET /api/internal/daily-zukan-thread
 * 思い出図鑑の当日予定カードから、通常スレを自動作成する。
 * Vercel Cron から毎日 JST 0:00（UTC 15:00）に呼ばれる。
 * 手動実行: Authorization: Bearer ${CRON_SECRET}
 */

import { NextRequest, NextResponse } from 'next/server'
import { runDailyZukanThread, getDailyZukanThreadForRetry } from '@/lib/daily-zukan-thread'
import { createTypefullyDraft } from '@/lib/typefully'
import { SITE_URL } from '@/lib/site-config'

export const runtime = 'nodejs'
export const maxDuration = 60

// Typefully予約投稿の結果（APIレスポンス・ログ用）。
type TypefullyOutcome =
  | { status: 'scheduled'; id: string; shareUrl: string; scheduledAt: string }
  | { status: 'error'; error: string }

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
    '本日の思い出図鑑スレ',
    '',
    `${cardName}について語ろう`,
    '',
    '当時の思い出、使っていたデッキ、今の評価など',
    '気軽にコメントしてください。',
    '',
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

// 手動再試行モード（?retry_typefully=YYYY-MM-DD）。
// 「スレは作れたが Typefully 投稿だけ失敗した日」を救済する。
// - 通常のスレ作成は実行しない（既存スレを使い回す）
// - 新しいログ行も作らない・スレも作り直さない
// - DBに Typefully 成功記録が無いため、二重投稿の注意を warning で返す（自動再試行はしない）
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

  const lookup = await getDailyZukanThreadForRetry(postedDate)
  if (lookup.status === 'error') {
    console.error('[daily-zukan-thread] retry_typefully lookup error', {
      postedDate,
      error: lookup.error,
    })
    return NextResponse.json(
      { ok: false, mode: 'retry_typefully', postedDate, error: lookup.error },
      { status: 500 },
    )
  }
  if (lookup.status === 'not_found') {
    // no_log_for_date / no_thread_id
    return NextResponse.json(
      { ok: false, mode: 'retry_typefully', postedDate, error: lookup.reason },
      { status: 404 },
    )
  }

  // 既存スレを使って Typefully だけ再投稿する。
  const threadUrl = `${SITE_URL}/thread/${lookup.threadId}`
  const text = buildTypefullyText(lookup.cardName, threadUrl)
  const scheduledAt = new Date(Date.now() + 2 * 60 * 1000).toISOString()
  console.log('[daily-zukan-thread] retry_typefully (manual re-post)', {
    postedDate,
    threadId: lookup.threadId,
    cardName: lookup.cardName,
    scheduledAt,
  })
  const tf = await createTypefullyDraft({ threadLines: [text], scheduleDate: scheduledAt })

  if ('error' in tf) {
    console.error('[daily-zukan-thread] retry_typefully error', {
      postedDate,
      threadId: lookup.threadId,
      error: tf.error,
    })
    return NextResponse.json(
      {
        ok: false,
        mode: 'retry_typefully',
        postedDate,
        threadId: lookup.threadId,
        typefully: 'error',
        error: tf.error,
      },
      { status: 502 },
    )
  }

  console.log('[daily-zukan-thread] retry_typefully scheduled', {
    postedDate,
    threadId: lookup.threadId,
    id: tf.id,
    shareUrl: tf.share_url,
    scheduledAt,
  })
  return NextResponse.json({
    ok: true,
    mode: 'retry_typefully',
    postedDate,
    threadId: lookup.threadId,
    typefully: 'scheduled',
    typefullyId: tf.id,
    shareUrl: tf.share_url,
    scheduledAt,
    warning:
      'Typefully成功済みかどうかはDBに記録がないため、二重投稿に注意してください',
  })
}

export async function GET(req: NextRequest) {
  const authError = assertCronAuth(req)
  if (authError) return authError

  // 手動再試行モード。通常のスレ作成より先に分岐する。
  const retryDate = req.nextUrl.searchParams.get('retry_typefully')
  if (retryDate) {
    return handleRetryTypefully(retryDate)
  }

  try {
    const result = await runDailyZukanThread()

    // Typefully投稿は created のときだけ実行する。
    // skipped / error では投稿しない。created は posted_date UNIQUE により
    // 1日1回しか発生しないため、同じ日に二重投稿されることはない。
    let typefully: TypefullyOutcome | undefined

    if (result.status === 'created') {
      console.log('[daily-zukan-thread] created', {
        postedDate: result.postedDate,
        cardName: result.cardName,
        cardSlug: result.cardSlug,
        threadId: result.threadId,
        cycleNo: result.cycleNo,
      })

      const threadUrl = `${SITE_URL}/thread/${result.threadId}`
      const text = buildTypefullyText(result.cardName, threadUrl)
      // 下書きではなく「予約投稿」として登録し X へ自動投稿させる。
      // 安全のため Cron 実行時刻の少し後（+2分）に予約する。
      const scheduledAt = new Date(Date.now() + 2 * 60 * 1000).toISOString()
      const tf = await createTypefullyDraft({ threadLines: [text], scheduleDate: scheduledAt })

      if ('error' in tf) {
        // Typefully投稿の失敗だけでは作成済みスレ・ログは削除しない（ここでは触らない）。
        console.error('[daily-zukan-thread] typefully error', {
          threadId: result.threadId,
          error: tf.error,
        })
        typefully = { status: 'error', error: tf.error }
      } else {
        console.log('[daily-zukan-thread] typefully scheduled', {
          threadId: result.threadId,
          id: tf.id,
          shareUrl: tf.share_url,
          scheduledAt,
        })
        typefully = { status: 'scheduled', id: tf.id, shareUrl: tf.share_url, scheduledAt }
      }
    } else if (result.status === 'skipped') {
      console.log('[daily-zukan-thread] skipped', {
        postedDate: result.postedDate,
        reason: result.reason,
      })
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
