import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

type ZukanCardRow = {
  name: string
  official_page_url: string | null
}

type PrintingRow = {
  official_page_url: string | null
  image_url: string | null
  is_representative: boolean | null
  is_search_visible: boolean | null
}

type CardPrinting = {
  image_url: string | null
  is_representative: boolean | null
  is_search_visible: boolean | null
  official_sort_position: number | null
}

type CardRow = {
  name: string
  image_url: string | null
  card_printings?: CardPrinting[] | null
}

const MAX_NAMES = 200

function choosePrintingImage(printings: CardPrinting[] | null | undefined): string | null {
  if (!printings?.length) return null

  const sorted = [...printings].sort((a, b) => {
    if (Boolean(a.is_representative) !== Boolean(b.is_representative)) {
      return a.is_representative ? -1 : 1
    }
    if (Boolean(a.is_search_visible) !== Boolean(b.is_search_visible)) {
      return a.is_search_visible ? -1 : 1
    }
    return (a.official_sort_position ?? Number.MAX_SAFE_INTEGER) - (b.official_sort_position ?? Number.MAX_SAFE_INTEGER)
  })

  return sorted.find(printing => typeof printing.image_url === 'string' && printing.image_url.length > 0)?.image_url ?? null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { names?: unknown }
    const names = Array.from(new Set(
      (Array.isArray(body.names) ? body.names : [])
        .filter((name): name is string => typeof name === 'string')
        .map(name => name.trim())
        .filter(Boolean)
        .slice(0, MAX_NAMES)
    ))

    if (names.length === 0) {
      return NextResponse.json({ images: {} })
    }

    const admin = createAdminClient()
    const images = new Map<string, string>()

    const zukanResult = await admin
      .from('zukan_cards')
      .select('name,official_page_url')
      .in('name', names)
      .eq('is_published', true)
      .limit(MAX_NAMES * 3)

    const zukanRows = (zukanResult.error ? [] : zukanResult.data ?? []) as ZukanCardRow[]
    const pageUrls = Array.from(new Set(
      zukanRows
        .map(card => card.official_page_url)
        .filter((url): url is string => typeof url === 'string' && url.length > 0)
    ))

    if (pageUrls.length > 0) {
      const printingResult = await admin
        .from('card_printings')
        .select('official_page_url,image_url,is_representative,is_search_visible')
        .in('official_page_url', pageUrls)
        .limit(MAX_NAMES * 4)

      const printings = (printingResult.error ? [] : printingResult.data ?? []) as PrintingRow[]
      const imageByPageUrl = new Map<string, string>()
      for (const printing of printings) {
        if (!printing.official_page_url || !printing.image_url) continue
        const current = imageByPageUrl.get(printing.official_page_url)
        if (!current || printing.is_representative || printing.is_search_visible) {
          imageByPageUrl.set(printing.official_page_url, printing.image_url)
        }
      }

      for (const card of zukanRows) {
        if (!card.official_page_url) continue
        const imageUrl = imageByPageUrl.get(card.official_page_url)
        if (imageUrl) images.set(card.name, imageUrl)
      }
    }

    const unresolvedNames = names.filter(name => !images.has(name))
    if (unresolvedNames.length > 0) {
      const cardResult = await admin
        .from('cards')
        .select('name,image_url,card_printings(image_url,is_representative,is_search_visible,official_sort_position)')
        .in('name', unresolvedNames)
        .eq('is_active', true)
        .limit(MAX_NAMES * 2)

      const cardRows = (cardResult.error ? [] : cardResult.data ?? []) as CardRow[]
      for (const card of cardRows) {
        const imageUrl = choosePrintingImage(card.card_printings) ?? card.image_url
        if (imageUrl && !images.has(card.name)) images.set(card.name, imageUrl)
      }
    }

    return NextResponse.json(
      { images: Object.fromEntries(images) },
      { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800' } }
    )
  } catch {
    return NextResponse.json({ images: {} }, { status: 200 })
  }
}
