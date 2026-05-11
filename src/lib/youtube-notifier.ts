import { createAdminClient } from '@/lib/supabase-admin'

export const YOUTUBE_CHANNEL_ID = 'UCRsyn5WXG3jkqBu9XGIyW1w'
export const YOUTUBE_CHANNEL_URL = 'https://www.youtube.com/@darekanizatugaku'
export const YOUTUBE_RSS_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`
const CHANNEL_PAGE_URL = `https://www.youtube.com/channel/${YOUTUBE_CHANNEL_ID}/videos`
const NOTIFIED_IDS_KEY = 'notified_video_ids'
const LAST_VIDEO_ID_KEY = 'last_video_id'

export interface YouTubeVideoEntry {
  videoId: string
  title: string
  url: string
  thumbnail: string
  publishedAt: string
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

function getTagValue(xml: string, tagName: string): string {
  const match = xml.match(new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`))
  return match?.[1] ? decodeXml(match[1]) : ''
}

function normalizeTimestamp(value: string): string {
  if (!value) return new Date().toISOString()
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : new Date().toISOString()
}

export function parseYouTubeEntriesFromXml(xml: string): YouTubeVideoEntry[] {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)]
    .map(match => {
      const entry = match[1] ?? ''
      const videoId = getTagValue(entry, 'yt:videoId')
      const title = getTagValue(entry, 'title')
      const publishedAt = getTagValue(entry, 'published')
      if (!videoId || !title) return null

      return {
        videoId,
        title,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
        publishedAt: normalizeTimestamp(publishedAt),
      }
    })
    .filter((entry): entry is YouTubeVideoEntry => Boolean(entry))
}

export function parseYouTubeWebhookXml(xml: string): YouTubeVideoEntry | null {
  const videoId = getTagValue(xml, 'yt:videoId')
  if (!videoId) return null

  const titleMatches = [...xml.matchAll(/<title>([\s\S]*?)<\/title>/g)]
  const rawTitle = titleMatches[1]?.[1] ?? titleMatches[0]?.[1] ?? ''
  const title = decodeXml(rawTitle)
  const publishedAt = getTagValue(xml, 'published')

  return {
    videoId,
    title: title || 'YouTube新着動画',
    url: `https://www.youtube.com/watch?v=${videoId}`,
    thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
    publishedAt: normalizeTimestamp(publishedAt),
  }
}

export async function fetchYouTubeRssEntries(): Promise<YouTubeVideoEntry[]> {
  const res = await fetch(YOUTUBE_RSS_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; duema-bbs/1.0)' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`YouTube RSS fetch failed: ${res.status}`)
  return parseYouTubeEntriesFromXml(await res.text())
}

export async function fetchLatestFromChannelPage(): Promise<YouTubeVideoEntry | null> {
  try {
    const res = await fetch(CHANNEL_PAGE_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'ja,en;q=0.9',
      },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const html = await res.text()

    const startIdx = html.indexOf('var ytInitialData = ')
    if (startIdx === -1) return null
    const jsonStart = startIdx + 'var ytInitialData = '.length
    const scriptEnd = html.indexOf(';</script>', jsonStart)
    if (scriptEnd === -1) return null
    const data = JSON.parse(html.slice(jsonStart, scriptEnd))

    const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs ?? []
    for (const tab of tabs) {
      const content = tab?.tabRenderer?.content
      const items =
        content?.richGridRenderer?.contents ??
        content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents?.[0]?.gridRenderer?.items ??
        []

      for (const item of items) {
        const video = item?.richItemRenderer?.content?.videoRenderer ?? item?.gridVideoRenderer
        const videoId = video?.videoId
        const title = video?.title?.runs?.[0]?.text ?? video?.title?.simpleText
        if (!videoId || !title) continue

        return {
          videoId,
          title,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
          publishedAt: new Date().toISOString(),
        }
      }
    }
  } catch {
    return null
  }

  return null
}

export async function getNotifiedVideoIds(): Promise<string[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('youtube_state')
    .select('value')
    .eq('key', NOTIFIED_IDS_KEY)
    .maybeSingle()

  const raw = (data as { value: string } | null)?.value ?? '[]'
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []
  } catch {
    return []
  }
}

export async function markVideoNotified(videoId: string, existingIds?: string[]): Promise<void> {
  const supabase = createAdminClient()
  const ids = existingIds ?? await getNotifiedVideoIds()
  const updated = [videoId, ...ids.filter(id => id !== videoId)].slice(0, 100)
  const now = new Date().toISOString()

  await Promise.all([
    supabase
      .from('youtube_state')
      .upsert({ key: NOTIFIED_IDS_KEY, value: JSON.stringify(updated), updated_at: now }),
    supabase
      .from('youtube_state')
      .upsert({ key: LAST_VIDEO_ID_KEY, value: videoId, updated_at: now }),
  ])
}

export async function postYouTubeVideoToDiscord(video: YouTubeVideoEntry): Promise<void> {
  const webhookUrl = process.env.YOUTUBE_WEBHOOK_URL
  if (!webhookUrl) throw new Error('YOUTUBE_WEBHOOK_URL is not configured')

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: `🎥 **新着動画が公開されました！**\n${YOUTUBE_CHANNEL_URL}`,
      embeds: [
        {
          title: video.title,
          url: video.url,
          color: 0xff0000,
          thumbnail: { url: video.thumbnail },
          footer: { text: 'デュエマ掲示板 YouTube通知' },
          timestamp: normalizeTimestamp(video.publishedAt),
        },
      ],
      allowed_mentions: { parse: [] },
    }),
  })

  if (!res.ok) {
    throw new Error(`Discord webhook error: ${res.status} ${await res.text()}`)
  }
}

export async function notifyYouTubeVideoIfNeeded(video: YouTubeVideoEntry) {
  const notifiedIds = await getNotifiedVideoIds()
  if (notifiedIds.includes(video.videoId)) {
    return { notified: false, reason: 'already notified', videoId: video.videoId, title: video.title }
  }

  await postYouTubeVideoToDiscord(video)
  await markVideoNotified(video.videoId, notifiedIds)
  return { notified: true, videoId: video.videoId, title: video.title }
}
