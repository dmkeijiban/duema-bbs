import { NextRequest, NextResponse } from 'next/server'

// SSRF対策：プライベートIPをブロック
function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
    const h = parsed.hostname
    if (
      h === 'localhost' ||
      h === '::1' ||
      /^127\./.test(h) ||
      /^10\./.test(h) ||
      /^192\.168\./.test(h) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
      /^169\.254\./.test(h) ||
      /^0\./.test(h)
    ) return false
    return true
  } catch {
    return false
  }
}

function extractMeta(html: string, property: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']og:${property}["'][^>]+content=["']([^"']*?)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*?)["'][^>]+property=["']og:${property}["']`, 'i'),
  ]
  for (const p of patterns) {
    const m = html.match(p)
    if (m?.[1]) return m[1]
  }
  return null
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
}

function resolveUrl(base: string, imageUrl: string | null): string | null {
  if (!imageUrl) return null
  try {
    // og:image の content 属性に &amp; などのHTMLエンティティが含まれる場合を解決する
    return new URL(decodeHtmlEntities(imageUrl), base).href
  } catch {
    return null
  }
}

// YouTube 動画URLから videoId を抽出（host も検証する。playlist/チャンネル等はnull）
function getYouTubeVideoId(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl)
    const host = u.hostname.replace(/^www\./, '').replace(/^m\./, '')
    if (host === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0]
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null
    }
    if (host === 'youtube.com' || host === 'music.youtube.com') {
      const v = u.searchParams.get('v')
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v
      const m = u.pathname.match(/\/(?:shorts|embed|live|v)\/([a-zA-Z0-9_-]{11})/)
      if (m) return m[1]
    }
    return null
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get('url')
  if (!rawUrl) return NextResponse.json({ error: 'Missing url' }, { status: 400 })

  let url: string
  try {
    url = decodeURIComponent(rawUrl)
    new URL(url)
  } catch {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 })
  }

  if (!isSafeUrl(url)) {
    return NextResponse.json({ error: 'Disallowed url' }, { status: 403 })
  }

  // YouTube はフルページscrapeだと同意ページが返り title が「- YouTube」になりサムネも取れない。
  // 公式 oEmbed で正規タイトルを取得し、サムネは videoId から静的URLを組み立てる（fetch回数は増やさない）。
  const ytId = getYouTubeVideoId(url)
  if (ytId) {
    const thumbnail = `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`
    const hostname = new URL(url).hostname
    try {
      const oembed = await fetch(
        `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${ytId}`)}`,
        { signal: AbortSignal.timeout(8000), next: { revalidate: 86400 } }
      )
      if (oembed.ok) {
        const data = (await oembed.json()) as { title?: string; author_name?: string }
        return NextResponse.json(
          {
            title: data.title?.trim() || null,
            description: data.author_name?.trim() || null,
            image: thumbnail,
            url,
            hostname,
          },
          { headers: { 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' } }
        )
      }
    } catch {
      // oEmbed 失敗時も videoId ベースの fallback を返す（クライアントで「YouTube動画」表示）
    }
    return NextResponse.json(
      { title: null, description: null, image: thumbnail, url, hostname },
      { headers: { 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' } }
    )
  }

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
      },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 3600 },
    })

    if (!res.ok) return NextResponse.json({ error: 'Fetch failed' }, { status: 502 })

    const html = await res.text()

    const title =
      extractMeta(html, 'title') ||
      html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ||
      null

    const description = extractMeta(html, 'description')
    const rawImage = extractMeta(html, 'image')
    const imageUrl = resolveUrl(url, rawImage)
    const hostname = new URL(url).hostname

    return NextResponse.json(
      { title, description, image: imageUrl, url, hostname },
      { headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' } }
    )
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
