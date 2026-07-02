/**
 * GET /api/internal/thread-remake
 * 自サイト内の既存人気スレを元に、1日1本だけリメイクスレを作る。
 * dry_run=1 では候補・除外理由・生成結果だけを返し、DBには書き込まない。
 */

import { NextRequest, NextResponse } from 'next/server'
import { runThreadRemake } from '@/lib/thread-remake'

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

  const dryRun = req.nextUrl.searchParams.get('dry_run') === '1' || req.nextUrl.searchParams.get('dry_run') === 'true'
  const result = await runThreadRemake({ dryRun })
  const status = result.status === 'error' ? 500 : 200

  if (result.status === 'dry_run') {
    console.log('[thread-remake] dry_run', {
      selected: result.selected,
      candidateCount: result.candidateCount,
      skippedReason: result.skippedReason ?? null,
      excludedByReason: result.excludedByReason,
      excludedSample: result.excluded.slice(0, 12),
      generated: result.generated,
    })
  } else if (result.status === 'skipped') {
    console.log('[thread-remake] skipped', {
      reason: result.reason,
      excludedSample: result.excluded.slice(0, 12),
    })
  }

  return NextResponse.json(result, { status })
}
