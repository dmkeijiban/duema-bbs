/**
 * GET /api/internal/daily-zukan-typefully-reservations
 * 思い出図鑑の未来予定カードから、0時X/Typefully投稿を事前予約する。
 * 手動実行: Authorization: Bearer ${CRON_SECRET}
 *
 * Query:
 * - days: 予約対象日数（既定7、最大14）
 * - start_date: YYYY-MM-DD（既定はJST今日）
 * - dry_run=1: Typefully API・DB更新なしの確認
 */

import { NextRequest, NextResponse } from 'next/server'
import { reserveUpcomingDailyZukanTypefully } from '@/lib/daily-zukan-typefully-reservations'

export const runtime = 'nodejs'
export const maxDuration = 120

function assertCronAuth(req: NextRequest): NextResponse | null {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

function parseDays(value: string | null): number {
  const days = Number(value ?? '7')
  if (!Number.isFinite(days)) return 7
  return Math.trunc(days)
}

function isValidDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))
}

export async function GET(req: NextRequest) {
  const authError = assertCronAuth(req)
  if (authError) return authError

  const startDate = req.nextUrl.searchParams.get('start_date') ?? undefined
  if (startDate && !isValidDateKey(startDate)) {
    return NextResponse.json(
      {
        ok: false,
        error: 'invalid_start_date',
        detail: 'start_date は YYYY-MM-DD 形式で指定してください',
      },
      { status: 400 },
    )
  }

  const dryRun = req.nextUrl.searchParams.get('dry_run') === '1'
  const days = parseDays(req.nextUrl.searchParams.get('days'))

  const result = await reserveUpcomingDailyZukanTypefully({
    startDate,
    days,
    dryRun,
  })

  return NextResponse.json(result, { status: result.ok ? 200 : 502 })
}
