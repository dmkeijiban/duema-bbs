import { NextRequest, NextResponse } from 'next/server'
import {
  ensureNotificationStartedAt,
  fetchLatestFromChannelPage,
  fetchYouTubeRssEntries,
  getNotifiedVideoIds,
  initializeYouTubeNotificationBaseline,
  isPublishedAfterStart,
  markVideosNotified,
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
  const startedAt = await ensureNotificationStartedAt()
  const notifiedIds = await getNotifiedVideoIds()
  const uniqueVideos = [...new Map(videos.map(video => [video.videoId, video])).values()]
  const visibleIds = uniqueVideos.map(video => video.videoId)
  const pending = uniqueVideos
    .filter(video => !notifiedIds.includes(video.videoId))
    .filter(video => isPublishedAfterStart(video, startedAt))
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))

  const notified: { videoId: string; title: string }[] = []
  const [latest, ...olderPending] = pending
  const seenWithoutLatest = visibleIds.filter(videoId => videoId !== latest?.videoId)
  let currentIds = await markVideosNotified(seenWithoutLatest, notifiedIds)

  if (olderPending.length > 0) {
    currentIds = await markVideosNotified(olderPending.map(video => video.videoId), currentIds)
  }

  if (latest) {
    await postYouTubeVideoToDiscord(latest)
    await markVideoNotified(latest.videoId, currentIds)
    notified.push({ videoId: latest.videoId, title: latest.title })
  }

  return notified
}

export async function GET(req: NextRequest) {
  const authError = assertCronAuth(req)
  if (authError) return authError

  try {
    let entries = await fetchYouTubeRssEntries()
    if (req.nextUrl.searchParams.get('baseline') === '1') {
      const baseline = await initializeYouTubeNotificationBaseline(entries)
      return NextResponse.json({ ok: true, source: 'rss-baseline', ...baseline })
    }

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
      await markVideoNotified(fallback.videoId)
      return NextResponse.json({
        ok: true,
        skipped: true,
        source: 'channel-page-fallback',
        reason: 'timestamp unavailable; marked latest as seen',
        videoId: fallback.videoId,
        title: fallback.title,
      })
    } catch (fallbackErr) {
      console.error('YouTube fallback notify error:', fallbackErr)
      return NextResponse.json({ error: 'YouTube fallback notify failed' }, { status: 500 })
    }
  }
}
