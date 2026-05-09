import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

export const runtime = 'nodejs'

const OG_WIDTH = 1200
const OG_HEIGHT = 675

// SSRF対策: プライベートIPをブロック、公開HTTPSのみ許可
function isAllowedUrl(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url)
    if (protocol !== 'https:') return false
    // プライベートIP・ローカルホストをブロック
    if (
      hostname === 'localhost' ||
      hostname === '::1' ||
      /^127\./.test(hostname) ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      /^169\.254\./.test(hostname) ||
      /^0\./.test(hostname)
    ) return false
    return true
  } catch {
    return false
  }
}

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get('url')
  if (!rawUrl) return new NextResponse('Missing url', { status: 400 })

  const decodedUrl = decodeURIComponent(rawUrl)
  if (!isAllowedUrl(decodedUrl)) {
    return new NextResponse('Disallowed url', { status: 403 })
  }

  try {
    const res = await fetch(decodedUrl, {
      next: { revalidate: 86400 },
    })
    if (!res.ok) return new NextResponse('Failed to fetch image', { status: 502 })

    const buffer = Buffer.from(await res.arrayBuffer())
    const contentType = res.headers.get('content-type') ?? ''

    // GIF はアニメーション保持のため letterbox（余白付き黒背景）で処理
    const isGif = contentType.includes('gif')

    let processed: Buffer
    if (isGif) {
      // GIF: 16:9 キャンバスに収まるよう縮小し、上下左右を黒でパディング
      processed = await sharp(buffer)
        .resize(OG_WIDTH, OG_HEIGHT, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } })
        .webp({ quality: 85 })
        .toBuffer()
    } else {
      // その他: 中央をトリミングして 1200×675 に固定
      processed = await sharp(buffer)
        .resize(OG_WIDTH, OG_HEIGHT, {
          fit: 'cover',
          position: 'centre',
          withoutEnlargement: false,
        })
        .webp({ quality: 85 })
        .toBuffer()
    }

    return new NextResponse(new Uint8Array(processed), {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
      },
    })
  } catch {
    return new NextResponse('Image processing failed', { status: 500 })
  }
}
