import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const OFFICIAL_HOST = 'dm.takaratomy.co.jp'
const ALLOWED_IMAGE_PATHS = [
  '/wp-content/card/cardimage/',
  '/wp-content/card/cardthumb/',
  '/wp-content/themes/dm2019/img/product/',
]
const MAX_BYTES = 8 * 1024 * 1024
const MAX_REDIRECTS = 2
const TIMEOUT_MS = 8_000
const USER_AGENT = 'DuemaBBSCardImporter/1.0 (+https://www.duema-bbs.com/contact)'

function isAllowedImageUrl(url: URL) {
  return url.protocol === 'https:'
    && url.hostname === OFFICIAL_HOST
    && (!url.port || url.port === '443')
    && !url.username
    && !url.password
    && !url.search
    && !url.hash
    && ALLOWED_IMAGE_PATHS.some((prefix) => url.pathname.startsWith(prefix))
}

async function fetchOfficialImage(initialUrl: URL) {
  let url = initialUrl
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const response = await fetch(url, {
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: 'image/avif,image/webp,image/jpeg,image/png,image/*;q=0.8', 'User-Agent': USER_AGENT },
    })
    if (response.status < 300 || response.status >= 400) return response
    const location = response.headers.get('location')
    if (!location || redirects === MAX_REDIRECTS) throw new Error('Invalid redirect')
    const nextUrl = new URL(location, url)
    if (!isAllowedImageUrl(nextUrl)) throw new Error('Forbidden redirect')
    url = nextUrl
  }
  throw new Error('Too many redirects')
}

export async function GET(request: NextRequest) {
  if (process.env.CARD_IMAGES_ENABLED === 'false') return new NextResponse('Card images disabled', { status: 403 })
  const rawUrl = request.nextUrl.searchParams.get('url')
  if (!rawUrl || rawUrl.length > 2_048) return new NextResponse('Invalid URL', { status: 400 })

  let url: URL
  try { url = new URL(rawUrl) } catch { return new NextResponse('Invalid URL', { status: 400 }) }
  if (!isAllowedImageUrl(url)) return new NextResponse('Forbidden image URL', { status: 403 })

  try {
    const response = await fetchOfficialImage(url)
    if (!response.ok) return new NextResponse('Image fetch failed', { status: 502 })
    const contentType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() ?? ''
    const contentLength = Number(response.headers.get('content-length') ?? 0)
    const allowedTypes = new Set(['image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/webp'])
    if (!allowedTypes.has(contentType)) return new NextResponse('Invalid image type', { status: 415 })
    if (contentLength > MAX_BYTES) return new NextResponse('Image too large', { status: 413 })
    const bytes = await response.arrayBuffer()
    if (bytes.byteLength > MAX_BYTES) return new NextResponse('Image too large', { status: 413 })

    return new NextResponse(bytes, { headers: {
      'Cache-Control': 'public, max-age=60, s-maxage=300',
      'Content-Length': String(bytes.byteLength),
      'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff',
    } })
  } catch {
    return new NextResponse('Image fetch failed', { status: 502 })
  }
}
