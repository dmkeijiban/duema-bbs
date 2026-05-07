import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

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

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get('url')
  const rawReferer = req.nextUrl.searchParams.get('referer')
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

  // refererパラメータがあれば元ページURL（corocoro.jpなどのCDNはページURLが必要）、なければホスト名
  const parsed = new URL(url)
  let refererHeader = `${parsed.protocol}//${parsed.hostname}/`
  if (rawReferer) {
    try {
      const decoded = decodeURIComponent(rawReferer)
      new URL(decoded) // バリデーション
      refererHeader = decoded
    } catch { /* 不正なら無視してデフォルト使用 */ }
  }

  const fetchHeaders = {
    Referer: refererHeader,
    Origin: `${new URL(refererHeader).protocol}//${new URL(refererHeader).hostname}`,
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
    'Sec-Fetch-Dest': 'image',
    'Sec-Fetch-Mode': 'no-cors',
    'Sec-Fetch-Site': 'same-site',
  }

  try {
    let res = await fetch(url, {
      headers: fetchHeaders,
      next: { revalidate: 86400 }, // 24h キャッシュ
      signal: AbortSignal.timeout(8000),
    })

    // 403の場合はReferer/Originを省いてリトライ
    if (res.status === 403) {
      res = await fetch(url, {
        headers: {
          'User-Agent': fetchHeaders['User-Agent'],
          Accept: fetchHeaders.Accept,
          'Accept-Language': fetchHeaders['Accept-Language'],
        },
        signal: AbortSignal.timeout(8000),
      })
    }

    if (!res.ok) {
      return NextResponse.json({ error: `Upstream ${res.status}` }, { status: res.status })
    }

    const contentType = res.headers.get('content-type') ?? 'image/jpeg'
    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'Not an image' }, { status: 400 })
    }

    const buffer = await res.arrayBuffer()
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
      },
    })
  } catch (err) {
    console.error('ogp-image proxy error:', err)
    return NextResponse.json({ error: 'Fetch failed' }, { status: 502 })
  }
}
