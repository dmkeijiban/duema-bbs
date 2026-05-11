import { NextRequest, NextResponse } from 'next/server'
import { YOUTUBE_CHANNEL_ID } from '@/lib/youtube-notifier'

export const runtime = 'nodejs'
export const maxDuration = 30

const HUB_URL = 'https://pubsubhubbub.appspot.com/'

function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }
  throw new Error('Site URL not configured. Set NEXT_PUBLIC_SITE_URL in Vercel environment variables.')
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let siteUrl: string
  try {
    siteUrl = getSiteUrl()
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }

  const callbackUrl = `${siteUrl}/api/youtube/webhook`
  const topicUrl = `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`
  const params = new URLSearchParams({
    'hub.callback': callbackUrl,
    'hub.topic': topicUrl,
    'hub.verify': 'async',
    'hub.mode': 'subscribe',
    'hub.lease_seconds': '864000',
  })

  const res = await fetch(HUB_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (res.status === 202 || res.status === 204) {
    return NextResponse.json({ ok: true, status: res.status, callbackUrl, topicUrl })
  }

  const text = await res.text()
  console.error('YouTube PubSubHubbub subscription failed:', res.status, text)
  return NextResponse.json({ error: `Hub responded: ${res.status}`, detail: text }, { status: 500 })
}
