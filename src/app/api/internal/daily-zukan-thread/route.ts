/**
 * GET /api/internal/daily-zukan-thread
 * 思い出図鑑の当日予定カードから、通常スレを自動作成する。
 * Vercel Cron から毎日 JST 0:00（UTC 15:00）に呼ばれる。
 * 手動実行: Authorization: Bearer ${CRON_SECRET}
 */

import { NextRequest, NextResponse } from 'next/server'
import { runDailyZukanThread } from '@/lib/daily-zukan-thread'

export const runtime = 'nodejs'
export const maxDuration = 60

function assertCronAuth(req: NextRequest): NextResponse | null {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

function summarizeDailyZukanResult(result: Awaited<ReturnType<typeof runDailyZukanThread>>) {
  const isDuplicateSkip =
    result.status === 'skipped' &&
    ['already_posted_today', 'schedule_already_completed', 'race_already_posted'].includes(result.reason)

  return {
    created: result.status === 'created' ? 1 : 0,
    duplicate: isDuplicateSkip ? 1 : 0,
    skipped: result.status === 'skipped' ? 1 : 0,
    errors: result.status === 'error' ? 1 : 0,
    results: [result],
  }
}

export async function GET(req: NextRequest) {
  const authError = assertCronAuth(req)
  if (authError) return authError

  try {
    const result = await runDailyZukanThread()

    if (result.status === 'created') {
      console.log('[daily-zukan-thread] created', {
        postedDate: result.postedDate,
        cardName: result.cardName,
        cardSlug: result.cardSlug,
        threadId: result.threadId,
        cycleNo: result.cycleNo,
      })
    } else if (result.status === 'skipped') {
      console.log('[daily-zukan-thread] skipped', {
        postedDate: result.postedDate,
        reason: result.reason,
      })
    } else {
      console.error('[daily-zukan-thread] error', result)
    }

    const httpStatus = result.status === 'error' ? 500 : 200
    return NextResponse.json(
      {
        ...result,
        dryRun: false,
        ...summarizeDailyZukanResult(result),
      },
      { status: httpStatus },
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error'
    console.error('[daily-zukan-thread] unexpected error:', message)
    return NextResponse.json({ status: 'error', error: message }, { status: 500 })
  }
}
