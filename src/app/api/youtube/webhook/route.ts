import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const CHANNEL_URL = 'https://www.youtube.com/@darekanizatugaku'

function createAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

function parseNotification(xml: string): { videoId: string; title: string; publishedAt: string } | null {
  const videoIdMatch = xml.match(/<yt:videoId>(.*?)<\/yt:videoId>/)
  if (!videoIdMatch) return null

  const videoId = videoIdMatch[1]
  if (!videoId) return null

  // フィード内の最初の <title> はチャンネル名なので2番目以降を取得
  const titleMatches = [...xml.matchAll(/<title>([\s\S]*?)<\/title>/g)]
  const rawTitle = titleMatches[1]?.[1] ?? titleMatches[0]?.[1] ?? ''
  const title = rawTitle
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()

  const publishedMatch = xml.match(/<published>(.*?)<\/published>/)

  return {
    videoId,
    title,
    publishedAt: publishedMatch?.[1] ?? new Date().toISOString(),
  }
}

async function postToDiscord(videoId: string, title: string, publishedAt: string): Promise<void> {
  const webhookUrl = process.env.YOUTUBE_WEBHOOK_URL
  if (!webhookUrl) return

  const embed = {
    title,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    color: 0xff0000,
    thumbnail: { url: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` },
    footer: { text: '話題のデュエマ反応集' },
    timestamp: publishedAt || new Date().toISOString(),
  }

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: `🎬 **新着動画が投稿されました！**\n${CHANNEL_URL}`,
      embeds: [embed],
      allowed_mentions: { parse: [] },
    }),
  })

  if (!res.ok) {
    throw new Error(`Discord webhook error: ${res.status} ${await res.text()}`)
  }
}

// GET: PubSubHubbub サブスクリプション確認（YouTubeからのチャレンジに応答）
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const challenge = searchParams.get('hub.challenge')
  const mode = searchParams.get('hub.mode')

  if (mode === 'subscribe' && challenge) {
    console.log('YouTube PubSubHubbub subscription verified')
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
}

// POST: YouTubeからの新着動画プッシュ通知
export async function POST(req: NextRequest) {
  const xml = await req.text()

  if (!xml.includes('<yt:videoId>')) {
    // 動画IDのないチャンネル更新通知は無視
    return NextResponse.json({ ok: true, skipped: true, reason: 'no videoId' })
  }

  const video = parseNotification(xml)
  if (!video) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'parse failed' })
  }

  const supabase = createAnonClient()

  // 重複通知チェック
  const { data } = await supabase
    .from('youtube_state')
    .select('value')
    .eq('key', 'last_video_id')
    .maybeSingle()
  const lastVideoId = (data as { value: string } | null)?.value ?? null

  if (lastVideoId === video.videoId) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'already notified' })
  }

  try {
    await postToDiscord(video.videoId, video.title, video.publishedAt)
  } catch (err) {
    console.error('Discord notify error (webhook):', err)
    return NextResponse.json({ error: 'Discord notify failed' }, { status: 500 })
  }

  await supabase
    .from('youtube_state')
    .upsert({ key: 'last_video_id', value: video.videoId, updated_at: new Date().toISOString() })

  console.log(`YouTube push notification sent: ${video.videoId} - ${video.title}`)
  return NextResponse.json({ ok: true, notified: true, videoId: video.videoId, title: video.title })
}
