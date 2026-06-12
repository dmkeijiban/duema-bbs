export const ZUKAN_DEFAULT_DISPLAY_NAME = '名無しのデュエリスト'
export const ZUKAN_MAX_ANON_DISPLAY_NAME_LENGTH = 15

const DEFAULT_NAME_PATTERNS = new Set([
  '',
  '匿名',
  '名無しさん',
  '名無し',
  'ななし',
  '名無しのデュエリスト',
])

export function normalizeZukanDisplayName(value: string | null | undefined): string {
  const name = String(value ?? '').trim()
  if (DEFAULT_NAME_PATTERNS.has(name)) return ZUKAN_DEFAULT_DISPLAY_NAME
  return name
}

export function normalizeZukanAnonInput(value: string | null | undefined): string {
  const trimmed = String(value ?? '').trim().slice(0, ZUKAN_MAX_ANON_DISPLAY_NAME_LENGTH)
  return normalizeZukanDisplayName(trimmed)
}
