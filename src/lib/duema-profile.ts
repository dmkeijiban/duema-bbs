export type DuemaOption = { value: string; label: string }

export const DUEMA_GENERATIONS: readonly DuemaOption[] = [
  { value: 'katsumai', label: '切札勝舞' },
  { value: 'katsuta',  label: '切札勝太' },
  { value: 'joe',      label: '切札ジョー' },
  { value: 'other',    label: 'その他' },
]

export const DUEMA_CIVILIZATIONS: readonly DuemaOption[] = [
  { value: 'fire',     label: '火' },
  { value: 'nature',   label: '自然' },
  { value: 'water',    label: '水' },
  { value: 'light',    label: '光' },
  { value: 'darkness', label: '闇' },
  { value: 'zero',     label: 'ゼロ' },
  { value: 'other',    label: 'その他' },
]

export const DUEMA_PLAY_STYLES: readonly DuemaOption[] = [
  { value: 'casual',    label: 'カジュアル' },
  { value: 'serious',   label: 'ガチ勢' },
  { value: 'retired',   label: '引退勢' },
  { value: 'spectator', label: '見る専' },
  { value: 'other',     label: 'その他' },
]

export const DUEMA_GENERATION_MAP: Record<string, string> = Object.fromEntries(
  DUEMA_GENERATIONS.map(o => [o.value, o.label])
)
export const DUEMA_CIVILIZATION_MAP: Record<string, string> = Object.fromEntries(
  DUEMA_CIVILIZATIONS.map(o => [o.value, o.label])
)
export const DUEMA_PLAY_STYLE_MAP: Record<string, string> = Object.fromEntries(
  DUEMA_PLAY_STYLES.map(o => [o.value, o.label])
)

export const FAVORITE_CARD_MAX_LENGTH = 50
