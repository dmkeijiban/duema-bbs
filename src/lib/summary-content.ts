const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'h1',
  'h2',
  'h3',
  'strong',
  'b',
  'em',
  'i',
  'ul',
  'ol',
  'li',
  'a',
  'img',
  'figure',
  'div',
])

const MARKER_ATTRS = new Set(['data-youtube', 'data-tweet', 'data-link-card'])

function decodeCommonEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function isSafeUrl(value: string): boolean {
  return /^(https?:|\/)/i.test(value)
}

function sanitizeAttributes(tagName: string, rawAttrs: string): string {
  const attrs: string[] = []
  const attrRe = /([a-zA-Z0-9:-]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
  let match: RegExpExecArray | null

  while ((match = attrRe.exec(rawAttrs))) {
    const name = match[1].toLowerCase()
    const value = match[3] ?? match[4] ?? match[5] ?? ''

    if (name.startsWith('on') || name === 'style' || name === 'srcdoc') continue

    if (tagName === 'a' && name === 'href' && isSafeUrl(value)) {
      attrs.push(`href="${escapeHtml(value)}" target="_blank" rel="noopener noreferrer"`)
      continue
    }

    if (tagName === 'img') {
      if ((name === 'src' && isSafeUrl(value)) || name === 'alt' || name === 'title') {
        attrs.push(`${name}="${escapeHtml(value)}"`)
      }
      continue
    }

    if (tagName === 'figure' && name === 'class' && value === 'card-image') {
      attrs.push('class="card-image"')
      continue
    }

    if (tagName === 'div' && MARKER_ATTRS.has(name)) {
      attrs.push(`${name}="${escapeHtml(value)}"`)
    }
  }

  if (tagName === 'img') attrs.push('loading="lazy"')
  return attrs.length ? ` ${attrs.join(' ')}` : ''
}

export function stripVisibleHtmlTags(value: string | null | undefined): string {
  const decoded = decodeCommonEntities(String(value ?? ''))
  return decoded
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<\/?span\b[^>]*>/gi, '')
    .replace(/<\/?font\b[^>]*>/gi, '')
}

export function sanitizeSummaryHtml(value: string | null | undefined): string {
  const input = stripVisibleHtmlTags(value)

  return input.replace(/<\/?([a-zA-Z0-9]+)([^>]*)>/g, (full, rawName, rawAttrs) => {
    const tagName = String(rawName).toLowerCase()
    const closing = /^<\//.test(full)
    if (!ALLOWED_TAGS.has(tagName)) return ''
    if (closing) return `</${tagName}>`
    return `<${tagName}${sanitizeAttributes(tagName, rawAttrs ?? '')}>`
  })
}

export function cleanSummaryEditorHtml(value: string | null | undefined): string {
  return sanitizeSummaryHtml(value)
}

export function summaryTextExcerpt(value: string | null | undefined, max = 160): string {
  return stripVisibleHtmlTags(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}
