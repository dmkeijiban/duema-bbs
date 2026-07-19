export type CardPrintingOrder = {
  id: string
  source_key: string
  release_date: string | null
  official_sort_position: number | null
  card_number?: string | null
}

const collator = new Intl.Collator('ja', { numeric: true, sensitivity: 'base' })

function compareNullableNumber(first: number | null, second: number | null) {
  if (first == null) return second == null ? 0 : 1
  if (second == null) return -1
  return first - second
}

function compareNullableDateDesc(first: string | null, second: string | null) {
  if (first == null) return second == null ? 0 : 1
  if (second == null) return -1
  return second.localeCompare(first)
}

/** 公式検索の表示位置を正本にし、未採番データも発売日・番号・UUIDで安定化する。 */
export function compareCardPrintingsOfficial(first: CardPrintingOrder, second: CardPrintingOrder) {
  return compareNullableNumber(first.official_sort_position, second.official_sort_position)
    || compareNullableDateDesc(first.release_date, second.release_date)
    || collator.compare(first.source_key.split('-')[0] ?? '', second.source_key.split('-')[0] ?? '')
    || collator.compare(first.card_number ?? first.source_key, second.card_number ?? second.source_key)
    || first.id.localeCompare(second.id)
}
