import type { ZukanArticleBlock, ZukanArticleLink } from './zukan-articles'

type ParseOk = {
  ok: true
  blocks: ZukanArticleBlock[]
}

type ParseError = {
  ok: false
  error: string
}

export type ZukanArticleBodyParseResult = ParseOk | ParseError

type DirectiveHandler = (arg: string, body: string[]) => ZukanArticleBlock | ParseError | null

const DIRECTIVE_START_RE = /^\{\{([A-Z]+)(?::(.*))?$/

function normalizeDirectiveArg(value: string | undefined) {
  return (value ?? '').replace(/\}\}\s*$/, '').trim()
}

function normalizeIdentifier(value: string) {
  return value.trim().toLowerCase()
}

function compactLines(lines: string[]) {
  return lines
    .map(line => line.trim())
    .filter(Boolean)
}

function buildRelatedLinks(lines: string[]): ZukanArticleLink[] {
  return compactLines(lines)
    .map(line => {
      const [label, href] = line.includes('|')
        ? line.split('|', 2).map(part => part.trim())
        : line.split(/\s+/, 2).map(part => part.trim())
      return label && href ? { label, href } : null
    })
    .filter((link): link is ZukanArticleLink => !!link)
}

const directiveHandlers: Record<string, DirectiveHandler> = {
  PACK: (_arg, body) => {
    const caption = compactLines(body).join('\n')
    return { type: 'packHero', caption: caption || undefined }
  },
  CARD: (arg, body) => {
    const slug = normalizeIdentifier(arg)
    const caption = compactLines(body).join('\n')
    return slug
      ? { type: 'card', slug, caption: caption || undefined }
      : { ok: false, error: '{{CARD:slug}} のslugが空です。' }
  },
  CARDGRID: (arg, body) => {
    const slugs = compactLines(body).map(normalizeIdentifier)
    return slugs.length > 0
      ? { type: 'cardGrid', slugs, title: arg.trim() || undefined }
      : { ok: false, error: '{{CARDGRID: ... }} にカードslugがありません。' }
  },
  NOTE: (arg, body) => {
    const text = [arg, ...body].join('\n').trim()
    return text ? { type: 'note', text } : { ok: false, error: '{{NOTE: ... }} の本文が空です。' }
  },
  RELATED: (arg, body) => {
    const links = buildRelatedLinks(body)
    if (links.length === 0) return { ok: false, error: '{{RELATED: ... }} にリンクがありません。' }
    return { type: 'relatedLinks', title: arg.trim() || undefined, links }
  },
}

function isParseError(value: ZukanArticleBlock | ParseError | null): value is ParseError {
  return !!value && 'ok' in value && value.ok === false
}

function blockToBodyText(block: ZukanArticleBlock, targetSlug?: string): string | null {
  if (block.type === 'heading') {
    return `${block.level === 3 ? '##' : '#'} ${block.text}`
  }

  if (block.type === 'paragraph') return block.text

  if (block.type === 'packHero') {
    return block.caption
      ? `{{PACK:${targetSlug ?? ''}\n${block.caption}\n}}`
      : `{{PACK:${targetSlug ?? ''}}}`
  }

  if (block.type === 'card') {
    const identifier = block.slug ?? block.id
    if (!identifier) return null
    return block.caption
      ? `{{CARD:${identifier}\n${block.caption}\n}}`
      : `{{CARD:${identifier}}}`
  }

  if (block.type === 'cardGrid') {
    const identifiers = [...(block.slugs ?? []), ...(block.ids ?? [])]
    if (identifiers.length === 0) return null
    return `{{CARDGRID:${block.title ?? ''}\n${identifiers.join('\n')}\n}}`
  }

  if (block.type === 'note') {
    return `{{NOTE:\n${block.text}\n}}`
  }

  if (block.type === 'relatedLinks') {
    const links = block.links.map(link => `${link.label} | ${link.href}`)
    return `{{RELATED:${block.title ?? ''}\n${links.join('\n')}\n}}`
  }

  return null
}

export function zukanArticleBlocksToBodyText(blocks: unknown, targetSlug?: string): string {
  if (!Array.isArray(blocks)) return ''
  return blocks
    .map(block => blockToBodyText(block as ZukanArticleBlock, targetSlug))
    .filter((text): text is string => !!text)
    .join('\n\n')
}

export function parseZukanArticleBodyText(raw: string): ZukanArticleBodyParseResult {
  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  const blocks: ZukanArticleBlock[] = []
  let paragraph: string[] = []

  function flushParagraph() {
    const text = paragraph.join('\n').trim()
    if (text) blocks.push({ type: 'paragraph', text })
    paragraph = []
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const trimmed = line.trim()

    if (!trimmed) {
      flushParagraph()
      continue
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/)
    if (heading?.[2]) {
      flushParagraph()
      blocks.push({ type: 'heading', level: heading[1].length >= 3 ? 3 : 2, text: heading[2].trim() })
      continue
    }

    const directiveStart = trimmed.match(DIRECTIVE_START_RE)
    if (directiveStart) {
      flushParagraph()
      const name = directiveStart[1]
      const handler = directiveHandlers[name]
      if (!handler) return { ok: false, error: `未対応の記法です: {{${name}:...}}` }

      const body: string[] = []
      let arg = normalizeDirectiveArg(directiveStart[2])
      const closesOnStartLine = trimmed.endsWith('}}')
      if (!closesOnStartLine) {
        let closed = false
        for (index += 1; index < lines.length; index += 1) {
          const inner = lines[index]
          if (inner.trim() === '}}') {
            closed = true
            break
          }
          if (inner.includes('}}')) {
            const [beforeClose] = inner.split('}}', 1)
            body.push(beforeClose)
            closed = true
            break
          }
          body.push(inner)
        }
        if (!closed) return { ok: false, error: `{{${name}:...}} が閉じられていません。` }
      } else if (directiveStart[2]?.includes('}}')) {
        arg = normalizeDirectiveArg(directiveStart[2])
      }

      const block = handler(arg, body)
      if (isParseError(block)) return block
      if (block) blocks.push(block)
      continue
    }

    paragraph.push(line)
  }

  flushParagraph()
  return { ok: true, blocks }
}
