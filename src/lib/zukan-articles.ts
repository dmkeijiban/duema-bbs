import { createPublicClient } from './supabase-public'

export type ZukanArticleLink = {
  label: string
  href: string
}

export type ZukanArticleStatus = 'draft' | 'published' | 'archived'
export type ZukanArticleTargetType = 'pack_article' | 'card_article' | 'hall_of_fame_article'

export type ZukanArticleBlock =
  | { type: 'heading'; level?: 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'packHero'; caption?: string }
  | { type: 'card'; slug?: string; id?: string; caption?: string }
  | { type: 'cardGrid'; slugs?: string[]; ids?: string[]; title?: string; caption?: string }
  | { type: 'note'; text: string }
  | { type: 'relatedLinks'; title?: string; links: ZukanArticleLink[] }

export type ZukanArticle = {
  id?: string
  slug: string
  targetType: ZukanArticleTargetType
  targetSlug: string
  title: string
  description?: string
  status?: ZukanArticleStatus
  blocks: ZukanArticleBlock[]
}

export type ZukanArticleSummary = Omit<ZukanArticle, 'blocks'> & {
  targetName: string
  updatedAt: string | null
  createdAt: string | null
}

type ZukanArticleRow = {
  id: string
  slug: string
  article_type: string
  target_id: string
  title: string
  description: string | null
  status: string
  blocks: unknown
  updated_at?: string | null
  created_at?: string | null
}

const TABLE_NOT_FOUND = '42P01'

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

export function parseZukanArticleBlock(value: unknown): ZukanArticleBlock | null {
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

export function normalizeZukanArticleTargetType(value: unknown): ZukanArticleTargetType | null {
  if (value === 'pack_article' || value === 'pack') return 'pack_article'
  if (value === 'card_article' || value === 'card') return 'card_article'
  if (value === 'hall_of_fame_article' || value === 'hall-of-fame') return 'hall_of_fame_article'
  return null
}

export function normalizeZukanArticleStatus(value: unknown): ZukanArticleStatus | null {
  if (value === 'draft' || value === 'published' || value === 'archived') return value
  return null
}

export function parseZukanArticleBlocks(value: unknown): ZukanArticleBlock[] | null {
  if (!Array.isArray(value)) return null
  const blocks = value
    .map(parseZukanArticleBlock)
    .filter((block): block is ZukanArticleBlock => !!block)
  return blocks.length === value.length ? blocks : null
}

export function parseZukanArticleJson(
  value: unknown,
  fallback?: {
    slug?: string
    targetType?: ZukanArticleTargetType
    targetSlug?: string
    title?: string
    description?: string
    status?: ZukanArticleStatus
  },
): ZukanArticle | null {
  if (!isRecord(value)) return null

  const articleSlug = asString(value.slug) ?? fallback?.slug
  const targetType = normalizeZukanArticleTargetType(value.targetType ?? value.article_type) ?? fallback?.targetType
  const targetSlug = asString(value.targetSlug ?? value.target_id) ?? fallback?.targetSlug
  const title = asString(value.title) ?? fallback?.title
  const blocks = parseZukanArticleBlocks(value.blocks)

  if (!articleSlug || !isArticleSlug(articleSlug) || !targetType || !targetSlug || !title || !blocks) {
    return null
  }

  return {
    id: asString(value.id) ?? undefined,
    slug: articleSlug,
    targetType,
    targetSlug,
    title,
    description: asString(value.description) ?? fallback?.description,
    status: normalizeZukanArticleStatus(value.status) ?? fallback?.status,
    blocks,
  }
}

function articleFromRow(row: ZukanArticleRow): ZukanArticle | null {
  const targetType = normalizeZukanArticleTargetType(row.article_type)
  const status = normalizeZukanArticleStatus(row.status)
  const blocks = parseZukanArticleBlocks(row.blocks)
  if (!targetType || !status || !blocks) return null

  return {
    id: row.id,
    slug: row.slug,
    targetType,
    targetSlug: row.target_id,
    title: row.title,
    description: row.description ?? undefined,
    status,
    blocks,
  }
}

export async function loadPublishedZukanArticles(): Promise<ZukanArticle[]> {
  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('zukan_articles')
      .select('id, slug, article_type, target_id, title, description, status, blocks')
      .eq('status', 'published')
      .order('updated_at', { ascending: false })
      .limit(100)
    if (error) return []
    return ((data ?? []) as ZukanArticleRow[])
      .map(articleFromRow)
      .filter((article): article is ZukanArticle => !!article)
  } catch {
    return []
  }
}

export async function loadPublishedZukanArticleSummaries(): Promise<ZukanArticleSummary[]> {
  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('zukan_articles')
      .select('id, slug, article_type, target_id, title, description, status, blocks, updated_at, created_at')
      .eq('status', 'published')
      .order('updated_at', { ascending: false })
      .limit(100)
    if (error) return []

    const rows = (data ?? []) as ZukanArticleRow[]
    const articles = rows
      .map(row => {
        const article = articleFromRow(row)
        return article ? { article, row } : null
      })
      .filter((item): item is { article: ZukanArticle; row: ZukanArticleRow } => !!item)

    if (articles.length === 0) return []

    const packSlugs = Array.from(new Set(
      articles
        .filter(({ article }) => article.targetType === 'pack_article')
        .map(({ article }) => article.targetSlug),
    ))
    const cardSlugs = Array.from(new Set(
      articles
        .filter(({ article }) => article.targetType === 'card_article')
        .map(({ article }) => article.targetSlug),
    ))

    const packNameMap = new Map<string, string>()
    const cardNameMap = new Map<string, string>()

    if (packSlugs.length > 0) {
      const { data: packs } = await supabase
        .from('zukan_packs')
        .select('slug, name')
        .in('slug', packSlugs)
      for (const pack of packs ?? []) {
        if (typeof pack.slug === 'string' && typeof pack.name === 'string') {
          packNameMap.set(pack.slug, pack.name)
        }
      }
    }

    if (cardSlugs.length > 0) {
      const { data: cards } = await supabase
        .from('zukan_cards')
        .select('slug, name')
        .in('slug', cardSlugs)
      for (const card of cards ?? []) {
        if (typeof card.slug === 'string' && typeof card.name === 'string') {
          cardNameMap.set(card.slug, card.name)
        }
      }
    }

    return articles.map(({ article, row }) => ({
      id: article.id,
      slug: article.slug,
      targetType: article.targetType,
      targetSlug: article.targetSlug,
      title: article.title,
      description: article.description,
      status: article.status,
      targetName: article.targetType === 'pack_article'
        ? packNameMap.get(article.targetSlug) ?? article.targetSlug
        : article.targetType === 'card_article'
          ? cardNameMap.get(article.targetSlug) ?? article.targetSlug
          : article.targetSlug,
      updatedAt: row.updated_at ?? null,
      createdAt: row.created_at ?? null,
    }))
  } catch {
    return []
  }
}

export async function loadPublishedZukanArticleBySlug(slug: string): Promise<ZukanArticle | null> {
  if (!isArticleSlug(slug)) return null

  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('zukan_articles')
      .select('id, slug, article_type, target_id, title, description, status, blocks')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle()
    if (error) {
      if (error.code === TABLE_NOT_FOUND || error.code === 'PGRST205') return null
      return null
    }
    return data ? articleFromRow(data as ZukanArticleRow) : null
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
