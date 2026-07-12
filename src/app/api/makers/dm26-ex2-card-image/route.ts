import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const ALLOWED_HOST = 'dm.takaratomy.co.jp'
const MAX_REDIRECTS = 3

function isAllowedUrl(url: URL) {
  return url.protocol === 'https:' && url.hostname === ALLOWED_HOST && (url.port === '' || url.port === '443')
}

async function fetchAllowedImage(initialUrl: URL) {
  let currentUrl = initialUrl
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const response = await fetch(currentUrl, { cache: 'force-cache', redirect: 'manual' })
    if (response.status < 300 || response.status >= 400) return response
    const location = response.headers.get('location')
    if (!location || redirects === MAX_REDIRECTS) throw new Error('Invalid image redirect')
    const nextUrl = new URL(location, currentUrl)
    if (!isAllowedUrl(nextUrl)) throw new Error('Forbidden redirect host')
    currentUrl = nextUrl
  }
  throw new Error('Too many redirects')
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get('url')
  if (!rawUrl) return new NextResponse('Missing URL', { status: 400 })

  let url: URL
  try { url = new URL(rawUrl) } catch { return new NextResponse('Invalid URL', { status: 400 }) }
  if (!isAllowedUrl(url)) return new NextResponse('Forbidden host', { status: 403 })

  let response: Response
  try { response = await fetchAllowedImage(url) } catch { return new NextResponse('Image fetch failed', { status: 502 }) }
  if (!response.ok) return new NextResponse('Image fetch failed', { status: 502 })
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.startsWith('image/')) return new NextResponse('Invalid content type', { status: 415 })

  return new NextResponse(await response.arrayBuffer(), {
    headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' },
  })
}
