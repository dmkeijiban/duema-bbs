import { NextRequest, NextResponse } from 'next/server'
import { notifyYouTubeVideoIfNeeded, parseYouTubeWebhookXml } from '@/lib/youtube-notifier'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const challenge = searchParams.get('hub.challenge')
  const mode = searchParams.get('hub.mode')

  if ((mode === 'subscribe' || mode === 'unsubscribe') && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  const xml = await req.text()
  if (!xml.includes('<yt:videoId>')) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'no videoId' })
  }

  const video = parseYouTubeWebhookXml(xml)
  if (!video) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'parse failed' })
  }

  try {
    const result = await notifyYouTubeVideoIfNeeded(video)
    return NextResponse.json({ ok: true, source: 'webhook', ...result })
  } catch (err) {
    console.error('YouTube webhook notify error:', err)
    return NextResponse.json({ error: 'YouTube webhook notify failed' }, { status: 500 })
  }
}
