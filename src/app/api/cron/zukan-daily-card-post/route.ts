import { NextRequest, NextResponse } from 'next/server'
import { runZukanDailyCardPost } from '@/lib/zukan-daily-card-post'

export const runtime = 'nodejs'
export const maxDuration = 60

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

async function handle(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const dryRun = req.nextUrl.searchParams.get('dryRun') === 'true' ||
    req.nextUrl.searchParams.get('dry_run') === '1'

  const result = await runZukanDailyCardPost({ dryRun })
  const status = result.ok ? 200 : 500

  console.log('[zukan-daily-card-post]', {
    mode: result.mode,
    runDate: result.runDate,
    created: result.created,
    duplicate: result.duplicate,
    skipped: result.skipped,
    errors: result.errors,
    selectedCard: result.selectedCard
      ? {
          id: result.selectedCard.id,
          slug: result.selectedCard.slug,
          name: result.selectedCard.name,
          hasImage: Boolean(result.selectedCard.imageUrl),
        }
      : null,
    reason: result.reason ?? null,
  })

  return NextResponse.json(result, { status })
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return handle(req)
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return handle(req)
}
