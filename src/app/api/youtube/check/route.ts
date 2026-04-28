import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 30

const YOUTUBE_CHANNEL_ID = 'UCRsyn5WXG3jkqBu9XGIyW1w'
const RSS_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`
const CHANNEL_URL = 'https://www.youtube.com/@darekanizatugaku'

function createAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

interface VideoEntry {
  videoId: string
  title: string
  url: string
  thumbnail: string
  publishedAt: string
}

function parseRss(xml: string): VideoEntry | null {
  // 最新の<entry>を取得
  const entryMatch = xml.match(/<entry>([\s\S]*?)<\/entry>/)
  if (!entryMatch) return null
  const entry = entryMatch[1]

  const videoIdMatch = entry.match(/<yt:videoId>(.*?)<\/yt:videoId>/)
  const titleMatch = entry.match(/<title>(.*?)<\/title>/)
  const publishedMatch = entry.match(/<published>(.*?)<\/published>/)

  if (!videoIdMatch || !titleMatch) return null

  const videoId = videoIdMatch[1]
  const title = titleMatch[1]
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")

  return {
    videoId,
    title,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
    publishedAt: publishedMatch?.[1] ?? '',
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getLastNotifiedVideoId(supabase: any): Promise<string | null> {
  const { data } = await supabase
    .from('youtube_state')
    .select('value')
    .eq('key', 'last_video_id')
    .maybeSingle()
  return (data as { value: string } | null)?.value ?? null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function setLastNotifiedVideoId(supabase: any, videoId: string) {
  await supabase
    .from('youtube_state')
    .upsert({ key: 'last_video_id', value: videoId, updated_at: new Date().toISOString() })
}

async function postToDiscord(video: VideoEntry): Promise<void> {
  const webhookUrl = process.env.YOUTUBE_WEBHOOK_URL
  if (!webhookUrl) return

  const embed = {
    title: video.title,
    url: video.url,
    color: 0xff0000, // YouTube赤
    thumbnail: { url: video.thumbnail },
    footer: { text: '話題のデュエマ反応集' },
    timestamp: video.publishedAt || new Date().toISOString(),
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

export async function GET(req: NextRequest) {
  // CRON_SECRET による認証
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // RSS取得
  let xml: string
  try {
    const res = await fetch(RSS_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; duema-bbs/1.0)' },
      next: { revalidate: 0 },
    })
    if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`)
    xml = await res.text()
  } catch (err) {
    console.error('YouTube RSS fetch error:', err)
    return NextResponse.json({ error: 'RSS fetch failed' }, { status: 500 })
  }

  // 最新動画を解析
  const latest = parseRss(xml)
  if (!latest) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'no entry in RSS' })
  }

  const supabase = createAnonClient()

  // 前回通知済みのIDと比較
  const lastVideoId = await getLastNotifiedVideoId(supabase)

  if (lastVideoId === latest.videoId) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'no new video', videoId: latest.videoId })
  }

  // 新着動画 → Discord通知
  try {
    await postToDiscord(latest)
  } catch (err) {
    console.error('Discord notify error:', err)
    return NextResponse.json({ error: 'Discord notify failed' }, { status: 500 })
  }

  // 状態を更新
  await setLastNotifiedVideoId(supabase, latest.videoId)

  console.log(`YouTube notification sent: ${latest.videoId} - ${latest.title}`)
  return NextResponse.json({
    ok: true,
    notified: true,
    videoId: latest.videoId,
    title: latest.title,
  })
}
