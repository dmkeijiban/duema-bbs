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

function resolveUrl(base: string, imageUrl: string | null): string | null {
  if (!imageUrl) return null
  try {
    return new URL(imageUrl, base).href
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

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
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
    const image = resolveUrl(url, rawImage)
    const hostname = new URL(url).hostname

    return NextResponse.json(
      { title, description, image, url, hostname },
      { headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' } }
    )
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
