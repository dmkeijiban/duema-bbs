import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

async function callGenerate(req: NextRequest, type: 'weekly' | 'monthly', cronSecret: string) {
  const url = new URL('/api/summary/generate', req.nextUrl.origin)
  url.searchParams.set('type', type)
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

  const [weekly, monthly] = await Promise.all([
    callGenerate(req, 'weekly', cronSecret),
    callGenerate(req, 'monthly', cronSecret),
  ])

  return NextResponse.json({ ok: true, results: { weekly, monthly } })
}
