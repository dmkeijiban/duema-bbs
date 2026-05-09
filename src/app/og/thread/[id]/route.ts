import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { createClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

const OG_WIDTH = 1200
const OG_HEIGHT = 675

interface Props {
  params: Promise<{ id: string }>
}

function isAllowedUrl(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url)
    if (protocol !== 'https:') return false
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

async function getThreadImage(threadId: number): Promise<string | undefined> {
  const supabase = await createClient()
  const { data: thread } = await supabase
    .from('threads')
    .select('image_url')
    .eq('id', threadId)
    .single()

  if (thread?.image_url) return thread.image_url

  const { data: postImg } = await supabase
    .from('posts')
    .select('image_url')
    .eq('thread_id', threadId)
    .not('image_url', 'is', null)
    .order('post_number', { ascending: true })
    .limit(1)
    .single()

  return postImg?.image_url ?? undefined
}

async function renderOgImage(imageUrl: string): Promise<Buffer> {
  const res = await fetch(imageUrl, { next: { revalidate: 86400 } })
  if (!res.ok) throw new Error('Failed to fetch image')

  const buffer = Buffer.from(await res.arrayBuffer())
  const contentType = res.headers.get('content-type') ?? ''
  const isGif = contentType.includes('gif')

  return sharp(buffer)
    .resize(OG_WIDTH, OG_HEIGHT, {
      fit: isGif ? 'contain' : 'cover',
      position: 'centre',
      background: { r: 0, g: 0, b: 0, alpha: 1 },
      withoutEnlargement: false,
    })
    .jpeg({ quality: 85 })
    .toBuffer()
}

export async function GET(_req: NextRequest, { params }: Props) {
  const { id } = await params
  const threadId = parseInt(id.replace(/\.jpg$/i, ''))
  if (isNaN(threadId)) return new NextResponse('Invalid thread id', { status: 400 })

  const imageUrl = await getThreadImage(threadId)
  if (!imageUrl) return new NextResponse('No image', { status: 404 })
  if (!isAllowedUrl(imageUrl)) return new NextResponse('Disallowed image url', { status: 403 })

  try {
    const processed = await renderOgImage(imageUrl)
    return new NextResponse(new Uint8Array(processed), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
      },
    })
  } catch {
    return new NextResponse('Image processing failed', { status: 500 })
  }
}
