/**
 * GET /api/internal/x-buzz-thread
 * X話題URLストックから pending URL を古い順に1件だけスレ化する。
 * Vercel Cron から毎日 JST 17:00（UTC 08:00）に呼ばれる。
 * X API / x.com fetch / OGP取得 / スクレイピングは行わない。
 */

import { NextRequest, NextResponse } from 'next/server'
import { publishXBuzzQueueItem } from '@/lib/x-buzz-queue'

export const runtime = 'nodejs'
export const maxDuration = 30

function assertCronAuth(req: NextRequest): NextResponse | null {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const internalSecret = process.env.INTERNAL_POST_SECRET
  const isValidCron = cronSecret && authHeader === `Bearer ${cronSecret}`
  const isValidManual = internalSecret && authHeader === `Bearer ${internalSecret}`

  if (!isValidCron && !isValidManual) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

export async function GET(req: NextRequest) {
  const authError = assertCronAuth(req)
  if (authError) return authError

  const result = await publishXBuzzQueueItem()
  const status = result.status === 'error' ? 500 : 200
  return NextResponse.json({ ok: result.status !== 'error', result }, { status })
}
