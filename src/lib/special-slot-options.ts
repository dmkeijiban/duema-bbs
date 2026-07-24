import type { createAdminClient } from '@/lib/supabase-admin'

/** 特殊枠の候補キー。常にこの2つで固定（cardType や id の並び順には依存しない）。 */
export const SPECIAL_SLOT_KEYS = ['dormageddon', 'zeroryu'] as const
export type SpecialSlotKey = typeof SPECIAL_SLOT_KEYS[number]

export const SPECIAL_SLOT_LABELS: Record<SpecialSlotKey, string> = {
  dormageddon: 'ドルマゲドン',
  zeroryu: '零龍',
}

export type SpecialSlotOption = {
  key: SpecialSlotKey
  label: string
  cardId: string
  imageUrl: string | null
}

/**
 * 特殊枠（アドバンス用「なし／ドルマゲドン／零龍」）の許可候補を、
 * API（/api/cards/special-options）と保存処理（savePublishedDeck）の両方が
 * 同じ定義から取得するための共有ロジック。
 *
 * 代表カードの決定は cards.id の昇順や card_type ごとの件数に一切依存させない。
 * special_slot_representatives テーブル（key -> cards.id の固定マッピング）を
 * 唯一の正として参照する。これにより：
 *   - 印刷違い・画像バリエーションが増えても候補数は常に2のまま
 *   - 将来より小さいUUIDの同cardTypeカードが追加されても代表は変わらない
 *   - 他の 最終禁断フィールド/零龍クリーチャー カードが増えても代表は変わらない
 *
 * dormageddon/zeroryu のいずれかがマッピング表に存在しない、または参照先の
 * カードが is_active=false や deck_zone_class != 'special' になっている場合は
 * console.error でログを残した上でその候補を除外する（黙って1件だけ返すのではなく、
 * 検知可能な形で欠損を明示する）。
 */
export async function getSpecialSlotOptions(admin: ReturnType<typeof createAdminClient>): Promise<SpecialSlotOption[]> {
  const { data: representatives, error: repError } = await admin
    .from('special_slot_representatives')
    .select('key,card_id')
  if (repError) throw repError

  const repByKey = new Map((representatives ?? []).map(row => [row.key as SpecialSlotKey, row.card_id as string]))
  const cardIds = SPECIAL_SLOT_KEYS.map(key => repByKey.get(key)).filter((id): id is string => Boolean(id))

  const cardById = new Map<string, { id: string; image_url: string | null; is_active: boolean; deck_zone_class: string | null }>()
  if (cardIds.length) {
    const { data: cards, error: cardsError } = await admin
      .from('cards')
      .select('id,image_url,is_active,deck_zone_class')
      .in('id', cardIds)
    if (cardsError) throw cardsError
    for (const card of cards ?? []) cardById.set(card.id, card)
  }

  const options: SpecialSlotOption[] = []
  for (const key of SPECIAL_SLOT_KEYS) {
    const cardId = repByKey.get(key)
    if (!cardId) {
      console.error(`getSpecialSlotOptions: special_slot_representatives is missing key "${key}" — the special slot will offer fewer than 2 candidates until this is fixed`)
      continue
    }
    const card = cardById.get(cardId)
    if (!card || !card.is_active || card.deck_zone_class !== 'special') {
      console.error(`getSpecialSlotOptions: representative for key "${key}" (cards.id=${cardId}) is missing, inactive, or no longer classified 'special'`)
      continue
    }
    options.push({ key, label: SPECIAL_SLOT_LABELS[key], cardId: card.id, imageUrl: card.image_url })
  }
  return options
}

/** null（「なし」）は常に許可。それ以外は現行の許可候補一覧に含まれる場合のみ許可。 */
export function isAllowedSpecialCardId(options: SpecialSlotOption[], candidateId: string | null) {
  if (!candidateId) return true
  return options.some(option => option.cardId === candidateId)
}

/**
 * 保存時のバリデーション用。candidateId が現行の代表マッピングに含まれていれば許可。
 * 含まれていなくても、そのデッキに既に保存済みの specialCardId と完全一致する場合は
 * 許可する（グランドファーザー救済）：管理者が special_slot_representatives の
 * 代表を差し替えても、その変更以前に正当に保存済みだった値まで無効化してはならない。
 * 一方、既存値と異なる・現行候補にもない値を新規に指定することはできない。
 */
export function isAllowedSpecialCardIdWithGrandfather(
  options: SpecialSlotOption[],
  candidateId: string | null,
  existingCardId: string | null,
): boolean {
  if (!candidateId) return true
  if (candidateId === existingCardId) return true
  return isAllowedSpecialCardId(options, candidateId)
}
