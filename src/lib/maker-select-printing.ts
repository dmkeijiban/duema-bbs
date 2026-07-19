import { createAdminClient } from '@/lib/supabase-admin'

// 参加型カード選択企画（例: my-duema-9）の保存済みアイテムから、保存時に選んだ収録版
// (source_key) と面 (face_side_index) を完全一致で解決する共通処理。
// card_id だけから代表画像(cards.image_url)を引き直すことはしない。
// source_key が保存されていない旧投稿だけ、安全なフォールバック(代表画像)を使う。

export type SelectPrintingRef = { cardId: string; sourceKey: string | null; faceSideIndex: number | null }
export type ResolvedPrinting = { imageUrl: string | null; officialPageUrl: string | null; name: string | null }

export function selectPrintingRefKey(ref: SelectPrintingRef) {
  return `${ref.cardId}:${ref.sourceKey ?? 'representative'}:${ref.faceSideIndex ?? 'front'}`
}

export async function resolveSelectPrintingImages(refs: SelectPrintingRef[]): Promise<Map<string, ResolvedPrinting>> {
  const result = new Map<string, ResolvedPrinting>()
  const sourceKeys = [...new Set(refs.map(ref => ref.sourceKey).filter((key): key is string => Boolean(key)))]
  if (!sourceKeys.length) return result

  const admin = createAdminClient()
  const { data: printings } = await admin.from('card_printings').select('id,card_id,source_key,image_url,official_page_url').in('source_key', sourceKeys)
  const printingByCardSourceKey = new Map((printings ?? []).map(printing => [`${printing.card_id}:${printing.source_key}`, printing]))
  const printingIds = [...new Set((printings ?? []).map(printing => printing.id))]

  const { data: faces } = printingIds.length
    ? await admin.from('card_faces').select('card_printing_id,side_index,name,image_url,official_page_url').in('card_printing_id', printingIds)
    : { data: [] as { card_printing_id: string; side_index: number; name: string; image_url: string | null; official_page_url: string | null }[] }
  const faceByKey = new Map((faces ?? []).map(face => [`${face.card_printing_id}:${face.side_index}`, face]))

  for (const ref of refs) {
    if (!ref.sourceKey) continue
    const key = selectPrintingRefKey(ref)
    if (result.has(key)) continue
    const printing = printingByCardSourceKey.get(`${ref.cardId}:${ref.sourceKey}`)
    if (!printing) continue
    const face = ref.faceSideIndex !== null ? faceByKey.get(`${printing.id}:${ref.faceSideIndex}`) : null
    result.set(key, {
      imageUrl: face?.image_url ?? printing.image_url,
      officialPageUrl: face?.official_page_url ?? printing.official_page_url,
      name: face?.name ?? null,
    })
  }
  return result
}
