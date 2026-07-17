import { createHash } from 'node:crypto'

export const OFFICIAL_DETAIL_URL = /^https:\/\/dm\.takaratomy\.co\.jp\/card\/detail\/?\?id=([a-z0-9_-]+)$/i
export const PARSER_VERSION = 4

const decode = (value) => value
  .replace(/<br\s*\/?\s*>/gi, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0*39;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
  .replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n').trim()

const capture = (block, pattern) => {
  const value = block.match(pattern)?.[1]
  return value ? decode(value) || null : null
}

export function normalizeCardName(value) {
  return value.normalize('NFKC').replace(/[\s\u3000]+/g, '').toLocaleLowerCase('ja')
}

export function contentHash(html) {
  return createHash('sha256').update(html).digest('hex')
}

export function isSuspiciousFaceName(name) {
  return /\{[^}]+\}\s*(?:Top|Bottom)\b/i.test(name) || /(?:^|\s)(?:Top|Bottom)$/.test(name)
}

export function extractOfficialCardFaces(html, officialPageUrl) {
  const starts = [...html.matchAll(/<div\b[^>]*class=(['"])[^'"]*\bcardDetail\b[^'"]*\1[^>]*>/gi)]
  return starts.map((start, sideIndex) => {
    const from = (start.index ?? 0) + start[0].length
    const to = starts[sideIndex + 1]?.index ?? html.indexOf('<div class="productCard">', from)
    const block = html.slice(from, to > from ? to : html.length)
    const name = capture(block, /<h3\b[^>]*class=(?:['"])[^'"]*\bcard-name\b[^'"]*(?:['"])[^>]*>([\s\S]*?)(?:<span\b[^>]*class=(?:['"])[^'"]*\bpackname\b|<\/h3>)/i)
    const packLabel = capture(block, /<span\b[^>]*class=(?:['"])[^'"]*\bpackname\b[^'"]*(?:['"])[^>]*>\s*\((.*?)\)\s*<\/span>/i)
    const imagePath = block.match(/<div\b[^>]*class=(?:['"])[^'"]*\bcard-img\b[^'"]*(?:['"])[^>]*>\s*<img\b[^>]*src=(?:['"])([^'"]*)/i)?.[1] ?? null
    const imageUrl = imagePath ? new URL(imagePath, officialPageUrl) : null
    const kindText = capture(block, /<td\b[^>]*class=(?:['"])[^'"]*\btype\b[^'"]*(?:['"])[^>]*>([\s\S]*?)<\/td>/i)
    return name ? {
      side_index: sideIndex,
      side_kind: sideIndex === 0 ? 'front' : 'back',
      name,
      normalized_name: normalizeCardName(name),
      name_kana: null,
      card_number: packLabel?.replace(/^\S+\s+/, '') ?? null,
      card_type: kindText,
      image_url: imageUrl?.origin === new URL(officialPageUrl).origin && imageUrl.pathname.startsWith('/wp-content/card/cardimage/') ? imageUrl.href : null,
      official_page_url: officialPageUrl,
      extraction_status: isSuspiciousFaceName(name) ? 'needs_review' : 'name_kana_pending',
    } : null
  }).filter((face) => Boolean(face?.name && face.image_url))
}

export function classifyFailure(status, error) {
  if (status === 404) return 'http_404'
  if (status === 429) return 'http_429'
  if (status >= 500) return 'http_5xx'
  if (error?.code === 'PARSE_FAILED') return 'parse_failed'
  return 'failed'
}
