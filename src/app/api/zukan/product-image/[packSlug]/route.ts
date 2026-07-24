import { NextRequest, NextResponse } from 'next/server'
import { getZukanProduct } from '@/lib/zukan-products'

function absoluteUrl(value: string, base: string): string | null {
  try {
    const url = new URL(value, base)
    if (url.hostname !== 'dm.takaratomy.co.jp') return null
    return url.toString()
  } catch {
    return null
  }
}

function extractProductImage(html: string, productUrl: string, packSlug: string): string | null {
  const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
  const ogImage = ogMatch?.[1] ? absoluteUrl(ogMatch[1], productUrl) : null
  if (ogImage && !/logo|ogp|common/i.test(ogImage)) return ogImage

  const normalizedSlug = packSlug.replace(/-/g, '')
  const imageMatches = Array.from(html.matchAll(/<img[^>]+(?:src|data-src)=["']([^"']+)["'][^>]*>/gi))
    .map(match => absoluteUrl(match[1], productUrl))
    .filter((url): url is string => Boolean(url))

  return imageMatches.find(url => url.toLowerCase().includes(normalizedSlug))
    ?? imageMatches.find(url => /product|item|package|pack/i.test(url) && !/logo|icon|banner|card\/|common/i.test(url))
    ?? ogImage
    ?? null
}

export async function GET(_request: NextRequest, context: { params: Promise<{ packSlug: string }> }) {
  const { packSlug } = await context.params
  const product = getZukanProduct(packSlug)
  if (!product) return new NextResponse(null, { status: 404 })

  try {
    const pageResponse = await fetch(product.url, {
      headers: { 'User-Agent': 'duema-bbs-zukan/1.0' },
      next: { revalidate: 60 * 60 * 24 * 30 },
    })
    if (!pageResponse.ok) return new NextResponse(null, { status: 404 })

    const imageUrl = extractProductImage(await pageResponse.text(), product.url, packSlug)
    if (!imageUrl) return new NextResponse(null, { status: 404 })

    const imageResponse = await fetch(imageUrl, {
      headers: { Referer: product.url, 'User-Agent': 'duema-bbs-zukan/1.0' },
      next: { revalidate: 60 * 60 * 24 * 30 },
    })
    if (!imageResponse.ok) return new NextResponse(null, { status: 404 })

    return new NextResponse(await imageResponse.arrayBuffer(), {
      headers: {
        'Content-Type': imageResponse.headers.get('content-type') ?? 'image/jpeg',
        'Cache-Control': 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=2592000',
      },
    })
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}
