import type { ZukanArticleTargetType } from './zukan-articles'

const TITLE_SLUG_REPLACEMENTS: Array<[RegExp, string]> = [
  [/火文明/g, ' fire '],
  [/水文明/g, ' water '],
  [/自然文明/g, ' nature '],
  [/光文明/g, ' light '],
  [/闇文明/g, ' darkness '],
  [/多色/g, ' multicolor '],
  [/文明/g, ' civilization '],
  [/第(\d+)弾/g, ' dm-$1 '],
  [/基本セット/g, ' basic-set '],
  [/総合/g, ' overview '],
  [/紹介/g, ' guide '],
  [/特集/g, ' feature '],
  [/攻略/g, ' strategy '],
  [/考察/g, ' analysis '],
  [/原点/g, ' origin '],
  [/ドラゴン/g, ' dragon '],
  [/ワイバーン/g, ' wyvern '],
  [/ヒューマノイド/g, ' humanoid '],
  [/呪文/g, ' spells '],
  [/火力/g, ' burn '],
  [/速攻/g, ' rush '],
  [/大型/g, ' big-creatures '],
  [/小型/g, ' small-creatures '],
  [/Ｓ・トリガー|S・トリガー|Sトリガー/g, ' shield-trigger '],
]

function prepareSlugSource(value: string | null | undefined): string {
  return TITLE_SLUG_REPLACEMENTS.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    String(value ?? ''),
  )
}

function slugifyAscii(value: string | null | undefined): string {
  return prepareSlugSource(value)
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function formatTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('')
}

export function normalizeArticleSlug(value: string | null | undefined): string {
  return slugifyAscii(value)
}

export function buildDefaultArticleSlug(input: {
  articleType: ZukanArticleTargetType | null
  targetId?: string | null
  title?: string | null
  now?: Date
}): string {
  const targetId = slugifyAscii(input.targetId)
  const fromTitle = slugifyAscii(input.title)

  if (fromTitle && fromTitle !== targetId) return fromTitle

  if ((input.articleType === 'pack_article' || input.articleType === 'card_article') && targetId) {
    return targetId
  }

  if (fromTitle) return fromTitle

  return `article-${formatTimestamp(input.now ?? new Date())}`
}
