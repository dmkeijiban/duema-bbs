import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

async function callGenerate(
  req: NextRequest,
  type: 'weekly' | 'monthly',
  cronSecret: string,
  params: Record<string, string> = {},
) {
  const url = new URL('/api/summary/generate', req.nextUrl.origin)
  url.searchParams.set('type', type)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  const res = await fetch(url.toString(), {
    headers: { authorization: `Bearer ${cronSecret}` },
    cache: 'no-store',
  })

  let body: unknown
  try {
    body = await res.json()
  } catch {
    body = { error: await res.text() }
  }

  return { status: res.status, body }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const weekly = []
  for (let weeksAgo = 1; weeksAgo <= 4; weeksAgo += 1) {
    weekly.push(await callGenerate(req, 'weekly', cronSecret, { weeksAgo: String(weeksAgo) }))
  }

  const [monthly] = await Promise.all([
    callGenerate(req, 'monthly', cronSecret),
  ])

  return NextResponse.json({ ok: true, results: { weekly, monthly } })
}
