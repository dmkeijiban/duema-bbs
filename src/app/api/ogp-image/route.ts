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

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

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

  const imgHostOrigin = (() => {
    const p = new URL(url)
    return `${p.protocol}//${p.hostname}/`
  })()

  // ページURLのReferer
  let pageReferer: string | null = null
  if (rawReferer) {
    try {
      const decoded = decodeURIComponent(rawReferer)
      new URL(decoded)
      pageReferer = decoded
    } catch { /* ignore */ }
  }

  // Refererを3段階で試す：ページURL → 画像ホストのドメイン → なし
  const attempts: Record<string, string>[] = [
    ...(pageReferer ? [{ Referer: pageReferer, 'User-Agent': UA, Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8', 'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8' }] : []),
    { Referer: imgHostOrigin, 'User-Agent': UA, Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8', 'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8' },
    { 'User-Agent': UA, Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8', 'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8' },
  ]

  for (const headers of attempts) {
    try {
      const res = await fetch(url, {
        headers,
        cache: 'no-store', // Next.jsのデータキャッシュは使わずレスポンスヘッダーでVercelエッジキャッシュに委ねる
        signal: AbortSignal.timeout(8000),
      })

      if (!res.ok) continue

      const contentType = res.headers.get('content-type') ?? 'image/jpeg'
      if (!contentType.startsWith('image/')) continue

      const buffer = await res.arrayBuffer()
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
        },
      })
    } catch {
      continue
    }
  }

  return NextResponse.json({ error: 'Fetch failed' }, { status: 502 })
}
