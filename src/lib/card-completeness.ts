export type CardCompletenessInput = {
  image_url: string | null
  civilization: string[] | null
  cost: number | null
  card_type: string | null
}

export const CARD_INCOMPLETE_OR_FILTER =
  'image_url.is.null,civilization.eq.{},cost.is.null,card_type.is.null'

export function getCardMissingFields(card: CardCompletenessInput) {
  const missing: string[] = []

  if (!card.image_url?.trim()) missing.push('画像')
  if (!card.civilization?.length) missing.push('文明')
  if (card.cost == null) missing.push('コスト')
  if (!card.card_type?.trim()) missing.push('種類')

  return missing
}

export function isCardIncomplete(card: CardCompletenessInput) {
  return getCardMissingFields(card).length > 0
}
