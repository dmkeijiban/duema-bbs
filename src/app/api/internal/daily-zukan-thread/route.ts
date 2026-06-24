/**
 * GET /api/internal/daily-zukan-thread
 * 思い出図鑑の公開カードから1枚選び、通常スレを自動作成する。
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

export async function GET(req: NextRequest) {
  const authError = assertCronAuth(req)
  if (authError) return authError

  try {
    const result = await runDailyZukanThread()
    const httpStatus = result.status === 'error' ? 500 : 200
    return NextResponse.json(result, { status: httpStatus })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error'
    console.error('[daily-zukan-thread] unexpected error:', message)
    return NextResponse.json({ status: 'error', error: message }, { status: 500 })
  }
}
