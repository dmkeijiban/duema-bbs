import { createAdminClient } from '@/lib/supabase-admin'
import type { ZukanCard } from '@/lib/zukan'

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

export async function attachZukanCardImages(cards: ZukanCard[]): Promise<ZukanCard[]> {
  const unresolved = cards.filter(card => !card.official_image_url && !card.image_url)
  if (unresolved.length === 0) return cards

  try {
    const admin = createAdminClient()
    const imagesBySlug = new Map<string, string>()
    const cardsByPageUrl = new Map(
      unresolved
        .filter(card => typeof card.official_page_url === 'string' && card.official_page_url.length > 0)
        .map(card => [card.official_page_url as string, card])
    )

    const pageUrls = Array.from(cardsByPageUrl.keys())
    if (pageUrls.length > 0) {
      const { data, error } = await admin
        .from('card_printings')
        .select('official_page_url,image_url,is_representative,is_search_visible')
        .in('official_page_url', pageUrls)
        .limit(pageUrls.length * 4)

      const printings = (error ? [] : data ?? []) as PrintingRow[]
      const imageByPageUrl = new Map<string, string>()
      for (const printing of printings) {
        if (!printing.official_page_url || !printing.image_url) continue
        const current = imageByPageUrl.get(printing.official_page_url)
        if (!current || printing.is_representative || printing.is_search_visible) {
          imageByPageUrl.set(printing.official_page_url, printing.image_url)
        }
      }

      for (const [pageUrl, card] of cardsByPageUrl) {
        const imageUrl = imageByPageUrl.get(pageUrl)
        if (imageUrl) imagesBySlug.set(card.slug, imageUrl)
      }
    }

    const unresolvedNames = Array.from(new Set(
      unresolved.filter(card => !imagesBySlug.has(card.slug)).map(card => card.name)
    ))

    if (unresolvedNames.length > 0) {
      const { data, error } = await admin
        .from('cards')
        .select('name,image_url,card_printings(image_url,is_representative,is_search_visible,official_sort_position)')
        .in('name', unresolvedNames)
        .eq('is_active', true)
        .limit(unresolvedNames.length * 2)

      const imageByName = new Map<string, string>()
      for (const card of (error ? [] : data ?? []) as CardRow[]) {
        const imageUrl = choosePrintingImage(card.card_printings) ?? card.image_url
        if (imageUrl && !imageByName.has(card.name)) imageByName.set(card.name, imageUrl)
      }

      for (const card of unresolved) {
        if (imagesBySlug.has(card.slug)) continue
        const imageUrl = imageByName.get(card.name)
        if (imageUrl) imagesBySlug.set(card.slug, imageUrl)
      }
    }

    if (imagesBySlug.size === 0) return cards
    return cards.map(card => {
      const imageUrl = imagesBySlug.get(card.slug)
      return imageUrl ? { ...card, official_image_url: imageUrl } : card
    })
  } catch {
    return cards
  }
}
