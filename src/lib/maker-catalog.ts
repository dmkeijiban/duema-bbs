export const MAKER_CATEGORIES = ['create', 'select', 'vote', 'quiz', 'archive'] as const
export type MakerCategory = typeof MAKER_CATEGORIES[number]

export const MAKER_CATEGORY_LABELS: Record<MakerCategory, string> = {
  create: '作る', select: 'カードを選ぶ', vote: '投票・予想', quiz: 'クイズ・診断', archive: '過去の企画',
}

export type MakerCatalogConfig = {
  showInCatalog: boolean
  featured: boolean
  category: MakerCategory
  sortOrder: number
  isNew: boolean
  isLimited: boolean
  showInArchive: boolean
  adminOnly: boolean
  startsAt: string
  endsAt: string
  shortDescription: string
  thumbnailUrl: string
}

type ProjectLike = { slug: string; type: string; status: string; is_public: boolean; config: Record<string, unknown> | null }

function text(raw: Record<string, unknown>, key: string) {
  return typeof raw[key] === 'string' ? String(raw[key]).trim() : ''
}

export function parseMakerCatalogConfig(project: ProjectLike): MakerCatalogConfig {
  const raw = project.config ?? {}
  const catalog = raw.catalog && typeof raw.catalog === 'object' && !Array.isArray(raw.catalog)
    ? raw.catalog as Record<string, unknown> : {}
  const inferredCategory: MakerCategory = project.type === 'select' ? 'select' : project.type === 'quiz' ? 'quiz' : 'vote'
  const category = MAKER_CATEGORIES.includes(catalog.category as MakerCategory) ? catalog.category as MakerCategory : inferredCategory
  return {
    showInCatalog: catalog.showInCatalog !== false,
    featured: catalog.featured === true,
    category,
    sortOrder: Number.isFinite(Number(catalog.sortOrder)) ? Number(catalog.sortOrder) : 100,
    isNew: catalog.isNew === true,
    isLimited: catalog.isLimited === true,
    showInArchive: catalog.showInArchive === true,
    adminOnly: catalog.adminOnly === true,
    startsAt: text(catalog, 'startsAt'), endsAt: text(catalog, 'endsAt'),
    shortDescription: text(catalog, 'shortDescription') || text(raw, 'description'),
    thumbnailUrl: text(catalog, 'thumbnailUrl'),
  }
}

export function isMakerProjectVisible(project: ProjectLike, now = new Date()) {
  const c = parseMakerCatalogConfig(project)
  if (!project.is_public || project.status !== 'published' || !c.showInCatalog || c.adminOnly) return false
  const time = now.getTime()
  if (c.startsAt && new Date(c.startsAt).getTime() > time) return false
  if (c.endsAt && new Date(c.endsAt).getTime() < time) return c.showInArchive
  return true
}

export function isMakerProjectArchived(project: ProjectLike, now = new Date()) {
  const c = parseMakerCatalogConfig(project)
  return Boolean(c.endsAt && new Date(c.endsAt).getTime() < now.getTime() && c.showInArchive)
}

export const STATIC_MAKER_ENTRIES = [
  { id: 'deck-maker', title: 'デッキメーカー', href: '/makers/deck-maker', category: 'create' as const, sortOrder: 10, description: 'カードを検索してデッキ画像を作成できます。' },
  { id: 'zukan', title: '思い出図鑑', href: '/zukan', category: 'create' as const, sortOrder: 20, description: '思い出のカードを選んで、自分だけの図鑑を作れます。' },
]
