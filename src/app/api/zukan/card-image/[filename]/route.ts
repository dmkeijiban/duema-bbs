import { NextResponse } from 'next/server'

const OFFICIAL_IMAGE_BASE = 'https://dm.takaratomy.co.jp/wp-content/card/cardimage/'
const SAFE_FILENAME = /^[a-z0-9-]+[ab]?\.(?:jpg|jpeg|png|webp)$/i

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params
  if (!SAFE_FILENAME.test(filename)) {
    return NextResponse.json({ error: 'invalid filename' }, { status: 400 })
  }

  const response = await fetch(`${OFFICIAL_IMAGE_BASE}${filename}`, {
    headers: { 'User-Agent': 'duema-bbs-zukan-image-proxy/1.0' },
    next: { revalidate: 60 * 60 * 24 * 30 },
  })
  if (!response.ok) {
    return NextResponse.json({ error: 'official image not found' }, { status: response.status })
  }

  return new NextResponse(response.body, {
    headers: {
      'Content-Type': response.headers.get('content-type') ?? 'image/jpeg',
      'Cache-Control': 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400',
    },
  })
}
