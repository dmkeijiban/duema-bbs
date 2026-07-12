import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE, verifyAdminCookie } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const rawUrl = request.nextUrl.searchParams.get('url')
  if (!rawUrl) return new NextResponse('Missing URL', { status: 400 })

  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return new NextResponse('Invalid URL', { status: 400 })
  }

  if (url.protocol !== 'https:' || url.hostname !== 'dm.takaratomy.co.jp') {
    return new NextResponse('Forbidden host', { status: 403 })
  }

  const response = await fetch(url, { cache: 'force-cache' })
  if (!response.ok) return new NextResponse('Image fetch failed', { status: 502 })

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.startsWith('image/')) return new NextResponse('Invalid content type', { status: 415 })

  return new NextResponse(await response.arrayBuffer(), {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  })
}
