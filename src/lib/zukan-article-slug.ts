import type { ZukanArticleTargetType } from './zukan-articles'

function slugifyAscii(value: string | null | undefined): string {
  return String(value ?? '')
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
  if ((input.articleType === 'pack_article' || input.articleType === 'card_article') && targetId) {
    return targetId
  }

  const fromTitle = slugifyAscii(input.title)
  if (fromTitle) return fromTitle

  return `article-${formatTimestamp(input.now ?? new Date())}`
}
