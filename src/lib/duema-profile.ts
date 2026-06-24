export type DuemaOption = { value: string; label: string }

export const DUEMA_GENERATIONS: readonly DuemaOption[] = [
  { value: 'era_early',  label: '〜2009年（黎明期）' },
  { value: 'era_mid',    label: '2010〜2016年' },
  { value: 'era_late',   label: '2017〜2021年' },
  { value: 'era_recent', label: '2022年〜' },
  { value: 'newbie',     label: '最近始めた' },
]

export const DUEMA_CIVILIZATIONS: readonly DuemaOption[] = [
  { value: 'light',    label: '光文明' },
  { value: 'water',    label: '水文明' },
  { value: 'darkness', label: '闇文明' },
  { value: 'fire',     label: '火文明' },
  { value: 'nature',   label: '自然文明' },
  { value: 'multi',    label: '多色' },
  { value: 'zero',     label: 'ゼロ文明' },
]

export const DUEMA_PLAY_STYLES: readonly DuemaOption[] = [
  { value: 'aggro',   label: 'ビートダウン' },
  { value: 'control', label: 'コントロール' },
  { value: 'combo',   label: 'コンボ・ループ' },
  { value: 'mid',     label: 'ミッドレンジ' },
  { value: 'netdeck', label: 'ネットデッキ派' },
  { value: 'janky',   label: 'ファンデッキ派' },
  { value: 'casual',  label: 'カジュアル勢' },
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
