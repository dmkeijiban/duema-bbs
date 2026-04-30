import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

const YOUTUBE_CHANNEL_ID = 'UCRsyn5WXG3jkqBu9XGIyW1w'
const HUB_URL = 'https://pubsubhubbub.appspot.com/'

function getSiteUrl(): string {
  // Vercelが自動設定する本番URLを優先、なければ環境変数
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL
  }
  throw new Error('Site URL not configured. Set NEXT_PUBLIC_SITE_URL in Vercel environment variables.')
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
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
    'hub.lease_seconds': '864000', // 10日
  })

  const res = await fetch(HUB_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  // 202 Accepted = async確認待ち（正常）
  if (res.status === 202 || res.status === 204) {
    console.log(`YouTube PubSubHubbub subscription requested. Callback: ${callbackUrl}`)
    return NextResponse.json({ ok: true, status: res.status, callbackUrl })
  }

  const text = await res.text()
  console.error('PubSubHubbub subscription failed:', res.status, text)
  return NextResponse.json({ error: `Hub responded: ${res.status}`, detail: text }, { status: 500 })
}
