import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Vercel Cron から毎日 01:00 UTC に呼ばれる統合エンドポイント。
 * - 月曜日(UTC) → 週次まとめを生成
 * - 1日(UTC)   → 月次まとめを生成
 * どちらも /api/summary/generate?type=xxx に内部 fetch する。
 * 両条件が重なる日（月初の月曜）は両方生成する。
 */
export async function GET(req: NextRequest) {
  // CRON_SECRET による認証
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const dayOfWeek = now.getUTCDay()   // 0=Sun, 1=Mon
  const dayOfMonth = now.getUTCDate() // 1-31

  const base = new URL('/api/summary/generate', req.nextUrl.origin)
  const headers: Record<string, string> = cronSecret
    ? { authorization: `Bearer ${cronSecret}` }
    : {}

  const results: Record<string, unknown> = {}

  // 月曜日 → 週次
  if (dayOfWeek === 1) {
    const url = new URL(base)
    url.searchParams.set('type', 'weekly')
    const res = await fetch(url.toString(), { headers })
    results.weekly = await res.json()
  }

  // 1日 → 月次
  if (dayOfMonth === 1) {
    const url = new URL(base)
    url.searchParams.set('type', 'monthly')
    const res = await fetch(url.toString(), { headers })
    results.monthly = await res.json()
  }

  if (Object.keys(results).length === 0) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'not Monday or 1st of month' })
  }

  return NextResponse.json({ ok: true, results })
}
