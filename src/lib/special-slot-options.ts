import type { createAdminClient } from '@/lib/supabase-admin'

export type SpecialSlotOption = {
  id: string
  name: string
  nameKana: string | null
  imageUrl: string | null
  cardType: string | null
}

/**
 * 特殊枠（アドバンス用「なし／ドルマゲドン相当／零龍相当」）の許可候補を、
 * API（/api/cards/special-options）と保存処理（savePublishedDeck）の両方が
 * 同じ定義から取得するための共有ロジック。
 *
 * `cards.deck_zone_class = 'special'` のカードをそのまま候補にすると、印刷違い
 * ではなく別ロジックカードとして複数登録された同種カードがある場合に候補が
 * 2件を超える恐れがある。そこで cardType ごとに安定した1件（id昇順で先頭）
 * だけを代表として選び、常に「cardTypeの数」＝候補数（現状は
 * 最終禁断フィールド／零龍クリーチャーの2種類）に固定する。
 * printing/image のIDではなく、必ず cards.id（logical card ID）を返す。
 */
export async function getSpecialSlotOptions(admin: ReturnType<typeof createAdminClient>): Promise<SpecialSlotOption[]> {
  const { data, error } = await admin
    .from('cards')
    .select('id,name,name_kana,image_url,card_type')
    .eq('is_active', true)
    .eq('deck_zone_class', 'special')
    .order('card_type', { ascending: true })
    .order('id', { ascending: true })
  if (error) throw error
  const seenTypes = new Set<string>()
  const options: SpecialSlotOption[] = []
  for (const row of data ?? []) {
    const type = row.card_type ?? ''
    if (seenTypes.has(type)) continue
    seenTypes.add(type)
    options.push({ id: row.id, name: row.name, nameKana: row.name_kana, imageUrl: row.image_url, cardType: row.card_type })
  }
  return options
}

/** null（「なし」）は常に許可。それ以外は許可候補一覧に含まれる場合のみ許可。 */
export function isAllowedSpecialCardId(options: SpecialSlotOption[], candidateId: string | null) {
  if (!candidateId) return true
  return options.some(option => option.id === candidateId)
}
