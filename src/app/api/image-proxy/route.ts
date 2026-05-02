import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

// プロキシを許可するホスト（ホットリンク禁止サイトのみ）
const ALLOWED_HOSTS = ['bbs.animanch.com']

// ホストごとに付与する Referer
const REFERER_MAP: Record<string, string> = {
  'bbs.animanch.com': 'https://bbs.animanch.com/',
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) {
    return NextResponse.json({ error: 'url parameter required' }, { status: 400 })
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    return NextResponse.json({ error: 'Forbidden host' }, { status: 403 })
  }

  try {
    const upstream = await fetch(url, {
      headers: {
        Referer: REFERER_MAP[parsed.hostname] ?? `https://${parsed.hostname}/`,
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
      // Edge Runtimeではなく nodejs なので fetch キャッシュが使える
      next: { revalidate: 86400 }, // 24h
    })

    if (!upstream.ok) {
      return NextResponse.json({ error: `Upstream ${upstream.status}` }, { status: upstream.status })
    }

    const contentType = upstream.headers.get('content-type') ?? 'image/webp'
    const buffer = await upstream.arrayBuffer()

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
      },
    })
  } catch (err) {
    console.error('image-proxy error:', err)
    return NextResponse.json({ error: 'Fetch failed' }, { status: 502 })
  }
}
