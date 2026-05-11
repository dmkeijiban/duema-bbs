import { NextRequest, NextResponse } from 'next/server'
import {
  fetchLatestFromChannelPage,
  fetchYouTubeRssEntries,
  getNotifiedVideoIds,
  notifyYouTubeVideoIfNeeded,
  postYouTubeVideoToDiscord,
  markVideoNotified,
  YouTubeVideoEntry,
} from '@/lib/youtube-notifier'

export const runtime = 'nodejs'
export const maxDuration = 60

function assertCronAuth(req: NextRequest): NextResponse | null {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

async function notifyVideos(videos: YouTubeVideoEntry[]) {
  const notifiedIds = await getNotifiedVideoIds()
  const pending = videos
    .filter(video => !notifiedIds.includes(video.videoId))
    .sort((a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt))

  const notified: { videoId: string; title: string }[] = []
  let currentIds = notifiedIds

  for (const video of pending) {
    await postYouTubeVideoToDiscord(video)
    await markVideoNotified(video.videoId, currentIds)
    currentIds = [video.videoId, ...currentIds.filter(id => id !== video.videoId)].slice(0, 100)
    notified.push({ videoId: video.videoId, title: video.title })
  }

  return notified
}

export async function GET(req: NextRequest) {
  const authError = assertCronAuth(req)
  if (authError) return authError

  try {
    let entries = await fetchYouTubeRssEntries()
    if (entries.length === 0) {
      const fallback = await fetchLatestFromChannelPage()
      entries = fallback ? [fallback] : []
    }

    if (entries.length === 0) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'no public videos found' })
    }

    const notified = await notifyVideos(entries)
    if (notified.length === 0) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: 'no new video',
        latestVideoId: entries[0]?.videoId,
      })
    }

    return NextResponse.json({ ok: true, source: 'rss-check', notified })
  } catch (err) {
    console.error('YouTube check notify error:', err)

    const fallback = await fetchLatestFromChannelPage()
    if (!fallback) {
      return NextResponse.json({ error: 'YouTube check failed' }, { status: 500 })
    }

    try {
      const result = await notifyYouTubeVideoIfNeeded(fallback)
      return NextResponse.json({ ok: true, source: 'channel-page-fallback', ...result })
    } catch (fallbackErr) {
      console.error('YouTube fallback notify error:', fallbackErr)
      return NextResponse.json({ error: 'YouTube fallback notify failed' }, { status: 500 })
    }
  }
}
