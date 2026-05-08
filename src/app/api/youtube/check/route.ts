import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 30

const YOUTUBE_CHANNEL_ID = 'UCRsyn5WXG3jkqBu9XGIyW1w'
const RSS_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`
const CHANNEL_URL = 'https://www.youtube.com/@darekanizatugaku'
const CHANNEL_PAGE_URL = `https://www.youtube.com/channel/${YOUTUBE_CHANNEL_ID}/videos`

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

async function fetchLatestFromChannelPage(): Promise<VideoEntry | null> {
  try {
    const res = await fetch(CHANNEL_PAGE_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'ja,en;q=0.9',
      },
      next: { revalidate: 0 },
    })
    if (!res.ok) return null
    const html = await res.text()

    // ytInitialData から最新動画を抽出
    const startIdx = html.indexOf('var ytInitialData = ')
    if (startIdx === -1) return null
    const jsonStart = startIdx + 'var ytInitialData = '.length
    const scriptEnd = html.indexOf(';</script>', jsonStart)
    if (scriptEnd === -1) return null
    const match = [null, html.slice(jsonStart, scriptEnd)]
    const data = JSON.parse(match[1] as string)

    // tabsRenderer → videosTab → gridRenderer → items
    const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs ?? []
    let videoId: string | undefined
    let title: string | undefined
    let publishedAt: string | undefined

    for (const tab of tabs) {
      const content = tab?.tabRenderer?.content
      const items =
        content?.richGridRenderer?.contents ??
        content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents?.[0]?.gridRenderer?.items ??
        []
      for (const item of items) {
        const video =
          item?.richItemRenderer?.content?.videoRenderer ??
          item?.gridVideoRenderer
        if (!video) continue
        videoId = video.videoId
        title = video.title?.runs?.[0]?.text ?? video.title?.simpleText
        publishedAt = video.publishedTimeText?.simpleText ?? ''
        break
      }
      if (videoId) break
    }

    if (!videoId || !title) return null
    return {
      videoId,
      title,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
      publishedAt: publishedAt ?? '',
    }
  } catch {
    return null
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
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // RSS取得（失敗時はチャンネルページからフォールバック）
  let latest: VideoEntry | null = null
  try {
    const res = await fetch(RSS_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; duema-bbs/1.0)' },
      next: { revalidate: 0 },
    })
    if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`)
    const xml = await res.text()
    latest = parseRss(xml)
  } catch (err) {
    console.error('YouTube RSS fetch error, trying channel page fallback:', err)
    latest = await fetchLatestFromChannelPage()
    if (!latest) {
      return NextResponse.json({ error: 'RSS fetch failed and channel page fallback also failed' }, { status: 500 })
    }
    console.log('Channel page fallback succeeded:', latest.videoId)
  }

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
