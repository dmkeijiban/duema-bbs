import type { Category } from '@/types'

export type ConsolidatedCategorySlug =
  | 'chat'
  | 'new-products'
  | 'deck-rules'
  | 'tournament-meta'
  | 'market-premium'
  | 'duel-pro-special'
  | 'memory-anime'
  | 'youtuber-controversy'
  | 'custom-creation'

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
    name: '雑談',
    slug: 'chat',
    color: '#607d8b',
    description: '雑談、話題全般',
    sort_order: 1,
    primarySlug: 'chat',
    aliases: ['chat'],
  },
  {
    name: '新カード・新商品',
    slug: 'new-products',
    color: '#e74c3c',
    description: '新カード、新商品情報',
    sort_order: 2,
    primarySlug: 'new-cards',
    aliases: ['new-cards'],
  },
  {
    name: 'デッキ・ルール相談',
    slug: 'deck-rules',
    color: '#3498db',
    description: 'デッキ相談、初心者・復帰勢、ルール・裁定相談',
    sort_order: 3,
    primarySlug: 'deck',
    aliases: ['deck', 'beginner-returning', 'rules'],
  },
  {
    name: '大会・環境',
    slug: 'tournament-meta',
    color: '#27ae60',
    description: '大会、CS、環境関係',
    sort_order: 4,
    primarySlug: 'tournament',
    aliases: ['tournament'],
  },
  {
    name: '高騰・殿堂関連',
    slug: 'market-premium',
    color: '#f39c12',
    description: 'カード価格、高騰、下落、殿堂関連',
    sort_order: 5,
    primarySlug: 'price',
    aliases: ['price'],
  },
  {
    name: 'デュエプレ・特殊ルール',
    slug: 'duel-pro-special',
    color: '#9b59b6',
    description: 'デュエプレ、デュエパ等の特殊ルール、殿堂関連',
    sort_order: 6,
    primarySlug: 'duel-pro',
    aliases: ['duel-pro', 'special-rules', 'pureden'],
  },
  {
    name: '思い出・アニメ・漫画',
    slug: 'memory-anime',
    color: '#795548',
    description: '思い出、背景ストーリー、アニメ・漫画',
    sort_order: 7,
    primarySlug: 'classic',
    aliases: ['classic', 'story', 'anime'],
  },
  {
    name: 'デュエチューバー・炎上',
    slug: 'youtuber-controversy',
    color: '#e67e22',
    description: 'デュエチューバー、炎上・物議',
    sort_order: 8,
    primarySlug: 'youtuber',
    aliases: ['youtuber', 'controversy'],
  },
  {
    name: 'オリカ・創作',
    slug: 'custom-creation',
    color: '#8b5cf6',
    description: 'オリカ、創作関連',
    sort_order: 9,
    primarySlug: 'custom-card',
    aliases: ['custom-card'],
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
  if (!category) return slug ? [slug] : []
  return Array.from(new Set([category.slug, category.primarySlug, ...category.aliases]))
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
    categories.find(category => category.slug === consolidated.slug) ??
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
      categories.find(category => category.slug === consolidated.slug) ??
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
  return getConsolidatedCategories(categories)
}
