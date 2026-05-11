import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminCookie } from '@/lib/admin-auth'
import { COMMENT_IMPORT_LIMIT, extractYouTubeVideoId } from '@/lib/comment-import'

interface YouTubeCommentItem {
  id: string
  snippet?: {
    topLevelComment?: {
      snippet?: {
        textOriginal?: string
      }
    }
  }
}

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  if (!verifyAdminCookie(cookieStore.get('admin_auth')?.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = req.nextUrl.searchParams.get('url') ?? ''
  const videoId = extractYouTubeVideoId(url)
  if (!videoId) {
    return NextResponse.json({ error: 'YouTube URLを読み取れませんでした。' }, { status: 400 })
  }

  const apiKey = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'YOUTUBE_API_KEY が未設定です。Vercelの環境変数に追加してください。' }, { status: 500 })
  }

  const params = new URLSearchParams({
    part: 'snippet',
    videoId,
    maxResults: String(COMMENT_IMPORT_LIMIT),
    order: 'relevance',
    textFormat: 'plainText',
    key: apiKey,
  })

  const res = await fetch(`https://www.googleapis.com/youtube/v3/commentThreads?${params}`, {
    cache: 'no-store',
  })
  const data = await res.json()

  if (!res.ok) {
    const message = data?.error?.message ?? 'YouTubeコメント取得に失敗しました。'
    return NextResponse.json({ error: message }, { status: res.status })
  }

  const comments = ((data.items ?? []) as YouTubeCommentItem[])
    .map(item => item.snippet?.topLevelComment?.snippet?.textOriginal?.trim())
    .filter((body): body is string => !!body)
    .slice(0, COMMENT_IMPORT_LIMIT)

  return NextResponse.json({ videoId, comments })
}
