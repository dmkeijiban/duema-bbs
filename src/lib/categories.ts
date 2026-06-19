import type { Category } from '@/types'

export type ConsolidatedCategorySlug =
  | 'chat-question'
  | 'new-products'
  | 'deck-meta'
  | 'rules'
  | 'market'
  | 'memory-creation'
  | 'site-info'

type ConsolidatedCategory = {
  name: string
  slug: ConsolidatedCategorySlug
  color: string
  description: string
  sort_order: number
  primarySlug: string
  aliases: string[]
}

export const CONSOLIDATED_CATEGORIES: ConsolidatedCategory[] = [
  {
    name: '雑談・質問',
    slug: 'chat-question',
    color: '#607d8b',
    description: '雑談、初心者・復帰勢の質問、話題全般',
    sort_order: 1,
    primarySlug: 'chat',
    aliases: ['chat', 'beginner-returning', 'youtuber', 'controversy'],
  },
  {
    name: '新カード・商品',
    slug: 'new-products',
    color: '#e74c3c',
    description: '新カード、新商品、殿堂発表など',
    sort_order: 2,
    primarySlug: 'new-cards',
    aliases: ['new-cards'],
  },
  {
    name: 'デッキ・環境',
    slug: 'deck-meta',
    color: '#3498db',
    description: 'デッキ相談、大会環境、デュエプレ、殿堂環境',
    sort_order: 3,
    primarySlug: 'deck',
    aliases: ['deck', 'tournament', 'duel-pro', 'pureden'],
  },
  {
    name: 'ルール・裁定',
    slug: 'rules',
    color: '#00bcd4',
    description: 'ルール、裁定、特殊ルール',
    sort_order: 4,
    primarySlug: 'rules',
    aliases: ['rules', 'special-rules'],
  },
  {
    name: '高騰・相場',
    slug: 'market',
    color: '#f39c12',
    description: 'カード価格、高騰、下落、相場情報',
    sort_order: 5,
    primarySlug: 'price',
    aliases: ['price'],
  },
  {
    name: '思い出・創作',
    slug: 'memory-creation',
    color: '#795548',
    description: '思い出、背景ストーリー、アニメ・漫画、オリカ',
    sort_order: 6,
    primarySlug: 'classic',
    aliases: ['classic', 'story', 'anime', 'custom-card'],
  },
  {
    name: '運営・その他',
    slug: 'site-info',
    color: '#6b7280',
    description: '管理者連絡など、運営・その他の話題',
    sort_order: 7,
    primarySlug: 'admin-contact',
    aliases: ['admin-contact'],
  },
]

const CATEGORY_BY_NEW_SLUG = new Map<string, ConsolidatedCategory>(
  CONSOLIDATED_CATEGORIES.map(category => [category.slug, category])
)

const CATEGORY_BY_ALIAS = new Map<string, ConsolidatedCategory>(
  CONSOLIDATED_CATEGORIES.flatMap(category =>
    category.aliases.map(alias => [alias, category] as const)
  )
)

export function getConsolidatedCategoryBySlug(slug: string | null | undefined) {
  if (!slug) return null
  return CATEGORY_BY_NEW_SLUG.get(slug) ?? CATEGORY_BY_ALIAS.get(slug) ?? null
}

export function getCategoryAliases(slug: string | null | undefined): string[] {
  const category = getConsolidatedCategoryBySlug(slug)
  return category ? category.aliases : slug ? [slug] : []
}

export function getDisplayCategory(category: Category | null | undefined): Category | null {
  if (!category) return null
  const consolidated = getConsolidatedCategoryBySlug(category.slug)
  if (!consolidated) return category
  return {
    ...category,
    name: consolidated.name,
    slug: consolidated.slug,
    color: consolidated.color,
    description: consolidated.description,
    sort_order: consolidated.sort_order,
  }
}

export function getDisplayCategoryBySlug(slug: string, categories: Category[]): Category | null {
  const consolidated = getConsolidatedCategoryBySlug(slug)
  if (!consolidated) return categories.find(category => category.slug === slug) ?? null

  const base =
    categories.find(category => category.slug === consolidated.primarySlug) ??
    categories.find(category => consolidated.aliases.includes(category.slug))

  if (!base) return null
  return {
    ...base,
    name: consolidated.name,
    slug: consolidated.slug,
    color: consolidated.color,
    description: consolidated.description,
    sort_order: consolidated.sort_order,
  }
}

export function getCategoryIdsForSlug(slug: string | null | undefined, categories: Category[]): number[] {
  if (!slug) return []
  const aliases = getCategoryAliases(slug)
  return categories
    .filter(category => aliases.includes(category.slug))
    .map(category => category.id)
}

export function getConsolidatedCategories(categories: Category[]): Category[] {
  return CONSOLIDATED_CATEGORIES.flatMap(consolidated => {
    const base =
      categories.find(category => category.slug === consolidated.primarySlug) ??
      categories.find(category => consolidated.aliases.includes(category.slug))

    if (!base) return []
    return [{
      ...base,
      name: consolidated.name,
      slug: consolidated.slug,
      color: consolidated.color,
      description: consolidated.description,
      sort_order: consolidated.sort_order,
    }]
  })
}

export function getPostableConsolidatedCategories(categories: Category[]): Category[] {
  return getConsolidatedCategories(categories).filter(category => category.slug !== 'site-info')
}
