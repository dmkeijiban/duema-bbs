import { readFile } from 'node:fs/promises'
import path from 'node:path'

export type ZukanArticleLink = {
  label: string
  href: string
}

export type ZukanArticleBlock =
  | { type: 'heading'; level?: 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'packHero'; caption?: string }
  | { type: 'card'; slug?: string; id?: string; caption?: string }
  | { type: 'cardGrid'; slugs?: string[]; ids?: string[]; title?: string; caption?: string }
  | { type: 'note'; text: string }
  | { type: 'relatedLinks'; title?: string; links: ZukanArticleLink[] }

export type ZukanArticle = {
  slug: string
  targetType: 'pack' | 'hall-of-fame'
  targetSlug: string
  title: string
  description?: string
  blocks: ZukanArticleBlock[]
}

function isArticleSlug(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/i.test(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(asString).filter((item): item is string => !!item)
    : []
}

function parseBlock(value: unknown): ZukanArticleBlock | null {
  if (!isRecord(value)) return null
  const type = asString(value.type)

  if (type === 'heading') {
    const text = asString(value.text)
    if (!text) return null
    return { type, level: value.level === 3 ? 3 : 2, text }
  }

  if (type === 'paragraph') {
    const text = asString(value.text)
    return text ? { type, text } : null
  }

  if (type === 'packHero') {
    return { type, caption: asString(value.caption) ?? undefined }
  }

  if (type === 'card') {
    const slug = asString(value.slug)
    const id = asString(value.id)
    if (!slug && !id) return null
    return { type, slug: slug ?? undefined, id: id ?? undefined, caption: asString(value.caption) ?? undefined }
  }

  if (type === 'cardGrid') {
    const slugs = asStringArray(value.slugs)
    const ids = asStringArray(value.ids)
    if (slugs.length === 0 && ids.length === 0) return null
    return {
      type,
      slugs,
      ids,
      title: asString(value.title) ?? undefined,
      caption: asString(value.caption) ?? undefined,
    }
  }

  if (type === 'note') {
    const text = asString(value.text)
    return text ? { type, text } : null
  }

  if (type === 'relatedLinks') {
    const links = Array.isArray(value.links)
      ? value.links
        .map(link => {
          if (!isRecord(link)) return null
          const label = asString(link.label)
          const href = asString(link.href)
          return label && href ? { label, href } : null
        })
        .filter((link): link is ZukanArticleLink => !!link)
      : []
    if (links.length === 0) return null
    return { type, title: asString(value.title) ?? undefined, links }
  }

  return null
}

export async function loadZukanArticle(slug: string): Promise<ZukanArticle | null> {
  if (!isArticleSlug(slug)) return null

  try {
    const filePath = path.join(process.cwd(), 'data', 'zukan-articles', `${slug}.json`)
    const raw = await readFile(filePath, 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return null

    const articleSlug = asString(parsed.slug) ?? slug
    const targetType = parsed.targetType === 'hall-of-fame' ? 'hall-of-fame' : 'pack'
    const targetSlug = asString(parsed.targetSlug)
    const title = asString(parsed.title)
    if (!isArticleSlug(articleSlug) || !targetSlug || !title || !Array.isArray(parsed.blocks)) return null

    return {
      slug: articleSlug,
      targetType,
      targetSlug,
      title,
      description: asString(parsed.description) ?? undefined,
      blocks: parsed.blocks.map(parseBlock).filter((block): block is ZukanArticleBlock => !!block),
    }
  } catch {
    return null
  }
}

export function getZukanArticleCardIdentifiers(article: ZukanArticle): string[] {
  const identifiers: string[] = []
  for (const block of article.blocks) {
    if (block.type === 'card') {
      if (block.id) identifiers.push(block.id)
      if (block.slug) identifiers.push(block.slug)
    }
    if (block.type === 'cardGrid') {
      identifiers.push(...(block.ids ?? []), ...(block.slugs ?? []))
    }
  }
  return Array.from(new Set(identifiers))
}
